/* 환리스크 헤지 엔진: 선물환(금리평형), 통화옵션(Garman-Kohlhagen), 딜 컨틴전트 선물환.
   해외 인수대금(서명 → 종결)과 매달 들어오는 수출 순노출을 나눠 계산한다.
   달러 금액은 백만 달러, 환율은 원/달러, 결과 금액은 억원. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../fin.js") : root.Fin);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FxEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin) {
  "use strict";

  const DEFAULTS = {
    mkt: { spot: 1400, rd: 2.5, rf: 3.75, vol: 9 },
    deal: { usd: 150, months: 6, ratio: 100, strike: 0, dcp: 0.5, shock: -10 },
    ops: { sales: 12, costs: 4, budget: 1350, ratios: [80, 50, 30], shock: -10 }
  };

  /* 백만 달러 × 원/달러 = 백만원 → 억원 */
  const eok = (usdM, rate) => usdM * rate / 100;

  /* 연속복리 금리평형: F = S × e^((원화금리 − 달러금리) × t) */
  function forward(m, months) {
    return m.spot * Math.exp((m.rd - m.rf) / 100 * months / 12);
  }

  /* 표준정규 누적분포 (Abramowitz-Stegun 7.1.26, 오차 1.5e-7) */
  function ncdf(x) {
    const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
  }

  /* Garman-Kohlhagen: 달러 1단위를 사는(콜)·파는(풋) 권리의 원화 가격, 서명 시점 */
  function option(m, K, months) {
    const t = months / 12, F = forward(m, months), df = Math.exp(-m.rd / 100 * t), s = m.vol / 100;
    if (t <= 0 || s <= 0) return { call: df * Math.max(F - K, 0), put: df * Math.max(K - F, 0), F: F, df: df };
    const d1 = (Math.log(F / K) + s * s * t / 2) / (s * Math.sqrt(t)), d2 = d1 - s * Math.sqrt(t);
    return { call: df * (F * ncdf(d1) - K * ncdf(d2)), put: df * (K * ncdf(-d2) - F * ncdf(-d1)), F: F, df: df, d1: d1, d2: d2 };
  }

  /* 인수대금 헤지: 종결 시점 환율 ST에서 전략별 원화 부담.
     close = 거래가 종결돼 달러를 실제로 사야 할 때 총 원화 비용,
     fail = 거래가 무산됐을 때 헤지 정리로 생기는 원화 부담(음수면 이익) */
  const STRATS = [
    { key: "none", label: "헤지 안 함" },
    { key: "fwd", label: "선물환" },
    { key: "opt", label: "통화옵션 (콜 매입)" },
    { key: "dc", label: "딜 컨틴전트 선물환" }
  ];
  function dealSetup(m, d) {
    const F = forward(m, d.months), K = d.strike > 0 ? d.strike : F, t = d.months / 12;
    const o = option(m, K, d.months);
    const premFV = o.call * Math.exp(m.rd / 100 * t);       /* 서명 때 낸 프리미엄을 종결 시점 가치로 */
    const dcRate = F * (1 + d.dcp / 100);
    return { F: F, K: K, prem: o.call, premFV: premFV, dcRate: dcRate, put: o.put, df: o.df, h: d.ratio / 100, N: d.usd };
  }
  function dealAt(m, d, ST, s) {
    s = s || dealSetup(m, d);
    const h = s.h, N = s.N, intr = Math.max(ST - s.K, 0);
    return {
      ST: ST,
      close: {
        none: eok(N, ST),
        fwd: eok(N, h * s.F + (1 - h) * ST),
        opt: eok(N, ST - h * intr + h * s.premFV),
        dc: eok(N, h * s.dcRate + (1 - h) * ST)
      },
      fail: {
        none: 0,
        fwd: eok(N, h * (s.F - ST)),
        opt: eok(N, h * (s.premFV - intr)),
        dc: 0
      }
    };
  }
  function deal(m, d, shocks) {
    const s = dealSetup(m, d);
    const at = dealAt(m, d, m.spot * (1 + d.shock / 100), s);
    const curve = (shocks || []).map((k) => dealAt(m, d, m.spot * (1 + k / 100), s));
    return { setup: s, at: at, curve: curve, signing: eok(s.N, m.spot), premEok: eok(s.N * s.h, s.prem), dcCostEok: eok(s.N * s.h, s.dcRate - s.F) };
  }

  /* 수출 순노출: 앞으로 12개월, 1~3개월·4~6개월·7~12개월 구간별 헤지 비율.
     환율은 모든 달에 같은 비율로 움직인다고 놓는다 */
  function ops(m, o, shock) {
    shock = shock === undefined ? o.shock : shock;
    const net = o.sales - o.costs, ST = m.spot * (1 + shock / 100);
    const rows = [];
    let un = 0, he = 0, bu = 0, hedgedUsd = 0, hedgedKrw = 0, sensUn = 0, sensHe = 0;
    for (let i = 1; i <= 12; i++) {
      const h = (i <= 3 ? o.ratios[0] : i <= 6 ? o.ratios[1] : o.ratios[2]) / 100;
      const F = forward(m, i);
      const u = eok(net, ST), hh = eok(net, h * F + (1 - h) * ST), b = eok(net, o.budget);
      rows.push({ m: i, h: h, F: F, net: net, unhedged: u, hedged: hh, budget: b });
      un += u; he += hh; bu += b;
      hedgedUsd += h * net; hedgedKrw += h * net * F;
      sensUn += eok(net, m.spot * 0.01); sensHe += eok((1 - h) * net, m.spot * 0.01);
    }
    return {
      rows: rows, net: net, netYear: net * 12, ST: ST,
      unhedged: un, hedged: he, budget: bu,
      avgFwd: hedgedUsd ? hedgedKrw / hedgedUsd : null,
      hedgeShare: net ? hedgedUsd / (net * 12) : 0,
      sens1: { unhedged: sensUn, hedged: sensHe }
    };
  }
  function opsCurve(m, o, shocks) {
    return shocks.map((k) => { const r = ops(m, o, k); return { shock: k, unhedged: r.unhedged, hedged: r.hedged, budget: r.budget }; });
  }

  return { DEFAULTS, STRATS, eok, forward, ncdf, option, dealSetup, dealAt, deal, ops, opsCurve };
});

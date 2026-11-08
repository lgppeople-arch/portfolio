/* 적정 부채와 파산 위험 엔진: 재무상태와 현금흐름으로 부채를 얼마나 질 수 있는지, 부채가 늘면 부도·부실 위험이
   어떻게 커지는지, 절세효과와 부실비용을 맞바꾸는 지점(최적 부채)이 어디인지 계산한다. 금액은 억원.
   - 현금흐름 기반: 내년 EBITDA ~ 정규분포(평균 = 올해 EBITDA, 표준편차 = 과거 EBITDA의 표준편차)
       상환 부족 확률 = P(EBITDA − 유지 설비투자 − 법인세 < 이자 + 차환하지 못하는 원금)  (DSCR < 1)
       지급불능 확률 = 같은 부족분이 쓸 수 있는 유동성(현금 − 최소 보유현금 + 한도대출)을 넘을 확률
   - 재무상태 기반: 머튼 모형 부도거리 DD = (ln(V/D) + (r − σ²/2)T) / (σ√T), 부도확률 = N(−DD)
   - 최적 부채(상충이론): 기업가치 = 무부채 가치 + 절세효과 − 5년 누적 부실확률 × (부실비용 + 절세효과)
       절세효과 = 법인세율 × 부채 × min(1, 영업이익 ÷ 이자)  (이자가 영업이익을 넘는 부분은 절세가 안 된다)
       부실에 빠지면 절세효과도 잃는다고 보아, 부채가 아주 커질 때 가치가 다시 오르는 왜곡을 막는다
   - Altman Z'(비상장 제조업 모형) = 0.717 X1 + 0.847 X2 + 3.107 X3 + 0.420 X4 + 0.998 X5 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api;
  else root.CapitalEngine = api;
})(typeof self !== "undefined" ? self : this, function (Stats) {
  "use strict";

  /* 13주 자금수지 도구와 같은 가상 회사 */
  const DEFAULTS = {
    ebitdaHist: [430, 510, 590, 470, 560],      /* 최근 5년 EBITDA, 마지막이 올해 */
    da: 230, capex: 200, tax: 22,               /* 감가상각비, 유지 설비투자, 법인세율 % */
    debt: 1800, cash: 380, minCash: 150, rcf: 300,
    tenor: 5, rollover: 70,                     /* 평균 잔존만기(년), 만기 원금 중 차환 비율 % */
    rf: 3.0, spread0: 1.7, lgd: 60,             /* 무위험금리 %, 기본 가산금리 %, 부도 시 손실률 % */
    multiple: 7.0, assetVol: 25,                /* 기업가치 = EBITDA × 배수, 자산가치 변동성 % */
    distress: 20, horizon: 5,                   /* 부실비용(무부채 가치 대비 %), 누적 기간(년) */
    policy: { maxLev: 3.0, minIcr: 3.0, minDscr: 1.2, maxPd: 2.0 },
    bs: { ta: 4500, ca: 1600, cl: 1100, re: 900, sales: 3000, te: 1600, tl: 2900, ebit: 330 }
  };

  function base(x) {
    const h = x.ebitdaHist, mu0 = h[h.length - 1], sd0 = h.length >= 3 ? Stats.sd(h) : mu0 * 0.15;
    const mu = x.muOverride === undefined ? mu0 : x.muOverride, sd = Math.max(1e-6, x.sdOverride === undefined ? sd0 : x.sdOverride);
    return { mu: mu, sd: sd, cv: sd / mu, ev: Math.max(1e-6, x.multiple * mu0) };
  }
  /* 머튼: 기업가치 V(= EBITDA × 배수), 부채 D, 1년 */
  function merton(D, x) {
    const b = base(x), s = x.assetVol / 100, r = x.rf / 100;
    if (D <= 0) return { dd: Infinity, pd: 0 };
    const dd = (Math.log(b.ev / D) + (r - s * s / 2)) / s;
    return { dd: dd, pd: Math.max(0, Stats.normCdf(-dd)) };
  }
  /* 차입 금리 = 무위험 + 기본 가산 + 손실률 × 머튼 부도확률 */
  const kd = (D, x) => (x.rf + x.spread0) / 100 + (x.lgd / 100) * merton(D, x).pd;

  /* 현금흐름 기반 확률. 법인세는 평균 EBITDA 기준으로 고정해 정규분포를 유지한다 */
  function cashPd(D, x) {
    const b = base(x), r = kd(D, x), interest = r * D, principal = D / x.tenor * (1 - x.rollover / 100);
    const taxv = Math.max(0, b.mu - x.da - interest) * x.tax / 100;
    const need = interest + principal + x.capex + taxv;            /* 이 EBITDA보다 낮으면 DSCR < 1 */
    const liq = Math.max(0, x.cash - x.minCash) + x.rcf;
    /* 갚을 빚이 없으면 상환 부족·지급불능도 없다(현금흐름 적자는 자금조달 문제로 본다) */
    const pdS = D > 0 ? Math.max(0, Stats.normCdf((need - b.mu) / b.sd)) : 0, pdD = D > 0 ? Math.max(0, Stats.normCdf((need - liq - b.mu) / b.sd)) : 0;
    const dscr = (b.mu - x.capex - taxv) / (interest + principal);
    return { rate: r, interest: interest, principal: principal, taxv: taxv, need: need, liq: liq, pdShort: pdS, pdDefault: pdD, dscr: dscr,
      icr: (b.mu - x.da) / interest, lev: (D - x.cash) / b.mu, cum: 1 - Math.pow(1 - pdS, x.horizon), z: (need - b.mu) / b.sd, zD: (need - liq - b.mu) / b.sd };
  }
  /* 절세효과(현재가치). 이자가 영업이익을 넘으면 넘는 몫은 공제받지 못한다고 본다 */
  function shield(D, x) {
    if (D <= 0) return 0;
    const b = base(x), ebit = Math.max(0, b.mu - x.da), interest = kd(D, x) * D;
    return x.tax / 100 * D * Math.min(1, ebit / interest);
  }
  /* 부채 D에서의 기업가치와 구성 */
  function valueAt(D, x) {
    const b = base(x), c = cashPd(D, x), sh = shield(D, x), dead = c.cum * x.distress / 100 * b.ev, lost = c.cum * sh;
    return { D: D, shield: sh, dead: dead, lost: lost, cost: dead + lost, value: b.ev + sh - dead - lost, pd: c.pdShort, pdDefault: c.pdDefault, cum: c.cum, lev: c.lev, rate: c.rate, icr: c.icr, dscr: c.dscr, merton: merton(D, x).pd };
  }

  /* 정책 기준으로 본 부채 수용력. 금리가 부채에 따라 바뀌므로 이분법으로 푼다 */
  function solve(ok, hi) { let lo = 0; if (!ok(0)) return 0; while (ok(hi) && hi < 1e6) hi *= 2; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } return lo; }
  function capacity(x) {
    const b = base(x), P = x.policy;
    const lev = P.maxLev * b.mu + x.cash;
    const icr = solve((D) => D === 0 || (b.mu - x.da) / (kd(D, x) * D) >= P.minIcr, 1000);
    const dscr = solve((D) => D === 0 || cashPd(D, x).dscr >= P.minDscr, 1000);
    const pd = solve((D) => cashPd(D, x).pdShort * 100 <= P.maxPd, 1000);
    const items = [
      { key: "lev", label: "순차입금 ÷ EBITDA ≤ " + P.maxLev + "배", v: lev },
      { key: "icr", label: "이자보상배율 ≥ " + P.minIcr + "배", v: icr },
      { key: "dscr", label: "DSCR ≥ " + P.minDscr + "배", v: dscr },
      { key: "pd", label: "상환 부족 확률 ≤ " + P.maxPd + "%", v: pd }
    ];
    const bind = items.reduce((a, c) => (c.v < a.v ? c : a));
    return { items: items, cap: bind.v, bind: bind.key, room: bind.v - x.debt };
  }

  /* 상충이론 곡선: 0부터 (현재 부채와 정책 한도 중 큰 값) × 1.7까지 */
  function tradeoff(x, maxD) {
    const b = base(x), pts = [];
    const top = maxD || Math.max(x.debt, capacity(x).cap, b.mu) * 1.7;
    for (let i = 0; i <= 120; i++) pts.push(valueAt(top * i / 120, x));
    const best = pts.reduce((a, p) => (p.value > a.value ? p : a));
    /* 격자 최적점 주변을 황금분할 탐색으로 다듬는다 */
    const f = (D) => valueAt(D, x).value;
    let lo = Math.max(0, best.D - top / 120), hi = Math.min(top, best.D + top / 120);
    const g = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 60; i++) { const a = hi - g * (hi - lo), c2 = lo + g * (hi - lo); if (f(a) < f(c2)) lo = a; else hi = c2; }
    const o = valueAt((lo + hi) / 2, x), cur = valueAt(x.debt, x);
    return { top: top, pts: pts, opt: o, current: cur, vu: b.ev, gain: o.value - cur.value };
  }

  /* Altman Z'(비상장 제조업): 1.23 미만 부실, 2.90 초과 안전, 사이는 회색지대 */
  function altman(bs) {
    const X = [(bs.ca - bs.cl) / bs.ta, bs.re / bs.ta, bs.ebit / bs.ta, bs.te / bs.tl, bs.sales / bs.ta], W = [0.717, 0.847, 3.107, 0.420, 0.998];
    const parts = X.map((v, i) => v * W[i]), z = parts.reduce((a, v) => a + v, 0);
    return { X: X, W: W, parts: parts, z: z, zone: z < 1.23 ? "distress" : z > 2.9 ? "safe" : "grey" };
  }

  /* 민감도: 내년 EBITDA 평균(올해 대비 %)과 변동성(배수)을 바꿨을 때 현재 부채의 상환 부족 확률 */
  function sensitivity(x) {
    const lv = [0, -10, -20, -30], vs = [0.75, 1, 1.5, 2], b = base(x);
    return { levels: lv, vols: vs, grid: lv.map((d) => vs.map((m) => cashPd(x.debt, Object.assign({}, x, { muOverride: b.mu * (1 + d / 100), sdOverride: b.sd * m })).pdShort)) };
  }

  function analyze(x) {
    const b = base(x), cur = cashPd(x.debt, x), mt = merton(x.debt, x);
    return { base: b, current: cur, merton: mt, capacity: capacity(x), tradeoff: tradeoff(x), altman: altman(x.bs), sens: sensitivity(x) };
  }

  return { DEFAULTS, base, merton, kd, cashPd, shield, valueAt, capacity, tradeoff, altman, sensitivity, analyze };
});

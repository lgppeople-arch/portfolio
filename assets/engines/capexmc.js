/* 설비투자 확률 분석 엔진: 설비투자 키트의 현금흐름 모형을 투자 단계(트랜치)별로 일반화하고,
   수요·판매단가·변동비·고정비·투자비가 흔들릴 때 NPV 분포와 단계 투자(실물옵션)의 가치를 계산한다. 금액 억원.
   - 수요 수준 ku·판매단가 ka(상관 ρ)·변동비 kv·고정비 kf는 평균 1의 로그정규, 투자비 kc는 삼각분포(초과 쪽으로 긴 꼬리)
   - 판매량 = CAPA × min(설비 비중, 계획 가동률 × ku): 수요가 설비보다 크면 못 판다(상단이 잘림)
   - 단계 투자: 1단계로 CAPA 일부(공용 설비 포함)만 짓고, 결정 시점에 관측한 수요로 2단계(추가 비용 포함)를 지을지 고른다
     2단계를 짓는 편이 NPV가 크면 짓는다. 관측에는 오차가 있다(관측 오차 σ) */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api;
  else root.CapexMcEngine = api;
})(typeof self !== "undefined" ? self : this, function (Stats) {
  "use strict";

  const P0 = { capex: 300, years: 10, taxlife: 8, maint: 1.5, salvage: 10, capa: 200, util: 85, ramp1: 50, ramp2: 75, asp: 130, cr: 2, uvc: 58, fixed: 34, wc: 15, tax: 24.2, rate: 8 };
  const UNC = { sdU: 15, sdA: 6, rho: 0.5, sdV: 5, sdF: 5, capexLo: -5, capexHi: 25, n: 3000, seed: 2024 };
  /* 1단계: CAPA 60%를 짓되 공용 설비(건물·유틸리티)까지 먼저 지어 투자비는 70%, 고정비는 85%.
     2단계: 남은 30%에 가동 중 공사 등으로 20%가 더 든다. 2년차 말에 결정해 3년차부터 가동 */
  const STAGE = { share1: 60, capex1: 70, fixed1: 85, prem2: 20, year: 2, obs: 5 };

  /* 현금흐름: st가 없으면 일괄 투자, 있으면 단계 투자(expand: 2단계 실행 여부) */
  function project(p, k, st) {
    k = k || {};
    const ku = k.util ?? 1, ka = k.asp ?? 1, kv = k.uvc ?? 1, kc = k.capex ?? 1, kf = k.fixed ?? 1;
    const N = Math.round(p.years), r = p.rate / 100, tax = p.tax / 100;
    if (st && st.share1 >= 100) st = null;   /* 1단계에 다 지으면 일괄 투자와 같다 */
    const c1 = st ? Math.max(st.share1, st.capex1) / 100 : 1;
    const tr = st ? [{ t: 0, amt: p.capex * kc * c1 }].concat(st.expand ? [{ t: st.year, amt: p.capex * kc * (1 - c1) * (1 + st.prem2 / 100) }] : []) : [{ t: 0, amt: p.capex * kc }];
    const fcf = [-tr[0].amt];
    let wcPrev = 0;
    for (let t = 1; t <= N; t++) {
      const full = !st || (st.expand && t > st.year), share = full ? 1 : st.share1 / 100;
      const baseU = t === 1 ? p.ramp1 : t === 2 ? p.ramp2 : p.util;
      const units = p.capa * Math.min(share, (baseU / 100) * ku);
      const asp = p.asp * ka * Math.pow(1 - p.cr / 100, t - 1);
      const rev = units * asp / 100, vc = units * p.uvc * kv / 100, fixed = p.fixed * kf * (full ? 1 : st.fixed1 / 100);
      let dep = 0, inPlace = 0, spend = 0;
      tr.forEach((q) => { if (q.t < t) { inPlace += q.amt; if (t <= q.t + p.taxlife) dep += q.amt / p.taxlife; } if (q.t === t) spend += q.amt; });
      const ebit = rev - vc - fixed - dep, maint = inPlace * p.maint / 100, wc = rev * p.wc / 100, dwc = wc - wcPrev; wcPrev = wc;
      let f = ebit - ebit * tax + dep - maint - dwc - spend;
      if (t === N) tr.forEach((q) => { const book = Math.max(q.amt - q.amt / p.taxlife * Math.min(N - q.t, p.taxlife), 0), salv = q.amt * p.salvage / 100; f += salv - (salv - book) * tax; });
      if (t === N) f += wc;
      fcf.push(f);
    }
    const npvAt = (x) => fcf.reduce((s, c, i) => s + c / Math.pow(1 + x, i), 0);
    return { fcf: fcf, npv: npvAt(r), npvAt: npvAt };
  }
  function irr(pr) {
    let lo = -0.9, hi = 3; const f = pr.npvAt;
    if (f(lo) * f(hi) > 0) return null;
    for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }
  /* 단계 투자: 관측한 수요(kObs)로 2단계 여부를 정하고, 실제 계수(k)로 결과를 낸다 */
  function staged(p, k, st, kObs) {
    const s = Object.assign({}, st), o = kObs || k;
    const yes = project(p, o, Object.assign({}, s, { expand: true })).npv, no = project(p, o, Object.assign({}, s, { expand: false })).npv;
    const expand = yes > no;
    return { expand: expand, res: project(p, k, Object.assign({}, s, { expand: expand })) };
  }

  function simulate(p, u, st) {
    u = Object.assign({}, UNC, u || {}); st = Object.assign({}, STAGE, st || {});
    const r = Stats.rng(u.seed), n = u.n, sU = u.sdU / 100, sA = u.sdA / 100, sV = u.sdV / 100, sF = u.sdF / 100, so = st.obs / 100;
    const rho = Math.max(-0.99, Math.min(0.99, u.rho)), ln = (s, z) => Math.exp(s * z - s * s / 2);
    const full = [], stg = [], irrs = []; let exp = 0;
    for (let i = 0; i < n; i++) {
      const z1 = r.normal(), z2 = rho * z1 + Math.sqrt(1 - rho * rho) * r.normal();
      const k = { util: ln(sU, z1), asp: ln(sA, z2), uvc: ln(sV, r.normal()), fixed: ln(sF, r.normal()), capex: 1 + Stats.triInv(r.u(), u.capexLo, 0, u.capexHi) / 100 };
      const pf = project(p, k);
      full.push(pf.npv); irrs.push(irr(pf));
      const kObs = Object.assign({}, k, { util: k.util * ln(so, r.normal()) });
      const s = staged(p, k, st, kObs); stg.push(s.res.npv); if (s.expand) exp++;
    }
    const sum = (a) => { const s = a.slice().sort((x, y) => x - y), q = (pp) => Stats.quantile(s, pp); return { mean: Stats.mean(a), sd: Stats.sd(a), p5: q(0.05), p50: q(0.5), p95: q(0.95), pLoss: a.filter((v) => v < 0).length / a.length, se: Stats.sd(a) / Math.sqrt(a.length) }; };
    const ir = irrs.filter((v) => v !== null).sort((a, b) => a - b);
    const base = project(p, {}), baseSt = staged(p, {}, st);
    /* 같은 난수로 짝지은 차이의 표준오차 */
    const diff = stg.map((v, i) => v - full[i]);
    return {
      n: n, full: sum(full), staged: sum(stg), fullVals: full, stagedVals: stg, pExpand: exp / n,
      irr: ir.length ? { p10: Stats.quantile(ir, 0.1), p50: Stats.quantile(ir, 0.5), p90: Stats.quantile(ir, 0.9), pBelow: ir.filter((v) => v < p.rate / 100).length / ir.length } : null,
      base: base.npv, baseIrr: irr(base), baseStaged: baseSt.res.npv, baseExpand: baseSt.expand,
      option: Stats.mean(diff), optionSe: Stats.sd(diff) / Math.sqrt(n), meanCapex: 1 + (u.capexLo + u.capexHi) / 300
    };
  }

  /* 불확실성이 클수록 단계 투자의 가치가 커지는가: 수요 변동성별 기대 NPV */
  function sweep(p, u, st, sds) {
    return (sds || [0, 5, 10, 15, 20, 25, 30]).map((sd) => { const s = simulate(p, Object.assign({}, u, { sdU: sd, n: 1200 }), st); return { sd: sd, full: s.full.mean, staged: s.staged.mean, option: s.option, pLossFull: s.full.pLoss, pLossStaged: s.staged.pLoss }; });
  }

  return { P0, UNC, STAGE, project, irr, staged, simulate, sweep };
});

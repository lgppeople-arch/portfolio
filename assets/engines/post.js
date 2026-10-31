/* 투자 사후관리 엔진: 승인 당시 가정과 실적·재추정을 같은 프로젝트 모형으로 계산하고,
   NPV 차이를 동인별로 나눈다. 프로젝트 모형은 설비투자 분석 키트의 투자 타당성 계산과 같은 식이다. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../fin.js") : root.Fin);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PostEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin) {
  "use strict";

  /* 설비투자 분석 키트의 예시값과 같다 */
  const PLAN_DEFAULTS = { capex: 300, years: 10, taxlife: 8, maint: 1.5, salvage: 10, capa: 200, util: 85, ramp1: 50, ramp2: 75, asp: 130, cr: 2, uvc: 58, fixed: 34, wc: 15, tax: 24.2, rate: 8 };

  /* 승인 가정 → 연도별 경로 */
  function planPath(p) {
    const N = Math.round(p.years), util = [], asp = [], uvc = [], fixed = [];
    for (let t = 1; t <= N; t++) {
      const base = t === 1 ? p.ramp1 : t === 2 ? p.ramp2 : p.util;
      util.push(Math.min(base / 100, 1));
      asp.push(p.asp * Math.pow(1 - p.cr / 100, t - 1));
      uvc.push(p.uvc);
      fixed.push(p.fixed);
    }
    return { capex: p.capex, util: util, asp: asp, uvc: uvc, fixed: fixed };
  }

  /* 실적(경과 연도)과 재추정(남은 연도) → 연도별 경로
     a = { capex, k, util[], asp[], uvc[], fixed[], fUtil2, fUtil, fCr, fUvc, fFixed } */
  function actualPath(p, a) {
    const N = Math.round(p.years), k = Math.min(a.k, N), util = [], asp = [], uvc = [], fixed = [];
    for (let t = 1; t <= N; t++) {
      if (t <= k) {
        util.push(Math.min(a.util[t - 1] / 100, 1));
        asp.push(a.asp[t - 1]);
        uvc.push(a.uvc[t - 1]);
        fixed.push(a.fixed[t - 1]);
      } else {
        util.push(Math.min((t === 2 ? a.fUtil2 : a.fUtil) / 100, 1));
        asp.push(a.asp[k - 1] * Math.pow(1 - a.fCr / 100, t - k));
        uvc.push(a.fUvc);
        fixed.push(a.fFixed);
      }
    }
    return { capex: a.capex, util: util, asp: asp, uvc: uvc, fixed: fixed };
  }

  /* 실적을 계획과 똑같이 채운 입력 (항등 검산과 "계획값으로 채우기"에 쓴다) */
  function planAsActual(p, k) {
    const path = planPath(p);
    return {
      capex: p.capex, k: k,
      util: path.util.slice(0, k).map((u) => u * 100),
      asp: path.asp.slice(0, k), uvc: path.uvc.slice(0, k), fixed: path.fixed.slice(0, k),
      fUtil2: p.ramp2, fUtil: p.util, fCr: p.cr, fUvc: p.uvc, fFixed: p.fixed
    };
  }

  /* 예시 실적: 투자비 8% 초과와 램프업 지연, 원가 상승. 판매단가와 고정비는 계획보다 조금 낫다 */
  function sampleActual(p, k) {
    const plan = planPath(p);
    const du = [-12, -9, -3], da = [0.01, 0.015, 0.012], dv = [0.02, 0.03, 0.03], df = [0.059, -0.029, -0.03];
    const a = { capex: Math.round(p.capex * 1.08 * 10) / 10, k: k, util: [], asp: [], uvc: [], fixed: [] };
    for (let t = 0; t < k; t++) {
      a.util.push(Math.max(0, Math.round(plan.util[t] * 100 + du[t])));
      a.asp.push(Math.round(plan.asp[t] * (1 + da[t]) * 10) / 10);
      a.uvc.push(Math.round(p.uvc * (1 + dv[t]) * 10) / 10);
      a.fixed.push(Math.round(p.fixed * (1 + df[t]) * 10) / 10);
    }
    a.fUtil2 = Math.max(0, p.ramp2 - 6);
    a.fUtil = Math.max(0, p.util - 1);
    a.fCr = p.cr;
    a.fUvc = a.uvc[k - 1];
    a.fFixed = a.fixed[k - 1];
    return a;
  }

  /* 경로 → 연도별 손익·현금흐름과 지표 */
  function run(p, path) {
    const N = path.util.length, r = p.rate / 100, tax = p.tax / 100, capex = path.capex;
    const depY = capex / p.taxlife;
    const rows = [], fcf = [-capex];
    let wcPrev = 0;
    for (let t = 1; t <= N; t++) {
      const u = path.util[t - 1], units = p.capa * u;
      const rev = units * path.asp[t - 1] / 100;
      const vc = units * path.uvc[t - 1] / 100;
      const fixed = path.fixed[t - 1];
      const dep = t <= p.taxlife ? depY : 0;
      const ebit = rev - vc - fixed - dep;
      const taxv = ebit * tax;
      const maint = capex * p.maint / 100;
      const wc = rev * p.wc / 100;
      const dwc = wc - wcPrev; wcPrev = wc;
      let f = ebit - taxv + dep - maint - dwc;
      let term = 0, wcRec = 0;
      if (t === N) {
        const book = Math.max(capex - depY * Math.min(N, p.taxlife), 0);
        const salv = capex * p.salvage / 100;
        term = salv - (salv - book) * tax;
        wcRec = wc;
        f += term + wcRec;
      }
      rows.push({ t: t, u: u, units: units, asp: path.asp[t - 1], rev: rev, vc: vc, fixed: fixed, dep: dep, ebit: ebit, tax: taxv, maint: maint, dwc: dwc, term: term, wcRec: wcRec, fcf: f });
      fcf.push(f);
    }
    return { npv: Fin.npv(r, fcf), irr: Fin.irr(fcf), pb: Fin.payback(fcf), fcf: fcf, rows: rows };
  }

  /* NPV 차이 동인. ramp와 util은 같은 가동률 경로를 연차로 나눈 것 */
  const DRIVERS = [
    { key: "capex", label: "투자비" },
    { key: "ramp", label: "초기 가동률", sub: "1~2년차" },
    { key: "util", label: "정상 가동률", sub: "3년차부터" },
    { key: "price", label: "판매단가" },
    { key: "vcost", label: "단위 변동비" },
    { key: "fixed", label: "고정비" }
  ];

  function mix(plan, act, mask) {
    const on = (i) => (mask >> i) & 1;
    return {
      capex: on(0) ? act.capex : plan.capex,
      util: plan.util.map((u, t) => ((t < 2 ? on(1) : on(2)) ? act.util[t] : u)),
      asp: on(3) ? act.asp : plan.asp,
      uvc: on(4) ? act.uvc : plan.uvc,
      fixed: on(5) ? act.fixed : plan.fixed
    };
  }

  /* 샤플리 값: 가능한 모든 대체 순서에서 각 동인의 한계 기여를 평균한다.
     lo·hi는 순서에 따라 그 동인의 기여가 움직이는 범위, seq는 위 목록 순서대로 하나씩 바꾼 단계 대체법 결과 */
  function attribution(p, plan, act) {
    const n = DRIVERS.length, size = 1 << n, v = new Array(size);
    for (let m = 0; m < size; m++) v[m] = run(p, mix(plan, act, m)).npv;
    const fact = [1];
    for (let i = 1; i <= n; i++) fact[i] = fact[i - 1] * i;
    const bits = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
    const phi = new Array(n).fill(0), lo = new Array(n).fill(Infinity), hi = new Array(n).fill(-Infinity);
    for (let i = 0; i < n; i++) {
      for (let m = 0; m < size; m++) {
        if ((m >> i) & 1) continue;
        const s = bits(m), w = fact[s] * fact[n - s - 1] / fact[n], d = v[m | (1 << i)] - v[m];
        phi[i] += w * d;
        if (d < lo[i]) lo[i] = d;
        if (d > hi[i]) hi[i] = d;
      }
    }
    const seq = [];
    let m = 0;
    for (let i = 0; i < n; i++) { const next = m | (1 << i); seq.push(v[next] - v[m]); m = next; }
    return { base: v[0], full: v[size - 1], shapley: phi, lo: lo, hi: hi, seq: seq, drivers: DRIVERS };
  }

  function analyze(p, a) {
    const plan = planPath(p), act = actualPath(p, a);
    const mp = run(p, plan), ma = run(p, act);
    const att = attribution(p, plan, act);
    /* 실적 = 계획일 때 재추정 NPV가 기준선과 같은지 매번 확인 */
    const same = run(p, actualPath(p, planAsActual(p, a.k))).npv;
    return { plan: plan, act: act, mp: mp, ma: ma, att: att, identity: same - mp.npv, k: a.k };
  }

  return { PLAN_DEFAULTS, DRIVERS, planPath, actualPath, planAsActual, sampleActual, run, attribution, analyze };
});

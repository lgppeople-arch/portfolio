/* 비용예산 증액 우선순위 엔진: 한정된 예산으로 어떤 증액 요청을 승인할지 정수계획(0-1 배낭 문제)으로 고른다. 금액은 억원.
   - 요청마다 효과(연간, 최저·최빈·최고의 삼각분포), 효과 기간, 성공 확률, 필수 여부
   - 기대가치 = 성공확률 × 효과 평균 × 연금현가계수 − 요청액
   - 위험조정가치(확실성등가) = 기대가치 − (a/2) × 분산. 분산이 요청끼리 더해지므로(독립) 배낭 문제 구조가 유지된다
   - 동적계획법(0.1억원 단위)으로 예산 안에서 가치 합이 가장 큰 조합을 찾고, 모든 예산 수준의 최적값(효율적 경계)을 함께 얻는다 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api;
  else root.BudgetEngine = api;
})(typeof self !== "undefined" ? self : this, function (Stats) {
  "use strict";

  const UNIT = 0.1;   /* 억원 */
  const DEFAULTS = {
    budget: 30, rate: 8, riskAversion: 0,
    items: [
      { dept: "생산", name: "예방정비 외주 확대", cost: 4.0, lo: 3.5, mode: 5.5, hi: 9.0, years: 1, p: 90, must: false },
      { dept: "품질", name: "불량 분석 장비 임차", cost: 2.5, lo: 1.2, mode: 2.0, hi: 3.5, years: 2, p: 85, must: false },
      { dept: "환경안전", name: "배출시설 법정 정밀점검", cost: 1.5, lo: 0, mode: 0, hi: 0, years: 1, p: 100, must: true },
      { dept: "영업", name: "해외 전시회·고객 샘플", cost: 3.0, lo: 1.0, mode: 3.5, hi: 12.0, years: 1, p: 60, must: false },
      { dept: "재무", name: "원가 시스템 고도화 개발", cost: 3.5, lo: 1.0, mode: 1.8, hi: 3.0, years: 3, p: 85, must: false },
      { dept: "인사", name: "현장 직무 전환 교육", cost: 2.0, lo: 0.6, mode: 1.2, hi: 2.0, years: 2, p: 75, must: false },
      { dept: "구매", name: "물류 외주 재입찰 컨설팅", cost: 1.2, lo: 0.8, mode: 2.0, hi: 3.5, years: 1, p: 75, must: false },
      { dept: "IT", name: "정보보안 관제 구독", cost: 2.8, lo: 1.0, mode: 2.5, hi: 9.0, years: 1, p: 100, must: false },
      { dept: "연구", name: "특허 출원·유지", cost: 1.8, lo: 0.3, mode: 1.2, hi: 4.5, years: 3, p: 50, must: false },
      { dept: "생산", name: "에너지 절감 진단·개선", cost: 2.2, lo: 0.8, mode: 1.4, hi: 2.0, years: 3, p: 90, must: false },
      { dept: "품질", name: "해외 고객 인증 취득", cost: 4.5, lo: 1.5, mode: 4.0, hi: 10.0, years: 2, p: 55, must: false },
      { dept: "총무", name: "사무 공간 개선", cost: 3.0, lo: 0.5, mode: 1.0, hi: 1.8, years: 1, p: 95, must: false },
      { dept: "경영기획", name: "데이터 분석 인력 파견", cost: 3.6, lo: 2.0, mode: 3.0, hi: 4.5, years: 2, p: 85, must: false },
      { dept: "영업", name: "대리점 판촉 지원 확대", cost: 5.0, lo: 3.0, mode: 7.0, hi: 12.0, years: 1, p: 75, must: false },
      { dept: "생산", name: "자동화 지그 시범 적용", cost: 3.2, lo: 1.0, mode: 2.2, hi: 3.5, years: 3, p: 70, must: false }
    ]
  };

  const annuity = (r, n) => (r > 0 ? (1 - Math.pow(1 + r, -n)) / r : n);

  /* 요청별 기대가치·분산·위험조정가치 */
  function evalItems(x) {
    const r = x.rate / 100, a = x.riskAversion;
    return x.items.map((it, i) => {
      const af = annuity(r, it.years), p = it.p / 100, mT = Stats.triMean(it.lo, it.mode, it.hi), vT = Stats.triVar(it.lo, it.mode, it.hi);
      const mean = p * mT * af, vr = af * af * (p * (vT + mT * mT) - p * p * mT * mT);
      const ev = mean - it.cost, ce = ev - a / 2 * vr;
      return { i: i, it: it, af: af, gross: mean, ev: ev, sd: Math.sqrt(vr), var: vr, ce: ce, roi: it.cost > 0 ? ev / it.cost : 0, units: Math.round(it.cost / UNIT) };
    });
  }

  /* 0-1 배낭: 필수 요청은 먼저 넣고, 나머지를 위험조정가치로 고른다. 모든 예산 수준의 최적값도 돌려준다 */
  function knapsack(E, budget, opts) {
    opts = opts || {};
    const force = opts.force || [], ban = opts.ban || [];
    const must = E.filter((e) => e.it.must || force.indexOf(e.i) >= 0), cand = E.filter((e) => !e.it.must && force.indexOf(e.i) < 0 && ban.indexOf(e.i) < 0 && e.ce > 0);
    const mustUnits = must.reduce((s, e) => s + e.units, 0), mustVal = must.reduce((s, e) => s + e.ce, 0);
    const capTotal = cand.reduce((s, e) => s + e.units, 0), C = Math.max(0, Math.round(budget / UNIT) - mustUnits);
    const top = Math.max(C, opts.frontierTo ? Math.round(opts.frontierTo / UNIT) - mustUnits : 0, 0);
    const dp = new Float64Array(top + 1), keep = cand.map(() => new Uint8Array(top + 1));
    cand.forEach((e, k) => { for (let c = top; c >= e.units; c--) { const v = dp[c - e.units] + e.ce; if (v > dp[c] + 1e-12) { dp[c] = v; keep[k][c] = 1; } } });
    const pick = (cap) => { const sel = []; let c = cap; for (let k = cand.length - 1; k >= 0; k--) if (c >= 0 && keep[k][c]) { sel.push(cand[k].i); c -= cand[k].units; } return sel; };
    const feasible = Math.round(budget / UNIT) >= mustUnits;
    const sel = feasible ? must.map((e) => e.i).concat(pick(C)).sort((a, b) => a - b) : must.map((e) => e.i);
    return { feasible: feasible, sel: sel, value: mustVal + (feasible ? dp[C] : 0), mustUnits: mustUnits, dp: dp, mustVal: mustVal, capTotal: capTotal, pick: pick };
  }

  /* 비교 방식: 효율(위험조정가치 ÷ 요청액) 순으로 넣을 수 있는 만큼 */
  function greedy(E, budget) {
    const must = E.filter((e) => e.it.must), rest = E.filter((e) => !e.it.must && e.ce > 0).sort((a, b) => b.ce / b.it.cost - a.ce / a.it.cost);
    let left = Math.round(budget / UNIT) - must.reduce((s, e) => s + e.units, 0); const sel = must.map((e) => e.i);
    rest.forEach((e) => { if (e.units <= left) { sel.push(e.i); left -= e.units; } });
    return { sel: sel.sort((a, b) => a - b), value: sel.reduce((s, i) => s + E[i].ce, 0) };
  }
  /* 비교 방식: 모든 요청을 같은 비율로 깎아 승인(효과도 같은 비율로 준다고 가정하는 관대한 기준) */
  function proRata(E, budget) {
    const must = E.filter((e) => e.it.must), rest = E.filter((e) => !e.it.must), mc = must.reduce((s, e) => s + e.it.cost, 0), rc = rest.reduce((s, e) => s + e.it.cost, 0);
    const ratio = Math.max(0, Math.min(1, (budget - mc) / rc));
    return { ratio: ratio, value: must.reduce((s, e) => s + e.ce, 0) + ratio * rest.reduce((s, e) => s + e.ce, 0) };
  }

  /* 선택된 묶음의 순효과 분포(몬테카를로): 성공 여부 × 삼각분포 효과 × 연금현가계수 − 요청액 */
  function simulate(E, sel, o) {
    o = Object.assign({ n: 5000, seed: 2026 }, o || {});
    const r = Stats.rng(o.seed), out = new Array(o.n), items = sel.map((i) => E[i]);
    for (let k = 0; k < o.n; k++) {
      let s = 0;
      items.forEach((e) => { const ok = r.u() < e.it.p / 100, u = r.u(); s += (ok ? Stats.triInv(u, e.it.lo, e.it.mode, e.it.hi) * e.af : 0) - e.it.cost; });
      out[k] = s;
    }
    const sorted = out.slice().sort((a, b) => a - b), q = (p) => Stats.quantile(sorted, p);
    const ev = items.reduce((s, e) => s + e.ev, 0), sd = Math.sqrt(items.reduce((s, e) => s + e.var, 0));
    return { n: o.n, vals: out, mean: Stats.mean(out), sd: Stats.sd(out), ev: ev, sdA: sd, p5: q(0.05), p50: q(0.5), p95: q(0.95), pLoss: out.filter((v) => v < 0).length / o.n, hist: Stats.histogram(out, 30) };
  }

  /* 경계값: 승인된 요청을 빼면 묶음 가치가 얼마나 줄고, 보류된 요청을 넣으려면 가치가 얼마나 커져야 하는가 */
  function margins(E, budget, base) {
    return E.map((e) => {
      if (e.it.must) return { i: e.i, kind: "must", v: null };
      const inSel = base.sel.indexOf(e.i) >= 0;
      if (inSel) { const k = knapsack(E, budget, { ban: [e.i] }); return { i: e.i, kind: "in", v: base.value - k.value }; }
      const k = knapsack(E, budget, { force: [e.i] }); return { i: e.i, kind: "out", v: k.feasible ? base.value - k.value : Infinity };
    });
  }

  function analyze(x) {
    const E = evalItems(x), total = x.items.reduce((s, it) => s + it.cost, 0);
    const opt = knapsack(E, x.budget, { frontierTo: total }), gr = greedy(E, x.budget), pr = proRata(E, x.budget);
    /* 효율적 경계: 예산 b에서의 최적 위험조정가치 */
    const frontier = [];
    for (let u = 0; u <= Math.round(total / UNIT); u++) {
      const b = u * UNIT, c = u - opt.mustUnits;
      frontier.push({ b: b, v: c < 0 ? null : opt.mustVal + opt.dp[Math.min(c, opt.dp.length - 1)], g: c < 0 ? null : greedy(E, b).value });
    }
    const at = (b) => { const f = frontier[Math.max(0, Math.min(frontier.length - 1, Math.round(b / UNIT)))]; return f ? f.v : null; };
    const shadowUp = (at(x.budget + 1) - at(x.budget)), shadowDown = (at(x.budget) - at(x.budget - 1));
    const used = opt.sel.reduce((s, i) => s + x.items[i].cost, 0);
    return { E: E, total: total, opt: opt, greedy: gr, proRata: pr, frontier: frontier, shadowUp: shadowUp, shadowDown: shadowDown, used: used, margins: margins(E, x.budget, opt) };
  }

  /* 검산용: 2ⁿ 조합을 모두 따져 최적값을 찾는다(요청 20건 이하) */
  function brute(E, budget) {
    const n = E.length, cap = Math.round(budget / UNIT); let best = -Infinity, bestSel = null;
    for (let m = 0; m < (1 << n); m++) {
      let u = 0, v = 0, ok = true;
      for (let i = 0; i < n; i++) { const on = (m >> i) & 1; if (E[i].it.must && !on) { ok = false; break; } if (on) { u += E[i].units; v += E[i].ce; } }
      if (ok && u <= cap && v > best + 1e-12) { best = v; bestSel = m; }
    }
    return { value: best, mask: bestSel };
  }

  return { UNIT, DEFAULTS, annuity, evalItems, knapsack, greedy, proRata, simulate, margins, analyze, brute };
});

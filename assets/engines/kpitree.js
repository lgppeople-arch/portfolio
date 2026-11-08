/* KPI 트리(가치동인 트리) 엔진: ROIC를 현장 지표까지 수식으로 쪼개고, 계획 대비 실적 차이를 말단 지표에 나눈다. 금액 억원.
   ROIC = 세후영업이익(NOPAT) ÷ 투하자본(IC)
     NOPAT = 영업이익 × (1 − 세율), 영업이익 = 매출 − 매출원가 − 판관비
       매출 = 판매량 × 단가, 매출원가 = 재료비(판매량 × 투입 재료비 ÷ 수율) + 가공비(고정 + 판매량 × 변동)
       판관비 = 고정 판관비 + 매출 × 변동 판관비율
     IC = 순운전자본(매출채권 + 재고 − 매입채무) + 유형자산, 각 운전자본 = 해당 금액 × 회전일수 ÷ 365
   - 차이 분해: 말단 지표를 계획 → 실적으로 바꿀 때 ROIC 변화를 샤플리 값으로 나눈다(순서와 무관, 합계 = 총차이)
   - 탄력성: 말단 하나를 1% 개선할 때 ROIC가 몇 %p 바뀌는지, ROIC 1%p를 올리려면 하나만으로 얼마나 바꿔야 하는지 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KpiTreeEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* dir: 클수록 ROIC에 좋으면 +1, 나쁘면 −1 */
  const LEAVES = {
    q: { label: "판매량", unit: "만 개", plan: 1200, act: 1150, dir: 1, owner: "영업", d: 0 },
    p: { label: "평균 판매단가", unit: "원", plan: 9000, act: 9150, dir: 1, owner: "영업", d: 0 },
    mat: { label: "개당 투입 재료비", unit: "원", plan: 3300, act: 3450, dir: -1, owner: "구매", d: 0 },
    yld: { label: "수율", unit: "%", plan: 95, act: 93.5, dir: 1, owner: "생산", d: 1 },
    fconv: { label: "고정 가공비", unit: "억원", plan: 180, act: 176, dir: -1, owner: "생산", d: 0 },
    vconv: { label: "개당 변동 가공비", unit: "원", plan: 1100, act: 1120, dir: -1, owner: "생산", d: 0 },
    fsga: { label: "고정 판관비", unit: "억원", plan: 120, act: 124, dir: -1, owner: "경영지원", d: 0 },
    vsga: { label: "변동 판관비율", unit: "% 매출", plan: 4.0, act: 4.3, dir: -1, owner: "영업", d: 1 },
    tax: { label: "유효 법인세율", unit: "%", plan: 22, act: 22, dir: -1, owner: "재무", d: 1 },
    dso: { label: "매출채권 회전일수", unit: "일", plan: 60, act: 66, dir: -1, owner: "영업", d: 0 },
    dio: { label: "재고 회전일수", unit: "일", plan: 45, act: 52, dir: -1, owner: "생산", d: 0 },
    dpo: { label: "매입채무 회전일수", unit: "일", plan: 40, act: 38, dir: 1, owner: "구매", d: 0 },
    ppe: { label: "유형자산", unit: "억원", plan: 1100, act: 1130, dir: -1, owner: "생산", d: 0 }
  };
  const KEYS = Object.keys(LEAVES);
  const WACC = 8;

  /* 화면에 그릴 트리(자식 순서대로). 말단은 LEAVES의 키 */
  const NODES = {
    roic: { label: "ROIC", unit: "%", kids: ["nopat", "ic"], dir: 1 },
    nopat: { label: "세후영업이익", unit: "억원", kids: ["op", "tax"], dir: 1 },
    op: { label: "영업이익", unit: "억원", kids: ["rev", "cogs", "sga"], dir: 1 },
    rev: { label: "매출", unit: "억원", kids: ["q", "p"], dir: 1 },
    cogs: { label: "매출원가", unit: "억원", kids: ["matc", "conv"], dir: -1 },
    matc: { label: "재료비", unit: "억원", kids: ["mat", "yld"], dir: -1, uses: "판매량" },
    conv: { label: "가공비", unit: "억원", kids: ["fconv", "vconv"], dir: -1, uses: "판매량" },
    sga: { label: "판관비", unit: "억원", kids: ["fsga", "vsga"], dir: -1, uses: "매출" },
    ic: { label: "투하자본", unit: "억원", kids: ["nwc", "ppe"], dir: -1 },
    nwc: { label: "순운전자본", unit: "억원", kids: ["ar", "inv", "ap"], dir: -1 },
    ar: { label: "매출채권", unit: "억원", kids: ["dso"], dir: -1, uses: "매출" },
    inv: { label: "재고", unit: "억원", kids: ["dio"], dir: -1, uses: "매출원가" },
    ap: { label: "매입채무", unit: "억원", kids: ["dpo"], dir: 1, uses: "재료비" }
  };

  function calc(v, wacc) {
    const units = v.q * 1e4;
    const rev = units * v.p / 1e8, matc = units * v.mat / (v.yld / 100) / 1e8, conv = v.fconv + units * v.vconv / 1e8, cogs = matc + conv;
    const sga = v.fsga + rev * v.vsga / 100, op = rev - cogs - sga, nopat = op * (1 - v.tax / 100);
    const ar = rev * v.dso / 365, inv = cogs * v.dio / 365, ap = matc * v.dpo / 365, nwc = ar + inv - ap, ic = nwc + v.ppe;
    const roic = nopat / ic * 100, w = wacc === undefined ? WACC : wacc;
    return { rev: rev, matc: matc, conv: conv, cogs: cogs, sga: sga, op: op, nopat: nopat, ar: ar, inv: inv, ap: ap, nwc: nwc, ic: ic, roic: roic,
      opm: op / rev * 100, turn: rev / ic, eva: nopat - w / 100 * ic, gp: rev - cogs };
  }
  const pick = (x, which) => { const o = {}; KEYS.forEach((k) => { o[k] = x[k][which]; }); return o; };

  /* 샤플리 값: 값이 다른 말단만 참가자. v(S) = S는 실적, 나머지는 계획일 때의 지표 */
  function shapley(x, metric) {
    metric = metric || "roic";
    const P = pick(x, "plan"), A = pick(x, "act"), players = KEYS.filter((k) => P[k] !== A[k]), n = players.length;
    const val = new Float64Array(1 << n);
    for (let m = 0; m < (1 << n); m++) { const v = Object.assign({}, P); players.forEach((k, i) => { if ((m >> i) & 1) v[k] = A[k]; }); val[m] = calc(v)[metric]; }
    const fact = [1]; for (let i = 1; i <= n; i++) fact.push(fact[i - 1] * i);
    const pop = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
    const out = {}; KEYS.forEach((k) => { out[k] = 0; });
    players.forEach((k, i) => {
      let s = 0;
      for (let m = 0; m < (1 << n); m++) { if ((m >> i) & 1) continue; const c = pop(m); s += fact[c] * fact[n - c - 1] / fact[n] * (val[m | (1 << i)] - val[m]); }
      out[k] = s;
    });
    return { by: out, total: val[(1 << n) - 1] - val[0], plan: val[0], act: val[(1 << n) - 1], players: players };
  }

  /* 탄력성(계획 기준): 각 말단을 '좋은 방향'으로 1% 움직일 때 ROIC 변화(%p) */
  function levers(x, wacc) {
    const P = pick(x, "plan"), b = calc(P, wacc).roic;
    return KEYS.map((k) => {
      const L = x[k], at = (f) => { const v = Object.assign({}, P); v[k] = P[k] * f; return calc(v, wacc).roic; };
      const d1 = at(1 + 0.01 * L.dir) - b;
      /* ROIC +1%p를 이 말단 하나로 맞추려면(좋은 방향으로) 몇 % 바꿔야 하나: 이분법, 200% 안에서 못 맞추면 null */
      let need = null, lo = 0, hi = 2;
      const g = (r) => at(1 + L.dir * r) - b - 1;
      if (L.dir !== 0 && g(hi > 0.99 && L.dir < 0 ? 0.99 : hi) > 0) { if (L.dir < 0) hi = 0.99; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; } need = (lo + hi) / 2; }
      return { key: k, label: L.label, owner: L.owner, d1: d1, need: need };
    }).sort((a, c) => c.d1 - a.d1);
  }

  /* 조직별 합계 */
  function byOwner(x, sh) {
    const o = {};
    KEYS.forEach((k) => { const w = x[k].owner; o[w] = o[w] || { owner: w, v: 0, keys: [] }; o[w].v += sh.by[k]; o[w].keys.push(k); });
    return Object.keys(o).map((k) => o[k]).sort((a, b) => a.v - b.v);
  }

  function analyze(x, wacc) {
    const P = calc(pick(x, "plan"), wacc), A = calc(pick(x, "act"), wacc), sh = shapley(x, "roic");
    return { plan: P, act: A, shapley: sh, levers: levers(x, wacc), owners: byOwner(x, sh), shOp: shapley(x, "op") };
  }

  return { LEAVES, KEYS, NODES, WACC, calc, pick, shapley, levers, byOwner, analyze };
});

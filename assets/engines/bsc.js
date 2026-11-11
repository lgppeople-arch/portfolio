/* 균형성과표(BSC)·전략 지도 엔진. KPI 트리(kpitree.js)의 말단 지표 13개를 네 관점(재무·고객·내부 프로세스·학습과 성장)에 빠짐없이 한 번씩 배치하고,
   트리에 없는 선행 지표(가상)를 더해 전략 목표별 성적을 낸다.
   - 지표 상태: 계획 대비 좋은 방향이면 좋음. 트리 지표는 KPI 트리의 현재 입력값(계획·실적)을 그대로 쓴다.
   - 선행·후행 검증: 전략 지도의 화살표는 가설이므로, 선행 지표가 몇 달 뒤 결과 지표와 가장 강하게 움직이는지 교차상관으로 확인한다.
   틀: Kaplan & Norton, "The Balanced Scorecard: Measures That Drive Performance"(HBR, 1992), 『Strategy Maps』(2004). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.BscEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const PERSP = [
    { id: "F", label: "재무", q: "주주에게 어떻게 보여야 하나" },
    { id: "C", label: "고객", q: "고객에게 무엇으로 선택받나" },
    { id: "P", label: "내부 프로세스", q: "무엇을 잘해야 하나" },
    { id: "L", label: "학습과 성장", q: "어떤 역량을 길러야 하나" }
  ];
  /* 같은 관점 안의 순서는 전략 지도의 왼쪽→오른쪽(재무는 ROIC를 가운데에 둬 화살표가 상자를 가로지르지 않게). m: [출처, 키 또는 지표]. tree = KPI 트리 말단, calc = 트리 계산 결과, own = 트리 밖 지표(아래 OWN) */
  const OBJ = [
    { id: "F2", p: "F", s: "수익성", label: "수익성 개선", m: [["calc", "opm"]] },
    { id: "F1", p: "F", s: "자본비용 초과", label: "자본비용을 넘는 이익", m: [["calc", "roic"], ["tree", "tax"]] },
    { id: "F3", p: "F", s: "자산 효율", label: "자산 효율", m: [["calc", "turn"], ["tree", "ppe"]] },
    { id: "C1", p: "C", s: "점유율", label: "점유율 확대", m: [["tree", "q"], ["own", "cert"]] },
    { id: "C2", p: "C", s: "가격 프리미엄", label: "가격 프리미엄 유지", m: [["tree", "p"], ["own", "otd"]] },
    { id: "C3", p: "C", s: "거래 조건", label: "건전한 거래 조건", m: [["tree", "dso"]] },
    { id: "P1", p: "P", s: "수율·설비", label: "수율·설비 안정", m: [["tree", "yld"], ["own", "oee"]] },
    { id: "P2", p: "P", s: "원가", label: "원가 경쟁력", m: [["tree", "mat"], ["tree", "vconv"], ["tree", "fconv"], ["tree", "fsga"], ["tree", "vsga"]] },
    { id: "P3", p: "P", s: "공급망 회전", label: "공급망 회전", m: [["tree", "dio"], ["tree", "dpo"], ["own", "plan"]] },
    { id: "L1", p: "L", s: "핵심 인력", label: "핵심 공정 인력", m: [["own", "multi"]] },
    { id: "L2", p: "L", s: "데이터 운영", label: "데이터 기반 운영", m: [["own", "data"]] },
    { id: "L3", p: "L", s: "개선 실행", label: "개선 실행력", m: [["own", "kaizen"]] }
  ];
  /* 원인 → 결과(아래 관점에서 위 관점으로) */
  const LINKS = [["L1", "P1"], ["L2", "P1"], ["L2", "P3"], ["L3", "P2"], ["P1", "C1"], ["P1", "C2"], ["P3", "C2"], ["P2", "F2"], ["P3", "F3"], ["C1", "F2"], ["C1", "F3"], ["C2", "F2"], ["C3", "F3"], ["F2", "F1"], ["F3", "F1"]];
  /* 트리 밖 지표(가상). lead: 선행이면 true */
  const OWN = {
    cert: { label: "신규 고객 인증 통과", unit: "건", plan: 4, act: 3, dir: 1, owner: "영업·품질", lead: true },
    otd: { label: "납기 준수율", unit: "%", plan: 97, act: 95.5, dir: 1, owner: "SCM", lead: true },
    oee: { label: "설비 종합효율(OEE)", unit: "%", plan: 78, act: 75.5, dir: 1, owner: "생산", lead: true },
    plan: { label: "생산계획 준수율", unit: "%", plan: 92, act: 89, dir: 1, owner: "SCM", lead: true },
    multi: { label: "다기능 인력 비율", unit: "%", plan: 30, act: 33, dir: 1, owner: "인사·생산", lead: true },
    data: { label: "공정 데이터 자동 수집 비율", unit: "%", plan: 60, act: 72, dir: 1, owner: "생산기술", lead: true },
    kaizen: { label: "개선 과제 완료율", unit: "%", plan: 85, act: 71, dir: 1, owner: "전 조직", lead: true }
  };
  /* 트리 결과 지표는 후행, 트리 말단 중 먼저 움직이는 것은 선행 */
  const TREE_LEAD = { yld: true, dio: true, dso: true, dpo: true, mat: false, q: false, p: false, vconv: false, fconv: false, fsga: false, vsga: false, tax: false, ppe: false };
  const CALC = { roic: { label: "ROIC", unit: "%", dir: 1, owner: "전사" }, opm: { label: "영업이익률", unit: "%", dir: 1, owner: "전사" }, turn: { label: "투하자본 회전율", unit: "회", dir: 1, owner: "전사" } };

  /* leaves: KpiTree LEAVES 형태({plan, act, dir, label, unit, owner}), P/A: 트리 calc 결과(계획·실적) */
  function measure(src, key, leaves, P, A, own) {
    own = own || OWN;
    if (src === "tree") { const L = leaves[key]; return { key: key, src: src, label: L.label, unit: L.unit, plan: L.plan, act: L.act, dir: L.dir, owner: L.owner, lead: !!TREE_LEAD[key] }; }
    if (src === "calc") { const C = CALC[key]; return { key: key, src: src, label: C.label, unit: C.unit, plan: P[key], act: A[key], dir: C.dir, owner: C.owner, lead: false }; }
    const O = own[key]; return { key: key, src: src, label: O.label, unit: O.unit, plan: O.plan, act: O.act, dir: O.dir, owner: O.owner, lead: O.lead };
  }
  function score(leaves, P, A, own) {
    return OBJ.map((o) => {
      const ms = o.m.map((q) => { const m = measure(q[0], q[1], leaves, P, A, own), d = (m.act - m.plan) * m.dir, rel = m.plan ? (m.act - m.plan) / Math.abs(m.plan) : 0; m.good = d > 1e-12 ? 1 : d < -1e-12 ? -1 : 0; m.rel = rel; return m; });
      const g = ms.filter((m) => m.good > 0).length, b = ms.filter((m) => m.good < 0).length;
      return { id: o.id, p: o.p, label: o.label, ms: ms, good: g, bad: b, status: b === 0 && g > 0 ? 1 : g === 0 && b > 0 ? -1 : b === 0 && g === 0 ? 0 : 0.5 };
    });
  }
  /* 트리 말단이 관점에 빠짐없이 한 번씩 놓였는지 */
  function coverage(keys) {
    const seen = {}; OBJ.forEach((o) => o.m.forEach((q) => { if (q[0] === "tree") seen[q[1]] = (seen[q[1]] || 0) + 1; }));
    return { missing: keys.filter((k) => !seen[k]), dup: Object.keys(seen).filter((k) => seen[k] > 1), extra: Object.keys(seen).filter((k) => keys.indexOf(k) < 0) };
  }

  /* ---------- 선행·후행 검증 ---------- */
  function corr(a, b) {
    const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
    let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
    return sab / Math.sqrt(saa * sbb);
  }
  /* k개월 시차: 선행 x_t 와 결과 y_{t+k} */
  function xcorr(x, y, maxLag) { const out = []; for (let k = 0; k <= maxLag; k++) out.push({ lag: k, r: corr(x.slice(0, x.length - k), y.slice(k)), n: x.length - k }); return out; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  /* 가상 월별 자료: OEE(%)가 lag개월 뒤 매출총이익률(%)을 움직이도록 심어 둔다. */
  const SERIES = { months: 36, lag: 2, beta: 0.45, seed: 20261111 };
  function series(o) {
    o = Object.assign({}, SERIES, o || {});
    const r = rng(o.seed), n = o.months + o.lag, lead = []; let e = 0;
    for (let t = 0; t < n; t++) { e = 0.6 * e + gauss(r) * 1.6; lead.push(78 + e); }
    const res = []; for (let t = 0; t < n; t++) res.push(22 + o.beta * (t >= o.lag ? lead[t - o.lag] - 78 : 0) + gauss(r) * 0.55);
    return { lead: lead.slice(o.lag), lag: res.slice(o.lag), planted: o.lag };
  }
  return { PERSP, OBJ, LINKS, OWN, TREE_LEAD, CALC, measure, score, coverage, corr, xcorr, series, SERIES };
});

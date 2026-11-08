/* 원가 행태와 불량 관리 엔진. 금액은 억원, 생산량은 만 개.
   - 원가 행태: 월 제조원가 = 고정비 + 변동비 × 생산량을 최소제곱 회귀로 추정(계수 신뢰구간, 결정계수, 더빈-왓슨)
     고저점법과 비교하고, 라인 증설 같은 구조변화를 Chow 검정과 더미변수 회귀로 확인한다
   - 손익분기 생산량 = 고정비 ÷ (판매단가 − 변동비). 계수 추정오차를 다변량 정규로 뽑아 95% 구간을 낸다
   - 불량 관리도: p 관리도(검사 수가 달마다 달라 한계선이 달라짐), 넬슨 규칙, EWMA로 작은 지속 변화 감지
   - 개선 효과: 공정 정비 전후 불량률을 두 비율 z검정으로 비교하고 연간 폐기비용 절감을 구간으로 추정 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api;
  else root.CostEngine = api;
})(typeof self !== "undefined" ? self : this, function (Stats) {
  "use strict";

  const OPTS = { price: 9000, scrap: 4200, breakYm: "2025-07", fixYm: "2025-10", baseN: 12, lambda: 0.2, L: 3 };

  /* 가상 공장 34개월: 2025년 7월 라인 증설(고정비 ↑, 변동비 ↓), 2024년 9월 일시 불량, 2025년 10월 불량 처리 공정 정비 */
  function sample() {
    const r = Stats.rng(20240101), rows = [];
    for (let i = 0; i < 34; i++) {
      const y = 2024 + Math.floor(i / 12), m = (i % 12) + 1, ym = y + "-" + String(m).padStart(2, "0");
      const after = ym >= OPTS.breakYm, season = 8 * Math.sin(2 * Math.PI * (m - 3) / 12);
      const vol = (after ? 100 : 80) + 0.3 * i + season + 4 * r.normal();
      const cost = (after ? 46 : 38) + (after ? 0.39 : 0.42) * vol + 1.2 * r.normal();
      const n = Math.round(vol * 25), p = ym === "2024-09" ? 0.036 : (i >= 13 && i <= 17) ? 0.027 : ym >= OPTS.fixYm ? 0.014 : 0.02;
      let d = 0; for (let k = 0; k < n; k++) if (r.u() < p) d++;
      rows.push({ ym: ym, vol: Math.round(vol * 10) / 10, cost: Math.round(cost * 100) / 100, n: n, def: d });
    }
    return rows;
  }
  const toCsv = (rows) => "월,생산량,제조원가,검사수,불량수\n" + rows.map((r) => [r.ym, r.vol, r.cost, r.n, r.def].join(",")).join("\n");
  function parse(text) {
    const rows = [], errors = [];
    text.split(/\r?\n/).forEach((line, li) => {
      const t = line.trim(); if (!t || /^월/.test(t)) return;
      const c = t.split(/[,\t]/).map((s) => s.trim());
      const v = c.slice(1, 5).map(Number);
      if (c.length < 5 || !/^\d{4}-\d{2}$/.test(c[0]) || v.some((x) => !isFinite(x)) || v[2] <= 0 || v[3] < 0 || v[3] > v[2]) { errors.push((li + 1) + "번째 줄"); return; }
      rows.push({ ym: c[0], vol: v[0], cost: v[1], n: Math.round(v[2]), def: Math.round(v[3]) });
    });
    rows.sort((a, b) => (a.ym < b.ym ? -1 : 1));
    return { rows: rows, errors: errors };
  }

  /* ---------- 원가 행태 ---------- */
  function costModel(rows, o) {
    o = Object.assign({}, OPTS, o || {});
    const xs = rows.map((r) => r.vol), ys = rows.map((r) => r.cost), n = rows.length;
    let k = rows.findIndex((r) => r.ym >= o.breakYm); if (k < 0) k = n;
    const tq = Stats.tInv(0.975, n - 2), ols = Stats.linreg(xs, ys);
    const ci = (b, se, df) => { const t = Stats.tInv(0.975, df); return [b - t * se, b + t * se]; };
    const seA = ols.se * Math.sqrt(1 / n + Math.pow(Stats.mean(xs), 2) / Stats.sum(xs.map((x) => Math.pow(x - Stats.mean(xs), 2))));
    /* 고저점법: 생산량이 가장 많은 달과 적은 달 두 점으로 직선 */
    let hi = 0, lo = 0; xs.forEach((x, i) => { if (x > xs[hi]) hi = i; if (x < xs[lo]) lo = i; });
    const bHL = (ys[hi] - ys[lo]) / (xs[hi] - xs[lo]), aHL = ys[hi] - bHL * xs[hi];
    const okBreak = k >= 4 && n - k >= 4;
    const chow = okBreak ? Stats.chow(xs, ys, k) : null;
    /* 구조변화 더미: 증설 이후 고정비 이동(c)과 변동비 변화(d) */
    const dm = okBreak ? Stats.mlr(rows.map((r, i) => [r.vol, i >= k ? 1 : 0, i >= k ? r.vol : 0]), ys) : null;
    const pre = okBreak ? Stats.linreg(xs.slice(0, k), ys.slice(0, k)) : null, post = okBreak ? Stats.linreg(xs.slice(k), ys.slice(k)) : null;
    const rmse = (pred) => Math.sqrt(Stats.mean(ys.map((y, i) => (y - pred(i)) * (y - pred(i)))));
    const methods = [
      { key: "hl", label: "고저점법 (두 달만 사용)", a: aHL, b: bHL, r2: null, rmse: rmse((i) => aHL + bHL * xs[i]) },
      { key: "ols", label: "회귀 (전체 기간)", a: ols.a, b: ols.b, r2: ols.r2, rmse: rmse((i) => ols.fit[i]) }
    ];
    if (dm) methods.push({ key: "dummy", label: "회귀 + 증설 전후 구분", a: dm.b[0] + dm.b[2], b: dm.b[1] + dm.b[3], r2: dm.r2, rmse: rmse((i) => dm.fit[i]), note: "증설 후 기준" });
    /* 손익분기: 현재 체제(증설 후)의 고정비·변동비 추정오차를 반영 */
    const cur = post || ols, curA = cur.a, curB = cur.b, curRows = post ? rows.slice(k) : rows;
    const cx = curRows.map((r) => r.vol), mx = Stats.mean(cx), sxx = Stats.sum(cx.map((x) => (x - mx) * (x - mx)));
    const varB = cur.se * cur.se / sxx, varA = cur.se * cur.se * (1 / cx.length + mx * mx / sxx), covAB = -mx * varB;
    const L = Stats.cholesky([[varA, covAB], [covAB, varB]]), unit = o.price / 1e4;   /* 억원/만 개 */
    const r = Stats.rng(7), beps = [];
    for (let i = 0; i < 4000; i++) { const e1 = r.normal(), e2 = r.normal(), a = curA + L[0][0] * e1, b = curB + L[1][0] * e1 + L[1][1] * e2; if (unit > b) beps.push(a / (unit - b)); }
    beps.sort((p, q) => p - q);
    const bep = curA / (unit - curB), volNow = Stats.mean(cx.slice(-6));
    const bepPre = pre ? pre.a / (unit - pre.b) : null;
    return {
      n: n, k: k, ols: ols, seA: seA, ciA: ci(ols.a, seA, n - 2), ciB: ci(ols.b, ols.seB, n - 2), tq: tq, dw: Stats.durbinWatson(ols.resid),
      hl: { a: aHL, b: bHL, hi: hi, lo: lo }, chow: chow, dummy: dm, pre: pre, post: post, methods: methods,
      cur: { a: curA, b: curB, ciA: post ? ci(post.a, Math.sqrt(varA), post.df) : ci(ols.a, seA, n - 2), ciB: post ? ci(post.b, post.seB, post.df) : ci(ols.b, ols.seB, n - 2), se: cur.se },
      bep: bep, bepLo: Stats.quantile(beps, 0.025), bepHi: Stats.quantile(beps, 0.975), bepPre: bepPre, volNow: volNow, mos: 1 - bep / volNow,
      dol: (unit - curB) * volNow / ((unit - curB) * volNow - curA), unit: unit
    };
  }

  /* ---------- 넬슨 규칙(표준화 점수 z 기준) ---------- */
  function nelson(z) {
    const n = z.length, out = z.map(() => []);
    const mark = (from, to, rule) => { for (let i = from; i <= to; i++) if (out[i].indexOf(rule) < 0) out[i].push(rule); };
    for (let i = 0; i < n; i++) {
      if (Math.abs(z[i]) > 3) mark(i, i, 1);
      if (i >= 8) { const s = z.slice(i - 8, i + 1); if (s.every((v) => v > 0) || s.every((v) => v < 0)) mark(i - 8, i, 2); }
      if (i >= 5) { let up = true, dn = true; for (let j = i - 4; j <= i; j++) { if (!(z[j] > z[j - 1])) up = false; if (!(z[j] < z[j - 1])) dn = false; } if (up || dn) mark(i - 5, i, 3); }
      /* 규칙 5·6은 기준을 넘은 점만 표시한다(창 안의 정상 점은 표시하지 않음) */
      const markIf = (from, to, rule, f) => { for (let j = from; j <= to; j++) if (f(z[j]) && out[j].indexOf(rule) < 0) out[j].push(rule); };
      if (i >= 2) { const s = z.slice(i - 2, i + 1); if (s.filter((v) => v > 2).length >= 2) markIf(i - 2, i, 5, (v) => v > 2); if (s.filter((v) => v < -2).length >= 2) markIf(i - 2, i, 5, (v) => v < -2); }
      if (i >= 4) { const s = z.slice(i - 4, i + 1); if (s.filter((v) => v > 1).length >= 4) markIf(i - 4, i, 6, (v) => v > 1); if (s.filter((v) => v < -1).length >= 4) markIf(i - 4, i, 6, (v) => v < -1); }
    }
    return out;
  }
  const RULES = { 1: "3σ 밖", 2: "9개월 연속 한쪽", 3: "6개월 연속 상승·하락", 5: "3개월 중 2개월이 2σ 밖", 6: "5개월 중 4개월이 1σ 밖" };

  /* ---------- p 관리도와 EWMA ---------- */
  function pChart(rows, o) {
    o = Object.assign({}, OPTS, o || {});
    const base = rows.slice(0, Math.min(o.baseN, rows.length));
    /* 1단계: 기준 기간의 평균 불량률. 3σ 밖의 달(특수 원인)은 한 번 걸러 낸 뒤 다시 계산 */
    const pbarOf = (rs) => Stats.sum(rs.map((r) => r.def)) / Stats.sum(rs.map((r) => r.n));
    let pbar = pbarOf(base);
    const excluded = base.filter((r) => Math.abs(r.def / r.n - pbar) > 3 * Math.sqrt(pbar * (1 - pbar) / r.n)).map((r) => r.ym);
    if (excluded.length && excluded.length < base.length) pbar = pbarOf(base.filter((r) => excluded.indexOf(r.ym) < 0));
    const pts = rows.map((r) => { const p = r.def / r.n, s = Math.sqrt(pbar * (1 - pbar) / r.n); return { ym: r.ym, p: p, n: r.n, s: s, ucl: pbar + 3 * s, lcl: Math.max(0, pbar - 3 * s), z: (p - pbar) / s }; });
    const rules = nelson(pts.map((q) => q.z));
    pts.forEach((q, i) => { q.rules = rules[i]; });
    /* EWMA: 표준화 점수의 지수가중이동평균. 작은 변화가 몇 달 이어지면 먼저 잡는다 */
    const lam = o.lambda; let e = 0;
    const ewma = pts.map((q, i) => { e = lam * q.z + (1 - lam) * e; const w = o.L * Math.sqrt(lam / (2 - lam) * (1 - Math.pow(1 - lam, 2 * (i + 1)))); return { ym: q.ym, v: e, ucl: w, lcl: -w, out: Math.abs(e) > w }; });
    return { pbar: pbar, excluded: excluded, pts: pts, ewma: ewma, baseN: base.length };
  }

  /* ---------- 공정 정비 전후 ---------- */
  function beforeAfter(rows, o) {
    o = Object.assign({}, OPTS, o || {});
    const A = rows.filter((r) => r.ym < o.fixYm), B = rows.filter((r) => r.ym >= o.fixYm);
    if (A.length < 3 || B.length < 3) return null;
    const x1 = Stats.sum(A.map((r) => r.def)), n1 = Stats.sum(A.map((r) => r.n)), x2 = Stats.sum(B.map((r) => r.def)), n2 = Stats.sum(B.map((r) => r.n));
    const t = Stats.twoProp(x1, n1, x2, n2);
    /* 연간 생산량(최근 12개월) × 불량률 감소 × 불량 1개당 폐기비용 */
    const annual = Stats.sum(rows.slice(-12).map((r) => r.vol)) * 1e4 * 12 / Math.min(12, rows.length), perUnit = o.scrap / 1e8;
    const sav = (d) => -d * annual * perUnit;
    return { before: { months: A.length, def: x1, n: n1 }, after: { months: B.length, def: x2, n: n2 }, test: t, annual: annual, saving: sav(t.diff), savingLo: sav(t.hi), savingHi: sav(t.lo) };
  }

  return { OPTS, RULES, sample, toCsv, parse, costModel, nelson, pChart, beforeAfter };
});

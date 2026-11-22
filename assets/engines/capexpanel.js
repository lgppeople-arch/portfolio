/* 투자와 3년 뒤 수익성: 계산 엔진. examples/dart/analyze.py와 같은 식이다.
   데이터(assets/data/capex-panel.js)에 Python이 낸 답(py)을 함께 넣어 두고, 검산에서 두 답이 같은지 대조한다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.CapexPanel = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const H = 3;
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => sum(a) / a.length;
  /* 가장 가까운 순위 방식의 절단: 아래 floor(p(n-1))번째, 위 ceil((1-p)(n-1))번째 */
  function winsor(v, p) {
    p = p === undefined ? 0.01 : p;
    const s = v.slice().sort((a, b) => a - b), n = s.length, lo = s[Math.floor(p * (n - 1))], hi = s[Math.ceil((1 - p) * (n - 1))];
    return v.map((x) => Math.min(Math.max(x, lo), hi));
  }
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let k = 0; k < n; k++) {
      let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      const tmp = M[k]; M[k] = M[p]; M[p] = tmp;
      for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = 0; for (let j = i + 1; j < n; j++) s += M[i][j] * x[j]; x[i] = (M[i][n] - s) / M[i][i]; }
    return x;
  }
  function ols(X, y) {
    const k = X[0].length, A = [], b = [];
    for (let i = 0; i < k; i++) { A.push([]); for (let j = 0; j < k; j++) A[i].push(sum(X.map((r) => r[i] * r[j]))); b.push(sum(X.map((r, q) => r[i] * y[q]))); }
    return solve(A, b);
  }
  /* 연도별 계수의 평균과 t값: 단순, 뉴이-웨스트(시차 2) */
  function nwT(b, L) {
    L = L === undefined ? 2 : L;
    const T = b.length, m = mean(b), e = b.map((x) => x - m);
    const g = (l) => { let s = 0; for (let t = l; t < T; t++) s += e[t] * e[t - l]; return s / T; };
    let v = g(0); for (let l = 1; l <= L; l++) v += 2 * (1 - l / (L + 1)) * g(l);
    const sd = Math.sqrt(sum(e.map((x) => x * x)) / (T - 1));
    return { mean: m, t: m / (sd / Math.sqrt(T)), tNw: m / Math.sqrt(Math.max(v, 1e-300) / T) };
  }
  const K5 = ["roa0", "roa3", "inv", "ag", "g0", "sg3"];
  function prep(data) {
    const D = data.rows.map((r) => { const o = {}; data.cols.forEach((c, i) => { o[c] = r[i]; }); return o; });
    const years = Array.from(new Set(D.map((d) => d.year))).sort((a, b) => a - b);
    years.forEach((t) => {
      const g = D.filter((d) => d.year === t);
      K5.forEach((k) => { const w = winsor(g.map((d) => d[k])); g.forEach((d, i) => { d[k + "_w"] = w[i]; }); });
      const cnt = {}; g.forEach((d) => { cnt[d.ind] = (cnt[d.ind] || 0) + 1; });
      g.forEach((d) => { d.grp = cnt[d.ind] >= 5 ? d.ind : 0; });
    });
    D.forEach((d) => { d.droa = d.roa3_w - d.roa0_w; });
    return { D: D, years: years };
  }
  const VARS = { M0: ["roa0_w"], M1: ["inv_w"], M2: ["inv_w", "roa0_w", "size", "g0_w"], M3: ["ag_w", "roa0_w", "size", "g0_w"] };
  function demean(g, keys) {
    const s = {};
    g.forEach((d) => { const q = s[d.grp] || (s[d.grp] = { n: 0 }); q.n++; keys.forEach((k) => { q[k] = (q[k] || 0) + d[k]; }); });
    return g.map((d) => { const o = {}; keys.forEach((k) => { o[k] = d[k] - s[d.grp][k] / s[d.grp].n; }); return o; });
  }
  function famaMacBeth(P, model, fe) {
    const xs = VARS[model], keys = xs.concat(["droa"]);
    const coefs = P.years.map((t) => {
      const g = P.D.filter((d) => d.year === t);
      const z = fe ? demean(g, keys) : g;
      return ols(z.map((q) => [1].concat(xs.map((k) => q[k]))), z.map((q) => q.droa));
    });
    return { vars: xs, byYear: coefs, stats: xs.map((_, j) => nwT(coefs.map((c) => c[j + 1]))) };
  }
  function bucket(g, n) { const qs = []; for (let q = 0; q < n; q++) qs.push([]); g.forEach((d, i) => qs[Math.floor(i * n / g.length)].push(d)); return qs; }
  function quintiles(P) {
    const keys = ["inv", "roa0", "droa", "resid", "sg3"], out = {}, spread = { droa: [], resid: [], sg3: [] };
    keys.forEach((k) => { out[k] = [[], [], [], [], []]; });
    P.years.forEach((t) => {
      const g = P.D.filter((d) => d.year === t).sort((a, b) => a.inv_w - b.inv_w || a.roa0_w - b.roa0_w);
      const f = ols(g.map((d) => [1, d.roa0_w]), g.map((d) => d.droa)), qs = bucket(g, 5), m = [];
      qs.forEach((q, i) => {
        m[i] = { inv: mean(q.map((d) => d.inv_w)), roa0: mean(q.map((d) => d.roa0_w)), droa: mean(q.map((d) => d.droa)), resid: mean(q.map((d) => d.droa - f[0] - f[1] * d.roa0_w)), sg3: mean(q.map((d) => d.sg3_w)) };
        keys.forEach((k) => out[k][i].push(m[i][k]));
      });
      Object.keys(spread).forEach((k) => spread[k].push(m[4][k] - m[0][k]));
    });
    const mm = {}, sp = {};
    keys.forEach((k) => { mm[k] = out[k].map(mean); });
    Object.keys(spread).forEach((k) => { sp[k] = nwT(spread[k]); });
    return { mean: mm, spread: sp };
  }
  /* 표본 밖 예측: t년 관측치의 3년 뒤 ΔROA를 t−3년 이전 관측치(결과가 t에 확정됨)로만 추정한 식으로 예측 */
  function oos(P, first) {
    first = first || 2019;
    const res = P.years.filter((y) => y >= first).map((t) => {
      const tr = P.D.filter((d) => d.year <= t - H), te = P.D.filter((d) => d.year === t), r = { year: t, n: te.length, trainN: tr.length };
      ["M0", "M2"].forEach((m) => {
        const xs = VARS[m], b = ols(tr.map((d) => [1].concat(xs.map((k) => d[k]))), tr.map((d) => d.droa));
        r[m] = mean(te.map((d) => Math.abs(b[0] + sum(xs.map((k, j) => b[j + 1] * d[k])) - d.droa)));
        r[m + "b"] = b;
      });
      r.naive = mean(te.map((d) => Math.abs(d.droa)));
      return r;
    });
    const tot = sum(res.map((r) => r.n)), w = {};
    ["M0", "M2", "naive"].forEach((k) => { w[k] = sum(res.map((r) => r[k] * r.n)) / tot; });
    return { years: res, mae: w, wins: res.filter((r) => r.M2 < r.M0).length };
  }
  function decilesRoa(P) {
    const acc = [], x = []; for (let q = 0; q < 10; q++) { acc.push([]); x.push([]); }
    P.years.forEach((t) => {
      const g = P.D.filter((d) => d.year === t).sort((a, b) => a.roa0_w - b.roa0_w || a.inv_w - b.inv_w);
      bucket(g, 10).forEach((q, i) => { acc[i].push(mean(q.map((d) => d.droa))); x[i].push(mean(q.map((d) => d.roa0_w))); });
    });
    return { roa0: x.map(mean), droa: acc.map(mean) };
  }
  function analyze(data) {
    const P = prep(data), fm = {};
    Object.keys(VARS).forEach((m) => { fm[m] = famaMacBeth(P, m, false); fm[m + "_fe"] = famaMacBeth(P, m, true); });
    return { P: P, fm: fm, quint: quintiles(P), oos: oos(P), roaDec: decilesRoa(P) };
  }
  return { winsor, solve, ols, nwT, prep, famaMacBeth, quintiles, oos, decilesRoa, analyze, VARS };
});

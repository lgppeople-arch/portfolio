/* 반도체 장비 수출입으로 업황 읽기: 계산 엔진. examples/trade/analyze.py와 같은 식이다.
   데이터(assets/data/trade-semi.js)에 Python이 낸 답(py)을 함께 넣어 두고, 검산에서 두 답이 같은지 대조한다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.TradeLead = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  /* 3개월 합계의 전년 동기 대비 증가율(%) */
  function yoy3(v) {
    const out = v.map(() => null);
    for (let i = 14; i < v.length; i++) {
      const a = v.slice(i - 2, i + 1), b = v.slice(i - 14, i - 11);
      if (a.concat(b).some((q) => q === null || q === undefined) || sum(b) <= 0) continue;
      out[i] = (sum(a) / sum(b) - 1) * 100;
    }
    return out;
  }
  function corr(x, y) {
    const n = x.length, mx = sum(x) / n, my = sum(y) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return sxy / Math.sqrt(sxx * syy);
  }
  function pairs(x, y, k) { const out = []; for (let t = 0; t < x.length; t++) if (t + k >= 0 && t + k < y.length && x[t] !== null && y[t + k] !== null) out.push([x[t], y[t + k]]); return out; }
  function ac1(v) { const w = v.filter((q) => q !== null); return corr(w.slice(0, -1), w.slice(1)); }
  function xcorr(x, y, maxlag) { const rows = []; for (let k = -maxlag; k <= maxlag; k++) { const p = pairs(x, y, k); rows.push({ lag: k, r: corr(p.map((q) => q[0]), p.map((q) => q[1])), n: p.length }); } return rows; }
  function ols(xs, ys) { const n = xs.length, mx = sum(xs) / n, my = sum(ys) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); } const b = sxy / sxx; return { a: my - b * mx, b: b }; }
  /* 표본 밖 예측: t까지의 자료로 y(s) = a + b·x(s − lag)를 추정해 y(t+h)를 예측, 나이브는 y(t) */
  function backtest(x, y, lag, h, start) {
    const rows = [];
    for (let t = start; t < y.length - h; t++) {
      const tr = []; for (let s = lag; s <= t; s++) if (x[s - lag] !== null && y[s] !== null) tr.push([x[s - lag], y[s]]);
      const xi = t + h - lag;
      if (tr.length < 24 || xi > t || x[xi] === null || y[t + h] === null || y[t] === null) continue;
      const f = ols(tr.map((q) => q[0]), tr.map((q) => q[1]));
      rows.push({ t: t, actual: y[t + h], model: f.a + f.b * x[xi], naive: y[t] });
    }
    const mae = (k) => sum(rows.map((r) => Math.abs(r[k] - r.actual))) / rows.length;
    const hit = rows.filter((r) => (r.model - r.naive) * (r.actual - r.naive) > 0).length / rows.length;
    return { n: rows.length, maeModel: mae("model"), maeNaive: mae("naive"), hit: hit, rows: rows };
  }
  const diff1 = (v) => v.map((q, i) => (i === 0 || q === null || v[i - 1] === null ? null : q - v[i - 1]));
  /* x(t)와 y(t+k)의 상관과 유효 표본 수(1차 자기상관 보정)·기준 ±2/√n_eff */
  function sigTest(x, y, k) { const p = pairs(x, y, k), a1 = ac1(x), a2 = ac1(y), nEff = p.length * (1 - a1 * a2) / (1 + a1 * a2); return { lag: k, r: corr(p.map((q) => q[0]), p.map((q) => q[1])), n: p.length, ac1: [a1, a2], nEff: nEff, thr: 2 / Math.sqrt(Math.max(nEff, 3)) }; }
  /* 시차 k: 메모리(t)와 장비(t+k). k > 0 메모리가 앞섬, k < 0 장비가 앞섬 */
  function analyze(D) {
    const S = D.series, mem = yoy3(S.KOR_X_854232), eq = yoy3(S.KOR_M_8486), xc = xcorr(mem, eq, 12);
    const best = (rows) => rows.reduce((b, r) => (r.r > b.r ? r : b));
    const peak = best(xc), dm = diff1(mem), de = diff1(eq), xcd = xcorr(dm, de, 12), peakD = best(xcd);
    const h1 = sigTest(dm, de, 6), h2 = sigTest(dm, de, peakD.lag), start = D.months.indexOf("202001");
    const bt1 = backtest(mem, eq, 6, 6, start), bt2 = backtest(eq, mem, Math.max(Math.abs(peakD.lag), 6), 6, start);
    return { mem: mem, eq: eq, xc: xc, xcd: xcd, peak: peak, peakD: peakD, h1: h1, h2: h2, bt1: bt1, bt2: bt2 };
  }
  /* 연간 합계(백만 달러): 완결된 해만 */
  function yearly(D, keys) {
    const out = {};
    D.months.forEach((m, i) => { const yr = +m.slice(0, 4); const o = (out[yr] = out[yr] || { year: yr, months: 0, ok: 0 }); o.months++; if (keys.every((k) => D.series[k][i] !== null && D.series[k][i] !== undefined)) o.ok++; keys.forEach((k) => { o[k] = (o[k] || 0) + (D.series[k][i] || 0); }); });
    return Object.keys(out).map((yr) => Object.assign(out[yr], { complete: out[yr].ok === 12 }));
  }
  return { yoy3, corr, xcorr, ac1, ols, backtest, diff1, sigTest, analyze, yearly };
});

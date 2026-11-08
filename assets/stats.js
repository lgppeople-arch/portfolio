/* 경영관리 분석에 쓰는 통계 함수 모음. 외부 라이브러리 없이 계산하고, 검산 페이지에서 알려진 값으로 확인한다.
   - 기술통계: 평균, 표본 표준편차, 분위수, 왜도, 첨도
   - 회귀: 단순 선형회귀(기울기 t값·p값, 결정계수, 잔차 표준오차, 예측 구간)
   - 분포: 정규·t·카이제곱·F 누적확률
   - 집중도: 지니계수, HHI, 로렌츠 곡선
   - 시드 난수: 같은 시드면 같은 결과(몬테카를로 재현용) */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Stats = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : NaN);
  /* 표본 분산(n − 1) */
  function variance(a) {
    if (a.length < 2) return NaN;
    const m = mean(a);
    return sum(a.map((x) => (x - m) * (x - m))) / (a.length - 1);
  }
  const sd = (a) => Math.sqrt(variance(a));

  /* 분위수: 선형보간(엑셀 PERCENTILE.INC와 같은 방식) */
  function quantile(a, p) {
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    if (!n) return NaN;
    const h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (s[hi] - s[lo]) * (h - lo);
  }

  /* 왜도·초과첨도: 엑셀 SKEW, KURT와 같은 표본 보정식 */
  function skew(a) {
    const n = a.length, m = mean(a), s = sd(a);
    if (n < 3 || !(s > 0)) return NaN;
    return n / ((n - 1) * (n - 2)) * sum(a.map((x) => Math.pow((x - m) / s, 3)));
  }
  function kurt(a) {
    const n = a.length, m = mean(a), s = sd(a);
    if (n < 4 || !(s > 0)) return NaN;
    const k = sum(a.map((x) => Math.pow((x - m) / s, 4)));
    return n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)) * k - 3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3));
  }

  function describe(a) {
    const m = mean(a), s = sd(a), q1 = quantile(a, 0.25), q3 = quantile(a, 0.75);
    return {
      n: a.length, mean: m, sd: s, cv: m ? s / Math.abs(m) : NaN, min: Math.min.apply(null, a), max: Math.max.apply(null, a),
      q1: q1, median: quantile(a, 0.5), q3: q3, iqr: q3 - q1, skew: skew(a), kurt: kurt(a),
      within1sd: a.filter((x) => Math.abs(x - m) <= s).length / a.length
    };
  }

  /* ---------- 분포 ---------- */
  /* 오차함수 근사(Abramowitz–Stegun 7.1.26, 오차 1.5e-7) */
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const normPdf = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  /* 표준정규 역함수(Acklam 근사, 상대오차 1e-9 수준) */
  function normInv(p) {
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /* 로그감마(Lanczos)와 정규화 불완전 베타·감마 함수: t·F·카이제곱 분포에 쓴다 */
  function lgamma(x) {
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    let s = 1.000000000190015;
    for (let j = 0; j < 6; j++) s += g[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function igamma(a, x) {   /* 정규화 하부 불완전 감마 P(a, x) */
    if (x <= 0) return 0;
    if (x < a + 1) { let ap = a, s = 1 / a, del = s; for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; s += del; if (Math.abs(del) < Math.abs(s) * 3e-14) break; } return s * Math.exp(-x + a * Math.log(x) - lgamma(a)); }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  /* t 분포 누적확률과 양측 p값 */
  function tCdf(t, df) { const x = df / (df + t * t), p = 0.5 * ibeta(x, df / 2, 0.5); return t >= 0 ? 1 - p : p; }
  const tTwoSided = (t, df) => 2 * (1 - tCdf(Math.abs(t), df));
  const chi2Sf = (x, k) => 1 - igamma(k / 2, x / 2);                 /* 카이제곱 상측확률 */
  const fSf = (f, d1, d2) => (f <= 0 ? 1 : ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2)); /* F 상측확률 */

  /* ---------- 회귀 ---------- */
  /* y = a + b·x. 잔차, 표준오차, 기울기 t값·p값, 결정계수, 예측 구간 함수까지 돌려준다 */
  function linreg(xs, ys) {
    const n = xs.length, mx = mean(xs), my = mean(ys);
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    const b = sxy / sxx, a = my - b * mx;
    const fit = xs.map((x) => a + b * x), resid = ys.map((y, i) => y - fit[i]);
    const sse = sum(resid.map((r) => r * r)), sst = sum(ys.map((y) => (y - my) * (y - my)));
    const df = n - 2, se = Math.sqrt(sse / df), seB = se / Math.sqrt(sxx), t = b / seB;
    return {
      a: a, b: b, fit: fit, resid: resid, se: se, r2: sst > 0 ? 1 - sse / sst : NaN, df: df, seB: seB, t: t, p: tTwoSided(t, df),
      /* x0에서의 예측 구간 반폭(신뢰수준 z배 근사 대신 t값을 받는다) */
      predHalf: (x0, tq) => tq * se * Math.sqrt(1 + 1 / n + (x0 - mx) * (x0 - mx) / sxx),
      at: (x0) => a + b * x0
    };
  }
  /* t 분위수: 이분법으로 tCdf를 거꾸로 푼다 */
  function tInv(p, df) {
    let lo = -50, hi = 50;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (tCdf(mid, df) < p) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* 한 표본 t검정: 평균이 mu0와 다른가 */
  function tTest1(a, mu0) {
    const n = a.length, m = mean(a), s = sd(a), t = (m - mu0) / (s / Math.sqrt(n));
    return { mean: m, t: t, df: n - 1, p: tTwoSided(t, n - 1) };
  }

  /* 일원분산분석: groups = [[...], [...]] */
  function anova(groups) {
    const all = [].concat.apply([], groups), gm = mean(all), k = groups.length, n = all.length;
    const ssb = sum(groups.map((g) => g.length * Math.pow(mean(g) - gm, 2)));
    const ssw = sum(groups.map((g) => { const m = mean(g); return sum(g.map((x) => (x - m) * (x - m))); }));
    const dfb = k - 1, dfw = n - k, f = (ssb / dfb) / (ssw / dfw);
    return { ssb: ssb, ssw: ssw, dfb: dfb, dfw: dfw, f: f, p: fSf(f, dfb, dfw), eta2: ssb / (ssb + ssw) };
  }

  /* 카이제곱 적합도: 관측 도수와 기대 비율 */
  function chi2Fit(obs, shares) {
    const n = sum(obs), tot = sum(shares);
    const exp = shares.map((s) => n * s / tot);
    const x2 = sum(obs.map((o, i) => (exp[i] > 0 ? (o - exp[i]) * (o - exp[i]) / exp[i] : 0)));
    const df = obs.length - 1;
    return { exp: exp, x2: x2, df: df, p: chi2Sf(x2, df), minExp: Math.min.apply(null, exp) };
  }

  /* ---------- 집중도 ---------- */
  function gini(a) {
    const s = a.slice().sort((x, y) => x - y), n = s.length, tot = sum(s);
    if (!n || !(tot > 0)) return 0;
    let cum = 0; s.forEach((x, i) => { cum += (i + 1) * x; });
    return (2 * cum) / (n * tot) - (n + 1) / n;
  }
  /* 로렌츠 곡선 점: [인원 누적비율, 금액 누적비율] */
  function lorenz(a) {
    const s = a.slice().sort((x, y) => x - y), tot = sum(s), out = [[0, 0]];
    let c = 0; s.forEach((x, i) => { c += x; out.push([(i + 1) / s.length, tot ? c / tot : 0]); });
    return out;
  }
  /* 허핀달-허쉬만 지수: 비중 제곱합(0~1). 1/HHI = 실질적인 항목 수 */
  function hhi(shares) { const t = sum(shares); return t ? sum(shares.map((s) => (s / t) * (s / t))) : 0; }
  /* 상위 p 비중 */
  function topShare(a, p) { const s = a.slice().sort((x, y) => y - x), k = Math.max(1, Math.round(s.length * p)), t = sum(s); return t ? sum(s.slice(0, k)) / t : 0; }

  /* ---------- 난수 ---------- */
  /* mulberry32: 32비트 시드 난수. 같은 시드면 같은 수열 */
  function rng(seed) {
    let a = seed >>> 0;
    const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    /* 박스-뮬러 정규난수 */
    let spare = null;
    const normal = () => { if (spare !== null) { const s = spare; spare = null; return s; } let u1 = 0; while (u1 === 0) u1 = u(); const u2 = u(), r = Math.sqrt(-2 * Math.log(u1)); spare = r * Math.sin(2 * Math.PI * u2); return r * Math.cos(2 * Math.PI * u2); };
    return { u: u, normal: normal };
  }

  /* 히스토그램: 구간 경계와 도수 */
  function histogram(a, bins, lo, hi) {
    lo = lo === undefined ? Math.min.apply(null, a) : lo; hi = hi === undefined ? Math.max.apply(null, a) : hi;
    if (hi === lo) hi = lo + 1;
    const w = (hi - lo) / bins, counts = new Array(bins).fill(0);
    a.forEach((x) => { let i = Math.floor((x - lo) / w); if (i < 0) i = 0; if (i >= bins) i = bins - 1; counts[i]++; });
    return { lo: lo, hi: hi, w: w, counts: counts, edges: counts.map((_, i) => lo + i * w) };
  }

  return { sum, mean, variance, sd, quantile, skew, kurt, describe, erf, normCdf, normPdf, normInv, lgamma, ibeta, igamma, tCdf, tTwoSided, tInv, chi2Sf, fSf,
    linreg, tTest1, anova, chi2Fit, gini, lorenz, hhi, topShare, rng, histogram };
});

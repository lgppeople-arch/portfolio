/* 통계 기법 노트 엔진: 기획·분석 실무에서 자주 쓰는 통계 기법의 계산과 예시 데이터. 예시 데이터는 모두 시드 고정 가상 값이다.
   - 분포 요약(사분위·튜키 울타리), 평균 신뢰구간과 반복 표집 적중률, 표본 크기
   - 두 집단 비교(웰치 t, 효과 크기), 표본 크기와 p값, 다중비교
   - 앤스컴 4종 데이터(Anscombe, 1973), 회귀의 신뢰구간·예측구간, 심슨의 역설과 표준화 비율
   - 고전적 가법 시계열 분해(2×12 중심이동평균), 홀트 선형 지수평활과 예측구간(ETS(A,A,N) 분산식)
   - 몬테카를로(삼각분포 + 정규 코퓰라 상관)와 토네이도, 베타-이항 베이지안 갱신
   - 부트스트랩 백분위 구간, 파레토·로렌츠·ABC, k-평균 군집(k-means++ 초기화), 평균으로의 회귀 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api;
  else root.StatLab = api;
})(typeof self !== "undefined" ? self : this, function (S) {
  "use strict";
  const mean = S.mean, sd = S.sd, q = S.quantile, sum = S.sum;

  /* ---------- 1. 분포 요약 ---------- */
  /* 거래처 120곳 매출채권 회수일(가상): 대부분 30~60일, 일부 거래처가 길게 끈다(로그정규) */
  function receivables() {
    const r = S.rng(4101), out = [];
    for (let i = 0; i < 120; i++) out.push(Math.round(Math.exp(Math.log(44) + 0.42 * r.normal())));
    return out;
  }
  /* 상자 그림 수치: 사분위, 1.5×IQR 울타리(튜키), 울타리 안 최솟값·최댓값, 이상치 */
  function box(a) {
    const q1 = q(a, 0.25), md = q(a, 0.5), q3 = q(a, 0.75), iqr = q3 - q1, lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
    const inside = a.filter((x) => x >= lf && x <= uf);
    return { q1: q1, median: md, q3: q3, iqr: iqr, lf: lf, uf: uf, lo: Math.min.apply(null, inside), hi: Math.max.apply(null, inside),
      out: a.filter((x) => x < lf || x > uf).sort((x, y) => x - y), mean: mean(a), sd: sd(a), n: a.length, p90: q(a, 0.9) };
  }

  /* ---------- 2. 신뢰구간 ---------- */
  function meanCI(a, conf, tq) {
    const n = a.length, m = mean(a), s = sd(a), t = tq || S.tInv(1 - (1 - (conf || 0.95)) / 2, n - 1), h = t * s / Math.sqrt(n);
    return { mean: m, sd: s, n: n, t: t, half: h, lo: m - h, hi: m + h };
  }
  /* 모평균 mu, 표준편차 sigma인 정규 모집단에서 크기 n 표본을 reps번 뽑아 95% 구간을 만든다 */
  function ciDraws(n, reps, seed, mu, sigma) {
    const r = S.rng(seed), out = [], tq = S.tInv(0.975, n - 1);
    mu = mu === undefined ? 100 : mu; sigma = sigma === undefined ? 12 : sigma;
    for (let k = 0; k < reps; k++) {
      const a = []; for (let i = 0; i < n; i++) a.push(mu + sigma * r.normal());
      const c = meanCI(a, 0.95, tq); c.hit = c.lo <= mu && mu <= c.hi; out.push(c);
    }
    return out;
  }
  /* 평균 추정에 필요한 표본 크기: n = (z·σ / E)², 올림 */
  const sampleSize = (sigma, E, conf) => Math.ceil(Math.pow(S.normInv(1 - (1 - (conf || 0.95)) / 2) * sigma / E, 2));

  /* ---------- 3. 두 집단 비교 ---------- */
  /* 공정 개선 전 24개 로트, 개선 후 20개 로트의 단위원가 지수(가상) */
  function lots() {
    const r = S.rng(5207), before = [], after = [];
    for (let i = 0; i < 24; i++) before.push(+(100 + 6 * r.normal()).toFixed(1));
    for (let i = 0; i < 20; i++) after.push(+(96 + 5 * r.normal()).toFixed(1));
    return { before: before, after: after };
  }
  function compare(a, b) {
    const w = S.welch(a, b), va = S.variance(a), vb = S.variance(b), se = Math.sqrt(va / a.length + vb / b.length), t = S.tInv(0.975, w.df);
    const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
    return { ma: mean(a), mb: mean(b), diff: w.diff, se: se, df: w.df, t: w.t, p: w.p, lo: w.diff - t * se, hi: w.diff + t * se, d: w.diff / sp };
  }
  /* 같은 평균 차이·표준편차에서 집단별 표본 수만 바꿀 때의 p값(웰치 t, 등분산·등표본) */
  function pBySize(diff, s, ns) {
    return ns.map((n) => { const se = Math.sqrt(2 * s * s / n), t = diff / se, df = 2 * n - 2; return { n: n, t: t, p: S.tTwoSided(t, df) }; });
  }
  /* 서로 독립인 검정을 m번 하면 적어도 하나가 우연히 유의할 확률 */
  const familywise = (m, alpha) => 1 - Math.pow(1 - (alpha || 0.05), m);

  /* ---------- 4. 상관과 회귀 ---------- */
  /* Anscombe(1973) 4종 데이터 */
  const ANSCOMBE = (function () {
    const x = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
    return [
      { x: x, y: [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68] },
      { x: x, y: [9.14, 8.14, 8.74, 8.77, 9.26, 8.10, 6.13, 3.10, 9.13, 7.26, 4.74] },
      { x: x, y: [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73] },
      { x: [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8], y: [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.50, 5.56, 7.91, 6.89] }
    ];
  })();
  function summary2(d) { const L = S.linreg(d.x, d.y); return { mx: mean(d.x), my: mean(d.y), sx: S.variance(d.x), sy: S.variance(d.y), r: S.corr(d.x, d.y), a: L.a, b: L.b, r2: L.r2 }; }

  /* 월 생산량(만 개)과 전력비(억원) 30개월(가상) */
  function power() {
    const r = S.rng(6311), x = [], y = [];
    for (let i = 0; i < 30; i++) { const v = 42 + 46 * r.u(); x.push(+v.toFixed(1)); y.push(+(2.1 + 0.034 * v + 0.16 * r.normal()).toFixed(2)); }
    return { x: x, y: y };
  }
  /* 회귀선, 평균의 신뢰구간, 개별 값의 예측구간 */
  function regBands(x, y, conf) {
    const L = S.linreg(x, y), n = x.length, mx = mean(x), sxx = sum(x.map((v) => (v - mx) * (v - mx))), t = S.tInv(1 - (1 - (conf || 0.95)) / 2, n - 2);
    const at = (x0) => { const f = L.a + L.b * x0, k = (x0 - mx) * (x0 - mx) / sxx; return { fit: f, ci: t * L.se * Math.sqrt(1 / n + k), pi: t * L.se * Math.sqrt(1 + 1 / n + k) }; };
    return { a: L.a, b: L.b, r2: L.r2, se: L.se, n: n, t: t, resid: L.resid, fit: L.fit, xmin: Math.min.apply(null, x), xmax: Math.max.apply(null, x), at: at,
      seA: L.se * Math.sqrt(1 / n + mx * mx / sxx), seB: L.seB };
  }

  /* 심슨의 역설: 두 공장, 두 제품의 불량(가상) */
  const SIMPSON = { A: { X: [900, 45], Y: [100, 1] }, B: { X: [100, 6], Y: [900, 18] } };
  function simpson(d, mix) {
    d = d || SIMPSON; mix = mix || { X: 0.5, Y: 0.5 };
    const rate = (c) => c[1] / c[0], out = {};
    ["A", "B"].forEach((p) => {
      const g = d[p], n = g.X[0] + g.Y[0], k = g.X[1] + g.Y[1];
      out[p] = { X: rate(g.X), Y: rate(g.Y), total: k / n, std: mix.X * rate(g.X) + mix.Y * rate(g.Y), shareX: g.X[0] / n };
    });
    return out;
  }

  /* ---------- 5. 시계열 ---------- */
  const SEASON = [-6, -4, 2, 3, 4, 1, -2, -3, 2, 4, 3, -4];
  /* 월 매출 48개월(억원, 가상): 추세 + 계절 + 불규칙 */
  function sales() {
    const r = S.rng(7419), y = [];
    for (let t = 0; t < 48; t++) y.push(+(80 + 0.5 * t + SEASON[t % 12] + 1.5 * r.normal()).toFixed(1));
    return y;
  }
  /* 고전적 가법 분해(R의 decompose와 같은 절차): 2×p 중심이동평균 추세 → 월별 평균 계절성(합 0) → 나머지 */
  function decompose(y, p) {
    p = p || 12; const n = y.length, h = p / 2, T = new Array(n).fill(null);
    for (let t = h; t < n - h; t++) { let s = 0.5 * y[t - h] + 0.5 * y[t + h]; for (let k = t - h + 1; k < t + h; k++) s += y[k]; T[t] = s / p; }
    const bucket = Array.from({ length: p }, () => []);
    for (let t = 0; t < n; t++) if (T[t] !== null) bucket[t % p].push(y[t] - T[t]);
    let idx = bucket.map((b) => mean(b)); const c = mean(idx); idx = idx.map((v) => v - c);
    const Sx = y.map((_, t) => idx[t % p]), R = y.map((v, t) => (T[t] === null ? null : v - T[t] - Sx[t]));
    return { trend: T, seasonal: Sx, index: idx, remainder: R };
  }

  /* 원재료 단가 지수 36개월(가상): 추세가 바뀌는 계열 */
  function material() {
    const r = S.rng(8123), y = []; let lv = 100, b = 0.3;
    for (let t = 0; t < 36; t++) { if (t === 18) b = 0.9; lv += b + 1.1 * r.normal(); y.push(+lv.toFixed(1)); }
    return y;
  }
  /* 홀트 선형 지수평활. alpha: 수준, beta: 추세(β*). 오차수정형으로 쓰면 l += b + αe, b += αβ*·e
     h기 앞 예측분산(ETS(A,A,N)): σ²[1 + (h−1){α² + αβh + β²h(2h−1)/6}], 여기서 β = αβ* */
  function holt(y, alpha, beta, H) {
    let l = y[0], b = y[1] - y[0], sse = 0, ape = 0, m = 0; const fit = [null];
    for (let t = 1; t < y.length; t++) {
      const f = l + b, e = y[t] - f; fit.push(f);
      if (t >= 2) { sse += e * e; ape += Math.abs(e / y[t]); m++; }
      const l0 = l; l = alpha * y[t] + (1 - alpha) * (l + b); b = beta * (l - l0) + (1 - beta) * b;
    }
    const sigma = Math.sqrt(sse / Math.max(1, m - 2)), B = alpha * beta, fc = [];
    for (let h = 1; h <= (H || 6); h++) {
      const v = sigma * sigma * (1 + (h - 1) * (alpha * alpha + alpha * B * h + B * B * h * (2 * h - 1) / 6));
      fc.push({ h: h, f: l + h * b, sd: Math.sqrt(v) });
    }
    return { alpha: alpha, beta: beta, level: l, slope: b, fit: fit, sse: sse, sigma: sigma, mape: ape / m, fc: fc };
  }
  /* α, β*를 격자로 찾아 1기 앞 예측오차 제곱합 최소 */
  function holtFit(y, H) {
    let best = null;
    for (let a = 0.05; a <= 0.951; a += 0.05) for (let b = 0.02; b <= 0.501; b += 0.02) { const m = holt(y, +a.toFixed(2), +b.toFixed(2), H); if (!best || m.sse < best.sse) best = m; }
    return best;
  }
  /* 검산용: 같은 상태공간 모형에서 미래 경로를 굴려 h기 앞 분산을 직접 잰다 */
  function holtSimVar(alpha, beta, sigma, h, n, seed) {
    const r = S.rng(seed || 99), v = [];
    for (let k = 0; k < n; k++) { let l = 0, b = 0, y = 0; for (let j = 1; j <= h; j++) { const e = sigma * r.normal(); y = l + b + e; l = l + b + alpha * e; b = b + alpha * beta * e; } v.push(y); }
    return S.variance(v);
  }

  /* ---------- 6. 위험과 의사결정 ---------- */
  /* 영업이익(억원) = 판매량(만 개) × (단가 − 변동비)(천원) ÷ 10 − 고정비 */
  const MC = { Q: [80, 100, 112], P: [9.0, 10.0, 10.6], V: [5.6, 6.0, 6.8], FC: [25, 27, 30], plan: 13 };
  const op = (Q, P, V, FC) => Q * (P - V) / 10 - FC;
  function mcRun(rho, n, seed, M) {
    M = M || MC; const r = S.rng(seed || 2026), out = [], c = Math.sqrt(1 - rho * rho);
    for (let i = 0; i < n; i++) {
      const z1 = r.normal(), z2 = rho * z1 + c * r.normal();
      const Q = S.triInv(S.normCdf(z1), M.Q[0], M.Q[1], M.Q[2]), P = S.triInv(S.normCdf(z2), M.P[0], M.P[1], M.P[2]);
      const V = S.triInv(r.u(), M.V[0], M.V[1], M.V[2]), FC = S.triInv(r.u(), M.FC[0], M.FC[1], M.FC[2]);
      out.push(op(Q, P, V, FC));
    }
    const sorted = out.slice().sort((a, b) => a - b), pct = (p) => q(sorted, p);
    return { v: out, mean: mean(out), sd: sd(out), p10: pct(0.1), p50: pct(0.5), p90: pct(0.9), pBelow: out.filter((x) => x < M.plan).length / n, pLoss: out.filter((x) => x < 0).length / n, base: op(M.Q[1], M.P[1], M.V[1], M.FC[1]) };
  }
  /* 토네이도: 한 입력만 10·90 백분위로 바꾸고 나머지는 최빈값 */
  function tornado(M) {
    M = M || MC; const base = { Q: M.Q[1], P: M.P[1], V: M.V[1], FC: M.FC[1] }, f = (o) => op(o.Q, o.P, o.V, o.FC), b0 = f(base);
    const nm = { Q: "판매량", P: "단가", V: "변동비", FC: "고정비" };
    return Object.keys(nm).map((k) => {
      const lo = Object.assign({}, base), hi = Object.assign({}, base);
      lo[k] = S.triInv(0.1, M[k][0], M[k][1], M[k][2]); hi[k] = S.triInv(0.9, M[k][0], M[k][1], M[k][2]);
      const a = f(lo) - b0, b = f(hi) - b0;
      return { key: k, name: nm[k], lo: Math.min(a, b), hi: Math.max(a, b), swing: Math.abs(b - a), inLo: lo[k], inHi: hi[k] };
    }).sort((x, y) => y.swing - x.swing).concat([]).map((d) => Object.assign(d, { base: b0 }));
  }

  /* 베타-이항 갱신: 사전 평균 m0, 사전 강도 s(가상 표본 수) + 견적 n건 중 수주 k건 */
  const betaPdf = (x, a, b) => (x <= 0 || x >= 1 ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (S.lgamma(a) + S.lgamma(b) - S.lgamma(a + b))));
  function betaInv(p, a, b) { let lo = 0, hi = 1; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (S.ibeta(m, a, b) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  function bayes(m0, s, n, k, cred) {
    const a0 = m0 * s, b0 = (1 - m0) * s, a = a0 + k, b = b0 + n - k, c = cred || 0.9;
    const z = S.normInv(1 - (1 - c) / 2), ph = n ? k / n : NaN;
    /* 윌슨 구간: 표본 비율만 쓸 때의 비교 기준 */
    const den = 1 + z * z / n, ctr = (ph + z * z / (2 * n)) / den, hw = n ? z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / den : NaN;
    return { a0: a0, b0: b0, a: a, b: b, priorMean: a0 / (a0 + b0), postMean: a / (a + b), lo: betaInv((1 - c) / 2, a, b), hi: betaInv(1 - (1 - c) / 2, a, b),
      raw: ph, wLo: ctr - hw, wHi: ctr + hw, priorLo: betaInv((1 - c) / 2, a0, b0), priorHi: betaInv(1 - (1 - c) / 2, a0, b0) };
  }

  /* 부트스트랩: 설비 수리 건당 비용 15건(백만원, 가상) */
  function repairs() { const r = S.rng(9157), a = []; for (let i = 0; i < 15; i++) a.push(+Math.exp(Math.log(9) + 0.75 * r.normal()).toFixed(1)); return a; }
  function bootstrap(a, stat, B, seed) {
    const r = S.rng(seed || 31), n = a.length, v = [];
    for (let k = 0; k < B; k++) { const s = []; for (let i = 0; i < n; i++) s.push(a[Math.floor(r.u() * n)]); v.push(stat(s)); }
    const sorted = v.slice().sort((x, y) => x - y);
    return { v: v, est: stat(a), lo: q(sorted, 0.025), hi: q(sorted, 0.975), se: sd(v) };
  }

  /* 집중도: 거래처 40곳 연매출(억원, 가상) */
  function customers() {
    const r = S.rng(1213), a = [];
    for (let i = 0; i < 40; i++) a.push(+(Math.exp(Math.log(3.2) + 1.05 * r.normal())).toFixed(1));
    return a.sort((x, y) => y - x);
  }
  function concentration(a) {
    const s = a.slice().sort((x, y) => y - x), t = sum(s); let c = 0;
    const rows = s.map((v, i) => { c += v; const cum = c / t; return { rank: i + 1, v: v, share: v / t, cum: cum }; });
    /* ABC: 누적 80%까지 A, 95%까지 B, 나머지 C(경계를 넘는 첫 항목까지 포함) */
    let prev = 0; rows.forEach((r) => { r.cls = prev < 0.8 ? "A" : prev < 0.95 ? "B" : "C"; prev = r.cum; });
    return { rows: rows, total: t, gini: S.gini(s), hhi: S.hhi(s) * 10000, top20: S.topShare(s, 0.2), lorenz: S.lorenz(s),
      nA: rows.filter((r) => r.cls === "A").length, nB: rows.filter((r) => r.cls === "B").length, nC: rows.filter((r) => r.cls === "C").length };
  }

  /* k-평균 군집: 거래처 60곳의 매출 성장률(%)과 영업이익률(%)(가상, 세 무리를 심어 둠) */
  function accounts() {
    const r = S.rng(1517), g = [[[2, 3], [18, 3]], [[14, 4], [9, 2.5]], [[-6, 3.5], [6, 2.5]]], pts = [];
    [22, 20, 18].forEach((m, j) => { for (let i = 0; i < m; i++) pts.push([+(g[j][0][0] + g[j][0][1] * r.normal()).toFixed(1), +(g[j][1][0] + g[j][1][1] * r.normal()).toFixed(1)]); });
    return pts;
  }
  function standardize(pts) {
    const d = pts[0].length, mu = [], s = [];
    for (let j = 0; j < d; j++) { const c = pts.map((p) => p[j]); mu.push(mean(c)); s.push(sd(c)); }
    return { z: pts.map((p) => p.map((v, j) => (v - mu[j]) / s[j])), mu: mu, s: s };
  }
  const d2 = (a, b) => { let s = 0; for (let j = 0; j < a.length; j++) s += (a[j] - b[j]) * (a[j] - b[j]); return s; };
  function kmeansOnce(X, k, r) {
    const C = [X[Math.floor(r.u() * X.length)].slice()];
    while (C.length < k) { /* k-means++: 가까운 중심까지 거리제곱에 비례해 다음 중심 */
      const w = X.map((x) => Math.min.apply(null, C.map((c) => d2(x, c)))), t = sum(w); let u = r.u() * t, i = 0;
      while (i < X.length - 1 && u > w[i]) { u -= w[i]; i++; } C.push(X[i].slice());
    }
    let lab = new Array(X.length).fill(-1);
    for (let it = 0; it < 100; it++) {
      let moved = false;
      X.forEach((x, i) => { let bj = 0, bd = Infinity; C.forEach((c, j) => { const v = d2(x, c); if (v < bd) { bd = v; bj = j; } }); if (lab[i] !== bj) { lab[i] = bj; moved = true; } });
      C.forEach((c, j) => { const m = X.filter((_, i) => lab[i] === j); if (m.length) for (let d = 0; d < c.length; d++) c[d] = mean(m.map((x) => x[d])); });
      if (!moved) break;
    }
    const inertia = sum(X.map((x, i) => d2(x, C[lab[i]])));
    return { labels: lab, centers: C, inertia: inertia };
  }
  function kmeans(pts, k, seed, restarts) {
    const st = standardize(pts), r = S.rng(seed || 7); let best = null;
    for (let t = 0; t < (restarts || 10); t++) { const m = kmeansOnce(st.z, k, r); if (!best || m.inertia < best.inertia - 1e-9) best = m; }
    /* 군집 번호를 이익률 높은 순으로 정렬해 색이 k와 무관하게 안정되게 */
    const raw = best.centers.map((c) => c.map((v, j) => v * st.s[j] + st.mu[j])), order = raw.map((c, j) => j).sort((a, b) => raw[b][1] - raw[a][1]), inv = [];
    order.forEach((j, i) => { inv[j] = i; });
    return { labels: best.labels.map((l) => inv[l]), centers: order.map((j) => raw[j]), zc: order.map((j) => best.centers[j]), inertia: best.inertia, z: st.z,
      sizes: order.map((j) => best.labels.filter((l) => l === j).length) };
  }

  /* 평균으로의 회귀: 팀의 실력은 그대로인데 해마다 운이 섞인 평가 점수(가상) */
  function rttm(n, seed, sA, sE) {
    const r = S.rng(seed || 4040), y1 = [], y2 = []; sA = sA || 4; sE = sE || 4;
    for (let i = 0; i < n; i++) { const a = 80 + sA * r.normal(); y1.push(a + sE * r.normal()); y2.push(a + sE * r.normal()); }
    const idx = y1.map((_, i) => i).sort((a, b) => y1[a] - y1[b]), k = Math.round(n / 4), bot = idx.slice(0, k), top = idx.slice(n - k);
    const chg = (g) => mean(g.map((i) => y2[i] - y1[i]));
    return { y1: y1, y2: y2, bot: bot, top: top, botChg: chg(bot), topChg: chg(top), slope: S.linreg(y1, y2).b, reliability: sA * sA / (sA * sA + sE * sE) };
  }

  return { receivables, box, meanCI, ciDraws, sampleSize, lots, compare, pBySize, familywise, ANSCOMBE, summary2, power, regBands, SIMPSON, simpson,
    SEASON, sales, decompose, material, holt, holtFit, holtSimVar, MC, op, mcRun, tornado, betaPdf, betaInv, bayes, repairs, bootstrap,
    customers, concentration, accounts, standardize, kmeans, rttm };
});

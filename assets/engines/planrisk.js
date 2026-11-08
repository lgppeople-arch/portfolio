/* 사업계획 달성 확률(Earnings-at-Risk) 엔진: 영업이익을 만드는 동인(판매량·단가·환율·원재료·가공비·고정비)이
   함께 흔들릴 때 영업이익이 어떤 분포를 갖는지 몬테카를로로 계산한다. 금액은 억원.
   - 동인 = 계획값 × exp(σZ − σ²/2): 로그정규라 음수가 없고 평균이 계획값과 같다
   - 동인끼리의 상관은 상관행렬의 촐레스키 분해 L로 Z = L·ε (ε는 독립 표준정규)
   - 판매단가 = 단가 충격 + 전가율 × (원재료 단가 − 계획 원재료 단가): 원재료 상승분의 일부를 판가로 넘긴다
   - 영업이익 = 판매량 × (판매단가 − 원재료 단가) × 환율 − 판매량 × 변동가공비 − 고정비
   - 변동 기여도: 영업이익을 Z에 선형회귀한 근사 Σbᵢzᵢ의 분산을 오일러 방식으로 나눈다(상관 반영, 합계 100%) */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api;
  else root.PlanRiskEngine = api;
})(typeof self !== "undefined" ? self : this, function (Stats) {
  "use strict";

  const KEYS = ["q", "p", "fx", "m", "cv", "fc"];
  const DEFAULTS = {
    year: 2027,
    drivers: {
      q: { label: "판매량", unit: "만 개", plan: 1200, sd: 8 },
      p: { label: "판매단가", unit: "달러/개", plan: 6.5, sd: 3 },
      fx: { label: "원/달러 환율", unit: "원", plan: 1380, sd: 6 },
      m: { label: "원재료 단가", unit: "달러/개", plan: 2.4, sd: 12 },
      cv: { label: "변동가공비", unit: "원/개", plan: 1100, sd: 4 },
      fc: { label: "고정비", unit: "억원", plan: 420, sd: 3 }
    },
    /* 상관행렬(KEYS 순서). 업황이 좋으면 판매량·단가·원재료가 함께 오르고, 원화 약세 국면에는 원자재가 약한 경향 */
    corr: [
      [1, 0.4, 0, 0.2, 0, 0],
      [0.4, 1, 0, 0, 0, 0],
      [0, 0, 1, -0.3, 0, 0],
      [0.2, 0, -0.3, 1, 0.1, 0],
      [0, 0, 0, 0.1, 1, 0.3],
      [0, 0, 0, 0, 0.3, 1]
    ],
    passThrough: 30,      /* 원재료 단가 변화의 판가 전가율 % */
    target: null          /* 비우면 계획 영업이익 */
  };
  const SIM = { n: 5000, seed: 2027 };

  /* 동인 값으로 손익 계산 */
  function pnl(v, x) {
    const d = x.drivers, price = v.p + x.passThrough / 100 * (v.m - d.m.plan);
    const rev = v.q * 1e4 * price * v.fx / 1e8, mat = v.q * 1e4 * v.m * v.fx / 1e8, conv = v.q * 1e4 * v.cv / 1e8;
    const op = rev - mat - conv - v.fc;
    return { price: price, rev: rev, mat: mat, conv: conv, fc: v.fc, op: op, opm: rev ? op / rev : NaN };
  }
  const planVals = (x) => { const o = {}; KEYS.forEach((k) => { o[k] = x.drivers[k].plan; }); return o; };
  const planPnl = (x) => pnl(planVals(x), x);
  const targetOf = (x) => (x.target === null || x.target === undefined || !isFinite(x.target) ? planPnl(x).op : x.target);

  /* 계획에서의 단위 민감도(해석적): 다른 동인은 계획값 */
  function unitSens(x) {
    const b = planPnl(x), shift = (k, f) => { const v = planVals(x); v[k] = f(v[k]); return pnl(v, x).op - b.op; };
    return [
      { key: "q", label: "판매량 1% 증가", v: shift("q", (a) => a * 1.01) },
      { key: "p", label: "판매단가 1% 상승", v: shift("p", (a) => a * 1.01) },
      { key: "fx", label: "환율 10원 상승(원화 약세)", v: shift("fx", (a) => a + 10) },
      { key: "m", label: "원재료 단가 1% 상승(전가 후)", v: shift("m", (a) => a * 1.01) },
      { key: "cv", label: "변동가공비 1% 상승", v: shift("cv", (a) => a * 1.01) },
      { key: "fc", label: "고정비 1% 상승", v: shift("fc", (a) => a * 1.01) }
    ];
  }

  /* 한 동인만 ±1σ(로그정규의 16·84 백분위)로 움직일 때 — 상관을 무시하는 토네이도 */
  function tornado(x) {
    const b = planPnl(x).op;
    return KEYS.map((k) => {
      const s = x.drivers[k].sd / 100, at = (z) => { const v = planVals(x); v[k] = v[k] * Math.exp(s * z - s * s / 2); return pnl(v, x).op - b; };
      const lo = at(-1), hi = at(1);
      return { key: k, label: x.drivers[k].label, lo: lo, hi: hi, range: Math.abs(hi - lo) };
    }).sort((a, c) => c.range - a.range);
  }

  function simulate(x, o) {
    o = Object.assign({}, SIM, o || {});
    const L = Stats.cholesky(x.corr);
    if (!L) return { ok: false, reason: "상관행렬이 양의 정부호가 아닙니다. 상관계수 조합이 서로 모순됩니다(예: A와 B, B와 C는 강한 양의 상관인데 A와 C는 강한 음의 상관)." };
    const r = Stats.rng(o.seed), n = o.n, K = KEYS.length, sig = KEYS.map((k) => x.drivers[k].sd / 100);
    const ops = new Array(n), revs = new Array(n), Zs = new Array(n);
    for (let i = 0; i < n; i++) {
      const e = KEYS.map(() => r.normal()), z = L.map((row) => row.reduce((s, l, j) => s + l * e[j], 0)), v = {};
      KEYS.forEach((k, j) => { v[k] = x.drivers[k].plan * Math.exp(sig[j] * z[j] - sig[j] * sig[j] / 2); });
      const p = pnl(v, x);
      ops[i] = p.op; revs[i] = p.rev; Zs[i] = z;
    }
    const plan = planPnl(x), target = targetOf(x), sorted = ops.slice().sort((a, b) => a - b);
    const q = (p) => Stats.quantile(sorted, p), cnt = (f) => ops.filter(f).length;
    const pAch = cnt((v) => v >= target) / n, pLoss = cnt((v) => v < 0) / n, p5 = q(0.05);
    const tail = sorted.slice(0, Math.max(1, Math.floor(n * 0.05)));
    /* 오일러 기여도: OP ≈ a + Σ bᵢ zᵢ, 기여ᵢ = bᵢ·Cov(zᵢ, Σbⱼzⱼ) / Var(Σbⱼzⱼ) */
    const reg = Stats.mlr(Zs, ops), bz = reg.b.slice(1);
    const lin = Zs.map((z) => z.reduce((s, v, j) => s + bz[j] * v, 0)), vl = Stats.variance(lin), ml = Stats.mean(lin);
    const contrib = KEYS.map((k, j) => {
      const zj = Zs.map((z) => z[j]), mz = Stats.mean(zj);
      let c = 0; for (let i = 0; i < n; i++) c += (zj[i] - mz) * (lin[i] - ml);
      return { key: k, label: x.drivers[k].label, b: bz[j], share: bz[j] * c / (n - 1) / vl };
    });
    /* 실제로 뽑힌 상관 */
    const realized = KEYS.map((_, a) => KEYS.map((__, b) => (a === b ? 1 : Stats.corr(Zs.map((z) => z[a]), Zs.map((z) => z[b])))));
    const pct = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((p) => ({ p: p, op: q(p), achieve: 1 - p }));
    return {
      ok: true, n: n, seed: o.seed, ops: ops, sorted: sorted, plan: plan, target: target,
      mean: Stats.mean(ops), sd: Stats.sd(ops), p5: p5, p50: q(0.5), p95: q(0.95), cvar5: Stats.mean(tail),
      pAch: pAch, seAch: Math.sqrt(pAch * (1 - pAch) / n), pLoss: pLoss, ear: plan.op - p5, revMean: Stats.mean(revs),
      planPct: cnt((v) => v < plan.op) / n, contrib: contrib, r2: reg.r2, realized: realized, pct: pct,
      skew: Stats.skew(ops), hist: Stats.histogram(ops, 36)
    };
  }

  /* 목표 영업이익별 달성 확률(초과확률 곡선) */
  function exceed(sorted, lo, hi, steps) {
    const n = sorted.length, out = [];
    for (let i = 0; i <= steps; i++) {
      const t = lo + (hi - lo) * i / steps;
      let a = 0, b = n; while (a < b) { const m = (a + b) >> 1; if (sorted[m] < t) a = m + 1; else b = m; }
      out.push({ t: t, p: (n - a) / n });
    }
    return out;
  }

  return { KEYS, DEFAULTS, SIM, pnl, planVals, planPnl, targetOf, unitSens, tornado, simulate, exceed };
});

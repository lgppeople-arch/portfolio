/* 반도체(메모리형) 사이클 개념 모형: 분기 단위로 수요·생산능력·재고·가격·설비투자를 함께 굴린다.
   - 수요는 추세 성장에 일시적 충격을 더한다. 생산능력은 투자 결정 후 lead 분기 뒤에 늘어난다.
   - 가격은 원가 하락 추세(정상 가격)를 따르되, 직전 분기 재고 주수가 정상보다 많으면 그만큼 낮고 적으면 높다.
   - 투자는 lead 분기 뒤의 목표 생산능력(추세 × (1 + 반응 × (매출총이익률 − 기준 이익률)))에서
     지금 생산능력과 이미 발주해 둔 물량을 뺀 만큼만 한다(음수면 0).
   - 회계: 가중평균 원가, 저가법(순실현가능가치) 재고평가손실과 환입, 정상조업도 기준 고정비 배부(저조업 비용은 당기 비용).
   금액은 시작 분기 매출 = 100 기준. 실제 시장 예측이 아니라 구조를 보여 주는 개념 모형이다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CycleEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULTS = {
    quarters: 32,
    growth: 20,      /* 수요(비트) 연 증가율 % */
    costdown: 18,    /* 단위원가 연 하락률 % */
    lead: 5,         /* 투자 결정 → 생산능력 반영까지 분기 */
    react: 2,        /* 투자 반응 강도 0~3 */
    shock: 10,       /* 수요 충격 % (음수면 급감) */
    shockAt: 2,      /* 충격 시작 분기(0부터) */
    shockLen: 4,     /* 충격 지속 분기 */
    cut: false,      /* 재고가 쌓이면 가동률을 낮춘다 */
    target: 35       /* 투자 판단 기준 매출총이익률 % */
  };
  const BETA = [0, 0.25, 0.5, 0.8];   /* 이익률이 기준보다 1%p 높을 때 목표 생산능력을 추세보다 몇 % 늘리나(÷100) */
  const C = { wStar: 6, kappa: 0.7, soft: 1, c0: 25, phi: 0.4, depUnit: 30, life: 20, maxOrder: 0.15, minOrder: 0.3, cutSlope: 0.6, uMin: 0.7 };

  function run(x) {
    const T = x.quarters, gq = Math.pow(1 + x.growth / 100, 0.25) - 1, rho = Math.pow(1 - x.costdown / 100, 0.25);
    const L = Math.max(1, Math.round(x.lead)), beta = BETA[Math.max(0, Math.min(3, Math.round(x.react)))], mStar = x.target / 100;
    const wq = C.wStar / 13; /* 정상 재고 = 분기 수요의 몇 배 */

    /* ---- 정상 상태(충격 없음)에서 시작하도록 과거를 채운다 ---- */
    const K0 = 100;
    /* 과거 설비투자 단가 kc0: 시작 시점 단위당 감가상각이 C.depUnit이 되게 정한다 */
    let s = 0;
    for (let j = 0; j < C.life; j++) s += Math.pow(rho, -(j + L)) * Math.pow(1 + gq, -(j + 1)) * gq / C.life;
    const kc0 = C.depUnit / s;
    const K = (t) => K0 * Math.pow(1 + gq, t);                 /* 과거 생산능력 */
    const histCapex = (t) => kc0 * Math.pow(rho, t) * K(t + L - 1) * gq; /* t분기에 결정·지출한 투자 (t<0) */
    const D0 = K0 / (1 + wq * gq / (1 + gq));
    const i0 = wq * D0 / K0;                                    /* 기초 재고 ÷ 생산능력 */
    const uc0 = C.c0 + C.phi * C.c0 + C.depUnit;
    const avg0 = uc0 * (1 + gq) / (1 + gq + i0 - i0 / rho);   /* 정상 상태의 가중평균 원가 */
    const P0 = avg0 / (1 - mStar);
    const scale = 100 / (P0 * D0);                              /* 시작 분기 매출 = 100 */

    /* 기록: 투자 지출(결정 분기 기준)과 도착 분기 */
    const capexAt = {}, orders = {};
    for (let t = -(C.life + L + 2); t < 0; t++) { capexAt[t] = histCapex(t); orders[t] = K(t + L) - K(t + L - 1); }
    const depAt = (t) => { let d = 0; for (let a = t - C.life + 1; a <= t; a++) { const o = a - L; d += (capexAt[o] || 0) / C.life; } return d; };

    let cap = K0, inv = i0 * K0 / (1 + gq), invCost = avg0 / rho * inv, allow = 0, price = P0, wPrev = C.wStar;
    const qs = [];
    for (let t = 0; t < T; t++) {
      if (t > 0) cap += orders[t - L] || 0;
      const shock = t >= x.shockAt && t < x.shockAt + x.shockLen ? x.shock / 100 : 0;
      const dem = D0 * Math.pow(1 + gq, t) * (1 + shock);
      /* 재고가 아무리 쌓여도 가격이 무한정 빠지지는 않도록 tanh로 반응을 묶는다: 정상 가격의 약 0.5배 ~ 1.7배 */
      price = P0 * Math.pow(rho, t) * Math.exp(-C.kappa * Math.tanh((wPrev - C.wStar) / C.wStar / C.soft));
      const u = x.cut ? Math.max(C.uMin, Math.min(1, 1 - C.cutSlope * Math.max(0, (wPrev - C.wStar) / C.wStar))) : 1;
      const q = cap * u;
      const c = C.c0 * Math.pow(rho, t), fixed = C.phi * c * cap, dep = depAt(t);
      const uc = c + (fixed + dep) / cap;                       /* 정상조업도 기준 단위원가 */
      const idle = (fixed + dep) * (1 - u);                      /* 저조업 비용: 재고로 넘기지 않고 당기 비용 */
      const sales = Math.min(dem, inv + q);
      const avg = (invCost + uc * q) / (inv + q);
      const cogs = avg * sales;
      const invEnd = inv + q - sales, invCostEnd = avg * invEnd;
      const allowEnd = Math.max(0, avg - price) * invEnd;        /* 순실현가능가치(≈ 현재 가격) 밑으로 내려간 만큼 */
      const wd = allowEnd - allow;                               /* +평가손실, −환입 */
      const rev = price * sales;
      const gp = rev - cogs - wd - idle;
      const cashCost = c * q + fixed;
      const cfo = rev - cashCost;
      const m = gp / rev;
      let pipe = 0;
      for (let k = t - L + 1; k <= t - 1; k++) pipe += orders[k] || 0;
      const want = K(t + L) * Math.max(0.5, 1 + beta * (m - mStar));
      /* 불황에도 공정 전환·유지 투자는 이어진다: 추세 증설의 30%를 하한으로 둔다 */
      const ord = Math.max(cap * gq * C.minOrder, Math.min(cap * C.maxOrder, want - cap - pipe));
      orders[t] = ord;
      const capex = ord * kc0 * Math.pow(rho, t);
      capexAt[t] = capex;
      const w = invEnd / dem * 13;
      const trend = P0 * Math.pow(rho, t);
      qs.push({
        t: t, year: Math.floor(t / 4) + 1, qtr: (t % 4) + 1,
        demand: dem, cap: cap, util: u, prod: q, sales: sales, short: dem - sales,
        price: price, priceIdx: price / trend * 100, costIdx: avg / trend * 100, ucIdx: uc / trend * 100,
        weeks: w, rev: rev * scale, cogs: cogs * scale, wd: wd * scale, idle: idle * scale, gp: gp * scale, gpm: m,
        dep: dep * scale, capex: capex * scale, cfo: cfo * scale, fcf: (cfo - capex) * scale,
        inv: invEnd, invCost: invCostEnd * scale, allow: allowEnd * scale, order: ord,
        check: { units: (inv + q - sales) - invEnd, gp: (rev - (c * q + fixed + dep) + (invCostEnd - invCost) - wd) - gp }
      });
      inv = invEnd; invCost = invCostEnd; allow = allowEnd; wPrev = w;
    }
    const gpms = qs.map((q) => q.gpm);
    const sum = (k) => qs.reduce((a, q) => a + q[k], 0);
    return {
      quarters: qs, lead: L, beta: beta, P0: P0, D0: D0,
      summary: {
        gpmMax: Math.max.apply(null, gpms), gpmMin: Math.min.apply(null, gpms),
        lossQ: qs.filter((q) => q.gp < 0).length,
        wdMax: Math.max.apply(null, qs.map((q) => q.wd / q.rev)),
        weeksMax: Math.max.apply(null, qs.map((q) => q.weeks)),
        cumFcf: sum("fcf"), cumCfo: sum("cfo"), cumCapex: sum("capex"), cumGp: sum("gp"), cumWd: sum("wd"), cumIdle: sum("idle"),
        revSwing: Math.max.apply(null, qs.map((q) => q.rev)) / Math.min.apply(null, qs.map((q) => q.rev)),
        capexSwing: Math.max.apply(null, qs.map((q) => q.capex)) / Math.min.apply(null, qs.map((q) => q.capex))
      }
    };
  }

  return { DEFAULTS: DEFAULTS, BETA: BETA, CONST: C, run: run };
});

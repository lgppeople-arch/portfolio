/* 해외 장비사 5곳 비교: 계산 엔진. 자료는 assets/data/equip-cos.js(회사 보고 통화 백만 단위).
   회계연도가 회사마다 다르다: ASML 12월, Applied Materials 10월 말, Lam·KLA 6월 말, Tokyo Electron 3월. 비율 비교는 각 회사의 최근 회계연도끼리 한다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.EquipCosEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const pct = (a, b) => (a === null || a === undefined || !b ? null : a / b * 100);
  /* 연도별 비율 */
  function ratios(y) {
    return { fy: y.fy, gpm: pct(y.gp, y.rev), opm: pct(y.op, y.rev), npm: pct(y.ni, y.rev), rd: pct(y.rd, y.rev), ocf: pct(y.ocf, y.rev), capex: pct(y.capex, y.rev),
      fcf: y.ocf !== null && y.ocf !== undefined && y.capex !== null && y.capex !== undefined ? y.ocf - y.capex : null,
      payout: y.buyback !== undefined && y.div !== undefined && y.ocf ? (y.buyback + y.div) / y.ocf * 100 : null };
  }
  /* 연평균 성장률(%) */
  function cagr(a, b, n) { return a > 0 && b > 0 && n > 0 ? (Math.pow(b / a, 1 / n) - 1) * 100 : null; }
  /* 최근 회계연도의 달러 환산 계수. ASML은 같은 해, TEL(3월 결산)은 회계연도가 대부분 걸치는 앞 해의 연평균 환율로 근사 */
  function usdRate(co, fx) {
    if (co.cur === "USD") return 1;
    const y = co.years[co.years.length - 1].fy, yy = co.id === "TEL" ? y - 1 : y, t = fx[co.cur][yy];
    if (!t) return null;
    return co.cur === "EUR" ? t : 1 / t;
  }
  function share(map, key) { if (!map) return null; const tot = Object.keys(map).reduce((a, k) => a + map[k], 0); return tot ? map[key] / tot * 100 : null; }
  function analyze(D) {
    return D.cos.map((co) => {
      const ys = co.years, last = ys[ys.length - 1], prev = ys[ys.length - 2], first = ys[0], R = ys.map(ratios);
      const geoYears = Object.keys(co.geo).sort(), gLast = co.geo[geoYears[geoYears.length - 1]];
      const svcYears = Object.keys(co.svc).sort(), svcLast = co.svc[svcYears[svcYears.length - 1]], svcRev = ys.find((y) => String(y.fy) === svcYears[svcYears.length - 1]);
      const yoy = ys.slice(1).map((y, i) => (y.rev / ys[i].rev - 1) * 100), mean = yoy.reduce((a, b) => a + b, 0) / yoy.length;
      const opms = R.map((r) => r.opm), rate = usdRate(co, D.fx);
      return {
        id: co.id, name: co.name, cur: co.cur, fy: last.fy, end: last.end, rev: last.rev, revUsd: rate ? last.rev * rate : null,
        growth: (last.rev / prev.rev - 1) * 100, cagr: cagr(first.rev, last.rev, ys.length - 1), cagrYears: [first.fy, last.fy],
        last: R[R.length - 1], series: R,
        china: share(gLast, "China"), chinaSeries: geoYears.map((y) => ({ y: +y, v: share(co.geo[y], "China") })),
        svc: svcRev ? svcLast / svcRev.rev * 100 : null, svcSeries: svcYears.map((y) => { const r = ys.find((q) => String(q.fy) === y); return { y: +y, v: r ? co.svc[y] / r.rev * 100 : null }; }).filter((q) => q.v !== null),
        vol: Math.sqrt(yoy.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (yoy.length - 1)), drawdown: Math.min.apply(null, yoy.concat([0])),
        opmRange: [Math.min.apply(null, opms), Math.max.apply(null, opms)]
      };
    });
  }
  return { ratios, cagr, usdRate, share, analyze };
});

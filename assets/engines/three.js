/* 세 재무제표 연결 모형: 손익계산서·재무상태표·현금흐름표를 동인(성장률, 마진, 회전일수, 투자, 배당)으로 함께 굴린다.
   현금이 최소 보유현금 밑으로 내려가면 차입하고, 남으면 차입금부터 갚는다. 금액은 억원, 가상의 제조사. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../fin.js") : root.Fin);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ThreeEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin) {
  "use strict";

  const DEFAULTS = {
    years: 5, base: 2025,
    open: { rev: 1200, cash: 150, ar: 200, inv: 160, ppe: 900, ap: 110, debt: 400 },
    d: { growth: 8, cogs: 62, sga: 14, dep: 9, capex: 9, dso: 62, dio: 75, dpo: 48, rate: 4.8, tax: 24.2, payout: 30, minCash: 120 }
  };

  function run(x) {
    const o = x.open, d = x.d, t = d.tax / 100;
    const eq0 = o.cash + o.ar + o.inv + o.ppe - o.ap - o.debt;
    let prev = { rev: o.rev, cash: o.cash, ar: o.ar, inv: o.inv, ppe: o.ppe, ap: o.ap, debt: o.debt, eq: eq0 };
    const ys = [];
    for (let i = 1; i <= x.years; i++) {
      const rev = prev.rev * (1 + d.growth / 100);
      const cogs = rev * d.cogs / 100, sga = rev * d.sga / 100, dep = prev.ppe * d.dep / 100;
      const gp = rev - cogs, ebit = gp - sga - dep, ebitda = ebit + dep;
      const interest = prev.debt * d.rate / 100;
      const ebt = ebit - interest, tax = Math.max(ebt, 0) * t, ni = ebt - tax;
      const div = Math.max(ni, 0) * d.payout / 100;
      const ar = rev * d.dso / 365, inv = cogs * d.dio / 365, ap = cogs * d.dpo / 365;
      const capex = rev * d.capex / 100, ppe = prev.ppe + capex - dep;
      const dAR = ar - prev.ar, dINV = inv - prev.inv, dAP = ap - prev.ap;
      const cfo = ni + dep - dAR - dINV + dAP, cfi = -capex;
      const pre = prev.cash + cfo + cfi - div;
      const draw = Math.max(d.minCash - pre, 0);
      const repay = draw > 0 ? 0 : Math.min(prev.debt, Math.max(pre - d.minCash, 0));
      const cff = -div + draw - repay;
      const cash = prev.cash + cfo + cfi + cff;
      const debt = prev.debt + draw - repay;
      const eq = prev.eq + ni - div;
      const assets = cash + ar + inv + ppe, liab = ap + debt;
      const avgEq = (prev.eq + eq) / 2, avgAssets = (prev.cash + prev.ar + prev.inv + prev.ppe + assets) / 2;
      const ic = ar + inv - ap + ppe, icPrev = prev.ar + prev.inv - prev.ap + prev.ppe;
      ys.push({
        year: x.base + i,
        is: { rev: rev, cogs: cogs, gp: gp, sga: sga, dep: dep, ebit: ebit, ebitda: ebitda, interest: interest, ebt: ebt, tax: tax, ni: ni },
        bs: { cash: cash, ar: ar, inv: inv, ppe: ppe, assets: assets, ap: ap, debt: debt, liab: liab, eq: eq },
        cf: { ni: ni, dep: dep, dAR: -dAR, dINV: -dINV, dAP: dAP, cfo: cfo, capex: -capex, cfi: cfi, div: -div, draw: draw, repay: -repay, cff: cff, net: cfo + cfi + cff },
        r: {
          growth: rev / prev.rev - 1, gpm: gp / rev, ebitm: ebit / rev, nim: ni / rev,
          roe: ni / avgEq, margin: ni / rev, turnover: rev / avgAssets, leverage: avgAssets / avgEq,
          roic: ebit * (1 - t) / ((ic + icPrev) / 2),
          cashConv: ni !== 0 ? cfo / ni : null, ccc: d.dso + d.dio - d.dpo,
          capexDep: dep ? capex / dep : null, ndEbitda: (debt - cash) / ebitda, icr: interest ? ebit / interest : null
        },
        check: { balance: assets - liab - eq, cashTie: (prev.cash + cfo + cfi + cff) - cash, reTie: (prev.eq + ni - div) - eq }
      });
      prev = { rev: rev, cash: cash, ar: ar, inv: inv, ppe: ppe, ap: ap, debt: debt, eq: eq };
    }
    return { eq0: eq0, years: ys };
  }

  return { DEFAULTS, run };
});

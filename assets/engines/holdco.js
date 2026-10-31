/* 지주사 포트폴리오 가치 엔진: 자회사별 지분가치를 더한 순자산가치(NAV), 지주사 할인율,
   공정거래법상 지주회사 요건 점검, 자회사 지분 매각 시나리오.
   금액은 억원, 주식 수는 만 주, 주가는 원. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../fin.js") : root.Fin);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HoldcoEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin) {
  "use strict";

  /* 공정거래법 요약 기준 (2021.12.30 시행 개정법) */
  const RULES = {
    minAssets: 5000,          /* 지주회사 자산총액 기준, 억원 */
    minHoldRatio: 0.5,        /* 자회사 주식가액 합계 / 자산총액 */
    maxDebtRatio: 2.0,        /* 부채총계 / 자본총계 */
    listed: { old: 20, now: 30 },
    unlisted: { old: 40, now: 50 }
  };

  const DEFAULTS = {
    holdco: {
      shares: 3000, treasury: 300, price: 21000,
      netDebt: 2400, other: 350,
      royalty: 180, opex: 110, royaltyMult: 8, tax: 24.2,
      assets: 8800, liab: 3300, equity: 5500
    },
    subs: [
      { name: "반도체 부품 A", listed: true, stake: 38.5, mcap: 18000, book: 2100, newRule: false },
      { name: "전자소재 B", listed: true, stake: 32.0, mcap: 6500, book: 900, newRule: true },
      { name: "공정장비 C", listed: false, stake: 71.0, ebitda: 420, mult: 7.0, netDebt: 600, book: 1200, newRule: false },
      { name: "해외 판매법인 D", listed: false, stake: 100, ebitda: 80, mult: 6.0, netDebt: -50, book: 300, newRule: false },
      { name: "신사업 E", listed: false, stake: 55.0, ebitda: 15, mult: 12.0, netDebt: 30, book: 60, newRule: true }
    ],
    sale: { idx: 2, part: 100, premium: 20, repay: true }
  };

  /* 자회사 100% 지분가치: 상장은 시가총액, 비상장은 EV/EBITDA − 순차입금 (음수면 0) */
  function equity100(s) {
    return s.listed ? s.mcap : Math.max(s.ebitda * s.mult - s.netDebt, 0);
  }

  function nav(h, subs) {
    const t = h.tax / 100;
    const parts = subs.map((s) => ({ name: s.name, listed: s.listed, stake: s.stake, eq100: equity100(s), value: equity100(s) * s.stake / 100 }));
    const royaltyValue = (h.royalty - h.opex) * (1 - t) * h.royaltyMult;
    const gross = Fin.sum(parts.map((p) => p.value)) + royaltyValue + h.other;
    const total = gross - h.netDebt;
    const out = h.shares - h.treasury;
    const mcap = h.price * out / 1e4;            /* 만 주 × 원 → 억원 */
    const perShare = total * 1e4 / out;          /* 억원 / 만 주 → 원 */
    return {
      parts: parts, royaltyValue: royaltyValue, other: h.other, netDebt: h.netDebt,
      gross: gross, nav: total, mcap: mcap, perShare: perShare,
      discount: total > 0 ? 1 - mcap / total : null,
      listedShare: Fin.sum(parts.filter((p) => p.listed).map((p) => p.value)) / gross
    };
  }

  function compliance(h, subs) {
    const bookSum = Fin.sum(subs.map((s) => s.book));
    const holdRatio = bookSum / h.assets;
    const debtRatio = h.liab / h.equity;
    const stakes = subs.map((s) => {
      const rule = s.listed ? RULES.listed : RULES.unlisted;
      const need = s.newRule ? rule.now : rule.old;
      return { name: s.name, stake: s.stake, need: need, ok: s.stake >= need, room: s.stake - need, listed: s.listed, newRule: s.newRule };
    });
    return {
      bookSum: bookSum, holdRatio: holdRatio, debtRatio: debtRatio,
      isHoldco: h.assets >= RULES.minAssets && holdRatio >= RULES.minHoldRatio,
      assetsOk: h.assets >= RULES.minAssets,
      ratioOk: holdRatio >= RULES.minHoldRatio,
      debtOk: debtRatio <= RULES.maxDebtRatio,
      stakes: stakes
    };
  }

  /* 자회사 지분 일부·전부 매각. 매각대금에서 양도차익 법인세를 뺀 순현금으로 차입을 갚거나 보유 */
  function sale(h, subs, sc) {
    const s = subs[sc.idx];
    if (!s) return null;
    const f = Fin.clamp(sc.part / 100, 0, 1), t = h.tax / 100;
    const sold = equity100(s) * s.stake / 100 * f;
    const price = sold * (1 + sc.premium / 100);
    const bookSold = s.book * f;
    const gain = price - bookSold;
    const taxPaid = Math.max(gain, 0) * t;
    const cash = price - taxPaid;
    const repay = sc.repay ? Math.min(cash, Math.max(h.netDebt, 0)) : 0;

    const h2 = Object.assign({}, h, {
      netDebt: h.netDebt - cash,
      assets: h.assets - bookSold + cash - repay,
      liab: h.liab - repay,
      equity: h.equity + gain - taxPaid
    });
    const subs2 = subs.map((x, i) => (i === sc.idx ? Object.assign({}, x, { stake: x.stake * (1 - f), book: x.book * (1 - f) }) : x))
      .filter((x, i) => !(i === sc.idx && f >= 1));
    const before = nav(h, subs), after = nav(h2, subs2);
    return {
      name: s.name, part: f, sold: sold, price: price, bookSold: bookSold, gain: gain, tax: taxPaid, cash: cash, repay: repay,
      before: before, after: after, h2: h2, subs2: subs2,
      cBefore: compliance(h, subs), cAfter: compliance(h2, subs2)
    };
  }

  function analyze(x) {
    return { nav: nav(x.holdco, x.subs), comp: compliance(x.holdco, x.subs), sale: sale(x.holdco, x.subs, x.sale) };
  }

  return { RULES, DEFAULTS, equity100, nav, compliance, sale, analyze };
});

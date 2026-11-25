/* 경영권 거래 후보 스크리닝: 계산. 자료는 assets/data/mna-screen.js(공시 숫자, 원 단위).
   - 지분 확보 비용: 목표 지분까지 사야 할 보통주 수 × 공개매수 가격(현재가 × (1 + 프리미엄)).
     의결권 기준 주식 = 발행주식 − 자기주식(2026년 개정 상법으로 자기주식은 원칙적으로 소각 대상).
   - 목표: "majority" 의결권 50% + 1주, "beat" 최대주주 등 지분 + 여유분(기본 5%p), "full" 전량.
   - 자금: 인수 회사 차입 여력 = EBITDA × 배수 − 대상 회사 기존 순차입. 나머지는 자기자본.
   - 회수: 인수가 기준 EV/EBIT, 지분만큼의 잉여현금흐름으로 인수 금액을 갚는 데 걸리는 해. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.MnaScreen = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function voting(c) { return Math.max(1, (c.issued || 0) - (c.tre || 0)); }
  function groupStake(c) { return c.vote != null ? c.vote : (c.grp || 0); }   // 의결권 기준 최대주주 등 지분
  function targetStake(c, mode, cushion) {
    if (mode === "full") return 1;
    if (mode === "beat") return Math.min(1, groupStake(c) + (cushion == null ? 0.05 : cushion));
    return 0.5 + 1 / voting(c);
  }
  /* 공개매수 비용. o = { prem: 0.3, mode: "majority", cushion: 0.05 } */
  function deal(c, o) {
    o = o || {};
    const prem = o.prem == null ? 0.3 : o.prem, mode = o.mode || "majority", V = voting(c);
    const t = targetStake(c, mode, o.cushion), need = Math.ceil(V * t), px = c.price * (1 + prem), cost = need * px;
    const floatSh = V * (1 - groupStake(c));                         // 최대주주 측을 뺀 응모 가능 주식
    const feasible = need <= floatSh + 1e-6;                          // 최대주주 측이 팔지 않아도 가능한가
    const eqAtPrem = V * px, evAtPrem = eqAtPrem + c.debt - c.cash;
    return { stake: t, shares: need, px: px, cost: cost, floatSh: floatSh, floatPct: floatSh / V, feasible: feasible,
      evAtPrem: evAtPrem, evebitAtPrem: c.op > 0 ? evAtPrem / c.op : null, mcapVote: V * c.price };
  }
  /* 자금 조달: lev = 인수 금융 배수(EBITDA 기준), 대상 회사 기존 순차입을 먼저 뺀다 */
  function funding(c, d, lev) {
    lev = lev == null ? 3 : lev;
    const ebitda = c.op + (c.da || 0), netDebt = c.debt - c.cash;
    const debtCap = Math.max(0, ebitda * lev - Math.max(0, netDebt)) * d.stake;   // 지분만큼 배당·차입 여력을 쓴다고 본다
    const debt = Math.min(d.cost, debtCap), equity = d.cost - debt;
    const fcfShare = (c.ocf != null ? c.ocf - c.capex : 0) * d.stake;
    return { ebitda: ebitda, netDebt: netDebt, debt: debt, equity: equity, debtShare: d.cost > 0 ? debt / d.cost : 0,
      fcfShare: fcfShare, payback: fcfShare > 0 ? d.cost / fcfShare : null, yieldOnCost: d.cost > 0 ? fcfShare / d.cost : null };
  }
  /* 위험·기회 신호: 표시용 문장 목록 [종류, 문장] (종류: "up" 유리, "down" 불리) */
  function signals(c, d) {
    const s = [], g = groupStake(c);
    if (g < 0.2) s.push(["up", "최대주주 측 의결권이 " + pct(g) + "로 낮아 시장 매수만으로도 최대주주를 넘을 수 있습니다."]);
    else if (g < 0.3) s.push(["up", "최대주주 측 의결권 " + pct(g) + ". 공개매수로 넘을 수 있는 범위지만 우호 지분 확보 경쟁이 예상됩니다."]);
    else s.push(["down", "최대주주 측 의결권 " + pct(g) + ". 대주주가 팔지 않으면 과반 확보가 어렵고, 협상 거래(지분 인수)가 현실적입니다."]);
    if (!d.feasible) s.push(["down", "목표 지분이 최대주주 측을 뺀 유통 주식보다 많습니다. 대주주 동의 없이는 불가능합니다."]);
    if ((c.others || []).length) s.push(["down", "최대주주 외 5% 이상 보유자: " + c.others.map((o) => o[0] + " " + o[1].toFixed(1) + "%").join(", ") + ". 이들의 선택이 결과를 가릅니다."]);
    if (c.treR > 0.03) s.push(["up", "자기주식 " + pct(c.treR) + ". 개정 상법상 원칙적으로 소각 대상이라 우호 세력에 넘겨 방어에 쓰기 어려워졌습니다."]);
    if ((c.ta || 0) >= 2e12) s.push(["up", "자산 2조 원 이상: 집중투표 의무화(2026.9.10 시행) 대상이라 소수 지분으로도 이사 선임에 영향을 줄 수 있습니다."]);
    if (c.netcash > 0.3) s.push(["up", "순현금이 시가총액의 " + pct(c.netcash) + ". 인수 뒤 대상 회사 현금으로 인수 비용 일부를 회수할 수 있습니다(배당·감자, 채권자·소수주주 보호 절차 필요)."]);
    if (c.netcash < -0.5) s.push(["down", "순차입이 시가총액의 " + pct(-c.netcash) + ". 인수 금융을 더 얹기 어렵습니다."]);
    if (c.fcfy != null && c.fcfy < 0) s.push(["down", "2025년 잉여현금흐름이 음수(설비투자가 영업현금흐름보다 큼)라 인수 뒤 현금 회수가 늦습니다."]);
    return s;
  }
  function pct(v) { return (Math.round(v * 1000) / 10).toFixed(1) + "%"; }
  /* 업종별 볼트온 표: groups[g].top의 회사들을 점수 순서대로 */
  function bolt(D, g) { const G = D.groups[g]; return G ? G.top.map((k) => Object.assign({ id: k }, D.cos[k])) : []; }
  function candidates(D, n) { return D.A.slice(0, n || 20).map((k) => Object.assign({ id: k }, D.cos[k])); }
  return { voting, groupStake, targetStake, deal, funding, signals, bolt, candidates, pct };
});

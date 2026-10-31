/* 위임전결 기준 점검: 업무 항목마다 결재권자별 금액 한도를 두고, 규정끼리 어긋나는 곳을 찾는다.
   - limits = [팀장, 본부장, 대표이사] 각자 결재할 수 있는 금액의 상한(억원). 0이면 권한 없음. 대표이사 한도를 넘으면 이사회.
   - 이사회 부의 기준(이사회규정) = 자기자본 × 비율. 이 금액 이상은 반드시 이사회로 가야 한다.
   - 법정 이사회 사항: 상법 393조 1항(중요한 자산의 처분·양도, 대규모 재산의 차입), 398조(이사 등과 회사 간 거래, 이사 3분의 2 이상 승인),
     469조(사채 발행은 이사회 결의, 4항: 정관 근거가 있으면 대표이사에게 1년 이내 기간으로 위임 가능).
   법률 자문이 아니라, 규정 정합성을 스스로 점검하기 위한 예시 도구다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DoaEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = ["팀장", "본부장", "대표이사", "이사회"];
  const DEFAULTS = {
    equity: 4000,          /* 자기자본, 억원 */
    boardPct: 5,           /* 이사회규정 부의 기준: 자기자본의 % 이상 */
    delegateBond: false,   /* 정관에 사채 발행 위임 근거(상법 469조 4항)가 있는가 */
    items: [
      { id: "capex", name: "설비투자 집행", limits: [1, 10, 100], rule: "" },
      { id: "contract", name: "매출·구매 계약 체결", limits: [5, 30, 150], rule: "" },
      { id: "opex", name: "예산 내 경비 집행", limits: [0.5, 5, 50], rule: "" },
      { id: "nonbudget", name: "예산 외 지출", limits: [0.1, 1, 10], rule: "" },
      { id: "invest", name: "타법인 출자", limits: [0, 5, 100], rule: "" },
      { id: "dispose", name: "중요 자산의 처분·양도", limits: [0, 1, 100], rule: "393" },
      { id: "borrow", name: "대규모 재산의 차입", limits: [0, 0, 150], rule: "393" },
      { id: "bond", name: "사채 발행", limits: [0, 0, 0], rule: "469" },
      { id: "selfdeal", name: "이사 등과 회사 간 거래", limits: [0, 0, 0], rule: "398" }
    ]
  };
  const LAW = {
    "393": "상법 393조 1항: 중요한 자산의 처분·양도와 대규모 재산의 차입은 이사회 결의 사항",
    "398": "상법 398조: 이사 등과 회사 간 거래는 금액과 관계없이 이사회 승인(이사 3분의 2 이상)",
    "469": "상법 469조: 사채 발행은 이사회 결의. 정관 근거가 있으면 대표이사에게만 1년 이내로 위임 가능(4항)"
  };

  const boardLine = (x) => x.equity * x.boardPct / 100;

  /* 금액 → 결재권자 (0: 팀장 … 3: 이사회) */
  function approver(item, amount) {
    const L = item.limits;
    for (let i = 0; i < 3; i++) if (L[i] > 0 && amount <= L[i]) return i;
    return 3;
  }

  function checkItem(item, x) {
    const L = item.limits, B = boardLine(x), issues = [];
    if (L.some((v) => !(v >= 0))) issues.push({ kind: "input", text: "한도는 0 이상의 숫자여야 합니다." });
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      if (L[i] > 0 && L[j] > 0 && L[j] < L[i]) issues.push({ kind: "order", text: LEVELS[j] + " 한도(" + L[j] + "억)가 " + LEVELS[i] + " 한도(" + L[i] + "억)보다 작아, 그 사이 금액은 하위 결재권자만 승인할 수 있습니다." });
      if (L[i] > 0 && L[j] === 0 && j < 2 && L[2] > 0 && L[2] < L[i]) issues.push({ kind: "order", text: "대표이사 한도가 " + LEVELS[i] + " 한도보다 작습니다." });
    }
    if (item.rule === "398" && L.some((v) => v > 0)) issues.push({ kind: "law", text: "이사 등과의 거래를 대표이사 이하가 결재하도록 되어 있습니다. " + LAW["398"] + "." });
    if (item.rule === "469") {
      if (!x.delegateBond && L.some((v) => v > 0)) issues.push({ kind: "law", text: "정관 위임 근거 없이 사채 발행을 대표이사 이하에 맡겼습니다. " + LAW["469"] + "." });
      if (x.delegateBond && (L[0] > 0 || L[1] > 0)) issues.push({ kind: "law", text: "사채 발행 위임은 대표이사에게만 할 수 있습니다(상법 469조 4항)." });
    }
    if (item.rule !== "398" && item.rule !== "469" && L[2] >= B) issues.push({ kind: "board", text: "대표이사 한도(" + L[2] + "억)가 이사회 부의 기준(" + fmt(B) + "억) 이상입니다. 부의 기준 이상 금액은 이사회로 가야 합니다." + (item.rule === "393" ? " " + LAW["393"] + "." : "") });
    return issues;
  }
  function fmt(v) { return Math.round(v * 10) / 10; }

  function run(x) {
    const B = boardLine(x);
    const items = x.items.map((it) => {
      const issues = checkItem(it, x);
      return { id: it.id, name: it.name, rule: it.rule, limits: it.limits.slice(), issues: issues, boardFrom: it.limits[2] };
    });
    return { board: B, items: items, issueCount: items.reduce((a, i) => a + i.issues.length, 0) };
  }

  return { LEVELS: LEVELS, DEFAULTS: DEFAULTS, LAW: LAW, approver: approver, run: run, boardLine: boardLine };
});

/* 제도 노트(세액공제·내부회계·지속가능성 공시) 엔진. 금액 억원, 예시는 가상.
   공제율은 「조세특례제한법」 제24조(통합투자세액공제) [시행 2026. 9. 18.] 제1항제2호 원문을 그대로 옮겼다(국가법령정보센터, 2026.11.11 확인).
   - 기본공제 = 투자액 × 공제율(시설 구분 × 기업 규모)
   - 추가공제 = (투자액 − 직전 3년 연평균 투자액) × 10%, 단 기본공제의 2배 한도
   - 그해 세액이 모자라거나 최저한세(제132조)에 걸려 못 쓴 공제는 다음 과세연도부터 10년 동안 이월해 공제(제144조) → 현금 효과의 현재가치가 줄어든다.
   세무 판단(시설 해당 여부, 기업 규모 판정, 최저한세 계산)은 시행령·시행규칙과 전문가 확인이 필요하다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.RulesEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const SIZES = [["sme", "중소기업"], ["grad", "중소기업 졸업 후 3년 이내"], ["mid", "중견기업"], ["large", "그 밖의 기업(대기업)"]];
  const KINDS = [["gen", "일반 시설"], ["new", "신성장·원천기술 시설"], ["nst", "국가전략기술 시설(반도체 외)"], ["semi", "국가전략기술 시설(반도체)"]];
  /* % — 조특법 제24조①2가 4)·1)·2)·3) 순. 국가전략기술은 '중소·졸업 3년 외'가 중견·대기업 같은 율 */
  const RATE = {
    gen: { sme: 10, grad: 7.5, mid: 5, large: 1 },
    new: { sme: 12, grad: 9, mid: 6, large: 3 },
    nst: { sme: 25, grad: 20, mid: 15, large: 15 },
    semi: { sme: 30, grad: 25, mid: 20, large: 20 }
  };
  const ADD = 10, ADD_CAP = 2, CARRY_YEARS = 10, NST_UNTIL = "2029-12-31";
  const EX = { inv: 300, avg3: 200, kind: "semi", size: "mid", cap: 25, r: 8 };
  function credit(p) {
    const rate = RATE[p.kind][p.size], base = p.inv * rate / 100, addRaw = Math.max(0, p.inv - p.avg3) * ADD / 100, add = Math.min(addRaw, base * ADD_CAP);
    return { rate: rate, base: base, addRaw: addRaw, add: add, capped: addRaw > add + 1e-12, total: base + add };
  }
  /* 매년 cap만큼 쓸 수 있다고 볼 때: 투자 연도(1년차) + 이월 10년 */
  function usage(total, cap, r) {
    const rows = []; let left = total, pv = 0;
    for (let t = 1; t <= 1 + CARRY_YEARS; t++) { const use = Math.max(0, Math.min(left, cap)); left -= use; const d = use / Math.pow(1 + r / 100, t); pv += d; rows.push({ t: t, use: use, pv: d, left: left }); }
    return { rows: rows, pv: pv, lost: left, used: total - left, pvShare: total > 0 ? pv / total : 0, years: rows.filter((x) => x.use > 1e-12).length };
  }

  /* 지속가능성 공시 일정(금융위원회 「지속가능성(ESG) 공시 제도화 방안(최종안)」, 2026.7.8 보도자료 원문) */
  const ESG = [
    { y: 2026, k: "plan", t: "최종안 발표(7.8), 자본시장법 개정 추진", s: "업종별 대표기업 파일럿테스트" },
    { y: 2028, k: "start", t: "연결자산 10조원 이상 코스피 상장사 공시 시작(FY27, 사업보고서)", s: "도입 초기 3년 손해배상·행정제재·형사처벌 포괄 면제(고의 그린워싱 제외)" },
    { y: 2029, k: "start", t: "연결자산 5조원 이상으로 확대", s: "" },
    { y: 2030, k: "check", t: "제3자 인증 의무화 · 2조원 이상 확대 검토", s: "'28~'29년 공시 상황 평가 후" },
    { y: 2031, k: "scope3", t: "Scope3 공시: 10조원 이상", s: "공시대상별 3년 유예" },
    { y: 2032, k: "scope3", t: "Scope3 공시: 5조원 이상", s: "" },
    { y: 2033, k: "scope3", t: "Scope3 공시: 2조원 이상(잠정)", s: "" }
  ];
  return { SIZES, KINDS, RATE, ADD, ADD_CAP, CARRY_YEARS, NST_UNTIL, EX, credit, usage, ESG };
});

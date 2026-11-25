/* 메모리 사이클 시나리오 엔진 v2: 삼성전자·SK하이닉스의 2027~2029년 손익과 적정주가.

   구조(위에서 아래로 계산한다)
   1) 업계 수급: 제품 3개(범용 D램, HBM, 낸드)마다 비트 수요 증가율과 공급 증가율을 따로 둔다.
      - 수요: AI 투자(HBM·서버 D램·기업용 SSD)와 범용 수요(PC·모바일)를 나눠 합친다.
      - 공급: 업계 D램 웨이퍼 기준 비트 증설률 × HBM 웨이퍼 비중의 변화. HBM은 같은 비트에 웨이퍼를 약 3배 쓰므로
        HBM 비중이 오르면 범용 D램 공급이 그만큼 준다(범용 공급 = (1 − w_t)/(1 − w_{t−1}) × (1 + 증설률) − 1).
      - 수급 갭 = 누적 (1 + 공급)/(1 + 수요) − 1. 2026년 말은 부족(음수)에서 출발한다.
   2) 가격: 범용 D램·낸드는 갭 변화로 가격 지수 = exp(−k × (갭 − 2026 갭)), k는 Micron 10-K 가격과 업계 갭으로 보정.
      HBM은 연 단위 계약이라 2027년 세대 교체(HBM4) 인상분 + 이후 갭 변화와 같은 세대 연 8% 인하.
      장기공급계약(LTA)은 범용 D램·낸드의 계약 물량에 가격 하한과 연간 인하 폭 제한을 건다.
   3) 회사: 4분기 연환산 제품별 매출 × 가격 × 물량(업계 공급 증가 × HBM 점유율 변화) × 환율.
      원가는 제품별 원가율에서 비트당 원가 절감을 반영하고, 증설 감가상각을 더한다. 성과급, 메모리 외 사업(삼성), 법인세.
   4) 가치: 잔여이익모델(2026년 말 BPS + 2027~29 잔여이익 현재가치 + 감쇠하는 잔존가치).
   5) 불확실성: 변수 9개의 단계 확률과 변수 사이 상관(가우스 코퓰러)으로 몬테카를로, 현재 주가가 전제하는 가격 수준 역산.

   단위: 금액 조원, 주당 금액 원, 가격·물량 지수는 2026년 4분기(연환산) = 1.00. 교육용 모형이며 투자 권유가 아니다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MemScen = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const YEARS = [2027, 2028, 2029];
  const ASOF = "2026-11-24";
  const PRODUCTS = ["conv", "hbm", "nand"];
  const PNAME = { conv: "범용 D램", hbm: "HBM", nand: "낸드" };

  /* 가격 민감도: v1과 같은 Micron 10-K 보정(과잉 7.39, 부족 8.54). 낸드는 재고 조정이 빨라 조금 낮게, HBM은 연 계약이라 더 낮게 둔다(가정) */
  const K = { over: 7.392870403684871, short: 8.539558969747095, nand: 6.0, hbm: 3.0 };
  const kOf = (p, dg) => (p === "nand" ? K.nand : p === "hbm" ? K.hbm : dg > 0 ? K.over : K.short);
  /* 가격 반응의 상·하한: 갭이 커져도 수요 파괴(위)와 감산(아래) 때문에 가격이 끝없이 가지 않는다.
     log 가격을 A·tanh(log 가격 / A)로 눌러 4Q26 대비 상한·하한에 부드럽게 붙인다. 하한은 과거 고점 대비 최대 하락(약 −70%) */
  const BOUND = { conv: [1.8, 0.3], nand: [1.6, 0.3], hbm: [2.2, 0.35] };
  function bounded(p, lp) { const A = lp > 0 ? Math.log(BOUND[p][0]) : -Math.log(BOUND[p][1]); return Math.exp(A * Math.tanh(lp / A)); }
  const priceOfGap = (g) => Math.exp(-(g > 0 ? K.over : K.short) * g);
  const gapOfPrice = (p) => -Math.log(p) / (p < 1 ? K.over : K.short);

  /* 2026년 말 업계 상태 */
  const START = {
    gap: { conv: -0.08, hbm: -0.07, nand: -0.04 },   /* 공급/수요 − 1. HBM −7%는 골드만삭스 추정 공급 부족, 범용은 그보다 깊다고 가정 */
    w: 0.23,                                         /* HBM의 D램 웨이퍼 비중(TrendForce, 2026) */
    runRate: { conv: 1.08, nand: 1.05, hbm: 1.20 }   /* 4분기 출하가 2026년 평균보다 높은 정도(HBM4 4분기 급증): 2027년 물량 지수 = (1 + 공급 증가)/이 값 */
  };

  /* 회사별 출발점: 2026년 4분기 연환산 제품별 매출(추정), 원가율, 재무 가정 */
  const CO = {
    skh: {
      name: "SK하이닉스", short: "하이닉스",
      exit: { hbm: 120, conv: 270, nand: 120 },        /* 4Q26E 분기 약 128조 × 4. 3Q26 D램 78.2·낸드 26.0 + 가이던스(D램 출하 +20%대 중반) */
      costR: { hbm: 0.30, conv: 0.15, nand: 0.32 },   /* 제품별 원가율(4Q26E, 성과급 전) */
      hbmShare0: 0.55,
      dda: [[3, 6, 8], [5, 9, 12], [7, 12, 16], [9, 16, 22], [11, 20, 28]],   /* 업계 증설 단계별 감가상각 추가분 */
      nonmem: (pConv) => 0,
      fin: 3, tax: 0.24, bonus: 0.10,
      shares: 0.665,        /* 십억 주: 상장 7.07억 주에서 2026년 40조 원 자사주 매입분 소각 후 추정 */
      bps0: 488978,         /* 2026E BPS, 메리츠증권(2026.11.6) */
      coe: 0.11, payout: 0.5,
      price: 1158000,       /* 2026.11.24 종가(금융위원회 주식시세정보) */
      q3: { rev: 104.6, op: 83.3, dram: 78.2, nand: 26.0 },
      lta: { cov: [0.55, 0.55, 0.50], floor: 0.65, phi: 0.7, cap: null }
    },
    sec: {
      name: "삼성전자", short: "삼성",
      exit: { hbm: 80, conv: 370, nand: 170 },         /* 메모리 4Q26E 분기 약 155조 × 4. 3Q26 DS 147.1(메모리 약 135) */
      costR: { hbm: 0.42, conv: 0.18, nand: 0.36 },
      hbmShare0: 0.28,
      dda: [[4, 7, 10], [6, 11, 15], [8, 15, 20], [11, 20, 27], [13, 24, 34]],
      /* 메모리 외(모바일·가전, 파운드리·시스템LSI, 디스플레이, 하만): 3Q26 DX −0.8·디스플레이 1.1·하만 0.6.
         메모리 값이 내리면 완제품 원가가 줄어 이익이 는다 */
      nonmem: (pConv, t) => [4, 6, 8][t] + 14 * (1 - Math.min(pConv, 1.2)),
      fin: 8, tax: 0.23, bonus: 0.10,
      shares: 6.649,        /* 보통주 58.46억 + 우선주 8.02억 주(2026.11.24 상장주식수). 우선주도 같은 값으로 셈 */
      bps0: 106052,
      coe: 0.10, payout: 0.45,
      price: 189400,
      q3: { rev: 147.1, op: 106.5, dram: null, nand: null },
      lta: { cov: [0.60, 0.65, 0.65], floor: 0.80, phi: 0.5, cap: 1.10 }
    }
  };

  const PARAMS = {
    costDown: { conv: 0.88, nand: 0.88, hbm: 0.92 },   /* 비트당 원가 연간 변화 */
    hbmLike: 0.92,         /* 같은 세대 HBM 가격 연 −8% */
    omega: 0.6,            /* 초과이익 지속계수 */
    stair: 0.66,           /* 계약가격 연간 최대 하락 */
    fxBase: 1335,
    nandContent: 0.05      /* 낸드는 기기당 용량 증가가 수요에 더해진다 */
  };

  /* 변수 9개. 1단계가 대체로 유리하고 5단계가 불리하다(HBM 구도만 회사마다 방향이 반대) */
  const VARS = [
    { id: "ai", name: "AI 투자", what: "하이퍼스케일러 설비투자 → HBM·서버 D램·기업용 SSD 수요",
      hbm: [[0.75, 0.55, 0.40], [0.62, 0.45, 0.32], [0.50, 0.35, 0.25], [0.30, 0.15, 0.12], [0.10, -0.05, 0.05]],
      srv: [[0.30, 0.22, 0.18], [0.24, 0.18, 0.15], [0.18, 0.14, 0.12], [0.10, 0.06, 0.08], [0.02, -0.02, 0.05]],
      ssd: [[0.45, 0.30, 0.25], [0.36, 0.25, 0.20], [0.28, 0.20, 0.16], [0.15, 0.08, 0.10], [0.03, -0.03, 0.06]],
      w: [[0.31, 0.36, 0.40], [0.30, 0.34, 0.37], [0.29, 0.32, 0.34], [0.27, 0.28, 0.29], [0.25, 0.24, 0.24]],
      uplift: [0.40, 0.25, 0.12, 0.0, -0.10],   /* 2027년 HBM 가격(HBM4 전환 포함, 4Q26 대비) */
      levels: [
        { tag: "가속", note: "2027 설비투자 1.6조 달러(모건스탠리 수준) 이상. HBM 비트 수요 +75%" },
        { tag: "강세", note: "HBM 수요 +62%, HBM 웨이퍼 비중 30%" },
        { tag: "중심", note: "HBM 수요 +50%(TrendForce 공급 +50~60%와 맞물림), 웨이퍼 비중 29%" },
        { tag: "둔화", note: "설비투자 증가율 반토막. HBM 수요 +30%, 2028 +15%" },
        { tag: "급랭", note: "AI 투자 삭감·신용 사건. 2028 HBM 수요 감소" }
      ] },
    { id: "cons", name: "범용 수요", what: "PC·스마트폰 출하와 기기당 용량(가격 급등에 따른 수요 파괴 포함)",
      g: [[0.10, 0.10, 0.08], [0.06, 0.07, 0.07], [0.02, 0.05, 0.06], [-0.03, 0.02, 0.05], [-0.08, 0.00, 0.04]],
      levels: [
        { tag: "회복", note: "교체 수요 + AI PC: 비트 +10%" },
        { tag: "양호", note: "+6%" },
        { tag: "중심", note: "+2%. PC 제조사 완제품 재고로 2027 구매 조정(TrendForce 2026.11)" },
        { tag: "수요 파괴", note: "−3%: 메모리 값 급등으로 사양 축소" },
        { tag: "침체", note: "−8%: 소비 경기 하강" }
      ] },
    { id: "capex", name: "업계 증설", what: "삼성·하이닉스·마이크론의 D램·낸드 웨이퍼 증설(비트 기준)",
      dram: [[0.12, 0.14, 0.14], [0.15, 0.17, 0.16], [0.18, 0.20, 0.17], [0.21, 0.25, 0.21], [0.24, 0.30, 0.25]],
      nand: [[0.10, 0.12, 0.12], [0.13, 0.15, 0.14], [0.16, 0.18, 0.16], [0.19, 0.23, 0.20], [0.22, 0.28, 0.24]],
      levels: [
        { tag: "규율", note: "D램 비트 공급 +12~14%: 신규 팹 지연" },
        { tag: "절제", note: "+15~17%" },
        { tag: "중심", note: "+18~20%: 2027 업계 D램 공급 +18~23%(KB·골드만삭스 추정)" },
        { tag: "확대", note: "2028 +25%: 2027년 말 신규 팹 가동(모건스탠리 우려)" },
        { tag: "과잉", note: "2028 +30%: 호황기 증설이 한꺼번에" }
      ] },
    { id: "cxmt", name: "중국 증설", what: "CXMT·YMTC 등 예상 밖 중국 공급(범용 D램 갭 가산)",
      gap: [-0.005, 0, 0.012, 0.025, 0.045],
      levels: [
        { tag: "제재·지연", note: "범용 D램 공급 −0.5%p/년" },
        { tag: "예상 범위", note: "업계 전망에 이미 반영" },
        { tag: "일부 초과", note: "+1.2%p/년(2027은 40%만)" },
        { tag: "공격적", note: "+2.5%p/년. HBM 진입 가속" },
        { tag: "물량 공세", note: "+4.5%p/년. 범용 D램 저가 공급" }
      ] },
    { id: "hbm", name: "HBM 경쟁 구도", what: "HBM4 점유율. 하이닉스에 유리하면 삼성에 불리하다",
      skh: [[0.60, 0.60, 0.58], [0.57, 0.56, 0.55], [0.53, 0.50, 0.48], [0.48, 0.45, 0.42], [0.44, 0.40, 0.36]],
      sec: [[0.25, 0.24, 0.24], [0.27, 0.27, 0.27], [0.30, 0.31, 0.32], [0.34, 0.36, 0.37], [0.37, 0.39, 0.41]],
      levels: [
        { tag: "하이닉스 독주", note: "하이닉스 60%, 삼성 25%" },
        { tag: "하이닉스 우위", note: "하이닉스 57%, 삼성 27%" },
        { tag: "중심", note: "하이닉스 50%대 초반, 삼성 30%(HBM4 공급 확대)" },
        { tag: "삼성 추격", note: "하이닉스 45%, 삼성 36%" },
        { tag: "삼성·마이크론 역전", note: "하이닉스 40% 아래" }
      ] },
    { id: "lta", name: "장기공급계약", what: "계약 물량·가격 하한이 하락기에 실제로 지켜지는 정도(범용 D램·낸드)",
      on: [true, true, true, true, false], covAdd: [0.10, 0, 0, 0, 0],
      floor: { skh: [0.80, 0.65, 0.65, 0.50, 0], sec: [0.85, 0.80, 0.80, 0.50, 0] },
      phi: { skh: [0.9, 0.7, 0.7, 0.7, 0], sec: [0.7, 0.5, 0.5, 0.5, 0] },
      enf: [[1, 1, 1, 1, 1], [1, 1, 1, 0.85, 0.6], [1, 1, 0.95, 0.7, 0.4], [1, 1, 0.9, 0.5, 0.2], [0, 0, 0, 0, 0]],
      levels: [
        { tag: "강함", note: "계약 물량 +10%p, 하락기에도 100% 이행" },
        { tag: "계약대로", note: "가격 30% 하락 시 85%, 50% 하락 시 60% 이행" },
        { tag: "중심", note: "70%·40% 이행. 하이닉스 2029년까지 D램·HBM 사실상 완판(2026.10 실적발표)" },
        { tag: "약함", note: "하한 50%, 이행 50%·20%" },
        { tag: "무력화", note: "과거 사이클처럼 계약이 가격을 지키지 못함" }
      ] },
    { id: "fx", name: "원/달러", what: "달러 매출의 원화 환산",
      rate: [1450, 1400, 1335, 1290, 1250],
      levels: [{ tag: "1,450원", note: "매출 +8.6%" }, { tag: "1,400원", note: "+4.9%" }, { tag: "1,335원", note: "기준(2026.11 1,330~1,360원)" }, { tag: "1,290원", note: "−3.4%" }, { tag: "1,250원", note: "−6.4%" }] },
    { id: "trade", name: "무역·관세", what: "232조 관세, 중국 공장 장비 허가, 미중 휴전",
      revf: [1, 1, 0.98, 0.98, 0.98],
      qmul: [[1, 1.02, 1.02], [1, 1, 1], [1, 1, 1], [1, 0.94, 0.94], [0.95, 0.893, 0.94]],
      gap: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, -0.004, -0.004], [-0.007, -0.011, -0.004]],
      dAdd: [0, 0, 0, 0, 0.02],
      levels: [
        { tag: "완화", note: "관세 면제 확대, 중국 공장 허가 확대" },
        { tag: "현행", note: "고성능 반도체만 25% 관세" },
        { tag: "메모리 관세", note: "232조 25%를 메모리로 확대: 매출 −2%" },
        { tag: "+중국 공장 불허", note: "2028~29 자사 출하 −6%, 업계 공급 감소로 가격 소폭 상승" },
        { tag: "+휴전 붕괴", note: "희토류·장비 차질: 출하 −5%, AI 투자 지연(수요 −2%)" }
      ] },
    { id: "disc", name: "할인율", what: "금리 경로와 밸류업·외국인 수급 → 자기자본비용",
      dr: [-0.015, -0.0075, 0, 0.0075, 0.015],
      levels: [
        { tag: "재평가", note: "금리 인하 + MSCI 선진지수 편입: −1.5%p" },
        { tag: "완화", note: "−0.75%p" },
        { tag: "현행", note: "하이닉스 11%, 삼성 10%" },
        { tag: "긴축", note: "+0.75%p" },
        { tag: "디스카운트 확대", note: "+1.5%p: 미국 중간선거 뒤 위험 회피(2026.11) 장기화" }
      ] }
  ];
  const NV = VARS.length, NL = 5, TOTAL = Math.pow(NL, NV);
  const IDX = {}; VARS.forEach((v, i) => { IDX[v.id] = i; });
  const CENTRAL = [2, 2, 2, 1, 2, 2, 2, 1, 2];

  /* 함께 움직이는 변수를 묶은 대표 시나리오 */
  const PRESETS = [
    { id: "bull", name: "AI 슈퍼사이클 연장", lv: [0, 1, 1, 1, 2, 1, 1, 1, 1], note: "AI 투자 가속, 증설 절제, 금리 완화" },
    { id: "central", name: "중심", lv: CENTRAL.slice(), note: "각 변수 중심 단계" },
    { id: "glut", name: "2028 공급 과잉", lv: [2, 2, 4, 2, 2, 2, 2, 1, 3], note: "모건스탠리형: 2027년 말 증설이 2028년에 몰림" },
    { id: "bust", name: "AI 투자 급랭", lv: [4, 3, 3, 2, 2, 3, 0, 2, 4], note: "AI 삭감 + 위험 회피(원화 약세가 일부 상쇄)" },
    { id: "china", name: "중국 물량 + 관세", lv: [2, 3, 2, 4, 2, 3, 2, 4, 3], note: "CXMT 물량 공세와 휴전 붕괴가 겹침" }
  ];

  /* 몬테카를로용 단계 확률(변수마다 1~5단계)과 잠재 변수 상관(양수 = 같이 불리해짐) */
  const PROB = [
    [0.10, 0.25, 0.35, 0.20, 0.10],   /* AI 투자 */
    [0.08, 0.20, 0.40, 0.22, 0.10],
    [0.08, 0.20, 0.37, 0.23, 0.12],   /* 증설: 호황 끝 증설 쏠림이 역사적으로 잦다 */
    [0.05, 0.40, 0.30, 0.17, 0.08],
    [0.10, 0.25, 0.35, 0.20, 0.10],
    [0.10, 0.25, 0.35, 0.20, 0.10],
    [0.15, 0.25, 0.30, 0.20, 0.10],
    [0.10, 0.45, 0.25, 0.12, 0.08],
    [0.10, 0.20, 0.40, 0.20, 0.10]
  ];
  /* 상관(가정): AI 급랭은 범용 수요 약세·할인율 상승과 같이 오고, 증설은 줄이며, 원화는 약세(유리)가 된다 */
  const CORR = (function () {
    const C = []; for (let i = 0; i < NV; i++) { C.push([]); for (let j = 0; j < NV; j++) C[i].push(i === j ? 1 : 0); }
    const set = (a, b, r) => { C[IDX[a]][IDX[b]] = r; C[IDX[b]][IDX[a]] = r; };
    set("ai", "cons", 0.4); set("ai", "disc", 0.4); set("ai", "capex", -0.4); set("ai", "fx", -0.3);
    set("cons", "disc", 0.2); set("trade", "ai", 0.2); set("trade", "cxmt", -0.2); set("cons", "fx", -0.2);
    return C;
  })();

  /* ---------- 1) 업계 수급과 시장 가격 ---------- */
  function industry(lv) {
    const vA = VARS[IDX.ai], vC = VARS[IDX.cons], vK = VARS[IDX.capex], vX = VARS[IDX.cxmt], vT = VARS[IDX.trade];
    const a = lv[IDX.ai], cs = lv[IDX.cons], k = lv[IDX.capex], x = lv[IDX.cxmt], tr = lv[IDX.trade];
    const gap = Object.assign({}, START.gap), out = [];
    let w0 = START.w, ph = 1;
    for (let t = 0; t < 3; t++) {
      const dAdd = vT.dAdd[tr];
      const d = {
        hbm: vA.hbm[a][t] - dAdd,
        conv: 0.5 * (vA.srv[a][t] - dAdd) + 0.5 * vC.g[cs][t],
        nand: 0.45 * (vA.ssd[a][t] - dAdd) + 0.55 * (vC.g[cs][t] + PARAMS.nandContent)
      };
      const w1 = vA.w[a][t], cap = vK.dram[k][t];
      const s = {
        hbm: (w1 / w0) * (1 + cap) - 1,
        conv: ((1 - w1) / (1 - w0)) * (1 + cap) - 1 + vX.gap[x] * (t === 0 ? 0.4 : 1) + vT.gap[tr][t],
        nand: vK.nand[k][t]
      };
      const prev = Object.assign({}, gap), price = {};
      PRODUCTS.forEach((p) => { gap[p] = (1 + gap[p]) * (1 + s[p]) / (1 + d[p]) - 1; });
      ["conv", "nand"].forEach((p) => { const dg = gap[p] - START.gap[p]; price[p] = bounded(p, -kOf(p, dg) * dg); });
      ph = t === 0 ? (1 + vA.uplift[a]) * Math.exp(-K.hbm * (gap.hbm - START.gap.hbm)) : ph * PARAMS.hbmLike * Math.exp(-K.hbm * (gap.hbm - prev.hbm));
      price.hbm = bounded("hbm", Math.log(ph));
      out.push({ year: YEARS[t], d: d, s: s, w: w1, gap: Object.assign({}, gap), price: price });
      w0 = w1;
    }
    return out;
  }

  /* ---------- 2) 회사 손익과 가치 ---------- */
  function ltaStage(pm) { return pm >= 0.9 ? 1 : pm >= 0.7 ? 2 : pm >= 0.5 ? 3 : 4; }

  function evaluate(coKey, lv, opt) {
    opt = opt || {};
    const c = CO[coKey], P = PARAMS, mult = opt.priceMult || 1;
    const vL = VARS[IDX.lta], vT = VARS[IDX.trade], vF = VARS[IDX.fx], vH = VARS[IDX.hbm];
    const T = lv[IDX.lta], tr = lv[IDX.trade];
    const coe = c.coe + VARS[IDX.disc].dr[lv[IDX.disc]];
    const fxf = vF.rate[lv[IDX.fx]] / P.fxBase * vT.revf[tr];
    const ind = opt.ind || industry(lv);
    const share = vH[coKey][lv[IDX.hbm]];
    const years = [];
    const pcPrev = { conv: 1, nand: 1 }, vol = { conv: 1 / START.runRate.conv, nand: 1 / START.runRate.nand, hbm: 1 / START.runRate.hbm };
    for (let t = 0; t < 3; t++) {
      const I = ind[t], qm = vT.qmul[tr][t], row = { year: YEARS[t], prod: {} };
      let rev = 0, cost = 0;
      PRODUCTS.forEach((p) => {
        vol[p] *= 1 + I.s[p];
        let q = vol[p] * qm, pm = I.price[p] * mult, pr = pm, Lk = 0, pc = null;
        if (p === "hbm") q *= share[t] / c.hbmShare0;
        else if (vL.on[T]) {
          /* 계약 물량은 계약가, 나머지는 시장가. 하락기 계약가 = φ·max(계단가, 하한) + (1 − φ)·계단가 */
          const cov = Math.min(0.95, c.lta.cov[t] + vL.covAdd[T]), enf = vL.enf[T][ltaStage(pm)];
          Lk = cov * enf;
          if (pm >= 1) pc = c.lta.cap ? Math.min(pm, c.lta.cap) : pm;
          else { const step = Math.max(pm, pcPrev[p] * P.stair), fl = vL.floor[coKey][T], phi = vL.phi[coKey][T]; pc = phi * Math.max(step, fl) + (1 - phi) * step; }
          pcPrev[p] = pc;
          pr = Lk * pc + (1 - Lk) * pm;
        }
        const r = c.exit[p] * pr * q * fxf;
        const k = c.exit[p] * c.costR[p] * q * Math.pow(P.costDown[p], t + 1);
        row.prod[p] = { pm: pm, pc: pc, pr: pr, q: q, lta: Lk, rev: r, cost: k };
        rev += r; cost += k;
      });
      cost += c.dda[lv[IDX.capex]][t];
      const pre = rev - cost;
      const nm = c.nonmem(row.prod.conv.pm, t);
      const op = pre - Math.max(pre, 0) * c.bonus + nm;
      const ni = (op + c.fin) * (1 - c.tax);
      Object.assign(row, { rev: rev, cost: cost, nonmem: nm, op: op, ni: ni, eps: ni / c.shares * 1e3, ind: I });
      years.push(row);
    }
    let B = c.bps0, V0 = B, ri = 0;
    years.forEach((y, t) => {
      y.bpsBeg = B; y.roe = y.eps / B;
      ri = y.eps - coe * B; y.ri = ri;
      V0 += ri / Math.pow(1 + coe, t + 1);
      B += y.eps * (1 - c.payout); y.bps = B;
    });
    const tv = ri * P.omega / (1 + coe - P.omega) / Math.pow(1 + coe, 3);
    const value = V0 + tv, price = opt.price || c.price;
    return { co: coKey, coe: coe, years: years, tv: tv, value: value, price: price, upside: value / price - 1,
      per29: years[2].eps > 0 ? value / years[2].eps : null, pbr29: value / years[2].bps };
  }

  /* 토네이도: 지금 선택에서 변수 하나만 1~5단계로 바꿨을 때 */
  function tornado(coKey, lv) {
    const base = evaluate(coKey, lv).value;
    return VARS.map((v, i) => {
      const vals = [0, 1, 2, 3, 4].map((k) => { const l = lv.slice(); l[i] = k; return evaluate(coKey, l).value; });
      return { id: v.id, name: v.name, vals: vals, lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals), span: Math.max.apply(null, vals) - Math.min.apply(null, vals), base: base };
    }).sort((a, b) => b.span - a.span);
  }

  /* 역산: 지금 조합에서 범용 D램·낸드·HBM 가격을 모두 m배 했을 때 적정가 = 주가가 되는 m */
  function implied(coKey, lv) {
    const ind = industry(lv), f = (m) => evaluate(coKey, lv, { priceMult: m, ind: ind }).value - CO[coKey].price;
    let lo = 0.05, hi = 3;
    if (f(lo) > 0) return lo; if (f(hi) < 0) return hi;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }

  /* ---------- 3) 몬테카를로(가우스 코퓰러) ---------- */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s + 0.5) / 4294967296; }; }
  function chol(A) {
    const n = A.length, L = A.map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
    return L;
  }
  function ncdf(x) { /* 표준정규 누적분포(Abramowitz–Stegun 7.1.26) */
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }
  function levelOf(u, p) { let c = 0; for (let k = 0; k < p.length; k++) { c += p[k]; if (u < c) return k; } return p.length - 1; }
  function draws(n, seed, useCorr) {
    const L = chol(useCorr === false ? CORR.map((r, i) => r.map((_, j) => (i === j ? 1 : 0))) : CORR), r = rng(seed || 7), out = [];
    const gauss = () => { const u = r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    for (let k = 0; k < n; k++) {
      const z = []; for (let i = 0; i < NV; i++) z.push(gauss());
      const lv = [];
      for (let i = 0; i < NV; i++) { let s = 0; for (let j = 0; j <= i; j++) s += L[i][j] * z[j]; lv.push(levelOf(ncdf(s), PROB[i])); }
      out.push(lv);
    }
    return out;
  }
  function simulate(n, seed, useCorr) {
    const D = draws(n, seed, useCorr), res = { skh: [], sec: [] }, cache = {};
    D.forEach((lv) => {
      const key = lv.join(""); let hit = cache[key];
      if (!hit) { const ind = industry(lv); hit = cache[key] = { skh: evaluate("skh", lv, { ind: ind }).value, sec: evaluate("sec", lv, { ind: ind }).value }; }
      res.skh.push(hit.skh); res.sec.push(hit.sec);
    });
    const stat = (a, co) => { const s = a.slice().sort((x, y) => x - y), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))], pr = CO[co].price;
      return { mean: s.reduce((x, y) => x + y, 0) / s.length, p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), above: s.filter((v) => v >= pr).length / s.length, sorted: s }; };
    return { n: n, draws: D, skh: stat(res.skh, "skh"), sec: stat(res.sec, "sec"), raw: res };
  }

  function decode(n) { const lv = new Array(NV); for (let i = NV - 1; i >= 0; i--) { lv[i] = n % NL; n = Math.floor(n / NL); } return lv; }
  function encode(lv) { return lv.reduce((n, k) => n * NL + k, 0); }
  const code = (lv) => lv.map((k) => k + 1).join("");

  return { YEARS, ASOF, PRODUCTS, PNAME, K, BOUND, bounded, START, CO, PARAMS, VARS, NV, NL, TOTAL, IDX, CENTRAL, PRESETS, PROB, CORR,
    priceOfGap, gapOfPrice, industry, evaluate, tornado, implied, chol, ncdf, draws, simulate, decode, encode, code };
});

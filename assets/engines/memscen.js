/* 메모리 사이클 시나리오 엔진: 삼성전자·SK하이닉스의 2027~2029년 손익과 적정주가.
   변수 8개를 각각 1(가장 우호적)~5(가장 비우호적) 단계로 고르면, 5^8 = 390,625개 조합 하나하나가
   수급 갭 → 가격 → 장기공급계약(LTA) → 물량·매출 → 영업이익·순이익 → 잔여이익모델 적정가로 이어진다.

   단위: 금액 조원, 주당 금액 원, 가격·물량은 2026년 4분기(연환산)를 1.00으로 둔 지수.
   유효 수급 갭 G는 '공급 − 수요'를 4Q26 대비 누적 %p로 본 값(양수 = 공급과잉).
   가격 = exp(−k·G), k는 Micron 10-K의 D램 가격과 업계 수급 갭으로 보정(과잉 7.39, 부족 8.54).
   교육용 모형이다. 모든 가정은 PARAMS에 모아 두었고, 출처는 화면 하단과 docs/mem-scenario-model.md에 적었다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MemScen = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const YEARS = [2027, 2028, 2029];

  /* 가격 민감도: 과거 사이클(2019·2023 공급과잉, 2026 공급부족)로 보정한 기울기 */
  const K = { over: 7.392870403684871, short: 8.539558969747095 };
  const priceOfGap = (g) => Math.exp(-(g > 0 ? K.over : K.short) * g);          /* g: 소수(0.05 = 5%p) */
  const gapOfPrice = (p) => -Math.log(p) / (p < 1 ? K.over : K.short);

  /* 회사별 출발점(4Q26 연환산)과 재무 가정 */
  const CO = {
    skh: {
      name: "SK하이닉스", short: "하이닉스",
      exit: 472,            /* 4Q26 매출 118조 × 4 (추정) */
      base: 47.8,           /* 2026년 원가(성과급 제외, 조원) */
      dda: [8, 15, 20],     /* 증설에 따른 감가상각비 추가분 */
      betaP: 1.0,           /* 가격 하락 민감도(범용·낸드 비중) */
      nonmem: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
      shares: 0.695,        /* 십억 주 */
      bps0: 488978,         /* 2026E BPS, 메리츠증권(2026.11.6) */
      coe: 0.11,
      ni: (op) => (op + 3) * 0.75,   /* 순현금 이자 + 법인세 */
      payout: 0.5,
      expo: 1.15,           /* AI 수요 충격 노출도(엔비디아·네오클라우드 비중) */
      price: 1112000,       /* 2026.11.20 장중 */
      op26: 276,
      lta: { cov: [0.55, 0.55, 0.50], floor: 0.65, phi: 0.7, cap: null }
    },
    sec: {
      name: "삼성전자", short: "삼성",
      exit: 620,            /* 메모리 4Q26 매출 155조 × 4 (추정) */
      base: 65.5,
      dda: [10, 18, 24],
      betaP: 1.15,
      /* 메모리 외 손익(DX·파운드리·디스플레이): 메모리 가격과 반대로 움직임 */
      nonmem: [[-5, -5, -3], [2, 0, 3], [8, 10, 10], [14, 16, 14], [16, 12, 12]],
      shares: 6.52,         /* 보통주 + 우선주 */
      bps0: 106052,
      coe: 0.10,
      ni: (op) => (op + 8) * 0.77,
      payout: 0.5,
      expo: 1.0,
      price: 187500,
      op26: 372,
      lta: { cov: [0.60, 0.65, 0.65], floor: 0.80, phi: 0.5, cap: 1.10 }
    }
  };

  /* 공통 가정 */
  const PARAMS = {
    bonus: 0.10,            /* 성과급 = 성과급 전 영업이익의 10% */
    costDown: 0.88,         /* 비트당 원가 연 −12% */
    bitAdj: 1.10,           /* 4Q26 출하 대비 2026년 평균 비트 */
    omega: 0.6,             /* 초과이익 지속계수(잔존가치 감쇠) */
    stair: 0.66,            /* 계약가격 연간 최대 하락(분기 −10% 캡) */
    absorbShare: 0.5,       /* 수요 감소분 중 계약 고객이 재고로 떠안는 몫(테이크오어페이) */
    leak: 0.6,              /* 그 재고가 이듬해 시장으로 나오는 비율 */
    prepay: 0.20,           /* 선급금(위약 시 몰수) */
    fxBase: 1335            /* 기준 원/달러 */
  };

  /* 1) 메모리 업황: 4Q26 대비 가격·물량 경로(연평균). 단계가 곧 시장 국면이다 */
  const MARKET = {
    P: [[1.15, 1.25, 1.10], [1.03, 0.95, 0.75], [0.92, 0.65, 0.50], [0.72, 0.40, 0.35], [0.55, 0.17, 0.22]],
    Q: [[1.10, 1.25, 1.45], [1.06, 1.20, 1.38], [1.04, 1.15, 1.30], [1.00, 1.05, 1.20], [0.95, 1.00, 1.10]],
    absorb: [0.9, 0.7, 0.4, 0.1, 0.0]   /* 미충족 수요(백로그)가 수요 손실을 흡수하는 비율 */
  };

  /* 변수 정의: 단계마다 화면 문구와 모형 입력 */
  const VARS = [
    { id: "mkt", name: "메모리 업황", what: "D램·낸드 가격과 출하의 2027~29년 경로",
      levels: [
        { tag: "초호황", note: "공급부족이 2029년 이후까지. 가격 2027 +15%, 2028 +25%(4Q26 대비)" },
        { tag: "호황", note: "2027 강보합, 2029년부터 하락. 증권가 컨센서스 수준" },
        { tag: "정점·둔화", note: "2027 상반기 고점, 증설 물량이 2028년 도착. 2019년·2022~23년과 비슷한 갭" },
        { tag: "하강", note: "AI 투자 축소. 2011~12년·2019~20년 수준의 큰 다운턴" },
        { tag: "침체", note: "2025년 하반기 가격 아래로 회귀. 금융위기(누적 갭 19.6%p)보다 깊음" }
      ] },
    { id: "rate", name: "금리", what: "연준·한은 금리 경로 → 자기자본비용",
      dr: [-0.005, 0, 0.005, 0.010, 0.015],
      levels: [
        { tag: "인하 전환", note: "자기자본비용 −0.5%p" },
        { tag: "동결", note: "변화 없음" },
        { tag: "점진 인상", note: "+0.5%p. 연준 12월·한은 11월 인상 전망(2026.11 기준)" },
        { tag: "인상 가속", note: "+1.0%p" },
        { tag: "긴축 충격", note: "+1.5%p" }
      ] },
    { id: "fx", name: "원/달러 환율", what: "달러 매출의 원화 환산",
      rate: [1450, 1400, 1335, 1290, 1250],
      levels: [
        { tag: "1,450원", note: "원화 약세. 매출 +8.6%" },
        { tag: "1,400원", note: "매출 +4.9%" },
        { tag: "1,335원", note: "기준(2026.11 중순 수준)" },
        { tag: "1,290원", note: "매출 −3.4%" },
        { tag: "1,250원", note: "원화 강세. 매출 −6.4%" }
      ] },
    { id: "trade", name: "무역분쟁·관세", what: "232조 관세, 중국 공장 장비 허가, 미중 휴전",
      revf: [1, 1, 0.98, 0.98, 0.98],
      qmul: [[1, 1.02, 1.02], [1, 1, 1], [1, 1, 1], [1, 0.94, 0.94], [0.95, 0.893, 0.94]],
      gap: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, -0.004, -0.004], [-0.007, -0.011, -0.004]],
      dAdd: [0, 0, 0, 0, 0.02],
      levels: [
        { tag: "완화", note: "관세 면제 확대, 중국 공장 허가 확대. 2028~29 자사 출하 +2%" },
        { tag: "현행", note: "고성능 반도체만 25% 관세, 한미 최혜국 대우 유지" },
        { tag: "메모리 관세", note: "232조 25%를 메모리로 확대(미국향 20%, 40% 흡수) → 매출 −2%" },
        { tag: "+중국 공장 불허", note: "연간 장비 허가 불허: 2028~29 자사 출하 −6%, 업계 공급 감소로 가격 +3%" },
        { tag: "+휴전 붕괴", note: "2027.1.10 휴전 만료 후 희토류·장비 차질: 출하 −5%, 가격 +5%, AI 투자 지연(수요 −2%)" }
      ] },
    { id: "cxmt", name: "중국 CXMT 증설", what: "예상 밖 중국 D램 공급(업계 수급 갭 가산)",
      gap: [-0.005, 0, 0.011, 0.022, 0.040],
      levels: [
        { tag: "제재·지연", note: "갭 −0.5%p: 2028~29 가격 +4%" },
        { tag: "예상 범위", note: "업계 공급 전망에 이미 반영된 수준" },
        { tag: "일부 초과", note: "갭 +1.1%p: 2028~29 가격 −8%" },
        { tag: "공격적 증설", note: "갭 +2.2%p: 가격 −15%. 월 60만 장(2028) 시나리오" },
        { tag: "물량 공세", note: "갭 +4.0%p: 가격 −26%. 범용 D램 저가 공급 확대" }
      ] },
    { id: "ai", name: "AI 수요 충격", what: "젠슨 황 사태·원격접속 규제·네오클라우드 자금경색·오픈소스 규제",
      d: [0, 0.02, 0.05, 0.10, 0.15], coeSkh: [0, 0, 0.003, 0.003, 0.005],
      levels: [
        { tag: "충격 없음", note: "수요 손실 0%" },
        { tag: "완화", note: "수요 손실 2%: 동남아 물량이 일본·유럽·중동으로 재배치" },
        { tag: "중심", note: "수요 손실 5%, 하이닉스 고객 집중 할증 +0.3%p" },
        { tag: "스트레스", note: "수요 손실 10%: 수출통제 입법 + 네오클라우드 신용 사건" },
        { tag: "심각", note: "수요 손실 15%, 하이닉스 할증 +0.5%p" }
      ] },
    { id: "lta", name: "장기공급계약(LTA)", what: "계약 물량·가격 하한·선급금이 실제로 지켜지는 정도",
      on: [true, true, true, true, false],
      covAdd: [0.10, 0, 0, 0, 0],
      floor: { skh: [0.80, 0.65, 0.65, 0.50, 0], sec: [0.85, 0.80, 0.80, 0.50, 0] },
      phi: { skh: [0.9, 0.7, 0.7, 0.7, 0], sec: [0.7, 0.5, 0.5, 0.5, 0] },
      enf: [[1, 1, 1, 1, 1], [1, 1, 1, 0.85, 0.6], [1, 1, 0.95, 0.7, 0.4], [1, 1, 0.9, 0.5, 0.2], [0, 0, 0, 0, 0]],
      levels: [
        { tag: "강함", note: "커버리지 +10%p, 하한 상향, 다운턴에도 100% 이행" },
        { tag: "계약대로", note: "하강기 85%, 침체기 60% 이행" },
        { tag: "중심", note: "하강기 70%, 침체기 40% 이행. 삼성 일부 계약 하한 80%" },
        { tag: "약함", note: "하한 50%, 하강기 50%·침체기 20% 이행" },
        { tag: "무력화", note: "과거 사이클처럼 계약이 가격을 지키지 못함" }
      ] },
    { id: "val", name: "밸류업·수급", what: "주주환원 제도, MSCI, 외국인·AI IPO 수급 → 할인율",
      dr: [-0.010, -0.005, 0, 0.005, 0.010],
      levels: [
        { tag: "재평가", note: "MSCI 선진지수 편입 확정·밸류업 완성: −1.0%p" },
        { tag: "개선", note: "자사주 소각 의무화·배당 분리과세 효과: −0.5%p" },
        { tag: "현행", note: "변화 없음" },
        { tag: "수급 악화", note: "AI 대형 IPO 흡수, 외국인 이탈: +0.5%p" },
        { tag: "디스카운트 확대", note: "+1.0%p" }
      ] }
  ];
  const NV = VARS.length, NL = 5, TOTAL = Math.pow(NL, NV);
  const CENTRAL = [2, 2, 2, 1, 1, 2, 2, 2];  /* 0부터 센 단계: 업황 3, 금리 3, 환율 3, 무역 2, CXMT 2, AI 3, LTA 3, 밸류업 3 */
  const PROBS = {
    central: { name: "중심(거시·젠슨 황 반영)", p: [0.09, 0.28, 0.34, 0.21, 0.08] },
    base: { name: "역사적 기저율", p: [0.07, 0.24, 0.31, 0.28, 0.10] },
    first: { name: "1차 추정", p: [0.15, 0.35, 0.30, 0.15, 0.05] }
  };

  /* 단계 배열(0~4) 하나로 한 회사의 3년 손익과 적정가를 계산 */
  function evaluate(coKey, lv, opt) {
    opt = opt || {};
    const c = CO[coKey], P_ = Object.assign({}, PARAMS, opt.params || {});
    const s = lv[0];
    const V = (id) => VARS.find((v) => v.id === id);
    const vt = V("trade"), vc = V("cxmt"), va = V("ai"), vl = V("lta"), vf = V("fx");
    const L = lv[3], X = lv[4], A = lv[5], T = lv[6];
    const coe = c.coe + V("rate").dr[lv[1]] + V("val").dr[lv[7]] + (coKey === "skh" ? va.coeSkh[A] : 0);
    const revf = vf.rate[lv[2]] / P_.fxBase * vt.revf[L];
    const D = va.d[A] + vt.dAdd[L];
    const ltaOn = vl.on[T], enf = vl.enf[T][s];
    const price = opt.price || c.price;
    const years = [];
    let pcPrev = 1, aPrev = 0;
    for (let t = 0; t < 3; t++) {
      let p = MARKET.P[s][t];
      if (p < 1) p = 1 - (1 - p) * c.betaP;
      const ex = D * c.expo * (1 - MARKET.absorb[s]);
      const cxGap = vc.gap[X] * (t === 0 ? 0.25 : 1);
      const G = gapOfPrice(p) + ex + cxGap + vt.gap[L][t];           /* 시나리오 갭 + 수요 손실 + 중국 공급 + 무역 */
      const qPlan = MARKET.Q[s][t] * vt.qmul[L][t];
      let Gm = G, pm, pc = null, peff, q, pen = 0, Lk = 0;
      if (ltaOn) {
        const cov = Math.min(0.95, c.lta.cov[t] + vl.covAdd[T]);
        Lk = cov * enf;
        const a = Lk * P_.absorbShare * Math.max(G, 0);
        Gm = G - a + P_.leak * aPrev; aPrev = a;
        pm = priceOfGap(Gm);
        const cap = coKey === "sec" ? c.lta.cap : null;
        if (pm >= 1) pc = cap ? Math.min(pm, cap) : pm;
        else {
          const step = Math.max(pm, pcPrev * P_.stair), fl = vl.floor[coKey][T], phi = vl.phi[coKey][T];
          pc = phi * Math.max(step, fl) + (1 - phi) * step;
        }
        pcPrev = pc;
        peff = Lk * pc + (1 - Lk) * pm;
        const qs = qPlan * (1 - ex), qc = Math.max(MARKET.Q[1][t], MARKET.Q[s][t]) * vt.qmul[L][t];
        q = Lk * qc + (1 - Lk) * qs;
        pen = cov * (1 - enf) * P_.prepay * pc * c.exit * MARKET.Q[s][t] * 0.5;
      } else {
        pm = priceOfGap(G); peff = pm; q = qPlan * (1 - ex);
      }
      const rev = c.exit * peff * q * revf;
      const cost = c.base * q * P_.bitAdj * Math.pow(P_.costDown, t + 1) + c.dda[t];
      const pre = rev - cost + pen;
      const op = pre - Math.max(pre, 0) * P_.bonus + c.nonmem[s][t];
      const ni = c.ni(op);
      years.push({ year: YEARS[t], gap: G, gapMkt: Gm, pm: pm, pc: pc, peff: peff, q: q, lta: Lk, rev: rev, pen: pen, op: op, ni: ni, eps: ni / c.shares * 1e3 });
    }
    /* 잔여이익모델: 가치 = BPS0 + Σ (EPS − COE × BPS) 할인 + 감쇠하는 잔존가치 */
    let B = c.bps0, V0 = B, ri = 0;
    years.forEach((y, t) => {
      y.bpsBeg = B; y.roe = y.eps / B;
      ri = y.eps - coe * B; y.ri = ri;
      V0 += ri / Math.pow(1 + coe, t + 1);
      B += y.eps * (1 - c.payout); y.bps = B;
    });
    const tv = ri * P_.omega / (1 + coe - P_.omega) / Math.pow(1 + coe, 3);
    const value = V0 + tv;
    return {
      co: coKey, coe: coe, years: years, tv: tv, value: value, price: price,
      upside: value / price - 1, per27: value / years[0].eps, pbr27: value / years[0].bps,
      /* 화면 기본 배수는 2029E: 2027년은 이익 정점이라 배수가 실제보다 싸 보인다. EPS가 0 이하이면 PER은 null */
      per29: years[2].eps > 0 ? value / years[2].eps : null, pbr29: value / years[2].bps
    };
  }

  /* 업황 단계 확률로 가중(나머지 변수는 고정) */
  function weighted(coKey, lv, probs, opt) {
    const rows = [0, 1, 2, 3, 4].map((s) => { const l = lv.slice(); l[0] = s; return evaluate(coKey, l, opt).value; });
    const ev = rows.reduce((acc, v, i) => acc + v * probs[i], 0);
    return { byStage: rows, value: ev };
  }

  /* 토네이도: 지금 선택에서 변수 하나만 1단계·5단계로 바꿨을 때 */
  function tornado(coKey, lv, opt) {
    const base = evaluate(coKey, lv, opt).value;
    return VARS.map((v, i) => {
      const vals = [0, 1, 2, 3, 4].map((k) => { const l = lv.slice(); l[i] = k; return evaluate(coKey, l, opt).value; });
      return { id: v.id, name: v.name, vals: vals, lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals), span: Math.max.apply(null, vals) - Math.min.apply(null, vals), base: base };
    }).sort((a, b) => b.span - a.span);
  }

  /* 조합 번호 ↔ 단계 배열 (첫 변수가 가장 높은 자리) */
  function decode(n) { const lv = new Array(NV); for (let i = NV - 1; i >= 0; i--) { lv[i] = n % NL; n = Math.floor(n / NL); } return lv; }
  function encode(lv) { return lv.reduce((n, k) => n * NL + k, 0); }
  const code = (lv) => lv.map((k) => k + 1).join("");

  /* 전체 조합 분포: from~to 구간을 계산해 히스토그램 칸에 더한다(화면은 나눠서 부른다) */
  function scan(coKey, from, to, bins, lo, hi, w, opt) {
    const nb = bins.length, step = (hi - lo) / nb;
    let above = 0, total = 0, sum = 0, min = Infinity, max = -Infinity;
    const price = (opt && opt.price) || CO[coKey].price;
    for (let n = from; n < to; n++) {
      const lv = decode(n), v = evaluate(coKey, lv, opt).value, wt = w ? w[lv[0]] : 1;
      const b = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / step)));
      bins[b] += wt; total += wt; sum += v * wt;
      if (v >= price) above += wt;
      if (v < min) min = v; if (v > max) max = v;
    }
    return { above: above, total: total, sum: sum, min: min, max: max };
  }

  return { YEARS, K, CO, PARAMS, MARKET, VARS, NV, NL, TOTAL, CENTRAL, PROBS, priceOfGap, gapOfPrice, evaluate, weighted, tornado, decode, encode, code, scan };
});

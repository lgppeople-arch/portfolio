/* 관리회계 키트 엔진. 가상의 세라믹 부품 공장 한 달. 금액 백만원, 단가 천원(천원 × 개 ÷ 1,000 = 백만원).
   1. 표준원가 차이: 재료 가격·수량, 노무 임률·능률, 변동간접비 소비·능률, 고정간접비 예산·조업도. 차이 합계 = 실제원가 − 실제 생산량의 표준원가
      전부원가 이익 − 변동원가 이익 = (생산량 − 판매량) × 단위당 고정간접비 배부액(기초재고 없음, 차이는 매출원가로)
   2. 사업부 손익: 공헌이익 → 사업부 공헌이익(직접 고정비 차감) → 공통비 배부 후 영업이익. 배부 기준을 바꿔도 회사 합계는 같다.
      보조부문 배부: 직접배부법, 단계배부법, 상호배부법(연립방정식)
   3. 재고: 회전일, 연령별 충당금, 저가법(순실현가능가치), 경제적 주문량과 안전재고
   4. 의사결정: 특별주문, 외주 대 자가제조, 병목 공정의 제품 배합, 여러 제품의 손익분기 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api; else root.MgmtEngine = api;
})(typeof self !== "undefined" ? self : this, function (S) {
  "use strict";
  const K = 1000; /* 천원 × 개 → 백만원 */
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  /* ---------- 1. 표준원가 ---------- */
  const STD = {
    /* 단위당 표준 */
    matQ: 2.0, matP: 12, labH: 0.5, labR: 30, mchH: 0.5, vohR: 10,
    /* 고정간접비 월 예산(백만원)과 기준 조업도(개) */
    fohBudget: 900, normal: 120000,
    /* 실제 */
    prod: 100000, matAQ: 206000, matAP: 12.6, labAH: 52000, labAR: 29.5, mchAH: 51000, vohA: 540, fohA: 930,
    /* 판매와 손익 */
    sold: 90000, price: 80, sellV: 3, sga: 1200
  };
  function standard(x) {
    const fohRate = x.fohBudget * K / (x.normal * x.mchH);          /* 기계시간당 고정간접비 배부율(천원) */
    const unit = { mat: x.matQ * x.matP, lab: x.labH * x.labR, voh: x.mchH * x.vohR, foh: x.mchH * fohRate };
    unit.vari = unit.mat + unit.lab + unit.voh; unit.full = unit.vari + unit.foh;
    return { fohRate: fohRate, unit: unit };
  }
  function variances(x) {
    const st = standard(x), P = x.prod, SQ = x.matQ * P, SH = x.labH * P, SM = x.mchH * P;
    const v = [
      { key: "matPrice", grp: "재료", name: "재료 가격", val: (x.matAP - x.matP) * x.matAQ / K, why: "실제 단가 − 표준 단가 × 실제 사용량" },
      { key: "matQty", grp: "재료", name: "재료 수량", val: (x.matAQ - SQ) * x.matP / K, why: "실제 사용량 − 표준 사용량 × 표준 단가" },
      { key: "labRate", grp: "노무", name: "노무 임률", val: (x.labAR - x.labR) * x.labAH / K, why: "실제 임률 − 표준 임률 × 실제 시간" },
      { key: "labEff", grp: "노무", name: "노무 능률", val: (x.labAH - SH) * x.labR / K, why: "실제 시간 − 표준 시간 × 표준 임률" },
      { key: "vohSpend", grp: "변동간접비", name: "변동간접비 소비", val: x.vohA - x.mchAH * x.vohR / K, why: "실제 변동간접비 − 실제 기계시간 × 표준 배부율" },
      { key: "vohEff", grp: "변동간접비", name: "변동간접비 능률", val: (x.mchAH - SM) * x.vohR / K, why: "실제 기계시간 − 표준 기계시간 × 표준 배부율" },
      { key: "fohBudget", grp: "고정간접비", name: "고정간접비 예산", val: x.fohA - x.fohBudget, why: "실제 고정간접비 − 예산" },
      { key: "fohVol", grp: "고정간접비", name: "조업도", val: x.fohBudget - SM * st.fohRate / K, why: "예산 − 표준 기계시간 × 고정 배부율 (기준 조업도보다 덜 만들면 불리)" }
    ];
    const stdCost = P * st.unit.full / K;
    const actual = x.matAQ * x.matAP / K + x.labAH * x.labAR / K + x.vohA + x.fohA;
    return { st: st, list: v, total: sum(v.map((d) => d.val)), stdCost: stdCost, actual: actual, util: P / x.normal };
  }
  /* 조업도 차이를 생산량 함수로(다른 조건 그대로) */
  const volVar = (x, prod) => x.fohBudget - prod * x.mchH * standard(x).fohRate / K;
  /* 전부원가 대 변동원가 손익. 기초재고 없음, 차이는 모두 당기 매출원가(또는 기간비용)로 */
  function costing(x, prorate) {
    const V = variances(x), u = V.st.unit, rev = x.sold * x.price / K, sell = x.sold * x.sellV / K;
    const varVar = sum(V.list.filter((d) => d.grp !== "고정간접비").map((d) => d.val));
    const fixVar = sum(V.list.filter((d) => d.grp === "고정간접비").map((d) => d.val));
    /* 전부원가: 표준 전부원가로 재고, 차이는 매출원가(prorate면 기말재고와 판매분에 수량 비례로 나눔) */
    const share = prorate ? x.sold / x.prod : 1;
    const absCogs = x.sold * u.full / K + V.total * share;
    const absOI = rev - absCogs - sell - x.sga;
    /* 변동원가: 표준 변동원가로 재고, 실제 고정간접비는 기간비용 */
    const varCogs = x.sold * u.vari / K + varVar * share;
    const varOI = rev - varCogs - sell - x.fohA - x.sga;
    const endInvAbs = (x.prod - x.sold) * u.full / K + (prorate ? V.total * (1 - share) : 0);
    const endInvVar = (x.prod - x.sold) * u.vari / K + (prorate ? varVar * (1 - share) : 0);
    return { rev: rev, absOI: absOI, varOI: varOI, diff: absOI - varOI, theory: (x.prod - x.sold) * u.foh / K, endInvAbs: endInvAbs, endInvVar: endInvVar, fixVar: fixVar, varVar: varVar };
  }

  /* ---------- 2. 사업부 손익과 배부 ---------- */
  const DIV = {
    names: ["A 반도체 부품", "B 산업용 세라믹", "C 신사업"],
    rev: [3200, 1500, 500], varCost: [1700, 900, 300], direct: [500, 300, 130],
    common: 700,                                   /* 본사 공통비 */
    bases: { "매출액": [3200, 1500, 500], "인원": [180, 120, 60], "면적": [5000, 4000, 3000], "설비 사용시간": [9000, 5000, 1000] },
    /* 보조부문: 전력·유틸리티(S1), 설비보전(S2). use[i] = [S1, S2, A, B, C] 받는 비율 */
    svc: { names: ["전력·유틸리티", "설비보전"], cost: [600, 400], use: [[0, 0.20, 0.40, 0.30, 0.10], [0.10, 0, 0.50, 0.30, 0.10]] }
  };
  function divisions(d, basis) {
    const n = d.rev.length, b = d.bases[basis], tb = sum(b);
    const cm = d.rev.map((r, i) => r - d.varCost[i]), dcm = cm.map((c, i) => c - d.direct[i]);
    const alloc = b.map((v) => d.common * v / tb), oi = dcm.map((v, i) => v - alloc[i]);
    return { cm: cm, dcm: dcm, alloc: alloc, oi: oi, total: sum(oi), n: n };
  }
  function allBases(d) { const out = {}; Object.keys(d.bases).forEach((k) => { out[k] = divisions(d, k); }); return out; }
  /* 보조부문 배부 결과: 운영부문(A,B,C)이 받는 금액 */
  function service(d, method) {
    const s = d.svc, c = s.cost, u = s.use, ops = [2, 3, 4];
    if (method === "direct") {
      return ops.map((j) => sum([0, 1].map((i) => c[i] * u[i][j] / sum(ops.map((k) => u[i][k])))));
    }
    if (method === "step") { /* S1 먼저: S1은 S2와 운영부문에, S2는 (받은 몫 포함) 운영부문에만 */
      const toS2 = c[0] * u[0][1], s2 = c[1] + toS2, o2 = sum(ops.map((k) => u[1][k]));
      return ops.map((j) => c[0] * u[0][j] + s2 * u[1][j] / o2);
    }
    /* 상호배부: T1 = c1 + u21·T2, T2 = c2 + u12·T1 */
    const T = S.solve([[1, -u[1][0]], [-u[0][1], 1]], [c[0], c[1]]);
    return ops.map((j) => T[0] * u[0][j] + T[1] * u[1][j]);
  }
  const reciprocalTotals = (d) => { const u = d.svc.use, c = d.svc.cost; return S.solve([[1, -u[1][0]], [-u[0][1], 1]], [c[0], c[1]]); };
  /* 사업부 하나를 접으면: 직접 고정비는 없어지고 공통비·보조부문비는 남는다고 본다 */
  function dropTest(d, idx) {
    const r = divisions(d, "매출액"), keep = r.dcm.filter((_, i) => i !== idx);
    return { before: r.total, after: sum(keep) - d.common, loss: r.dcm[idx] };
  }

  /* ---------- 3. 재고 ---------- */
  const INV = {
    cogsYear: 36000, inv: { "원재료": 2400, "재공품": 1500, "제품": 2900 },
    aging: [["0~90일", 4200, 0], ["91~180일", 1300, 0.1], ["181~365일", 800, 0.3], ["365일 초과", 500, 1.0]], /* [구간, 금액, 충당 비율] */
    nrv: [ /* [품목, 수량, 단위 장부원가, 예상 판매가, 추가 완성원가, 판매비] (천원) */
      ["구형 히터 모듈", 1200, 95, 120, 5, 8], ["단종 예정 링", 4000, 18, 16, 0, 1.5], ["시제품 재고", 300, 210, 140, 20, 10], ["표준 세라믹 판", 9000, 22, 31, 0, 2]],
    eoq: { D: 240000, S: 0.8, H: 2.4, dailySd: 160, lead: 9, z: 1.65 } /* 연간 수요(개), 1회 주문비(백만원), 단위 연 보유비(천원), 일 수요 표준편차, 조달기간(일) */
  };
  function inventory(I) {
    const total = sum(Object.values(I.inv)), dio = total / I.cogsYear * 365, perDay = I.cogsYear / 365;
    const reserve = sum(I.aging.map((a) => a[1] * a[2])), aged = sum(I.aging.map((a) => a[1]));
    const nrv = I.nrv.map((r) => { const v = r[3] - r[4] - r[5], loss = Math.max(0, r[2] - v) * r[1] / K; return { name: r[0], qty: r[1], cost: r[2], nrv: v, loss: loss, book: r[1] * r[2] / K }; });
    return { total: total, dio: dio, perDay: perDay, reserve: reserve, aged: aged, nrv: nrv, nrvLoss: sum(nrv.map((r) => r.loss)) };
  }
  /* 경제적 주문량: 주문비 S(백만원)·보유비 H(천원/개·년) 단위를 맞춰 Q* = √(2DS/H) */
  function eoq(e) {
    const S1 = e.S * K;                                            /* 천원 */
    const q = Math.sqrt(2 * e.D * S1 / e.H), cost = (Q) => (e.D / Q * S1 + Q / 2 * e.H) / K;
    const ss = e.z * e.dailySd * Math.sqrt(e.lead), rop = e.D / 365 * e.lead + ss;
    return { q: q, orders: e.D / q, cost: cost, minCost: cost(q), ss: ss, rop: rop, ssCost: ss * e.H / K };
  }

  /* ---------- 4. 의사결정 ---------- */
  const DEC = {
    special: { cap: 120000, base: 100000, price: 80, vc: 47, qty: 25000, offer: 58, extraFixed: 40 },
    make: { qty: 50000, vc: 21, avoidFixed: 260, buy: 27, freedCM: 120 },
    mix: { cap: 30000, items: [["P1 고정밀 히터", 120, 70, 8, 2500], ["P2 정전척 부품", 90, 52, 3, 4000], ["P3 범용 세라믹", 40, 22, 1, 9000]] } /* [제품, 단가, 변동비, 병목 분/개, 최대 수요], cap = 병목 분 */
  };
  function special(o) {
    const free = Math.max(0, o.cap - o.base), take = o.qty, displaced = Math.max(0, take - free);
    const gain = take * (o.offer - o.vc) / K - o.extraFixed - displaced * (o.price - o.vc) / K;
    return { free: free, displaced: displaced, gain: gain, minPrice: o.vc + (o.extraFixed + displaced * (o.price - o.vc) / K) * K / take };
  }
  function makeBuy(m) { const make = m.qty * m.vc / K + m.avoidFixed, buy = m.qty * m.buy / K - m.freedCM; return { make: make, buy: buy, diff: buy - make, indiff: (make + m.freedCM) * K / m.qty }; }
  /* 병목 하나: 분당 공헌이익 순으로 수요까지 채운다(연속 수량이면 최적) */
  function mix(M, by) {
    const it = M.items.map((r) => ({ name: r[0], cm: r[1] - r[2], min: r[3], dem: r[4], cmMin: (r[1] - r[2]) / r[3] }));
    const order = it.map((_, i) => i).sort((a, b) => (by === "unit" ? it[b].cm - it[a].cm : it[b].cmMin - it[a].cmMin));
    let left = M.cap; const qty = it.map(() => 0);
    order.forEach((i) => { const q = Math.min(it[i].dem, left / it[i].min); qty[i] = q; left -= q * it[i].min; });
    return { items: it, order: order, qty: qty, cm: sum(qty.map((q, i) => q * it[i].cm)) / K, left: left };
  }
  /* 여러 제품의 손익분기: 매출 구성비가 고정일 때 가중 공헌이익률 */
  function multiBep(d, mixShares) {
    const cmr = d.rev.map((r, i) => (r - d.varCost[i]) / r), w = mixShares || d.rev.map((r) => r / sum(d.rev));
    const wcmr = sum(cmr.map((c, i) => c * w[i])), fixed = sum(d.direct) + d.common;
    return { cmr: cmr, w: w, wcmr: wcmr, fixed: fixed, bep: fixed / wcmr, rev: sum(d.rev), mos: 1 - fixed / wcmr / sum(d.rev) };
  }

  /* ---------- 판매 차이(PVM) 영업이익 브리지 ----------
     제품 i의 계획(qb, pb, vb)과 실적(qa, pa, va). 수량 천 개, 단가·단위 변동비 만원 → 금액 억원 = 수량 × 단가 ÷ 10.
     물량 = (실적 총수량 − 계획 총수량) × 계획 구성비 기준 가중평균 단위 공헌이익
     믹스 = Σ(실적 수량 − 실적 총수량 × 계획 구성비) × 계획 단위 공헌이익
     단가 = Σ(실적 단가 − 계획 단가) × 실적 수량, 변동비 = −Σ(실적 변동비 − 계획 변동비) × 실적 수량, 고정비 = −(실적 − 계획)
     다섯 효과의 합 = 실적 영업이익 − 계획 영업이익 */
  const PVM = {
    items: [
      { name: "A 고부가 부품", qb: 30, pb: 60, vb: 30, qa: 24, pa: 62, va: 31 },
      { name: "B 범용 부품", qb: 100, pb: 20, vb: 14, qa: 118, pa: 19.2, va: 14.3 },
      { name: "C 신규 부품", qb: 20, pb: 40, vb: 26, qa: 22, pa: 39, va: 25 }
    ],
    fb: 120, fa: 123
  };
  function pvm(d) {
    const it = d.items, U = 10, TQb = sum(it.map((x) => x.qb)), TQa = sum(it.map((x) => x.qa));
    const cmb = it.map((x) => x.pb - x.vb), mb = it.map((x) => (TQb > 0 ? x.qb / TQb : 0)), wcm = sum(cmb.map((c, i) => c * mb[i]));
    const rows = it.map((x, i) => ({ name: x.name, mixB: mb[i], mixA: TQa > 0 ? x.qa / TQa : 0, cmb: cmb[i], cma: x.pa - x.va,
      mix: (x.qa - TQa * mb[i]) * cmb[i] / U, price: (x.pa - x.pb) * x.qa / U, cost: -(x.va - x.vb) * x.qa / U,
      opB: x.qb * cmb[i] / U, opA: x.qa * (x.pa - x.va) / U, revB: x.qb * x.pb / U, revA: x.qa * x.pa / U }));
    const volume = (TQa - TQb) * wcm / U, mix = sum(rows.map((r) => r.mix)), price = sum(rows.map((r) => r.price)), cost = sum(rows.map((r) => r.cost)), fixed = -(d.fa - d.fb);
    const opB = sum(rows.map((r) => r.opB)) - d.fb, opA = sum(rows.map((r) => r.opA)) - d.fa;
    return { rows: rows, TQb: TQb, TQa: TQa, wcm: wcm, volume: volume, mix: mix, price: price, cost: cost, fixed: fixed, opB: opB, opA: opA, diff: opA - opB,
      revB: sum(rows.map((r) => r.revB)), revA: sum(rows.map((r) => r.revA)) };
  }

  return { K, STD, standard, variances, volVar, costing, DIV, divisions, allBases, service, reciprocalTotals, dropTest, INV, inventory, eoq, DEC, special, makeBuy, mix, multiBep, PVM, pvm };
});

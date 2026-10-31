/* M&A 가치평가 엔진: WACC, DCF(영구성장·출구배수), 유사기업·거래사례 배수, 가치 범위, 제시가 검토, 인수 후 재무 영향.
   금액 단위는 억원, 비율 입력은 % 숫자(12 = 12%)로 받는다. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../fin.js") : root.Fin);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MAEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin) {
  "use strict";

  const YEARS = ["2027E", "2028E", "2029E", "2030E", "2031E"];

  /* 가상 대상회사 T: 반도체 공정용 소모성 부품, 국내 비상장 */
  const DEFAULTS = {
    base: { revenue: 1200, margin: 20, da: 6, nwc: 18 },
    grid: {
      growth: [12, 10, 8, 6, 4],
      margin: [22, 23, 24, 24.5, 25],
      da: [6, 6, 6, 6, 6],
      capex: [9, 8, 7, 6.5, 6.5],
      nwc: [18, 18, 18, 18, 18]
    },
    tax: 24.2,
    wacc: { rf: 3.0, mrp: 7.0, betaU: 1.05, de: 30, size: 0.5, kd: 5.0 },
    tv: { method: "gordon", g: 2.5, ronic: 14, exit: 7.0 },
    midYear: false,
    bridge: { netDebt: 280, minority: 0, nonop: 40 },
    peers: [
      { name: "피어 A", ev: 8.2, pe: 14.5 },
      { name: "피어 B", ev: 9.6, pe: 17.0 },
      { name: "피어 C", ev: 7.4, pe: 12.8 },
      { name: "피어 D", ev: 11.3, pe: 21.0 },
      { name: "피어 E", ev: 8.9, pe: 15.6 }
    ],
    deals: [
      { name: "거래 1 (2023)", ev: 10.5 },
      { name: "거래 2 (2024)", ev: 9.2 },
      { name: "거래 3 (2024)", ev: 12.0 },
      { name: "거래 4 (2025)", ev: 8.6 }
    ],
    offer: { equity: 2300, stake: 100 },
    acq: { ebitda: 1100, ebit: 650, netDebt: 1600, interest: 85, rate: 5.0, debtShare: 60 }
  };

  function wacc(w, taxPct) {
    const t = taxPct / 100, de = w.de / 100;
    const betaL = w.betaU * (1 + (1 - t) * de);
    const ke = w.rf / 100 + betaL * w.mrp / 100 + w.size / 100;
    const kdAfter = (w.kd / 100) * (1 - t);
    const wd = de / (1 + de), we = 1 / (1 + de);
    return { betaL: betaL, ke: ke, kdAfter: kdAfter, wd: wd, we: we, wacc: we * ke + wd * kdAfter };
  }

  /* 연도별 추정 */
  function project(x) {
    const t = x.tax / 100, rows = [];
    let rev = x.base.revenue, nwcPrev = x.base.revenue * x.base.nwc / 100;
    for (let i = 0; i < YEARS.length; i++) {
      rev = rev * (1 + x.grid.growth[i] / 100);
      const ebitda = rev * x.grid.margin[i] / 100;
      const da = rev * x.grid.da[i] / 100;
      const ebit = ebitda - da;
      const nopat = ebit * (1 - t);
      const capex = rev * x.grid.capex[i] / 100;
      const nwc = rev * x.grid.nwc[i] / 100;
      const dnwc = nwc - nwcPrev; nwcPrev = nwc;
      rows.push({ year: YEARS[i], rev: rev, ebitda: ebitda, da: da, ebit: ebit, nopat: nopat, capex: capex, dnwc: dnwc, fcff: nopat + da - capex - dnwc });
    }
    const ltm = {
      rev: x.base.revenue,
      ebitda: x.base.revenue * x.base.margin / 100,
      ebit: x.base.revenue * (x.base.margin - x.base.da) / 100
    };
    return { rows: rows, ltm: ltm };
  }

  /* 영구가치. 영구성장은 가치동인 공식: FCFF(N+1) = NOPAT(N+1) × (1 − g / RONIC) */
  function terminal(x, proj, r, method, g, exitMult) {
    const last = proj.rows[proj.rows.length - 1];
    if (method === "exit") return last.ebitda * exitMult;
    if (!(r > g)) return null;
    const nopat1 = last.nopat * (1 + g);
    const reinvest = g / (x.tv.ronic / 100);
    return nopat1 * (1 - reinvest) / (r - g);
  }

  /* 할인과 합산. 기중 할인이면 연도 현금흐름은 t − 0.5, 영구성장 가치도 N − 0.5, 출구배수 가치는 매각 시점 N */
  function dcfAt(x, proj, r, method, g, exitMult) {
    const N = proj.rows.length, mid = !!x.midYear;
    let pvFcff = 0;
    proj.rows.forEach((row, i) => { pvFcff += row.fcff / Math.pow(1 + r, mid ? i + 0.5 : i + 1); });
    const tv = terminal(x, proj, r, method, g, exitMult);
    if (tv === null) return null;
    const tvT = method === "gordon" && mid ? N - 0.5 : N;
    const pvTv = tv / Math.pow(1 + r, tvT);
    return { pvFcff: pvFcff, tv: tv, pvTv: pvTv, ev: pvFcff + pvTv };
  }

  const toEquity = (x, ev) => ev - x.bridge.netDebt - x.bridge.minority + x.bridge.nonop;
  const toEV = (x, eq) => eq + x.bridge.netDebt + x.bridge.minority - x.bridge.nonop;

  function stats(list) {
    return { q1: Fin.quantile(list, 0.25), med: Fin.median(list), q3: Fin.quantile(list, 0.75), n: list.filter((v) => v !== null && isFinite(v)).length };
  }

  function value(x) {
    const w = wacc(x.wacc, x.tax), r = w.wacc;
    const proj = project(x);
    const g = x.tv.g / 100, method = x.tv.method, em = x.tv.exit;
    const base = dcfAt(x, proj, r, method, g, em);
    const last = proj.rows[proj.rows.length - 1], ntm = proj.rows[0];
    const out = { w: w, proj: proj, method: method, ok: !!base };
    if (!base) return out;

    /* 다른 방법으로 본 영구가치 교차 확인 */
    const gordonTv = terminal(x, proj, r, "gordon", g, em);
    out.dcf = base;
    out.equity = toEquity(x, base.ev);
    out.tvShare = base.pvTv / base.ev;
    out.impliedExit = gordonTv !== null ? gordonTv / last.ebitda : null;
    const exitTv = last.ebitda * em;
    out.impliedG = (exitTv * r - last.fcff) / (exitTv + last.fcff);
    out.evLtm = base.ev / proj.ltm.ebitda;
    out.evNtm = base.ev / ntm.ebitda;

    /* 민감도: 행은 g 또는 출구배수, 열은 WACC. 각 칸은 전체를 다시 계산 */
    const dr = [-0.01, -0.005, 0, 0.005, 0.01];
    const rowsAxis = method === "gordon" ? [-0.01, -0.005, 0, 0.005, 0.01].map((d) => g + d) : [-2, -1, 0, 1, 2].map((d) => em + d);
    out.sens = {
      cols: dr.map((d) => r + d),
      rows: rowsAxis,
      cells: rowsAxis.map((rv) => dr.map((d) => {
        const res = method === "gordon" ? dcfAt(x, proj, r + d, "gordon", rv, em) : dcfAt(x, proj, r + d, "exit", g, rv);
        return res ? res.ev : null;
      }))
    };

    /* 가치 범위(기업가치 기준) */
    const span = (fn, list) => { const vals = list.map(fn).filter((v) => v !== null); return { lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals) }; };
    const grid3 = (a, b) => { const o = []; a.forEach((p) => b.forEach((q) => o.push([p, q]))); return o; };
    const gordonSpan = span((pq) => { const z = dcfAt(x, proj, r + pq[0], "gordon", g + pq[1], em); return z ? z.ev : null; }, grid3([-0.01, 0, 0.01], [-0.005, 0, 0.005]));
    const exitSpan = span((pq) => dcfAt(x, proj, r + pq[0], "exit", g, em + pq[1]).ev, grid3([-0.01, 0, 0.01], [-1, 0, 1]));
    const gordonMid = dcfAt(x, proj, r, "gordon", g, em), exitMid = dcfAt(x, proj, r, "exit", g, em);

    /* 상대가치: 유사기업은 내년(NTM) 이익, 거래사례는 직전(LTM) EBITDA에 적용 */
    const tax = x.tax / 100;
    const interestNtm = x.bridge.netDebt * (x.wacc.kd / 100);
    const niNtm = (ntm.ebit - interestNtm) * (1 - tax);
    const pEv = stats(x.peers.map((p) => p.ev)), pPe = stats(x.peers.map((p) => p.pe)), dEv = stats(x.deals.map((d) => d.ev));
    out.rel = { niNtm: niNtm, interestNtm: interestNtm, pEv: pEv, pPe: pPe, dEv: dEv };
    const evFromPe = (m) => toEV(x, m * niNtm);

    out.ranges = [
      { key: "gordon", label: "DCF · 영구성장", note: "WACC ±1%p, 영구성장률 ±0.5%p", lo: gordonSpan.lo, hi: gordonSpan.hi, mid: gordonMid ? gordonMid.ev : null },
      { key: "exit", label: "DCF · 출구배수", note: "WACC ±1%p, 출구배수 ±1배", lo: exitSpan.lo, hi: exitSpan.hi, mid: exitMid.ev },
      { key: "peerEv", label: "유사기업 EV/EBITDA", note: "사분위 범위 × " + YEARS[0] + " EBITDA", lo: pEv.q1 * ntm.ebitda, hi: pEv.q3 * ntm.ebitda, mid: pEv.med * ntm.ebitda },
      { key: "peerPe", label: "유사기업 PER", note: "사분위 범위 × " + YEARS[0] + " 순이익, 기업가치로 환산", lo: evFromPe(pPe.q1), hi: evFromPe(pPe.q3), mid: evFromPe(pPe.med) },
      { key: "deal", label: "거래사례 EV/EBITDA", note: "사분위 범위 × 직전 연도 EBITDA, 경영권 프리미엄 포함", lo: dEv.q1 * proj.ltm.ebitda, hi: dEv.q3 * proj.ltm.ebitda, mid: dEv.med * proj.ltm.ebitda }
    ];

    /* 제시가 검토 */
    const o = x.offer, stake = o.stake / 100;
    const offerEv = toEV(x, o.equity);
    const premium = o.equity / out.equity - 1;
    const excess = o.equity - out.equity;
    /* 지분 100% 기준 초과 지급액을 영구 시너지로 회수하려면: 세후 S = 초과액 × (WACC − g) */
    const synAfter = excess > 0 && r > g ? excess * (r - g) : 0;
    const synPre = synAfter / (1 - tax);
    out.offer = {
      ev: offerEv, evLtm: offerEv / proj.ltm.ebitda, evNtm: offerEv / ntm.ebitda,
      premium: premium, excess: excess, synAfter: synAfter, synPre: synPre, synShare: synPre / ntm.ebitda,
      paid: o.equity * stake, stake: stake
    };

    /* 인수 후 재무 영향: 지분 50% 초과면 대상회사를 연결한다 */
    const a = x.acq, consol = stake > 0.5;
    const newDebt = out.offer.paid * a.debtShare / 100;
    const nd0 = a.netDebt, ebitda0 = a.ebitda;
    const nd1 = a.netDebt + newDebt + (consol ? x.bridge.netDebt : 0);
    const ebitda1 = a.ebitda + (consol ? proj.ltm.ebitda : 0);
    const int1 = a.interest + newDebt * a.rate / 100 + (consol ? x.bridge.netDebt * x.wacc.kd / 100 : 0);
    const ebit1 = a.ebit + (consol ? proj.ltm.ebit : 0);
    out.proforma = {
      consol: consol, newDebt: newDebt,
      before: { nd: nd0, ebitda: ebitda0, lev: nd0 / ebitda0, icr: a.ebit / a.interest },
      after: { nd: nd1, ebitda: ebitda1, lev: nd1 / ebitda1, icr: ebit1 / int1, interest: int1 }
    };
    return out;
  }

  /* 재무실사(FDD) 결과를 가격에 반영 (완결 회계 방식).
     정상화 EBITDA 조정은 제시가가 암시하는 EV/EBITDA 배수로 기업가치에 옮기고,
     순차입금에 없는 부채성 항목은 빼고, 거래종결 시점 운전자본이 정상 수준(peg)과 다른 만큼 가감한다. */
  const FDD_DEFAULTS = {
    qoe: [
      { label: "일회성 소송 합의금 가산", amount: 8 },
      { label: "특수관계자 매출 단가 시가 조정", amount: -6 },
      { label: "재고자산 평가손실 반영", amount: -4 }
    ],
    debtLike: [
      { label: "퇴직급여 미적립분", amount: 25 },
      { label: "리스부채", amount: 30 },
      { label: "미지급 법인세·소송 충당", amount: 15 }
    ],
    nwcPeg: 216, nwcClose: 200
  };

  function fdd(x, v, f) {
    const ltm = v.proj.ltm.ebitda, offerEv = v.offer.ev;
    const qoe = Fin.sum(f.qoe.map((q) => q.amount || 0));
    const multiple = offerEv / ltm;
    const evAdj = qoe * multiple;
    const debtLike = Fin.sum(f.debtLike.map((d) => d.amount || 0));
    const nwcAdj = f.nwcClose - f.nwcPeg;
    const price = x.offer.equity + evAdj - debtLike + nwcAdj;
    return {
      ltm: ltm, norm: ltm + qoe, qoe: qoe, multiple: multiple, offerEv: offerEv, evAdj: evAdj, ev2: offerEv + evAdj,
      debtLike: debtLike, nwcAdj: nwcAdj, base: x.offer.equity, price: price, diff: price - x.offer.equity,
      /* 같은 값을 기업가치 → 지분가치 브리지로 다시 계산 (검산용) */
      viaBridge: toEquity(x, offerEv + evAdj) - debtLike + nwcAdj
    };
  }

  return { YEARS, DEFAULTS, FDD_DEFAULTS, wacc, project, terminal, dcfAt, value, toEquity, toEV, fdd };
});

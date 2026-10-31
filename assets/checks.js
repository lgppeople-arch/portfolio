/* 검산: 사이트의 모든 계산 엔진이 지켜야 할 항등식과 규칙.
   노드(node assets/checks.js)와 브라우저(tools/checks.html)에서 같은 코드가 돈다. */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const env = node ? {
    Fin: require("./fin.js"),
    Post: require("./engines/post.js"),
    MA: require("./engines/ma.js"),
    Holdco: require("./engines/holdco.js"),
    Cash: require("./engines/cash.js")
  } : null;
  const api = factory();
  if (node) {
    module.exports = api;
    if (require.main === module) {
      const res = api.run(env);
      res.forEach((r) => console.log((r.ok ? "PASS" : "FAIL") + "  [" + r.group + "] " + r.name + (r.detail ? "  — " + r.detail : "")));
      const bad = res.filter((r) => !r.ok).length;
      console.log("\n" + (res.length - bad) + " / " + res.length + " 통과");
      process.exitCode = bad ? 1 : 0;
    }
  } else root.Checks = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const TOL = 1e-6;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* 설비투자 분석 키트(tools/capex-kit.html)의 runModel을 그대로 옮긴 기준 구현 */
  function legacyNpv(p) {
    const N = Math.round(p.years), r = p.rate / 100, tax = p.tax / 100, capex = p.capex;
    const depY = capex / p.taxlife, fcf = [-capex];
    let wcPrev = 0;
    for (let t = 1; t <= N; t++) {
      const baseU = t === 1 ? p.ramp1 : t === 2 ? p.ramp2 : p.util;
      const u = Math.min(baseU / 100, 1), units = p.capa * u;
      const asp = p.asp * Math.pow(1 - p.cr / 100, t - 1);
      const rev = units * asp / 100, vc = units * p.uvc / 100, dep = t <= p.taxlife ? depY : 0;
      const ebit = rev - vc - p.fixed - dep, maint = capex * p.maint / 100, wc = rev * p.wc / 100;
      const dwc = wc - wcPrev; wcPrev = wc;
      let f = ebit - ebit * tax + dep - maint - dwc;
      if (t === N) {
        const book = Math.max(capex - depY * Math.min(N, p.taxlife), 0), salv = capex * p.salvage / 100;
        f += salv - (salv - book) * tax + wc;
      }
      fcf.push(f);
    }
    return fcf.reduce((s, c, i) => s + c / Math.pow(1 + r, i), 0);
  }

  /* 재현 가능한 의사난수 */
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function run(env) {
    const { Fin, Post, MA, Holdco, Cash } = env;
    const out = [];
    const add = (group, name, ok, detail) => out.push({ group: group, name: name, ok: !!ok, detail: detail || "" });
    const near = (a, b, tol) => Math.abs(a - b) <= (tol || TOL) * Math.max(1, Math.abs(a), Math.abs(b));
    const fmt = (x) => (Math.abs(x) < 1e-9 ? "0" : x.toExponential(1));

    /* ---------- 공통 계산 ---------- */
    {
      const flows = [-300, 40, 60, 80, 90, 100, 110];
      const r = Fin.irr(flows);
      add("공통", "할인율을 IRR로 두면 NPV는 0", near(Fin.npv(r, flows), 0, 1e-9), "IRR " + (r * 100).toFixed(4) + "%, NPV " + fmt(Fin.npv(r, flows)));
      const q = Fin.quantile([1, 2, 3, 4], 0.25), m = Fin.median([5, 1, 3]);
      add("공통", "사분위수가 엑셀 PERCENTILE.INC와 같다", q === 1.75 && m === 3, "{1,2,3,4}의 25% = " + q);
      add("공통", "회수기간은 누적 현금흐름이 0이 되는 시점", near(Fin.payback([-100, 30, 30, 30, 30]), 3 + 10 / 30), Fin.payback([-100, 30, 30, 30, 30]).toFixed(4) + "년");
    }

    /* ---------- 투자 사후관리 ---------- */
    {
      const R = rng(7);
      let worst = 0;
      for (let i = 0; i < 200; i++) {
        const p = {
          capex: 100 + R() * 900, years: 5 + Math.floor(R() * 11), taxlife: 3 + Math.floor(R() * 10), maint: R() * 4, salvage: R() * 20,
          capa: 50 + R() * 400, util: 50 + R() * 50, ramp1: 20 + R() * 60, ramp2: 40 + R() * 60, asp: 50 + R() * 200, cr: R() * 5,
          uvc: 20 + R() * 60, fixed: R() * 80, wc: R() * 30, tax: 10 + R() * 20, rate: 3 + R() * 10
        };
        const d = Math.abs(Post.run(p, Post.planPath(p)).npv - legacyNpv(p));
        if (d > worst) worst = d;
      }
      add("사후관리", "계획 NPV가 설비투자 분석 키트 계산과 같다 (무작위 가정 200개)", worst < 1e-9, "최대 차이 " + fmt(worst) + "억원");

      const p = Object.assign({}, Post.PLAN_DEFAULTS);
      add("사후관리", "예시 가정의 계획 NPV는 설비투자 분석 키트와 같은 41.7억원", Post.run(p, Post.planPath(p)).npv.toFixed(1) === "41.7", Post.run(p, Post.planPath(p)).npv.toFixed(4) + "억원");
      [1, 2, 3].forEach((k) => {
        const r = Post.analyze(p, Post.planAsActual(p, k));
        add("사후관리", "실적을 계획과 같게 두면 재추정 NPV 차이는 0 (경과 " + k + "년)", Math.abs(r.ma.npv - r.mp.npv) < 1e-9 && r.att.shapley.every((v) => Math.abs(v) < 1e-9), "차이 " + fmt(r.ma.npv - r.mp.npv) + "억원");
      });
      [1, 2, 3].forEach((k) => {
        const r = Post.analyze(p, Post.sampleActual(p, k));
        const total = r.ma.npv - r.mp.npv;
        const sumS = Fin.sum(r.att.shapley), sumQ = Fin.sum(r.att.seq);
        add("사후관리", "동인별 기여도를 더하면 총 NPV 차이 (경과 " + k + "년)", near(sumS, total) && near(sumQ, total), "총 차이 " + total.toFixed(4) + ", 샤플리 합 " + sumS.toFixed(4) + ", 단계 대체 합 " + sumQ.toFixed(4));
        const inside = r.att.shapley.every((v, i) => v >= r.att.lo[i] - TOL && v <= r.att.hi[i] + TOL);
        add("사후관리", "샤플리 값은 대체 순서별 기여 범위 안에 있다 (경과 " + k + "년)", inside, "");
      });
    }

    /* ---------- M&A 가치평가 ---------- */
    {
      const x = clone(MA.DEFAULTS);
      const v = MA.value(x);
      add("M&A", "기업가치 → 지분가치 → 기업가치가 원래 값으로 돌아온다", near(MA.toEV(x, MA.toEquity(x, v.dcf.ev)), v.dcf.ev), v.dcf.ev.toFixed(2) + "억원");
      add("M&A", "민감도 표 가운데 칸은 기준 기업가치", near(v.sens.cells[2][2], v.dcf.ev), v.sens.cells[2][2].toFixed(2) + " = " + v.dcf.ev.toFixed(2));

      const x2 = clone(x); x2.tv.method = "exit"; x2.tv.exit = v.impliedExit;
      const v2 = MA.value(x2);
      add("M&A", "출구배수를 영구성장법이 암시하는 배수로 두면 두 DCF 값이 같다", near(v2.dcf.ev, v.dcf.ev), "출구배수 " + v.impliedExit.toFixed(3) + "배, " + v2.dcf.ev.toFixed(2) + " = " + v.dcf.ev.toFixed(2));

      const x3 = clone(x); x3.midYear = true;
      const v3 = MA.value(x3), r = v.w.wacc;
      add("M&A", "기중 할인은 기말 할인보다 기업가치를 (1 + WACC)^0.5배 높인다 (영구성장법)", near(v3.dcf.ev, v.dcf.ev * Math.sqrt(1 + r)), v3.dcf.ev.toFixed(2) + " = " + (v.dcf.ev * Math.sqrt(1 + r)).toFixed(2));

      const x4 = clone(x); x4.tv.ronic = r * 100;
      const v4 = MA.value(x4), last = v4.proj.rows[v4.proj.rows.length - 1];
      add("M&A", "RONIC = WACC면 영구가치는 NOPAT(N+1) ÷ WACC (성장이 가치를 만들지 않음)", near(v4.dcf.tv, last.nopat * (1 + x.tv.g / 100) / r), v4.dcf.tv.toFixed(2) + "억원");

      const w = MA.wacc(x.wacc, x.tax);
      add("M&A", "WACC 가중치 합은 1이고 무부채 베타를 재레버리지한 값과 맞다", near(w.wd + w.we, 1) && near(w.betaL, x.wacc.betaU * (1 + (1 - x.tax / 100) * x.wacc.de / 100)), "βL " + w.betaL.toFixed(4) + ", WACC " + (w.wacc * 100).toFixed(3) + "%");

      const x5 = clone(x); x5.offer.equity = v.equity;
      const v5 = MA.value(x5);
      add("M&A", "제시가가 DCF 지분가치와 같으면 필요 시너지는 0", Math.abs(v5.offer.synPre) < 1e-9 && Math.abs(v5.offer.premium) < 1e-12, "프리미엄 " + fmt(v5.offer.premium));

      const f0 = clone(MA.FDD_DEFAULTS);
      f0.qoe.forEach((q) => { q.amount = 0; }); f0.debtLike.forEach((d) => { d.amount = 0; }); f0.nwcClose = f0.nwcPeg;
      const z = MA.fdd(x, v, f0);
      add("M&A", "실사 조정이 모두 0이면 매매대금은 처음 제시가와 같다", Math.abs(z.diff) < 1e-9, "매매대금 " + z.price.toFixed(2) + " = 제시가 " + x.offer.equity);
      const fd = MA.fdd(x, v, clone(MA.FDD_DEFAULTS));
      add("M&A", "실사 반영 매매대금 = 조정 후 기업가치를 지분가치 브리지에 넣은 값", near(fd.price, fd.viaBridge), fd.price.toFixed(2) + " = " + fd.viaBridge.toFixed(2) + "억원");
    }

    /* ---------- 지주사 ---------- */
    {
      const x = clone(Holdco.DEFAULTS);
      const n = Holdco.nav(x.holdco, x.subs);
      const manual = Fin.sum(n.parts.map((p) => p.value)) + n.royaltyValue + x.holdco.other - x.holdco.netDebt;
      add("지주사", "NAV = 자회사 지분가치 합 + 로열티 순가치 + 기타자산 − 순차입금", near(n.nav, manual), n.nav.toFixed(2) + "억원");
      add("지주사", "주당 NAV × 유통주식수 = NAV (단위 환산)", near(n.perShare * (x.holdco.shares - x.holdco.treasury) / 1e4, n.nav), Math.round(n.perShare).toLocaleString("ko-KR") + "원");

      const y = clone(x), s = y.subs[y.sale.idx];
      s.book = Holdco.equity100(s) * s.stake / 100;
      y.sale.premium = 0;
      const sNeutral = Holdco.sale(y.holdco, y.subs, y.sale);
      add("지주사", "장부가로 장부가만큼 팔면(차익 0) NAV는 변하지 않는다", near(sNeutral.after.nav, sNeutral.before.nav) && Math.abs(sNeutral.tax) < 1e-9, "매각 전후 " + sNeutral.before.nav.toFixed(2) + " / " + sNeutral.after.nav.toFixed(2));

      const sc = Holdco.sale(x.holdco, x.subs, x.sale);
      const expect = (sc.cBefore.bookSum - sc.bookSold) / sc.h2.assets;
      add("지주사", "매각 후 지주비율 = (자회사 장부가 합 − 매각분) ÷ 매각 후 자산총액", near(sc.cAfter.holdRatio, expect), (sc.cAfter.holdRatio * 100).toFixed(2) + "%");
      const sumBS = sc.h2.assets - sc.h2.liab - sc.h2.equity, sumBS0 = x.holdco.assets - x.holdco.liab - x.holdco.equity;
      add("지주사", "매각 전후 재무상태표 차이(자산 − 부채 − 자본)가 그대로 유지된다", near(sumBS, sumBS0), "전 " + sumBS0.toFixed(2) + " / 후 " + sumBS.toFixed(2));
    }

    /* ---------- 13주 자금수지 ---------- */
    {
      const x = clone(Cash.DEFAULTS);
      const base = Cash.forecast(x);
      add("자금수지", "기초현금 + 모든 입출금 = 기말현금", Math.abs(base.check) < 1e-9, "차이 " + fmt(base.check));
      const weekly = base.weeks.every((w) => near(w.open + w.net, w.close));
      add("자금수지", "주차마다 기초 + 순현금흐름 = 기말", weekly, base.weeks.length + "주");

      const pay = base.events.find((e) => e.memo === "2026-12 급여");
      const wh = base.events.find((e) => e.memo === "2027-01 원천세·4대보험");
      const col = base.events.find((e) => e.memo === "2026-11 매출 회수");
      add("자금수지", "영업일 규칙: 성탄절 급여는 전날, 일요일 원천세는 다음 날, 일요일 말일 회수는 직전 금요일",
        pay && pay.date === "2026-12-24" && wh && wh.date === "2027-01-11" && col && col.date === "2027-01-29",
        (pay && pay.date) + " · " + (wh && wh.date) + " · " + (col && col.date));

      const st = clone(x); st.stress = { salesDrop: 10, delayWeeks: 2, capexPull: 0 };
      const s = Cash.forecast(st);
      const floorOk = s.daily.every((d) => !Cash.isBiz(d.t) || d.cash >= st.minCash - 1e-9 || d.drawn >= st.rcf.limit - 1e-9);
      add("자금수지", "한도대출을 켜면 영업일 마감 잔액이 최소 보유현금 밑으로 가지 않는다 (한도 안에서)", floorOk && Math.abs(s.check) < 1e-9, "스트레스 최저 " + s.lowDay.pre.toFixed(1) + "억원 → 인출 후 " + st.minCash + "억원 유지");

      const z = clone(x); z.stress = { salesDrop: 0, delayWeeks: 0, capexPull: 0 };
      add("자금수지", "스트레스를 0으로 두면 기본 결과와 같다", near(Cash.forecast(z).close, base.close), base.close.toFixed(2) + "억원");
    }
    return out;
  }

  return { run: run, legacyNpv: legacyNpv };
});

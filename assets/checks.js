/* 검산: 사이트의 모든 계산 엔진이 지켜야 할 항등식과 규칙.
   노드(node assets/checks.js)와 브라우저(tools/checks.html)에서 같은 코드가 돈다. */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const env = node ? {
    Fin: require("./fin.js"),
    Stats: require("./stats.js"),
    Capital: require("./engines/capital.js"),
    PlanRisk: require("./engines/planrisk.js"),
    Budget: require("./engines/budget.js"),
    Costs: require("./engines/costs.js"),
    CapexMc: require("./engines/capexmc.js"),
    KpiTree: require("./engines/kpitree.js"),
    StatLab: require("./engines/statlab.js"),
    Post: require("./engines/post.js"),
    MA: require("./engines/ma.js"),
    Holdco: require("./engines/holdco.js"),
    Cash: require("./engines/cash.js"),
    Fx: require("./engines/fx.js"),
    Mbo: require("./engines/mbo.js"),
    Pl: require("./engines/pl.js"),
    Three: require("./engines/three.js"),
    Cycle: require("./engines/cycle.js"),
    Samsung: require("./data/samsung.js"),
    Sectors: require("./data/sectors.js"),
    Deal: require("./data/deal-hhi.js"),
    Doa: require("./engines/doa.js")
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
    const { Fin, Stats, Capital, PlanRisk, Budget, Costs, CapexMc, KpiTree, StatLab, Post, MA, Holdco, Cash, Fx, Mbo, Pl, Three, Cycle, Samsung, Doa, Sectors, Deal } = env;
    const out = [];
    const add = (group, name, ok, detail) => out.push({ group: group, name: name, ok: !!ok, detail: detail || "" });
    const near = (a, b, tol) => Math.abs(a - b) <= (tol || TOL) * Math.max(1, Math.abs(a), Math.abs(b));
    const fmt = (x) => (Math.abs(x) < 1e-9 ? "0" : x.toExponential(1));
    const F_ = (x) => x.toFixed(2);

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
    if (Post) {
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
    if (MA) {
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
    if (Holdco) {
      const x = clone(Holdco.DEFAULTS);
      const n = Holdco.nav(x.holdco, x.subs);
      const manual = Fin.sum(n.parts.map((p) => p.value)) + n.royaltyValue + x.holdco.other - x.holdco.netDebt;
      add("지주사", "NAV = 자회사 지분가치 합 + 로열티 순가치 + 기타자산 − 순차입금", near(n.nav, manual), n.nav.toFixed(2) + "억원");
      add("지주사", "주당 NAV × 유통주식수 = NAV (단위 환산)", near(n.perShare * (x.holdco.shares - x.holdco.treasury) / 1e4, n.nav), Math.round(n.perShare).toLocaleString("ko-KR") + "원");
      if (Holdco.PRESETS && Holdco.PRESETS.lg) {
        const L = Holdco.PRESETS.lg, nl = Holdco.nav(L.holdco, L.subs), held = Fin.sum(nl.parts.map((p) => p.value));
        add("지주사", "㈜LG 공시값: 상장 관계사 보유 지분가치 합 = 사업보고서 시가 합 " + Fin.num(L.heldMarket, 0) + "억원", near(held, L.heldMarket, 1e-6), "NAV " + Fin.num(nl.nav, 0) + "억원 · 할인율 " + (nl.discount * 100).toFixed(1) + "%");
        const bsGap = L.holdco.assets - L.holdco.liab - L.holdco.equity;
        add("지주사", "㈜LG 공시값: 별도 자산총계 = 부채총계 + 자본총계", near(bsGap, 0, 0.01), "자산 " + Fin.num(L.holdco.assets, 0) + "억원");
        if (Sectors && Sectors.companies.lg) {
          const sec = Sectors.companies.lg.notes.listed.reduce((t, r) => t + r[2], 0) / 1e8;
          add("지주사", "㈜LG 공시값의 시가 합이 업종별 리포트 데이터(같은 공시)와 같다", near(sec, L.heldMarket, 1e-6), Fin.num(sec, 2) + "억원");
        }
      }

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

    /* ---------- 환리스크 헤지 ---------- */
    if (Fx) {
      const m = clone(Fx.DEFAULTS.mkt);
      let worstPc = 0;
      [1300, 1391.28, 1450].forEach((K) => [3, 6, 12].forEach((mo) => {
        const o = Fx.option(m, K, mo);
        worstPc = Math.max(worstPc, Math.abs((o.call - o.put) - o.df * (o.F - K)));
      }));
      add("환리스크", "풋-콜 패리티: 콜 − 풋 = 할인계수 × (선물환율 − 행사가)", worstPc < 1e-9, "최대 오차 " + fmt(worstPc) + "원");
      const same = Object.assign({}, m, { rf: m.rd });
      add("환리스크", "두 통화 금리가 같으면 선물환율 = 현물환율", near(Fx.forward(same, 6), same.spot), Fx.forward(same, 6).toFixed(4) + "원");

      const shocks = [-20, -10, 0, 10, 20];
      const d1 = clone(Fx.DEFAULTS.deal); d1.ratio = 100;
      const c1 = Fx.deal(m, d1, shocks).curve.map((c) => c.close.fwd);
      add("환리스크", "선물환으로 100% 헤지하면 종결 비용은 환율과 무관하다", c1.every((v) => near(v, c1[0])), F_(c1[0]) + "억원");
      const d0 = clone(Fx.DEFAULTS.deal); d0.ratio = 0;
      const c0 = Fx.deal(m, d0, shocks).curve;
      add("환리스크", "헤지 비율이 0이면 모든 전략이 헤지 안 함과 같다 (종결·무산)", c0.every((c) => ["fwd", "opt", "dc"].every((k) => near(c.close[k], c.close.none) && Math.abs(c.fail[k]) < 1e-9)), "");
      const dz = clone(Fx.DEFAULTS.deal); dz.dcp = 0;
      const cz = Fx.deal(m, dz, shocks).curve;
      add("환리스크", "딜 컨틴전트 선물환은 무산돼도 부담이 없고, 프리미엄 0이면 일반 선물환과 같다", cz.every((c) => c.fail.dc === 0 && near(c.close.dc, c.close.fwd)), "");
      const s = Fx.dealSetup(m, d1), up = Fx.dealAt(m, d1, s.K * 1.15, s);
      add("환리스크", "콜옵션 헤지의 종결 비용 상한 = (행사가 + 프리미엄의 종결 시점 가치) × 금액", near(up.close.opt, Fx.eok(d1.usd, s.K + s.premFV)), F_(up.close.opt) + "억원");
      const o1 = clone(Fx.DEFAULTS.ops); o1.ratios = [100, 100, 100];
      const a = Fx.ops(m, o1, -15).hedged, b = Fx.ops(m, o1, 15).hedged;
      add("환리스크", "수출 순노출을 100% 헤지하면 원화 매출은 환율과 무관하다", near(a, b), F_(a) + "억원");
    }

    /* ---------- 성과평가 ---------- */
    if (Mbo) {
      const sc = { th: 60, tg: 100, st: 120 };
      const up = (a) => Mbo.score({ dir: "up", th: 80, tg: 100, st: 110, act: a }, sc);
      const dn = (a) => Mbo.score({ dir: "down", th: 10, tg: 6, st: 4, act: a }, sc);
      const okUp = up(79) === 0 && up(80) === 60 && up(90) === 80 && up(100) === 100 && up(105) === 110 && up(130) === 120;
      const okDn = dn(11) === 0 && dn(10) === 60 && dn(8) === 80 && dn(6) === 100 && dn(5) === 110 && dn(1) === 120;
      add("성과평가", "KPI 점수 구간: 하한 60, 목표 100, 도전 120, 하한 미달 0 (클수록·작을수록 좋은 지표 모두)", okUp && okDn, "");
      const x = clone(Mbo.DEFAULTS), r = Mbo.evaluate(x);
      add("성과평가", "인센티브 배분액을 모두 더하면 총액과 같다", near(r.allocSum, x.pool), F_(r.allocSum) + "억원");
      const y = clone(x); y.grades.forEach((g) => { g.mult = 1; });
      const ry = Mbo.evaluate(y), heads = Fin.sum(y.orgs.map((o) => o.heads));
      add("성과평가", "등급 배수가 모두 같으면 인원 비례로 나뉜다", ry.orgs.every((o) => near(o.alloc, y.pool * o.heads / heads)), "");
      const z = clone(x); z.orgs.forEach((o) => o.kpis.forEach((k) => { k.w *= 2; }));
      add("성과평가", "가중치를 같은 비율로 키워도 조직 점수는 그대로다", Mbo.evaluate(z).orgs.every((o, i) => near(o.total, r.orgs[i].total)), "");
    }

    /* ---------- 월 손익 보고 ---------- */
    if (Pl) {
      const rows = Pl.sample();
      const all = Pl.report(rows, 9, "전사", "trend3");
      const parts = Pl.BUS.map((b) => Pl.report(rows, 9, b, "trend3"));
      add("손익보고", "사업부 합계 = 전사 (누계 매출·영업이익)", near(Fin.sum(parts.map((q) => q.ytd.act.rev)), all.ytd.act.rev) && near(Fin.sum(parts.map((q) => q.ytd.act.op)), all.ytd.act.op), F_(all.ytd.act.op) + "억원");
      const bridgeOk = [all].concat(parts).every((q) => near(Fin.sum(q.bridge.items.map((i) => i.v)), q.bridge.total));
      add("손익보고", "영업이익 차이 분해를 더하면 영업이익 차이와 같다 (전사·사업부)", bridgeOk, F_(all.bridge.total) + "억원");
      const plan = Pl.report(rows, 9, "전사", "plan");
      const months = Pl.cube(rows, "전사");
      let restOp = 0; for (let i = 9; i < 12; i++) restOp += Pl.derive(months[i].plan).op;
      add("손익보고", "계획 유지 방식이면 연간 전망 = 누계 실적 + 남은 달 계획", near(plan.year.outlook.op, plan.ytd.act.op + restOp), F_(plan.year.outlook.op) + "억원");
      const back = Pl.parse(Pl.toCsv(rows));
      add("손익보고", "표로 내보냈다가 다시 읽어도 결과가 같다", back.errors.length === 0 && near(Pl.report(back.rows, 9, "전사", "trend3").year.outlook.op, all.year.outlook.op), back.rows.length + "줄");
    }

    /* ---------- 세 재무제표 연결 모형 ---------- */
    if (Three) {
      const x = clone(Three.DEFAULTS), r = Three.run(x), ys = r.years;
      const maxAbs = (f) => Math.max.apply(null, ys.map((y) => Math.abs(f(y))));
      add("재무제표", "해마다 자산 = 부채 + 자본", ys.every((y) => Math.abs(y.check.balance) < 1e-9), ys.length + "년, 최대 차이 " + fmt(maxAbs((y) => y.check.balance)));
      add("재무제표", "현금흐름표의 기말현금 = 재무상태표의 현금", ys.every((y) => Math.abs(y.check.cashTie) < 1e-9), "최대 차이 " + fmt(maxAbs((y) => y.check.cashTie)));
      add("재무제표", "기초 자본 + 순이익 − 배당 = 기말 자본", ys.every((y) => Math.abs(y.check.reTie) < 1e-9), F_(ys[0].bs.eq) + "억원 (" + ys[0].year + ")");
      add("재무제표", "ROE = 순이익률 × 총자산회전율 × 재무레버리지 (DuPont)", ys.every((y) => near(y.r.roe, y.r.margin * y.r.turnover * y.r.leverage, 1e-12)), (ys[0].r.roe * 100).toFixed(2) + "%");
      const cfoOk = ys.every((y) => near(y.cf.cfo, y.is.ni + y.is.dep + y.cf.dAR + y.cf.dINV + y.cf.dAP));
      add("재무제표", "영업현금흐름 = 순이익 + 감가상각 + 운전자본 변동", cfoOk, F_(ys[0].cf.cfo) + "억원");
      /* 무작위 동인 300가지(적자·대규모 투자·차입 포함)에서도 항등식이 깨지지 않는지 */
      const rnd = rng(20261031);
      let worst = 0, floor = true, lossYears = 0, drawYears = 0;
      for (let k = 0; k < 300; k++) {
        const z = clone(Three.DEFAULTS), d = z.d;
        d.growth = -25 + rnd() * 70; d.cogs = 40 + rnd() * 60; d.sga = rnd() * 30; d.dep = rnd() * 20; d.capex = rnd() * 40;
        d.dso = rnd() * 150; d.dio = rnd() * 180; d.dpo = rnd() * 120; d.rate = rnd() * 12; d.tax = rnd() * 40; d.payout = rnd() * 100; d.minCash = rnd() * 300;
        Three.run(z).years.forEach((y) => {
          worst = Math.max(worst, Math.abs(y.check.balance) / Math.max(1, y.bs.assets), Math.abs(y.check.cashTie) / Math.max(1, y.bs.assets));
          if (y.bs.cash < d.minCash - 1e-9 || y.bs.debt < -1e-9) floor = false;
          if (y.is.ni < 0) lossYears++;
          if (y.cf.draw > 0) drawYears++;
        });
      }
      add("재무제표", "무작위 동인 300가지에서도 대차·현금이 맞는다 (적자·차입 포함)", worst < 1e-12, "적자 " + lossYears + "개 연도, 차입 " + drawYears + "개 연도");
      add("재무제표", "현금은 최소 보유현금 아래로 내려가지 않고, 차입금은 음수가 되지 않는다", floor, "300가지 × " + x.years + "년");
    }

    /* ---------- 반도체 사이클 개념 모형 ---------- */
    if (Cycle) {
      const D = Cycle.DEFAULTS, runWith = (o) => Cycle.run(Object.assign(clone(D), o));
      const st = runWith({ shock: 0 }).quarters;
      const steady = st.every((q) => Math.abs(q.gpm - D.target / 100) < 1e-9 && Math.abs(q.weeks - Cycle.CONST.wStar) < 1e-9 && Math.abs(q.priceIdx - 100) < 1e-9);
      add("반도체 사이클", "수요 충격이 없으면 가격·이익률·재고 주수가 정상 상태에서 움직이지 않는다", steady, st.length + "분기, 매출총이익률 " + D.target + "%");
      let n = 0, badUnits = 0, badGp = 0, badAllow = 0;
      [-20, -10, 0, 10, 20].forEach((sh) => [0, 1, 2, 3].forEach((rc) => [2, 5, 8].forEach((ld) => [false, true].forEach((ct) => {
        const r = runWith({ shock: sh, react: rc, lead: ld, cut: ct });
        let wdSum = 0;
        r.quarters.forEach((q) => {
          if (Math.abs(q.check.units) > 1e-9 * Math.max(1, q.inv)) badUnits++;
          if (Math.abs(q.check.gp) > 1e-9 * Math.max(1, Math.abs(q.rev))) badGp++;
          wdSum += q.wd;
          if (q.allow < -1e-12 || Math.abs(wdSum - q.allow) > 1e-9 * Math.max(1, q.rev)) badAllow++;
        });
        n++;
      }))));
      add("반도체 사이클", "재고 수량: 기초 + 생산 − 판매 = 기말 (" + n + "가지 설정 × 32분기)", badUnits === 0, "어긋난 분기 " + badUnits);
      add("반도체 사이클", "매출총이익 = 매출 − 당기 제조원가 + 재고(원가) 증가 − 평가손실 증가", badGp === 0, "어긋난 분기 " + badGp);
      add("반도체 사이클", "재고평가손실 누계 = 기말 충당금, 충당금은 음수가 되지 않는다(환입은 쌓인 만큼만)", badAllow === 0, "");
      const byReact = [0, 1, 2, 3].map((rc) => runWith({ react: rc }).summary.gpmMin);
      add("반도체 사이클", "투자 반응이 클수록 불황의 최저 매출총이익률이 낮다", byReact.every((v, i) => i === 0 || v <= byReact[i - 1] + 1e-12), byReact.map((v) => Fin.pct(v, 1)).join(" → "));
      const byLead = [2, 3, 4, 5, 6, 7, 8].map((ld) => runWith({ lead: ld }).summary.gpmMin);
      add("반도체 사이클", "투자 시차가 길수록 최저 매출총이익률이 낮다", byLead.every((v, i) => i === 0 || v <= byLead[i - 1] + 1e-12), "2분기 " + Fin.pct(byLead[0], 1) + " → 8분기 " + Fin.pct(byLead[6], 1));
      const a = runWith({ cut: false }), b = runWith({ cut: true });
      const idleOk = a.quarters.every((q) => q.idle === 0) && b.quarters.every((q) => (q.util < 1) === (q.idle > 0));
      add("반도체 사이클", "감산하면 최대 재고 주수가 줄고, 저조업 비용은 가동률을 낮춘 분기에만 생긴다", b.summary.weeksMax < a.summary.weeksMax && idleOk, a.summary.weeksMax.toFixed(1) + "주 → " + b.summary.weeksMax.toFixed(1) + "주");
    }

    /* ---------- 삼성전자 공시 원문 대조 (리포트 03) ---------- */
    if (Samsung) {
      const S = Samsung, I = S.is, B = S.bs, C = S.cf, N = S.notes;
      const eqAll = (pairs) => pairs.every((p) => p[0] === p[1]);
      const isP = ["2023", "2024", "2025", "2025H1", "2026H1", "2Q25", "2Q26"];
      add("삼성전자 공시", "손익계산서 소계: 매출총이익·영업이익·세전이익·순이익 (7개 기간)", eqAll([].concat.apply([], isP.map((p) => [
        [I.gp[p], I.rev[p] - I.cogs[p]], [I.op[p], I.gp[p] - I.sga[p]],
        [I.ebt[p], I.op[p] + I.oi[p] - I.oexp[p] + I.eq[p] + I.fin[p] - I.fcost[p]],
        [I.ni[p], I.ebt[p] - I.tax[p]], [I.ni[p], I.nip[p] + I.ninci[p]]]))), "백만원 단위 일치");
      const bsP = ["2023", "2024", "2025", "2026H1"];
      add("삼성전자 공시", "재무상태표: 자산 = 부채 + 자본, 유동 + 비유동 (4개 시점)", eqAll([].concat.apply([], bsP.map((p) => [
        [B.ta[p], B.ca[p] + B.nca[p]], [B.tl[p], B.cl[p] + B.ncl[p]], [B.te[p], B.pe[p] + B.nci[p]], [B.ta[p], B.tl[p] + B.te[p]]]))), "2026.6월말 자산 " + F_(B.ta["2026H1"] / 1e6) + "조원");
      const cfP = ["2023", "2024", "2025", "2025H1", "2026H1"];
      const det = (p) => S.cfDetail[p.indexOf("H1") > 0 ? "h1" : "annual"], col = { "2025": 0, "2024": 1, "2023": 2, "2026H1": 0, "2025H1": 1 };
      add("삼성전자 공시", "현금흐름표: 투자·재무활동 항목 합계, 영업활동 구성, 현금 증감 (5개 기간)", eqAll([].concat.apply([], cfP.map((p) => [
        [C.cfi[p], Fin.sum(det(p).cfi_items.map((r) => r[1][col[p]]))], [C.cff[p], Fin.sum(det(p).cff_items.map((r) => r[1][col[p]]))],
        [C.cfo[p], C.ni[p] + C.adj[p] + C.wc[p] + C.intr[p] + C.intp[p] + C.divr[p] + C.taxpaid[p]],
        [C.close[p] - C.open[p], C.cfo[p] + C.cfi[p] + C.cff[p] + C.fx[p] + (p === "2023" ? -14153 : 0)]]))), "");
      add("삼성전자 공시", "현금흐름표 기말현금 = 재무상태표 현금 (4개 시점)", eqAll(bsP.map((p) => [B.cash[p], C.close[p]])), "2026.6월말 " + F_(B.cash["2026H1"] / 1e6) + "조원");
      const segP = Object.keys(S.seg);
      add("삼성전자 공시", "부문 매출 합계 + 내부거래 = 연결 매출, 연결 영업이익과 일치 (" + segP.length + "개 기간)", segP.every((p) => {
        const r = S.seg[p].rev;
        return r.DX + r.DS + r.SDC + r.Harman + r.elim === r.total && (I.rev[p] === undefined || I.rev[p] === r.total) && (I.op[p] === undefined || I.op[p] === S.seg[p].op.total);
      }), "2026 상반기 DS 영업이익 " + F_(S.seg["2026H1"].op.DS / 1e6) + "조원");
      const inv = N.inventory, invOk = ["2024", "2025", "2026H1"].every((p) => {
        const x = inv[p], cats = ["fg", "wip", "raw", "transit"];
        return x.gross + x.allow === x.net && cats.every((c) => x[c][0] + x[c][1] === x[c][2]) && Fin.sum(cats.map((c) => x[c][2])) === x.net && x.net === B.inv[p];
      });
      add("삼성전자 공시", "재고자산 주석: 평가 전 금액 − 평가충당금 = 장부금액 = 재무상태표", invOk, "");
      const pv = N.provisions, pvOk = ["2025", "2026H1"].every((p) => pv[p].close.every((v, i) => pv[p].open[i] + pv[p].add[i] + pv[p].use[i] + pv[p].other[i] === v) && pv[p].close[4] === B.prov[p] + B.lprov[p]);
      add("삼성전자 공시", "충당부채 변동표: 기초 + 전입 + 사용 + 기타 = 기말 = 유동 + 비유동 충당부채", pvOk, "기술사용료 " + F_(pv["2025"].close[1] / 1e6) + " → " + F_(pv["2026H1"].close[1] / 1e6) + "조원");
      const pp = N.ppe, ppOk = ["2024", "2025"].every((p) => { const x = pp[p]; return x.open + x.acq + x.bc + x.dep + x.disp + x.imp + x.other === x.close && x.close === B.ppe[p] && x.gross + x.acc === x.close && x.dep_cogs + x.dep_sga === -x.dep; });
      add("삼성전자 공시", "유형자산 변동표와 감가상각비 배분이 재무상태표와 맞는다", ppOk && pp["2025"].dep === -S.seg["2025"].dep.total, "");
      const eq = N.equity, mv = eq.h1Moves;
      const shOk = eq.outstanding["2025"].common - mv.bought + mv.granted === eq.outstanding["2026H1"].common &&
        eq.treasury["2025"].common + mv.bought - mv.granted - mv.cancelledCommon === eq.treasury["2026H1"].common &&
        eq.outstanding["2025"].pref === eq.outstanding["2026H1"].pref && eq.treasury["2025"].pref - mv.cancelledPref === eq.treasury["2026H1"].pref;
      add("삼성전자 공시", "주식 수: 유통주식·자기주식 변동(취득·지급·소각)이 맞는다", shOk, "소각 보통주 " + Fin.num(mv.cancelledCommon / 1e6, 1) + "백만 주");
    }

    /* ---------- 업종별 공시 원문 대조 (리포트 05) ---------- */
    if (Sectors) {
      Sectors.order.forEach((k) => {
        const c = Sectors.companies[k], I = c.is, B = c.bs, C = c.cf, ps = Object.keys(I.rev), bp = Object.keys(B.ta);
        const z = (o, key, p) => (o[key] && o[key][p]) || 0;
        /* 업종마다 손익계산서 모양이 달라 없는 줄은 0으로 본다: 매출총이익이 없는 회사(성격별 영업비용), 중단영업, 이자수익 별도 표시 */
        add("업종별 공시", c.name + ": 손익계산서 소계(" + (I.gp ? "매출총이익·" : "") + "영업이익·세전이익·순이익" + (I.niP ? "·지배/비지배" : "") + ") " + ps.length + "개 기간", ps.every((p) =>
          (!I.gp || I.gp[p] === I.rev[p] - I.cogs[p]) && (!I.sales || I.rev[p] === I.sales[p] + I.ampc[p]) &&
          I.op[p] === (I.gp ? I.gp[p] : I.rev[p]) - z(I, "sga", p) - z(I, "rnd", p) - z(I, "opex", p) &&
          I.ebt[p] === I.op[p] + z(I, "noi", p) - z(I, "noe", p) + z(I, "fi", p) - z(I, "fc", p) + z(I, "eq", p) + z(I, "int", p) &&
          I.ni[p] === I.ebt[p] - I.tax[p] + z(I, "disc", p) && (!I.niP || I.niP[p] + I.niN[p] === I.ni[p])), "원 단위 일치");
        add("업종별 공시", c.name + ": 재무상태표 자산 = 부채 + 자본, 유동 + 비유동 " + bp.length + "개 시점", bp.every((p) =>
          B.ta[p] === B.ca[p] + B.nca[p] && B.ta[p] === B.tl[p] + B.te[p] && B.tl[p] === B.cl[p] + B.ncl[p] && (!B.teP || B.teP[p] + B.teN[p] === B.te[p])), "");
        add("업종별 공시", c.name + ": 현금흐름표 기초 + 영업·투자·재무 + 환율 = 기말 = 재무상태표 현금", ps.every((p) =>
          C.close[p] === C.open[p] + C.cfo[p] + C.cfi[p] + C.cff[p] + C.fx[p] + z(C, "other", p) && (B.cash[p] === undefined || B.cash[p] === C.close[p])), "");
      });
    }

    /* ---------- 공개 M&A 사례 (리포트 06): 공시 숫자끼리 맞는지 ---------- */
    if (Deal) {
      const A = Deal.acquired, sumv = (o) => Object.keys(o).filter((k) => k !== "total").reduce((t, k) => t + o[k], 0);
      add("M&A 사례", "취득 순자산 = 유동자산 + 비유동자산 − 유동부채 − 비유동부채, 세부 항목 합 = 소계", A.ca.total + A.nca.total - A.cl.total - A.ncl.total === A.net &&
        sumv(A.ca) === A.ca.total && sumv(A.nca) === A.nca.total && sumv(A.cl) === A.cl.total, Fin.num(A.net, 0) + "백만원");
      const T = Deal.terms, E2 = Deal.equityRow;
      add("M&A 사례", "신주 수 × 액면 5,000원 = 자본변동표의 자본금 증가", T.newShares * T.par === E2.capital * 1000, Fin.num(E2.capital, 0) + "천원");
      add("M&A 사례", "자본변동표 사업결합 행: 자본금 + 자본잉여금 + 자본조정 + 기타포괄손익 + 이익잉여금 = 합계", E2.capital + E2.surplus + E2.adj + E2.aoci + E2.retained === E2.total, Fin.num(E2.total, 0) + "천원");
      const O = Deal.owner, sh0 = O.capitalBefore * 1e6 / T.par, sh1 = O.capitalAfter * 1e6 / T.par;
      add("M&A 사례", "합병 전 주식 수 + 신주 = 합병 후 주식 수, 최대주주 지분 74.11% → 69.23%", sh0 + T.newShares === sh1 && O.before + O.added === O.after &&
        Math.abs(O.before / sh0 - 0.7411) < 5e-5 && Math.abs(O.after / sh1 - 0.6923) < 5e-5, Fin.num(sh0, 0) + " → " + Fin.num(sh1, 0) + "주");
      const P = Deal.proforma;
      add("M&A 사례", "합병 전후 요약 재무상태표: 두 회사 단순합 = 합병 후(원문 단수차이 1백만원 이내)", ["ta", "tl", "te"].every((k) => Math.abs(P.hhi[k] + P.mipo[k] - P.after[k]) <= 1), Fin.num(P.after.ta, 0) + "백만원");
      if (Sectors && Sectors.companies.hhi) add("M&A 사례", "수주잔고 합병분이 업종별 리포트 데이터(같은 공시)와 같다", Sectors.companies.hhi.notes.backlog.merger === Deal.backlogAdded * 1e6, Fin.num(Deal.backlogAdded, 0) + "백만원");
    }

    /* ---------- 위임전결 기준 점검 ---------- */
    if (Doa) {
      const D0 = clone(Doa.DEFAULTS), r0 = Doa.run(D0);
      add("위임전결", "예시 기준표는 구간 순서·부의 기준·법정 이사회 사항을 모두 지킨다", r0.issueCount === 0, "부의 기준 " + Fin.num(r0.board, 0) + "억원");
      /* 금액이 커질수록 결재권자가 낮아지지 않고, 모든 금액이 정확히 한 결재권자에게 간다 */
      const amts = []; for (let e = -2; e <= 4; e += 0.05) amts.push(Math.pow(10, e));
      const mono = D0.items.every((it) => amts.every((a, i) => i === 0 || Doa.approver(it, a) >= Doa.approver(it, amts[i - 1])));
      const cover = D0.items.every((it) => amts.every((a) => { const l = Doa.approver(it, a); return l >= 0 && l <= 3; }));
      add("위임전결", "금액이 커질수록 결재권자가 낮아지지 않고, 모든 금액에 결재권자가 정확히 하나", mono && cover, amts.length + "개 금액 × " + D0.items.length + "개 항목");
      const b1 = clone(D0); b1.items[0].limits = [10, 5, 100];
      const b2 = clone(D0); b2.items[0].limits = [1, 10, r0.board];
      const b3 = clone(D0); b3.items[8].limits = [0, 0, 1];
      const b4 = clone(D0); b4.items[7].limits = [0, 0, 50];
      const b5 = clone(b4); b5.delegateBond = true;
      const kinds = (x, i) => Doa.run(x).items[i].issues.map((z) => z.kind);
      add("위임전결", "꼬인 구간, 부의 기준 이상 대표이사 한도, 398조·469조 위반을 각각 잡아내고, 정관 위임 근거가 있으면 사채 대표이사 위임은 허용한다",
        kinds(b1, 0).indexOf("order") >= 0 && kinds(b2, 0).indexOf("board") >= 0 && kinds(b3, 8).indexOf("law") >= 0 && kinds(b4, 7).indexOf("law") >= 0 && kinds(b5, 7).length === 0, "");
    }

    /* ---------- 13주 자금수지 ---------- */
    if (Cash) {
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
    /* ---------- 통계 모듈: 알려진 값과 대조 ---------- */
    if (Stats) {
      const S = Stats;
      add("통계", "정규분포: Φ(1.96) = 0.975002, Φ⁻¹(0.975) = 1.959964", Math.abs(S.normCdf(1.96) - 0.9750021) < 1e-6 && Math.abs(S.normInv(0.975) - 1.959964) < 1e-6,
        S.normCdf(1.96).toFixed(7) + " · " + S.normInv(0.975).toFixed(6));
      add("통계", "t·카이제곱·F 분포 임계값이 통계표와 같다 (t₀.₉₇₅,₂₀ = 2.086, χ²₀.₉₅,₁ = 3.841, F₀.₉₅,₁,₂₀ = 4.351)",
        Math.abs(S.tInv(0.975, 20) - 2.085963) < 1e-4 && Math.abs(S.chi2Sf(3.841459, 1) - 0.05) < 1e-4 && Math.abs(S.fSf(4.351244, 1, 20) - 0.05) < 1e-4,
        "t " + S.tInv(0.975, 20).toFixed(4) + " · χ² p " + S.chi2Sf(3.841459, 1).toFixed(4) + " · F p " + S.fSf(4.351244, 1, 20).toFixed(4));
      const xs = [1, 2, 3, 4, 5, 6, 7, 8], exact = S.linreg(xs, xs.map((v) => 2 + 3 * v)), noisy = S.linreg(xs, [3, 9, 7, 15, 16, 21, 22, 27]);
      add("통계", "회귀: 직선 위의 점은 절편·기울기를 그대로 찾고(R² = 1), 잔차의 합은 0", near(exact.a, 2, 1e-12) && near(exact.b, 3, 1e-12) && near(exact.r2, 1, 1e-12) && Math.abs(Fin.sum(noisy.resid)) < 1e-9,
        "기울기 " + noisy.b.toFixed(4) + ", R² " + noisy.r2.toFixed(4));
      const av = S.anova([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
      add("통계", "분산분석: 손으로 푼 예제와 같다 (F = 27, η² = 0.9)", near(av.f, 27, 1e-12) && near(av.eta2, 0.9, 1e-12) && av.p < 0.002, "F " + av.f.toFixed(2) + ", p " + av.p.toFixed(5));
      const g = S.gini([0, 0, 0, 1]), h = S.hhi([1, 1, 1, 1]), q = S.quantile([1, 2, 3, 4], 0.25);
      add("통계", "지니계수·HHI·사분위수 기준값 (한 명이 전부 = 0.75, 넷이 같으면 HHI 0.25, PERCENTILE.INC)", near(g, 0.75) && near(h, 0.25) && q === Fin.quantile([1, 2, 3, 4], 0.25), "Gini " + g + " · HHI " + h);
      const r1 = S.rng(7), r2 = S.rng(7), a1 = [], a2 = [];
      for (let i = 0; i < 20000; i++) { a1.push(r1.normal()); a2.push(r2.normal()); }
      const same = a1.every((v, i) => v === a2[i]), m = S.mean(a1), sd = S.sd(a1);
      add("통계", "난수: 같은 시드면 같은 수열, 정규난수 2만 개의 평균 ≈ 0·표준편차 ≈ 1", same && Math.abs(m) < 0.03 && Math.abs(sd - 1) < 0.03, "평균 " + m.toFixed(4) + ", 표준편차 " + sd.toFixed(4));
    }

    /* ---------- 월 손익 보고: 추세와 계획 편향 ---------- */
    if (Pl && Stats) {
      const rows = Pl.sample(), T = Pl.trend(rows, "전사", "rev", 9, { seasonal: true });
      const resSum = Fin.sum(T.pts.map((p) => p.res)), zOk = T.pts.every((p) => near(p.z * T.sigma, p.res, 1e-9));
      add("손익보고", "추세선 잔차의 합 = 0, 각 달의 z × 표준편차 = 잔차", T.ok && Math.abs(resSum) < 1e-6 && zOk, T.pts.length + "개월, 잔차 합 " + fmt(resSum));
      const band = T.ahead.every((f) => f.lo < f.v && f.v < f.hi && near(f.v - f.lo, f.hi - f.v, 1e-9));
      add("손익보고", "추세 예측의 ±1σ 구간은 추정치를 가운데 둔 대칭 구간", T.ahead.length > 0 && band, T.ahead.length + "개월 앞");
      const B = Pl.planBias(rows, "전사", 9, "rev"), rates = B.months.map((r) => r.rate);
      const tHand = (Stats.mean(rates) - 1) / (Stats.sd(rates) / Math.sqrt(rates.length));
      add("손익보고", "계획 편향 t값 = (평균 달성률 − 1) ÷ (표준편차 ÷ √n)", B.ok && near(B.t, tHand, 1e-9), "평균 달성률 " + (B.mean * 100).toFixed(1) + "%, t " + B.t.toFixed(2));
    }

    /* ---------- 성과평가: 분포·평가자 보정 ---------- */
    if (Mbo && Stats) {
      const x = clone(Mbo.DEFAULTS), teams = Mbo.sampleTeams(), r = Mbo.distribution(teams, x.grades, x.pool);
      const cnt = (o) => Fin.sum(Object.keys(o).map((k) => o[k]));
      add("성과평가", "등급 인원의 합 = 팀 수 (보정 전·후), 기대 인원의 합 = 팀 수", cnt(r.grades0) === r.n && cnt(r.grades1) === r.n && near(Fin.sum(r.fit.exp), r.n), r.n + "팀");
      add("성과평가", "보정 전·후 모두 인센티브 합계 = 총액", near(Fin.sum(r.alloc0), x.pool) && near(Fin.sum(r.alloc1), x.pool), x.pool + "억원");
      const raterOk = r.byRater.keys.every((k) => {
        const v = r.adj.filter((_, i) => teams[i].rater === k);
        return near(Stats.mean(v), r.d.mean, 1e-9) && near(Stats.sd(v), r.d.sd, 1e-9);
      });
      add("성과평가", "평가자 보정 뒤 모든 평가자의 평균·표준편차가 전체와 같아진다", near(Stats.mean(r.adj), r.d.mean, 1e-9) && raterOk, "평균 " + r.d.mean.toFixed(2) + ", 표준편차 " + r.d.sd.toFixed(2));
    }

    /* ---------- 13주 자금수지: 몬테카를로 ---------- */
    if (Cash && Stats) {
      const x = clone(Cash.DEFAULTS);
      const z = Cash.simulate(x, { salesSd: 0, p1: 0, p2: 0, n: 20 });
      const base = Cash.forecast(Object.assign({}, x, { rcf: Object.assign({}, x.rcf, { auto: false }) }));
      const baseMin = Math.min.apply(null, base.daily.map((d) => d.cash));
      add("자금수지", "변동성 0이면 모든 시뮬레이션 경로가 기본 계획과 같다", Math.abs(z.p5 - baseMin) < 1e-9 && z.minSd < 1e-9, "최저 현금 " + baseMin.toFixed(1) + "억원");
      const s1 = Cash.simulate(x, { n: 300 }), s2 = Cash.simulate(x, { n: 300 });
      add("자금수지", "확률 순서(지급불능 ≤ 한도 소진 ≤ 한도 필요)와 같은 시드의 재현성", s1.insolv.p <= s1.short.p && s1.short.p <= s1.need.p && s1.need.p === s2.need.p && s1.p5 === s2.p5,
        "300회, 한도 필요 " + (s1.need.p * 100).toFixed(1) + "%");
    }

    /* ---------- 적정 부채와 파산 위험 ---------- */
    if (Capital && Stats) {
      const x = clone(Capital.DEFAULTS), a = Capital.analyze(x), c = a.capacity, t = a.tradeoff;
      const cd = Cash ? Cash.DEFAULTS : null;
      add("적정부채", "13주 자금수지와 같은 가상 회사 (차입금·현금·한도·EBITDA 일치, 연 이자 차이 1억원 이내)",
        !cd || (x.debt === cd.cov.debt0 && x.cash === cd.opening && x.rcf === cd.rcf.limit && x.minCash === cd.minCash && x.ebitdaHist[x.ebitdaHist.length - 1] === cd.cov.ebitda && Math.abs(a.current.interest - cd.cov.intLtm) < 1),
        "이자 " + a.current.interest.toFixed(1) + " vs " + (cd ? cd.cov.intLtm : "-") + "억원");
      add("적정부채", "상환 부족 확률 = Φ((상환 필요액 − 평균 EBITDA) ÷ 표준편차)", near(a.current.pdShort, Stats.normCdf((a.current.need - a.base.mu) / a.base.sd), 1e-12), (a.current.pdShort * 100).toFixed(2) + "%");
      const atCap = Capital.cashPd(c.cap, x), P = x.policy;
      const edge = { lev: (c.cap - x.cash) / a.base.mu - P.maxLev, icr: atCap.icr - P.minIcr, dscr: atCap.dscr - P.minDscr, pd: atCap.pdShort * 100 - P.maxPd }[c.bind];
      add("적정부채", "부채 한도 = 네 기준 중 가장 작은 값이고, 그 점에서 먼저 걸리는 기준이 정확히 경계", near(c.cap, Math.min.apply(null, c.items.map((i) => i.v))) && Math.abs(edge) < 1e-6,
        c.cap.toFixed(0) + "억원, 기준 " + c.bind);
      add("적정부채", "가치 극대 부채의 기업가치 ≥ 곡선의 모든 점, 부채 0이면 기업가치 = 무부채 가치", t.pts.every((p) => p.value <= t.opt.value + 1e-9) && near(Capital.valueAt(0, x).value, t.vu),
        t.opt.D.toFixed(0) + "억원");
      const mono = t.pts.every((p, i) => i === 0 || (p.merton >= t.pts[i - 1].merton - 1e-15 && p.rate >= t.pts[i - 1].rate - 1e-15));
      const shieldOk = t.pts.every((p) => p.shield <= x.tax / 100 * p.D + 1e-9);
      add("적정부채", "부채가 늘면 머튼 부도확률과 차입금리가 오르고, 절세효과는 법인세율 × 부채를 넘지 않는다", mono && shieldOk, t.pts.length + "점");
      const z = Capital.altman({ ta: 100, ca: 50, cl: 30, re: 20, sales: 150, te: 40, tl: 60, ebit: 10 });
      const hand = 0.717 * 0.2 + 0.847 * 0.2 + 3.107 * 0.1 + 0.420 * (40 / 60) + 0.998 * 1.5;
      add("적정부채", "Altman Z′ = 0.717·X1 + 0.847·X2 + 3.107·X3 + 0.420·X4 + 0.998·X5 (손 계산 예제)", near(z.z, hand, 1e-12) && z.zone === "grey", "Z′ " + z.z.toFixed(4));
    }
    /* ---------- 통계 모듈 2: 행렬·다중회귀·검정 ---------- */
    if (Stats) {
      const S = Stats, R = [[1, 0.4, 0.2], [0.4, 1, -0.3], [0.2, -0.3, 1]], L = S.cholesky(R);
      const llt = R.every((row, i) => row.every((v, j) => Math.abs(L[i].reduce((a, l, k) => a + l * L[j][k], 0) - v) < 1e-12));
      const x = S.solve([[2, 1, 0], [1, 3, 1], [0, 1, 4]], [3, 7, 13]);
      add("통계", "촐레스키 L·Lᵀ = 상관행렬, 모순된 상관(양의 정부호 아님)은 거부, 연립방정식 해가 정확", llt && S.cholesky([[1, 0.9, -0.9], [0.9, 1, 0.9], [-0.9, 0.9, 1]]) === null && near(x[0], 1, 1e-12) && near(x[1], 1, 1e-12) && near(x[2], 3, 1e-12), "x = " + x.map((v) => v.toFixed(3)).join(", "));
      const X = [[1, 2], [2, 1], [3, 4], [4, 3], [5, 6], [6, 5], [7, 8]], m = S.mlr(X, X.map((r) => 1 + 2 * r[0] + 3 * r[1]));
      add("통계", "다중회귀: 정확한 식 y = 1 + 2x₁ + 3x₂를 그대로 찾는다", near(m.b[0], 1, 1e-9) && near(m.b[1], 2, 1e-9) && near(m.b[2], 3, 1e-9) && near(m.r2, 1, 1e-12), m.b.map((v) => v.toFixed(4)).join(", "));
      const tp = S.twoProp(50, 1000, 30, 1000), a1 = 50, b1 = 950, a2 = 30, b2 = 970, N = 2000, chi = N * Math.pow(a1 * b2 - b1 * a2, 2) / ((a1 + b1) * (a2 + b2) * (a1 + a2) * (b1 + b2));
      const w = S.welch([1, 2, 3, 4, 5], [3, 4, 5, 6, 7, 8]);
      add("통계", "두 비율 z² = 2×2 카이제곱, 웰치 t검정 손 계산(t = 2.402, df = 8.99)", near(tp.z * tp.z, chi, 1e-9) && Math.abs(w.t - 2.4019) < 1e-4 && Math.abs(w.df - 8.9894) < 1e-3, "z² " + (tp.z * tp.z).toFixed(4) + " · χ² " + chi.toFixed(4));
      const r = S.rng(11), tri = []; for (let i = 0; i < 40000; i++) tri.push(S.triInv(r.u(), 1, 2, 6));
      add("통계", "삼각분포 역함수로 뽑은 표본의 평균·분산 ≈ 공식 (평균 3, 분산 1.1667)", Math.abs(S.mean(tri) - S.triMean(1, 2, 6)) < 0.02 && Math.abs(S.variance(tri) - S.triVar(1, 2, 6)) < 0.03, "평균 " + S.mean(tri).toFixed(4) + ", 분산 " + S.variance(tri).toFixed(4));
    }

    /* ---------- 사업계획 달성 확률 ---------- */
    if (PlanRisk && Stats) {
      const x = clone(PlanRisk.DEFAULTS), pl = PlanRisk.planPnl(x), s = PlanRisk.simulate(x, { n: 3000 });
      add("사업계획", "매출 − 원재료비 − 가공비 − 고정비 = 영업이익, 변동성 0이면 모든 경로 = 계획", near(pl.rev - pl.mat - pl.conv - pl.fc, pl.op) && (() => { const z = clone(x); PlanRisk.KEYS.forEach((k) => { z.drivers[k].sd = 0; }); const q = PlanRisk.simulate(z, { n: 30 }); return q.sd < 1e-9 && near(q.mean, pl.op); })(), "계획 영업이익 " + pl.op.toFixed(2) + "억원");
      add("사업계획", "변동 기여도(오일러 배분) 합계 = 100%", near(Fin.sum(s.contrib.map((c) => c.share)), 1, 1e-9), s.contrib.map((c) => c.key + " " + (c.share * 100).toFixed(1) + "%").join(", "));
      const corrOk = x.corr.every((row, i) => row.every((v, j) => Math.abs(s.realized[i][j] - v) < 0.06));
      const s2 = PlanRisk.simulate(x, { n: 3000 });
      add("사업계획", "뽑힌 난수의 상관 ≈ 입력 상관(±0.06), 같은 시드면 같은 결과", corrOk && s2.pAch === s.pAch && s2.p5 === s.p5, "달성 확률 " + (s.pAch * 100).toFixed(1) + "%");
      const bad = clone(x); bad.corr[0][1] = bad.corr[1][0] = 0.95; bad.corr[1][3] = bad.corr[3][1] = 0.95; bad.corr[0][3] = bad.corr[3][0] = -0.95;
      add("사업계획", "서로 모순된 상관행렬은 계산하지 않고 알린다", PlanRisk.simulate(bad, { n: 10 }).ok === false, "");
    }

    /* ---------- 비용예산 증액 우선순위 ---------- */
    if (Budget && Stats) {
      const x = clone(Budget.DEFAULTS), a = Budget.analyze(x), bf = Budget.brute(a.E, x.budget);
      add("예산배분", "정수계획(동적계획법) 최적값 = 2ⁿ개 조합을 모두 따진 최적값", near(a.opt.value, bf.value, 1e-9), x.items.length + "건, 2^" + x.items.length + " = " + Math.pow(2, x.items.length) + "개 조합, " + a.opt.value.toFixed(4) + "억원");
      add("예산배분", "최적 ≥ 효율 순 채우기 ≥ 일률 삭감, 승인액 ≤ 한도, 필수 요청 포함", a.opt.value >= a.greedy.value - 1e-9 && a.greedy.value >= a.proRata.value - 1e-9 && a.used <= x.budget + 1e-9 && a.E.every((e) => !e.it.must || a.opt.sel.indexOf(e.i) >= 0), a.opt.value.toFixed(2) + " ≥ " + a.greedy.value.toFixed(2) + " ≥ " + a.proRata.value.toFixed(2));
      const fv = a.frontier.filter((f) => f.v !== null), mono = fv.every((f, i) => i === 0 || f.v >= fv[i - 1].v - 1e-12);
      add("예산배분", "효율적 경계는 예산이 늘수록 줄지 않는다", mono, fv.length + "개 예산 수준");
      const rnd = rng(77); let allOk = true;
      for (let t = 0; t < 40; t++) {
        const y = clone(x); y.items = y.items.slice(0, 10).map((it) => Object.assign(it, { cost: Math.round((0.5 + rnd() * 5) * 10) / 10, mode: rnd() * 6, lo: 0, hi: 8, p: 30 + rnd() * 70, must: false })); y.budget = 5 + rnd() * 20; y.riskAversion = rnd() * 0.3;
        const b = Budget.analyze(y), bb = Budget.brute(b.E, y.budget); if (!near(b.opt.value, bb.value, 1e-9)) allOk = false;
      }
      add("예산배분", "무작위 요청 묶음 40가지(위험회피 포함)에서도 동적계획법 = 전수 조사", allOk, "");
      const s = Budget.simulate(a.E, a.opt.sel, { n: 8000 });
      add("예산배분", "몬테카를로 평균 ≈ 기대 순효과 합 (3 표준오차 이내)", Math.abs(s.mean - s.ev) <= 3 * s.sdA / Math.sqrt(s.n), s.mean.toFixed(3) + " vs " + s.ev.toFixed(3));
    }

    /* ---------- 원가 행태와 불량 관리도 ---------- */
    if (Costs && Stats) {
      const rows = Costs.sample(), m = Costs.costModel(rows), pc = Costs.pChart(rows), ba = Costs.beforeAfter(rows);
      add("원가관리", "회귀 잔차의 합 = 0, 더미 회귀 계수 = 증설 전·후 따로 회귀한 계수", Math.abs(Fin.sum(m.ols.resid)) < 1e-8 && near(m.dummy.b[0], m.pre.a, 1e-7) && near(m.dummy.b[1], m.pre.b, 1e-9) && near(m.dummy.b[0] + m.dummy.b[2], m.post.a, 1e-7) && near(m.dummy.b[1] + m.dummy.b[3], m.post.b, 1e-9), "증설 후 고정비 " + m.post.a.toFixed(2) + "억원");
      add("원가관리", "Chow 검정이 넣어 둔 구조변화(2025-07 증설)를 잡는다 (p < 0.01)", m.chow.p < 0.01, "F " + m.chow.f.toFixed(2) + ", p " + m.chow.p.toExponential(1));
      const spike = pc.pts.find((q) => q.ym === "2024-09"), drift = pc.pts.filter((q) => q.ym >= "2025-02" && q.ym <= "2025-07");
      const ewDrift = pc.ewma.filter((q) => q.ym >= "2025-02" && q.ym <= "2025-07").some((q) => q.out);
      add("원가관리", "관리도: 일시 급등은 3σ 규칙으로, 3σ 안의 서서히 나빠짐은 넬슨 규칙·EWMA로 잡는다", spike.rules.indexOf(1) >= 0 && drift.every((q) => Math.abs(q.z) < 3) && drift.some((q) => q.rules.length > 0) && ewDrift, "급등 z " + spike.z.toFixed(2));
      const a1 = ba.before.def, b1 = ba.before.n - a1, a2 = ba.after.def, b2 = ba.after.n - a2, N = a1 + b1 + a2 + b2, chi = N * Math.pow(a1 * b2 - b1 * a2, 2) / ((a1 + b1) * (a2 + b2) * (a1 + a2) * (b1 + b2));
      add("원가관리", "정비 효과: 두 비율 z² = 2×2 카이제곱, 신뢰구간이 차이를 포함", near(ba.test.z * ba.test.z, chi, 1e-9) && ba.test.lo < ba.test.diff && ba.test.diff < ba.test.hi, "불량률 " + (ba.test.p1 * 100).toFixed(2) + "% → " + (ba.test.p2 * 100).toFixed(2) + "%");
      const back = Costs.parse(Costs.toCsv(rows));
      add("원가관리", "표로 내보냈다가 다시 읽어도 같은 결과", back.errors.length === 0 && near(Costs.costModel(back.rows).post.a, m.post.a, 1e-9), back.rows.length + "개월");
    }

    /* ---------- 설비투자 확률 분석 ---------- */
    if (CapexMc && Stats) {
      const p = clone(CapexMc.P0), base = CapexMc.project(p, {}).npv;
      add("설비투자 확률", "단계별 일반화 모형의 기본 NPV = 설비투자 키트 기준 구현(legacyNpv)", near(base, legacyNpv(p), 1e-9), base.toFixed(4) + "억원");
      const one = CapexMc.staged(p, {}, Object.assign({}, CapexMc.STAGE, { share1: 100 })).res.npv;
      const z = CapexMc.simulate(p, { sdU: 0, sdA: 0, sdV: 0, sdF: 0, capexLo: 0, capexHi: 0, n: 20 }, { obs: 0 });
      add("설비투자 확률", "1단계 100%면 단계 투자 = 일괄 투자, 흔들림 0이면 모든 경로 = 기본 NPV", near(one, base, 1e-9) && z.full.sd < 1e-9 && near(z.full.mean, base, 1e-9), "");
      const sw = CapexMc.sweep(p, {}, {}, [0, 15, 30]);
      add("설비투자 확률", "수요 불확실성이 클수록 단계 투자의 옵션가치가 커진다(0% → 15% → 30%)", sw[0].option < sw[1].option && sw[1].option < sw[2].option && sw[0].option < 0 && sw[2].option > 0, sw.map((r) => r.sd + "%: " + r.option.toFixed(1)).join(", "));
    }
    /* ---------- KPI 트리 ---------- */
    if (KpiTree) {
      const K = KpiTree, x = clone(K.LEAVES), a = K.analyze(x), sumSh = Fin.sum(K.KEYS.map((k) => a.shapley.by[k]));
      add("KPI 트리", "샤플리 기여의 합 = 실적 ROIC − 계획 ROIC, 계획과 같은 지표의 기여 = 0", near(sumSh, a.act.roic - a.plan.roic, 1e-9) && Math.abs(a.shapley.by.tax) < 1e-15, "ROIC " + a.plan.roic.toFixed(2) + "% → " + a.act.roic.toFixed(2) + "%");
      const c = a.plan;
      add("KPI 트리", "트리 항등식: 영업이익 = 매출 − 매출원가 − 판관비, 순운전자본 = 채권 + 재고 − 채무, ROIC = NOPAT ÷ 투하자본", near(c.op, c.rev - c.cogs - c.sga) && near(c.nwc, c.ar + c.inv - c.ap) && near(c.roic, c.nopat / c.ic * 100), "영업이익 " + c.op.toFixed(1) + "억원");
      /* 순열 평균 = 샤플리: 참가자 순서를 모두 따지는 정의와 같은지(무작위 순열 2,000개 평균이 오차 안) */
      const P = K.pick(x, "plan"), A = K.pick(x, "act"), keys = a.shapley.players, rnd = rng(31), acc = {}; keys.forEach((k) => { acc[k] = 0; });
      const N = 2000;
      for (let t = 0; t < N; t++) { const ord = keys.slice(); for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = ord[i]; ord[i] = ord[j]; ord[j] = tmp; }
        const v = Object.assign({}, P); let prev = K.calc(v).roic; ord.forEach((k) => { v[k] = A[k]; const now = K.calc(v).roic; acc[k] += now - prev; prev = now; }); }
      const maxErr = Math.max.apply(null, keys.map((k) => Math.abs(acc[k] / N - a.shapley.by[k])));
      add("KPI 트리", "정확한 샤플리 값 = 무작위 순서 2,000개로 대입한 평균(오차 0.01%p 이내)", maxErr < 0.01, "최대 차이 " + maxErr.toFixed(4) + "%p");
      const y = clone(x); K.KEYS.forEach((k) => { y[k].act = y[k].plan; }); y.p.act = y.p.plan * 1.02;
      const b = K.analyze(y);
      add("KPI 트리", "한 지표만 바뀌면 그 지표가 차이를 모두 가져간다(단가 +2%)", near(b.shapley.by.p, b.act.roic - b.plan.roic, 1e-12), "+" + b.shapley.by.p.toFixed(3) + "%p");
    }

    /* ---------- 통계 기법 노트 ---------- */
    if (StatLab && Stats) {
      const L = StatLab, S = Stats, G = "통계 기법";
      add(G, "분위수는 엑셀 PERCENTILE.INC와 같은 선형보간: [1, 2, 3, 4]의 25% = 1.75", near(S.quantile([1, 2, 3, 4], 0.25), 1.75, 1e-12), "1.75");
      const ans = L.ANSCOMBE.map(L.summary2), okA = ans.every((a) => near(a.mx, 9, 1e-12) && near(a.my, 7.5, 0.01) && near(a.r, 0.816, 0.0015) && near(a.a, 3, 0.01) && near(a.b, 0.5, 0.001));
      add(G, "앤스컴 4종: x 평균 9, y 평균 7.50, 상관 0.816, 회귀식 y = 3.00 + 0.500x가 네 데이터 모두 같다", okA, "상관 " + ans.map((a) => a.r.toFixed(3)).join(" / "));
      const cov = L.ciDraws(10, 4000, 77).filter((v) => v.hit).length / 4000;
      add(G, "95% 신뢰구간을 4,000번 만들면 약 95%가 참값을 포함(±1.5%p)", Math.abs(cov - 0.95) < 0.015, (cov * 100).toFixed(1) + "%");
      add(G, "표본 크기 n = (1.96 × 12 ÷ 3)² 올림 = 62, 다중검정 20번의 우연 유의 확률 1 − 0.95²⁰ = 64.2%", L.sampleSize(12, 3) === 62 && near(L.familywise(20), 0.6415, 1e-4), "62개 · " + (L.familywise(20) * 100).toFixed(1) + "%");
      const sp = L.simpson();
      add(G, "심슨의 역설 예시: A가 두 제품 모두 불량률이 낮은데 합계는 높고, 구성을 맞추면 다시 낮다", sp.A.X < sp.B.X && sp.A.Y < sp.B.Y && sp.A.total > sp.B.total && sp.A.std < sp.B.std, "합계 " + (sp.A.total * 100).toFixed(1) + "% vs " + (sp.B.total * 100).toFixed(1) + "%");
      const y = L.sales(), D = L.decompose(y); let idErr = 0; y.forEach((v, t) => { if (D.trend[t] !== null) idErr = Math.max(idErr, Math.abs(v - D.trend[t] - D.seasonal[t] - D.remainder[t])); });
      const sErr = Math.max.apply(null, D.index.map((v, m) => Math.abs(v - L.SEASON[m])));
      add(G, "시계열 분해: 원계열 = 추세 + 계절 + 불규칙, 계절 몫 합계 0, 심어 둔 계절 모양을 ±2억원 안에서 되찾음", idErr < 1e-9 && Math.abs(S.sum(D.index)) < 1e-9 && sErr < 2, "최대 차이 " + sErr.toFixed(2));
      const vr = [[0.5, 0.2, 6], [0.8, 0.1, 6], [0.3, 0.4, 4]].map((q) => { const B = q[0] * q[1], an = 1 + (q[2] - 1) * (q[0] * q[0] + q[0] * B * q[2] + B * B * q[2] * (2 * q[2] - 1) / 6); return L.holtSimVar(q[0], q[1], 1, q[2], 30000, 5) / an; });
      add(G, "홀트 예측분산 공식(ETS(A,A,N)) = 같은 모형으로 3만 번 굴린 분산(±3%)", vr.every((r) => Math.abs(r - 1) < 0.03), "비율 " + vr.map((r) => r.toFixed(3)).join(" / "));
      const my = L.material(), hb = L.holtFit(my, 6), others = [[0.3, 0.1], [0.6, 0.3], [0.9, 0.02]].map((q) => L.holt(my, q[0], q[1], 6).sse);
      add(G, "지수평활 모수 선택: 고른 값의 오차제곱합이 다른 조합보다 작거나 같다", others.every((v) => hb.sse <= v + 1e-9), "α " + hb.alpha + " · β " + hb.beta);
      const M = L.MC, tm = (a) => S.triMean(a[0], a[1], a[2]), an = tm(M.Q) * (tm(M.P) - tm(M.V)) / 10 - tm(M.FC), m0 = L.mcRun(0, 20000, 11);
      add(G, "몬테카를로(상관 0) 평균 = 해석적 기댓값(표준오차 3배 안), 최빈값 계획 13억", Math.abs(m0.mean - an) < 3 * m0.sd / Math.sqrt(20000) && near(m0.base, 13, 1e-9), m0.mean.toFixed(2) + " vs " + an.toFixed(2));
      const tor = L.tornado();
      add(G, "토네이도: 움직임 폭이 큰 순서로 정렬, 기준점은 최빈값 계획", tor.every((d, i) => i === 0 || tor[i - 1].swing >= d.swing) && tor.every((d) => near(d.base, 13, 1e-9)), tor.map((d) => d.name).join(" > "));
      const B = L.bayes(0.3, 10, 8, 4, 0.9); let integ = 0; for (let i = 0; i < 4000; i++) integ += L.betaPdf((i + 0.5) / 4000, B.a, B.b) / 4000;
      add(G, "베이지안 갱신: 사후 평균 = (a + 수주) ÷ (a + b + 견적), 90% 구간 끝의 누적확률 5%·95%, 밀도 적분 = 1", near(B.postMean, 7 / 18, 1e-12) && near(S.ibeta(B.lo, B.a, B.b), 0.05, 1e-6) && near(S.ibeta(B.hi, B.a, B.b), 0.95, 1e-6) && near(integ, 1, 1e-3), "Beta(7, 11) · " + (B.postMean * 100).toFixed(1) + "%");
      const rp = L.repairs(), bm = L.bootstrap(rp, S.mean, 20000, 9), mu = S.mean(rp), seTh = Math.sqrt(S.mean(rp.map((v) => (v - mu) * (v - mu))) / rp.length);
      add(G, "부트스트랩 평균의 표준오차 = 이론값 √(Σ(x − x̄)² ÷ n) ÷ √n(±3%), 구간이 추정값을 포함", Math.abs(bm.se / seTh - 1) < 0.03 && bm.lo < mu && mu < bm.hi, bm.se.toFixed(3) + " vs " + seTh.toFixed(3));
      const cc = L.concentration(L.customers()), hh = S.sum(cc.rows.map((r) => r.share * r.share)) * 10000;
      add(G, "집중도: 누적 비중 끝 = 100%, HHI = 비중 제곱합 × 10,000, A등급이 80% 이상", near(cc.rows[cc.rows.length - 1].cum, 1, 1e-12) && near(cc.hhi, hh, 1e-9) && S.sum(cc.rows.filter((r) => r.cls === "A").map((r) => r.share)) >= 0.8 && cc.gini > 0 && cc.gini < 1, "지니 " + cc.gini.toFixed(3) + " · HHI " + Math.round(cc.hhi));
      const ac = L.accounts(), ks = [1, 2, 3, 4, 5, 6].map((k) => L.kmeans(ac, k, 7, 10)), k3 = ks[2];
      const fixed = k3.z.every((p, i) => { let bj = 0, bd = Infinity; k3.zc.forEach((cc2, j) => { const d = (p[0] - cc2[0]) ** 2 + (p[1] - cc2[1]) ** 2; if (d < bd) { bd = d; bj = j; } }); return bj === k3.labels[i]; });
      add(G, "k-평균: 모든 점이 가장 가까운 중심에 배정, 군집 수가 늘면 거리 합이 줄어듦", fixed && ks.every((m, i) => i === 0 || ks[i - 1].inertia >= m.inertia - 1e-9), "k=3 크기 " + k3.sizes.join("/"));
      const big = L.rttm(20000, 11);
      add(G, "평균으로의 회귀: 실력 분산 = 운 분산이면 이듬해 점수의 회귀 기울기 ≈ 0.5(±0.02)", Math.abs(big.slope - big.reliability) < 0.02, "기울기 " + big.slope.toFixed(3));
      const pw = L.power(), rb = L.regBands(pw.x, pw.y), mx0 = S.mean(pw.x), at = rb.at(mx0);
      add(G, "회귀: 예측구간은 늘 신뢰구간보다 넓고, 평균 x에서 예측구간 반폭 = t × s × √(1 + 1/n)", [40, 60, 80, 100].every((v) => rb.at(v).pi > rb.at(v).ci) && near(at.pi, rb.t * rb.se * Math.sqrt(1 + 1 / rb.n), 1e-9), "반폭 ±" + at.pi.toFixed(3));
    }
    return out;
  }

  return { run: run, legacyNpv: legacyNpv };
});

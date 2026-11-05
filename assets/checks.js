/* 검산: 사이트의 모든 계산 엔진이 지켜야 할 항등식과 규칙.
   노드(node assets/checks.js)와 브라우저(tools/checks.html)에서 같은 코드가 돈다. */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const env = node ? {
    Fin: require("./fin.js"),
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
    const { Fin, Post, MA, Holdco, Cash, Fx, Mbo, Pl, Three, Cycle, Samsung, Doa, Sectors } = env;
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
        add("업종별 공시", c.name + ": 손익계산서 소계(매출총이익·영업이익·세전이익·순이익) " + ps.length + "개 기간", ps.every((p) =>
          I.gp[p] === I.rev[p] - I.cogs[p] && I.op[p] === I.gp[p] - I.sga[p] - I.rnd[p] &&
          I.ebt[p] === I.op[p] + I.noi[p] - I.noe[p] + I.fi[p] - I.fc[p] + I.eq[p] && I.ni[p] === I.ebt[p] - I.tax[p]), "원 단위 일치");
        add("업종별 공시", c.name + ": 재무상태표 자산 = 부채 + 자본, 유동 + 비유동 " + bp.length + "개 시점", bp.every((p) =>
          B.ta[p] === B.ca[p] + B.nca[p] && B.ta[p] === B.tl[p] + B.te[p] && B.tl[p] === B.cl[p] + B.ncl[p]), "");
        add("업종별 공시", c.name + ": 현금흐름표 기초 + 영업·투자·재무 + 환율 = 기말 = 재무상태표 현금", ps.every((p) =>
          C.close[p] === C.open[p] + C.cfo[p] + C.cfi[p] + C.cff[p] + C.fx[p] && (B.cash[p] === undefined || B.cash[p] === C.close[p])), "");
      });
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
    return out;
  }

  return { run: run, legacyNpv: legacyNpv };
});

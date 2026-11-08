/* 13주 자금수지 엔진: 날짜별 입출금을 영업일 규칙에 맞춰 놓고, 일별 잔액과 주차별 합계, 한도대출 인출·상환,
   분기말 재무약정 비율을 계산한다. 금액은 억원, 날짜는 "YYYY-MM-DD". */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../fin.js") : root.Fin, node ? require("../stats.js") : root.Stats);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CashEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin, Stats) {
  "use strict";

  /* 이 기간의 공휴일 (토·일은 따로 처리) */
  const HOLIDAYS = { "2026-12-25": "성탄절", "2027-01-01": "신정" };

  const DEFAULTS = {
    start: "2026-11-02", weeks: 13,
    opening: 380, minCash: 150,
    rcf: { limit: 300, auto: true },
    sales: { "2026-09": 245, "2026-10": 260, "2026-11": 250, "2026-12": 280, "2027-01": 240 },
    collectLag: 2, purchaseRatio: 45, payLag: 1,
    payroll: 38, withholding: 9, interest: 7.2,
    vat: [{ date: "2027-01-25", amount: 22, memo: "부가세 2기 확정신고" }],
    capex: [
      { date: "2026-11-20", amount: 45, memo: "증설 장비 중도금" },
      { date: "2026-12-18", amount: 60, memo: "증설 장비 잔금" },
      { date: "2027-01-15", amount: 35, memo: "클린룸 공사비" }
    ],
    debt: [
      { date: "2026-12-28", amount: -100, memo: "시설자금 분할상환" },
      { date: "2027-01-05", amount: 150, memo: "운영자금 신규 차입" }
    ],
    stress: { salesDrop: 0, delayWeeks: 0, capexPull: 0 },
    cov: { testDate: "2026-12-31", ebitda: 560, ebit: 330, intLtm: 86, debt0: 1800, liab0: 2900, equity0: 1600, maxLev: 3.0, maxDebtRatio: 200, minIcr: 3.0 }
  };

  /* ---------- 날짜 (UTC 기준으로 계산해 시간대 영향을 없앤다) ---------- */
  const DAY = 86400000;
  const parse = (s) => { const p = s.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
  const fmt = (t) => new Date(t).toISOString().slice(0, 10);
  const addDays = (t, n) => t + n * DAY;
  const isBiz = (t) => { const d = new Date(t).getUTCDay(); return d !== 0 && d !== 6 && !HOLIDAYS[fmt(t)]; };
  const prevBiz = (t) => { while (!isBiz(t)) t = addDays(t, -1); return t; };
  const nextBiz = (t) => { while (!isBiz(t)) t = addDays(t, 1); return t; };
  const ym = (y, m) => { const d = new Date(Date.UTC(y, m, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; };
  const monthKey = (y, m) => y + "-" + String(m + 1).padStart(2, "0");
  const dayOf = (y, m, d) => Date.UTC(y, m, d);
  const lastDay = (y, m) => Date.UTC(y, m + 1, 0);

  /* 기간에 걸친 달 목록. 회수·지급 시차만큼 앞선 달부터 */
  function monthsAround(start, end, back) {
    const s = new Date(start), out = [];
    let c = ym(s.getUTCFullYear(), s.getUTCMonth() - back);
    while (Date.UTC(c.y, c.m, 1) <= end) { out.push(c); c = ym(c.y, c.m + 1); }
    return out;
  }

  /* 입출금 목록 만들기 */
  function events(x) {
    const t0 = parse(x.start), tEnd = addDays(t0, x.weeks * 7 - 1);
    const ev = [];
    const push = (t, line, amount, memo) => { if (amount !== 0 && t >= t0 && t <= tEnd) ev.push({ t: t, date: fmt(t), line: line, amount: amount, memo: memo }); };
    const drop = 1 - x.stress.salesDrop / 100;
    const startMonth = new Date(t0).getUTCFullYear() * 12 + new Date(t0).getUTCMonth();
    const salesOf = (y, m) => {
      const v = x.sales[monthKey(y, m)];
      if (v === undefined) return null;
      if (y * 12 + m < startMonth) return v;              /* 이미 확정된 지난달 매출은 그대로 */
      const k = x.mc && x.mc.mult[monthKey(y, m)];        /* 시뮬레이션: 달마다 다른 매출 충격 */
      return v * drop * (k === undefined ? 1 : k);
    };
    const lag = Math.max(0, Math.round(x.collectLag)), plag = Math.max(0, Math.round(x.payLag));

    monthsAround(t0, tEnd, Math.max(lag, plag) + 1).forEach((c) => {
      /* 매출채권: c월 매출을 (c + lag)월 말 영업일에 회수, 지연 주수만큼 뒤로 */
      const sv = salesOf(c.y, c.m);
      if (sv !== null) {
        const cm = ym(c.y, c.m + lag);
        const extra = (x.mc && x.mc.delay[monthKey(c.y, c.m)]) || 0;   /* 시뮬레이션: 그 달 회수만 늦어지는 경우 */
        push(addDays(prevBiz(lastDay(cm.y, cm.m)), (x.stress.delayWeeks + extra) * 7), "collect", sv, monthKey(c.y, c.m) + " 매출 회수");
        const pm = ym(c.y, c.m + plag);
        push(prevBiz(lastDay(pm.y, pm.m)), "purchase", -sv * x.purchaseRatio / 100, monthKey(c.y, c.m) + " 매입대금");
      }
      /* 급여 25일(휴일이면 앞당김), 원천세·4대보험 10일(휴일이면 다음 영업일), 이자 말일 */
      push(prevBiz(dayOf(c.y, c.m, 25)), "payroll", -x.payroll, monthKey(c.y, c.m) + " 급여");
      push(nextBiz(dayOf(c.y, c.m, 10)), "withholding", -x.withholding, monthKey(c.y, c.m) + " 원천세·4대보험");
      push(prevBiz(lastDay(c.y, c.m)), "interest", -x.interest, monthKey(c.y, c.m) + " 이자");
    });
    x.vat.forEach((v) => push(nextBiz(parse(v.date)), "vat", -v.amount, v.memo));
    x.capex.forEach((v) => push(Math.max(t0, addDays(parse(v.date), -x.stress.capexPull * 7)), "capex", -v.amount, v.memo));
    x.debt.forEach((v) => push(parse(v.date), "debt", v.amount, v.memo));
    ev.sort((a, b) => a.t - b.t);
    return { t0: t0, tEnd: tEnd, list: ev };
  }

  const LINES = [
    { key: "collect", label: "매출채권 회수", group: "영업" },
    { key: "purchase", label: "원재료 매입대금", group: "영업" },
    { key: "payroll", label: "급여", group: "영업" },
    { key: "withholding", label: "원천세·4대보험", group: "영업" },
    { key: "vat", label: "부가세", group: "영업" },
    { key: "interest", label: "이자", group: "영업" },
    { key: "capex", label: "설비투자", group: "투자" },
    { key: "debt", label: "차입·상환", group: "재무" },
    { key: "rcf", label: "한도대출 인출·상환", group: "재무" }
  ];

  function forecast(x) {
    const E = events(x), days = x.weeks * 7;
    const byDay = new Map();
    E.list.forEach((e) => { const k = e.t; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); });

    let cash = x.opening, drawn = 0, debtDelta = 0;
    const daily = [], rcfEvents = [];
    for (let i = 0; i < days; i++) {
      const t = addDays(E.t0, i), list = byDay.get(t) || [];
      list.forEach((e) => { cash += e.amount; if (e.line === "debt") debtDelta += e.amount; });
      const pre = cash;
      /* 영업일 마감 때 최소 보유현금 밑이면 한도대출을 꺼내고, 넘치면 먼저 갚는다 */
      let move = 0;
      if (x.rcf.auto && isBiz(t)) {
        if (cash < x.minCash && drawn < x.rcf.limit) move = Math.min(x.minCash - cash, x.rcf.limit - drawn);
        else if (drawn > 0 && cash > x.minCash) move = -Math.min(drawn, cash - x.minCash);
      }
      if (move !== 0) {
        cash += move; drawn += move;
        rcfEvents.push({ t: t, date: fmt(t), line: "rcf", amount: move, memo: move > 0 ? "한도대출 인출" : "한도대출 상환" });
      }
      daily.push({ t: t, date: fmt(t), pre: pre, cash: cash, drawn: drawn, debtDelta: debtDelta });
    }

    const all = E.list.concat(rcfEvents);
    const weeks = [];
    for (let w = 0; w < x.weeks; w++) {
      const ws = addDays(E.t0, w * 7), we = addDays(ws, 6);
      const lines = {};
      LINES.forEach((l) => { lines[l.key] = 0; });
      all.forEach((e) => { if (e.t >= ws && e.t <= we) lines[e.line] += e.amount; });
      const net = Fin.sum(Object.keys(lines).map((k) => lines[k]));
      const endDay = daily[w * 7 + 6];
      const low = Math.min.apply(null, daily.slice(w * 7, w * 7 + 7).map((d) => d.pre));
      weeks.push({ i: w, start: fmt(ws), end: fmt(we), lines: lines, net: net, close: endDay.cash, drawn: endDay.drawn, low: low });
    }
    weeks.forEach((w, i) => { w.open = i === 0 ? x.opening : weeks[i - 1].close; });

    /* 가장 낮은 잔액 (한도대출 인출 전 기준) */
    let lowDay = daily[0];
    daily.forEach((d) => { if (d.pre < lowDay.pre) lowDay = d; });
    const breaches = daily.filter((d) => d.pre < x.minCash && isBiz(d.t)).length;

    /* 분기말 재무약정 */
    const c = x.cov, tt = parse(c.testDate);
    const at = daily.find((d) => d.t === tt) || null;
    let cov = null;
    if (at) {
      const debt = c.debt0 + at.debtDelta + at.drawn;
      const nd = debt - at.cash;
      const liab = c.liab0 + at.debtDelta + at.drawn;
      const lev = nd / c.ebitda, dr = liab / c.equity0 * 100, icr = c.ebit / c.intLtm;
      cov = {
        date: c.testDate, cash: at.cash, debt: debt, nd: nd,
        items: [
          { key: "lev", label: "순차입금 / EBITDA", value: lev, limit: c.maxLev, ok: lev <= c.maxLev, room: c.maxLev * c.ebitda - nd, cushion: 1 - lev / c.maxLev, unit: "배", dir: "max" },
          { key: "dr", label: "부채비율", value: dr, limit: c.maxDebtRatio, ok: dr <= c.maxDebtRatio, room: c.maxDebtRatio / 100 * c.equity0 - liab, unit: "%", dir: "max" },
          { key: "icr", label: "이자보상배율", value: icr, limit: c.minIcr, ok: icr >= c.minIcr, room: c.ebit - c.minIcr * c.intLtm, unit: "배", dir: "min" }
        ]
      };
    }
    const flowSum = Fin.sum(all.map((e) => e.amount));
    return {
      events: all.sort((a, b) => a.t - b.t), daily: daily, weeks: weeks, lowDay: lowDay, breaches: breaches,
      close: daily[daily.length - 1].cash, drawn: daily[daily.length - 1].drawn, cov: cov,
      check: x.opening + flowSum - daily[daily.length - 1].cash
    };
  }

  /* ---------- 몬테카를로: 확률로 보는 자금 위험 ----------
     기간 안에 매출이 생기는 달마다 매출 충격 = 1 + σ(√ρ·공통 충격 + √(1−ρ)·개별 충격)을 곱하고(0 아래는 0),
     달마다 회수가 1주(p1) 또는 2주(p2) 늦어질 수 있다고 둔다. 한도대출 없이 굴린 '자체 현금' 경로의 최저값 m으로
       한도대출 필요: m < 최소 보유현금, 한도 소진 뒤 최소 보유현금 미달: m < 최소 보유현금 − 한도, 지급불능: m < −한도
     를 판정한다(한도대출이 최소 보유현금까지 채워 준다고 볼 때 성립하는 관계). 같은 시드면 결과가 같다. */
  const MC_DEFAULTS = { n: 2000, seed: 2026, salesSd: 8, rho: 0.5, p1: 25, p2: 5 };
  function simulate(x, o) {
    o = Object.assign({}, MC_DEFAULTS, o || {});
    const r = Stats.rng(o.seed), t0 = parse(x.start), sm = new Date(t0).getUTCFullYear() * 12 + new Date(t0).getUTCMonth();
    const keys = Object.keys(x.sales).filter((k) => { const p = k.split("-").map(Number); return p[0] * 12 + p[1] - 1 >= sm; });
    const allKeys = Object.keys(x.sales);
    const L = x.rcf.limit, mins = [], weekLows = [], covFail = [], testOwn = [];
    let need = 0, short = 0, insolv = 0, cov = 0;
    const sd = o.salesSd / 100, rho = Math.max(0, Math.min(1, o.rho));
    for (let i = 0; i < o.n; i++) {
      const zc = r.normal(), mult = {}, delay = {};
      keys.forEach((k) => { mult[k] = Math.max(0, 1 + sd * (Math.sqrt(rho) * zc + Math.sqrt(1 - rho) * r.normal())); });
      allKeys.forEach((k) => { const u = r.u(); delay[k] = u < o.p2 / 100 ? 2 : u < (o.p1 + o.p2) / 100 ? 1 : 0; });
      const xi = Object.assign({}, x, { rcf: Object.assign({}, x.rcf, { auto: false }), mc: { mult: mult, delay: delay } });
      const f = forecast(xi), m = Math.min.apply(null, f.daily.map((d) => d.cash));
      mins.push(m); weekLows.push(f.weeks.map((w) => w.low));
      if (m < x.minCash) need++;
      if (m < x.minCash - L) short++;
      if (m < -L) insolv++;
      if (f.cov) {
        /* 약정: 한도대출 인출액은 차입과 현금에 똑같이 더해져 순차입금에는 영향이 없다. 부채비율에는 인출액만큼 부채가 는다 */
        const at = f.daily.find((d) => d.date === x.cov.testDate), drawn = Math.min(L, Math.max(0, x.minCash - at.cash));
        const c = x.cov, nd = c.debt0 + at.debtDelta - at.cash, lev = nd / c.ebitda, dr = (c.liab0 + at.debtDelta + drawn) / c.equity0 * 100, icr = c.ebit / c.intLtm;
        const bad = lev > c.maxLev || dr > c.maxDebtRatio || icr < c.minIcr;
        if (bad) cov++;
        covFail.push(bad); testOwn.push(at.cash);
      }
    }
    const n = o.n, pr = (k) => ({ p: k / n, se: Math.sqrt((k / n) * (1 - k / n) / n) });
    const W = weekLows[0].length, fan = [];
    for (let w = 0; w < W; w++) { const col = weekLows.map((a) => a[w]); fan.push({ w: w + 1, p5: Stats.quantile(col, 0.05), p25: Stats.quantile(col, 0.25), p50: Stats.quantile(col, 0.5), p75: Stats.quantile(col, 0.75), p95: Stats.quantile(col, 0.95) }); }
    const q = (p) => Stats.quantile(mins, p);
    return {
      opts: o, n: n, months: keys, need: pr(need), short: pr(short), insolv: pr(insolv), cov: pr(cov),
      minMean: Stats.mean(mins), minSd: Stats.sd(mins), p1: q(0.01), p5: q(0.05), p50: q(0.5), p95: q(0.95), mins: mins, fan: fan,
      /* 95%·99% 확률로 최소 보유현금을 지키는 데 필요한 추가 유동성(한도대출 포함 필요액) */
      buffer95: Math.max(0, x.minCash - q(0.05)), buffer99: Math.max(0, x.minCash - q(0.01)), rcf: L, minCash: x.minCash,
      hist: Stats.histogram(mins, 24)
    };
  }

  return { DEFAULTS, MC_DEFAULTS, LINES, HOLIDAYS, parse, fmt, isBiz, prevBiz, nextBiz, events, forecast, simulate };
});

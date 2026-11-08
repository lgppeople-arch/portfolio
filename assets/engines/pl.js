/* 월 손익 보고 엔진: 기간·사업부·계정별 계획과 실적(SAP 관리손익 조회 형식)으로
   당월·누계 손익, 영업이익 차이 분해, 3개월 추정과 연간 전망을 만든다. 금액은 억원. */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../fin.js") : root.Fin, node ? require("../stats.js") : root.Stats);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PlEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin, Stats) {
  "use strict";

  const YEAR = 2026;
  const ACCTS = ["매출액", "재료비", "노무비", "제조경비", "판매관리비"];
  const KEY = { "매출액": "rev", "재료비": "mat", "노무비": "lab", "제조경비": "ovh", "판매관리비": "sga" };
  const BUS = ["1사업부", "2사업부"];
  const SEASON = [0.92, 0.90, 1.00, 1.00, 1.02, 1.04, 1.00, 0.98, 1.04, 1.04, 1.02, 1.04];
  const ym = (m) => YEAR + "-" + String(m).padStart(2, "0");
  const r1 = (v) => Math.round(v * 10) / 10;

  /* 가상 예시: 1사업부는 매출이 계획보다 많지만 재료비율이 오르고, 2사업부는 매출이 갈수록 계획에 못 미친다 */
  function sample() {
    const P = {
      "1사업부": { sales: 150, mat: 0.38, lab: 22, ovh: 20, sga: 14, sAct: [1.02, 1.05, 1.03, 1.06, 1.04, 1.05, 1.03, 1.06, 1.04], matAct: 0.395, labAct: 22.6, ovhAct: 19.4, sgaAct: 14.3 },
      "2사업부": { sales: 100, mat: 0.45, lab: 15, ovh: 13, sga: 10, sAct: [0.95, 0.93, 0.92, 0.90, 0.92, 0.91, 0.90, 0.89, 0.88], matAct: 0.455, labAct: 14.8, ovhAct: 12.6, sgaAct: 9.7 }
    };
    const rows = [];
    /* 전년(2025) 실적: 추세·변동성 분석용. 1사업부는 완만히 성장, 2사업부는 완만히 감소. 월별 흔들림은 고정값 */
    const H = { "1사업부": { base: 138, g: 0.009, mat: 0.385 }, "2사업부": { base: 108, g: -0.006, mat: 0.448 } };
    const NOISE = { "1사업부": [0.012, -0.018, 0.025, -0.006, 0.031, -0.022, 0.004, -0.035, 0.016, 0.009, -0.011, 0.020],
                    "2사업부": [-0.015, 0.022, -0.008, 0.017, -0.028, 0.006, 0.019, -0.012, 0.024, -0.020, 0.010, -0.004] };
    for (let m = 1; m <= 12; m++) {
      BUS.forEach((bu) => {
        const h = H[bu], p = P[bu], rev = r1(h.base * (1 + h.g * (m - 1)) * SEASON[m - 1] * (1 + NOISE[bu][m - 1]));
        const v = { "매출액": rev, "재료비": r1(rev * h.mat), "노무비": r1(p.lab * 0.97), "제조경비": r1(p.ovh * 0.98), "판매관리비": r1(p.sga * 0.97) };
        ACCTS.forEach((a) => rows.push({ ym: (YEAR - 1) + "-" + String(m).padStart(2, "0"), bu: bu, acct: a, plan: v[a], act: v[a] }));
      });
    }
    for (let m = 1; m <= 12; m++) {
      BUS.forEach((bu) => {
        const p = P[bu], rev = r1(p.sales * SEASON[m - 1]);
        const plan = { "매출액": rev, "재료비": r1(rev * p.mat), "노무비": p.lab, "제조경비": p.ovh, "판매관리비": p.sga };
        let act = null;
        if (m <= 9) {
          const ra = r1(rev * p.sAct[m - 1]);
          act = { "매출액": ra, "재료비": r1(ra * p.matAct), "노무비": p.labAct, "제조경비": p.ovhAct, "판매관리비": p.sgaAct };
        }
        ACCTS.forEach((a) => rows.push({ ym: ym(m), bu: bu, acct: a, plan: plan[a], act: act ? act[a] : null }));
      });
    }
    return rows;
  }

  function toCsv(rows) {
    return ["기간,사업부,계정,계획,실적"].concat(rows.map((r) => [r.ym, r.bu, r.acct, r.plan, r.act === null ? "" : r.act].join(","))).join("\n");
  }

  /* 붙여 넣은 표(쉼표 또는 탭 구분)를 읽는다. 틀린 줄은 버리고 이유를 돌려준다 */
  function parse(text) {
    const rows = [], errors = [];
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter((l) => l);
    lines.forEach((line, i) => {
      const c = line.split(/\t|,/).map((v) => v.trim());
      if (i === 0 && /기간/.test(c[0])) return;
      const n = i + 1;
      if (c.length < 4) { errors.push(n + "번째 줄: 칸이 모자랍니다"); return; }
      const m = /^(\d{4})-(\d{1,2})$/.exec(c[0]);
      if (!m) { errors.push(n + "번째 줄: 기간은 2026-01 형식이어야 합니다"); return; }
      if (!KEY[c[2]]) { errors.push(n + "번째 줄: 계정 '" + c[2] + "'을(를) 모릅니다"); return; }
      const plan = Number(c[3]), act = c[4] === undefined || c[4] === "" ? null : Number(c[4]);
      if (!isFinite(plan) || (act !== null && !isFinite(act))) { errors.push(n + "번째 줄: 금액이 숫자가 아닙니다"); return; }
      rows.push({ ym: m[1] + "-" + m[2].padStart(2, "0"), bu: c[1], acct: c[2], plan: plan, act: act });
    });
    return { rows: rows, errors: errors };
  }

  const blank = () => ({ rev: 0, mat: 0, lab: 0, ovh: 0, sga: 0 });
  function derive(v) {
    const cogs = v.mat + v.lab + v.ovh, gp = v.rev - cogs, op = gp - v.sga;
    return Object.assign({}, v, { cogs: cogs, gp: gp, op: op, cm: v.rev - v.mat, opm: v.rev ? op / v.rev : null, cmr: v.rev ? (v.rev - v.mat) / v.rev : null });
  }

  /* 사업부(또는 전사)·월별 계획/실적 묶음 */
  function cube(rows, scope, year) {
    const months = [], y = String(year || YEAR);
    for (let m = 1; m <= 12; m++) months.push({ plan: blank(), act: blank(), hasAct: false });
    rows.forEach((r) => {
      if (r.ym.slice(0, 4) !== y) return;          /* 보고 연도만. 전년 행은 추세 분석에만 쓴다 */
      if (scope !== "전사" && r.bu !== scope) return;
      const m = Number(r.ym.slice(5)) - 1;
      if (m < 0 || m > 11) return;
      months[m].plan[KEY[r.acct]] += r.plan;
      if (r.act !== null) { months[m].act[KEY[r.acct]] += r.act; months[m].hasAct = true; }
    });
    return months;
  }
  const add = (a, b) => { const o = blank(); Object.keys(o).forEach((k) => { o[k] = a[k] + b[k]; }); return o; };
  const sumRange = (months, from, to, side) => { let o = blank(); for (let i = from; i <= to; i++) o = add(o, months[i][side]); return o; };

  /* 영업이익 차이 분해: 매출 증감(계획 공헌이익률로), 공헌이익률 변화, 고정비 항목별 차이. 합 = 영업이익 차이 */
  function bridge(p, a) {
    const P = derive(p), A = derive(a);
    const items = [
      { key: "vol", label: "매출 증감", v: (A.rev - P.rev) * (P.cmr || 0) },
      { key: "cmr", label: "공헌이익률 변화", v: ((A.cmr || 0) - (P.cmr || 0)) * A.rev },
      { key: "lab", label: "노무비", v: P.lab - A.lab },
      { key: "ovh", label: "제조경비", v: P.ovh - A.ovh },
      { key: "sga", label: "판매관리비", v: P.sga - A.sga }
    ];
    return { plan: P.op, act: A.op, items: items, total: A.op - P.op };
  }

  /* 추정: 기준월 다음 3개월. plan = 계획 유지, ytd = 누계 달성률 반영, trend3 = 최근 3개월 달성률 반영. 그 뒤는 계획 */
  function forecast(months, asOf, method) {
    const ratio = (from, to) => {
      const a = sumRange(months, from, to, "act"), p = sumRange(months, from, to, "plan"), o = {};
      Object.keys(a).forEach((k) => { o[k] = p[k] ? a[k] / p[k] : 1; });
      return o;
    };
    const k = method === "ytd" ? ratio(0, asOf - 1) : method === "trend3" ? ratio(Math.max(0, asOf - 3), asOf - 1) : null;
    const out = [];
    for (let i = asOf; i < 12; i++) {
      const p = months[i].plan, f = blank();
      Object.keys(f).forEach((key) => { f[key] = i < asOf + 3 && k ? p[key] * k[key] : p[key]; });
      out.push({ m: i + 1, v: f, kind: i < asOf + 3 ? "fc" : "plan" });
    }
    return out;
  }

  function report(rows, asOf, scope, method) {
    const months = cube(rows, scope);
    const cur = { plan: derive(months[asOf - 1].plan), act: derive(months[asOf - 1].act) };
    const ytdP = sumRange(months, 0, asOf - 1, "plan"), ytdA = sumRange(months, 0, asOf - 1, "act");
    const fc = forecast(months, asOf, method);
    let rest = blank(); fc.forEach((f) => { rest = add(rest, f.v); });
    const yearP = sumRange(months, 0, 11, "plan"), outlook = add(ytdA, rest);
    const series = months.map((mm, i) => ({
      m: i + 1, plan: derive(mm.plan).op,
      act: i < asOf ? derive(mm.act).op : null,
      fc: i >= asOf ? derive(fc[i - asOf].v).op : null, fcKind: i >= asOf ? fc[i - asOf].kind : null
    }));
    return {
      asOf: asOf, scope: scope, method: method,
      cur: cur, ytd: { plan: derive(ytdP), act: derive(ytdA) }, year: { plan: derive(yearP), outlook: derive(outlook) },
      bridge: bridge(ytdP, ytdA), series: series, lastActual: lastActualMonth(rows)
    };
  }

  function lastActualMonth(rows) {
    let last = 0;
    rows.forEach((r) => { if (r.act !== null && r.ym.slice(0, 4) === String(YEAR)) last = Math.max(last, Number(r.ym.slice(5))); });
    return last;
  }

  /* ---------- 추세와 변동성 ----------
     전년부터 기준월까지의 월 실적으로 선형 추세를 잡고, 잔차 표준편차(σ)로 ±1σ·±2σ 밴드, 이격도(실적 ÷ 추세 − 1),
     z점수를 계산한다. 매출·영업이익은 계획의 월별 비중으로 계절성을 걷어 낸 뒤 추세를 잡는다(계절조정).
     metric: rev | op | opm | cmr */
  const METRICS = { rev: "매출액", op: "영업이익", opm: "영업이익률", cmr: "공헌이익률" };
  function trend(rows, scope, metric, asOf, opts) {
    opts = Object.assign({ seasonal: true, ahead: 3 }, opts || {});
    const ratio = metric === "opm" || metric === "cmr";
    const plan = cube(rows, scope, YEAR).map((m) => derive(m.plan).rev);
    const pm = Fin.sum(plan) / 12;
    const si = plan.map((v) => (pm ? v / pm : 1));          /* 계절지수: 계획 매출의 월별 비중 */
    const pts = [];
    [YEAR - 1, YEAR].forEach((y) => {
      const c = cube(rows, scope, y);
      c.forEach((mm, i) => {
        if (!mm.hasAct || (y === YEAR && i + 1 > asOf)) return;
        const raw = derive(mm.act)[metric];
        const k = !ratio && opts.seasonal ? si[i] : 1;
        pts.push({ y: y, m: i + 1, label: String(y).slice(2) + "." + String(i + 1).padStart(2, "0"), raw: raw, si: k, v: raw / k });
      });
    });
    if (pts.length < 6) return { ok: false, n: pts.length };
    pts.forEach((p, i) => { p.t = i + 1; });
    const reg = Stats.linreg(pts.map((p) => p.t), pts.map((p) => p.v));
    const sig = reg.se, mLevel = Stats.mean(pts.map((p) => p.v));
    pts.forEach((p, i) => {
      p.fit = reg.fit[i]; p.res = reg.resid[i]; p.z = sig > 0 ? p.res / sig : 0;
      p.gap = ratio ? p.v - p.fit : (p.fit ? p.v / p.fit - 1 : null);       /* 비율 지표는 %p 차이 */
      p.flag = Math.abs(p.z) >= 2 ? "alert" : Math.abs(p.z) >= 1 ? "watch" : "";
    });
    /* 다음 몇 달 추정과 ±1σ 예측 구간(t분포, 약 68%) */
    const tq = Stats.tInv(Stats.normCdf(1), reg.df), ahead = [];
    for (let j = 1; j <= opts.ahead; j++) {
      const t = pts.length + j, mi = (asOf + j - 1) % 12;
      if (asOf + j > 12) break;
      const k = !ratio && opts.seasonal ? si[mi] : 1, f = reg.at(t), h = reg.predHalf(t, tq);
      ahead.push({ t: t, m: mi + 1, label: String(YEAR).slice(2) + "." + String(mi + 1).padStart(2, "0"), v: f, lo: f - h, hi: f + h, raw: f * k, rawLo: (f - h) * k, rawHi: (f + h) * k });
    }
    /* 최근 3개월 평균의 추세 대비 위치(모멘텀) */
    const last3 = pts.slice(-3), mom = Stats.mean(last3.map((p) => p.res)) / (sig || 1);
    return {
      ok: true, metric: metric, label: METRICS[metric], ratio: ratio, seasonal: !ratio && opts.seasonal, si: si, pts: pts, ahead: ahead,
      slope: reg.b, slopeT: reg.t, slopeP: reg.p, r2: reg.r2, sigma: sig, cvResid: mLevel ? sig / Math.abs(mLevel) : null,
      growth: !ratio && mLevel ? reg.b * 12 / Math.abs(mLevel) : null, a: reg.a, last: pts[pts.length - 1], momentum: mom, df: reg.df,
      share1: pts.filter((p) => Math.abs(p.z) <= 1).length / pts.length
    };
  }

  /* ---------- 계획 편향 ----------
     보고 연도의 월별 달성률(실적 ÷ 계획)이 체계적으로 100%에서 벗어나는지 한 표본 t검정으로 본다. MAPE는 계획 오차의 평균 크기 */
  function planBias(rows, scope, asOf, key) {
    const c = cube(rows, scope, YEAR), r = [];
    for (let i = 0; i < asOf; i++) {
      if (!c[i].hasAct) continue;
      const p = derive(c[i].plan)[key], a = derive(c[i].act)[key];
      if (p) r.push({ m: i + 1, rate: a / p, err: (a - p) / Math.abs(p) });
    }
    if (r.length < 3) return { ok: false, n: r.length };
    const rates = r.map((x) => x.rate), tt = Stats.tTest1(rates, 1);
    return { ok: true, key: key, n: r.length, months: r, mean: tt.mean, sd: Stats.sd(rates), t: tt.t, p: tt.p, mape: Stats.mean(r.map((x) => Math.abs(x.err))),
      hits: r.filter((x) => x.rate >= 1).length };
  }

  return { YEAR, ACCTS, BUS, METRICS, sample, toCsv, parse, cube, derive, bridge, forecast, report, lastActualMonth, trend, planBias };
});

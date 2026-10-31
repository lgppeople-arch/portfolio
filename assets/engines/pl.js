/* 월 손익 보고 엔진: 기간·사업부·계정별 계획과 실적(SAP 관리손익 조회 형식)으로
   당월·누계 손익, 영업이익 차이 분해, 3개월 추정과 연간 전망을 만든다. 금액은 억원. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../fin.js") : root.Fin);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PlEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin) {
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
  function cube(rows, scope) {
    const months = [];
    for (let m = 1; m <= 12; m++) months.push({ plan: blank(), act: blank(), hasAct: false });
    rows.forEach((r) => {
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
    rows.forEach((r) => { if (r.act !== null) last = Math.max(last, Number(r.ym.slice(5))); });
    return last;
  }

  return { YEAR, ACCTS, BUS, sample, toCsv, parse, cube, derive, bridge, forecast, report, lastActualMonth };
});

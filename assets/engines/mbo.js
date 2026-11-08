/* 성과평가(MBO·KPI) 엔진: KPI별 구간 점수, 조직 가중 점수와 등급, 인센티브 배분, KPI 설계 점검.
   점수 구간은 하한 = 60점, 목표 = 100점, 도전 목표 = 120점(상한)이고, 하한에 못 미치면 0점이다. */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../fin.js") : root.Fin, node ? require("../stats.js") : root.Stats);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MboEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin, Stats) {
  "use strict";

  /* 가상의 제조사 세 조직. dir: up = 클수록 좋음, down = 작을수록 좋음. ctrl: 조직이 통제할 수 있는 지표인지 */
  const DEFAULTS = {
    scale: { th: 60, tg: 100, st: 120 },
    grades: [
      { g: "S", min: 110, mult: 1.5 },
      { g: "A", min: 100, mult: 1.2 },
      { g: "B", min: 90, mult: 1.0 },
      { g: "C", min: 80, mult: 0.7 },
      { g: "D", min: 0, mult: 0.3 }
    ],
    pool: 30,
    orgs: [
      { name: "영업본부", heads: 42, kpis: [
        { name: "매출액", unit: "억원", dir: "up", w: 40, th: 2700, tg: 3000, st: 3300, prev: 2850, act: 3080, ctrl: true },
        { name: "신규 고객 매출 비중", unit: "%", dir: "up", w: 20, th: 8, tg: 12, st: 15, prev: 9, act: 10.5, ctrl: true },
        { name: "매출채권 회전일수", unit: "일", dir: "down", w: 20, th: 75, tg: 65, st: 58, prev: 70, act: 63, ctrl: true },
        { name: "핵심 고객 만족도", unit: "점", dir: "up", w: 20, th: 80, tg: 85, st: 90, prev: 86, act: 86, ctrl: true }
      ] },
      { name: "생산본부", heads: 310, kpis: [
        { name: "제조 원가율", unit: "%", dir: "down", w: 35, th: 74, tg: 71, st: 69, prev: 72.5, act: 72.2, ctrl: false },
        { name: "설비 가동률", unit: "%", dir: "up", w: 25, th: 75, tg: 82, st: 88, prev: 79, act: 80, ctrl: true },
        { name: "납기 준수율", unit: "%", dir: "up", w: 20, th: 92, tg: 96, st: 98.5, prev: 95, act: 97.1, ctrl: true },
        { name: "중대 안전사고", unit: "건", dir: "down", w: 20, th: 2, tg: 0, st: 0, prev: 1, act: 0, ctrl: true }
      ] },
      { name: "연구소", heads: 85, kpis: [
        { name: "신제품 개발 과제 완료", unit: "건", dir: "up", w: 40, th: 3, tg: 5, st: 6, prev: 4, act: 4, ctrl: true },
        { name: "신제품 매출", unit: "억원", dir: "up", w: 30, th: 120, tg: 180, st: 230, prev: 140, act: 150, ctrl: false },
        { name: "특허 출원", unit: "건", dir: "up", w: 15, th: 8, tg: 12, st: 15, prev: 10, act: 13, ctrl: true },
        { name: "개발비 예산 준수율", unit: "%", dir: "up", w: 15, th: 90, tg: 100, st: 100, prev: 97, act: 98, ctrl: true }
      ] }
    ]
  };

  /* 방향을 맞춰(작을수록 좋은 지표는 부호를 바꿔) 하한·목표·도전 구간 안에서 직선으로 점수를 매긴다 */
  function score(k, sc) {
    const s = k.dir === "down" ? -1 : 1;
    const A = s * k.act, TH = s * k.th, TG = s * k.tg, ST = s * k.st;
    if (!(TH <= TG && TG <= ST)) return null;
    if (A < TH) return 0;
    if (A < TG) return TG === TH ? sc.tg : sc.th + (sc.tg - sc.th) * (A - TH) / (TG - TH);
    if (ST === TG) return sc.tg;
    if (A < ST) return sc.tg + (sc.st - sc.tg) * (A - TG) / (ST - TG);
    return sc.st;
  }

  function gradeOf(total, grades) {
    const g = grades.slice().sort((a, b) => b.min - a.min).find((x) => total >= x.min);
    return g || grades[grades.length - 1];
  }

  /* 설계 점검: 결과가 아니라 KPI를 짜는 단계에서 흔히 생기는 문제 */
  function checks(org) {
    const out = [];
    const wsum = Fin.sum(org.kpis.map((k) => k.w));
    if (Math.abs(wsum - 100) > 1e-9) out.push({ lv: "bad", text: "가중치 합이 " + Fin.num(wsum, 0) + "%입니다. 100%가 되도록 맞춰야 합니다." });
    if (org.kpis.length > 6) out.push({ lv: "warn", text: "지표가 " + org.kpis.length + "개입니다. 많으면 하나하나의 무게가 약해집니다." });
    org.kpis.forEach((k) => {
      const s = k.dir === "down" ? -1 : 1;
      if (!(s * k.th <= s * k.tg && s * k.tg <= s * k.st)) out.push({ lv: "bad", text: k.name + ": 하한·목표·도전의 순서가 방향과 맞지 않습니다." });
      else if (s * k.tg <= s * k.prev) out.push({ lv: "warn", text: k.name + ": 목표(" + Fin.num(k.tg, 1) + ")가 전년 실적(" + Fin.num(k.prev, 1) + ")보다 쉽습니다." });
      if (k.w < 10) out.push({ lv: "warn", text: k.name + ": 가중치 " + k.w + "%는 평가에 거의 영향이 없습니다." });
      if (k.w > 40) out.push({ lv: "warn", text: k.name + ": 가중치 " + k.w + "%로 한 지표에 쏠려 있습니다." });
      if (!k.ctrl) out.push({ lv: "warn", text: k.name + ": 조직이 통제하기 어려운 지표입니다. 가중치를 낮추거나 외부 요인을 조정한 기준으로 평가합니다." });
    });
    return out;
  }

  function evaluate(x) {
    const orgs = x.orgs.map((o) => {
      const wsum = Fin.sum(o.kpis.map((k) => k.w)) || 1;
      const rows = o.kpis.map((k) => {
        const sc = score(k, x.scale);
        return { k: k, score: sc, contrib: sc === null ? 0 : sc * k.w / wsum };
      });
      const total = Fin.sum(rows.map((r) => r.contrib));
      const g = gradeOf(total, x.grades);
      return { name: o.name, heads: o.heads, rows: rows, total: total, grade: g.g, mult: g.mult, checks: checks(o), wsum: wsum };
    });
    const base = orgs.map((o) => o.heads * o.mult), bsum = Fin.sum(base);
    orgs.forEach((o, i) => {
      o.alloc = bsum > 0 ? x.pool * base[i] / bsum : 0;
      o.perHead = o.heads > 0 ? o.alloc / o.heads * 1e4 : 0;       /* 억원 → 만원 */
    });
    return { orgs: orgs, pool: x.pool, allocSum: Fin.sum(orgs.map((o) => o.alloc)) };
  }

  /* ---------- 팀 평가 결과의 분포 ----------
     가상 예시: 세 본부 48개 팀, 평가자 4명. 평가자 C는 점수를 후하고 가운데로 몰아 주고(관대화·중심화),
     평가자 D는 짜고 넓게 퍼뜨린다. 같은 시드로 만들어 매번 같은 값이 나온다. */
  const GUIDE = { S: 10, A: 20, B: 40, C: 20, D: 10 };     /* 등급 분포 가이드(%) */
  function sampleTeams() {
    const r = Stats.rng(2026), out = [];
    const plan = [
      ["영업본부", "A", 12, 101, 7.5], ["생산본부", "B", 12, 99, 7.0], ["생산본부", "C", 12, 106, 3.2], ["연구소", "D", 12, 95, 10.5]
    ];
    plan.forEach((p) => {
      for (let i = 0; i < p[2]; i++) {
        const score = Math.max(55, Math.min(120, Math.round((p[3] + p[4] * r.normal()) * 10) / 10));
        const heads = 6 + Math.floor(r.u() * 20);
        out.push({ team: p[0].slice(0, 2) + "-" + p[1] + String(i + 1).padStart(2, "0"), div: p[0], rater: p[1], heads: heads, score: score });
      }
    });
    return out;
  }
  function teamsToCsv(t) { return ["팀,본부,평가자,인원,점수"].concat(t.map((x) => [x.team, x.div, x.rater, x.heads, x.score].join(","))).join("\n"); }
  function parseTeams(text) {
    const rows = [], errors = [];
    String(text).split(/\r?\n/).map((l) => l.trim()).filter((l) => l).forEach((line, i) => {
      const c = line.split(/\t|,/).map((v) => v.trim());
      if (i === 0 && /팀/.test(c[0])) return;
      const h = Number(c[3]), sc = Number(c[4]);
      if (c.length < 5 || !isFinite(h) || !isFinite(sc) || h <= 0) { errors.push((i + 1) + "번째 줄: 팀, 본부, 평가자, 인원, 점수 순서인지 확인하세요"); return; }
      rows.push({ team: c[0], div: c[1], rater: c[2], heads: h, score: sc });
    });
    return { rows: rows, errors: errors };
  }

  /* 인원 가중 지니: 팀별 1인당 금액을 인원만큼 펼쳐 계산 */
  function personGini(teams, alloc) {
    const per = []; teams.forEach((t, i) => { const v = alloc[i] / t.heads; for (let k = 0; k < Math.round(t.heads); k++) per.push(v); });
    return { gini: Stats.gini(per), top20: Stats.topShare(per, 0.2), lorenz: Stats.lorenz(per) };
  }

  function distribution(teams, grades, pool, opts) {
    opts = Object.assign({ target: 100, band: 5 }, opts || {});
    const sc = teams.map((t) => t.score), d = Stats.describe(sc);
    const gOf = (v) => gradeOf(v, grades);
    const order = grades.slice().sort((a, b) => b.min - a.min).map((g) => g.g);
    const count = (arr) => { const o = {}; order.forEach((g) => { o[g] = 0; }); arr.forEach((g) => { o[g] = (o[g] || 0) + 1; }); return o; };
    const g0 = teams.map((t) => gOf(t.score).g), c0 = count(g0);
    const fit = Stats.chi2Fit(order.map((g) => c0[g]), order.map((g) => GUIDE[g] || 0));
    const shares = order.map((g) => c0[g]);
    /* 평가자별·본부별 */
    const groupBy = (key) => {
      const keys = Array.from(new Set(teams.map((t) => t[key]))).sort();
      const groups = keys.map((k) => teams.filter((t) => t[key] === k).map((t) => t.score));
      const av = groups.every((g) => g.length >= 2) && keys.length >= 2 ? Stats.anova(groups) : null;
      return { keys: keys, stats: keys.map((k, i) => { const g = groups[i], dd = Stats.describe(g); const tt = g.length >= 2 ? Stats.tTest1(g, d.mean) : null;
        return { key: k, n: g.length, mean: dd.mean, sd: dd.sd, q1: dd.q1, median: dd.median, q3: dd.q3, min: dd.min, max: dd.max, diff: dd.mean - d.mean, t: tt ? tt.t : null, p: tt ? tt.p : null }; }), anova: av };
    };
    const byRater = groupBy("rater"), byDiv = groupBy("div");
    /* 보정: 평가자 안에서 z점수로 바꾼 뒤 전체 평균·표준편차로 되돌린다(평가자별 관대화·산포 차이 제거) */
    const rs = {}; byRater.stats.forEach((q) => { rs[q.key] = q; });
    const adj = teams.map((t) => { const q = rs[t.rater]; return q.sd > 0 ? d.mean + d.sd * (t.score - q.mean) / q.sd : t.score; });
    const g1 = adj.map((v) => gOf(v).g), c1 = count(g1), changed = g1.filter((g, i) => g !== g0[i]).length;
    const fit1 = Stats.chi2Fit(order.map((g) => c1[g]), order.map((g) => GUIDE[g] || 0));
    /* 인센티브: 인원 × 등급 배수 비례 */
    const allocOf = (gs) => { const base = teams.map((t, i) => t.heads * gOf(gs === g0 ? t.score : adj[i]).mult), s = Fin.sum(base); return base.map((b) => (s ? pool * b / s : 0)); };
    const a0 = allocOf(g0), a1 = allocOf(g1);
    return {
      n: teams.length, d: d, order: order, guide: GUIDE,
      center: sc.filter((v) => Math.abs(v - d.median) <= opts.band).length / sc.length,     /* 중앙값 ±band점 안 비중(중심화 경향) */
      leniency: Stats.tTest1(sc, opts.target),                                                /* 평균이 목표 점수와 다른가 */
      grades0: c0, fit: fit, hhi: Stats.hhi(shares), effGrades: 1 / Stats.hhi(shares),
      byRater: byRater, byDiv: byDiv,
      adj: adj, grades1: c1, fit1: fit1, changed: changed, g0: g0, g1: g1,
      alloc0: a0, alloc1: a1, ineq0: personGini(teams, a0), ineq1: personGini(teams, a1),
      hist: Stats.histogram(sc, 13, 55, 120)
    };
  }

  return { DEFAULTS, GUIDE, score, gradeOf, checks, evaluate, sampleTeams, teamsToCsv, parseTeams, distribution };
});

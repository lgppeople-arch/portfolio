/* 성과평가(MBO·KPI) 엔진: KPI별 구간 점수, 조직 가중 점수와 등급, 인센티브 배분, KPI 설계 점검.
   점수 구간은 하한 = 60점, 목표 = 100점, 도전 목표 = 120점(상한)이고, 하한에 못 미치면 0점이다. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("../fin.js") : root.Fin);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MboEngine = api;
})(typeof self !== "undefined" ? self : this, function (Fin) {
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

  return { DEFAULTS, score, gradeOf, checks, evaluate };
});

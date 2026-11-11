/* 자산 손상·운전자본 키트 엔진. 금액 억원, 예시는 모두 가상.
   1. 손상검사(K-IFRS 1036 자산손상의 계산 구조): 현금창출단위(CGU)의 장부금액과 회수가능액(= max(사용가치, 처분부대원가를 뺀 공정가치))을 비교한다.
      사용가치 = 5년 현금흐름 현재가치 + 영구성장 잔존가치. 손상차손은 영업권에 먼저, 나머지는 다른 자산에 장부금액 비례로 배분(개별 회수가능액 하한은 단순화로 생략).
      손익분기 할인율·현금흐름 감소율(여유가 0이 되는 값)과 할인율 × 영구성장률 민감도.
   2. 운전자본: 매출채권 회전일(DSO) + 재고 회전일(DIO) − 매입채무 회전일(DPO) = 현금전환주기(CCC).
      회전일을 줄이면 풀리는 현금, 투하자본이 줄어 오르는 ROIC, 매출이 늘 때 필요한 운전자본 투자. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.AssetEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  /* ---------- 1. 손상검사 ---------- */
  const IMP = {
    assets: [["영업권", 120], ["유형자산", 900], ["무형자산(기술·고객)", 80]],  /* CGU 장부금액 구성 */
    cf1: 135,      /* 내년 세전 현금흐름(억원) */
    g: 3,          /* 1~5년 연 성장률 % */
    gT: 1,         /* 영구성장률 % */
    r: 11,         /* 세전 할인율 % */
    fv: 950,       /* 처분부대원가를 뺀 공정가치 */
    shock: 0       /* 내년 현금흐름 하락 % (업황 악화 시나리오) */
  };
  function viu(p, rOverride, gTOverride, cfScale) {
    const r = (rOverride !== undefined ? rOverride : p.r) / 100, gT = (gTOverride !== undefined ? gTOverride : p.gT) / 100, g = p.g / 100;
    const cf1 = p.cf1 * (1 - p.shock / 100) * (cfScale === undefined ? 1 : cfScale);
    let pv = 0, cf = cf1; const rows = [];
    for (let t = 1; t <= 5; t++) { if (t > 1) cf *= 1 + g; const d = cf / Math.pow(1 + r, t); pv += d; rows.push({ t: t, cf: cf, pv: d }); }
    const tv = cf * (1 + gT) / (r - gT), pvTv = tv / Math.pow(1 + r, 5);
    return { value: pv + pvTv, pvCf: pv, pvTv: pvTv, tvShare: pvTv / (pv + pvTv), rows: rows };
  }
  function impairment(p) {
    const carrying = sum(p.assets.map((a) => a[1])), v = viu(p), rec = Math.max(v.value, p.fv), loss = Math.max(0, carrying - rec);
    /* 배분: 영업권 먼저, 나머지는 장부금액 비례 */
    const gw = p.assets[0][1], toGw = Math.min(loss, gw), rest = loss - toGw, others = p.assets.slice(1), ob = sum(others.map((a) => a[1]));
    const alloc = [toGw].concat(others.map((a) => (ob > 0 ? rest * a[1] / ob : 0)));
    /* 손익분기: 사용가치 = 장부금액이 되는 할인율, 현금흐름 배수 */
    const target = carrying;
    let lo = p.gT + 0.01, hi = 60;
    const f = (r) => viu(p, r).value;
    let beR = null; if (f(lo) >= target && f(hi) <= target) { for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (f(m) > target) lo = m; else hi = m; } beR = (lo + hi) / 2; }
    const beScale = target / v.value; /* 현금흐름 전체가 이 배수가 되면 사용가치 = 장부금액(선형) */
    return { carrying: carrying, viu: v, fv: p.fv, rec: rec, basis: v.value >= p.fv ? "사용가치" : "공정가치", loss: loss, alloc: alloc, headroom: rec - carrying, beR: beR, beCut: 1 - beScale };
  }
  /* 할인율 × 영구성장률 격자의 여유(회수가능액 − 장부금액) */
  function grid(p, rs, gs) {
    const carrying = sum(p.assets.map((a) => a[1]));
    return rs.map((r) => gs.map((g) => Math.max(viu(p, r, g).value, p.fv) - carrying));
  }

  /* ---------- 2. 운전자본 ---------- */
  const WC = { rev: 3000, cogs: 2200, ar: 620, inv: 480, ap: 300, nopat: 260, ic: 2400, growth: 15, target: { dso: 60, dio: 65, dpo: 55 } };
  function wc(w, t) {
    t = t || w.target;
    const dso = w.ar / w.rev * 365, dio = w.inv / w.cogs * 365, dpo = w.ap / w.cogs * 365, ccc = dso + dio - dpo, nwc = w.ar + w.inv - w.ap;
    const rel = { ar: w.ar - t.dso * w.rev / 365, inv: w.inv - t.dio * w.cogs / 365, ap: t.dpo * w.cogs / 365 - w.ap };   /* 풀리는 현금(+) */
    const release = rel.ar + rel.inv + rel.ap, cccT = t.dso + t.dio - t.dpo;
    const roic0 = w.nopat / w.ic, roic1 = w.nopat / (w.ic - release);
    const needGrowth = nwc * w.growth / 100, needGrowthT = (nwc - release) * w.growth / 100;
    return { dso: dso, dio: dio, dpo: dpo, ccc: ccc, nwc: nwc, rel: rel, release: release, cccT: cccT, roic0: roic0, roic1: roic1, needGrowth: needGrowth, needGrowthT: needGrowthT, perDayRev: w.rev / 365, perDayCogs: w.cogs / 365 };
  }

  return { IMP, viu, impairment, grid, WC, wc };
});

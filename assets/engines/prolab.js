/* 추정·가치 기법 노트 엔진: 컨설팅, 증권사 리서치, 학계에서 널리 쓰는 추정·가치평가 기법의 계산. 예시 수치는 모두 가상.
   1. 가치동인 공식(Koller 외, Valuation): 가치 = NOPAT₁ × (1 − g ÷ ROIC) ÷ (WACC − g)
   2. 역DCF(Rappaport·Mauboussin, Expectations Investing): 현재 가치가 요구하는 성장률을 거꾸로 푼다
   3. 경쟁우위 기간과 페이드(Mauboussin·Johnson 1997): ROIC가 자본비용으로 수렴하면 가치 = 투하자본
   4. 기준율 보정(Kahneman·Tversky 1979): 보정 예측 = 기준율 + 상관 × (내부 예측 − 기준율)
   5. 경험곡선(Wright 1936, BCG 1968): 단위원가 = 첫 단위 원가 × 누적생산량^log₂(진척률)
   6. 바스 확산 모형(Bass 1969): F(t) = (1 − e^−(p+q)t) ÷ (1 + (q/p)e^−(p+q)t)
   7. 결정나무와 완전정보의 가치(Raiffa 1968, Howard 1966): EVPI = Σ 확률 × 상태별 최선 − 최선 대안의 기댓값
   8. 가격·물량·믹스 분해: 가격 + 물량 + 믹스 = 매출 차이 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("../stats.js") : root.Stats);
  if (node) module.exports = api; else root.ProLab = api;
})(typeof self !== "undefined" ? self : this, function (S) {
  "use strict";

  /* 1. 가치동인 공식. 단위는 입력과 같음. g < wacc 이어야 한다 */
  const valueDriver = (nopat1, g, roic, wacc) => nopat1 * (1 - g / roic) / (wacc - g);

  /* 2. 2단계 모형: n년간 g로 성장(재투자율 g÷ROIC), 이후 영구성장 gT·ROIC = roicT */
  function twoStage(nopat0, g, n, roic, wacc, gT, roicT) {
    let pv = 0, nop = nopat0; const rows = [];
    for (let t = 1; t <= n; t++) { nop *= 1 + g; const fcf = nop * (1 - g / roic), d = fcf / Math.pow(1 + wacc, t); pv += d; rows.push({ t: t, nopat: nop, fcf: fcf, pv: d }); }
    const tv = valueDriver(nop * (1 + gT), gT, roicT, wacc), pvTv = tv / Math.pow(1 + wacc, n);
    return { value: pv + pvTv, pvExplicit: pv, pvTv: pvTv, tvShare: pvTv / (pv + pvTv), rows: rows };
  }
  /* 가치 ev를 만드는 성장률 g(이분법). ROIC > WACC일 때 g가 클수록 가치가 커진다 */
  function impliedGrowth(ev, nopat0, n, roic, wacc, gT, roicT) {
    let lo = -0.3, hi = roic * 0.98; const f = (g) => twoStage(nopat0, g, n, roic, wacc, gT, roicT).value;
    if (ev <= f(lo)) return lo; if (ev >= f(hi)) return hi;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) < ev) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  /* 3. 페이드: ROIC가 roic0에서 wacc까지 cap년에 걸쳐 직선으로 내려간다(각 해는 그 해 중간 시점의 값). 그 뒤에는 ROIC = WACC 이므로 가치 = 그 시점 투하자본 */
  function fade(ic0, roic0, wacc, g, cap) {
    let ic = ic0, pv = 0; const rows = [];
    for (let t = 1; t <= cap; t++) {
      const r = roic0 + (wacc - roic0) * (t - 0.5) / cap, nopat = r * ic, fcf = nopat - g * ic;
      pv += fcf / Math.pow(1 + wacc, t); ic *= 1 + g; rows.push({ t: t, roic: r, nopat: nopat, fcf: fcf });
    }
    const value = pv + ic / Math.pow(1 + wacc, cap);
    return { value: value, multiple: value / ic0, rows: rows };
  }

  /* 4. 기준율 보정 */
  const shrink = (inside, base, r) => base + r * (inside - base);
  /* 참조집단: 비슷한 규모 기업 200곳의 3년 연평균 매출 성장률(%)(가상) */
  function refClass() { const r = S.rng(3301), a = []; for (let i = 0; i < 200; i++) a.push(+(4 + 9 * r.normal() + 3 * Math.max(0, r.normal())).toFixed(1)); return a; }
  const percentileOf = (a, v) => a.filter((x) => x <= v).length / a.length;

  /* 5. 경험곡선 */
  const expCost = (c1, n, lr) => c1 * Math.pow(n, Math.log(lr) / Math.LN2);
  /* 누적 생산량과 단위원가(가상): 진척률 82% 근처에 잡음 */
  function expData() { const r = S.rng(4407), rows = []; [1, 2, 4, 7, 12, 20, 33, 55, 90, 150].forEach((n) => rows.push({ n: n, c: +(expCost(100, n, 0.82) * Math.exp(0.035 * r.normal())).toFixed(1) })); return rows; }
  function expFit(rows) {
    const L = S.linreg(rows.map((d) => Math.log(d.n)), rows.map((d) => Math.log(d.c)));
    return { b: L.b, lr: Math.pow(2, L.b), c1: Math.exp(L.a), r2: L.r2, seB: L.seB, df: L.df, lrLo: Math.pow(2, L.b - S.tInv(0.975, L.df) * L.seB), lrHi: Math.pow(2, L.b + S.tInv(0.975, L.df) * L.seB) };
  }

  /* 6. 바스 확산 */
  const bassF = (t, p, q) => { const e = Math.exp(-(p + q) * t); return (1 - e) / (1 + (q / p) * e); };
  const bassf = (t, p, q) => { const e = Math.exp(-(p + q) * t), d = 1 + (q / p) * e; return ((p + q) * (p + q) / p) * e / (d * d); };
  const bassPeak = (p, q) => (q > p ? Math.log(q / p) / (p + q) : 0);
  function bass(m, p, q, years) { const rows = []; for (let t = 1; t <= years; t++) rows.push({ t: t, cum: m * bassF(t, p, q), sales: m * (bassF(t, p, q) - bassF(t - 1, p, q)) }); return { rows: rows, peak: bassPeak(p, q), peakShare: bassF(bassPeak(p, q), p, q) }; }

  /* 7. 결정나무: payoff[대안][상태], probs[상태] */
  const TREE = { acts: ["대형 라인", "소형 라인", "투자 보류"], states: ["수요 강함", "수요 보통", "수요 약함"], payoff: [[120, 30, -80], [50, 25, -10], [0, 0, 0]] };
  function decide(payoff, probs) {
    const emv = payoff.map((row) => S.sum(row.map((v, j) => v * probs[j])));
    const best = emv.indexOf(Math.max.apply(null, emv));
    const perfect = S.sum(probs.map((p, j) => p * Math.max.apply(null, payoff.map((row) => row[j]))));
    return { emv: emv, best: best, perfect: perfect, evpi: perfect - emv[best], bestByState: probs.map((_, j) => { const col = payoff.map((row) => row[j]); return col.indexOf(Math.max.apply(null, col)); }) };
  }

  /* 8. 가격·물량·믹스. items: {name, p0, q0, p1, q1} */
  const PVM = [{ name: "A 제품", p0: 100, q0: 500, p1: 96, q1: 560 }, { name: "B 제품", p0: 160, q0: 300, p1: 165, q1: 270 }, { name: "C 제품", p0: 60, q0: 400, p1: 60, q1: 520 }];
  function pvm(items) {
    const r0 = S.sum(items.map((d) => d.p0 * d.q0)), r1 = S.sum(items.map((d) => d.p1 * d.q1)), q0 = S.sum(items.map((d) => d.q0)), q1 = S.sum(items.map((d) => d.q1)), avg0 = r0 / q0;
    const price = S.sum(items.map((d) => (d.p1 - d.p0) * d.q1)), volume = (q1 - q0) * avg0, mix = S.sum(items.map((d) => d.p0 * d.q1)) - avg0 * q1;
    return { r0: r0, r1: r1, price: price, volume: volume, mix: mix, avg0: avg0, avg1: r1 / q1, q0: q0, q1: q1 };
  }

  return { valueDriver, twoStage, impliedGrowth, fade, shrink, refClass, percentileOf, expCost, expData, expFit, bassF, bassf, bassPeak, bass, TREE, decide, PVM, pvm };
});

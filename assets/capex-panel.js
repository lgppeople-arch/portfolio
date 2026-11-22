/* 투자를 늘린 제조업체는 3년 뒤 더 벌까(tools/capex-panel.html) 화면. 계산은 assets/engines/capexpanel.js, 자료는 assets/data/capex-panel.js */
(function () {
  "use strict";
  const F = window.Fin, E = window.CapexPanel, D = window.CapexPanelData, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!E || !D) return;
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const sg = (v, d) => (v > 0 ? "+" : "") + fmt(v, d);
  const pp = (v, d) => sg(v * 100, d === undefined ? 2 : d) + "%p";
  function frame(id, H, label) { const host = $(id); host.textContent = ""; const W = Math.max(300, Math.round(host.clientWidth || 680)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, host), W: W, nar: W < 560 }; }
  function yAxis(s, l, r2, y, tk, f) { tk.ticks.forEach((t) => { sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: Math.abs(t) < 1e-12 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(t) + 4, f(t), { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }); }); }

  const A = E.analyze(D), P = A.P, M = D.meta, fm = A.fm, Q = A.quint, O = A.oos;
  const st = (m, j) => fm[m].stats[j];
  const inv = st("M2_fe", 0), mr = st("M2_fe", 1), naive = st("M1", 0), ag = st("M3_fe", 0), qs = Q.spread;
  const sig = (s) => Math.abs(s.tNw) >= 2;
  $("hm-n").textContent = M.n_firms + "곳 · " + P.D.length.toLocaleString("ko-KR") + "개 관측치";
  $("dl-date").textContent = "2026.11.22";
  $("data-note").textContent = "대상은 2026년 3~5월에 2025년 사업보고서를 낸 코스피 12월 결산 제조업체 중 " + M.n_firms + "곳이고, 투자한 해 " + M.years[0] + "~" + M.years[1] + "년(3년 뒤는 " + (M.years[0] + 3) + "~" + (M.years[1] + 3) + "년)의 " + P.D.length.toLocaleString("ko-KR") + "개 관측치입니다. 극단값의 영향을 줄이려고 해마다 변수별 위아래 1%를 그 경계값으로 바꿨습니다(절단). 지금 상장된 회사만 들어 있어, 투자했다가 실패해 상장폐지된 회사는 빠져 있습니다(생존 편향: 결과를 투자에 유리한 쪽으로 기울게 함).";

  /* ---------- 결론 ---------- */
  const qd = Q.mean.droa, q5 = qd[4] - qd[0];
  const tk = $("tk");
  const tkRows = [
    [q5 < 0 ? "많이 늘린 회사의 ROA는 오히려 내려갔다" : "많이 늘린 회사의 ROA가 더 올랐다", "투자율 상위 20% 묶음의 3년 뒤 ROA 변화는 " + pp(qd[4]) + ", 하위 20%는 " + pp(qd[0]) + "로 차이가 " + pp(q5) + "였습니다(연도별 차이의 t " + fmt(qs.droa.tNw, 1) + ")."],
    [sig(inv) ? (inv.mean < 0 ? "평균 회귀를 빼도 투자율은 불리했다" : "평균 회귀를 빼면 투자율은 유리했다") : "평균 회귀를 빼면 투자율의 효과는 뚜렷하지 않았다", "올해 ROA·규모·매출 증가율·업종을 함께 넣은 회귀에서 투자율 10%p당 3년 뒤 ROA 변화는 " + pp(inv.mean * 0.1) + "(t " + fmt(inv.tNw, 1) + ")였습니다. 같은 식에서 올해 ROA의 계수는 " + fmt(mr.mean, 2) + "로, 3년이면 격차의 " + fmt(-mr.mean * 100, 0) + "%가 사라졌습니다."],
    [O.mae.M2 < O.mae.M0 ? "예측에는 조금 보탬이 됐다" : "예측에는 보탬이 되지 않았다", "과거 자료만으로 3년 뒤를 예측한 평균 오차는 평균 회귀만 쓴 식 " + pp(O.mae.M0) + ", 투자율 등을 더한 식 " + pp(O.mae.M2) + "였습니다(" + O.years.length + "개 연도 중 " + O.wins + "번 더 나음). 둘 다 'ROA 그대로'(" + pp(O.mae.naive) + ")보다는 정확했습니다."]
  ];
  tkRows.forEach((q) => { const d = F.el("div"); d.appendChild(F.el("b", { text: q[0] })); d.appendChild(F.el("p", { text: q[1] })); tk.appendChild(d); });
  const qa = $("qa-tb");
  [["투자를 많이 늘린 회사는 3년 뒤 ROA가 올랐나", "해마다 투자율 5분위로 나눠 3년 뒤 ROA 변화 평균", "상위 20% " + pp(qd[4]) + " vs 하위 20% " + pp(qd[0]) + " (차이 " + pp(q5) + ")"],
   ["평균 회귀를 빼도 남나", "연도별 횡단면 회귀(올해 ROA·규모·매출 증가율·업종 통제), 뉴이-웨스트 t", "투자율 10%p당 " + pp(inv.mean * 0.1) + " (t " + fmt(inv.tNw, 1) + (sig(inv) ? ", |t| ≥ 2" : ", |t| < 2: 우연과 구별 어려움") + "). 통제 전 " + pp(naive.mean * 0.1) + " (t " + fmt(naive.tNw, 1) + ")"],
   ["투자율을 알면 더 잘 맞히나", "해마다 과거 관측치만으로 추정한 식으로 3년 뒤 예측(" + O.years.map((r) => r.year).join("·") + "년)", "평균 오차 " + pp(O.mae.M2) + " vs 평균 회귀만 " + pp(O.mae.M0) + (O.mae.M2 < O.mae.M0 ? " (조금 나음)" : " (나아지지 않음)")],
   ["매출은 따라오나", "투자율 5분위별 이후 3년 연평균 매출 증가율", "상위 20% " + sg(Q.mean.sg3[4] * 100, 1) + "% vs 하위 20% " + sg(Q.mean.sg3[0] * 100, 1) + "% (차이 t " + fmt(qs.sg3.tNw, 1) + ")"]
  ].forEach((q) => { const tr = F.el("tr"); tr.appendChild(F.el("th", { text: q[0] })); tr.appendChild(F.el("td", { text: q[1] })); tr.appendChild(F.el("td", { text: q[2] })); qa.appendChild(tr); });

  /* ---------- 회귀 표 ---------- */
  const ft = $("fm-tb");
  ft.appendChild(F.el("thead", null, [F.el("tr", null, ["식", "투자율 (10%p당)", "올해 ROA", "규모(10분위 1칸)", "매출 증가율 (10%p당)", "업종 통제"].map((h) => F.el("th", { text: h })))]));
  const ftb = F.el("tbody");
  const cell = (m, k, scale) => { const j = fm[m].vars.indexOf(k); if (j < 0) return "–"; const s2 = fm[m].stats[j]; return (scale ? pp(s2.mean * scale) : fmt(s2.mean, scale === 0 ? 4 : 2)) + " (t " + fmt(s2.tNw, 1) + ")"; };
  [["① 투자율만", "M1", "없음"], ["② 평균 회귀만", "M0", "없음"], ["③ 모두", "M2", "없음"], ["④ 모두 + 업종", "M2_fe", "있음"], ["⑤ ④에서 투자율 대신 총자산 증가율", "M3_fe", "있음"]].forEach((q) => {
    const tr = F.el("tr"); tr.appendChild(F.el("th", { text: q[0] }));
    const m = q[1], first = m === "M3_fe" ? cell(m, "ag_w", 0.1) : cell(m, "inv_w", 0.1);
    [first, cell(m, "roa0_w"), cell(m, "size", 1), cell(m, "g0_w", 0.1), q[2]].forEach((v) => tr.appendChild(F.el("td", { text: v })));
    ftb.appendChild(tr);
  });
  ft.appendChild(ftb);

  /* ---------- 표본 밖 예측 표 ---------- */
  const ot = $("oos-tb");
  ot.appendChild(F.el("thead", null, [F.el("tr", null, ["예측 대상(투자한 해)", "회사 수", "추정에 쓴 관측치", "ROA 그대로", "평균 회귀만", "평균 회귀 + 투자율 등"].map((h) => F.el("th", { text: h })))]));
  const otb = F.el("tbody");
  O.years.forEach((r) => { const tr = F.el("tr"); tr.appendChild(F.el("th", { text: r.year + "년 → " + (r.year + 3) + "년" })); [r.n + "곳", r.trainN.toLocaleString("ko-KR") + "개 (" + "~" + (r.year - 3) + "년)", pp(r.naive), pp(r.M0), pp(r.M2)].forEach((v, i) => { const td = F.el("td", { text: v }); if (i === 4 && r.M2 < r.M0) td.style.fontWeight = "700"; tr.appendChild(td); }); otb.appendChild(tr); });
  const tr0 = F.el("tr"); tr0.appendChild(F.el("th", { text: "전체(회사 수 가중)" })); ["", "", pp(O.mae.naive), pp(O.mae.M0), pp(O.mae.M2)].forEach((v) => tr0.appendChild(F.el("td", { text: v }))); otb.appendChild(tr0);
  ot.appendChild(otb);

  /* ---------- 실무·한계 ---------- */
  const useRows = [
    ["투자 심의에서 '투자하면 수익성이 오른다'를 기본 전제로 두지 않습니다.", " 평균적으로는 투자를 많이 늘린 회사의 3년 뒤 수익성이 " + (q5 < 0 ? "덜 좋았습니다" : "더 좋았지만, 그 차이의 상당 부분은 원래 수익성 차이로 설명됐습니다") + ". 개별 안건의 NPV 가정(가동률·가격·마진)이 업계 평균 경로보다 낙관적이면 근거를 따로 요구합니다."],
    ["수익성 비교는 반드시 평균 회귀를 빼고 합니다.", " 사후관리에서 '투자한 사업부의 ROA가 떨어졌다'는 결과만으로 실패라고 판단하면 안 됩니다. 올해 ROA가 높던 회사는 투자와 상관없이 3년이면 격차의 " + fmt(-mr.mean * 100, 0) + "% 정도가 사라졌습니다. 비교 기준을 '같은 출발점의 회사들'로 잡아야 합니다."],
    ["매출 성장과 수익성은 따로 봅니다.", " 투자는 매출을 " + (Q.mean.sg3[4] > Q.mean.sg3[0] ? "더 키웠지만" : "키우지도 못했고") + " 수익성으로 바로 이어지지 않았습니다. 투자 후 KPI를 매출만으로 잡으면 성과를 과대평가하기 쉽습니다."],
    ["이 결과는 사전 확률로 씁니다.", " 업종 평균의 경향일 뿐 개별 안건의 답이 아닙니다. 투자안 NPV 분포(설비투자 키트의 몬테카를로)를 그릴 때 '3년 뒤 수익성 개선' 가정의 기준선으로 씁니다."]
  ];
  const ul = $("use-list");
  useRows.forEach((q) => { const li = F.el("li"); li.appendChild(F.el("b", { text: q[0] })); li.appendChild(document.createTextNode(q[1])); ul.appendChild(li); });
  const lim = $("lim-list");
  [["투자 지표가 설비투자액이 아닙니다.", " 대량 조회 API에 현금흐름표가 없어 비유동자산 순증가를 썼습니다. 장기 금융자산·관계기업 투자, 재평가, 리스 회계(2019년 사용권자산) 변화도 섞입니다. 같은 식을 총자산 증가율로 바꿔도(표의 ⑤) 방향이 같은지 확인했습니다."],
   ["생존 편향이 있습니다.", " 지금 상장된 회사만 들어 있어 투자 실패로 사라진 회사가 빠졌습니다. 이 편향은 투자의 결과를 좋게 보이게 하므로, 실제 평균은 여기 결과보다 불리할 가능성이 큽니다."],
   ["인과가 아니라 연관입니다.", " 투자를 결정하는 경영진은 전망을 알고 투자합니다. 좋은 기회를 본 회사만 투자했다면 투자율의 계수는 효과를 부풀리고, 경쟁 압력 때문에 방어적으로 투자했다면 줄입니다."],
   ["기간이 짧고 경기 국면이 섞입니다.", " 투자한 해가 " + M.years[0] + "~" + M.years[1] + "년 " + P.years.length + "개 연도뿐이라 연도별 계수의 평균은 불확실성이 큽니다. 3년 뒤가 2020년 코로나, 2023년 반도체 불황 같은 특정 해에 걸리면 그해의 업황이 크게 섞입니다."]
  ].forEach((q) => { const li = F.el("li"); li.appendChild(F.el("b", { text: q[0] })); li.appendChild(document.createTextNode(q[1])); lim.appendChild(li); });

  /* ---------- 업종 고르기 ---------- */
  const IND = { 0: "제조업 전체", 10: "식료품", 13: "섬유", 17: "펄프·종이", 20: "화학", 21: "의약품", 22: "고무·플라스틱", 23: "비금속 광물", 24: "1차 금속", 25: "금속 가공", 26: "전자부품·컴퓨터·통신", 27: "의료·정밀기기", 28: "전기장비", 29: "기타 기계", 30: "자동차·부품", 31: "기타 운송장비" };
  const cnt = {}; P.D.forEach((d) => { cnt[d.ind] = (cnt[d.ind] || 0) + 1; });
  const minYear = (k) => Math.min.apply(null, P.years.map((t) => P.D.filter((d) => d.year === t && d.ind === k).length));
  const sel = $("ind-sel");
  [0].concat(Object.keys(cnt).map(Number).filter((k) => minYear(k) >= 15).sort((a, b) => cnt[b] - cnt[a])).forEach((k) => { const o = F.el("option", { text: (IND[k] || "업종 " + k) + (k ? " (" + cnt[k] + ")" : " (" + P.D.length + ")") }); o.value = k; sel.appendChild(o); });
  function subQ() { const k = +sel.value; if (!k) return Q; return E.quintiles({ D: P.D.filter((d) => d.ind === k), years: P.years }); }

  /* ---------- 그림 1: 5분위 막대(단순 변화와 평균 회귀를 뺀 변화) ---------- */
  function bars(id, H, label, series, f, note) {
    const fr = frame(id, H, label), s = fr.svg, W = fr.W, l = 50, r2 = W - 10, top = 16, bot = H - 52;
    const vals = series.reduce((a, q) => a.concat(q.v), [0]), tk2 = F.niceTicks(Math.min.apply(null, vals), Math.max.apply(null, vals), 5), y = lin(tk2.lo, tk2.hi, bot, top);
    yAxis(s, l, r2, y, tk2, f);
    const gw = (r2 - l) / 5, bw = gw * 0.72 / series.length;
    for (let qi = 0; qi < 5; qi++) {
      series.forEach((q, si) => { const v = q.v[qi], x0 = l + gw * qi + gw * 0.14 + bw * si; sv("rect", { x: x0, y: Math.min(y(v), y(0)), width: bw - 2, height: Math.max(1, Math.abs(y(v) - y(0))), fill: q.col, rx: 1.5 }, s);
        tx(s, x0 + (bw - 2) / 2, v >= 0 ? y(v) - 4 : y(v) + 12, f(v), { "text-anchor": "middle", "font-size": fr.nar ? 8.5 : 10, fill: c("--ink"), class: "n" }); });
      tx(s, l + gw * (qi + 0.5), bot + 16, qi === 0 ? "하위 20%" : qi === 4 ? "상위 20%" : (qi + 1) + "분위", { "text-anchor": "middle", "font-size": 10.5, fill: c("--ink-2") });
      if (note) tx(s, l + gw * (qi + 0.5), bot + 30, note(qi), { "text-anchor": "middle", "font-size": 9.5, fill: c("--muted"), class: "n" });
    }
    let lx = l; series.forEach((q) => { sv("rect", { x: lx, y: H - 12, width: 10, height: 10, fill: q.col, rx: 2 }, s); tx(s, lx + 14, H - 3, q.name, { "font-size": 10.5 }); lx += fr.nar ? 130 : 200; });
  }
  function drawQ() {
    const S = subQ(), k = +sel.value;
    bars("f-q", 280, "투자율 5분위별 3년 뒤 ROA 변화와 평균 회귀를 뺀 변화", [{ name: "3년 뒤 ROA 변화", v: S.mean.droa.map((v) => v * 100), col: c("--mark-muted") }, { name: "평균 회귀를 뺀 변화", v: S.mean.resid.map((v) => v * 100), col: c("--input") }], (v) => sg(v, 1), (qi) => "투자율 " + fmt(S.mean.inv[qi] * 100, 1) + "%");
    const out = $("q-out"); out.textContent = "";
    out.append((IND[k] || "업종 " + k) + ": 상위 20% − 하위 20% = ", F.el("b", { text: pp(S.spread.droa.mean) }), " (t " + fmt(S.spread.droa.tNw, 1) + "), 평균 회귀를 빼면 ", F.el("b", { text: pp(S.spread.resid.mean) }), " (t " + fmt(S.spread.resid.tNw, 1) + ")");
    $("q-note").textContent = "회색은 3년 뒤 ROA − 올해 ROA, 파랑은 같은 해 회사들의 '올해 ROA로 예측한 변화'를 뺀 나머지입니다. 막대 아래 숫자는 묶음의 평균 투자율입니다. 상위 묶음의 올해 ROA 평균은 " + fmt(S.mean.roa0[4] * 100, 1) + "%, 하위 묶음은 " + fmt(S.mean.roa0[0] * 100, 1) + "%였습니다. 업종을 좁히면 회사 수가 줄어 t값이 작아지는 것이 정상입니다.";
  }

  /* ---------- 그림 2: 평균 회귀 ---------- */
  function drawMr() {
    const R = A.roaDec, fr = frame("f-mr", 260, "올해 ROA 10분위별 평균 ROA와 3년 뒤 ROA 변화"), s = fr.svg, W = fr.W, l = 50, r2 = W - 14, bot = 214;
    const xs = R.roa0.map((v) => v * 100), ys = R.droa.map((v) => v * 100), tx2 = F.niceTicks(Math.min.apply(null, xs), Math.max.apply(null, xs), 6), ty = F.niceTicks(Math.min.apply(null, ys.concat([0])), Math.max.apply(null, ys.concat([0])), 5);
    const x = lin(tx2.lo, tx2.hi, l, r2), y = lin(ty.lo, ty.hi, bot, 14);
    yAxis(s, l, r2, y, ty, (t) => sg(t, 0) + "%p");
    tx2.ticks.forEach((t) => tx(s, x(t), bot + 16, fmt(t, 0) + "%", { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }));
    const b = st("M0", 0).mean, a0 = (function () { const mx = xs.reduce((p, q) => p + q, 0) / xs.length, my = ys.reduce((p, q) => p + q, 0) / ys.length; return my - b * mx; })();
    sv("line", { x1: x(tx2.lo), x2: x(tx2.hi), y1: y(a0 + b * tx2.lo), y2: y(a0 + b * tx2.hi), stroke: c("--accent"), "stroke-width": 1.6, "stroke-dasharray": "5 3" }, s);
    xs.forEach((v, i) => { sv("circle", { cx: x(v), cy: y(ys[i]), r: 4.5, fill: c("--input") }, s); });
    tx(s, r2, bot + 36, "올해 ROA(10분위 평균) →", { "text-anchor": "end", "font-size": 10, fill: c("--muted") });
    $("mr-note").textContent = "왼쪽(올해 ROA가 낮던 회사)일수록 3년 뒤 ROA가 오르고, 오른쪽일수록 내려갑니다. 연도별로 '3년 뒤 변화 = a + b × 올해 ROA'를 추정한 b의 평균은 " + fmt(b, 2) + "입니다(점선은 이 기울기를 점들의 중심에 맞춘 것). 올해 ROA가 평균보다 10%p 높으면 3년 뒤 약 " + fmt(-b * 10, 1) + "%p 내려온다는 뜻입니다.";
  }

  /* ---------- 그림 3: 연도별 계수 ---------- */
  function drawCoef() {
    const by = fm.M2_fe.byYear.map((q) => q[1] * 10), fr = frame("f-coef", 230, "투자한 해별 투자율 계수(투자율 10%p당 3년 뒤 ROA 변화)"), s = fr.svg, W = fr.W, l = 50, r2 = W - 12, bot = 192;
    const ty = F.niceTicks(Math.min.apply(null, by.concat([0])), Math.max.apply(null, by.concat([0])), 5), y = lin(ty.lo, ty.hi, bot, 14), n = by.length, gw = (r2 - l) / n;
    yAxis(s, l, r2, y, ty, (t) => sg(t, 1) + "%p");
    by.forEach((v, i) => { const x0 = l + gw * i + gw * 0.2; sv("rect", { x: x0, y: Math.min(y(v), y(0)), width: gw * 0.6, height: Math.max(1, Math.abs(y(v) - y(0))), fill: v < 0 ? c("--neg") : c("--pos"), opacity: 0.85, rx: 1.5 }, s);
      tx(s, x0 + gw * 0.3, v >= 0 ? y(v) - 4 : y(v) + 12, sg(v, 2), { "text-anchor": "middle", "font-size": 9.5, fill: c("--ink"), class: "n" });
      tx(s, x0 + gw * 0.3, bot + 16, String(P.years[i]), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    const m = inv.mean * 10; sv("line", { x1: l, x2: r2, y1: y(m), y2: y(m), stroke: c("--accent"), "stroke-width": 1.6, "stroke-dasharray": "5 3" }, s);
    tx(s, l + 4, y(m) - 5, "평균 " + sg(m, 2) + "%p", { "font-size": 10.5, fill: c("--accent"), "font-weight": 700 });
    const neg = by.filter((v) => v < 0).length;
    $("coef-note").textContent = P.years.length + "개 연도 중 " + neg + "개 연도에서 음수였습니다. 연도별 값의 흩어짐으로 계산한 t는 " + fmt(inv.t, 1) + ", 3년 구간이 겹치는 것을 보정한 뉴이-웨스트 t는 " + fmt(inv.tNw, 1) + "입니다. 연도 수가 적어 t값 자체도 흔들릴 수 있으므로, 부호가 해마다 같은 쪽인지를 함께 봅니다.";
  }

  /* ---------- 그림 4: 매출 증가율 ---------- */
  function drawSg() {
    bars("f-sg", 250, "투자율 5분위별 이후 3년 연평균 매출 증가율", [{ name: "이후 3년 연평균 매출 증가율", v: Q.mean.sg3.map((v) => v * 100), col: c("--pos") }], (v) => sg(v, 1) + "%", null);
    $("sg-note").textContent = "투자율 상위 20%의 이후 3년 연평균 매출 증가율은 " + sg(Q.mean.sg3[4] * 100, 1) + "%, 하위 20%는 " + sg(Q.mean.sg3[0] * 100, 1) + "%였습니다(차이의 t " + fmt(qs.sg3.tNw, 1) + "). 매출은 투자를 따라가는데 ROA는 따라가지 않는다면, 늘어난 자산만큼 이익이 늘지 않았다는 뜻입니다.";
  }

  function all() { drawQ(); drawMr(); drawCoef(); drawSg(); }
  sel.addEventListener("change", drawQ);
  all(); F.onRedraw(all);
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "투자" }, { x: 0.90, y: 0.22, label: "매출" }, { x: 0.90, y: 0.50, label: "자산" }, { x: 0.90, y: 0.78, label: "ROA" }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "성장" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "증가" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 12, label: "3년 뒤" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

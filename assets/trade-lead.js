/* 장비 수출입으로 읽는 반도체 투자 사이클(tools/trade-lead.html) 화면. 계산은 assets/engines/tradelead.js, 자료는 assets/data/trade-semi.js */
(function () {
  "use strict";
  const F = window.Fin, T = window.TradeLead, D = window.TradeSemi, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!T || !D) return;
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const sg = (v, d) => (v > 0 ? "+" : "") + fmt(v, d);
  const ym = (m) => m.slice(0, 4) + "." + m.slice(4);
  function frame(id, H, label) { const host = $(id); host.textContent = ""; const W = Math.max(300, Math.round(host.clientWidth || 680)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, host), W: W, nar: W < 560 }; }
  function line(svg, pts, col, w, dash) { let d = "", pen = false; pts.forEach((p) => { if (p[1] === null || !isFinite(p[1])) { pen = false; return; } d += (pen ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); pen = true; }); sv("path", { d: d, fill: "none", stroke: col, "stroke-width": w || 2, "stroke-dasharray": dash || null, "stroke-linejoin": "round" }, svg); }
  function yearTicks(svg, x, y0) { D.months.forEach((m, i) => { if (m.endsWith("01") && (+m.slice(0, 4)) % 2 === 1) tx(svg, x(i), y0, m.slice(0, 4), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); }); }

  const A = T.analyze(D), n = D.months.length, M = D.months;
  const ma3 = (v) => v.map((_, i) => (i < 2 || v.slice(i - 2, i + 1).some((q) => q === null)) ? null : (v[i] + v[i - 1] + v[i - 2]) / 3);
  $("hm-range").textContent = ym(M[0]) + " ~ " + ym(M[n - 1]) + " · " + n + "개월";
  $("dl-date").textContent = "2026.11.22";

  /* ---------- 결론 ---------- */
  const lead = -A.peakD.lag, sigD = A.peakD.r > A.h2.thr, b1 = A.bt1, b2 = A.bt2;
  const Y = T.yearly(D, ["CHN_M_8486", "KOR_M_8486", "JPN_X_8486", "NLD_X_8486", "USA_X_8486"]).filter((q) => q.complete).map((q) => { const sup = q.JPN_X_8486 + q.NLD_X_8486 + q.USA_X_8486; return { year: q.year, chn: q.CHN_M_8486 / sup * 100, kor: q.KOR_M_8486 / sup * 100 }; });
  const y0 = Y[0], y1 = Y[Y.length - 1], chnPeak = Y.reduce((b, q) => (q.chn > b.chn ? q : b));
  const tk = $("tk");
  [["가설은 기각됐다", "메모리 수출이 6개월 앞선다는 가설을 월간 변화끼리의 상관으로 검정하면 " + A.h1.r.toFixed(2) + "로, 기준(±" + A.h1.thr.toFixed(2) + ") 안이었습니다. 메모리로 6개월 뒤 장비 수입의 방향을 맞힌 비율도 " + fmt(b1.hit * 100, 0) + "%로 동전 던지기 수준이었습니다."],
   ["반대로 장비가 약 " + lead + "개월 앞섰다", "장비 수입과 " + lead + "개월 뒤 메모리 수출의 상관이 가장 높았습니다(증가율끼리 " + A.peak.r.toFixed(2) + ", 월간 변화끼리 " + A.peakD.r.toFixed(2) + (sigD ? ", 기준 통과" : ", 기준 미달") + "). 설비를 먼저 들이고 생산·수출이 뒤따르는 순서입니다."],
   ["방향은 맞히고 크기는 못 맞힌다", "장비 수입으로 6개월 뒤 메모리 수출 증가율이 오를지 내릴지는 " + fmt(b2.hit * 100, 0) + "% 맞혔습니다. 다만 평균 오차는 " + fmt(b2.maeModel, 1) + "%p로 '지금 그대로'(" + fmt(b2.maeNaive, 1) + "%p)보다 " + (b2.maeModel < b2.maeNaive ? "작았습니다." : "컸습니다. 숫자보다 방향 신호로 써야 합니다.")]
  ].forEach((q) => { const d = F.el("div"); d.appendChild(F.el("b", { text: q[0] })); d.appendChild(F.el("p", { text: q[1] })); tk.appendChild(d); });
  const qa = $("qa-tb");
  [["어느 쪽이 먼저 움직이나", "시차별 상관(−12~+12개월). 증가율은 자기상관이 0.9를 넘어 월간 변화로 검정하고, 유효 표본으로 기준을 높임", "장비가 " + lead + "개월 앞섬 (월간 변화 상관 " + A.peakD.r.toFixed(2) + ", 기준 ±" + A.h2.thr.toFixed(2) + "). 처음 가설(메모리가 6개월 앞섬)은 " + A.h1.r.toFixed(2) + "로 기각"],
   ["앞서는 쪽으로 6개월 뒤를 맞힐 수 있나", "2020년부터 매달 표본 밖 예측 " + b2.n + "회, 두 방향 모두 '지금 그대로'와 비교", "장비 → 메모리: 방향 " + fmt(b2.hit * 100, 0) + "% 적중, 오차는 단순 예측보다 " + (b2.maeModel < b2.maeNaive ? "작음" : "큼") + ". 메모리 → 장비: 방향 " + fmt(b1.hit * 100, 0) + "%"],
   ["장비 수요는 어디로 옮겨 갔나", "주요 장비 수출국(일본·네덜란드·미국) 수출 대비 중국·한국 수입 비율(연간)", "중국 " + fmt(y0.chn, 0) + "% (" + y0.year + ") → 최고 " + fmt(chnPeak.chn, 0) + "% (" + chnPeak.year + "), 한국 " + fmt(y0.kor, 0) + "% → " + fmt(y1.kor, 0) + "% (" + y1.year + ")"]
  ].forEach((q) => { const tr = F.el("tr"); tr.appendChild(F.el("th", { text: q[0] })); tr.appendChild(F.el("td", { text: q[1] })); tr.appendChild(F.el("td", { text: q[2] })); qa.appendChild(tr); });
  const bt = $("bt-tb");
  bt.appendChild(F.el("thead", null, [F.el("tr", null, ["예측 방향", "예측 횟수", "방향 적중", "평균 오차(모형)", "평균 오차(지금 그대로)"].map((h) => F.el("th", { text: h })))]));
  const btb = F.el("tbody");
  [["메모리 수출 → 6개월 뒤 장비 수입 (처음 가설)", b1], ["장비 수입 → 6개월 뒤 메모리 수출 (데이터가 보여 준 방향)", b2]].forEach((q) => { const tr = F.el("tr"); tr.appendChild(F.el("th", { text: q[0] })); [q[1].n + "회", fmt(q[1].hit * 100, 0) + "%", fmt(q[1].maeModel, 1) + "%p", fmt(q[1].maeNaive, 1) + "%p"].forEach((v) => tr.appendChild(F.el("td", { text: v }))); btb.appendChild(tr); });
  bt.appendChild(btb);
  const ul = $("use-list");
  [["메모리 수출을 장비 수요의 조기 경보로 쓰지 않습니다.", " 처음 가설과 달리 메모리 수출은 장비 수입보다 늦게 움직였습니다. 장비·부품 회사가 고객 설비투자를 미리 읽으려면 메모리 가격, 고객사 설비투자 계획 발표처럼 더 앞선 지표를 찾아야 합니다."],
   ["장비 수입은 고객 설비투자의 '지금'을 보여 주는 지표로 씁니다.", " 분기 실적 발표보다 빨리, 매달 나오는 무역 통계로 고객의 실제 장비 반입 추세를 확인할 수 있습니다. 월 경영회의 자료에 3개월 증가율 한 줄이면 충분합니다."],
   ["메모리 쪽 계획에는 6개월 앞 방향 신호로 씁니다.", " 장비 수입이 꺾이면 약 " + lead + "개월 뒤 메모리 수출 증가율도 꺾이는 경향이 있었습니다(방향 적중 " + fmt(b2.hit * 100, 0) + "%). 크기는 맞히지 못하므로 숫자 대신 경고등으로 씁니다."],
   ["가설이 틀리면 틀린 대로 보고합니다.", " 이 분석의 가장 큰 쓸모는 '그럴듯한 선행 지표'를 계획 전제에 넣기 전에 검증했다는 점입니다. 검증 없이 썼다면 반대 방향의 신호를 근거로 계획을 세웠을 것입니다."]
  ].forEach((q) => { const li = F.el("li"); li.appendChild(F.el("b", { text: q[0] })); li.appendChild(document.createTextNode(q[1])); ul.appendChild(li); });

  /* ---------- 그림 1: 원자료(위아래 두 칸) ---------- */
  function drawRaw() {
    const fr = frame("f-raw", 300, "한국 메모리 수출과 한국 반도체 장비 수입의 월별 금액, 3개월 이동평균"), s = fr.svg, W = fr.W, l = 54, r2 = W - 12, x = lin(0, n - 1, l, r2);
    [["KOR_X_854232", "한국 메모리 수출", c("--accent"), 14, 130], ["KOR_M_8486", "한국 장비 수입", c("--input"), 156, 272]].forEach((q) => {
      const v = ma3(D.series[q[0]]), mx = Math.max.apply(null, v.filter((z) => z !== null)), tk2 = F.niceTicks(0, mx, 3), y = lin(0, tk2.hi, q[4], q[3] + 14);
      tk2.ticks.forEach((t) => { sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: c("--rule-soft") }, s); tx(s, l - 6, y(t) + 4, fmt(t / 1000, 1) + "십억", { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }); });
      line(s, v.map((z, i) => [x(i), z === null ? null : y(z)]), q[2], 2);
      tx(s, l + 4, q[3] + 8, q[1] + " (월, 달러)", { fill: q[2], "font-size": 11, "font-weight": 700 });
    });
    yearTicks(s, x, 290);
  }

  /* ---------- 그림 2: 겹쳐 보기(장비 수입을 k개월 뒤로) ---------- */
  function drawOv() {
    const k = +$("sh").value; $("sh-v").textContent = k + "개월";
    const fr = frame("f-ov", 280, "장비 수입 증가율을 " + k + "개월 뒤로 민 선과 메모리 수출 증가율"), s = fr.svg, W = fr.W, l = 44, r2 = W - 12, x = lin(0, n - 1, l, r2);
    const vals = A.mem.concat(A.eq).filter((z) => z !== null), lo = Math.max(-100, Math.min.apply(null, vals)), hi = Math.min(250, Math.max.apply(null, vals)), tk2 = F.niceTicks(lo, hi, 5), y = lin(tk2.lo, tk2.hi, 250, 14);
    tk2.ticks.forEach((t) => { sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: t === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(t) + 4, t + "%", { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }); });
    const clip = (v) => (v === null ? null : y(Math.max(tk2.lo, Math.min(tk2.hi, v))));
    line(s, A.mem.map((v, i) => [x(i), clip(v)]), c("--accent"), 2.2);
    line(s, A.eq.map((v, i) => [x(i + k), i + k < n ? clip(v) : null]), c("--input"), 2, "5 3");
    yearTicks(s, x, 270);
    const row = A.xc.find((q) => q.lag === -k), best = -A.peak.lag;
    $("sh-out").textContent = "";
    $("sh-out").append("실선: 메모리 수출 증가율 · 점선: 장비 수입 증가율을 " + k + "개월 뒤로 민 것. 상관 ", F.el("b", { text: row.r.toFixed(2) }), k === best ? " (가장 높음)" : " (가장 높은 " + best + "개월은 " + A.peak.r.toFixed(2) + ")");
  }

  /* ---------- 그림 3: 시차별 상관(막대: 월간 변화, 점: 증가율) ---------- */
  function drawXc() {
    const fr = frame("f-xc", 240, "시차 −12개월부터 +12개월까지 상관계수. 막대는 월간 변화끼리, 점은 증가율끼리"), s = fr.svg, W = fr.W, l = 40, r2 = W - 10, x = lin(-12.5, 12.5, l, r2), y = lin(-0.6, 1, 196, 12), bw = (r2 - l) / 25 * 0.66, thr = A.h2.thr;
    [-0.5, 0, 0.5, 1].forEach((t) => { sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: t === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(t) + 4, t.toFixed(1), { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }); });
    [thr, -thr].forEach((t) => sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: c("--neg"), "stroke-dasharray": "4 3" }, s));
    A.xcd.forEach((q) => { const on = q.lag === A.peakD.lag, h1 = q.lag === 6; sv("rect", { x: x(q.lag) - bw / 2, y: Math.min(y(q.r), y(0)), width: bw, height: Math.abs(y(q.r) - y(0)), fill: on ? c("--input") : h1 ? c("--accent") : c("--mark-muted"), opacity: on || h1 ? 1 : 0.75, rx: 1.5 }, s);
      if (q.lag % (fr.nar ? 4 : 2) === 0) tx(s, x(q.lag), 212, (q.lag > 0 ? "+" : "") + q.lag, { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    A.xc.forEach((q) => sv("circle", { cx: x(q.lag), cy: y(q.r), r: 2.6, fill: c("--ink-2") }, s));
    tx(s, x(A.peakD.lag), y(A.peakD.r) - 6, A.peakD.r.toFixed(2), { "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: c("--ink"), class: "n" });
    tx(s, x(6), y(Math.max(0, A.h1.r)) - 6, "가설 " + A.h1.r.toFixed(2), { "text-anchor": "middle", "font-size": 10, fill: c("--accent"), "font-weight": 700 });
    tx(s, r2, 232, "← 장비가 앞섬 · 메모리가 앞섬 → (개월) · 빨간 점선: 기준 ±" + thr.toFixed(2), { "text-anchor": "end", "font-size": 10, fill: c("--muted") });
    $("xc-note").textContent = "증가율끼리의 상관(점)은 −" + (-A.peak.lag) + "개월에서 " + A.peak.r.toFixed(2) + "로 높지만, 두 증가율은 지난달 값과 이번 달 값이 거의 같아(자기상관 0.9 이상) 우연과 구별하기 어렵습니다. 그래서 증가율의 월간 변화끼리(막대) 다시 보고, 자기상관만큼 표본을 줄여(유효 표본 " + fmt(A.h2.nEff, 0) + "개) 기준을 ±" + thr.toFixed(2) + "로 잡았습니다. 장비가 " + (-A.peakD.lag) + "개월 앞서는 막대(" + A.peakD.r.toFixed(2) + ")만 기준을 넘고, 처음 가설 자리(+6개월, 주황)는 " + A.h1.r.toFixed(2) + "입니다.";
  }

  /* ---------- 그림 4: 표본 밖 예측 ---------- */
  function drawBt() {
    const R = b2.rows, fr = frame("f-bt", 260, "2020년 이후 6개월 뒤 메모리 수출 증가율의 실제값, 장비 수입 시차 모형, 단순 예측"), s = fr.svg, W = fr.W, l = 44, r2 = W - 12;
    const t0 = R[0].t + 6, t1 = R[R.length - 1].t + 6, x = lin(t0, t1, l, r2), vals = R.reduce((a, q) => a.concat([q.actual, q.model, q.naive]), []), tk2 = F.niceTicks(Math.min.apply(null, vals), Math.max.apply(null, vals), 5), y = lin(tk2.lo, tk2.hi, 222, 14);
    tk2.ticks.forEach((t) => { sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: t === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(t) + 4, t + "%", { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }); });
    line(s, R.map((q) => [x(q.t + 6), y(q.naive)]), c("--mark-muted"), 1.6, "3 3");
    line(s, R.map((q) => [x(q.t + 6), y(q.model)]), c("--accent"), 2, "6 3");
    line(s, R.map((q) => [x(q.t + 6), y(q.actual)]), c("--input"), 2.4);
    M.forEach((m, i) => { if (i >= t0 && i <= t1 && m.endsWith("01")) tx(s, x(i), 242, m.slice(0, 4), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    const lg = [["실제", c("--input"), null], ["장비 수입 시차 모형", c("--accent"), "6 3"], ["지금 그대로", c("--mark-muted"), "3 3"]]; let lx = l;
    lg.forEach((q) => { sv("line", { x1: lx, x2: lx + 22, y1: 256, y2: 256, stroke: q[1], "stroke-width": 2.4, "stroke-dasharray": q[2] }, s); tx(s, lx + 26, 260, q[0], { "font-size": 10.5, fill: c("--ink-2") }); lx += fr.nar ? 92 : 140; });
    $("bt-note").textContent = "모형: 시점마다 그때까지의 자료로 '메모리 수출 증가율 = a + b × " + Math.max(-A.peakD.lag, 6) + "개월 전 장비 수입 증가율'을 다시 추정해 6개월 뒤를 예측했습니다(" + b2.n + "회). 큰 흐름의 방향은 따라가지만(" + fmt(b2.hit * 100, 0) + "% 적중), 급등락의 크기는 놓쳐 평균 오차가 " + fmt(b2.maeModel, 1) + "%p로 '지금 그대로'(" + fmt(b2.maeNaive, 1) + "%p)와 비슷하거나 큽니다.";
  }

  /* ---------- 그림 5: 수요 구성 ---------- */
  function drawMix() {
    const fr = frame("f-mix", 240, "연도별 주요 장비 수출국 수출 대비 중국과 한국 수입 비율"), s = fr.svg, W = fr.W, l = 40, r2 = W - (fr.nar ? 14 : 70), x = lin(Y[0].year, Y[Y.length - 1].year, l, r2), mx = Math.max.apply(null, Y.map((q) => q.chn)), tk2 = F.niceTicks(0, mx, 4), y = lin(0, tk2.hi, 206, 14);
    tk2.ticks.forEach((t) => { sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: t === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(t) + 4, t + "%", { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }); });
    [["chn", "중국 수입", c("--neg")], ["kor", "한국 수입", c("--input")]].forEach((q) => { line(s, Y.map((z) => [x(z.year), y(z[q[0]])]), q[2], 2.4); Y.forEach((z) => sv("circle", { cx: x(z.year), cy: y(z[q[0]]), r: 3, fill: q[2] }, s));
      const e = Y[Y.length - 1]; tx(s, fr.nar ? x(e.year) - 4 : x(e.year) + 6, y(e[q[0]]) + (fr.nar ? -8 : 4), q[1] + " " + fmt(e[q[0]], 0) + "%", { "text-anchor": fr.nar ? "end" : "start", "font-size": 10.5, fill: q[2], "font-weight": 700 }); });
    Y.forEach((z, i) => { if (!fr.nar || i % 2 === 0) tx(s, x(z.year), 226, String(z.year), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    $("mix-note").textContent = "분모는 일본·네덜란드·미국의 장비 수출 합계(세계 장비 공급의 대리 지표)입니다. 수입국이 받는 금액과 수출국이 보내는 금액은 운임·시점·분류 차이로 정확히 맞지 않고, 독일·싱가포르·한국 등 다른 공급국과 대만 같은 큰 수요국이 빠져 있어 비율은 '몫의 변화 방향'으로만 읽습니다. 중국 몫은 " + chnPeak.year + "년에 가장 컸습니다.";
  }

  function all() { drawRaw(); drawOv(); drawXc(); drawBt(); drawMix(); }
  $("sh").addEventListener("input", drawOv);
  $("sh").value = -A.peak.lag;
  all(); F.onRedraw(all);
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "메모리" }, { x: 0.90, y: 0.22, label: "장비" }, { x: 0.90, y: 0.50, label: "중국" }, { x: 0.90, y: 0.78, label: "한국" }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "시차" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "수요" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 12, label: "투자" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

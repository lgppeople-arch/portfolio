/* 해외 장비사 5곳 심층 분석(tools/equip-cos.html) 화면. 자료 assets/data/equip-cos.js, 계산 assets/engines/equipcos.js */
(function () {
  "use strict";
  const F = window.Fin, E = window.EquipCosEngine, D = window.EquipCos, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!E || !D) return;
  const c = (n) => F.css(n), el = F.el;
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const fmt = (v, d) => (v === null || v === undefined || !isFinite(v) ? "–" : (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }));
  const pc = (v, d) => (v === null || v === undefined ? "–" : fmt(v, d === undefined ? 1 : d) + "%");
  const sg = (v, d) => (v === null || v === undefined ? "–" : (v > 0 ? "+" : "") + pc(v, d));
  const COL = { ASML: "--total", AMAT: "--input", LRCX: "--accent", TEL: "--neg", KLAC: "--violet" };
  const A = E.analyze(D), byId = {}; D.cos.forEach((co) => { byId[co.id] = co; });
  const curName = { USD: "백만 달러", EUR: "백만 유로", JPY: "백만 엔" };
  const endTxt = (a) => a.end.slice(0, 4) + "." + a.end.slice(5, 7);
  const li = (ol, rows) => rows.forEach((q) => { const x = el("li"); x.appendChild(el("b", { text: q[0] })); x.appendChild(document.createTextNode(q[1])); ol.appendChild(x); });
  function lgd(host) { host.textContent = ""; A.forEach((a) => { const s = el("span"); const i = el("i"); i.style.background = c(COL[a.id]); s.appendChild(i); s.appendChild(document.createTextNode(a.name)); host.appendChild(s); }); }

  /* ---------- 요약 ---------- */
  const best = (k, f) => A.slice().sort((x, y) => f(y) - f(x))[0];
  const hiOpm = best("opm", (a) => a.last.opm), hiSvc = best("svc", (a) => a.svc || 0), hiCh = best("ch", (a) => a.china), fast = best("cagr", (a) => a.cagr), shaky = best("vol", (a) => a.vol);
  const chinaDrop = A.filter((a) => a.chinaSeries.length >= 2 && a.chinaSeries[a.chinaSeries.length - 1].v < Math.max.apply(null, a.chinaSeries.map((q) => q.v)) - 3);
  const tk = $("tk");
  [["검사·노광이 가장 많이 남긴다", "최근 회계연도 영업이익률은 " + hiOpm.name + " " + pc(hiOpm.last.opm) + "로 가장 높고, 5곳 모두 25% 이상입니다. 공급자가 적은 장비(검사, EUV 노광)를 파는 회사의 매출총이익률이 특히 높습니다(KLA " + pc(A.find((a) => a.id === "KLAC").last.gpm) + ", ASML " + pc(A.find((a) => a.id === "ASML").last.gpm) + ")."],
   ["하강기 체력은 서비스보다 '무엇을 파는지'가 갈랐다", hiSvc.name + "는 매출의 " + pc(hiSvc.svc) + "가 설치 기반 서비스에서 나오지만, 6년 중 매출이 가장 크게 줄어든 해(" + sg(A.find((a) => a.id === "LRCX").drawdown) + ")를 피하지 못했습니다. 메모리 비중이 큰 Lam·Tokyo Electron이 크게 흔들렸고, 대체재가 없는 장비를 파는 ASML·KLA는 덜 흔들렸습니다."],
   ["중국은 여전히 가장 큰 지역이지만 줄고 있다", "최근 회계연도 중국 매출 비중은 " + A.map((a) => a.name.split(" ")[0] + " " + pc(a.china, 0)).join(", ") + "입니다. " + (chinaDrop.length ? chinaDrop.map((a) => a.name.split(" ")[0]).join("·") + "는 최근 3년 중 최고치보다 3%p 이상 낮아졌습니다. " : "") + "중국 장비 국산화(2025년 23.2%)와 수출통제가 같은 방향을 가리킵니다."]
  ].forEach((q) => { const d = el("div"); d.appendChild(el("b", { text: q[0] })); d.appendChild(el("p", { text: q[1] })); tk.appendChild(d); });

  /* ---------- 비교표 ---------- */
  (function () {
    const tb = $("cmp-tb"); tb.appendChild(el("thead", null, [el("tr", null, [el("th", { text: "항목", scope: "col" })].concat(A.map((a) => el("th", { text: a.name, scope: "col" }))))]));
    const body = el("tbody"), row = (name, f, note) => { const tr = el("tr"); const th = el("th", { text: name, scope: "row" }); if (note) th.title = note; tr.appendChild(th); A.forEach((a) => tr.appendChild(el("td", { text: f(a) }))); body.appendChild(tr); };
    row("회계연도(끝나는 달)", (a) => "FY" + a.fy + " (" + endTxt(a) + ")");
    row("매출(보고 통화)", (a) => fmt(a.rev / (a.cur === "JPY" ? 1000 : 1), 0) + (a.cur === "JPY" ? " 십억 엔" : " " + curName[a.cur]));
    row("매출(달러 환산)", (a) => (a.revUsd ? fmt(a.revUsd / 1000, 1) + "십억 달러" : "–"));
    row("매출 증가율(전년 대비)", (a) => sg(a.growth));
    row("연평균 성장률", (a) => pc(a.cagr) + " (FY" + a.cagrYears[0] + "~" + a.cagrYears[1] + ")");
    row("매출총이익률", (a) => pc(a.last.gpm));
    row("영업이익률", (a) => pc(a.last.opm));
    row("연구개발비 / 매출", (a) => pc(a.last.rd));
    row("영업현금흐름 / 매출", (a) => pc(a.last.ocf));
    row("설비투자 / 매출", (a) => pc(a.last.capex));
    row("자사주·배당 / 영업현금흐름", (a) => (a.last.payout === null ? "자료 없음" : pc(a.last.payout, 0)));
    row("중국 매출 비중", (a) => pc(a.china));
    row("서비스(설치 기반) 매출 비중", (a) => pc(a.svc));
    tb.appendChild(body);
  })();

  /* ---------- 6년 추이 ---------- */
  const TR = [
    ["idx", "매출 지수(첫해 = 100)", (a, i) => a.series[i] && D.cos.find((x) => x.id === a.id).years[i].rev / D.cos.find((x) => x.id === a.id).years[0].rev * 100, ""],
    ["opm", "영업이익률", (a, i) => a.series[i].opm, "%"], ["gpm", "매출총이익률", (a, i) => a.series[i].gpm, "%"],
    ["rd", "연구개발비 / 매출", (a, i) => a.series[i].rd, "%"], ["ocf", "영업현금흐름 / 매출", (a, i) => a.series[i].ocf, "%"]
  ];
  (function () { const sel = $("tr-sel"); TR.forEach((q) => { const o = el("option", { text: q[1] }); o.value = q[0]; sel.appendChild(o); }); sel.addEventListener("change", drawTr); lgd($("co-lgd")); })();
  function drawTr() {
    const k = $("tr-sel").value, q = TR.find((t) => t[0] === k), host = $("f-tr"); host.textContent = ""; $("tr-title").textContent = q[1] + " 추이";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), H = 280, l = 46, r2 = W - (W < 560 ? 14 : 110), top = 14, bot = H - 36;
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "회사별 " + q[1] + " 6년 추이" }, host);
    const vals = []; A.forEach((a) => a.series.forEach((_, i) => { const v = q[2](a, i); if (v !== null && v !== undefined) vals.push(v); }));
    const tk = F.niceTicks(Math.min.apply(null, vals.concat(k === "idx" ? [100] : [])), Math.max.apply(null, vals), 5), y = lin(tk.lo, tk.hi, bot, top), x = lin(0, 5, l + 10, r2 - 10);
    tk.ticks.forEach((t) => { sv("line", { x1: l, x2: r2, y1: y(t), y2: y(t), stroke: c("--rule-soft") }, s); tx(s, l - 6, y(t) + 4, fmt(t, 0) + q[3], { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }); });
    for (let i = 0; i < 6; i++) tx(s, x(i), bot + 18, i === 0 ? "1년차" : i === 5 ? "최근" : (i + 1) + "년차", { "text-anchor": "middle", "font-size": 10, fill: c("--muted") });
    A.forEach((a) => { let d = ""; a.series.forEach((_, i) => { const v = q[2](a, i); if (v === null || v === undefined) return; d += (d ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); });
      sv("path", { d: d, fill: "none", stroke: c(COL[a.id]), "stroke-width": 2.2 }, s);
      a.series.forEach((_, i) => { const v = q[2](a, i); if (v !== null && v !== undefined) sv("circle", { cx: x(i), cy: y(v), r: 2.8, fill: c(COL[a.id]) }, s); });
      if (W >= 560) { const v = q[2](a, 5); tx(s, r2 + 4, y(v) + 4, a.name.split(" ")[0] + " " + fmt(v, 0) + q[3], { "font-size": 10.5, fill: c(COL[a.id]), "font-weight": 700 }); } });
    const yrs = A.map((a) => a.name.split(" ")[0] + " FY" + a.cagrYears[0] + "~" + a.cagrYears[1]).join(", ");
    $("tr-note").textContent = "가로축은 각 회사의 회계연도 순서입니다(" + yrs + "). 회계연도 끝이 회사마다 달라 같은 칸이라도 기간이 최대 9개월 어긋납니다." + (k === "idx" ? " 매출 지수는 보고 통화 기준이라 환율 변화가 섞이지 않습니다." : "");
  }

  /* ---------- 사이클 내성 ---------- */
  function drawCyc() {
    const host = $("f-cyc"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), rowH = 40, l = 130, r2 = W - 20, H = A.length * rowH + 40;
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "회사별 6년 영업이익률 최저·최고와 최근 값" }, host);
    const x = lin(15, 45, l, r2);
    [20, 25, 30, 35, 40, 45].forEach((t) => { sv("line", { x1: x(t), x2: x(t), y1: 10, y2: H - 26, stroke: c("--rule-soft") }, s); tx(s, x(t), H - 10, t + "%", { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    A.forEach((a, i) => { const yy = 22 + i * rowH;
      tx(s, l - 10, yy + 4, a.name, { "text-anchor": "end", "font-size": 11.5, fill: c("--ink"), "font-weight": 600 });
      sv("line", { x1: x(a.opmRange[0]), x2: x(a.opmRange[1]), y1: yy, y2: yy, stroke: c(COL[a.id]), "stroke-width": 6, opacity: 0.35, "stroke-linecap": "round" }, s);
      sv("circle", { cx: x(a.last.opm), cy: yy, r: 6, fill: c(COL[a.id]) }, s);
      tx(s, x(a.opmRange[0]) - 6, yy + 16, fmt(a.opmRange[0], 1), { "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" });
      tx(s, x(a.opmRange[1]) + 6, yy + 16, fmt(a.opmRange[1], 1), { "font-size": 9.5, fill: c("--muted"), class: "n" }); });
    const sorted = A.slice().sort((p, q) => (p.opmRange[1] - p.opmRange[0]) - (q.opmRange[1] - q.opmRange[0])), tight = sorted[0], wide = sorted[sorted.length - 1];
    $("cyc-note").textContent = "막대는 6년 중 영업이익률의 최저~최고, 점은 최근 회계연도입니다. 폭이 가장 좁은 회사는 " + tight.name + "(" + fmt(tight.opmRange[0], 1) + "~" + fmt(tight.opmRange[1], 1) + "%), 가장 넓은 회사는 " + wide.name + "(" + fmt(wide.opmRange[0], 1) + "~" + fmt(wide.opmRange[1], 1) + "%)입니다. 매출이 가장 크게 줄었던 해의 감소율은 " + A.map((a) => a.name.split(" ")[0] + " " + (a.drawdown < 0 ? sg(a.drawdown) : "감소한 해 없음")).join(", ") + "입니다. 서비스 비중이 가장 큰 Lam Research도 2024 회계연도에 매출이 " + pc(-A.find((a) => a.id === "LRCX").drawdown) + " 줄었습니다. 하강 폭은 메모리 투자 비중이 큰 회사(Lam Research, Tokyo Electron)에서 컸고, 공급자가 거의 없는 장비를 파는 회사(ASML, KLA)에서 작았습니다. 서비스 매출은 하강 폭을 줄일 뿐 없애지는 못하고, 그보다 제품 구성과 고객 업종이 더 크게 작용했습니다.";
  }

  /* ---------- 지역 ---------- */
  const REG = [["China", "중국", "--neg"], ["Taiwan", "대만", "--input"], ["Korea", "한국", "--accent"], ["Japan", "일본", "--pos"], ["US", "미국·북미", "--total"], ["Europe", "유럽", "--violet"], ["Other", "기타 아시아", "--mark-muted"]];
  (function () { const h = $("geo-lgd"); REG.forEach((r) => { const s = el("span"); const i = el("i"); i.style.background = c(r[2]); s.appendChild(i); s.appendChild(document.createTextNode(r[1])); h.appendChild(s); }); })();
  function drawGeo() {
    const host = $("f-geo"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), rowH = 34, l = 130, r2 = W - 14, H = A.length * rowH + 20;
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "회사별 최근 회계연도 지역별 매출 구성 100% 막대" }, host);
    A.forEach((a, i) => { const co = byId[a.id], ys = Object.keys(co.geo).sort(), g = co.geo[ys[ys.length - 1]], tot = Object.keys(g).reduce((p, k) => p + g[k], 0), yy = 8 + i * rowH; let x0 = l;
      tx(s, l - 10, yy + 16, a.name, { "text-anchor": "end", "font-size": 11.5, fill: c("--ink"), "font-weight": 600 });
      REG.forEach((r) => { const v = (g[r[0]] || 0) / tot, w = v * (r2 - l); if (w <= 0) return; sv("rect", { x: x0, y: yy + 2, width: w, height: rowH - 10, fill: c(r[2]), opacity: 0.85 }, s);
        if (w > 30) tx(s, x0 + w / 2, yy + 18, fmt(v * 100, 0), { "text-anchor": "middle", "font-size": 10, fill: "#fff", "font-weight": 700, class: "n" }); x0 += w; }); });
    const lines = A.map((a) => a.name.split(" ")[0] + " " + a.chinaSeries.map((q) => fmt(q.v, 0)).join("→") + "%");
    $("geo-note").textContent = "막대 안 숫자는 비중(%)입니다. 최근 3개 회계연도 중국 비중 변화: " + lines.join(", ") + ". 한국·대만 비중이 함께 움직이는 것은 메모리와 파운드리 선단 투자의 크기를 반영합니다. 지역은 장비를 설치한 곳(출하지) 기준이며 회사마다 지역 구분이 조금씩 다릅니다(KLA는 유럽에 이스라엘 포함, ASML의 기타 아시아는 싱가포르 등).";
  }

  /* ---------- 서비스 ---------- */
  (function () {
    const tb = $("svc-tb"); tb.appendChild(el("thead", null, [el("tr", null, ["회사", "서비스 매출의 이름(공시)", "최근 3개 회계연도 비중", "최근 금액"].map((h) => el("th", { text: h, scope: "col" })))]));
    const body = el("tbody");
    A.forEach((a) => { const co = byId[a.id], ys = Object.keys(co.svc).sort(), lastY = ys[ys.length - 1], tr = el("tr"); tr.appendChild(el("th", { text: a.name, scope: "row" }));
      tr.appendChild(el("td", { text: co.svcName })); tr.appendChild(el("td", { text: a.svcSeries.slice(-3).map((q) => "FY" + q.y + " " + pc(q.v)).join(" → ") }));
      tr.appendChild(el("td", { text: fmt(co.svc[lastY] / (co.cur === "JPY" ? 1000 : 1), 0) + (co.cur === "JPY" ? " 십억 엔" : " " + curName[co.cur]) })); body.appendChild(tr); });
    tb.appendChild(body);
  })();

  /* ---------- 회사별 ---------- */
  (function () { const sel = $("co-sel"); D.cos.forEach((co) => { const o = el("option", { text: co.name }); o.value = co.id; sel.appendChild(o); }); sel.addEventListener("change", drawCo); })();
  function drawCo() {
    const id = $("co-sel").value, co = byId[id], a = A.find((q) => q.id === id), unit = co.cur === "JPY" ? 1000 : 1, uName = co.cur === "JPY" ? "십억 엔" : curName[co.cur];
    const prof = $("co-prof"); prof.textContent = "";
    prof.append(el("b", { text: co.name }), " · 본사 " + co.hq + " · " + co.fy + " · " + co.gaap + " · 주력: " + co.focus);
    /* 사업 구성 막대 */
    const host = $("f-mix"); host.textContent = "";
    const mixYears = Object.keys(co.mix || {}).sort(), mix = mixYears.length ? co.mix[mixYears[mixYears.length - 1]] : (co.id === "TEL" ? [["신규 장비", co.years[co.years.length - 1].rev - co.svc[String(co.years[co.years.length - 1].fy)]], ["현장 솔루션(부품·서비스·중고·개조)", co.svc[String(co.years[co.years.length - 1].fy)]]] : []);
    const W = Math.max(300, Math.round(host.clientWidth || 680)), rowH = 26, l = 200, r2 = W - 90, H = mix.length * rowH + 30;
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": co.name + " 최근 회계연도 사업 구성" }, host);
    const tot = mix.reduce((p, q) => p + q[1], 0), mx = Math.max.apply(null, mix.map((q) => q[1])), x = lin(0, mx, l, r2);
    tx(s, 8, 14, "사업 구성 (FY" + (mixYears[mixYears.length - 1] || co.years[co.years.length - 1].fy) + ", " + uName + ")", { "font-size": 11.5, fill: c("--ink"), "font-weight": 700 });
    mix.forEach((q, i) => { const yy = 22 + i * rowH; tx(s, l - 8, yy + 13, q[0], { "text-anchor": "end", "font-size": 11, fill: c("--ink") });
      sv("rect", { x: l, y: yy + 2, width: Math.max(1, x(q[1]) - l), height: rowH - 8, fill: c(COL[id]), opacity: 0.85, rx: 2 }, s);
      tx(s, x(q[1]) + 6, yy + 13, fmt(q[1] / unit, 0) + " (" + fmt(q[1] / tot * 100, 0) + "%)", { "font-size": 10.5, fill: c("--ink-2"), class: "n" }); });
    /* 최종 시장 */
    const endOut = $("co-end"); endOut.textContent = "";
    const ey = Object.keys(co.end || {}).sort();
    if (ey.length) endOut.append(el("b", { text: "최종 시장 구성(" + co.endBase + "): " }), ey.map((y) => "FY" + y + " " + Object.keys(co.end[y]).map((k) => k + " " + co.end[y][k] + "%").join(" · ")).join(" → "));
    else endOut.append("최종 시장(로직·메모리) 구성은 이 회사의 연간 공시에서 일관되게 나누어 보고되지 않아 생략했습니다.");
    if (co.units) { const uy = Object.keys(co.units).sort(); endOut.append(el("br"), el("b", { text: "장비 판매 대수: " }), uy.map((y) => y + "년 EUV " + co.units[y].EUV + "대 · DUV " + co.units[y].DUV + "대").join(" → "), " · 순수주(bookings) " + uy.map((y) => y + "년 " + fmt(co.bookings[y], 0)).join(" → ") + " " + uName); }
    /* 6년 표 */
    const tb = $("co-tb"); tb.textContent = "";
    tb.appendChild(el("thead", null, [el("tr", null, [el("th", { text: uName, scope: "col" })].concat(co.years.map((y) => el("th", { text: "FY" + y.fy, scope: "col" }))))]));
    const body = el("tbody"), rr = (name, f) => { const tr = el("tr"); tr.appendChild(el("th", { text: name, scope: "row" })); co.years.forEach((y, i) => tr.appendChild(el("td", { text: f(y, i) }))); body.appendChild(tr); };
    rr("매출", (y) => fmt(y.rev / unit, 0)); rr("매출총이익", (y) => fmt(y.gp / unit, 0)); rr("연구개발비", (y) => fmt(y.rd / unit, 0)); rr("영업이익", (y) => fmt(y.op / unit, 0)); rr("순이익", (y) => fmt(y.ni / unit, 0));
    rr("영업현금흐름", (y) => fmt(y.ocf / unit, 0) + (y.ocfNote ? "*" : "")); rr("설비투자", (y) => fmt(y.capex / unit, 0));
    if (co.years[0].buyback !== undefined) rr("자사주 매입 + 배당", (y) => fmt((y.buyback + y.div) / unit, 0));
    rr("영업이익률", (y) => pc(y.op / y.rev * 100)); rr("연구개발비 / 매출", (y) => pc(y.rd / y.rev * 100));
    tb.appendChild(body);
    const src = $("co-src"); src.textContent = "";
    src.append("출처: " + (co.id === "TEL" ? "Tokyo Electron IR 원문(결산 설명회 자료, 연결재무제표). *표시는 분기 영업현금흐름의 합. " : "SEC 제출 원문(Fiscal.ai 표준화 재무제표, 값마다 원문 쪽수 연결). "));
    co.src.slice(-3).forEach((u, i) => { if (i) src.append(" · "); src.append(el("a", { href: u, text: "원문 " + (i + 1), target: "_blank", rel: "noopener" })); });
  }

  /* ---------- 읽는 법·한계 ---------- */
  li($("use-list"), [
    ["장비사의 서비스 매출은 부품 회사의 교체 수요 지표입니다.", " Lam Research의 고객 지원 매출, Applied Materials의 AGS처럼 설치 기반 매출이 늘면 그 장비에 들어가는 소모 부품(링, 정전척, 코팅 재생)의 교체 수요도 함께 늘어납니다. 부품 사업계획의 반복 매출 전제를 세울 때 이 숫자의 추세를 기준선으로 씁니다."],
    ["장비사 매출의 중국 비중 변화는 부품 수요 지역 변화보다 먼저 보입니다.", " 장비가 설치된 지역에서 이후 몇 년간 교체 부품 수요가 생깁니다. 중국 비중이 낮아지고 한국·대만 비중이 높아지는 흐름은 부품 수요 지역의 방향을 미리 보여 줍니다."],
    ["이익률 차이는 무엇을 파는지에서 나옵니다.", " 공급자가 적은 장비(EUV, 검사)를 파는 회사가 매출총이익률이 높고, 여러 회사가 경쟁하는 증착·식각 장비사는 서비스 매출로 이익률을 보완합니다. 고객사의 가격 협상 여력을 가늠할 때도 이 구조를 함께 봅니다."],
    ["연구개발비 비중은 다음 세대 자리를 미리 산다는 뜻입니다.", " 5곳 모두 매출의 10~15%를 연구개발에 씁니다. 장비사의 차세대 장비 일정은 부품 회사의 신제품 인증 일정과 같은 박자로 움직입니다."]
  ]);
  li($("lim-list"), [
    ["회계연도와 회계기준이 다릅니다.", " ASML 12월(US GAAP 20-F), Applied Materials 10월 말, Lam Research·KLA 6월 말(US GAAP 10-K), Tokyo Electron 3월(일본 기준)입니다. 같은 '최근 회계연도'라도 기간이 최대 9개월 어긋납니다."],
    ["표준화 숫자를 썼습니다.", " 미국 상장 4곳은 Fiscal.ai가 SEC 제출 원문을 같은 항목 체계로 옮긴 값입니다(값마다 원문 쪽수 연결). 회사가 발표하는 조정(Non-GAAP) 이익률과는 다를 수 있습니다."],
    ["Tokyo Electron은 일부 항목을 다른 문서에서 옮겼습니다.", " 2021·2022 회계연도 영업현금흐름은 결산 설명회 자료의 분기 값을 더했고, 설비투자는 회사가 발표한 설비투자액(다른 4곳은 현금흐름표의 유형자산 취득)입니다. 2021 회계연도 매출총이익은 매출에 공시된 매출총이익률을 곱해 구했습니다."],
    ["달러 환산은 근사입니다.", " 미 연준 G.5A 연평균 환율(2025년 1유로 1.1306달러, 1달러 149.57엔)을 썼고, 3월 결산인 Tokyo Electron은 회계연도 대부분이 걸친 앞 해의 환율로 근사했습니다. 비율 지표는 환산과 무관합니다."],
    ["전망은 담지 않았습니다.", " 각사의 다음 해 가이던스와 시장 전망은 바뀌기 쉬워 넣지 않았습니다. 공시 숫자는 정정될 수 있으므로 중요한 판단 전에 원문을 다시 확인해야 합니다."]
  ]);

  function all() { drawTr(); drawCyc(); drawGeo(); drawCo(); }
  all(); F.onRedraw(all);
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "호황" }, { x: 0.90, y: 0.22, label: "노광" }, { x: 0.90, y: 0.50, label: "증착·식각" }, { x: 0.90, y: 0.78, label: "검사" }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "독점" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "서비스" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 12, label: "이익률" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

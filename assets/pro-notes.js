/* 추정과 가치의 기법 노트(tools/pro-methods.html)의 도표. 계산은 assets/engines/prolab.js */
(function () {
  "use strict";
  const F = window.Fin, S = window.Stats, L = window.ProLab, $ = F.$, NS = "http://www.w3.org/2000/svg";
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const path = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sg = (v, d) => (v > 0 ? "+" : "") + fmt(v, d);
  const pc = (v, d) => fmt(v * 100, d === undefined ? 1 : d) + "%";
  const put = (o) => { for (const k in o) { const e = $(k); if (e) e.textContent = o[k]; } };
  function frame(id, H, label) { const host = $(id); host.textContent = ""; const W = Math.max(260, Math.round(host.clientWidth || 640)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, host), W: W, nar: W < 520 }; }
  function axes(svg, x, y, xt, yt, l, r, t, b, fx, fy) {
    yt.forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, svg); tx(svg, l - 6, y(v) + 4, fy(v), { "text-anchor": "end", class: "n", "font-size": 10.5, fill: c("--muted") }); });
    xt.forEach((v) => { sv("line", { x1: x(v), x2: x(v), y1: b, y2: b + 4, stroke: c("--rule") }, svg); tx(svg, x(v), b + 16, fx(v), { "text-anchor": "middle", class: "n", "font-size": 10.5, fill: c("--muted") }); });
  }
  function table(id, head, rows) {
    const host = $(id); host.textContent = ""; const t = F.el("table", { class: "mini" }), th = F.el("thead"), tr = F.el("tr");
    head.forEach((h) => tr.appendChild(F.el("th", { text: h }))); th.appendChild(tr); t.appendChild(th);
    const tb = F.el("tbody"); rows.forEach((r) => { const row = F.el("tr"); r.forEach((v) => row.appendChild(F.el("td", { text: String(v) }))); tb.appendChild(row); }); t.appendChild(tb); host.appendChild(t);
  }
  const W9 = 0.09;

  /* 1. 가치동인 */
  function drawVD() {
    const roic = +$("vd-r").value / 100, g = +$("vd-g").value / 100, fr = frame("vd-fig", 280, "성장률에 따른 기업가치"), svg = fr.svg, l = 48, r = fr.W - (fr.nar ? 14 : 110), x = lin(0, 0.06, l, r);
    const flat = 100 / W9, sets = [[0.25, c("--mark-muted")], [0.15, c("--mark-muted")], [0.06, c("--mark-muted")]], gs = []; for (let v = 0; v <= 0.0601; v += 0.0025) gs.push(v);
    const top = Math.max(L.valueDriver(100, 0.06, 0.25, W9), L.valueDriver(100, 0.06, Math.max(roic, 0.1), W9)), y = lin(0, Math.ceil(top / 500) * 500, 240, 16);
    axes(svg, x, y, [0, 0.02, 0.04, 0.06], F.niceTicks(0, top, 4).ticks.filter((v) => v <= Math.ceil(top / 500) * 500), l, r, 16, 240, (v) => pc(v, 0), (v) => fmt(v, 0));
    sets.forEach((s) => { sv("path", { d: path(gs.map((v) => [x(v), y(Math.max(0, L.valueDriver(100, v, s[0], W9)))])), fill: "none", stroke: s[1], "stroke-width": 1.3 }, svg); if (!fr.nar) tx(svg, r + 6, y(Math.max(0, L.valueDriver(100, 0.06, s[0], W9))) + 4, "ROIC " + pc(s[0], 0), { fill: c("--muted"), "font-size": 10.5 }); });
    sv("line", { x1: l, x2: r, y1: y(flat), y2: y(flat), stroke: c("--ink-2"), "stroke-dasharray": "5 4" }, svg);
    if (!fr.nar) tx(svg, r + 6, y(flat) + 4, "성장 없음", { fill: c("--ink-2"), "font-size": 10.5 });
    const col = roic > W9 + 1e-9 ? c("--pos") : roic < W9 - 1e-9 ? c("--neg") : c("--ink-2");
    sv("path", { d: path(gs.map((v) => [x(v), y(Math.max(0, L.valueDriver(100, v, roic, W9)))])), fill: "none", stroke: col, "stroke-width": 2.8 }, svg);
    const val = L.valueDriver(100, g, roic, W9);
    sv("circle", { cx: x(g), cy: y(Math.max(0, val)), r: 6, fill: col, stroke: c("--surface"), "stroke-width": 2 }, svg);
    tx(svg, r, 268, "성장률", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 }); tx(svg, l, 10, "기업가치(억원)", { fill: c("--muted"), "font-size": 10.5 });
    $("vd-rv").textContent = pc(roic, 0); $("vd-gv").textContent = pc(g, 1);
    put({ "vd-out": "ROIC " + pc(roic, 0) + " · 성장률 " + pc(g, 1) + " → 가치 " + fmt(val, 0) + "억원 · 성장이 없을 때 " + fmt(flat, 0) + "억원 · 성장이 만든 가치 " + sg(val - flat, 0) + "억원 · 재투자율 " + pc(g / roic, 0) + (roic < W9 ? " · 성장할수록 가치가 줄어듭니다" : roic === W9 ? " · 성장해도 가치는 그대로입니다" : "") });
  }

  /* 2. 역DCF */
  const RD = { n: 7, roic: 0.15, gT: 0.02 };
  const rdV = (g) => L.twoStage(100, g, RD.n, RD.roic, W9, RD.gT, W9).value;
  function drawRD() {
    const ev = +$("rd-e").value, mine = +$("rd-m").value / 100, gi = L.impliedGrowth(ev, 100, RD.n, RD.roic, W9, RD.gT, W9), vm = rdV(mine);
    const fr = frame("rd-fig", 280, "성장률별 가치와 현재 평가액"), svg = fr.svg, l = 52, r = fr.W - 14, x = lin(0, 0.2, l, r), y = lin(800, 3800, 240, 16), gs = []; for (let v = 0; v <= 0.2001; v += 0.005) gs.push(v);
    axes(svg, x, y, [0, 0.05, 0.1, 0.15, 0.2], [1000, 2000, 3000], l, r, 16, 240, (v) => pc(v, 0), (v) => fmt(v, 0));
    sv("path", { d: path(gs.map((v) => [x(v), y(rdV(v))])), fill: "none", stroke: c("--ink-2"), "stroke-width": 2.2 }, svg);
    sv("line", { x1: l, x2: r, y1: y(ev), y2: y(ev), stroke: c("--accent"), "stroke-width": 1.6 }, svg);
    tx(svg, l + 6, y(ev) - 6, "현재 평가액 " + fmt(ev, 0), { fill: c("--accent"), "font-weight": 700 });
    const gx = Math.min(0.2, Math.max(0, gi));
    sv("line", { x1: x(gx), x2: x(gx), y1: y(ev), y2: 240, stroke: c("--accent"), "stroke-dasharray": "4 3" }, svg); sv("circle", { cx: x(gx), cy: y(ev), r: 5.5, fill: c("--accent") }, svg);
    tx(svg, x(gx) + (gx > 0.16 ? -8 : 8), y(ev) + 16, "요구 성장률 " + pc(gi, 1), { "text-anchor": gx > 0.16 ? "end" : "start", fill: c("--accent"), "font-weight": 700, "font-size": 10.5 });
    sv("line", { x1: x(mine), x2: x(mine), y1: y(vm), y2: 240, stroke: c("--input"), "stroke-dasharray": "4 3" }, svg); sv("circle", { cx: x(mine), cy: y(vm), r: 5.5, fill: c("--input") }, svg);
    tx(svg, x(mine) + (mine > gi ? 8 : -8), y(vm) - 8, "내 계획 " + fmt(vm, 0), { "text-anchor": mine > gi ? "start" : "end", fill: c("--input"), "font-weight": 700 });
    tx(svg, r, 276, "7년간 연 성장률", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 }); tx(svg, l, 10, "계산 가치(억원)", { fill: c("--muted"), "font-size": 10.5 });
    $("rd-evv").textContent = fmt(ev, 0) + "억원 (이익의 " + fmt(ev / 100, 0) + "배)"; $("rd-mv").textContent = pc(mine, 0);
    const gap = gi - mine;
    put({ "rd-ev": fmt(ev, 0), "rd-g": pc(gi, 1), "rd-tv": pc(L.twoStage(100, gi, RD.n, RD.roic, W9, RD.gT, W9).tvShare, 0),
      "rd-out": "가격이 요구하는 성장률 " + pc(gi, 1) + " · 내 계획 " + pc(mine, 0) + "로 계산한 가치 " + fmt(vm, 0) + "억원 · " + (Math.abs(gap) < 0.005 ? "가격과 계획이 거의 같은 기대를 담고 있습니다" : gap > 0 ? "가격에는 계획보다 연 " + fmt(gap * 100, 1) + "%p 높은 성장이 들어 있습니다" : "가격은 계획보다 연 " + fmt(-gap * 100, 1) + "%p 낮은 성장만 요구합니다") });
  }

  /* 3. 페이드 */
  function drawFD() {
    const r0 = +$("fd-r").value / 100, cap = +$("fd-c").value, fr = frame("fd-fig", 260, "경쟁우위 기간별 가치 배수"), svg = fr.svg, l = 44, r = fr.W - 14, x = lin(0, 25, l, r);
    const pts = []; for (let k = 0; k <= 25; k++) pts.push([k, L.fade(1000, r0, W9, 0.05, k).multiple]);
    const top = Math.max(1.6, pts[25][1] * 1.08), y = lin(0.8, top, 220, 16), cur = L.fade(1000, r0, W9, 0.05, cap).multiple;
    axes(svg, x, y, [0, 5, 10, 15, 20, 25], F.niceTicks(1, top, 4).ticks.filter((v) => v >= 0.8 && v <= top), l, r, 16, 220, (v) => v + "년", (v) => fmt(v, 1) + "배");
    sv("line", { x1: l, x2: r, y1: y(1), y2: y(1), stroke: c("--ink-2"), "stroke-dasharray": "5 4" }, svg);
    sv("path", { d: path(pts.map((p) => [x(p[0]), y(p[1])])) + "L" + x(25) + "," + y(1) + "L" + x(0) + "," + y(1) + "Z", fill: c("--input"), opacity: 0.1 }, svg);
    sv("path", { d: path(pts.map((p) => [x(p[0]), y(p[1])])), fill: "none", stroke: c("--input"), "stroke-width": 2.6 }, svg);
    sv("line", { x1: x(cap), x2: x(cap), y1: y(cur), y2: 220, stroke: c("--accent"), "stroke-dasharray": "4 3" }, svg); sv("circle", { cx: x(cap), cy: y(cur), r: 6, fill: c("--accent"), stroke: c("--surface"), "stroke-width": 2 }, svg);
    tx(svg, x(cap) + (cap > 18 ? -10 : 10), y(cur) - 8, fmt(cur, 2) + "배", { "text-anchor": cap > 18 ? "end" : "start", fill: c("--accent"), "font-weight": 700, "font-size": 12 });
    tx(svg, l + 4, y(1) + 14, "가치 = 투하자본", { fill: c("--muted"), "font-size": 10.5 });
    $("fd-rv").textContent = pc(r0, 0); $("fd-cv").textContent = cap + "년";
    put({ "fd-r0": pc(r0, 0), "fd-cap": String(cap), "fd-m": fmt(cur, 2) });
  }

  /* 4. 기준율 */
  const RC = L.refClass(), RCM = S.mean(RC);
  function drawBS() {
    const ins = +$("bs-i").value, r = +$("bs-rr").value, adj = L.shrink(ins, RCM, r), fr = frame("bs-fig", 250, "참조집단 성장률 분포"), svg = fr.svg, l = 14, rr = fr.W - 14, x = lin(-25, 40, l, rr);
    const hg = S.histogram(RC, 26, -25, 40), y = lin(0, Math.max.apply(null, hg.counts) * 1.25, 206, 20);
    hg.counts.forEach((n, i) => { if (!n) return; const a = hg.edges[i], b = a + hg.w; sv("rect", { x: x(a) + 1, y: y(n), width: x(b) - x(a) - 2, height: y(0) - y(n), fill: (a + b) / 2 >= ins ? c("--accent") : c("--mark-muted"), opacity: (a + b) / 2 >= ins ? 0.75 : 0.5 }, svg); });
    sv("line", { x1: l, x2: rr, y1: y(0), y2: y(0), stroke: c("--rule") }, svg);
    [-20, -10, 0, 10, 20, 30, 40].forEach((v) => tx(svg, x(v), 224, v + "%", { "text-anchor": "middle", class: "n", "font-size": 10.5, fill: c("--muted") }));
    const mark = (v, col, lab, yy, anchor) => { sv("line", { x1: x(v), x2: x(v), y1: yy + 4, y2: 206, stroke: col, "stroke-width": 1.8, "stroke-dasharray": "5 3" }, svg); tx(svg, x(v), yy, lab, { "text-anchor": anchor || "middle", fill: col, "font-weight": 700, "font-size": 10.5 }); };
    mark(RCM, c("--ink-2"), "기준율 " + fmt(RCM, 1) + "%", 14, "end"); mark(ins, c("--accent"), "내 예측 " + ins + "%", 14, "start"); mark(adj, c("--input"), "보정 " + fmt(adj, 1) + "%", 34);
    const top = 1 - L.percentileOf(RC, ins - 0.001);
    $("bs-iv").textContent = ins + "%"; $("bs-rv").textContent = fmt(r, 1);
    put({ "bs-mean": fmt(RCM, 1) + "%", "bs-in": ins + "%", "bs-top": pc(top, 0), "bs-r": fmt(r, 1), "bs-adj": fmt(adj, 1) + "%",
      "bs-out": "참조집단 평균 " + fmt(RCM, 1) + "% · 중앙값 " + fmt(S.quantile(RC, 0.5), 1) + "% · 상위 10% 경계 " + fmt(S.quantile(RC, 0.9), 1) + "% · 내 예측은 상위 " + pc(top, 0) + " · 보정 예측 " + fmt(adj, 1) + "%" });
  }

  /* 5. 경험곡선 */
  const ED = L.expData(), EF = L.expFit(ED);
  function drawEX() {
    const n = +$("ex-n").value, cn = L.expCost(EF.c1, n, EF.lr), fr = frame("ex-fig", 270, "누적 생산량과 단위원가 로그 그래프"), svg = fr.svg, l = 44, r = fr.W - 14;
    const x = lin(Math.log(1), Math.log(1400), l, r), y = lin(Math.log(10), Math.log(120), 230, 16);
    [10, 20, 50, 100].forEach((v) => { sv("line", { x1: l, x2: r, y1: y(Math.log(v)), y2: y(Math.log(v)), stroke: c("--rule-soft") }, svg); tx(svg, l - 6, y(Math.log(v)) + 4, String(v), { "text-anchor": "end", class: "n", "font-size": 10.5, fill: c("--muted") }); });
    [1, 10, 100, 1000].forEach((v) => { sv("line", { x1: x(Math.log(v)), x2: x(Math.log(v)), y1: 16, y2: 230, stroke: c("--rule-soft") }, svg); tx(svg, x(Math.log(v)), 246, fmt(v, 0), { "text-anchor": "middle", class: "n", "font-size": 10.5, fill: c("--muted") }); });
    sv("line", { x1: x(0), x2: x(Math.log(150)), y1: y(Math.log(EF.c1)), y2: y(Math.log(L.expCost(EF.c1, 150, EF.lr))), stroke: c("--input"), "stroke-width": 2.2 }, svg);
    sv("line", { x1: x(Math.log(150)), x2: x(Math.log(1400)), y1: y(Math.log(L.expCost(EF.c1, 150, EF.lr))), y2: y(Math.log(L.expCost(EF.c1, 1400, EF.lr))), stroke: c("--input"), "stroke-width": 2.2, "stroke-dasharray": "6 4" }, svg);
    ED.forEach((d) => sv("circle", { cx: x(Math.log(d.n)), cy: y(Math.log(d.c)), r: 4, fill: c("--ink-2") }, svg));
    sv("circle", { cx: x(Math.log(n)), cy: y(Math.log(cn)), r: 6, fill: c("--accent"), stroke: c("--surface"), "stroke-width": 2 }, svg);
    tx(svg, x(Math.log(n)), y(Math.log(cn)) - 12, fmt(cn, 1), { "text-anchor": "middle", fill: c("--accent"), "font-weight": 700, "font-size": 12 });
    tx(svg, r, 264, "누적 생산량", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 }); tx(svg, l, 10, "단위원가", { fill: c("--muted"), "font-size": 10.5 });
    const last = ED[ED.length - 1];
    $("ex-nv").textContent = fmt(n, 0);
    put({ "ex-lr": pc(EF.lr, 1), "ex-ci": pc(EF.lrLo, 1) + "~" + pc(EF.lrHi, 1), "ex-cut": pc(1 - EF.lr, 0),
      "ex-out": "지금 누적 " + last.n + "에서 원가 " + fmt(last.c, 1) + " → 누적 " + fmt(n, 0) + "(지금의 " + fmt(n / last.n, 1) + "배)에서 예상 원가 " + fmt(cn, 1) + " · 지금보다 " + pc(1 - cn / L.expCost(EF.c1, last.n, EF.lr), 0) + " 절감 · 점선은 관측 범위 밖" });
  }

  /* 6. 바스 */
  function drawBA() {
    const p = +$("ba-pp").value, q = +$("ba-qq").value, B = L.bass(1000, p, q, 16), fr = frame("ba-fig", 260, "연간 판매와 누적 보급"), svg = fr.svg, l = 40, r = fr.W - 44, bw = (r - l) / 16;
    const top = Math.max.apply(null, B.rows.map((d) => d.sales)) * 1.2, y = lin(0, top, 220, 20), yc = lin(0, 1, 220, 20);
    F.niceTicks(0, top, 3).ticks.filter((v) => v <= top).forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, svg); tx(svg, l - 6, y(v) + 4, String(v), { "text-anchor": "end", class: "n", "font-size": 10.5, fill: c("--muted") }); });
    [0.5, 1].forEach((v) => tx(svg, r + 6, yc(v) + 4, pc(v, 0), { class: "n", "font-size": 10.5, fill: c("--muted") }));
    const pk = Math.max(1, Math.min(16, Math.ceil(B.peak)));
    B.rows.forEach((d, i) => { sv("rect", { x: l + i * bw + bw * 0.15, y: y(d.sales), width: bw * 0.7, height: y(0) - y(d.sales), fill: d.t === pk ? c("--accent") : c("--mark-muted"), opacity: d.t === pk ? 0.9 : 0.55, rx: 2 }, svg); if (d.t % 2 === 0 || !fr.nar) tx(svg, l + (i + 0.5) * bw, 236, String(d.t), { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }); });
    sv("path", { d: path([[l, yc(0)]].concat(B.rows.map((d, i) => [l + (i + 1) * bw - bw * 0.5, yc(d.cum / 1000)]))), fill: "none", stroke: c("--ink"), "stroke-width": 2 }, svg);
    tx(svg, l + (pk - 0.5) * bw, y(B.rows[pk - 1].sales) - 6, "정점", { "text-anchor": "middle", fill: c("--accent"), "font-weight": 700, "font-size": 10.5 });
    tx(svg, r, 254, "출시 후 연차", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 });
    $("ba-pv").textContent = fmt(p, 3); $("ba-qv").textContent = fmt(q, 2);
    put({ "ba-p": fmt(p, 3), "ba-q": fmt(q, 2), "ba-pk": fmt(B.peak, 1), "ba-sh": pc(B.peakShare, 0) });
  }

  /* 7. 결정나무 */
  function drawTR() {
    const ph = +$("tr-p").value / 100, probs = [ph, 0.4, 0.6 - ph], T = L.TREE, D = L.decide(T.payoff, probs);
    const fr = frame("tr-fig", 230, "대안별 기댓값"), svg = fr.svg, l = fr.nar ? 76 : 96, r = fr.W - 46, lo = Math.min(-10, Math.min.apply(null, D.emv)), hi = Math.max(D.perfect, 10) * 1.1, x = lin(lo, hi, l, r);
    sv("line", { x1: x(0), x2: x(0), y1: 10, y2: 196, stroke: c("--ink-2") }, svg);
    T.acts.forEach((a, i) => { const yy = 18 + i * 42, v = D.emv[i], best = i === D.best; tx(svg, l - 8, yy + 16, a, { "text-anchor": "end", fill: c("--ink"), "font-weight": best ? 700 : 400 });
      sv("rect", { x: Math.min(x(0), x(v)), y: yy, width: Math.max(1, Math.abs(x(v) - x(0))), height: 24, fill: best ? c("--input") : c("--mark-muted"), opacity: best ? 0.9 : 0.55, rx: 3 }, svg);
      tx(svg, v >= 0 ? x(v) + 6 : x(v) - 6, yy + 16, fmt(v, 1), { "text-anchor": v >= 0 ? "start" : "end", class: "n", fill: c("--ink"), "font-weight": best ? 700 : 400 }); });
    const yy = 18 + 3 * 42; tx(svg, l - 8, yy + 16, fr.nar ? "미리 알면" : "수요를 미리 알면", { "text-anchor": "end", fill: c("--accent"), "font-weight": 700 });
    sv("rect", { x: x(0), y: yy, width: x(D.emv[D.best]) - x(0), height: 24, fill: c("--input"), opacity: 0.35, rx: 3 }, svg);
    sv("rect", { x: x(D.emv[D.best]), y: yy, width: Math.max(0, x(D.perfect) - x(D.emv[D.best])), height: 24, fill: c("--accent"), opacity: 0.9, rx: 3 }, svg);
    tx(svg, x(D.perfect) + 6, yy + 16, fmt(D.perfect, 1), { class: "n", fill: c("--accent"), "font-weight": 700 });
    tx(svg, x(0), 216, "기댓값(억원)", { "text-anchor": "middle", fill: c("--muted"), "font-size": 10.5 });
    $("tr-pv").textContent = pc(ph, 0);
    put({ "tr-best": T.acts[D.best], "tr-emv": fmt(D.emv[D.best], 1), "tr-pf": fmt(D.perfect, 1), "tr-evpi": fmt(D.evpi, 1),
      "tr-out": "확률 강함 " + pc(probs[0], 0) + " · 보통 40% · 약함 " + pc(probs[2], 0) + " → 지금 정하면 " + T.acts[D.best] + " " + fmt(D.emv[D.best], 1) + "억원 · 완전한 정보의 가치 " + fmt(D.evpi, 1) + "억원" + (D.evpi < 0.05 ? " (알아도 선택이 같아 조사할 가치가 없습니다)" : "") });
    table("tr-tb", ["대안"].concat(T.states).concat(["기댓값"]), T.payoff.map((row, i) => [T.acts[i]].concat(row.map((v) => fmt(v, 0))).concat([fmt(D.emv[i], 1)])).concat([["상태별 최선"].concat(D.bestByState.map((k) => T.acts[k])).concat([fmt(D.perfect, 1)])]));
  }

  /* 8. 가격·물량·믹스 */
  function drawPV() {
    const P = L.pvm(L.PVM), k = 100, steps = [["전년 매출", P.r0 / k, 0], ["물량", P.volume / k, 1], ["가격", P.price / k, 1], ["믹스", P.mix / k, 1], ["올해 매출", P.r1 / k, 0]];
    const fr = frame("pv-fig", 250, "매출 차이 폭포 차트"), svg = fr.svg, l = 14, r = fr.W - 14, bw = (r - l) / steps.length, lo = Math.min(P.r0, P.r1) / k * 0.9, hi = (P.r0 + Math.max(0, P.volume)) / k * 1.03, y = lin(lo, hi, 206, 26);
    let acc = 0;
    steps.forEach((s, i) => { const x0 = l + i * bw + bw * 0.16, w = bw * 0.68; let a, b;
      if (s[2] === 0) { a = lo; b = s[1]; acc = s[1]; } else { a = acc; b = acc + s[1]; acc = b; }
      sv("rect", { x: x0, y: y(Math.max(a, b)), width: w, height: Math.max(1, Math.abs(y(a) - y(b))), fill: s[2] === 0 ? c("--total") : s[1] >= 0 ? c("--pos") : c("--neg"), opacity: 0.85, rx: 2 }, svg);
      tx(svg, x0 + w / 2, y(Math.max(a, b)) - 6, s[2] === 0 ? fmt(s[1], 0) : sg(s[1], 0), { "text-anchor": "middle", class: "n", fill: c("--ink"), "font-weight": 700, "font-size": 11 });
      tx(svg, x0 + w / 2, 226, s[0], { "text-anchor": "middle", fill: c("--ink"), "font-size": fr.nar ? 10 : 11 });
      if (i < steps.length - 1) sv("line", { x1: x0 + w, x2: x0 + bw, y1: y(acc), y2: y(acc), stroke: c("--mark-muted"), "stroke-dasharray": "3 3" }, svg); });
    tx(svg, l, 244, "세로축은 " + fmt(lo, 0) + "억원에서 시작(차이를 보이려고 잘랐습니다)", { fill: c("--muted"), "font-size": 10 });
    put({ "pv-r0": fmt(P.r0 / k, 0), "pv-r1": fmt(P.r1 / k, 0), "pv-v": sg(P.volume / k, 0) + "억원", "pv-p": sg(P.price / k, 0) + "억원", "pv-m": sg(P.mix / k, 0) + "억원", "pv-a0": fmt(P.avg0, 1) + "천원", "pv-a1": fmt(P.avg1, 1) + "천원" });
    table("pv-tb", ["제품", "전년 단가", "전년 수량", "올해 단가", "올해 수량"], L.PVM.map((d) => [d.name, d.p0, d.q0, d.p1, d.q1]).concat([["합계·평균", fmt(P.avg0, 1), P.q0, fmt(P.avg1, 1), P.q1]]));
  }

  function all() { drawVD(); drawRD(); drawFD(); drawBS(); drawEX(); drawBA(); drawTR(); drawPV(); }
  all();
  [["vd-r", drawVD], ["vd-g", drawVD], ["rd-e", drawRD], ["rd-m", drawRD], ["fd-r", drawFD], ["fd-c", drawFD], ["bs-i", drawBS], ["bs-rr", drawBS], ["ex-n", drawEX], ["ba-pp", drawBA], ["ba-qq", drawBA], ["tr-p", drawTR]].forEach((q) => $(q[0]).addEventListener("input", q[1]));
  F.onRedraw(all);
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "가격" }, { x: 0.90, y: 0.14, label: "성장" }, { x: 0.90, y: 0.38, label: "수익률" }, { x: 0.90, y: 0.62, label: "기간" }, { x: 0.90, y: 0.86, label: "위험" }],
      links: [{ from: 0, to: 1, bend: -0.10, c: 0, n: 14, label: "기대" }, { from: 0, to: 2, bend: -0.04, c: 1, n: 14, label: "ROIC" }, { from: 0, to: 3, bend: 0.04, c: 2, n: 14, label: "페이드" }, { from: 0, to: 4, bend: 0.10, c: 0, n: 14, label: "WACC" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

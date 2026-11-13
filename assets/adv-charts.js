/* 차트 노트(tools/charts.html)의 '복잡하지만 쓸 만한 차트' 그림. 자료와 배치 계산은 assets/engines/advviz.js */
(function () {
  "use strict";
  const F = window.Fin, A = window.AdvViz, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!A || !$("f-sankey")) return;
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const sg = (v, d) => (v > 0 ? "+" : "") + fmt(v, d);
  const path = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
  function frame(id, H, label) { const host = $(id); host.textContent = ""; const W = Math.max(280, Math.round(host.clientWidth || 640)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, host), W: W, nar: W < 520 }; }
  const mix = (a, b, t) => "color-mix(in srgb, " + a + " " + Math.round(t * 100) + "%, " + b + ")";

  /* 1. 생키 */
  function drawSankey() {
    const w0 = Math.round($("f-sankey").clientWidth || 640), nar = w0 < 520, H = nar ? 380 : 340, fr = frame("f-sankey", H, "손익 흐름 생키 다이어그램: 제품별 매출 1,000억원이 매출원가 680, 판관비 190, 금융·법인세 40으로 빠지고 순이익 90이 남음"), s = fr.svg, W = fr.W;
    const padL = nar ? 4 : 8, padR = nar ? 84 : 96, nw = nar ? 8 : 12, top = 14, L = A.sankeyLayout(A.SANKEY, H - 28, nar ? 8 : 12), X = (col) => padL + col * (W - padL - padR - nw) / (L.ncol - 1);
    L.links.forEach((l) => { const a = L.pos[l.from], b = L.pos[l.to], x0 = X(a.col) + nw, x1 = X(b.col), mx = (x0 + x1) / 2, bad = b.node.bad;
      sv("path", { d: "M" + x0 + "," + (top + l.sy0) + "C" + mx + "," + (top + l.sy0) + " " + mx + "," + (top + l.ty0) + " " + x1 + "," + (top + l.ty0) + "L" + x1 + "," + (top + l.ty1) + "C" + mx + "," + (top + l.ty1) + " " + mx + "," + (top + l.sy1) + " " + x0 + "," + (top + l.sy1) + "Z", fill: bad ? c("--mark-muted") : c("--pos"), opacity: bad ? 0.38 : 0.42 }, s); });
    Object.keys(L.pos).forEach((id) => { const p = L.pos[id], n = p.node, x = X(p.col), last = p.col === L.ncol - 1, first = p.col === 0;
      sv("rect", { x: x, y: top + p.y0, width: nw, height: Math.max(1.5, p.y1 - p.y0), fill: n.bad ? c("--total") : c("--pos"), rx: 1.5 }, s);
      const my = top + (p.y0 + p.y1) / 2, lx = last || p.col >= 3 ? x + nw + 5 : x + nw + 5, small = p.y1 - p.y0 < 22;
      if (nar && !last && p.col !== 3 && p.col !== 0 && p.col !== 1 && p.col !== 2) return;
      tx(s, lx, my + (small ? 4 : -1), n.label + (small ? " " + fmt(n.value) : ""), { "font-size": nar ? 9.5 : 11.5, fill: c("--ink"), "font-weight": first || n.id === "rev" || n.id === "ni" || n.id === "op" ? 700 : 400, "paint-order": "stroke", stroke: c("--surface"), "stroke-width": 3 });
      if (!small) tx(s, lx, my + 13, fmt(n.value), { "font-size": nar ? 9.5 : 11, fill: c("--ink-2"), class: "n", "paint-order": "stroke", stroke: c("--surface"), "stroke-width": 3 }); });
  }

  /* 2. 트리맵 */
  function drawTree() {
    const w0 = Math.round($("f-tree").clientWidth || 640), H = w0 < 520 ? 300 : 320, fr = frame("f-tree", H + 30, "비용 구조 트리맵: 재료비 380억원이 가장 크고 예산 대비 4.5% 초과, 전력·용수와 물류비가 예산을 가장 많이 넘음"), s = fr.svg, W = fr.W, T = A.treemap(A.TREE, W, H);
    const col = (d) => (d > 0 ? mix(c("--neg"), c("--surface"), Math.min(0.85, 0.12 + d / 12)) : d < 0 ? mix(c("--input"), c("--surface"), Math.min(0.85, 0.12 + -d / 12)) : c("--rule-soft"));
    T.cells.forEach((q) => { const it = q.it;
      sv("rect", { x: q.x + 1, y: q.y + 1, width: Math.max(0, q.w - 2), height: Math.max(0, q.h - 2), fill: col(it.d), rx: 2 }, s);
      const dark = Math.abs(it.d) > 6.5, ink = dark ? "#FFFFFF" : c("--ink");
      if (q.w > 54 && q.h > 30) { tx(s, q.x + 7, q.y + 17, it.name, { "font-size": q.w > 110 ? 12 : 10, fill: ink, "font-weight": 700 }); tx(s, q.x + 7, q.y + 31, fmt(it.v) + (q.w > 84 ? " · " + sg(it.d, 1) + "%" : ""), { "font-size": 10, fill: ink, class: "n" }); }
      else if (q.w > 30 && q.h > 16) tx(s, q.x + 4, q.y + 13, it.name.slice(0, Math.max(2, Math.floor(q.w / 11))), { "font-size": 9, fill: ink }); });
    T.groups.forEach((g) => { sv("rect", { x: g.x + 0.5, y: g.y + 0.5, width: g.w - 1, height: g.h - 1, fill: "none", stroke: c("--ink"), "stroke-width": 1.6 }, s);
      tx(s, g.x + g.w - 6, g.y + g.h - 7, g.it.name + " " + fmt(g.it.v), { "text-anchor": "end", "font-size": 11, fill: c("--ink"), "font-weight": 700, "paint-order": "stroke", stroke: c("--surface"), "stroke-width": 3 }); });
    const lg = [[-6, "−6%"], [-3, ""], [0, "예산과 같음"], [5, ""], [10, "+10%"]]; let lx = 0;
    lg.forEach((q) => { sv("rect", { x: lx, y: H + 10, width: 26, height: 12, fill: col(q[0]), stroke: c("--rule") }, s); lx += 28; });
    tx(s, lx + 6, H + 20, "색: 예산 대비 덜 씀(파랑) ← → 더 씀(빨강)", { "font-size": 10, fill: c("--muted") });
  }

  /* 3. 마리메꼬 */
  function drawMekko() {
    const M = A.mekko(A.MEKKO), fr = frame("f-mekko", 300, "마리메꼬: 폭은 매출, 높이는 영업이익률, 넓이는 영업이익. A 사업부 72억, B 27억, C −8억, D 25억"), s = fr.svg, W = fr.W, l = 40, r = W - 10, x = lin(0, 1, l, r), y = lin(-10, 30, 250, 16);
    [-10, 0, 10, 20, 30].forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: v === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(v) + 4, v + "%", { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
    M.rows.forEach((q) => { const x0 = x(q.x0), x1 = x(q.x0 + q.w), yy = Math.min(y(q.m), y(0)), hh = Math.abs(y(q.m) - y(0)), neg = q.m < 0;
      sv("rect", { x: x0 + 1, y: yy, width: x1 - x0 - 2, height: hh, fill: neg ? c("--neg") : c("--input"), opacity: neg ? 0.75 : 0.72, rx: 2 }, s);
      const cx = (x0 + x1) / 2, wide = x1 - x0 > 64;
      tx(s, cx, neg ? yy + hh + 14 : yy - 6, (wide ? "이익 " : "") + fmt(q.profit) + (wide ? "억" : ""), { "text-anchor": "middle", "font-size": 11, fill: c("--ink"), "font-weight": 700, class: "n" });
      if (hh > 26 && wide) tx(s, cx, yy + hh / 2 + 4, sg(q.m, 0).replace("+", "") + "%", { "text-anchor": "middle", "font-size": 12, fill: "#FFFFFF", "font-weight": 700, class: "n" });
      tx(s, cx, 268, fr.nar ? q.name.slice(0, 1) : q.name, { "text-anchor": "middle", "font-size": 11, fill: c("--ink"), "font-weight": 700 });
      tx(s, cx, 283, "매출 " + fmt(q.rev), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    sv("line", { x1: l, x2: r, y1: y(M.margin), y2: y(M.margin), stroke: c("--accent"), "stroke-dasharray": "5 4" }, s);
    const ng = M.rows.filter((q) => q.m < 0)[0], lx = ng ? x(ng.x0 + ng.w / 2) : l + 60;
    tx(s, lx, y(M.margin) - 6, "전사 " + fmt(M.margin, 1) + "%", { "text-anchor": "middle", "font-size": 10.5, fill: c("--accent"), "font-weight": 700 });
    const top = M.rows.slice().sort((a, b) => b.m - a.m)[0], big = M.rows.slice().sort((a, b) => b.profit - a.profit)[0];
    $("mekko-note").textContent = "이익률은 " + top.name + "가 " + top.m + "%로 가장 높지만 매출이 작아 이익은 " + fmt(top.profit) + "억원입니다. 이익의 " + fmt(big.profit / M.profit * 100, 0) + "%(" + fmt(big.profit) + "억원)는 폭이 가장 넓은 " + big.name + "에서 나옵니다. 넓이를 모두 더하면 전사 영업이익 " + fmt(M.profit) + "억원입니다.";
  }

  /* 4. 평행 좌표 */
  let pcSel = 1, pcAlt = false;
  function drawPC() {
    const D = A.PC, S = A.pcScale(D), order = pcAlt ? [2, 0, 4, 1, 3] : [0, 1, 2, 3, 4], fr = frame("f-pc", 300, "투자안 여섯 개를 NPV, IRR, 회수기간, 손실확률, 투자액 다섯 축으로 비교한 평행 좌표"), s = fr.svg, W = fr.W, l = fr.nar ? 30 : 50, r = W - (fr.nar ? 30 : 50), x = lin(0, 4, l, r), y = lin(0, 1, 236, 44);
    order.forEach((ai, k) => { const a = D.axes[ai], rg = S.range[a.k], best = a.good > 0 ? rg[1] : rg[0], worst = a.good > 0 ? rg[0] : rg[1];
      sv("line", { x1: x(k), x2: x(k), y1: y(0), y2: y(1), stroke: c("--ink-2") }, s);
      tx(s, x(k), 18, a.label, { "text-anchor": "middle", "font-size": fr.nar ? 10 : 11.5, fill: c("--ink"), "font-weight": 700 });
      tx(s, x(k), 34, fmt(best, best % 1 ? 1 : 0) + a.unit, { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" });
      tx(s, x(k), 252, fmt(worst, worst % 1 ? 1 : 0) + a.unit, { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    tx(s, l, 276, "↑ 위쪽이 좋은 쪽(회수기간·손실확률·투자액은 작을수록 위)", { "font-size": 10, fill: c("--muted") });
    S.rows.forEach((row, i) => { if (i === pcSel) return; sv("path", { d: path(order.map((ai, k) => [x(k), y(row.t[ai])])), fill: "none", stroke: c("--mark-muted"), "stroke-width": 1.3, opacity: 0.7 }, s); });
    const row = S.rows[pcSel], it = D.items[pcSel];
    sv("path", { d: path(order.map((ai, k) => [x(k), y(row.t[ai])])), fill: "none", stroke: c("--accent"), "stroke-width": 2.8 }, s);
    order.forEach((ai, k) => { const a = D.axes[ai], v = it[a.k]; sv("circle", { cx: x(k), cy: y(row.t[ai]), r: 4, fill: c("--accent"), stroke: c("--surface"), "stroke-width": 1.5 }, s);
      tx(s, x(k) + (k === 4 ? -8 : 8), y(row.t[ai]) - 7, fmt(v, v % 1 ? 1 : 0) + a.unit, { "text-anchor": k === 4 ? "end" : "start", "font-size": 10.5, fill: c("--ink"), "font-weight": 700, class: "n", "paint-order": "stroke", stroke: c("--surface"), "stroke-width": 3 }); });
    const best = D.axes.filter((a, ai) => row.t[ai] > 0.999).map((a) => a.label), worst = D.axes.filter((a, ai) => row.t[ai] < 0.001).map((a) => a.label), dom = A.dominated(D);
    $("pc-out").textContent = it.name + ": " + (best.length ? best.join("·") + "에서 가장 좋고 " : "가장 좋은 축은 없고 ") + (worst.length ? worst.join("·") + "에서 가장 나쁩니다. " : "가장 나쁜 축도 없습니다. ") + (dom.some(Boolean) ? "" : "여섯 안 중 다른 안에 모든 기준에서 밀리는 안은 없어, 기준 사이의 절충이 필요합니다.");
    document.querySelectorAll("#pc-chips button").forEach((b, i) => b.setAttribute("aria-pressed", i === pcSel ? "true" : "false"));
  }

  /* 5. 버블 매트릭스 */
  function drawBubble() {
    const D = A.PORT, P = A.portfolio(D), fr = frame("f-bubble", 330, "자회사 포트폴리오 버블 매트릭스: 가로 ROIC − WACC, 세로 매출 성장률, 원 넓이 투하자본"), s = fr.svg, W = fr.W, l = 44, r = W - 14, x = lin(-8, 9, l, r), y = lin(-8, 34, 282, 14), vmax = Math.max.apply(null, D.map((d) => d.ic)), rmax = fr.nar ? 28 : 40;
    sv("rect", { x: x(0), y: y(34), width: r - x(0), height: y(-8) - y(34), fill: c("--pos"), opacity: 0.05 }, s);
    [-5, 0, 5].forEach((v) => { sv("line", { x1: x(v), x2: x(v), y1: 14, y2: 282, stroke: v === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, x(v), 297, sg(v, 0) + "%p", { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    [0, 10, 20, 30].forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: v === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(v) + 4, v + "%", { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
    tx(s, r, 318, "ROIC − WACC → (0의 오른쪽이 가치 창출)", { "text-anchor": "end", "font-size": 10.5, fill: c("--muted") }); tx(s, l, 10, "매출 성장률", { "font-size": 10.5, fill: c("--muted") });
    if (!fr.nar) { tx(s, x(0) + 8, 28, "벌면서 큰다", { "text-anchor": "start", "font-size": 10.5, fill: c("--pos"), "font-weight": 700 }); tx(s, x(0) - 8, 28, "크지만 자본비용을 못 번다", { "text-anchor": "end", "font-size": 10.5, fill: c("--neg-ink"), "font-weight": 700 }); }
    D.slice().sort((a, b) => b.ic - a.ic).forEach((d) => { const rr = A.bubbleR(d.ic, vmax, rmax), cx = x(d.sp), cy = y(d.g), good = d.sp > 0;
      sv("circle", { cx: cx, cy: cy, r: rr, fill: good ? c("--pos") : c("--neg"), opacity: 0.32, stroke: good ? c("--pos") : c("--neg"), "stroke-width": 1.5 }, s);
      tx(s, cx, cy + 1, d.name, { "text-anchor": "middle", "font-size": 11, fill: c("--ink"), "font-weight": 700, "paint-order": "stroke", stroke: c("--surface"), "stroke-width": 3 });
      tx(s, cx, cy + 14, fmt(d.ic), { "text-anchor": "middle", "font-size": 9.5, fill: c("--ink-2"), class: "n", "paint-order": "stroke", stroke: c("--surface"), "stroke-width": 3 }); });
    $("bubble-note").textContent = "투하자본 " + fmt(P.ic) + "억원 중 " + fmt(P.pos * 100, 0) + "%가 자본비용을 넘게 버는 사업에 있습니다. 가중평균 초과수익률은 " + sg(P.wsp, 1) + "%p, 합산 EVA는 " + sg(P.eva, 0) + "억원입니다. 왼쪽 위(빠르게 크지만 자본비용을 못 버는 사업)는 성장이 가치를 깎고 있는지 먼저 확인할 곳입니다.";
  }

  /* 6. 연결 산점도 */
  let loopMode = "loop";
  function drawLoop() {
    const P = A.LOOP, fr = frame("f-loop", 320, loopMode === "loop" ? "재고일수와 판매단가의 12분기 경로를 이은 연결 산점도, 시계 방향으로 돈다" : "재고일수와 판매단가를 위아래 두 칸의 꺾은선으로 그린 것"), s = fr.svg, W = fr.W;
    const lab = (p) => "'" + String(p.yr).slice(2) + " " + p.q;
    if (loopMode === "loop") {
      const l = 48, r = W - 16, x = lin(34, 90, l, r), y = lin(70, 130, 276, 16);
      [40, 60, 80].forEach((v) => { sv("line", { x1: x(v), x2: x(v), y1: 16, y2: 276, stroke: c("--rule-soft") }, s); tx(s, x(v), 291, v + "일", { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
      [80, 100, 120].forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: v === 100 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(v) + 4, String(v), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
      sv("defs", {}, s).innerHTML = '<marker id="lp-ah" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L8,4L0,8z" fill="' + c("--input") + '"/></marker>';
      for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], mx = (x(a.inv) + x(b.inv)) / 2, my = (y(a.price) + y(b.price)) / 2;
        sv("line", { x1: x(a.inv), y1: y(a.price), x2: mx, y2: my, stroke: c("--input"), "stroke-width": 2, opacity: 0.35 + 0.6 * i / P.length, "marker-end": "url(#lp-ah)" }, s);
        sv("line", { x1: mx, y1: my, x2: x(b.inv), y2: y(b.price), stroke: c("--input"), "stroke-width": 2, opacity: 0.35 + 0.6 * i / P.length }, s); }
      P.forEach((p, i) => { const first = i === 0, last = i === P.length - 1; sv("circle", { cx: x(p.inv), cy: y(p.price), r: first || last ? 6 : 3.5, fill: last ? c("--accent") : first ? c("--ink") : c("--input"), stroke: c("--surface"), "stroke-width": 1.5 }, s);
        if (first || last || i % 2 === 0 || !fr.nar) { const rt = x(p.inv) > r - 90; tx(s, x(p.inv) + (rt ? -9 : 8), y(p.price) + (rt && first ? 16 : -7), lab(p) + (first ? " 시작" : last ? " 지금" : ""), { "text-anchor": rt ? "end" : "start", "font-size": first || last ? 11 : 9.5, fill: first || last ? c("--ink") : c("--muted"), "font-weight": first || last ? 700 : 400, "paint-order": "stroke", stroke: c("--surface"), "stroke-width": 3 }); } });
      tx(s, r, 310, "재고일수 →", { "text-anchor": "end", "font-size": 10.5, fill: c("--muted") }); tx(s, l, 10, "판매단가 지수", { "font-size": 10.5, fill: c("--muted") });
      $("loop-note").textContent = "재고가 80일을 넘자 단가가 내렸고(오른쪽에서 아래로), 재고가 40일대로 줄자 단가가 올랐으며(왼쪽에서 위로), 단가가 오르자 다시 재고가 쌓이고 있습니다. 한 바퀴가 약 3년이고, '지금' 점은 재고가 다시 80일을 넘은 자리라 다음은 단가 하락 구간일 가능성이 큽니다. 시간 축이 없으므로 화살표와 시점 라벨이 없으면 읽을 수 없습니다.";
    } else {
      const l = 48, r = W - 16, x = lin(0, P.length - 1, l, r);
      [["판매단가 지수", "price", 70, 130, 20, 140, c("--accent")], ["재고일수", "inv", 34, 90, 170, 286, c("--input")]].forEach((q) => { const y = lin(q[2], q[3], q[5], q[4]);
        sv("line", { x1: l, x2: r, y1: q[5], y2: q[5], stroke: c("--ink-2") }, s); tx(s, l, q[4] - 6, q[0], { "font-size": 11, fill: c("--ink"), "font-weight": 700 });
        [q[2], (q[2] + q[3]) / 2, q[3]].forEach((v) => tx(s, l - 6, y(v) + 4, fmt(v), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }));
        sv("path", { d: path(P.map((p, i) => [x(i), y(p[q[1]])])), fill: "none", stroke: q[6], "stroke-width": 2.2 }, s); P.forEach((p, i) => sv("circle", { cx: x(i), cy: y(p[q[1]]), r: 2.8, fill: q[6] }, s)); });
      P.forEach((p, i) => { if (i % (fr.nar ? 4 : 2) === 0) tx(s, x(i), 304, lab(p), { "text-anchor": "middle", "font-size": 10, fill: c("--muted") }); });
      $("loop-note").textContent = "같은 자료를 같은 시간 축의 꺾은선 두 칸으로 그렸습니다. 언제 무슨 일이 있었는지는 이쪽이 읽기 쉽고, 재고의 고점이 단가의 저점보다 두세 분기 앞선다는 시차도 보입니다. 다만 '둘이 고리를 그리며 돈다'는 구조와 지금 그 고리의 어디인지는 연결 산점도가 더 잘 보여 줍니다. 처음 보는 독자에게는 이 그림을 먼저, 순환을 설명할 때는 연결 산점도를 씁니다.";
    }
  }

  /* 7. 능선 */
  function drawRidge() {
    const xs = []; for (let v = 50; v <= 100; v += 0.5) xs.push(v);
    const G = A.samples(A.RIDGE).map((g) => { const k = A.kde(g.v, xs), srt = g.v.slice().sort((a, b) => a - b); return { name: g.name, k: k, med: srt[Math.floor(srt.length / 2)], n: g.v.length }; }).sort((a, b) => a.med - b.med);
    const rowH = 46, H = 40 + G.length * rowH + 30, fr = frame("f-ridge", H, "본부별 평가 점수 분포를 위아래로 겹쳐 그린 능선 그림"), s = fr.svg, W = fr.W, l = fr.nar ? 78 : 110, r = W - 14, x = lin(50, 100, l, r), ymax = Math.max.apply(null, G.map((g) => Math.max.apply(null, g.k.y))), amp = rowH * 1.7;
    [50, 60, 70, 80, 90, 100].forEach((v) => { sv("line", { x1: x(v), x2: x(v), y1: 14, y2: H - 28, stroke: c("--rule-soft") }, s); tx(s, x(v), H - 12, v + "점", { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    G.forEach((g, i) => { const base = 40 + (i + 1) * rowH, pts = xs.map((v, j) => [x(v), base - g.k.y[j] / ymax * amp]);
      sv("path", { d: path(pts) + "L" + x(100) + "," + base + "L" + x(50) + "," + base + "Z", fill: c("--input"), opacity: 0.3, stroke: "none" }, s);
      sv("path", { d: path(pts), fill: "none", stroke: c("--input"), "stroke-width": 1.6 }, s);
      sv("line", { x1: l, x2: r, y1: base, y2: base, stroke: c("--rule") }, s);
      const j = Math.round((g.med - 50) / 0.5); sv("line", { x1: x(g.med), x2: x(g.med), y1: base, y2: base - g.k.y[j] / ymax * amp, stroke: c("--ink"), "stroke-width": 1.4 }, s);
      tx(s, l - 8, base - 4, g.name, { "text-anchor": "end", "font-size": fr.nar ? 10 : 11.5, fill: c("--ink"), "font-weight": 700 });
      tx(s, l - 8, base + 9, "중앙 " + fmt(g.med, 0) + " · " + g.n + "명", { "text-anchor": "end", "font-size": 9.5, fill: c("--muted") }); });
  }

  /* 8. 코드 다이어그램과 행렬 */
  function drawChord() {
    const D = A.FLOW, n = D.names.length, C = A.chord(D, 0.07), fr = frame("f-chord", 320, "계열사 다섯 곳의 내부거래를 원 둘레의 호와 안쪽 띠로 그린 코드 다이어그램"), s = fr.svg, W = fr.W, cx = W / 2, cy = 160, R = Math.min(W / 2 - 46, 118), r0 = R - 12;
    const pal = [c("--total"), c("--input"), c("--accent"), c("--pos"), c("--mark-muted")], pt = (a, rad) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)], arc = (a0, a1, rad, sweep) => { const p = pt(a1, rad); return "A" + rad + "," + rad + " 0 " + (Math.abs(a1 - a0) > Math.PI ? 1 : 0) + " " + sweep + " " + p[0].toFixed(1) + "," + p[1].toFixed(1); };
    C.ribbons.forEach((q) => { const a = pt(q.s.a0, r0), b = pt(q.t.a0, r0), big = q.v >= q.back ? q.i : q.j;
      sv("path", { d: "M" + a[0].toFixed(1) + "," + a[1].toFixed(1) + arc(q.s.a0, q.s.a1, r0, 1) + "Q" + cx + "," + cy + " " + b[0].toFixed(1) + "," + b[1].toFixed(1) + arc(q.t.a0, q.t.a1, r0, 1) + "Q" + cx + "," + cy + " " + a[0].toFixed(1) + "," + a[1].toFixed(1) + "Z", fill: pal[big], opacity: 0.4 }, s); });
    C.groups.forEach((g) => { const a = pt(g.a0, R), b = pt(g.a0, r0), d2 = pt(g.a1, r0), mid = (g.a0 + g.a1) / 2, lp = pt(mid, R + 14);
      sv("path", { d: "M" + a[0].toFixed(1) + "," + a[1].toFixed(1) + arc(g.a0, g.a1, R, 1) + "L" + d2[0].toFixed(1) + "," + d2[1].toFixed(1) + arc(g.a1, g.a0, r0, 0) + "Z", fill: pal[g.i] }, s);
      tx(s, lp[0], lp[1] + 4, D.names[g.i], { "text-anchor": Math.sin(mid) > 0.3 ? "start" : Math.sin(mid) < -0.3 ? "end" : "middle", "font-size": 11.5, fill: c("--ink"), "font-weight": 700 }); });
    /* 행렬 */
    const f2 = frame("f-matrix", 320, "같은 내부거래를 행(파는 회사)과 열(사는 회사)의 칸으로 그린 행렬. 소재가 부품에 판 95억원이 가장 큼"), s2 = f2.svg, W2 = f2.W, l = 58, top = 56, cw = Math.min(56, (W2 - l - 54) / n), ch = 40, mx = Math.max.apply(null, D.m.map((r2) => Math.max.apply(null, r2)));
    tx(s2, l + cw * n / 2, 16, "사는 회사 →", { "text-anchor": "middle", "font-size": 10.5, fill: c("--muted") }); tx(s2, 6, top - 10, "파는 회사 ↓", { "font-size": 10.5, fill: c("--muted") });
    D.names.forEach((nm, j) => tx(s2, l + cw * (j + 0.5), top - 10, nm, { "text-anchor": "middle", "font-size": 11, fill: c("--ink"), "font-weight": 700 }));
    tx(s2, l + cw * n + 8, top - 10, "합계", { "font-size": 10.5, fill: c("--muted") });
    D.m.forEach((row, i) => { tx(s2, l - 8, top + ch * (i + 0.5) + 4, D.names[i], { "text-anchor": "end", "font-size": 11, fill: c("--ink"), "font-weight": 700 });
      row.forEach((v, j) => { const t = v / mx; sv("rect", { x: l + cw * j + 1, y: top + ch * i + 1, width: cw - 2, height: ch - 2, fill: i === j ? c("--rule-soft") : mix(c("--input"), c("--surface"), 0.06 + 0.84 * t), rx: 2 }, s2);
        if (i !== j) tx(s2, l + cw * (j + 0.5), top + ch * (i + 0.5) + 4, fmt(v), { "text-anchor": "middle", "font-size": 11, fill: t > 0.5 ? "#FFFFFF" : c("--ink"), "font-weight": v === mx ? 700 : 400, class: "n" }); });
      tx(s2, l + cw * n + 8, top + ch * (i + 0.5) + 4, fmt(C.groups[i].v), { "font-size": 11, fill: c("--ink-2"), class: "n" }); });
    tx(s2, l - 8, top + ch * n + 18, "합계", { "text-anchor": "end", "font-size": 10.5, fill: c("--muted") });
    C.colSum.forEach((v, j) => tx(s2, l + cw * (j + 0.5), top + ch * n + 18, fmt(v), { "text-anchor": "middle", "font-size": 11, fill: c("--ink-2"), class: "n" }));
    let bi = 0, bj = 0; D.m.forEach((row, i) => row.forEach((v, j) => { if (v > D.m[bi][bj]) { bi = i; bj = j; } }));
    $("chord-note").textContent = "내부거래 합계는 " + fmt(C.total) + "억원이고, 가장 큰 거래는 " + D.names[bi] + " → " + D.names[bj] + " " + fmt(D.m[bi][bj]) + "억원(" + fmt(D.m[bi][bj] / C.total * 100, 0) + "%)입니다. 행렬에서는 가장 진한 칸 하나로 바로 보이고, 열 합계를 보면 가장 많이 사는 회사(" + D.names[C.colSum.indexOf(Math.max.apply(null, C.colSum))] + ")도 읽힙니다. 왼쪽 그림에서 같은 답을 찾아보면 차이를 느낄 수 있습니다.";
  }

  /* 연결 */
  A.PC.items.forEach((it, i) => { const b = F.el("button", { type: "button", text: it.name, "aria-pressed": i === pcSel ? "true" : "false" }); b.addEventListener("click", () => { pcSel = i; drawPC(); }); $("pc-chips").appendChild(b); });
  $("pc-order").addEventListener("click", () => { pcAlt = !pcAlt; $("pc-order").setAttribute("aria-pressed", pcAlt ? "true" : "false"); drawPC(); });
  document.querySelectorAll("#loop-mode button").forEach((b) => b.addEventListener("click", () => { loopMode = b.dataset.m; document.querySelectorAll("#loop-mode button").forEach((q) => q.setAttribute("aria-pressed", q === b ? "true" : "false")); drawLoop(); }));
  function all() { drawSankey(); drawTree(); drawMekko(); drawPC(); drawBubble(); drawLoop(); drawRidge(); drawChord(); }
  all(); F.onRedraw(all);
})();

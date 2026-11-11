/* 제도 노트(tools/rules-note.html)의 표와 그림. 계산은 assets/engines/rules.js */
(function () {
  "use strict";
  const F = window.Fin, R = window.RulesEngine, $ = F.$, NS = "http://www.w3.org/2000/svg";
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  function frame(id, H, label) { const host = $(id); host.textContent = ""; const W = Math.max(280, Math.round(host.clientWidth || 640)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, host), W: W, nar: W < 520 }; }

  /* 공제율 표 */
  (function () {
    const tb = $("rate-tb");
    R.KINDS.forEach((k) => { const tr = F.el("tr"); tr.appendChild(F.el("th", { text: k[1] })); R.SIZES.forEach((s) => tr.appendChild(F.el("td", { text: fmt(R.RATE[k[0]][s[0]], R.RATE[k[0]][s[0]] % 1 ? 1 : 0) + "%" }))); tb.appendChild(tr); });
    const tr = F.el("tr"); tr.appendChild(F.el("th", { text: "추가공제(모든 구분)" }));
    tr.appendChild(F.el("td", { text: "직전 3년 연평균을 넘는 투자액의 " + R.ADD + "%, 기본공제의 " + R.ADD_CAP + "배 한도", colspan: 4 })); tb.appendChild(tr);
    R.KINDS.forEach((k) => $("tx-kind").appendChild(F.el("option", { value: k[0], text: k[1] })));
    R.SIZES.forEach((s) => $("tx-size").appendChild(F.el("option", { value: s[0], text: s[1] })));
    $("tx-kind").value = R.EX.kind; $("tx-size").value = R.EX.size;
  })();

  function drawTax() {
    const p = { inv: +$("tx-i").value, avg3: +$("tx-a").value, kind: $("tx-kind").value, size: $("tx-size").value, cap: +$("tx-c").value, r: +$("tx-r").value };
    const C = R.credit(p), U = R.usage(C.total, p.cap, p.r);
    $("tx-iv").textContent = fmt(p.inv) + "억"; $("tx-av").textContent = fmt(p.avg3) + "억"; $("tx-cv").textContent = fmt(p.cap) + "억/년"; $("tx-rv").textContent = fmt(p.r, 1) + "%";
    const out = $("tx-out"); out.textContent = "";
    out.append("공제율 " + fmt(C.rate, C.rate % 1 ? 1 : 0) + "% → 기본공제 ", F.el("b", { text: fmt(C.base, 1) + "억" }), " + 추가공제 ", F.el("b", { text: fmt(C.add, 1) + "억" }), (C.capped ? "(2배 한도 적용)" : "") + " = 공제액 ", F.el("b", { text: fmt(C.total, 1) + "억원" }), ". ");
    out.append(U.years <= 1 ? "올해 세액으로 모두 쓰므로 현재가치는 " : U.years + "년에 나눠 쓰게 되어 현재가치는 ", F.el("b", { text: fmt(U.pv, 1) + "억원(액면의 " + fmt(U.pvShare * 100, 0) + "%)" }), "입니다.");
    if (U.lost > 1e-9) out.append(" 10년 이월 기간에도 다 못 써 ", F.el("b", { text: fmt(U.lost, 1) + "억원" }), "이 소멸합니다.");
    out.append(" 투자액 대비 실질 지원은 " + fmt(U.pv / p.inv * 100, 1) + "%입니다.");

    const fr = frame("tx-fig", 240, "연도별 공제 사용액과 누적 현재가치"), s = fr.svg, l = 44, r = fr.W - 14, n = U.rows.length, x = lin(0.5, n + 0.5, l, r), bw = (r - l) / n * 0.62;
    const top = Math.max(C.total, 1) * 1.08, y = lin(0, top, 196, 14);
    F.niceTicks(0, top, 4).ticks.filter((v) => v <= top).forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, s); tx(s, l - 6, y(v) + 4, fmt(v), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
    sv("line", { x1: l, x2: r, y1: y(C.total), y2: y(C.total), stroke: c("--ink-2"), "stroke-dasharray": "5 4" }, s);
    tx(s, r, y(C.total) - 5, "공제액 " + fmt(C.total, 1), { "text-anchor": "end", "font-size": 10.5, fill: c("--ink-2") });
    let cum = 0; const pts = [];
    U.rows.forEach((q) => { cum += q.pv; pts.push([x(q.t), y(cum)]);
      if (q.use > 1e-9) sv("rect", { x: x(q.t) - bw / 2, y: y(q.use), width: bw, height: y(0) - y(q.use), fill: q.t === 1 ? c("--input") : c("--mark-muted"), rx: 2 }, s);
      tx(s, x(q.t), 212, (fr.nar && q.t % 2 === 0) ? "" : (q.t === 1 ? "투자 연도" : "+" + (q.t - 1)), { "text-anchor": "middle", "font-size": 10, fill: c("--muted") }); });
    sv("path", { d: "M" + pts.map((p2) => p2[0].toFixed(1) + "," + p2[1].toFixed(1)).join("L"), fill: "none", stroke: c("--pos"), "stroke-width": 2.2 }, s);
    pts.forEach((p2, i) => { if (U.rows[i].use > 1e-9) sv("circle", { cx: p2[0], cy: p2[1], r: 3, fill: c("--pos") }, s); });
    tx(s, pts[pts.length - 1][0], pts[pts.length - 1][1] - 7, "누적 현재가치 " + fmt(U.pv, 1), { "text-anchor": "end", "font-size": 10.5, fill: c("--pos"), "font-weight": 700 });
    tx(s, r, 232, "막대: 그해 공제 사용액(억원) · 가로축: 투자 연도 이후 경과 연수", { "text-anchor": "end", "font-size": 10, fill: c("--muted") });
  }

  function drawEsg() {
    const fr = frame("esg-fig", fr0(), "2026년부터 2033년까지 지속가능성 공시 일정"), s = fr.svg, W = fr.W;
    function fr0() { const w = Math.round(($("esg-fig").clientWidth || 640)); return w < 520 ? 540 : 290; }
    const kcol = { plan: c("--mark-muted"), start: c("--input"), check: c("--accent"), scope3: c("--pos") };
    if (!fr.nar) {
      const l = 30, r = W - 30, x = lin(2026, 2033, l, r), axisY = 128;
      sv("line", { x1: l, x2: r, y1: axisY, y2: axisY, stroke: c("--ink-2"), "stroke-width": 1.5 }, s);
      for (let yv = 2026; yv <= 2033; yv++) { sv("line", { x1: x(yv), x2: x(yv), y1: axisY - 4, y2: axisY + 4, stroke: c("--ink-2") }, s); tx(s, x(yv), axisY + 20, String(yv), { "text-anchor": "middle", "font-size": 11, fill: c("--ink"), "font-weight": 700, class: "n" }); }
      sv("rect", { x: x(2028), y: axisY - 9, width: x(2031) - x(2028), height: 5, fill: c("--accent"), opacity: 0.35, rx: 2 }, s);
      tx(s, (x(2028) + x(2031)) / 2, axisY - 14, "초기 3년 포괄 면책", { "text-anchor": "middle", "font-size": 10, fill: c("--muted") });
      const up = { 2026: 0, 2028: 1, 2029: 0, 2030: 1, 2031: 0, 2032: 1, 2033: 0 }, bw = Math.min(170, (r - l) / 4.2);
      R.ESG.forEach((e) => {
        const cx = x(e.y), isUp = up[e.y] === 1, yy = isUp ? 8 : axisY + 34, col = kcol[e.k];
        sv("line", { x1: cx, x2: cx, y1: isUp ? 68 : axisY + 6, y2: isUp ? axisY - 18 : axisY + 34, stroke: col, "stroke-dasharray": "3 3" }, s);
        sv("circle", { cx: cx, cy: axisY, r: 5, fill: col, stroke: c("--surface"), "stroke-width": 2 }, s);
        const bx = Math.max(l - 20, Math.min(r + 20 - bw, cx - bw / 2));
        sv("rect", { x: bx, y: yy, width: bw, height: 60, rx: 4, fill: c("--surface"), stroke: col }, s);
        wrap(s, bx + 8, yy + 16, e.t, bw - 16, 3, { "font-size": 10.5, fill: c("--ink"), "font-weight": 600 });
      });
    } else {
      R.ESG.forEach((e, i) => {
        const yy = 8 + i * 76, col = kcol[e.k];
        sv("line", { x1: 30, x2: 30, y1: yy, y2: yy + 76, stroke: c("--rule") }, s);
        sv("circle", { cx: 30, cy: yy + 12, r: 5, fill: col }, s);
        tx(s, 4, yy + 16, String(e.y).slice(2), { "font-size": 10.5, fill: c("--ink"), "font-weight": 700, class: "n" });
        wrap(s, 44, yy + 16, e.y + " · " + e.t, W - 52, 2, { "font-size": 11, fill: c("--ink"), "font-weight": 600 });
        if (e.s) wrap(s, 44, yy + 46, e.s, W - 52, 2, { "font-size": 10, fill: c("--muted") });
      });
    }
  }
  /* 글자 폭을 어림해 줄바꿈 */
  function wrap(svg, x, y, str, w, maxLines, attrs) {
    const fs = attrs["font-size"] || 11, per = Math.max(4, Math.floor(w / (fs * 0.92))), words = str.split(" "), lines = []; let cur = "";
    words.forEach((wd) => { const t = cur ? cur + " " + wd : wd; if (t.length > per && cur) { lines.push(cur); cur = wd; } else cur = t; });
    if (cur) lines.push(cur);
    lines.slice(0, maxLines).forEach((ln, i) => { let t = ln; if (i === maxLines - 1 && lines.length > maxLines) t = ln.slice(0, per - 1) + "…"; tx(svg, x, y + i * (fs + 4), t, attrs); });
  }

  function all() { drawTax(); drawEsg(); }
  all();
  ["tx-i", "tx-a", "tx-c", "tx-r", "tx-kind", "tx-size"].forEach((id) => { $(id).addEventListener("input", drawTax); $(id).addEventListener("change", drawTax); });
  F.onRedraw(all);
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "계획" }, { x: 0.90, y: 0.18, label: "세금" }, { x: 0.90, y: 0.50, label: "통제" }, { x: 0.90, y: 0.82, label: "공시" }],
      links: [{ from: 0, to: 1, bend: -0.08, c: 0, n: 14, label: "공제" }, { from: 0, to: 2, bend: 0, c: 1, n: 14, label: "내부회계" }, { from: 0, to: 3, bend: 0.08, c: 2, n: 14, label: "ESG" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

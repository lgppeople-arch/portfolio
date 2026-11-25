/* 아이디어 노트 화면(tools/idea-*.html). 자료는 assets/engines/ideas.js. 페이지의 <body data-cat="vibe|stats|bold">로 묶음을 고른다 */
(function () {
  "use strict";
  const F = window.Fin, X = window.Ideas, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!X) return;
  const c = (n) => F.css(n), el = F.el;
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const cat = document.body.getAttribute("data-cat"), list = X.byCat(cat), num = {};
  list.forEach((x, i) => { num[x.id] = i + 1; });
  let tag = "", sort = "order";
  const riskCol = (r) => (r >= 4 ? c("--neg") : r === 3 ? c("--accent") : c("--pos"));

  /* ---------- 다른 묶음으로 가기 ---------- */
  (function () { const h = $("cat-nav"); Object.keys(X.CATS).forEach((k) => { const a = el("a", { href: X.CATS[k].file, text: X.CATS[k].name + " (" + X.byCat(k).length + ")", class: k === cat ? "on" : null }); if (k === cat) a.setAttribute("aria-current", "page"); h.appendChild(a); }); })();

  /* ---------- 조작부 ---------- */
  (function () {
    const tags = Array.from(new Set([].concat.apply([], list.map((x) => x.tags))));
    const box = $("tag-box"); const mk = (t, lab) => { const b = el("button", { type: "button", text: lab, "aria-pressed": t === tag ? "true" : "false" }); b.addEventListener("click", () => { tag = t; box.querySelectorAll("button").forEach((q) => q.setAttribute("aria-pressed", q === b ? "true" : "false")); draw(); }); box.appendChild(b); };
    mk("", "전체"); tags.forEach((t) => mk(t, t));
    $("sort-sel").addEventListener("change", (e) => { sort = e.target.value; draw(); });
  })();

  /* ---------- 2×2 지도 ---------- */
  function drawMatrix(items) {
    const host = $("f-mx"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), nar = W < 560, H = nar ? 340 : 360, l = 40, r2 = W - 14, top = 14, bot = H - 40;
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "group", "aria-label": "아이디어 지도: 실행 용이성(가로)과 효과(세로), 원 크기는 AI 기여, 색은 위험. 번호를 누르면 해당 카드로 이동" }, host);
    const x = lin(0.5, 5.5, l, r2), y = lin(0.5, 5.5, bot, top), mx = x(3), my = y(3);
    sv("rect", { x: mx, y: top, width: r2 - mx, height: my - top, fill: c("--pos"), opacity: 0.06 }, s);
    [["바로 해 볼 것", r2 - 4, top + 14, "end"], ["크게 준비할 것", l + 4, top + 14, "start"], ["작게 시험할 것", r2 - 4, bot - 6, "end"], ["미룰 것", l + 4, bot - 6, "start"]].forEach((q) => tx(s, q[1], q[2], q[0], { "text-anchor": q[3], "font-size": 10.5, fill: c("--muted"), "font-weight": 600 }));
    sv("line", { x1: mx, x2: mx, y1: top, y2: bot, stroke: c("--rule") }, s); sv("line", { x1: l, x2: r2, y1: my, y2: my, stroke: c("--rule") }, s);
    for (let v = 1; v <= 5; v++) { tx(s, x(v), bot + 16, String(v), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); tx(s, l - 8, y(v) + 4, String(v), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); }
    tx(s, r2, bot + 32, "실행 용이성 → (5 = 쉬움)", { "text-anchor": "end", "font-size": 10.5, fill: c("--muted") }); tx(s, l, top - 2, "효과 ↑", { "font-size": 10.5, fill: c("--muted") });
    const cells = {}; items.forEach((it) => { const k = it.ease + "_" + it.impact; (cells[k] = cells[k] || []).push(it); });
    Object.keys(cells).forEach((k) => { const g = cells[k]; g.forEach((it, i) => { const px = x(it.ease) + (i - (g.length - 1) / 2) * (nar ? 22 : 30), py = y(it.impact), r = 6 + it.ai * (nar ? 1.6 : 2.2);
      const a = sv("a", { href: "#idea-" + it.id, "aria-label": num[it.id] + "번 " + it.title + " (효과 " + it.impact + ", 용이성 " + it.ease + ", 위험 " + it.risk + ")" }, s);
      sv("circle", { cx: px, cy: py, r: r, fill: riskCol(it.risk), opacity: 0.3, stroke: riskCol(it.risk), "stroke-width": 1.6 }, a);
      tx(a, px, py + 4, String(num[it.id]), { "text-anchor": "middle", "font-size": 10.5, "font-weight": 700, fill: c("--ink"), class: "n" }); }); });
  }

  /* ---------- 카드 ---------- */
  function card(it) {
    const d = el("details", { class: "idea", id: "idea-" + it.id });
    const sm = el("summary");
    sm.appendChild(el("span", { class: "inum", text: String(num[it.id]).padStart(2, "0") }));
    const hd = el("span", { class: "ihd" }); hd.appendChild(el("b", { text: it.title })); hd.appendChild(el("span", { class: "ione", text: it.one })); sm.appendChild(hd);
    const sc = el("span", { class: "isc" });
    [["impact", "효과"], ["ease", "용이"], ["ai", "AI"], ["risk", "위험"]].forEach((q) => { const b = el("span", { class: "pill-s" + (q[0] === "risk" && it.risk >= 4 ? " hot" : ""), text: q[1] + " " + it[q[0]] }); sc.appendChild(b); });
    sm.appendChild(sc); d.appendChild(sm);
    const body = el("div", { class: "ibody" });
    const row = (k, v) => { const r = el("div", { class: "irow" }); r.appendChild(el("span", { class: "ik", text: k })); r.appendChild(el("p", { text: v })); body.appendChild(r); };
    row("문제", it.why); row("아이디어", it.how); row("AI가 바꾸는 점", it.aiHow);
    row("회사에서 어려운 이유", it.barrier); row("통제·법규", it.guard);
    const fr = el("div", { class: "irow" }); fr.appendChild(el("span", { class: "ik", text: "첫 2주" })); const ol = el("ol"); it.first.forEach((t) => ol.appendChild(el("li", { text: t }))); fr.appendChild(ol); body.appendChild(fr);
    row("성공 판단 지표", it.kpi);
    const lk = el("div", { class: "irow" }); lk.appendChild(el("span", { class: "ik", text: "이어서 볼 것" })); const p = el("p");
    it.links.forEach((q, i) => { if (i) p.appendChild(document.createTextNode(" · ")); p.appendChild(el("a", { href: q[0], text: q[1] })); }); lk.appendChild(p); body.appendChild(lk);
    d.appendChild(body);
    return d;
  }
  function draw() {
    let items = list.filter((x) => !tag || x.tags.indexOf(tag) >= 0);
    if (sort === "prio") { const pr = {}; X.rank(cat).forEach((q) => { pr[q.x.id] = q.p; }); items = items.slice().sort((a, b) => pr[b.id] - pr[a.id]); }
    else if (sort !== "order") items = items.slice().sort((a, b) => (sort === "risk" ? a.risk - b.risk : b[sort] - a[sort]) || num[a.id] - num[b.id]);
    drawMatrix(items);
    const host = $("ideas"); host.textContent = ""; items.forEach((it) => host.appendChild(card(it)));
    $("board-out").textContent = items.length + "개 표시 · 우선순위 점수 상위 3: " + X.rank(cat).filter((q) => items.indexOf(q.x) >= 0).slice(0, 3).map((q) => num[q.x.id] + " " + q.x.title).join(" / ");
  }
  draw(); F.onRedraw(() => drawMatrix(list.filter((x) => !tag || x.tags.indexOf(tag) >= 0)));
  if (location.hash.indexOf("#idea-") === 0) { const t = document.querySelector(location.hash); if (t) t.open = true; }
  document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest('a[href^="#idea-"]'); if (a) { const t = document.querySelector(a.getAttribute("href")); if (t) t.open = true; } });
  if (window.Report) {
    const L = { vibe: ["문제", "코드", "검증", "도구"], stats: ["데이터", "모형", "검증", "판단"], bold: ["기회", "규칙", "통제", "실행"] }[cat] || ["문제", "아이디어", "통제", "실행"];
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: L[0] }, { x: 0.90, y: 0.22, label: L[1] }, { x: 0.90, y: 0.50, label: L[2] }, { x: 0.90, y: 0.78, label: L[3] }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "AI" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "숫자" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 12, label: "사람" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

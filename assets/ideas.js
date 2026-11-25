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
    body.appendChild(costRow(it));
    const lk = el("div", { class: "irow" }); lk.appendChild(el("span", { class: "ik", text: "이어서 볼 것" })); const p = el("p");
    it.links.forEach((q, i) => { if (i) p.appendChild(document.createTextNode(" · ")); p.appendChild(el("a", { href: q[0], text: q[1] })); }); lk.appendChild(p); body.appendChild(lk);
    d.appendChild(body);
    return d;
  }
  /* ---------- 비용 ---------- */
  const opt = {};
  const won = (v) => (v >= 1e8 ? (v / 1e8).toFixed(v >= 1e9 ? 0 : 1) + "억" : Math.round(v / 1e4).toLocaleString() + "만");
  const tok = (v) => (v >= 1 ? v.toLocaleString() : String(v)) + "M";
  function useLine(c) {
    const P = X.PRICES, t = X.TIERS[X.tierOf(c)];
    return "좌석 " + c.u + "개(그중 고급 " + c.prem + "), API 월 입력 " + tok(c.tin) + "·출력 " + tok(c.tout) + " 토큰(" + P.apiName[c.model] + " 모델), 개발 " + c.dev + "주, 유지보수 월 " + c.ops + "시간. "
      + "사내 구축 시 " + t.name + (c.tier === "-" ? "(실행에는 언어 모델이 필요 없고 코드 작성 보조용)" : "") + ". 데이터: " + X.SENS[c.sens] + ". " + c.use + ".";
  }
  function costRow(it) {
    const c = X.COST[it.id], a = X.costA(c, opt), b = X.costB(c, opt), ad = X.advise(c, opt);
    const r = el("div", { class: "irow" }); r.appendChild(el("span", { class: "ik", text: "비용(추정)" }));
    const w = el("div");
    const tb = el("table", { class: "mini", "aria-label": it.title + " 비용 추정(원)" });
    tb.innerHTML = "<thead><tr><th scope='col'>원</th><th scope='col'>외부 AI</th><th scope='col'>사내 구축(" + X.TIERS[b.tier].name + ")</th></tr></thead><tbody>"
      + [["초기", a.init, b.init], ["연간 운영", a.run, b.run], ["3년 합계", a.tco3, b.tco3]].map((q) => "<tr><th scope='row'>" + q[0] + "</th><td class='n'>" + won(q[1]) + "</td><td class='n'>" + won(q[2]) + "</td></tr>").join("") + "</tbody>";
    w.appendChild(tb);
    w.appendChild(el("p", { class: "cuse", text: useLine(c) }));
    w.appendChild(el("p", { class: "cadv", text: "권고: " + (ad.pick === "A" ? "외부 AI" : "사내 구축") + ". " + ad.why }));
    r.appendChild(w); return r;
  }
  function drawCost() {
    if (!$("cost-tb")) return;
    const ids = list.map((x) => x.id), B = X.bundle(ids, opt), T = X.TIERS[B.B.tier];
    /* 표 */
    let h = "<thead><tr><th scope='col'>아이디어</th><th scope='col'>데이터</th><th scope='col'>외부 AI 초기</th><th scope='col'>연간</th><th scope='col'>3년</th><th scope='col'>사내 구축 등급</th><th scope='col'>초기</th><th scope='col'>연간</th><th scope='col'>3년</th><th scope='col'>권고</th></tr></thead><tbody>";
    list.forEach((it) => { const c = X.COST[it.id], a = X.costA(c, opt), b = X.costB(c, opt), ad = X.advise(c, opt);
      h += "<tr><th scope='row'><a href='#idea-" + it.id + "'>" + num[it.id] + ". " + it.title + "</a></th><td>" + X.SENS[c.sens] + "</td><td class='n'>" + won(a.init) + "</td><td class='n'>" + won(a.run) + "</td><td class='n'><b>" + won(a.tco3) + "</b></td><td>" + X.TIERS[b.tier].name + "</td><td class='n'>" + won(b.init) + "</td><td class='n'>" + won(b.run) + "</td><td class='n'><b>" + won(b.tco3) + "</b></td><td>" + (ad.pick === "A" ? "외부 AI" : "사내 구축") + "</td></tr>"; });
    h += "<tr class='tot'><th scope='row'>" + list.length + "개 함께(좌석·서버 공유)</th><td></td><td class='n'>" + won(B.A.init) + "</td><td class='n'>" + won(B.A.run) + "</td><td class='n'><b>" + won(B.A.tco3) + "</b></td><td>" + T.name + " 1대</td><td class='n'>" + won(B.B.init) + "</td><td class='n'>" + won(B.B.run) + "</td><td class='n'><b>" + won(B.B.tco3) + "</b></td><td></td></tr></tbody>";
    $("cost-tb").setAttribute("aria-label", "아이디어별 비용 비교(원)"); $("cost-tb").innerHTML = h;
    const be = B.breakeven;
    $("cost-out").textContent = list.length + "개를 함께 하면 3년 비용은 외부 AI " + won(B.A.tco3) + "원, 사내 구축(" + T.name + " 서버 1대 공유) " + won(B.B.tco3) + "원입니다. "
      + (be > 1 ? "API 사용량이 지금 가정의 " + Math.ceil(be) + "배가 되어야 두 방식의 3년 비용이 같아집니다." : "지금 사용량에서는 사내 구축이 더 쌉니다.");
    /* 3년 비용 구성 막대 */
    const host = $("f-cost"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), nar = W < 560, lw = nar ? 64 : 92, r2 = W - (nar ? 54 : 70), H = 150;
    const parts = [
      ["개발·구축·검토 인건비", c("--input"), B.A.dev + B.A.review, B.B.dev + B.B.setup],
      ["구독 좌석", c("--accent"), 3 * B.A.seats, 0],
      ["API 사용료", "color-mix(in srgb, " + c("--accent") + " 45%, " + c("--surface") + ")", 3 * B.A.api, 0],
      ["서버 구입", c("--violet"), 0, B.B.hw],
      ["전력·하드웨어 유지보수", c("--mark-muted"), 0, 3 * (B.B.power + B.B.maint)],
      ["운영 인력", c("--pos"), 0, 3 * B.B.staff],
      ["도구 유지보수 인건비", c("--total"), 3 * B.A.labor, 3 * B.B.labor]];
    const mx = Math.max(B.A.tco3, B.B.tco3), x = (v) => lw + v / mx * (r2 - lw);
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "3년 비용 구성: 외부 AI " + won(B.A.tco3) + "원, 사내 구축 " + won(B.B.tco3) + "원" }, host);
    [["외부 AI", 2], ["사내 구축", 3]].forEach((row, i) => { const y = 22 + i * 58; let acc = 0;
      tx(s, lw - 8, y + 21, row[0], { "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: c("--ink") });
      parts.forEach((q) => { const v = q[row[1]]; if (v <= 0) return; sv("rect", { x: x(acc), y: y, width: Math.max(1, x(acc + v) - x(acc)), height: 32, fill: q[1] }, s); acc += v; });
      tx(s, x(acc) + 6, y + 21, won(acc), { "font-size": 12, "font-weight": 700, fill: c("--ink"), class: "n" }); });
    const lg = $("cost-lgd"); lg.textContent = "";
    parts.forEach((q) => { const sp = el("span"); const sw = el("i"); sw.style.background = q[1]; sp.appendChild(sw); sp.appendChild(document.createTextNode(q[0])); lg.appendChild(sp); });
    $("cost-note").textContent = "사내 구축은 " + T.name + "(" + T.desc + ") 한 대를 " + list.length + "개 아이디어가 나눠 쓴다고 보았습니다. 서버 값은 3년 합계에 전액 넣었고, 회계상으로는 " + X.PRICES.life + "년에 나눠 연 " + won(B.B.dep) + "원씩 감가상각됩니다. 외부 AI 좌석은 같은 팀이 쓰므로 가장 많이 필요한 아이디어 기준(" + B.seatsU + "개)으로 셌습니다.";
  }
  (function () {
    const h = $("cost-ctl"); if (!h) return;
    const P = X.PRICES;
    const F = [["fx", "환율(원/달러)", 1200, 1600, 10, P.fx, (v) => v.toLocaleString()],
      ["finYear", "재무 담당자 연 인건비", 5000e4, 12000e4, 500e4, P.finYear, (v) => won(v) + "원"],
      ["engYear", "인프라 엔지니어 연 인건비", 8000e4, 20000e4, 500e4, P.engYear, (v) => won(v) + "원"],
      ["util", "GPU 연평균 가동률", 0.1, 0.9, 0.05, P.util, (v) => Math.round(v * 100) + "%"],
      ["devMul", "공개 모델 개발 기간 배수", 1, 2.5, 0.1, P.devMul, (v) => v.toFixed(1) + "배"],
      ["apiMul", "API 사용량 배수", 1, 50, 1, P.apiMul, (v) => v + "배"]];
    F.forEach((f) => { const lab = el("label", { class: "rg" }); const sp = el("span", { text: f[1] + " " }); const b = el("b", { text: f[6](f[5]) }); sp.appendChild(b);
      const inp = el("input", { type: "range", min: f[2], max: f[3], step: f[4], value: f[5], "aria-label": f[1] });
      inp.addEventListener("input", () => { const v = Number(inp.value); opt[f[0]] = v; b.textContent = f[6](v); drawCost(); draw(); });
      lab.appendChild(sp); lab.appendChild(inp); h.appendChild(lab); });
    const src = $("cost-src"); if (src) {
      const T = X.TIERS, a = P.api;
      src.innerHTML = "<p><b>외부 AI</b>: 초기 = 개발 주 × 담당자 주당 인건비(연 인건비 ÷ " + P.weeks + "주). 연간 = 좌석(표준 $" + P.seatStd + "·고급 $" + P.seatPrem + "/월, 연간 결제) × 12 + API 토큰 사용료 × 12 + 유지보수 시간 × 시간당 인건비 × 12. 여러 아이디어를 함께 하면 보안·계약 검토(엔지니어 " + P.reviewWk + "주)를 한 번 더합니다. API 단가(100만 토큰당 입력/출력): 최상위급 $" + a.opus.join("/$") + ", 중간급 $" + a.sonnet.join("/$") + ", 경량급 $" + a.haiku.join("/$") + "(Claude API 기준. OpenAI 공식 요금표의 최상위 모델도 입력 $5·출력 $30으로 같은 범위).</p>"
        + "<p><b>사내 구축</b>: 초기 = 서버 + 구축(엔지니어 주) + 개발 주 × 배수 × 담당자 주당 인건비. 연간 = 전력(kW × 8,760시간 × 가동률 × 냉방 배수 " + P.pue + " × " + P.elec + "원/kWh) + 하드웨어 유지보수(서버값의 " + Math.round(P.hwMaint * 100) + "%) + 운영 인력(엔지니어 인건비 × 비율) + 도구 유지보수 인건비.</p>"
        + "<p><b>서버 등급</b>: " + Object.keys(T).map((k) => T[k].name + " $" + T[k].hw.toLocaleString() + ", " + T[k].kw + "kW, 구축 " + T[k].setupWk + "주, 운영 인력 " + T[k].fte + "명 — " + T[k].desc).join(" / ") + ".</p>"
        + "<p><b>빠진 것</b>: 기업용(Enterprise) 플랜은 요금이 공개되지 않아 팀 플랜 가격을 썼습니다. 서버실 공간·네트워크·백업, 공개 모델 라이선스 검토, 외부 AI의 데이터 보관 계약 협상 비용은 넣지 않았습니다. 사용량·개발 기간은 작성자의 가정입니다.</p>"
        + "<p><b>출처</b>(2026.11.25 확인): " + X.PRICE_SRC.map((q) => "<a href='" + q[1] + "' rel='noopener'>" + q[0] + "</a>").join(" · ") + ".</p>";
    }
  })();
  function draw() {
    let items = list.filter((x) => !tag || x.tags.indexOf(tag) >= 0);
    if (sort === "prio") { const pr = {}; X.rank(cat).forEach((q) => { pr[q.x.id] = q.p; }); items = items.slice().sort((a, b) => pr[b.id] - pr[a.id]); }
    else if (sort !== "order") items = items.slice().sort((a, b) => (sort === "risk" ? a.risk - b.risk : b[sort] - a[sort]) || num[a.id] - num[b.id]);
    drawMatrix(items);
    const host = $("ideas"); host.textContent = ""; items.forEach((it) => host.appendChild(card(it)));
    $("board-out").textContent = items.length + "개 표시 · 우선순위 점수 상위 3: " + X.rank(cat).filter((q) => items.indexOf(q.x) >= 0).slice(0, 3).map((q) => num[q.x.id] + " " + q.x.title).join(" / ");
  }
  draw(); drawCost(); F.onRedraw(() => { drawMatrix(list.filter((x) => !tag || x.tags.indexOf(tag) >= 0)); drawCost(); });
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

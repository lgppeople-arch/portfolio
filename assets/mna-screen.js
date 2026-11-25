/* 경영권 거래 후보 스크리닝 화면(tools/mna-screen.html). 자료 assets/data/mna-screen.js, 계산 assets/engines/mnascreen.js */
(function () {
  "use strict";
  const F = window.Fin, D = window.MNA_DATA, M = window.MnaScreen, $ = F.$, el = F.el, c = (n) => F.css(n), NS = "http://www.w3.org/2000/svg";
  if (!D || !M) return;
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const eok = (v) => (v == null ? "–" : Math.abs(v) >= 1e12 ? (v / 1e12).toFixed(2) + "조" : Math.round(v / 1e8).toLocaleString() + "억");
  const pc = (v, d) => (v == null ? "–" : (v * 100).toFixed(d == null ? 1 : d) + "%");
  const xx = (v) => (v == null ? "–" : v.toFixed(1) + "배");
  const A = M.candidates(D, 20);
  let sel = A[0] && A[0].id;

  /* ---------- 요약 ---------- */
  (function () {
    const m = D.meta, top = A.slice(0, 20), med = (a) => { const s = a.filter((v) => v != null).sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : null; };
    $("m-univ").textContent = "상장사 " + m.universe.toLocaleString() + "곳";
    const d0 = M.deal(top[0], { prem: 0.3, mode: "majority" });
    const items = [
      ["거름망을 다 통과한 회사는 " + m.nA + "곳", "금융업을 뺀 상장사 " + m.universe.toLocaleString() + "곳 중 현금흐름·지분까지 확인한 " + m.deep + "곳에서, 2년 연속 흑자·시가총액 1,000억~3조·최대주주 등 지분 35% 미만을 모두 만족한 회사입니다."],
      ["상위 20곳의 중간값: EV/EBIT " + xx(med(top.map((x) => x.evebit))) + ", 최대주주 지분 " + pc(med(top.map((x) => x.grp))), "영업이익 몇 년치로 회사 전체(빚 포함)를 살 수 있는가가 한 자릿수입니다. 순현금이 시가총액의 " + pc(med(top.map((x) => x.netcash)), 0) + "(중간값)라 인수 뒤 회수할 현금도 있습니다."],
      ["1위 후보 과반 확보 비용: " + eok(d0.cost) + "원(프리미엄 30%)", top[0].name + " 기준. 프리미엄을 얹은 인수가로도 EV/EBIT " + xx(d0.evebitAtPrem) + "입니다. 다만 대주주의 우호 지분 결집, 의무공개매수 입법 여부가 실제 성패를 가릅니다."]
    ];
    items.forEach((q) => { const d = el("div"); d.appendChild(el("b", { text: q[0] })); d.appendChild(el("p", { text: q[1] })); $("tk").appendChild(d); });
    $("funnel").textContent = "상장사(시가총액 741억 원 이상, 우선주·스팩·리츠 제외) " + m.listed.toLocaleString() + "곳 → 금융업을 빼고 2025 사업보고서 주요 계정이 있는 " + m.universe.toLocaleString() + "곳의 1차 점수 → 상위 " + m.deep + "곳 정밀 조회(전체 재무제표, 최대주주·자기주식·5% 보유자) → 경영권 거래 거름망 통과 " + m.nA + "곳, 볼트온 후보군 " + m.nB + "곳.";
  })();

  /* ---------- 시장 지도 ---------- */
  function drawMap() {
    const host = $("f-map"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), nar = W < 560, H = nar ? 320 : 380, l = 44, r2 = W - 12, top = 12, bot = H - 40;
    const x = lin(0, 0.8, l, r2), y = lin(0, 25, bot, top);
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "회사별 최대주주 등 지분과 EV/EBIT 산점도. 왼쪽 아래(지분 35% 미만, EV/EBIT 8배 이하)가 후보 영역" }, host);
    sv("rect", { x: x(0), y: y(8), width: x(0.35) - x(0), height: y(0) - y(8), fill: c("--accent"), opacity: 0.08 }, s);
    tx(s, x(0.35) - 6, y(8) + 14, "후보 영역", { "text-anchor": "end", "font-size": 11, fill: c("--accent"), "font-weight": 700 });
    [0, 0.2, 0.4, 0.6, 0.8].forEach((v) => { sv("line", { x1: x(v), x2: x(v), y1: top, y2: bot, stroke: c("--rule-soft") }, s); tx(s, x(v), bot + 16, Math.round(v * 100) + "%", { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    [0, 5, 10, 15, 20, 25].forEach((v) => { sv("line", { x1: l, x2: r2, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, s); tx(s, l - 6, y(v) + 4, v + "배", { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
    tx(s, r2, bot + 32, "최대주주와 특수관계인 지분 →", { "text-anchor": "end", "font-size": 10.5, fill: c("--muted") });
    D.dots.forEach((d) => { if (d[1] == null || d[2] == null) return; const px = x(Math.min(0.8, d[1])), py = y(Math.min(25, d[2])), r = Math.max(2.5, Math.min(9, Math.sqrt(d[3]) / 18));
      sv("circle", { cx: px, cy: py, r: r, fill: d[4] ? c("--accent") : c("--mark-muted"), opacity: d[4] ? 0.85 : 0.35 }, s); });
    $("map-note").textContent = "정밀 조회한 " + D.dots.length + "곳(반도체·반도체 장비·지주회사 제외). 주황 점이 점수 상위 20곳입니다. EV/EBIT 25배 이상과 지분 80% 이상은 가장자리에 모아 그렸습니다. 대부분의 회사는 대주주 지분 30~60%에 몰려 있어, 왼쪽 아래 영역은 드뭅니다.";
  }

  /* ---------- 후보 표 ---------- */
  (function () {
    let h = "<thead><tr><th scope='col'>#</th><th scope='col'>회사</th><th scope='col'>업종</th><th scope='col'>시가총액</th><th scope='col'>EV/EBIT</th><th scope='col'>FCF 수익률</th><th scope='col'>PBR</th><th scope='col'>매출 성장(2년)</th><th scope='col'>영업이익률</th><th scope='col'>최대주주 등</th><th scope='col'>순현금/시총</th><th scope='col'>점수</th></tr></thead><tbody>";
    A.forEach((x, i) => { h += "<tr><td class='n'>" + (i + 1) + "</td><th scope='row'><a href='#s-plan' data-co='" + x.id + "'>" + x.name + "</a> <small class='muted'>" + x.mkt + "</small></th><td>" + x.group + "</td><td class='n'>" + eok(x.mcap) + "</td><td class='n'>" + xx(x.evebit) + "</td><td class='n'>" + pc(x.fcfy) + "</td><td class='n'>" + (x.pbr || 0).toFixed(2) + "</td><td class='n'>" + pc(x.cagr) + "</td><td class='n'>" + pc(x.opm) + "</td><td class='n'>" + pc(x.grp) + "</td><td class='n'>" + pc(x.netcash, 0) + "</td><td class='n'><b>" + Math.round(x.sA.total * 100) + "</b></td></tr>"; });
    $("a-tb").innerHTML = h + "</tbody>";
    $("a-tb").addEventListener("click", (e) => { const a = e.target.closest("a[data-co]"); if (a) { sel = a.getAttribute("data-co"); $("p-co").value = sel; drawPlan(); } });
  })();

  /* ---------- 추진안 ---------- */
  (function () {
    const s = $("p-co"); A.forEach((x, i) => s.appendChild(el("option", { value: x.id, text: (i + 1) + ". " + x.name })));
    s.addEventListener("change", () => { sel = s.value; drawPlan(); });
    $("p-mode").addEventListener("change", drawPlan);
    $("p-prem").addEventListener("input", () => { $("p-prem-v").textContent = Math.round($("p-prem").value * 100) + "%"; drawPlan(); });
    $("p-lev").addEventListener("input", () => { $("p-lev-v").textContent = Number($("p-lev").value).toFixed(1) + "배"; drawPlan(); });
  })();
  function drawPlan() {
    const co = Object.assign({ id: sel }, D.cos[sel]), prem = Number($("p-prem").value), mode = $("p-mode").value, lev = Number($("p-lev").value);
    const d = M.deal(co, { prem: prem, mode: mode }), f = M.funding(co, d, lev), g = M.groupStake(co);
    $("p-out").textContent = co.name + ": 최대주주 " + (co.top || "–") + " 측 의결권 " + pc(g) + ", 자기주식 " + pc(co.treR) + ". 목표 " + pc(d.stake) + "를 사려면 " + d.shares.toLocaleString() + "주 × " + Math.round(d.px).toLocaleString() + "원 = " + eok(d.cost) + "원" + (d.feasible ? "." : " — 최대주주 측을 뺀 유통 주식(" + pc(d.floatPct) + ")보다 많아 대주주 동의 없이는 불가능합니다.");
    /* 지분 막대: 최대주주 측 | 다른 5% | 나머지(공개매수 대상) | 목표선 */
    const host = $("f-own"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), l = 14, r2 = W - 14, H = 92, x = lin(0, 1, l, r2);
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "의결권 지분 구성과 목표 지분 " + pc(d.stake) }, host);
    const others = (co.others || []).reduce((a, o) => a + o[1] / 100, 0), parts = [["최대주주 측", g, c("--neg")], ["다른 5% 보유자", Math.min(others, 1 - g), c("--violet")], ["그 밖의 주주(공개매수 대상)", Math.max(0, 1 - g - others), c("--mark-muted")]];
    let acc = 0; parts.forEach((p) => { if (p[1] <= 0) return; sv("rect", { x: x(acc), y: 22, width: x(acc + p[1]) - x(acc), height: 28, fill: p[2], opacity: 0.75 }, s); if (x(acc + p[1]) - x(acc) > 70) tx(s, x(acc) + 6, 41, pc(p[1], 0), { fill: "#fff", "font-size": 11.5, "font-weight": 700, class: "n" }); acc += p[1]; });
    sv("line", { x1: x(d.stake), x2: x(d.stake), y1: 12, y2: 60, stroke: c("--ink"), "stroke-width": 2 }, s);
    tx(s, Math.min(r2 - 4, Math.max(l + 4, x(d.stake))), 10, "목표 " + pc(d.stake), { "text-anchor": d.stake > 0.85 ? "end" : "middle", "font-size": 11, "font-weight": 700, fill: c("--ink") });
    let lx = l; parts.forEach((p) => { sv("rect", { x: lx, y: 72, width: 10, height: 10, fill: p[2], opacity: 0.75 }, s); const t = tx(s, lx + 14, 81, p[0], { "font-size": 11 }); lx += 14 + (t.getComputedTextLength ? t.getComputedTextLength() : p[0].length * 10) + 16; });
    const K = [["지분 확보 비용", eok(d.cost) + "원"], ["인수가 기준 EV/EBIT", xx(d.evebitAtPrem)], ["차입 가능(" + lev.toFixed(1) + "배)", eok(f.debt) + "원 · " + pc(f.debtShare, 0)], ["자기자본 필요", eok(f.equity) + "원"], ["지분만큼 FCF로 회수", f.payback ? f.payback.toFixed(1) + "년" : "회수 불가(FCF 음수)"]];
    const kp = $("p-kpi"); kp.textContent = ""; K.forEach((q) => { const k = el("div", { class: "kpi" }); k.appendChild(el("div", { class: "kl", text: q[0] })); k.appendChild(el("div", { class: "v", text: q[1] })); kp.appendChild(k); });
    const sg = $("p-sig"); sg.textContent = ""; M.signals(co, d).forEach((q) => { const li = el("li", { class: q[0] }); li.appendChild(el("span", { class: "dot", text: q[0] === "up" ? "+" : "−" })); li.appendChild(el("span", { text: q[1] })); sg.appendChild(li); });
  }

  /* ---------- 볼트온 ---------- */
  (function () {
    const s = $("b-grp"), G = Object.keys(D.groups).sort((a, b) => D.groups[b].n - D.groups[a].n);
    G.forEach((g) => s.appendChild(el("option", { value: g, text: g + " (" + D.groups[g].n + "곳 중)" })));
    s.addEventListener("change", drawBolt);
  })();
  function bar(v) { return "<span class='sbar'><i style='width:" + Math.round(v * 100) + "%'></i></span>"; }
  function drawBolt() {
    const g = $("b-grp").value, L = M.bolt(D, g), G = D.groups[g];
    $("b-out").textContent = g + ": 이 업종에서 이미 규모가 큰 회사(인수자 후보) " + G.acq.map((a) => a.name + " " + eok(a.mcap)).join(", ") + ". 아래는 그들이 붙이기 좋은 작은 회사 순위입니다.";
    let h = "<thead><tr><th scope='col'>#</th><th scope='col'>회사</th><th scope='col'>시가총액</th><th scope='col'>매출 성장</th><th scope='col'>영업이익률</th><th scope='col'>EV/EBIT</th><th scope='col'>최대주주 등</th><th scope='col'>점수 구성(성장·이익률·가격·거래 경로)</th><th scope='col'>점수</th></tr></thead><tbody>";
    L.forEach((x, i) => { const b = x.sB; h += "<tr><td class='n'>" + (i + 1) + "</td><th scope='row'>" + x.name + " <small class='muted'>" + x.mkt + "</small></th><td class='n'>" + eok(x.mcap) + "</td><td class='n'>" + pc(x.cagr) + "</td><td class='n'>" + pc(x.opm) + "</td><td class='n'>" + xx(x.evebit) + "</td><td class='n'>" + pc(x.grp) + "</td><td><span class='sbars'>" + bar(b.growth) + bar(b.margin) + bar(b.value) + bar(b.path) + "</span></td><td class='n'><b>" + Math.round(b.total * 100) + "</b></td></tr>"; });
    $("b-tb").innerHTML = h + "</tbody>";
    $("b-note").textContent = "막대 네 개는 왼쪽부터 성장률, 영업이익률, 가격(EV/EBIT 낮을수록 긺), 거래 경로(대주주 지분 30~70%면 가득) 점수입니다. 같은 업종 안의 백분위라 업종끼리 점수를 비교하지 않습니다.";
  }

  drawMap(); drawPlan(); drawBolt();
  F.onRedraw(() => { drawMap(); drawPlan(); });
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "상장사" }, { x: 0.90, y: 0.22, label: "가격" }, { x: 0.90, y: 0.50, label: "현금" }, { x: 0.90, y: 0.78, label: "지분" }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "EV/EBIT" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "FCF" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 12, label: "지배권" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

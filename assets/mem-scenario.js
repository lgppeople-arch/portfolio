/* 메모리 사이클 시나리오 가치평가 v2 화면(tools/mem-scenario.html). 계산은 assets/engines/memscen.js */
(function () {
  "use strict";
  const F = window.Fin, M = window.MemScen, $ = F.$, el = F.el, c = (n) => F.css(n), NS = "http://www.w3.org/2000/svg";
  if (!M) return;
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const won = (v) => Math.round(v).toLocaleString() + "원";
  const man = (v) => (v >= 1e4 ? (v / 1e4).toFixed(v >= 1e6 ? 0 : 1) + "만" : Math.round(v).toLocaleString()) + "원";
  const jo = (v) => Math.round(v).toLocaleString() + "조";
  const pc = (v, d) => (v >= 0 ? "+" : "") + (v * 100).toFixed(d == null ? 0 : d) + "%";
  const CO = ["skh", "sec"];
  let lv = M.CENTRAL.slice(), coPL = "skh", coTor = "skh", coMC = "skh", mc = null;
  (function () { const m = /lv=([1-5]{9})/.exec(location.hash); if (m) lv = m[1].split("").map((d) => +d - 1); })();

  /* ---------- 요약·출발점 ---------- */
  $("asof-px").textContent = "SK하이닉스 " + won(M.CO.skh.price) + " · 삼성전자 " + won(M.CO.sec.price);
  (function () {
    const r = M.CO, h = "<thead><tr><th scope='col'>항목</th><th scope='col'>SK하이닉스</th><th scope='col'>삼성전자</th><th scope='col'>근거</th></tr></thead><tbody>"
      + [["3Q26 매출 / 영업이익", jo(r.skh.q3.rev) + " / " + jo(r.skh.q3.op), "DS " + jo(r.sec.q3.rev) + " / " + jo(r.sec.q3.op), "실적 발표(하이닉스 D램 78.2조·낸드 26.0조)"],
        ["4Q26E 연환산 메모리 매출", jo(r.skh.exit.hbm + r.skh.exit.conv + r.skh.exit.nand), jo(r.sec.exit.hbm + r.sec.exit.conv + r.sec.exit.nand), "가이던스 + 계약가 전망으로 추정"],
        ["그중 HBM / 범용 D램 / 낸드", [r.skh.exit.hbm, r.skh.exit.conv, r.skh.exit.nand].map(jo).join(" / "), [r.sec.exit.hbm, r.sec.exit.conv, r.sec.exit.nand].map(jo).join(" / "), "제품 비중은 추정"],
        ["원가율(HBM / 범용 / 낸드)", [r.skh.costR.hbm, r.skh.costR.conv, r.skh.costR.nand].map((v) => Math.round(v * 100) + "%").join(" / "), [r.sec.costR.hbm, r.sec.costR.conv, r.sec.costR.nand].map((v) => Math.round(v * 100) + "%").join(" / "), "3Q26 영업이익률(하이닉스 80%)에 맞춤"],
        ["HBM 점유율(2026)", Math.round(r.skh.hbmShare0 * 100) + "%", Math.round(r.sec.hbmShare0 * 100) + "%", "추정"],
        ["기준주가(2026.11.24 종가)", won(r.skh.price), won(r.sec.price), "금융위원회 주식시세정보"],
        ["주식 수(십억 주)", r.skh.shares.toFixed(3), r.sec.shares.toFixed(3), "하이닉스는 40조 원 자사주 소각 후 추정, 삼성은 보통주+우선주"],
        ["2026E BPS", won(r.skh.bps0), won(r.sec.bps0), "메리츠증권(2026.11.6)"],
        ["자기자본비용(현행)", (r.skh.coe * 100).toFixed(1) + "%", (r.sec.coe * 100).toFixed(1) + "%", "할인율 단계로 ±1.5%p"]]
        .map((q) => "<tr><th scope='row'>" + q[0] + "</th><td class='n'>" + q[1] + "</td><td class='n'>" + q[2] + "</td><td>" + q[3] + "</td></tr>").join("") + "</tbody>";
    $("start-tb").innerHTML = h;
  })();
  function takeaways() {
    const a = M.evaluate("skh", M.CENTRAL), b = M.evaluate("sec", M.CENTRAL), S = mc || M.simulate(20000, 7, true);
    const ia = M.implied("skh", M.CENTRAL), ib = M.implied("sec", M.CENTRAL), I = M.industry(M.CENTRAL);
    const g = M.PRESETS.find((p) => p.id === "glut"), ga = M.evaluate("skh", g.lv), gb = M.evaluate("sec", g.lv);
    const items = [
      ["중심 시나리오 적정주가: 하이닉스 " + man(a.value) + "(" + pc(a.upside) + "), 삼성 " + man(b.value) + "(" + pc(b.upside) + ")", "증권사 수급 표(2027 D램 수요 +" + Math.round(I[0].d.dram * 100) + "%·공급 +" + Math.round(I[0].s.dram * 100) + "%)와 TrendForce 계약가 경로를 그대로 넣은 값입니다. 2027년 영업이익 하이닉스 " + jo(a.years[0].op) + "·삼성 " + jo(b.years[0].op) + ", 범용 D램 값은 2027 " + I[0].price.conv.toFixed(2) + " → 2029 " + I[2].price.conv.toFixed(2) + "(4Q26 = 1)."],
      ["지금 주가 ≈ '2028 공급 과잉' 시나리오(하이닉스 " + pc(ga.upside) + ", 삼성 " + pc(gb.upside) + ")", "주가를 설명하려면 메모리 값이 중심 경로의 " + Math.round(ia * 100) + "%(하이닉스)·" + Math.round(ib * 100) + "%(삼성)여야 합니다. 신규 팹 네 곳의 증설이 2028년에 한꺼번에 풀리는 경로와 같습니다. 남은 차이는 수급·심리(선거 뒤 위험 회피, 엔비디아 사태, 수출통제 입법)로 따로 봅니다."],
      ["상관을 넣은 분포에서 주가 이상일 확률: 하이닉스 " + Math.round(S.skh.above * 100) + "%, 삼성 " + Math.round(S.sec.above * 100) + "%", "중앙값 하이닉스 " + man(S.skh.p50) + ", 삼성 " + man(S.sec.p50) + ", 하위 10% " + man(S.skh.p10) + "·" + man(S.sec.p10) + ". 증설 확대·과잉에 35% 확률을 둔 결과입니다. 가장 크게 흔드는 변수는 AI 투자와 업계 증설입니다."]
    ];
    const tk = $("tk"); tk.textContent = "";
    items.forEach((q) => { const d = el("div"); d.appendChild(el("b", { text: q[0] })); d.appendChild(el("p", { text: q[1] })); tk.appendChild(d); });
    /* 근거 대조 */
    const C2 = I, sa = M.evaluate("skh", M.CENTRAL), sb = M.evaluate("sec", M.CENTRAL);
    const rows = [
      ["2027 D램 비트 수요(전체)", pc(C2[0].d.dram), "KB +25% · 골드만삭스 +24% · iM +31%"],
      ["2027 D램 비트 공급(전체)", pc(C2[0].s.dram), "KB +18% · 골드만삭스 +23% · iM +24%"],
      ["2028 D램 비트 수요 / 공급", pc(C2[1].d.dram) + " / " + pc(C2[1].s.dram), "iM +29% / +29%. 모건스탠리는 공급이 더 크다고 봄"],
      ["2027 HBM 비트 공급", pc(C2[0].s.hbm), "TrendForce +50~60%"],
      ["2027 HBM 웨이퍼 비중", Math.round(C2[0].w * 1000) / 10 + "%", "TrendForce 23% → 약 30%, 삼성 '약 30%'"],
      ["2027 범용 D램 평균 가격(4Q26 = 1)", C2[0].price.conv.toFixed(2), "TrendForce 1Q27 +5~10%, 2Q +3~8%, 3Q·4Q +0~5% 누적 평균 약 1.14(닻)"],
      ["2027 영업이익 하이닉스 / 삼성", jo(sa.years[0].op) + " / " + jo(sb.years[0].op), "KB 389·575조, iM 약 446·635조(EPS 역산), 키움 삼성 352조"],
      ["2028 EPS / 2027 EPS 하이닉스 / 삼성", pc(sa.years[1].eps / sa.years[0].eps - 1) + " / " + pc(sb.years[1].eps / sb.years[0].eps - 1), "iM +17% / +19%"]
    ];
    $("ev-tb").innerHTML = "<thead><tr><th scope='col'>항목(중심 시나리오)</th><th scope='col'>모형</th><th scope='col'>근거</th></tr></thead><tbody>" + rows.map((q) => "<tr><th scope='row'>" + q[0] + "</th><td class='n'>" + q[1] + "</td><td>" + q[2] + "</td></tr>").join("") + "</tbody>";
  }

  /* ---------- 시나리오 고르기 ---------- */
  (function () {
    const h = $("presets");
    M.PRESETS.forEach((p) => { const b = el("button", { type: "button", "data-p": p.id, title: p.note }); b.appendChild(el("b", { text: p.name })); b.appendChild(el("small", { text: M.code(p.lv) })); b.addEventListener("click", () => { lv = p.lv.slice(); update(); }); h.appendChild(b); });
    const V = $("vars");
    M.VARS.forEach((v, i) => {
      const box = el("div", { class: "var" }), head = el("div", { class: "vh" });
      head.appendChild(el("b", { text: (i + 1) + ". " + v.name })); head.appendChild(el("span", { class: "muted", text: v.what })); box.appendChild(head);
      const g = el("div", { class: "lv", role: "group", "aria-label": v.name });
      v.levels.forEach((L, k) => { const b = el("button", { type: "button", "data-i": i, "data-k": k, "aria-pressed": "false" }); b.appendChild(el("span", { class: "n", text: String(k + 1) })); b.appendChild(el("span", { text: L.tag })); b.addEventListener("click", () => { lv[i] = k; update(); }); g.appendChild(b); });
      box.appendChild(g); box.appendChild(el("p", { class: "vnote", id: "vn-" + i })); V.appendChild(box);
    });
    ["pl-co", "tor-co", "mc-co"].forEach((id) => { const s = $(id); CO.forEach((k) => { const b = el("button", { type: "button", "data-co": k, text: M.CO[k].name }); b.addEventListener("click", () => { if (id === "pl-co") coPL = k; else if (id === "tor-co") coTor = k; else coMC = k; update(true); }); s.appendChild(b); }); });
    $("mc-corr").addEventListener("change", () => { mc = null; drawMC(); });
  })();

  function drawBoard() {
    const B = $("board"); B.textContent = "";
    CO.forEach((k) => {
      const r = M.evaluate(k, lv), d = el("div", { class: "card " + (r.upside >= 0 ? "up" : "down") });
      d.appendChild(el("span", { class: "nm", text: M.CO[k].name }));
      d.appendChild(el("b", { class: "v", text: won(r.value) }));
      d.appendChild(el("span", { class: "vs", text: "기준주가 " + won(r.price) + " 대비 " + pc(r.upside) }));
      d.appendChild(el("span", { class: "mx", text: "2027 영업이익 " + jo(r.years[0].op) + " · 2029E PER " + (r.per29 ? r.per29.toFixed(1) + "배" : "적자") + " · PBR " + r.pbr29.toFixed(2) + "배" }));
      B.appendChild(d);
    });
    const p = M.PRESETS.find((q) => q.lv.join("") === lv.join(""));
    B.appendChild(el("p", { class: "code", text: "조합 " + M.code(lv) + (p ? " · " + p.name + ": " + p.note : "") }));
    document.querySelectorAll("#presets button").forEach((b) => b.setAttribute("aria-pressed", p && b.getAttribute("data-p") === p.id ? "true" : "false"));
    document.querySelectorAll("#vars .lv button").forEach((b) => b.setAttribute("aria-pressed", lv[+b.getAttribute("data-i")] === +b.getAttribute("data-k") ? "true" : "false"));
    M.VARS.forEach((v, i) => { $("vn-" + i).textContent = (lv[i] + 1) + "단계 " + v.levels[lv[i]].tag + ": " + v.levels[lv[i]].note; });
  }

  /* ---------- 수급과 가격 ---------- */
  function drawSupply() {
    const I = M.industry(lv), C0 = M.industry(M.CENTRAL), host = $("f-px"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), nar = W < 600, cols = nar ? 1 : 3, cw = W / cols, ch = 170, H = ch * (nar ? 3 : 1);
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "제품별 가격 지수 2026~2029: " + M.PRODUCTS.map((p) => M.PNAME[p] + " " + I.map((y) => y.price[p].toFixed(2)).join("→")).join(", ") }, host);
    const col = { conv: c("--input"), hbm: c("--accent"), nand: c("--violet") };
    M.PRODUCTS.forEach((p, j) => {
      const ox = nar ? 0 : j * cw, oy = nar ? j * ch : 0, l = ox + 38, r2 = ox + cw - 14, top = oy + 26, bot = oy + ch - 24;
      const ys = [1].concat(I.map((y) => y.price[p])), yc = [1].concat(C0.map((y) => y.price[p])), mx = Math.max(2.0, Math.max.apply(null, ys.concat(yc)) * 1.05), x = lin(0, 3, l, r2), y = lin(0, mx, bot, top);
      tx(s, l, oy + 14, M.PNAME[p], { "font-size": 12, "font-weight": 700, fill: c("--ink") });
      [0, 0.5, 1, 1.5, 2].filter((v) => v <= mx).forEach((v) => { sv("line", { x1: l, x2: r2, y1: y(v), y2: y(v), stroke: v === 1 ? c("--rule") : c("--rule-soft") }, s); tx(s, l - 5, y(v) + 4, v.toFixed(1), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
      ["4Q26", "27", "28", "29"].forEach((t, i) => tx(s, x(i), bot + 15, t, { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }));
      sv("polyline", { points: yc.map((v, i) => x(i) + "," + y(v)).join(" "), fill: "none", stroke: col[p], "stroke-width": 1.4, "stroke-dasharray": "4 3", opacity: 0.6 }, s);
      sv("polyline", { points: ys.map((v, i) => x(i) + "," + y(v)).join(" "), fill: "none", stroke: col[p], "stroke-width": 2.2 }, s);
      ys.forEach((v, i) => { sv("circle", { cx: x(i), cy: y(v), r: 3, fill: col[p] }, s); if (i) tx(s, x(i), y(v) - 7, v.toFixed(2), { "text-anchor": "middle", "font-size": 10, "font-weight": 600, fill: c("--ink"), class: "n" }); });
    });
    let h = "<thead><tr><th scope='col'>연도</th>" + M.PRODUCTS.map((p) => "<th scope='col'>" + M.PNAME[p] + " 수요 / 공급 / 누적 갭</th>").join("") + "<th scope='col'>HBM 웨이퍼 비중</th></tr></thead><tbody>";
    h += "<tr><th scope='row'>2026 말</th>" + M.PRODUCTS.map((p) => "<td class='n'>– / – / " + pc(M.START.gap[p], 1) + "</td>").join("") + "<td class='n'>" + Math.round(M.START.w * 100) + "%</td></tr>";
    I.forEach((y) => { h += "<tr><th scope='row'>" + y.year + "</th>" + M.PRODUCTS.map((p) => "<td class='n'>" + pc(y.d[p]) + " / " + pc(y.s[p]) + " / " + pc(y.gap[p], 1) + "</td>").join("") + "<td class='n'>" + Math.round(y.w * 100) + "%</td></tr>"; });
    $("sd-tb").innerHTML = h + "</tbody>";
  }

  /* ---------- 손익 ---------- */
  function drawPL() {
    const r = M.evaluate(coPL, lv), Y = r.years, row = (k, f) => "<tr><th scope='row'>" + k + "</th>" + Y.map((y) => "<td class='n'>" + f(y) + "</td>").join("") + "</tr>";
    let h = "<thead><tr><th scope='col'>" + M.CO[coPL].name + "</th>" + Y.map((y) => "<th scope='col'>" + y.year + "</th>").join("") + "</tr></thead><tbody>";
    M.PRODUCTS.forEach((p) => { h += row(M.PNAME[p] + " 매출", (y) => jo(y.prod[p].rev) + " <small>(가격 " + y.prod[p].pr.toFixed(2) + " · 물량 " + y.prod[p].q.toFixed(2) + (y.prod[p].lta ? " · 계약 " + Math.round(y.prod[p].lta * 100) + "%" : "") + ")</small>"); });
    h += row("메모리 매출", (y) => "<b>" + jo(y.rev) + "</b>") + row("원가(감가상각 포함)", (y) => jo(y.cost));
    if (coPL === "sec") h += row("메모리 외 영업이익", (y) => jo(y.nonmem));
    h += row("영업이익(성과급 후)", (y) => "<b>" + jo(y.op) + "</b>") + row("순이익", (y) => jo(y.ni)) + row("EPS", (y) => won(y.eps)) + row("ROE(기초 BPS)", (y) => (y.roe * 100).toFixed(0) + "%")
      + row("기말 BPS", (y) => won(y.bps)) + row("잔여이익(EPS − 자기자본비용 × BPS)", (y) => won(y.ri)) + row("PER(적정가 ÷ EPS)", (y) => (y.eps > 0 ? (r.value / y.eps).toFixed(1) + "배" : "적자"));
    $("pl-tb").innerHTML = h + "</tbody>";
    const lo = M.evaluate(coPL, lv, { payout: 0.2 }).value, hi = M.evaluate(coPL, lv, { payout: 0.8 }).value;
    $("pl-note").textContent = "적정주가 " + won(r.value) + " = 2026E BPS " + won(M.CO[coPL].bps0) + " + 잔여이익 현재가치 " + won(r.value - M.CO[coPL].bps0 - r.tv) + " + 잔존가치 " + won(r.tv) + ". 자기자본비용 " + (r.coe * 100).toFixed(2) + "%. 환원율을 20%로 낮추면 " + won(lo) + ", 80%로 높이면 " + won(hi) + ": 환원은 BPS를 바꾸지만 기존 주주 가치는 거의 같고, 차이는 쌓아 둔 현금이 3%만 버는 데서 생깁니다.";
  }

  /* ---------- 토네이도 ---------- */
  function drawTor() {
    const T = M.tornado(coTor, lv), host = $("f-tor"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), nar = W < 560, rh = 30, l = nar ? 96 : 150, r2 = W - 16, top = 10, H = top + T.length * rh + 26, price = M.CO[coTor].price;
    const lo = Math.min(price, Math.min.apply(null, T.map((q) => q.lo))) * 0.95, hi = Math.max(price, Math.max.apply(null, T.map((q) => q.hi))) * 1.03, x = lin(lo, hi, l, r2);
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": M.CO[coTor].name + " 변수별 적정주가 범위: " + T.map((q) => q.name + " " + man(q.lo) + "~" + man(q.hi)).join(", ") }, host);
    T.forEach((q, i) => {
      const y = top + i * rh + rh / 2, cur = q.vals[lv[M.IDX[q.id]]];
      tx(s, l - 8, y + 4, q.name, { "text-anchor": "end", "font-size": 11.5, fill: c("--ink") });
      sv("rect", { x: x(q.lo), y: y - 7, width: Math.max(2, x(q.hi) - x(q.lo)), height: 14, rx: 3, fill: c("--input"), opacity: 0.18 }, s);
      q.vals.forEach((v) => sv("circle", { cx: x(v), cy: y, r: 2.6, fill: c("--input"), opacity: 0.6 }, s));
      sv("circle", { cx: x(cur), cy: y, r: 5, fill: c("--input") }, s);
    });
    sv("line", { x1: x(price), x2: x(price), y1: top - 4, y2: H - 22, stroke: c("--accent"), "stroke-width": 1.5 }, s);
    tx(s, x(price), H - 8, "기준주가 " + man(price), { "text-anchor": "middle", "font-size": 10.5, fill: c("--accent"), "font-weight": 600 });
  }

  /* ---------- 몬테카를로 ---------- */
  function drawMC() {
    if (!mc) mc = M.simulate(20000, 7, $("mc-corr").checked);
    const S = mc[coMC], price = M.CO[coMC].price, host = $("f-mc"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), H = 220, l = 40, r2 = W - 14, top = 14, bot = H - 30, nb = 40;
    const N = S.sorted.length, lo = S.sorted[Math.floor(N * 0.005)], hi = S.sorted[Math.floor(N * 0.995)], step = (hi - lo) / nb, bins = new Array(nb).fill(0);
    S.sorted.forEach((v) => { const b = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / step))); bins[b]++; });
    const mx = Math.max.apply(null, bins), x = lin(lo, hi, l, r2), y = lin(0, mx, bot, top);
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": M.CO[coMC].name + " 적정주가 분포(2만 회): 중앙값 " + man(S.p50) + ", 기준주가 이상 " + Math.round(S.above * 100) + "%" }, host);
    bins.forEach((n, i) => { const v0 = lo + i * step; sv("rect", { x: x(v0) + 0.5, y: y(n), width: Math.max(1, x(v0 + step) - x(v0) - 1), height: bot - y(n), fill: v0 + step <= price ? c("--neg") : c("--pos"), opacity: 0.55 }, s); });
    sv("line", { x1: x(price), x2: x(price), y1: top, y2: bot, stroke: c("--ink"), "stroke-width": 1.6 }, s);
    tx(s, x(price) + 4, top + 10, "기준주가", { "font-size": 10.5, fill: c("--ink"), "font-weight": 600 });
    [S.p10, S.p50, S.p90].forEach((v, i) => { sv("line", { x1: x(v), x2: x(v), y1: bot, y2: bot + 6, stroke: c("--muted") }, s); tx(s, x(v), bot + 18, ["10%", "중앙", "90%"][i] + " " + man(v), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); });
    $("mc-out").textContent = M.CO[coMC].name + ": 2만 개 시나리오 중 적정주가가 기준주가(" + man(price) + ") 이상인 비율 " + Math.round(S.above * 100) + "%, 평균 " + man(S.mean) + ", 중앙값 " + man(S.p50) + ".";
    let h = "<thead><tr><th scope='col'>회사</th><th scope='col'>10%</th><th scope='col'>25%</th><th scope='col'>중앙값</th><th scope='col'>75%</th><th scope='col'>90%</th><th scope='col'>평균</th><th scope='col'>기준주가 이상</th></tr></thead><tbody>";
    CO.forEach((k) => { const q = mc[k]; h += "<tr><th scope='row'>" + M.CO[k].name + "</th>" + [q.p10, q.p25, q.p50, q.p75, q.p90, q.mean].map((v) => "<td class='n'>" + man(v) + "</td>").join("") + "<td class='n'><b>" + Math.round(q.above * 100) + "%</b></td></tr>"; });
    $("mc-tb").innerHTML = h + "</tbody>";
    $("mc-note").textContent = "단계 확률(1~5단계): " + M.VARS.map((v, i) => v.name + " " + M.PROB[i].map((p) => Math.round(p * 100)).join("·")).join(" / ") + ". 상관: AI 투자–범용 수요 0.4, AI–할인율 0.4, AI–증설 −0.4, AI–환율 −0.3 등(같은 부호 = 같이 불리해짐). 시드 7 고정.";
  }

  /* ---------- 역산 ---------- */
  function drawImp() {
    const a = M.implied("skh", lv), b = M.implied("sec", lv);
    $("imp-out").textContent = "지금 조합(" + M.code(lv) + ")의 적정가와 기준주가의 차이를 메모리 가격으로 바꾸면 하이닉스 " + a.toFixed(2) + "배, 삼성 " + b.toFixed(2) + "배입니다. " + (a < 1 ? "주가는 이 조합보다 메모리 값이 " + Math.round((1 - a) * 100) + "% 낮은 경로와 같습니다(하이닉스 기준). 이 차이가 펀더멘털 전망의 차이인지, 아래 일정에 따른 수급·심리인지는 계약가와 증설 발주가 확인되며 갈립니다." : "주가가 이 조합보다 높은 메모리 값을 전제하고 있습니다.");
    let h = "<thead><tr><th scope='col'>대표 시나리오</th><th scope='col'>하이닉스 적정주가</th><th scope='col'>주가 설명 가격 비율</th><th scope='col'>삼성 적정주가</th><th scope='col'>주가 설명 가격 비율</th></tr></thead><tbody>";
    M.PRESETS.forEach((p) => { const x = M.evaluate("skh", p.lv), y = M.evaluate("sec", p.lv); h += "<tr><th scope='row'>" + p.name + "</th><td class='n'>" + man(x.value) + " (" + pc(x.upside) + ")</td><td class='n'>" + M.implied("skh", p.lv).toFixed(2) + "</td><td class='n'>" + man(y.value) + " (" + pc(y.upside) + ")</td><td class='n'>" + M.implied("sec", p.lv).toFixed(2) + "</td></tr>"; });
    $("imp-tb").innerHTML = h + "</tbody>";
  }

  function update(onlyCo) {
    if (!onlyCo) { try { history.replaceState(null, "", "#lv=" + M.code(lv)); } catch (e) { /* 파일로 열면 막힐 수 있다 */ } }
    ["pl-co", "tor-co", "mc-co"].forEach((id, i) => { const cur = [coPL, coTor, coMC][i]; document.querySelectorAll("#" + id + " button").forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-co") === cur ? "true" : "false")); });
    drawBoard(); drawSupply(); drawPL(); drawTor(); drawImp(); drawMC();
  }
  update(); takeaways();
  F.onRedraw(() => { drawSupply(); drawTor(); drawMC(); });
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "웨이퍼" }, { x: 0.90, y: 0.22, label: "HBM" }, { x: 0.90, y: 0.50, label: "범용 D램" }, { x: 0.90, y: 0.78, label: "낸드" }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "×3" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "잔여" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 10, label: "" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

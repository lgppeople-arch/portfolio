/* 반도체 장비 부품 세그먼트 지도(tools/parts-map.html) 화면. 자료와 계산은 assets/engines/partsmap.js */
(function () {
  "use strict";
  const F = window.Fin, E = window.PartsMap, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!E) return;
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const f1 = (v) => v.toFixed(1);
  const el = (t, a, k) => F.el(t, a, k);
  const S = E.SEGS, byId = {}; S.forEach((s) => { byId[s.id] = s; });
  const SHORT = { heater: "AlN 히터", esc_dep: "증착 정전척", esc_etch: "식각 정전척", bond: "본딩 히터·다공척", ring_si: "Si 링", ring_sic: "SiC 링", ring_cer: "세라믹 커버·섀도링", y2o3: "Y₂O₃ 벌크", coat: "코팅·재생", shower: "샤워헤드·상부전극", quartz: "쿼츠웨어", struct: "구조·이송", powder: "원료 파우더" };
  const GCOL = { hold: "--input", face: "--accent", heat: "--neg", struct: "--mark-muted", raw: "--pos" };
  function hmCell(v, txt) { return el("td", { class: "c" + v, text: txt === undefined ? (v ? String(v) : "–") : txt }); }
  function thead(tb, cols) { tb.appendChild(el("thead", null, [el("tr", null, cols.map((h) => (typeof h === "string" ? el("th", { text: h, scope: "col" }) : h)))])); }
  function rowHead(s) { const th = el("th", { scope: "row" }); th.appendChild(document.createTextNode(SHORT[s.id])); th.appendChild(el("span", { class: "gh", text: E.GROUPS[s.grp] })); return th; }

  /* ---------- 1. 공정 × 부품 ---------- */
  (function () {
    const tb = $("proc-tb"); thead(tb, ["부품"].concat(E.PROCS.map((p) => p.name)));
    const body = el("tbody");
    S.forEach((s) => { const tr = el("tr"); tr.appendChild(rowHead(s));
      if (!Object.keys(s.procs).length) { const td = el("td", { class: "l", text: "원료 단계(모든 부품의 앞단)" }); td.colSpan = E.PROCS.length; tr.appendChild(td); }
      else E.PROCS.forEach((p) => { const v = s.procs[p.id] || 0; tr.appendChild(hmCell(v, v === 2 ? "주" : v === 1 ? "일부" : "–")); });
      body.appendChild(tr); });
    tb.appendChild(body);
  })();

  /* ---------- 2. 제조기술 ---------- */
  (function () {
    const tb = $("tech-tb"); thead(tb, ["소결 방식", "대표 조건(일반 범위)", "장점", "한계", "설비비", "이 지도에서 쓰는 세그먼트"]);
    const body = el("tbody"), dots = (n) => "●".repeat(n) + "○".repeat(4 - n);
    const uses = { ps: ["ring_cer", "y2o3", "struct", "esc_etch"], gps: ["bond"], hp: ["heater", "esc_dep", "esc_etch", "bond", "shower"], hip: ["y2o3"], sps: [], cvd: ["ring_sic", "shower"], rbsc: ["struct"], fuse: ["quartz"] };
    E.TECH_ORDER.forEach((k) => { const t = E.TECHS[k], tr = el("tr"); tr.appendChild(el("th", { text: t.name }));
      [t.cond, t.pro, t.con].forEach((v) => tr.appendChild(el("td", { text: v })));
      const td = el("td", { text: dots(t.capex) }); td.setAttribute("aria-label", "설비비 4단계 중 " + t.capex); tr.appendChild(td);
      tr.appendChild(el("td", { text: uses[k].length ? uses[k].map((id) => SHORT[id]).join(", ") : "연구·소형 부품" })); body.appendChild(tr); });
    tb.appendChild(body);
    const tt = $("tier-tb"); thead(tt, ["가공 등급", "치수 공차", "평탄도(Ø300mm)", "표면 거칠기 Ra", "가공법", "적용 부품", "숙련 기간", "외주 가능성"]);
    const tbody = el("tbody");
    E.TIERS.forEach((t) => { const tr = el("tr"); tr.appendChild(el("th", { text: t.t })); [t.tol, t.flat, t.ra, t.how, t.use, t.learn, t.out].forEach((v) => tr.appendChild(el("td", { text: v }))); tbody.appendChild(tr); });
    tt.appendChild(tbody);
    const ol = $("tech-notes");
    [["핫프레스는 장입량이 적어 병목이 되기 쉽습니다.", " 같은 설비로 여러 품목을 굽는다면 품목 우선순위는 매출이 아니라 '소결로 1시간당 공헌이익'으로 매겨야 합니다(병목 자원 기준 의사결정)."],
     ["HIP와 CVD 증착은 설비비가 가장 큰 축입니다.", " Y₂O₃ 벌크는 HIP, SiC 링은 CVD 설비가 사실상 입장권이라, 같은 세라믹 회사라도 이 둘로 넓히려면 새 공장을 짓는 것에 가깝습니다."],
     ["진입장벽은 소결보다 가공 등급 3~4에서 더 오래 갑니다.", " 극초정밀 가공은 숙련에 3~5년이 걸리고 외주가 어렵습니다. 반대로 등급 1~2는 외주가 쉬워, 이 구간만으로는 가격 경쟁을 피하기 어렵습니다."],
     ["소결조제도 원료입니다.", " 질화알루미늄(AlN)은 산화이트륨(Y₂O₃)을 소결조제로 쓰는 경우가 많아, 이트륨 통제는 Y₂O₃ 부품뿐 아니라 AlN 히터·정전척의 원가에도 닿습니다."]
    ].forEach((q) => { const li = el("li"); li.appendChild(el("b", { text: q[0] })); li.appendChild(document.createTextNode(q[1])); ol.appendChild(li); });
  })();

  /* ---------- 3. 소재 대체 ---------- */
  (function () {
    const tb = $("ring-tb"); thead(tb, ["자리", "필요한 성질"].concat(E.RING_MATS));
    const body = el("tbody");
    E.RINGS.forEach((r) => { const tr = el("tr"); tr.appendChild(el("th", { text: r.pos, scope: "row" })); tr.appendChild(el("td", { class: "l", text: r.need })); r.v.forEach((v) => tr.appendChild(hmCell(v, v === 2 ? "주력" : v === 1 ? "대체 후보" : "–"))); body.appendChild(tr); });
    tb.appendChild(body);
    const multi = E.RINGS.filter((r) => r.v.filter((v) => v > 0).length >= 3).length;
    $("ring-note").textContent = E.RINGS.length + "개 자리 중 " + multi + "개 자리에서 세 가지 이상의 소재가 경쟁합니다. 포커스링은 Si와 CVD-SiC가 서로를 대체하고(고단 적층 식각일수록 수명이 긴 SiC 쪽), 커버·인슐레이터링과 윈도우는 쿼츠와 세라믹이 다툽니다. 쿼츠에서 세라믹으로 넘어오는 자리는 세라믹 쪽에 기회, 쿼츠 쪽에 위협입니다.";
  })();

  /* ---------- 4. 플레이어 유형 ---------- */
  (function () {
    const tb = $("player-tb"); thead(tb, ["플레이어 유형", "예시"].concat(S.map((s) => SHORT[s.id])));
    const body = el("tbody");
    E.PLAYERS.forEach((p) => { const tr = el("tr"); tr.appendChild(el("th", { text: p.name, scope: "row" })); tr.appendChild(el("td", { class: "l", text: p.ex })); S.forEach((s) => { const v = p.v[s.id]; tr.appendChild(hmCell(v, v === 2 ? "●" : v === 1 ? "○" : "–")); }); body.appendChild(tr); });
    tb.appendChild(body);
    const crowd = S.map((s) => ({ s: s, n: E.PLAYERS.filter((p) => p.v[s.id] === 2).length })).sort((a, b) => b.n - a.n);
    $("player-note").textContent = "●는 주력, ○는 참여입니다. 주력 유형이 가장 많은 세그먼트는 " + crowd.slice(0, 2).map((q) => SHORT[q.s.id] + "(" + q.n + "개 유형)").join("·") + "로, 공급자가 많아 가격 경쟁이 붙기 쉬운 자리입니다. 반대로 정전척·히터처럼 소재 설계와 극초정밀 가공이 함께 필요한 자리는 일본 종합 세라믹사의 비중이 높고, 장비사가 핵심 부품을 직접 만드는 경우도 있어 고객이 곧 경쟁자가 되기도 합니다.";
  })();

  /* ---------- 5. 평가 ---------- */
  const W = Object.assign({}, E.W0);
  (function () {
    const host = $("wts");
    E.PROFIT_KEYS.forEach((k) => { const lab = el("label"); const sp = el("span"); sp.append(E.PROFIT_NAMES[k] + " 가중치 ", el("b", { id: "w-" + k, text: W[k] + "" })); lab.appendChild(sp);
      const inp = el("input", { type: "range", min: 0, max: 100, step: 5, value: W[k], "aria-label": E.PROFIT_NAMES[k] + " 가중치" }); inp.addEventListener("input", () => { W[k] = +inp.value; $("w-" + k).textContent = inp.value; drawEval(); drawFlow(); }); lab.appendChild(inp); host.appendChild(lab); });
    const lg = $("lgd"); Object.keys(E.GROUPS).forEach((g) => { const s = el("span"); const i = el("i"); i.style.background = c(GCOL[g]); s.appendChild(i); s.appendChild(document.createTextNode(E.GROUPS[g])); lg.appendChild(s); });
  })();
  function drawEval() {
    const R = E.score(W), host = $("f-bub"); host.textContent = "";
    const Wd = Math.max(300, Math.round(host.clientWidth || 680)), nar = Wd < 560, H = nar ? 420 : 400, l = 46, r2 = Wd - 16, top = 16, bot = H - 44;
    const s = sv("svg", { viewBox: "0 0 " + Wd + " " + H, width: Wd, height: H, role: "img", "aria-label": "세그먼트별 성숙도(가로)와 수익성 점수(세로), 원 크기는 확장성" }, host);
    const x = lin(0.5, 5.5, l, r2), y = lin(1, 5, bot, top);
    for (let v = 1; v <= 5; v++) { sv("line", { x1: l, x2: r2, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, s); tx(s, l - 8, y(v) + 4, String(v), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); }
    ["도입", "성장", "성장 후기", "성숙 초기", "성숙"].forEach((t, i) => tx(s, x(i + 1), bot + 18, (i + 1) + " " + t, { "text-anchor": "middle", "font-size": nar ? 9 : 10.5, fill: c("--muted") }));
    tx(s, r2, bot + 36, "성숙도 →", { "text-anchor": "end", "font-size": 10.5, fill: c("--muted") });
    tx(s, l, top - 4, "수익성 점수 ↑", { "font-size": 10.5, fill: c("--muted") });
    /* 같은 칸에 겹치는 원은 옆으로 조금씩 벌린다 */
    /* 같은 성숙도 칸의 원은 수익성 순서대로 가로로 고르게 벌리고, 이름표는 위아래로 번갈아 단다. 좁은 화면에서는 번호로 표시하고 아래에 목록을 둔다 */
    const colW = (r2 - l) / 5, pos = [];
    for (let m = 1; m <= 5; m++) {
      const g = R.rows.filter((q) => q.m === m).sort((a, b) => a.profit - b.profit), step = Math.min(colW / Math.max(g.length, 1), nar ? 30 : 44);
      g.forEach((q, i) => pos.push({ q: q, px: x(m) + (i - (g.length - 1) / 2) * step, py: y(q.profit), up: i % 2 === 0 }));
    }
    const num = {}; R.order.forEach((q, i) => { num[q.id] = i + 1; });
    pos.forEach((a) => { const rad = 5 + Math.sqrt(a.q.scal) * (nar ? 4 : 6.5);
      sv("circle", { cx: a.px, cy: a.py, r: rad, fill: c(GCOL[a.q.grp]), opacity: 0.32, stroke: c(GCOL[a.q.grp]), "stroke-width": 1.5 }, s);
      if (nar) tx(s, a.px, a.py + 4, String(num[a.q.id]), { "text-anchor": "middle", "font-size": 10, fill: c("--ink"), "font-weight": 700, class: "n" });
      else tx(s, a.px, a.up ? a.py - rad - 4 : a.py + rad + 12, SHORT[a.q.id], { "text-anchor": "middle", "font-size": 10.5, fill: c("--ink"), "font-weight": 600 }); });
    $("bub-key").textContent = nar ? "번호(수익성 순위): " + R.order.map((q, i) => (i + 1) + " " + SHORT[q.id]).join(" · ") : "";
    const top3 = R.order.slice(0, 3), bottom = R.order[R.order.length - 1];
    const out = $("w-out"); out.textContent = "";
    out.append("지금 가중치에서 수익성 점수 상위 3: ", el("b", { text: top3.map((q) => SHORT[q.id] + " " + f1(q.profit)).join(" · ") }), " / 최하위: " + SHORT[bottom.id] + " " + f1(bottom.profit));
    const eq = E.score({ b: 25, r: 25, p: 25, raw: 25 }).order.slice(0, 3).map((q) => q.id), same = top3.every((q) => eq.indexOf(q.id) >= 0);
    $("bub-note").textContent = "오른쪽 위(성숙했는데 수익성 구조도 좋은 자리)는 오래 버는 사업, 왼쪽 위(도입·성장기인데 장벽이 높은 자리)는 지금 자리를 잡아야 하는 사업, 오른쪽 아래(성숙하고 장벽이 낮은 자리)는 원가 경쟁 사업입니다. 가중치를 모두 같게 두었을 때와 비교하면 상위 3개는 " + (same ? "그대로입니다. 결론이 가중치에 크게 흔들리지 않습니다." : "달라집니다. 이 구간의 순서는 가중치 선택에 민감하므로 단정하지 않습니다.");
    const tb = $("eval-tb"); tb.textContent = "";
    thead(tb, ["세그먼트", "제조기술", "가공 등급", "성숙도", "진입장벽", "반복 매출", "가격 방어", "원료 안정", "수익성", "확장성", "순위", "근거"]);
    const body = el("tbody");
    R.rows.forEach((q) => { const sg = byId[q.id], tr = el("tr"); tr.appendChild(el("th", { text: sg.name }));
      [E.TECH_LABEL[sg.tech], sg.tier, sg.m, sg.b, sg.r, sg.p, sg.raw].forEach((v) => tr.appendChild(el("td", { text: String(v) })));
      tr.appendChild(el("td", { text: f1(q.profit) })); tr.appendChild(el("td", { text: f1(q.scal) })); tr.appendChild(el("td", { text: String(q.rank) })); tr.appendChild(el("td", { text: sg.why })); body.appendChild(tr); });
    tb.appendChild(body);
  }

  /* ---------- 6. 인접성 ---------- */
  const bsel = $("base-sel");
  E.BASES.forEach((b) => { const o = el("option", { text: b.id + ". " + b.name }); o.value = b.id; bsel.appendChild(o); });
  function drawAdj() {
    const id = bsel.value, tb = $("adj-tb"); tb.textContent = "";
    thead(tb, ["세그먼트"].concat(E.BASES.map((b) => { const th = el("th", { scope: "col", text: b.id }); th.title = b.name; if (b.id === id) th.style.color = c("--accent"); return th; })).concat(["거의 그대로 할 수 있는 유형"]));
    const body = el("tbody");
    S.forEach((s) => { const tr = el("tr"); tr.appendChild(rowHead(s));
      E.BASES.forEach((b) => { const v = b.v[s.id], td = hmCell(v, String(v)); if (b.id === id) td.style.boxShadow = "inset 0 0 0 2px " + c("--accent"); tr.appendChild(td); });
      const ow = E.owners(s.id); tr.appendChild(el("td", { class: "l", text: ow.length ? ow.join(", ") : "없음(결합 역량 필요)" })); body.appendChild(tr); });
    tb.appendChild(body);
    const R = E.reach(id, W), lv = (n) => R.filter((q) => q.adj === n).map((q) => SHORT[q.id]);
    const out = $("adj-out"); out.textContent = "";
    out.append(id + " 유형에서 거의 그대로: ", el("b", { text: lv(3).join(", ") || "없음" }), " · 일부 개조: " + (lv(2).join(", ") || "없음") + " · 신규 구축: " + (lv(1).join(", ") || "없음"));
  }
  bsel.addEventListener("change", drawAdj);
  (function () {
    const none = S.filter((s) => !E.owners(s.id).length).map((s) => SHORT[s.id]);
    $("adj-note").textContent = "13개 세그먼트 중 " + none.length + "개(" + none.join(", ") + ")는 어느 한 역량 유형으로도 '거의 그대로' 만들 수 없습니다. 세라믹 소결에 금속 접합·RF 설계(식각 정전척), 소결과 극초정밀 미세홀·다른 소재(샤워헤드), 소결과 패키징 장비 요구(본딩 히터)가 함께 필요하기 때문입니다. 이런 자리는 한 가지 역량만 가진 신규 진입자에게 높은 벽이고, 결합 역량을 이미 가진 회사에게는 해자가 됩니다. 반대로 Si 링·SiC 링·쿼츠웨어는 각각 단결정 성장·CVD·용융이라는 전용 역량의 영역이라, 세라믹 소결 회사가 넘어가기 어렵고 그 반대도 마찬가지입니다.";
  })();

  /* ---------- 7. 외부 변수 ---------- */
  (function () {
    const ul = $("facts");
    [["장비 투자는 2028년까지 커지는 전망입니다.", "SEMI는 웨이퍼 팹 장비(WFE) 매출이 2025년 1,169억 달러에서 2026년 23.1% 늘어 1,439억 달러, 2027년 21.8%, 2028년 14.1% 늘어 2,000억 달러 수준에 이를 것으로 봤습니다. 낸드 장비는 2026년 30.7%(139억 달러), 2027년 31.1% 증가 전망입니다.", "SEMI 2026년 중간 전망(EMSNow 보도)"],
     ["중국의 장비 국산화가 빨라지고 있습니다.", "중국 반도체 장비 국산화율은 2021년 8%에서 2025년 23.2%로 올랐고, 2030년 39%로 전망됩니다. 중국 안에서 외국 부품사가 들어갈 자리는 줄어드는 방향입니다.", "Yole Group, 2026.6.22"],
     ["이트륨은 가장 직접적인 원료 위험입니다.", "중국은 2025년 4월 이트륨을 포함한 희토류 7종에 수출통제를 걸었고, 2026년 2월에는 미국 코팅 공급망에서 생산 중단이 일어났습니다. 중국 밖 산화이트륨 가격은 2026년 5월 kg당 약 1,100달러로 통제 전 한 자릿수 달러에서 크게 올랐습니다.", "Reuters 칼럼(2026.9.14), The Oregon Group(2026.6.10)"],
     ["중국의 대일본 수출통제는 제3국 공급망에도 닿습니다.", "중국 상무부는 2026년 1월 6일 일본의 군사 사용자·군사 용도와 군사 역량에 기여할 수 있는 최종 사용자에 대한 이중용도품목 수출을 금지했고, 제3국을 거쳐 일본에 제공하는 경우에도 처벌할 수 있다고 밝혔습니다. 일본에 부품을 공급하는 다른 나라 회사도 원료 원산지를 확인해야 하는 이유입니다.", "법률신문(2026.1.12), 중국 상무부 2026년 제1호 공고"],
     ["강화 조치의 유예는 한시적입니다.", "중국은 2026년 11월, 인조 다이아몬드 등 초경소재와 일부 희토류 관련 장비·원부자재 등에 대한 수출통제 강화 조치의 유예를 2027년 1월 10일까지 연장한다고 발표했습니다. 다이아몬드 공구는 세라믹 정밀 가공의 소모품입니다.", "연합뉴스(2026년 11월)"]
    ].forEach((q) => { const li = el("li"); li.appendChild(el("b", { text: q[0] + " " })); li.appendChild(document.createTextNode(q[1])); li.appendChild(el("small", { text: "출처: " + q[2] })); ul.appendChild(li); });
    const tb = $("ext-tb"); thead(tb, ["세그먼트", "장비 투자 사이클 민감도 (1~3)", "이트륨 노출 (0~3)", "중국 국산화·저가 압력 (0~3)"]);
    const body = el("tbody");
    S.forEach((s) => { const tr = el("tr"); tr.appendChild(rowHead(s)); [s.cyc, s.y, s.cn].forEach((v) => tr.appendChild(hmCell(v, String(v)))); body.appendChild(tr); });
    tb.appendChild(body);
    const hiY = S.filter((s) => s.y >= 2).map((s) => SHORT[s.id]), hiC = S.filter((s) => s.cyc === 3).map((s) => SHORT[s.id]), lowC = S.filter((s) => s.cyc === 1).map((s) => SHORT[s.id]);
    $("ext-note").textContent = "이트륨 노출이 2 이상인 세그먼트는 " + hiY.join(", ") + "입니다. Y₂O₃ 부품·코팅만이 아니라 소결조제를 쓰는 AlN 제품까지 닿습니다. 사이클 민감도가 높은 " + hiC.join(", ") + "은 신규 장비 출하와 함께 움직이고, 낮은 " + lowC.join(", ") + "는 이미 깔린 장비가 돌아가는 한 반복 수요가 생겨 하강기에 매출을 받쳐 줍니다.";
  })();

  /* ---------- 요약·실무·한계 ---------- */
  (function () {
    const R = E.score(E.W0), top = R.order.slice(0, 3).map((q) => SHORT[q.id]), none = S.filter((s) => !E.owners(s.id).length).length;
    const tk = $("tk");
    [["소재가 아니라 '자리 × 만드는 법'으로 나눈다", "같은 링 자리를 Si·SiC·쿼츠·세라믹이 다투고, 같은 세라믹도 상압 소결·핫프레스·HIP·CVD에 따라 설비와 인력이 다릅니다. 소결 방식 " + E.TECH_ORDER.length + "가지와 가공 등급 4단계를 겹쳐야 실제 경쟁자가 보입니다."],
     ["수익성 구조는 진입장벽과 반복 매출이 겹치는 곳", "기본 가중치에서 수익성 점수 상위는 " + top.join(", ") + "입니다. 극초정밀 가공이나 초고순도 증착 같은 장벽에, 플라즈마에 닳아 다시 사야 하는 소모성이 더해진 자리입니다."],
     ["확장은 역량이 겹치는 곳으로, 결합 역량이 해자", "13개 중 " + none + "개 세그먼트는 한 가지 역량만으로는 거의 그대로 만들 수 없습니다. 소결·가공·접합·RF를 함께 갖춰야 하는 이 자리들이 신규 진입이 가장 어렵고, 원료(이트륨) 노출은 Y₂O₃ 제품을 넘어 AlN 제품까지 닿습니다."]
    ].forEach((q) => { const d = el("div"); d.appendChild(el("b", { text: q[0] })); d.appendChild(el("p", { text: q[1] })); tk.appendChild(d); });
    const ul = $("use-list");
    [["사업 단위를 '공정 자리 × 제조기술'로 정의합니다.", " 매출·원가·KPI를 소재 이름으로만 묶으면 경쟁 구도가 다른 사업이 한 칸에 섞입니다. 사업계획과 손익 보고의 집계 단위를 이 지도의 세그먼트에 맞추면 가격 압력과 원가 구조를 따로 읽을 수 있습니다."],
     ["신규 품목 투자심의에서 인접성 점수를 NPV 가정과 맞춰 봅니다.", " 인접성이 0~1인 세그먼트는 설비만 사면 되는 것이 아니라 인력 숙련(가공 등급 3~4는 3~5년)과 고객 인증 기간이 붙습니다. 이를 투자 시점·매출 개시 시점·초기 수율 가정에 반영해야 합니다(설비투자 키트의 단계 투자 옵션)."],
     ["신규 장비 연동 품목과 소모품의 매출 구성으로 사이클을 관리합니다.", " 사이클 민감도 3인 품목은 장비 투자 호황에 크게 늘고 하강기에 크게 줄어듭니다. 재생·링 같은 반복 매출 비중을 함께 계획하면 사업계획의 하방 위험(EaR)이 줄어듭니다."],
     ["원료 통제를 원가 시나리오에 넣습니다.", " 이트륨처럼 한 나라가 공급을 쥔 원료는 가격이 몇십 배 움직일 수 있습니다. 원료 단가를 변수로 둔 제품별 원가 민감도와 안전재고 일수를 함께 보고합니다."],
     ["공개 자료로 만든 틀이므로, 실제 판단은 회사 자료로 다시 매깁니다.", " 점수의 근거(장벽, 반복성, 가격, 원료)는 사내 원가·수율·가동률·고객별 인증 현황으로 바꿔 넣을 수 있습니다. 이 페이지의 가중치 막대가 그 연습입니다."]
    ].forEach((q) => { const li = el("li"); li.appendChild(el("b", { text: q[0] })); li.appendChild(document.createTextNode(q[1])); ul.appendChild(li); });
    const lim = $("lim-list");
    [["점수는 정성 판단입니다.", " 공개 자료와 일반 공학 지식으로 매긴 1~5점이며, 회사·고객·세대에 따라 달라집니다. 그래서 수익성 가중치를 바꿀 수 있게 하고, 결론이 가중치에 민감한지 함께 표시했습니다."],
     ["시장 규모·점유율·이익률 숫자는 넣지 않았습니다.", " 공개된 세그먼트별 수치는 출처마다 정의가 달라 서로 비교하기 어렵고 검증도 어렵습니다. 대신 이익률을 만드는 구조적 요인을 점수로 나눠 보였습니다."],
     ["플레이어 유형 칸은 유형 수준의 판단입니다.", " 같은 유형 안에서도 회사마다 제품 구성이 다릅니다. 예시 회사는 공개 자료에 널리 나온 해외 대형사만 적었고, 국내 회사는 실명을 쓰지 않았으며, 회사별 순위·평가를 하지 않습니다."],
     ["외부 변수는 2026년 11월까지 공개된 보도 기준입니다.", " 수출통제와 유예 조치는 수시로 바뀌므로, 실제 판단 전에 최신 공고를 다시 확인해야 합니다."]
    ].forEach((q) => { const li = el("li"); li.appendChild(el("b", { text: q[0] })); li.appendChild(document.createTextNode(q[1])); lim.appendChild(li); });
  })();

  /* ---------- 0. 한 장 지도: 공용 탐색기 ---------- */
  const NSHORT = { pl_jp: "일본 종합 세라믹", pl_west: "미·유럽 소재 전문", pl_oem: "장비사 계열·내재화", pl_qz: "쿼츠 전문", pl_svc: "코팅·재생 서비스", pl_chem: "원료 화학사", pl_kr: "한국 부품 전문", pl_cn: "중국 신흥 업체" };
  const GRP = {}; Object.keys(E.GROUPS).forEach((g) => { GRP[g] = { name: E.GROUPS[g], css: GCOL[g] }; });
  const profOf = (id) => E.profit(byId[id], W);
  const LM = window.LinkMapUI.mount($("lm-parts"), E.lmSpec(), { label: (n) => (n.col === "seg" ? SHORT[n.seg] : NSHORT[n.id] || n.name), itemName: (id) => SHORT[id], groups: GRP, score: profOf, scoreName: "수익성", itemWord: "부품", itemCol: "seg" });
  function drawFlow() { LM.setScore(); }

  function all() { drawEval(); drawAdj(); }
  all(); F.onRedraw(all);
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "공정" }, { x: 0.90, y: 0.22, label: "소결" }, { x: 0.90, y: 0.50, label: "가공" }, { x: 0.90, y: 0.78, label: "소재" }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "온도" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "정밀" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 12, label: "대체" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

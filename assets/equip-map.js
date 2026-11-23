/* 반도체 장비 세그먼트 지도(tools/equip-map.html) 화면. 자료·계산은 assets/engines/equipmap.js, 탐색기는 assets/linkmap-ui.js */
(function () {
  "use strict";
  const F = window.Fin, E = window.EquipMap, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!E) return;
  const c = (n) => F.css(n), el = F.el;
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const S = E.SEGS, byId = {}; S.forEach((s) => { byId[s.id] = s; });
  const SHORT = { euv: "EUV 노광", duv: "DUV 노광", track: "트랙", etch_c: "도체 식각", etch_d: "유전체 식각", cvd: "CVD", ald: "ALD", pvd: "PVD", epi: "에피", furnace: "퍼니스", rtp: "급속 열처리", imp: "이온주입", clean: "세정", cmp: "CMP", insp: "결함 검사", metro: "계측", mask: "마스크 검사", bond: "본딩", dice: "다이싱" };
  const coName = {}; E.COS.forEach((q) => { coName[q[0]] = q[1]; });
  const li = (ol, rows) => rows.forEach((q) => { const x = el("li"); x.appendChild(el("b", { text: q[0] })); x.appendChild(document.createTextNode(q[1])); ol.appendChild(x); });

  /* ---------- 탐색기 ---------- */
  window.LinkMapUI.mount($("lm-equip"), E.lmSpec(), { label: (n) => (n.col === "eq" ? SHORT[n.id.slice(2)] : n.name), itemName: (id) => SHORT[id], groups: E.GROUPS, score: (id) => byId[id].g, scoreName: "성장 동인", itemWord: "장비", itemCol: "eq" });

  /* ---------- 요약 ---------- */
  const mono = S.filter((s) => s.con === 5).map((s) => SHORT[s.id]), B = E.coBreadth().filter((q) => q.id !== "c_kr" && q.id !== "c_cn").sort((a, b) => b.main + b.part - a.main - a.part);
  const PD = E.partDemand().sort((a, b) => b.any - a.any || b.main - a.main), etchParts = E.PARTS.filter((q) => byId.etch_c.part[q[0]] === 2).length;
  const tk = $("tk");
  [["장비마다 경쟁 구도가 전혀 다르다", "집중도 5점(사실상 한 회사)인 장비가 " + mono.length + "개(" + mono.join(", ") + ")인 반면, CVD·세정처럼 여러 회사와 한국·중국 업체가 함께 뛰는 장비도 있습니다. '반도체 장비'를 하나의 시장으로 보면 이 차이가 사라집니다."],
   ["식각이 부품을 가장 많이 돌린다", "도체 식각 한 장비에 주력으로 들어가는 부품군이 " + etchParts + "개입니다(정전척, 포커스링, 세라믹 링·창, 샤워헤드, 코팅·재생, RF, 진공, 가스). 플라즈마가 부품을 깎아 먹어 설치된 장비가 돌아가는 한 교체 수요가 생깁니다."],
   ["넓게 걸친 회사와 깊게 판 회사", B[0].name + "는 " + (B[0].main + B[0].part) + "개 세그먼트에 걸쳐 있고, ASML·KLA·Disco 같은 회사는 몇 개 장비에 집중해 그 안에서 공급자가 거의 없습니다. 실제 실적에서 이 차이가 어떻게 나타나는지는 심층 분석에서 확인할 수 있습니다."]
  ].forEach((q) => { const d = el("div"); d.appendChild(el("b", { text: q[0] })); d.appendChild(el("p", { text: q[1] })); tk.appendChild(d); });

  /* ---------- 산점도 ---------- */
  (function () { const lg = $("lgd"); Object.keys(E.GROUPS).forEach((g) => { const s = el("span"); const i = el("i"); i.style.background = c(E.GROUPS[g].css); s.appendChild(i); s.appendChild(document.createTextNode(E.GROUPS[g].name)); lg.appendChild(s); }); })();
  function drawSc() {
    const host = $("f-sc"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), nar = W < 560, H = nar ? 400 : 380, l = 46, r2 = W - 16, top = 18, bot = H - 46;
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "장비 세그먼트별 집중도(가로)와 성장 동인(세로), 원 크기는 서비스 중요도" }, host);
    const x = lin(0.5, 5.5, l, r2), y = lin(0.5, 5.5, bot, top);
    for (let v = 1; v <= 5; v++) { sv("line", { x1: l, x2: r2, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, s); tx(s, l - 8, y(v) + 4, String(v), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); tx(s, x(v), bot + 18, String(v), { "text-anchor": "middle", "font-size": 10, fill: c("--muted"), class: "n" }); }
    tx(s, r2, bot + 36, "집중도 → (5 = 사실상 한 회사)", { "text-anchor": "end", "font-size": 10.5, fill: c("--muted") }); tx(s, l, top - 6, "성장 동인 ↑", { "font-size": 10.5, fill: c("--muted") });
    const cells = {}; S.forEach((sg) => { const k = sg.con + "_" + sg.g; (cells[k] = cells[k] || []).push(sg); });
    const colW = (r2 - l) / 5, num = {}; S.forEach((sg, i) => { num[sg.id] = i + 1; });
    Object.keys(cells).forEach((k) => { const g = cells[k], step = Math.min(colW / g.length, nar ? 26 : 38);
      g.forEach((sg, i) => { const px = x(sg.con) + (i - (g.length - 1) / 2) * step, py = y(sg.g) + (i % 2 ? 9 : -9) * (g.length > 1 ? 1 : 0), rad = 4 + sg.svc * (nar ? 1.6 : 2.4);
        sv("circle", { cx: px, cy: py, r: rad, fill: c(E.GROUPS[sg.grp].css), opacity: 0.35, stroke: c(E.GROUPS[sg.grp].css), "stroke-width": 1.4 }, s);
        tx(s, px, py + 4, String(num[sg.id]), { "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: c("--ink"), class: "n" }); }); });
    $("sc-key").textContent = "번호: " + S.map((sg) => num[sg.id] + " " + SHORT[sg.id]).join(" · ");
  }
  (function () {
    const hot = S.filter((sg) => sg.con >= 4 && sg.g >= 4).map((sg) => SHORT[sg.id]), open = S.filter((sg) => sg.con <= 3 && sg.g >= 4).map((sg) => SHORT[sg.id]);
    $("sc-note").textContent = "오른쪽 위(공급자가 적고 성장 동인이 강한 자리)는 " + hot.join(", ") + "입니다. 이 장비를 만드는 회사는 가격 결정력이 크고, 이 장비에 들어가는 부품은 고객 인증 문턱이 높습니다. 왼쪽 위(성장은 강한데 공급자가 여럿인 자리)는 " + open.join(", ") + "로, 새 공급자가 자리를 얻을 여지가 상대적으로 큰 곳입니다.";
    const tb = $("eval-tb"); tb.appendChild(el("thead", null, [el("tr", null, ["장비", "공정 단계", "성숙도", "집중도", "성장 동인", "중국 노출", "서비스 중요도", "주력 업체", "근거"].map((h) => el("th", { text: h, scope: "col" })))]));
    const body = el("tbody"), stepName = {}; E.STEPS.forEach((q) => { stepName[q[0]] = q[1]; });
    S.forEach((sg) => { const tr = el("tr"); tr.appendChild(el("th", { text: sg.name, scope: "row" }));
      [Object.keys(sg.step).filter((k) => sg.step[k] === 2).map((k) => stepName[k]).join(", "), sg.m, sg.con, sg.g, sg.cn, sg.svc, Object.keys(sg.co).filter((k) => sg.co[k] === 2).map((k) => coName[k]).join(", "), sg.why].forEach((v) => tr.appendChild(el("td", { text: String(v) }))); body.appendChild(tr); });
    tb.appendChild(body);
    const ct = $("co-tb"); ct.appendChild(el("thead", null, [el("tr", null, ["업체", "주력 세그먼트", "참여 세그먼트", "걸친 공정 묶음 수", "주력 장비"].map((h) => el("th", { text: h, scope: "col" })))]));
    const cb = el("tbody");
    E.coBreadth().sort((a, b) => b.main + b.part - a.main - a.part).forEach((q) => { const tr = el("tr"); tr.appendChild(el("th", { text: q.name, scope: "row" }));
      [q.main, q.part, q.groups, S.filter((sg) => sg.co[q.id] === 2).map((sg) => SHORT[sg.id]).join(", ") || "–"].forEach((v) => tr.appendChild(el("td", { text: String(v) }))); cb.appendChild(tr); });
    ct.appendChild(cb);
  })();

  /* ---------- 부품 수요 ---------- */
  function drawPart() {
    const host = $("f-part"); host.textContent = "";
    const W = Math.max(300, Math.round(host.clientWidth || 680)), rowH = 24, l = 150, r2 = W - 40, H = PD.length * rowH + 30;
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "부품군별로 그 부품을 쓰는 장비 세그먼트 수" }, host);
    const mx = Math.max.apply(null, PD.map((q) => q.any)), x = lin(0, mx, l, r2);
    PD.forEach((q, i) => { const yy = 10 + i * rowH, linked = !!E.PART_LINK[q.id];
      tx(s, l - 8, yy + 14, q.name + (linked ? " ↗" : ""), { "text-anchor": "end", "font-size": 11, fill: c("--ink"), "font-weight": linked ? 700 : 500 });
      sv("rect", { x: l, y: yy + 3, width: Math.max(1, x(q.any) - l), height: rowH - 8, fill: c("--input"), opacity: 0.25, rx: 2 }, s);
      sv("rect", { x: l, y: yy + 3, width: Math.max(1, x(q.main) - l), height: rowH - 8, fill: c("--input"), rx: 2 }, s);
      tx(s, x(q.any) + 6, yy + 14, q.main + " / " + q.any, { "font-size": 10.5, fill: c("--ink-2"), class: "n" }); });
    const top = PD[0];
    $("part-note").textContent = "굵은 이름(↗)은 부품 세그먼트 지도에서 소재·제조기술까지 나눠 본 부품입니다. 가장 많은 장비에 들어가는 부품군은 " + top.name + "(" + top.any + "개 장비)이고, 정전척·포커스링·코팅 재생처럼 식각·증착 몇 개 장비에 몰린 부품은 그 장비의 설치 대수와 가동률이 곧 수요입니다.";
  }

  /* ---------- 외부 변수·실무·한계 ---------- */
  (function () {
    const ul = $("facts");
    [["장비 투자는 2028년까지 커지는 전망입니다.", "SEMI는 웨이퍼 팹 장비 매출이 2025년 1,169억 달러에서 2026년 1,439억 달러(+23.1%), 2027년 +21.8%, 2028년 +14.1%로 2,000억 달러 수준에 이를 것으로 봤습니다. 선단 로직과 HBM용 DRAM 투자가 이끈다는 설명입니다.", "SEMI 2026년 중간 전망(EMSNow 보도)"],
     ["중국은 장비를 빠르게 국산화하고 있습니다.", "중국 반도체 장비 국산화율은 2021년 8%에서 2025년 23.2%로 올랐고 2030년 39%로 전망됩니다. 중국 노출 점수가 높은 장비(식각, CVD, 세정, DUV)일수록 외국 업체의 중국 몫이 줄어드는 방향입니다.", "Yole Group, 2026.6.22"],
     ["해외 대형 장비사의 중국 매출 비중은 30% 안팎입니다.", "최근 회계연도 기준 ASML 29%, Applied Materials 27%, Lam Research 34%, Tokyo Electron 34%, KLA 30%입니다. 한두 해 전보다 낮아졌지만 여전히 가장 큰 단일 지역입니다.", "각사 공시(심층 분석 페이지에서 계산)"]
    ].forEach((q) => { const x = el("li"); x.appendChild(el("b", { text: q[0] + " " })); x.appendChild(document.createTextNode(q[1])); x.appendChild(el("small", { text: "출처: " + q[2] })); ul.appendChild(x); });
    li($("use-list"), [
      ["부품 수요 전망은 장비 세그먼트 단위로 세웁니다.", " 'WFE가 20% 늘어난다'는 전망을 그대로 부품 매출 증가율로 쓰면 틀리기 쉽습니다. 내 부품이 들어가는 장비(예: 식각·증착)의 성장과 설치 대수, 가동률로 나눠 봐야 합니다."],
      ["고객 집중도와 공급자 집중도를 함께 봅니다.", " 집중도가 높은 장비에 들어가는 부품은 그 장비사 한두 곳이 곧 시장입니다. 인증을 받으면 오래 가지만, 한 고객의 일정·정책 변화에 매출이 크게 흔들립니다."],
      ["설치 기반(서비스) 매출의 비중을 따로 관리합니다.", " 서비스 중요도가 높은 장비에 들어가는 소모 부품은 장비 출하가 줄어도 가동률이 유지되면 팔립니다. 사업계획에서 신규 장비 연동 매출과 교체 수요 매출을 나눠 잡으면 하강기 오차가 줄어듭니다."],
      ["중국 노출은 기회와 위험을 같이 봅니다.", " 국산화가 빠른 장비일수록 중국 장비사가 새 부품 고객이 될 수 있지만, 수출통제와 가격 경쟁이 함께 따라옵니다."]
    ]);
    li($("lim-list"), [
      ["점수와 업체 칸은 정성 판단입니다.", " 각사 공시의 제품군과 일반 공학 지식으로 매겼고, 회사별 점유율 수치는 넣지 않았습니다. 같은 세그먼트 안에서도 세대·용도별로 경쟁 구도가 다릅니다."],
      ["한국·중국 장비사는 묶음으로만 표시했습니다.", " 개별 회사를 평가하지 않기 위해서입니다. 해외 업체도 상장 대형사 위주라 전문 업체가 빠져 있습니다."],
      ["부품군 연결은 대표적인 것만 그렸습니다.", " 장비 한 대에는 수천 개 부품이 들어갑니다. 여기서는 사이클과 소모성이 다른 대표 부품군 14개만 골랐습니다."]
    ]);
  })();

  function all() { drawSc(); drawPart(); }
  all(); F.onRedraw(all);
  if (window.Report) {
    Report.flows($("hero-art"), { area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "장비" }, { x: 0.90, y: 0.22, label: "기술" }, { x: 0.90, y: 0.50, label: "부품" }, { x: 0.90, y: 0.78, label: "업체" }],
      links: [{ from: 0, to: 1, bend: -0.06, c: 0, n: 14, label: "공정" }, { from: 0, to: 2, bend: 0, c: 1, n: 12, label: "소모" }, { from: 0, to: 3, bend: 0.06, c: 2, n: 12, label: "경쟁" }] });
    Report.toc("#toc", ".rpt-body > section"); Report.reveal("[data-rv]");
  }
})();

/* 글 사이의 작은 그림들. 모든 페이지에서 theme.js가 불러온다. 내용 정보는 없고 장식이므로 낭독기에는 숨긴다(aria-hidden).
   1. 홈 구역 머리의 선 그림  2. 홈 경력 항목의 아이콘  3. 도구 페이지 제목 옆 그림  4. 긴 페이지의 읽기 진행 막대 */
(function () {
  "use strict";
  if (window.__art) return; window.__art = true;
  const svg = (w, h, body, cls) => '<svg class="' + cls + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true" focusable="false">' + body + "</svg>";
  const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"', AC = 'stroke="var(--accent)"', AF = 'fill="var(--accent)"', MU = 'stroke="var(--rule)"';
  const ln = (x1, y1, x2, y2, extra) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' + (extra || "") + "/>";
  const dot = (x, y, r, extra) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" ' + (extra || 'fill="currentColor"') + "/>";

  /* ---------- 1. 홈 구역 머리 ---------- */
  const SEC = {
    brief: '<circle cx="34" cy="34" r="22" ' + S + "/>" + '<path d="M34 34V18" ' + S + ' stroke="var(--accent)"/><path d="M34 34l11 7" ' + S + "/>" + ln(70, 22, 112, 22, S) + ln(70, 34, 104, 34, S) + ln(70, 46, 96, 46, S + " " + AC),
    career: '<path d="M8 54h22V42h22V30h22V18h22" ' + S + "/>" + dot(96, 18, 4.5, AF) + ln(8, 60, 112, 60, S + " " + MU),
    cases: '<path d="M10 34h30c14 0 16-18 34-18h14" ' + S + ' stroke="var(--accent)"/><path d="M40 34c14 0 16 18 34 18h14" ' + S + ' stroke-dasharray="3 5"/>' + dot(10, 34, 4) + dot(92, 16, 5, AF) + '<circle cx="92" cy="52" r="4.5" ' + S + "/>",
    reports: [14, 26, 20, 38, 30].map((h, i) => '<rect x="' + (10 + i * 15) + '" y="' + (56 - h) + '" width="9" height="' + h + '" rx="1.5" fill="currentColor" opacity="' + (i === 3 ? 1 : 0.35) + '"' + (i === 3 ? ' style="fill: var(--accent)"' : "") + "/>").join("") + '<circle cx="96" cy="28" r="12" ' + S + "/>" + ln(105, 37, 114, 46, S),
    analytics: '<path d="M6 54c22 0 26-42 54-42s32 42 54 42" ' + S + '/><path d="M84 40c8 8 16 14 30 14H84z" fill="var(--accent)" opacity=".85"/>' + ln(60, 12, 60, 58, S + ' stroke-dasharray="3 4"') + ln(6, 58, 114, 58, S + " " + MU),
    how: '<rect x="8" y="16" width="40" height="12" rx="2" fill="currentColor" opacity=".4"/><rect x="8" y="38" width="40" height="12" rx="2" fill="currentColor" opacity=".4"/>' + ln(58, 28, 70, 28, S) + ln(58, 38, 70, 38, S) + '<path d="M82 34l9 9 18-22" ' + S + ' stroke="var(--accent)" stroke-width="2.4"/>',
    skills: (function () { let g = ""; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) { const on = c < [7, 5, 6, 4][r]; g += dot(12 + c * 14, 12 + r * 14, 3.4, on ? (c === [7, 5, 6, 4][r] - 1 ? AF : 'fill="currentColor"') : 'fill="none" stroke="var(--rule)" stroke-width="1.4"'); } return g; })(),
    contact: '<path d="M10 36l96-26-30 46-18-14-12 12v-18z" ' + S + '/><path d="M46 36l60-26" ' + S + ' stroke="var(--accent)"/>'
  };
  document.querySelectorAll("main > section.block[id] > .wrap > .block-head").forEach((h) => {
    const id = h.closest("section").id; if (!SEC[id] || h.querySelector(".sec-art")) return;
    h.insertAdjacentHTML("beforeend", svg(120, 68, SEC[id], "sec-art"));
  });

  /* ---------- 2. 경력 항목 아이콘 ---------- */
  const IC = [
    '<path d="M3 17l5-6 4 3 7-9" ' + S + '/><path d="M15 5h4v4" ' + S + "/>",                                /* 투자 타당성 */
    dot(6, 7, 3, 'fill="none" stroke="currentColor" stroke-width="1.6"') + dot(16, 15, 3, 'fill="none" stroke="currentColor" stroke-width="1.6"') + ln(8.3, 9, 13.7, 13, S), /* M&A */
    '<circle cx="9" cy="9" r="5.5" ' + S + "/>" + ln(13.2, 13.2, 18.5, 18.5, S),                              /* 리서치 */
    '<rect x="3" y="5" width="16" height="14" rx="2" ' + S + "/>" + ln(3, 10, 19, 10, S) + ln(8, 3, 8, 7, S) + ln(14, 3, 14, 7, S), /* 계획 */
    '<path d="M6 3h8l4 4v12H6z" ' + S + '/><path d="M9 11h6M9 15h6" ' + S + "/>",                              /* 규정 */
    '<path d="M11 3l8 4-8 4-8-4z" ' + S + '/><path d="M3 11l8 4 8-4M3 15l8 4 8-4" ' + S + "/>",                /* 프로젝트 */
    '<path d="M4 11h5V5M4 11c0 4 3 7 7 7s7-3 7-7-3-7-7-7" ' + S + "/>",                                        /* 전환 검토 */
    '<path d="M11 3v16M3 11h16" ' + S + '/><circle cx="11" cy="11" r="8" ' + S + "/>",                         /* 원가 */
    '<rect x="4" y="11" width="3.5" height="8" ' + S + '/><rect x="9.3" y="6" width="3.5" height="13" ' + S + '/><rect x="14.6" y="9" width="3.5" height="10" ' + S + "/>", /* 예산 */
    '<circle cx="11" cy="11" r="8" ' + S + '/><circle cx="11" cy="11" r="3" ' + S + "/>"                       /* MBO */
  ];
  document.querySelectorAll("#career .duty h4").forEach((h, i) => { if (IC[i] && !h.querySelector(".duty-ic")) h.insertAdjacentHTML("afterbegin", svg(22, 22, IC[i], "duty-ic")); });

  /* ---------- 3. 도구 페이지 제목 옆 그림 ---------- */
  const W = 300, H = 150, base = ln(10, 132, 290, 132, S + " " + MU);
  const M = {
    dist: function () { let g = base; const hs = [6, 12, 22, 38, 58, 80, 96, 100, 90, 72, 52, 34, 20, 11, 6]; hs.forEach((h, i) => { g += '<rect x="' + (18 + i * 18) + '" y="' + (132 - h) + '" width="13" height="' + h + '" rx="2" fill="currentColor" opacity="' + (i < 5 ? 0.9 : 0.22) + '"' + (i < 5 ? ' style="fill: var(--accent)"' : "") + "/>"; }); return g + ln(153, 20, 153, 132, S + ' stroke-dasharray="4 5"'); },
    tree: function () { const n = [[40, 75], [120, 40], [120, 110], [200, 22], [200, 58], [200, 92], [200, 128], [270, 58], [270, 92]], e = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [4, 7], [5, 8]]; return e.map((q) => '<path d="M' + n[q[0]][0] + " " + n[q[0]][1] + "C" + (n[q[0]][0] + 40) + " " + n[q[0]][1] + " " + (n[q[1]][0] - 40) + " " + n[q[1]][1] + " " + n[q[1]][0] + " " + n[q[1]][1] + '" ' + S + ' opacity=".5"/>').join("") + n.map((p, i) => dot(p[0], p[1], i === 0 ? 8 : 5.5, i === 0 || i === 5 || i === 8 ? AF : 'fill="var(--paper)" stroke="currentColor" stroke-width="1.6"')).join(""); },
    steps: function () { let d = "M14 126", x = 14, y = 126; [[26, 22], [22, 20], [30, 16], [24, 14], [34, 10], [30, 7], [40, 5], [44, 3]].forEach((s) => { x += s[0]; d += "H" + x; y -= s[1]; d += "V" + y; }); return base + '<path d="' + d + 'H290" ' + S + ' stroke-width="2.2"/>' + ln(178, 14, 178, 132, S + " " + AC + ' stroke-dasharray="4 5"') + dot(178, 54, 5.5, AF); },
    bridge: function () { const v = [[0, 84, 0], [84, 62, 1], [62, 74, 2], [74, 50, 1], [50, 58, 2], [0, 58, 0]]; return base + v.map((q, i) => { const top = 132 - Math.max(q[0], q[1]), h = Math.abs(q[1] - q[0]) || 1; return '<rect x="' + (20 + i * 46) + '" y="' + top + '" width="30" height="' + h + '" rx="2" fill="currentColor" opacity="' + (q[2] === 0 ? 0.85 : 0.5) + '"' + (q[2] === 1 ? ' style="fill: var(--neg)"' : q[2] === 2 ? ' style="fill: var(--pos)"' : "") + "/>"; }).join(""); },
    scatter: function () { let g = base, s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let i = 0; i < 26; i++) { const x = 24 + r() * 250, y = 118 - (x - 24) * 0.34 + (r() - 0.5) * 30; g += dot(x, y, 3.2, 'fill="currentColor" opacity=".45"'); } return g + '<path d="M18 112L288 24v22L18 126z" fill="var(--accent)" opacity=".12"/>' + ln(18, 119, 288, 35, S + " " + AC + ' stroke-width="2"'); },
    flow: function () { const p = [[20, 70], [60, 54], [100, 62], [140, 96], [180, 108], [220, 74], [260, 44], [288, 36]]; return base + ln(10, 100, 290, 100, S + ' stroke-dasharray="4 5" stroke="var(--neg)"') + '<path d="M' + p.map((q) => q.join(" ")).join("L") + '" ' + S + ' stroke-width="2.2"/>' + dot(180, 108, 5.5, AF) + [40, 80, 120, 160, 200, 240].map((x, i) => '<rect x="' + x + '" y="' + (i % 3 === 2 ? 132 : 132 - 12 - (i * 5) % 14) + '" width="10" height="' + (12 + (i * 5) % 14) + '" fill="currentColor" opacity=".25"/>').join(""); },
    curve: function () { return base + '<path d="M16 110C80 40 130 22 170 30s60 50 116 96" ' + S + ' stroke-width="2.2"/>' + '<path d="M16 122C110 112 200 96 286 44" ' + S + ' opacity=".4" stroke-dasharray="4 5"/>' + ln(150, 14, 150, 132, S + " " + AC + ' stroke-dasharray="4 5"') + dot(150, 28, 5.5, AF); },
    range: function () { const r = [[60, 190], [90, 240], [40, 150], [110, 210]]; return r.map((q, i) => '<rect x="' + q[0] + '" y="' + (22 + i * 28) + '" width="' + (q[1] - q[0]) + '" height="14" rx="7" fill="currentColor" opacity=".3"/>').join("") + ln(160, 10, 160, 136, S + " " + AC + ' stroke-width="2"') + dot(160, 136, 4.5, AF); },
    cash: function () { let g = base + '<rect x="24" y="132" width="20" height="16" rx="2" style="fill: var(--accent)"/>'; [18, 34, 46, 54, 60, 64, 66, 68, 70].forEach((h, i) => { g += '<rect x="' + (52 + i * 26) + '" y="' + (132 - h) + '" width="18" height="' + h + '" rx="2" fill="currentColor" opacity=".3"/>'; }); return g + '<path d="M34 146C70 150 120 120 160 90S250 40 286 30" ' + S + ' stroke-width="2.2"/>'; },
    chain: function () { let g = ""; for (let i = 0; i < 5; i++) { const x = 30 + i * 60; if (i < 4) g += ln(x + 14, 75, x + 46, 75, S + ' opacity=".5"'); g += '<rect x="' + (x - 14) + '" y="58" width="28" height="34" rx="6" ' + (i === 2 ? 'fill="var(--accent)" stroke="none"' : S) + "/>"; g += ln(x - 6, 104, x + 6, 104, S + ' opacity=".4"'); } return g; },
    grid: function () { let g = ""; for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) { const k = (r * 7 + c * 3) % 5; g += '<rect x="' + (18 + c * 30) + '" y="' + (12 + r * 26) + '" width="22" height="18" rx="3" fill="currentColor" opacity="' + (0.08 + k * 0.07) + '"' + (k === 4 ? ' style="fill: var(--accent); opacity: .8"' : "") + "/>"; } return g; }
  };
  const PAGE = { "kpi-tree": "tree", "plan-risk": "dist", "budget-opt": "steps", "pl-report": "bridge", "cost-stats": "scatter", "mbo-kpi": "grid", "cash-13w": "flow", "capital": "curve", "doa": "chain", "capex-kit": "cash", "post-review": "bridge", "ma-process": "chain", "ma-valuation": "range", "holdco-nav": "tree", "fx-hedge": "curve", "guide": "grid", "checks": "grid", "index": "grid" };
  const page = (location.pathname.split("/").pop() || "").replace(/\.html$/, ""), hero = document.querySelector(".tool-hero .wrap, .hub-head");
  if (hero && PAGE[page] && /\/tools\//.test(location.pathname) && !hero.querySelector(".hero-art")) hero.insertAdjacentHTML("afterbegin", svg(W, H, M[PAGE[page]](), "hero-art"));

  /* ---------- 4. 읽기 진행 막대 ---------- */
  if (document.documentElement.scrollHeight > window.innerHeight * 2.5) {
    const bar = document.createElement("div"); bar.className = "read-bar"; bar.setAttribute("aria-hidden", "true"); document.body.appendChild(bar);
    let raf = 0;
    const upd = () => { raf = 0; const d = document.documentElement, max = d.scrollHeight - window.innerHeight; bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ")"; };
    window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    upd();
  }
})();

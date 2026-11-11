/* KPI 트리 페이지의 균형성과표 구역. 계산은 assets/engines/bsc.js, 트리 상태는 페이지 스크립트가 window.__kpi로 넘긴다. */
(function () {
  "use strict";
  const F = window.Fin, B = window.BscEngine, K = window.KpiTreeEngine, $ = F.$, NS = "http://www.w3.org/2000/svg";
  if (!B || !K) return;
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const stCol = (s) => (s === 1 ? c("--pos") : s === -1 ? c("--neg") : s === 0.5 ? c("--accent") : c("--mark-muted"));
  const stTxt = (s) => (s === 1 ? "모두 좋아짐" : s === -1 ? "모두 나빠짐" : s === 0.5 ? "엇갈림" : "변화 없음");
  const dec = (m) => (m.src === "calc" ? (m.key === "turn" ? 3 : 1) : m.src === "tree" ? (K.LEAVES[m.key].d || 0) : (m.unit === "건" ? 0 : 1));
  const fv = (v, d) => v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
  function frame(host, H, label) { host.textContent = ""; const W = Math.max(300, Math.round(host.clientWidth || 600)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label, style: "display:block;width:100%;height:auto" }, host), W: W, nar: W < 560 }; }

  function drawMap(sc) {
    const host = document.querySelector("#bsc-map .plot-host"), w0 = Math.max(300, Math.round(host.clientWidth || 600)), nar = w0 < 560;
    const bandH = nar ? 104 : 92, top = 6, H = top + bandH * 4 + 4;
    const fr = frame(host, H, "전략 지도: 학습과 성장 → 내부 프로세스 → 고객 → 재무, 전략 목표 12개와 인과 화살표 15개"), s = fr.svg, W = fr.W;
    const lw = nar ? 8 : 150, gap = nar ? 8 : 18, bw = (W - lw - 8 - gap * 2) / 3, bh = nar ? 56 : 50;
    const pos = {};
    sv("defs", {}, s).innerHTML = '<marker id="bsc-ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L8,4L0,8z" fill="' + c("--muted") + '"/></marker><marker id="bsc-ahr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L8,4L0,8z" fill="' + c("--neg") + '"/></marker>';
    B.PERSP.forEach((p, i) => {
      const y0 = top + i * bandH;
      sv("rect", { x: 0, y: y0, width: W, height: bandH - 6, fill: i % 2 ? "none" : c("--rule-soft"), opacity: 0.45, rx: 4 }, s);
      if (nar) tx(s, 8, y0 + 14, p.label + " · " + p.q, { "font-size": 10.5, "font-weight": 700, fill: c("--ink") });
      else { tx(s, 12, y0 + bandH / 2 - 4, p.label, { "font-size": 12.5, "font-weight": 700, fill: c("--ink") }); tx(s, 12, y0 + bandH / 2 + 12, p.q, { "font-size": 9.5, fill: c("--muted") }); }
      sc.filter((o) => o.p === p.id).forEach((o, k) => { const x = lw + k * (bw + gap), y = y0 + (nar ? 22 : (bandH - 6 - bh) / 2); pos[o.id] = { x: x, y: y, cx: x + bw / 2, o: o }; });
    });
    const byId = {}; sc.forEach((o) => { byId[o.id] = o; });
    const broken = [];
    const g = sv("g", {}, s);
    B.LINKS.forEach((l) => {
      const a = pos[l[0]], b = pos[l[1]], isBroken = byId[l[0]].status === 1 && byId[l[1]].status === -1; if (isBroken) broken.push(l);
      const st = { fill: "none", stroke: isBroken ? c("--neg") : c("--muted"), "stroke-width": isBroken ? 1.8 : 1.1, opacity: isBroken ? 0.95 : 0.55, "stroke-dasharray": isBroken ? "5 3" : null, "marker-end": "url(#" + (isBroken ? "bsc-ahr" : "bsc-ah") + ")" };
      let d;
      if (a.y === b.y) { const dir = b.x > a.x ? 1 : -1, sx = dir > 0 ? a.x + bw : a.x, ex = dir > 0 ? b.x : b.x + bw, yy = a.y + bh / 2; d = "M" + sx + "," + yy + "L" + (ex - dir * 2) + "," + yy; }
      else {
        const sx = a.cx + (b.cx - a.cx) * 0.18, sy = a.y, ex = b.cx + (a.cx - b.cx) * 0.18, ey = b.y + bh + 2;
        if (Math.abs(sy - ey) > bandH * 1.2) { const ca = Math.round((a.x - lw) / (bw + gap)), cb = Math.round((b.x - lw) / (bw + gap)), gc = ca !== cb ? Math.max(ca, cb) : (ca > 0 ? ca : 1), gx = lw + gc * (bw + gap) - gap / 2, mid = (sy + ey) / 2; d = "M" + sx + "," + sy + "C" + sx + "," + (sy - 20) + " " + gx + "," + (mid + 30) + " " + gx + "," + mid + "S" + ex + "," + (ey + 20) + " " + ex + "," + ey; }
        else d = "M" + sx + "," + sy + "C" + sx + "," + (sy - 18) + " " + ex + "," + (ey + 18) + " " + ex + "," + ey;
      }
      sv("path", Object.assign({ d: d }, st), g);
    });
    sc.forEach((o) => {
      const q = pos[o.id], col = stCol(o.status), gg = sv("g", {}, s);
      sv("title", {}, gg).textContent = o.label + " · " + stTxt(o.status) + " · " + o.ms.map((m) => m.label + (m.good > 0 ? " 좋아짐" : m.good < 0 ? " 나빠짐" : " 같음")).join(", ");
      sv("rect", { x: q.x, y: q.y, width: bw, height: bh, rx: 5, fill: c("--surface"), stroke: col, "stroke-width": 1.6 }, gg);
      sv("rect", { x: q.x, y: q.y, width: 5, height: bh, rx: 2, fill: col }, gg);
      tx(gg, q.x + 12, q.y + (nar ? 18 : 20), nar ? B.OBJ.find((b) => b.id === o.id).s : o.label, { "font-size": nar ? 10.5 : 12.5, "font-weight": 700, fill: c("--ink") });
      let xx = q.x + 12; const yy = q.y + bh - (nar ? 10 : 12);
      o.ms.forEach((m) => { const t = tx(gg, xx, yy, m.good > 0 ? "▲" : m.good < 0 ? "▼" : "–", { "font-size": nar ? 10 : 11, fill: m.good > 0 ? c("--pos") : m.good < 0 ? c("--neg-ink") : c("--muted") }); xx += nar ? 11 : 13; });
      if (!nar) tx(gg, q.x + bw - 8, yy, o.ms.length + "개 지표", { "text-anchor": "end", "font-size": 10, fill: c("--muted") });
    });
    return broken;
  }

  function table(sc) {
    const t = $("bsc-tb"); t.textContent = "";
    const hd = F.el("thead"), hr = F.el("tr"); ["관점", "전략 목표", "지표", "구분", "출처", "계획", "실적", "판정", "담당"].forEach((h, j) => hr.appendChild(F.el("th", { text: h, class: j < 5 || j > 6 ? "l" : null, scope: "col" }))); hd.appendChild(hr); t.appendChild(hd);
    const tb = F.el("tbody");
    sc.forEach((o) => o.ms.forEach((m, i) => {
      const tr = F.el("tr");
      tr.appendChild(F.el("td", { text: i ? "" : B.PERSP.find((p) => p.id === o.p).label }));
      tr.appendChild(i ? F.el("td", { class: "txt l", text: "" }) : F.el("th", { class: "l", scope: "row", text: o.label }));
      tr.appendChild(F.el("td", { class: "txt l", text: m.label + " (" + m.unit + ")" }));
      tr.appendChild(F.el("td", { class: "txt l", text: m.lead ? "선행" : "후행" }));
      tr.appendChild(F.el("td", { class: "txt l", text: m.src === "own" ? "추가(가상)" : "KPI 트리" }));
      tr.appendChild(F.el("td", { class: "num", text: fv(m.plan, dec(m)) }));
      tr.appendChild(F.el("td", { class: "num", text: fv(m.act, dec(m)) }));
      tr.appendChild(F.el("td", { class: "txt l " + (m.good > 0 ? "pos" : m.good < 0 ? "neg" : ""), text: m.good > 0 ? "▲ 좋아짐" : m.good < 0 ? "▼ 나빠짐" : "– 같음" }));
      tr.appendChild(F.el("td", { class: "txt l", text: m.owner }));
      tb.appendChild(tr);
    }));
    t.appendChild(tb);
  }

  function memo(sc, broken) {
    const all = [].concat.apply([], sc.map((o) => o.ms)), lag = all.filter((m) => !m.lead && sc.some((o) => o.p === "F" && o.ms.indexOf(m) >= 0)), lead = all.filter((m) => m.lead);
    const lagBad = lag.filter((m) => m.good < 0), leadBad = lead.filter((m) => m.good < 0).sort((a, b) => a.rel * a.dir - b.rel * b.dir);
    const name = (id) => sc.find((o) => o.id === id).label;
    let t = "재무 관점 지표 " + lag.length + "개 중 " + lagBad.length + "개가 계획에 못 미쳤습니다. 먼저 움직이는 선행 지표 " + lead.length + "개 중 " + leadBad.length + "개가 이미 나빠져 있었고, 계획 대비 낙폭이 큰 것은 " + leadBad.slice(0, 3).map((m) => m.label).join(", ") + "입니다. ";
    if (broken.length) t += "전략 지도에서 원인 쪽은 좋아졌는데 결과 쪽은 나빠진 화살표는 " + broken.length + "개(" + broken.map((l) => name(l[0]) + " → " + name(l[1])).join(", ") + ")입니다. 역량이 실행으로 이어지지 않는 고리이므로, 이 가설과 중간 실행 과제(" + sc.filter((o) => o.p === "L" && o.status === -1).map((o) => o.label).join(", ") + ")를 먼저 점검합니다.";
    else t += "원인이 좋아졌는데 결과가 나빠진 화살표는 없습니다.";
    if (!lead.length) t = "선행 지표가 없습니다.";
    $("bsc-memo").textContent = t;
  }

  /* 선행·후행 검증 */
  const SR = B.series(), XC = B.xcorr(SR.lead, SR.lag, 6), peak = XC.reduce((b, x) => (x.r > b.r ? x : b));
  function drawXc() {
    const host = document.querySelector("#bsc-xc .plot-host"), fr = frame(host, 220, "시차 0~6개월별 OEE와 매출총이익률의 상관, 2개월에서 가장 높음"), s = fr.svg, W = fr.W;
    const l = 40, r = W - 12, x = lin(-0.5, 6.5, l, r), y = lin(-0.2, 1, 180, 14), bw = (r - l) / 7 * 0.6, th = 2 / Math.sqrt(SR.lead.length);
    [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1].forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: v === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(v) + 4, v.toFixed(1), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
    [th, -th].forEach((v) => sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: c("--muted"), "stroke-dasharray": "4 3" }, s));
    XC.forEach((q) => { const on = q.lag === peak.lag; sv("rect", { x: x(q.lag) - bw / 2, y: y(Math.max(0, q.r)), width: bw, height: Math.abs(y(q.r) - y(0)), fill: c("--input"), opacity: on ? 0.95 : 0.45, rx: 2 }, s);
      tx(s, x(q.lag), y(Math.max(0, q.r)) - 5, q.r.toFixed(2), { "text-anchor": "middle", "font-size": 10, fill: on ? c("--ink") : c("--muted"), "font-weight": on ? 700 : 400, class: "n" }); tx(s, x(q.lag), 196, fr.nar ? String(q.lag) : q.lag + "개월", { "text-anchor": "middle", "font-size": 10, fill: c("--muted") }); });
    tx(s, r, 214, "k = OEE가 앞서는 달 수", { "text-anchor": "end", "font-size": 10, fill: c("--muted") });
  }
  function drawTs() {
    const host = document.querySelector("#bsc-ts .plot-host"), fr = frame(host, 220, "OEE를 " + peak.lag + "개월 밀어 매출총이익률과 겹친 표준화 점수 선그래프"), s = fr.svg, W = fr.W;
    const z = (a) => { const m = a.reduce((p, v) => p + v, 0) / a.length, sd = Math.sqrt(a.reduce((p, v) => p + (v - m) * (v - m), 0) / (a.length - 1)); return a.map((v) => (v - m) / sd); };
    const k = peak.lag, a = z(SR.lead.slice(0, SR.lead.length - k)), b = z(SR.lag.slice(k)), n = a.length;
    const l = 30, r = W - 10, x = lin(0, n - 1, l, r), y = lin(-3, 3, 186, 10);
    [-2, -1, 0, 1, 2].forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: v === 0 ? c("--ink-2") : c("--rule-soft") }, s); tx(s, l - 6, y(v) + 4, String(v), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
    const path = (arr) => "M" + arr.map((v, i) => x(i).toFixed(1) + "," + y(Math.max(-3, Math.min(3, v))).toFixed(1)).join("L");
    sv("path", { d: path(a), fill: "none", stroke: c("--input"), "stroke-width": 2 }, s);
    sv("path", { d: path(b), fill: "none", stroke: c("--accent"), "stroke-width": 2 }, s);
    [0, 6, 12, 18, 24, 30].filter((i) => i < n).forEach((i) => tx(s, x(i), 202, (i + 1 + k) + "월", { "text-anchor": "middle", "font-size": 10, fill: c("--muted") }));
    tx(s, r, 216, "가로축: 매출총이익률의 달(가상 " + SR.lead.length + "개월)", { "text-anchor": "end", "font-size": 10, fill: c("--muted") });
  }

  let cur = null;
  function render() {
    const st = window.__kpi; if (!st) return; cur = st;
    const sc = B.score(st.x, st.a.plan, st.a.act), broken = drawMap(sc);
    table(sc); memo(sc, broken); drawXc(); drawTs();
    $("bsc-xc-note").textContent = "가상 자료에서 상관은 " + peak.lag + "개월 시차에서 " + peak.r.toFixed(2) + "로 가장 높고, 같은 달(0개월)은 " + XC[0].r.toFixed(2) + "입니다. 같은 달 숫자만 비교하면 OEE와 이익률의 관계를 과소평가하고, 'OEE가 떨어지면 두 달 뒤 이익률이 떨어진다'는 조기 경보도 놓칩니다. 실제로 쓰려면 2~3년 월별 자료로 같은 확인을 하고, 계절성이나 공통 원인(예: 수요 급감이 둘 다 끌어내림)을 먼저 걷어 냅니다.";
    const cov = B.coverage(K.KEYS), ids = new Set(B.OBJ.map((o) => o.id));
    const chk = $("bsc-check"); chk.textContent = "";
    [["트리 말단 13개가 네 관점에 빠짐없이 한 번씩", !cov.missing.length && !cov.dup.length && !cov.extra.length],
     ["화살표는 모두 아래(또는 같은) 관점에서 위로", B.LINKS.every((l) => ids.has(l[0]) && ids.has(l[1]) && "LPCF".indexOf(l[0][0]) <= "LPCF".indexOf(l[1][0]))],
     ["시차별 상관의 최고점 = 심어 둔 시차(" + SR.planted + "개월)", peak.lag === SR.planted],
     ["시차 0 상관 = 두 계열의 피어슨 상관", Math.abs(XC[0].r - B.corr(SR.lead, SR.lag)) < 1e-12]
    ].forEach((q) => chk.appendChild(F.el("span", { class: q[1] ? null : "fail", text: q[0] })));
  }
  document.addEventListener("kpi:render", render);
  render();
  F.onRedraw(() => { if (cur) render(); });
})();

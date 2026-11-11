/* 자산 손상·운전자본 키트(tools/asset-kit.html) 화면. 계산은 assets/engines/asset.js */
(function () {
  "use strict";
  const F = window.Fin, A = window.AssetEngine, $ = F.$, NS = "http://www.w3.org/2000/svg";
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const path = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const sg = (v, d) => (v > 0 ? "+" : "") + fmt(v, d);
  const pc = (v, d) => fmt(v * 100, d === undefined ? 1 : d) + "%";
  const put = (o) => { for (const k in o) { const e = $(k); if (e) e.textContent = o[k]; } };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-6) * Math.max(1, Math.abs(a), Math.abs(b));
  function frame(id, H, label) { const host = $(id); host.textContent = ""; const W = Math.max(280, Math.round(host.clientWidth || 560)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, host), W: W, nar: W < 480 }; }
  function table(id, head, rows, opt) {
    const host = $(id); host.textContent = ""; opt = opt || {};
    const th = F.el("thead"), tr = F.el("tr"); head.forEach((h) => tr.appendChild(F.el("th", { text: h }))); th.appendChild(tr); host.appendChild(th);
    const tb = F.el("tbody");
    rows.forEach((r, i) => { const row = F.el("tr", { class: (opt.sum && i === rows.length - 1) ? "sum" : null }); r.forEach((v, j) => { const cell = F.el(j ? "td" : "th", { text: v && v.t !== undefined ? v.t : String(v) }); if (v && v.c) cell.className = v.c; row.appendChild(cell); }); tb.appendChild(row); });
    host.appendChild(tb);
  }
  function checks(id, list) { const host = $(id); host.textContent = ""; list.forEach((q) => host.appendChild(F.el("span", { class: q[1] ? null : "fail", text: q[0] }))); }
  function bind(formId, getObj, draw) {
    document.querySelectorAll("#" + formId + " input").forEach((i) => i.addEventListener("input", () => { const v = +i.value; if (i.value === "" || !isFinite(v)) return; const o = getObj(); if (i.dataset.a !== undefined) o.assets[+i.dataset.a][1] = v; else if (i.dataset.t) o.target[i.dataset.t] = v; else o[i.dataset.k] = v; draw(); }));
  }
  function fill(formId, o) { document.querySelectorAll("#" + formId + " input").forEach((i) => { i.value = i.dataset.a !== undefined ? o.assets[+i.dataset.a][1] : i.dataset.t ? o.target[i.dataset.t] : o[i.dataset.k]; }); }

  /* ================= 손상검사 ================= */
  let P = clone(A.IMP);
  function drawImp() {
    P.shock = +$("imp-shock").value; $("imp-sv").textContent = P.shock + "%";
    const I = A.impairment(P), v = I.viu;
    if (P.gT >= P.r) { $("ik2-memo").textContent = "영구성장률은 할인율보다 낮아야 계산됩니다."; return; }
    put({ "ik2-car": fmt(I.carrying), "ik2-car-sub": "영업권 " + fmt(P.assets[0][1]) + " 포함", "ik2-rec": fmt(I.rec), "ik2-rec-sub": I.basis === "사용가치" ? "사용가치 기준 · 공정가치 " + fmt(P.fv) : "공정가치 기준 · 사용가치 " + fmt(v.value),
      "ik2-hl": I.loss > 0 ? "손상차손" : "여유", "ik2-hd": I.loss > 0 ? fmt(-I.loss) : "+" + fmt(I.headroom), "ik2-hd-sub": I.loss > 0 ? "영업권부터 줄임" : "장부금액 대비 " + pc(I.headroom / I.carrying, 0),
      "ik2-be": I.beR !== null ? pc(I.beR / 100, 1) : "—", "ik2-be-sub": "현재 " + pc(P.r / 100, 1) + (I.beCut > 0 ? " · 현금흐름 " + pc(I.beCut, 0) + " 줄면 0" : " · 사용가치가 이미 장부금액 아래"), "imp-tvs": pc(v.tvShare, 0) });
    $("ik2-memo").textContent = I.loss > 0
      ? "업황 악화로 내년 현금흐름이 " + P.shock + "% 줄면 회수가능액은 " + fmt(I.rec) + "억원(" + I.basis + ")으로 장부금액 " + fmt(I.carrying) + "억원보다 " + fmt(I.loss) + "억원 적습니다. 영업권 " + fmt(I.alloc[0], 1) + "억원을 먼저 줄이고 나머지 " + fmt(I.loss - I.alloc[0], 1) + "억원을 유형·무형자산에 나눕니다. 손상차손은 그해 손익에 바로 반영되고, 영업권 손상은 나중에 회복돼도 되돌리지 않으므로 사업계획 대비 이익과 자본에 바로 영향을 줍니다."
      : "회수가능액 " + fmt(I.rec) + "억원(" + I.basis + ")이 장부금액 " + fmt(I.carrying) + "억원보다 " + fmt(I.headroom) + "억원 많아 손상은 없습니다. 다만 할인율이 " + (I.beR ? pc(I.beR / 100, 1) : "—") + "로 오르거나 현금흐름이 전 기간 " + pc(Math.max(0, I.beCut), 0) + " 줄면 여유가 사라집니다. 이 두 숫자를 업황 시나리오와 함께 보고하면 손상 위험을 미리 알릴 수 있습니다.";
    /* 비교 막대 */
    const fr = frame("imp-fig", 220, "장부금액, 사용가치, 공정가치 비교"), s = fr.svg, l = fr.nar ? 70 : 96, r = fr.W - 54, mx = Math.max(I.carrying, v.value, P.fv) * 1.08, x = lin(0, mx, l, r);
    const rows = [["장부금액", I.carrying, c("--total")], ["사용가치", v.value, I.basis === "사용가치" ? c("--input") : c("--mark-muted")], ["공정가치", P.fv, I.basis === "공정가치" ? c("--input") : c("--mark-muted")]];
    rows.forEach((q, i) => { const yy = 18 + i * 52; tx(s, l - 8, yy + 17, q[0], { "text-anchor": "end", fill: c("--ink") });
      if (i === 0) { let acc = 0; P.assets.forEach((a, k) => { sv("rect", { x: x(acc), y: yy, width: Math.max(0, x(acc + a[1]) - x(acc)), height: 26, fill: c("--total"), opacity: 0.55 + 0.15 * k, stroke: c("--surface") }, s); acc += a[1]; }); }
      else if (i === 1) { sv("rect", { x: x(0), y: yy, width: x(v.pvCf) - x(0), height: 26, fill: q[2], opacity: 0.9 }, s); sv("rect", { x: x(v.pvCf), y: yy, width: x(v.value) - x(v.pvCf), height: 26, fill: q[2], opacity: 0.5 }, s); if (!fr.nar) tx(s, x(v.value) - 6, yy + 40, "옅은 부분: 5년 뒤 잔존가치", { "text-anchor": "end", fill: c("--muted"), "font-size": 10 }); }
      else sv("rect", { x: x(0), y: yy, width: x(q[1]) - x(0), height: 26, fill: q[2], opacity: 0.85 }, s);
      tx(s, x(q[1]) + 6, yy + 17, fmt(q[1]), { class: "n", fill: c("--ink"), "font-weight": 700 }); });
    sv("line", { x1: x(I.carrying), x2: x(I.carrying), y1: 10, y2: 176, stroke: c("--neg"), "stroke-dasharray": "4 3" }, s);
    tx(s, l, 210, "장부금액 막대: 영업권 · 유형자산 · 무형자산", { fill: c("--muted"), "font-size": 10 });
    /* 충격 곡선 */
    const f2 = frame("imp-shock-fig", 220, "현금흐름 하락률별 회수가능액"), s2 = f2.svg, l2 = 46, r2 = f2.W - 12, x2 = lin(0, 50, l2, r2), pts = [];
    for (let k = 0; k <= 50; k += 1) { const q = Object.assign({}, P, { shock: k }); pts.push([k, Math.max(A.viu(q).value, P.fv)]); }
    const yl = Math.min(I.carrying, P.fv, pts[50][1]) * 0.85, yh = Math.max(pts[0][1], I.carrying) * 1.05, y2 = lin(yl, yh, 180, 14);
    F.niceTicks(yl, yh, 4).ticks.forEach((t) => { if (y2(t) < 12 || y2(t) > 182) return; sv("line", { x1: l2, x2: r2, y1: y2(t), y2: y2(t), stroke: c("--rule-soft") }, s2); tx(s2, l2 - 6, y2(t) + 4, fmt(t), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    const cross = pts.find((p) => p[1] < I.carrying);
    if (cross) sv("rect", { x: x2(cross[0]), y: 14, width: r2 - x2(cross[0]), height: 166, fill: c("--neg"), opacity: 0.06 }, s2);
    sv("line", { x1: l2, x2: r2, y1: y2(I.carrying), y2: y2(I.carrying), stroke: c("--neg"), "stroke-dasharray": "5 4" }, s2); tx(s2, r2, y2(I.carrying) - 6, "장부금액 " + fmt(I.carrying), { "text-anchor": "end", fill: c("--neg-ink"), "font-size": 10.5 });
    sv("path", { d: path(pts.map((p) => [x2(p[0]), y2(p[1])])), fill: "none", stroke: c("--input"), "stroke-width": 2.4 }, s2);
    sv("circle", { cx: x2(P.shock), cy: y2(I.rec), r: 5.5, fill: c("--accent"), stroke: c("--surface"), "stroke-width": 2 }, s2);
    if (cross) tx(s2, x2(cross[0]) + 4, 28, "하락 " + cross[0] + "%부터 손상", { fill: c("--neg-ink"), "font-size": 10.5, "font-weight": 700 });
    [0, 10, 20, 30, 40, 50].forEach((k) => tx(s2, x2(k), 196, k + "%", { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }));
    tx(s2, r2, 214, "내년 현금흐름 하락률 · 세로축 회수가능액(공정가치가 바닥)", { "text-anchor": "end", fill: c("--muted"), "font-size": 10 });
    table("imp-alloc", ["자산", "장부금액", "손상차손 배분", "손상 후"], P.assets.map((a, k) => [a[0], fmt(a[1]), { t: I.alloc[k] ? fmt(-I.alloc[k], 1) : "0", c: I.alloc[k] ? "u" : "" }, fmt(a[1] - I.alloc[k], 1)]).concat([["합계", fmt(I.carrying), { t: I.loss ? fmt(-I.loss, 1) : "0", c: I.loss ? "u" : "" }, fmt(I.carrying - I.loss, 1)]]), { sum: true });
    const rs = [P.r - 2, P.r - 1, P.r, P.r + 1, P.r + 2, P.r + 3], gs = [P.gT - 1, P.gT, P.gT + 1], G = A.grid(P, rs, gs);
    table("imp-grid", ["할인율 \\ 영구성장률"].concat(gs.map((g) => pc(g / 100, 1))), rs.map((r, i) => [pc(r / 100, 1) + (r === P.r ? " ◀" : "")].concat(G[i].map((h) => ({ t: sg(h), c: h < 0 ? "u" : "" })))));
    checks("imp-check", [["회수가능액 = max(사용가치, 공정가치)", near(I.rec, Math.max(v.value, P.fv))], ["배분 합계 = 손상차손, 영업권 먼저", near(sum(I.alloc), I.loss) && (I.loss <= P.assets[0][1] ? near(I.alloc[0], I.loss) : near(I.alloc[0], P.assets[0][1]))], ["손익분기 할인율에서 사용가치 = 장부금액", I.beR === null || near(A.viu(P, I.beR).value, I.carrying, 1e-6)], ["현금흐름 배수가 1 − 감소율이면 사용가치 = 장부금액", near(A.viu(P, undefined, undefined, 1 - I.beCut).value, I.carrying, 1e-9)]]);
  }
  bind("imp-form", () => P, drawImp); $("imp-shock").addEventListener("input", drawImp);
  $("imp-reset").addEventListener("click", () => { P = clone(A.IMP); $("imp-shock").value = 0; fill("imp-form", P); drawImp(); });

  /* ================= 운전자본 ================= */
  let Wc = clone(A.WC);
  function drawWc() {
    const R = A.wc(Wc);
    put({ "wk-ccc": fmt(R.ccc, 1) + "일", "wk-ccc-sub": "목표 " + fmt(R.cccT, 0) + "일 · " + fmt(R.dso, 0) + " + " + fmt(R.dio, 0) + " − " + fmt(R.dpo, 0), "wk-rel": fmt(R.release, 0), "wk-rel-sub": "순운전자본 " + fmt(R.nwc) + "의 " + pc(R.release / R.nwc, 0),
      "wk-roic": pc(R.roic0, 1) + " → " + pc(R.roic1, 1), "wk-roic-sub": "투하자본 " + fmt(Wc.ic) + " → " + fmt(Wc.ic - R.release), "wk-need": fmt(R.needGrowth, 0), "wk-need-sub": "목표 달성 시 " + fmt(R.needGrowthT, 0) + " (성장 " + Wc.growth + "%)" });
    $("wk-memo").textContent = "현금전환주기는 " + fmt(R.ccc, 1) + "일입니다. 매출채권 회전일을 " + Wc.target.dso + "일, 재고 " + Wc.target.dio + "일, 매입채무 " + Wc.target.dpo + "일로 맞추면 " + fmt(R.release, 0) + "억원의 현금이 풀리고(매출채권 " + fmt(R.rel.ar, 0) + ", 재고 " + fmt(R.rel.inv, 0) + ", 매입채무 " + fmt(R.rel.ap, 0) + "), 같은 이익으로 ROIC는 " + pc(R.roic0, 1) + "에서 " + pc(R.roic1, 1) + "로 오릅니다. 내년 매출이 " + Wc.growth + "% 늘면 운전자본이 " + fmt(R.needGrowth, 0) + "억원 더 필요하지만, 목표 회전일이면 " + fmt(R.needGrowthT, 0) + "억원으로 줄어듭니다.";
    /* 날수 막대 */
    const fr = frame("wc-fig", 170, "현금전환주기 구성: 재고 회전일, 매출채권 회전일, 매입채무 회전일"), s = fr.svg, l = fr.nar ? 50 : 70, r = fr.W - 12, mx = Math.max(R.dio + R.dso, Wc.target.dio + Wc.target.dso) * 1.05, x = lin(0, mx, l, r);
    [["현재", R.dio, R.dso, R.dpo, R.ccc], ["목표", Wc.target.dio, Wc.target.dso, Wc.target.dpo, R.cccT]].forEach((q, i) => {
      const yy = 22 + i * 64; tx(s, l - 8, yy + 15, q[0], { "text-anchor": "end", fill: c("--ink"), "font-weight": 700 });
      sv("rect", { x: x(0), y: yy, width: x(q[1]) - x(0), height: 20, fill: c("--accent"), opacity: 0.75 }, s); sv("rect", { x: x(q[1]), y: yy, width: x(q[1] + q[2]) - x(q[1]), height: 20, fill: c("--input"), opacity: 0.7 }, s);
      if (x(q[1]) - x(0) > 60) tx(s, x(0) + 6, yy + 14, "재고 " + fmt(q[1], 0), { fill: "#FFFFFF", "font-size": 10.5 });
      if (x(q[1] + q[2]) - x(q[1]) > 70) tx(s, x(q[1]) + 6, yy + 14, "매출채권 " + fmt(q[2], 0), { fill: "#FFFFFF", "font-size": 10.5 });
      sv("rect", { x: x(0), y: yy + 24, width: x(q[3]) - x(0), height: 12, fill: c("--pos"), opacity: 0.6 }, s);
      tx(s, x(q[3]) + 4, yy + 34, "매입채무 " + fmt(q[3], 0), { fill: c("--ink-2"), "font-size": 10 });
      sv("line", { x1: x(q[3]), x2: x(q[1] + q[2]), y1: yy + 46, y2: yy + 46, stroke: c("--neg"), "stroke-width": 2 }, s);
      tx(s, (x(q[3]) + x(q[1] + q[2])) / 2, yy + 58, "묶이는 날 " + fmt(q[4], 0) + "일", { "text-anchor": "middle", fill: c("--neg-ink"), "font-size": 10.5, "font-weight": 700 });
    });
    /* 풀리는 현금 */
    const parts = [["매출채권", R.rel.ar], ["재고", R.rel.inv], ["매입채무", R.rel.ap]], f2 = frame("wc-rel", 150, "항목별로 풀리는 현금"), s2 = f2.svg, l2 = 70, r2 = f2.W - 50, vals = parts.map((p) => p[1]).concat([R.release, 0]), x2 = lin(Math.min.apply(null, vals), Math.max.apply(null, vals), l2, r2);
    sv("line", { x1: x2(0), x2: x2(0), y1: 4, y2: 140, stroke: c("--ink-2") }, s2);
    parts.concat([["합계", R.release]]).forEach((p, i) => { const yy = 8 + i * 34, last = i === 3; tx(s2, l2 - 8, yy + 15, p[0], { "text-anchor": "end", fill: c("--ink"), "font-weight": last ? 700 : 400 });
      sv("rect", { x: Math.min(x2(0), x2(p[1])), y: yy, width: Math.max(1, Math.abs(x2(p[1]) - x2(0))), height: 22, fill: p[1] >= 0 ? c("--pos") : c("--neg"), opacity: last ? 0.9 : 0.6, rx: 2 }, s2);
      tx(s2, p[1] >= 0 ? x2(p[1]) + 6 : x2(p[1]) - 6, yy + 15, sg(p[1], 0), { "text-anchor": p[1] >= 0 ? "start" : "end", class: "n", fill: c("--ink"), "font-weight": last ? 700 : 400 }); });
    table("wc-tb", ["항목", "현재 회전일", "목표", "하루의 값(억원)", "풀리는 현금"], [["매출채권", fmt(R.dso, 1), Wc.target.dso, fmt(R.perDayRev, 1), { t: sg(R.rel.ar, 0), c: R.rel.ar >= 0 ? "f" : "u" }], ["재고", fmt(R.dio, 1), Wc.target.dio, fmt(R.perDayCogs, 1), { t: sg(R.rel.inv, 0), c: R.rel.inv >= 0 ? "f" : "u" }], ["매입채무", fmt(R.dpo, 1), Wc.target.dpo, fmt(R.perDayCogs, 1), { t: sg(R.rel.ap, 0), c: R.rel.ap >= 0 ? "f" : "u" }], ["합계(현금전환주기)", fmt(R.ccc, 1), R.cccT, "", fmt(R.release, 0)]], { sum: true });
    const tgt = A.wc(Wc, { dso: R.dso, dio: R.dio, dpo: R.dpo });
    checks("wc-check", [["현금전환주기 = 매출채권 + 재고 − 매입채무 회전일", near(R.ccc, R.dso + R.dio - R.dpo)], ["항목별 합계 = 풀리는 현금", near(sum([R.rel.ar, R.rel.inv, R.rel.ap]), R.release)], ["목표 = 현재이면 풀리는 현금 0", near(tgt.release, 0, 1e-9)]]);
  }
  bind("wc-form", () => Wc, drawWc);
  $("wc-reset").addEventListener("click", () => { Wc = clone(A.WC); fill("wc-form", Wc); drawWc(); });

  const DRAW = [drawImp, drawWc]; let cur = 0;
  fill("imp-form", P); fill("wc-form", Wc);
  const sel = F.tabs(["tab-imp", "tab-wc"], (i) => { cur = i; DRAW[i](); try { history.replaceState(null, "", "#" + ["imp", "wc"][i]); } catch (e) { /* 무시 */ } });
  sel(location.hash === "#wc" ? 1 : 0);
  F.onRedraw(() => DRAW[cur]());
})();

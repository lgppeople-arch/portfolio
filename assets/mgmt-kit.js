/* 관리회계 키트(tools/mgmt-kit.html) 화면. 계산은 assets/engines/mgmt.js */
(function () {
  "use strict";
  const F = window.Fin, M = window.MgmtEngine, $ = F.$, NS = "http://www.w3.org/2000/svg";
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
  function frame(id, H, label) { const host = $(id); host.textContent = ""; const W = Math.max(280, Math.round(host.clientWidth || 600)); return { svg: sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, host), W: W, nar: W < 520 }; }
  function table(id, head, rows, opt) {
    const host = $(id); host.textContent = ""; opt = opt || {};
    const th = F.el("thead"), tr = F.el("tr"); head.forEach((h) => tr.appendChild(F.el("th", { text: h }))); th.appendChild(tr); host.appendChild(th);
    const tb = F.el("tbody");
    rows.forEach((r, i) => { const row = F.el("tr", { class: (opt.sum && i === rows.length - 1) ? "sum" : null }); r.forEach((v, j) => { const cell = F.el(j ? "td" : "th", { text: v && v.t !== undefined ? v.t : String(v) }); if (v && v.c) cell.className = v.c; row.appendChild(cell); }); tb.appendChild(row); });
    host.appendChild(tb);
  }
  const vc = (v) => ({ t: sg(v, 1), c: v > 0.05 ? "u" : v < -0.05 ? "f" : "" });
  function checks(id, list) { const host = $(id); host.textContent = ""; list.forEach((q) => host.appendChild(F.el("span", { class: q[1] ? null : "fail", text: q[0] }))); }

  /* ================= 1. 표준원가 ================= */
  let X = clone(M.STD);
  const inputs = Array.prototype.slice.call(document.querySelectorAll("#std-form input[data-k]"));
  const fill = () => inputs.forEach((i) => { i.value = X[i.dataset.k]; });
  function drawStd() {
    const V = M.variances(X), C = M.costing(X, $("sv-pro").checked), u = V.st.unit;
    const vol = V.list.find((d) => d.key === "fohVol").val;
    put({ "sk-tot": sg(V.total, 1), "sk-tot-sub": V.total > 0 ? "불리 · 실제 " + fmt(V.actual, 0) + " vs 표준 " + fmt(V.stdCost, 0) : "유리 · 실제 " + fmt(V.actual, 0) + " vs 표준 " + fmt(V.stdCost, 0),
      "sk-vol": sg(vol, 1), "sk-vol-sub": "가동률 " + pc(V.util, 0) + " (기준 조업도 대비)", "sk-unit": fmt(u.full, 1) + "천원", "sk-unit-sub": "변동 " + fmt(u.vari, 1) + " + 고정 " + fmt(u.foh, 1),
      "sk-cd": sg(C.diff, 1), "sk-cd-sub": "(생산 − 판매) × " + fmt(u.foh, 1) + "천원" });
    const top = V.list.filter((d) => d.val > 0).sort((a, b) => b.val - a.val), fav = V.list.filter((d) => d.val < 0);
    $("sk-memo").textContent = "이번 달 실제원가는 실제 생산량의 표준원가보다 " + fmt(Math.abs(V.total), 1) + "백만원 " + (V.total >= 0 ? "많습니다" : "적습니다") + ". " +
      (top.length ? "가장 큰 불리 요인은 " + top.slice(0, 2).map((d) => d.name + "(" + sg(d.val, 1) + ")").join(", ") + "입니다. " : "") +
      (vol > 0 ? "조업도 차이 " + fmt(vol, 1) + "백만원은 가동률이 " + pc(V.util, 0) + "에 그쳐 고정간접비가 다 배부되지 못한 몫으로, 현장 효율이 아니라 물량의 문제입니다. " : "") +
      (fav.length ? fav.map((d) => d.name).join(", ") + "에서는 유리한 차이가 났습니다." : "");
    /* 폭포 */
    const fr = frame("sv-wf", 270, "표준원가에서 실제원가까지의 차이 폭포 차트"), svg = fr.svg, steps = [["표준원가", V.stdCost, 0]].concat(V.list.map((d) => [d.name, d.val, 1])).concat([["실제원가", V.actual, 0]]);
    const l = 8, r = fr.W - 8, bw = (r - l) / steps.length, lo = Math.min(V.stdCost, V.actual) * 0.93, hi = Math.max(V.stdCost, V.actual, V.stdCost + sum(V.list.filter((d) => d.val > 0).map((d) => d.val))) * 1.01, y = lin(lo, hi, 214, 22);
    let acc = 0;
    steps.forEach((s, i) => { const x0 = l + i * bw + bw * 0.14, w = bw * 0.72; let a, b;
      if (!s[2]) { a = lo; b = s[1]; acc = s[1]; } else { a = acc; b = acc + s[1]; acc = b; }
      sv("rect", { x: x0, y: y(Math.max(a, b)), width: w, height: Math.max(1, Math.abs(y(a) - y(b))), fill: !s[2] ? c("--total") : s[1] > 0 ? c("--neg") : c("--pos"), opacity: 0.85, rx: 2 }, svg);
      tx(svg, x0 + w / 2, y(Math.max(a, b)) - 5, !s[2] ? fmt(s[1], 0) : sg(s[1], 0), { "text-anchor": "middle", class: "n", fill: c("--ink"), "font-size": fr.nar ? 9 : 10.5, "font-weight": 700 });
      const lab = fr.nar ? s[0].replace("변동간접비 ", "변간 ").replace("고정간접비 ", "고간 ").replace("재료 ", "재료").replace("노무 ", "노무") : s[0];
      const t = tx(svg, x0 + w / 2, 232, lab, { "text-anchor": "middle", fill: c("--ink"), "font-size": fr.nar ? 8.5 : 10 }); if (fr.nar) t.setAttribute("transform", "rotate(-30 " + (x0 + w / 2) + " 232)");
      if (i < steps.length - 1) sv("line", { x1: x0 + w, x2: x0 + bw, y1: y(acc), y2: y(acc), stroke: c("--mark-muted"), "stroke-dasharray": "3 3" }, svg); });
    tx(svg, l, 264, "세로축은 " + fmt(lo, 0) + "백만원부터 · 빨강 불리, 초록 유리", { fill: c("--muted"), "font-size": 10 });
    table("sv-tb", ["차이", "금액(백만원)", "계산"], V.list.map((d) => [d.name, vc(d.val), { t: d.why, c: "why" }]).concat([["합계 = 실제원가 − 표준원가", vc(V.total), { t: fmt(V.actual, 1) + " − " + fmt(V.stdCost, 1), c: "why" }]]), { sum: true });
    /* 조업도 */
    const f2 = frame("sv-vol", 230, "생산량별 조업도 차이"), s2 = f2.svg, l2 = 46, r2 = f2.W - 12, xmax = X.normal * 1.3, x = lin(0, xmax, l2, r2), ys = [M.volVar(X, 0), M.volVar(X, xmax)], y2 = lin(Math.min.apply(null, ys), Math.max.apply(null, ys), 190, 16);
    F.niceTicks(ys[1], ys[0], 4).ticks.forEach((v) => { if (y2(v) < 14 || y2(v) > 192) return; sv("line", { x1: l2, x2: r2, y1: y2(v), y2: y2(v), stroke: v === 0 ? c("--ink-2") : c("--rule-soft") }, s2); tx(s2, l2 - 6, y2(v) + 4, fmt(v, 0), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    sv("line", { x1: x(0), x2: x(xmax), y1: y2(ys[0]), y2: y2(ys[1]), stroke: c("--accent"), "stroke-width": 2.4 }, s2);
    sv("line", { x1: x(X.normal), x2: x(X.normal), y1: 16, y2: 190, stroke: c("--muted"), "stroke-dasharray": "4 3" }, s2); tx(s2, x(X.normal) + 4, 26, "기준 조업도", { fill: c("--muted"), "font-size": 10 });
    sv("circle", { cx: x(X.prod), cy: y2(vol), r: 5.5, fill: c("--neg"), stroke: c("--surface"), "stroke-width": 2 }, s2);
    tx(s2, x(X.prod) - 8, y2(vol) - 8, "이번 달 " + sg(vol, 0), { "text-anchor": "end", fill: c("--neg-ink"), "font-weight": 700, "font-size": 10.5 });
    [0, 0.5, 1].forEach((k) => tx(s2, x(X.normal * k * 1.0 + (k === 1 ? 0 : 0)), 206, pc(k, 0), { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }));
    tx(s2, r2, 224, "가동률(기준 조업도 대비) · 위쪽이 불리", { "text-anchor": "end", fill: c("--muted"), "font-size": 10 });
    table("sv-cost", ["", "전부원가", "변동원가"], [["매출", fmt(C.rev, 1), fmt(C.rev, 1)], ["영업이익", fmt(C.absOI, 1), fmt(C.varOI, 1)], ["기말 제품재고", fmt(C.endInvAbs, 1), fmt(C.endInvVar, 1)], ["이익 차이(전부 − 변동)", { t: sg(C.diff, 1), c: "hl" }, { t: "이론값 " + sg(C.theory, 1), c: "hl" }]]);
    const ok1 = near(V.total, V.actual - V.stdCost, 1e-9), ok2 = near(C.diff, C.theory, 1e-9) || $("sv-pro").checked, ok3 = near(C.endInvAbs - C.endInvVar, C.diff, 1e-9);
    checks("sv-check", [["차이 합계 = 실제 − 표준 " + fmt(V.total, 1), ok1], ["이익 차이 = (생산−판매) × 단위 고정비" + ($("sv-pro").checked ? " (안분 시 생략)" : ""), ok2], ["이익 차이 = 기말재고 차이", ok3]]);
  }
  inputs.forEach((i) => i.addEventListener("input", () => { const v = +i.value; if (isFinite(v) && i.value !== "") { X[i.dataset.k] = v; drawStd(); } }));
  $("std-reset").addEventListener("click", () => { X = clone(M.STD); fill(); drawStd(); });
  $("sv-pro").addEventListener("change", drawStd);

  /* ================= 2. 사업부 ================= */
  const D = M.DIV, BASES = Object.keys(D.bases); let basis = BASES[0];
  BASES.forEach((b) => { const btn = F.el("button", { type: "button", text: b }); btn.setAttribute("aria-pressed", b === basis ? "true" : "false"); btn.addEventListener("click", () => { basis = b; drawDiv(); }); $("dv-basis").appendChild(btn); });
  function drawDiv() {
    document.querySelectorAll("#dv-basis button").forEach((b) => b.setAttribute("aria-pressed", b.textContent === basis ? "true" : "false"));
    const r = M.divisions(D, basis), all = M.allBases(D), drop = M.dropTest(D, 2);
    put({ "dk-tot": fmt(r.total, 0), "dk-dcm": sg(r.dcm[2], 0), "dk-oi": sg(r.oi[2], 0), "dk-oi-sub": basis + " 기준 배부 " + fmt(r.alloc[2], 0), "dk-drop": fmt(drop.after, 0), "dk-drop-sub": sg(drop.after - drop.before, 0) + " (공통비 " + fmt(D.common, 0) + "은 남음)" });
    const neg = BASES.filter((b) => all[b].oi[2] < 0);
    $("dk-memo").textContent = "회사 영업이익은 어떤 기준으로 배부해도 " + fmt(r.total, 0) + "백만원입니다. C 사업부는 직접 고정비까지 빼고 " + fmt(r.dcm[2], 0) + "백만원을 남기지만, 공통비를 " + basis + " 기준으로 나누면 " + sg(r.oi[2], 0) + "백만원입니다. 네 기준 중 " + neg.length + "개(" + (neg.join(", ") || "없음") + ")에서는 적자로 보입니다. 배부 후 적자를 이유로 C를 접으면 회사 이익은 " + fmt(drop.before, 0) + "에서 " + fmt(drop.after, 0) + "백만원으로 줄어듭니다.";
    /* 단계 그림: 사업부별 공헌이익, 사업부 공헌이익, 배부 후 */
    const fr = frame("dv-fig", 250, "사업부별 공헌이익, 사업부 공헌이익, 배부 후 이익"), svg = fr.svg, l = 48, rr = fr.W - 10, gw = (rr - l) / r.n, top = Math.max.apply(null, r.cm), lo = Math.min(0, Math.min.apply(null, r.oi)) - 60, y = lin(lo, top * 1.08, 210, 20);
    F.niceTicks(lo, top, 4).ticks.forEach((v) => { if (y(v) < 18 || y(v) > 212) return; sv("line", { x1: l, x2: rr, y1: y(v), y2: y(v), stroke: v === 0 ? c("--ink-2") : c("--rule-soft") }, svg); tx(svg, l - 6, y(v) + 4, fmt(v, 0), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    const ser = [[r.cm, c("--mark-muted"), "공헌이익"], [r.dcm, c("--input"), "사업부 공헌이익"], [r.oi, c("--accent"), "배부 후"]];
    for (let i = 0; i < r.n; i++) {
      const gx = l + i * gw, bw = gw * 0.22;
      ser.forEach((s, k) => { const v = s[0][i], x0 = gx + gw * 0.12 + k * (bw + 4); sv("rect", { x: x0, y: y(Math.max(0, v)), width: bw, height: Math.max(1, Math.abs(y(v) - y(0))), fill: s[1], opacity: 0.85, rx: 2 }, svg);
        tx(svg, x0 + bw / 2, v >= 0 ? y(v) - 4 : y(v) + 12, fmt(v, 0), { "text-anchor": "middle", class: "n", "font-size": fr.nar ? 8.5 : 10, fill: c("--ink"), "font-weight": k === 2 ? 700 : 400 }); });
      tx(svg, gx + gw / 2, 228, fr.nar ? D.names[i].split(" ")[0] : D.names[i], { "text-anchor": "middle", fill: c("--ink"), "font-size": 11 });
    }
    let lx = l; ser.forEach((s) => { sv("rect", { x: lx, y: 238, width: 10, height: 10, fill: s[1] }, svg); tx(svg, lx + 14, 247, s[2], { "font-size": 10.5 }); lx += 18 + s[2].length * 11; });
    table("dv-tb", ["", ...D.names, "회사"], [
      ["매출", ...D.rev.map((v) => fmt(v)), fmt(sum(D.rev))], ["변동비", ...D.varCost.map((v) => fmt(-v)), fmt(-sum(D.varCost))], ["공헌이익", ...r.cm.map((v) => fmt(v)), fmt(sum(r.cm))],
      ["직접 고정비", ...D.direct.map((v) => fmt(-v)), fmt(-sum(D.direct))], ["사업부 공헌이익", ...r.dcm.map((v) => ({ t: fmt(v), c: "hl" })), { t: fmt(sum(r.dcm)), c: "hl" }],
      ["공통비 배부(" + basis + ")", ...r.alloc.map((v) => fmt(-v, 1)), fmt(-D.common)], ["배부 후 영업이익", ...r.oi.map((v) => ({ t: fmt(v, 1), c: v < 0 ? "u" : "" })), fmt(r.total, 1)]], { sum: true });
    table("dv-mx", ["배부 기준", ...D.names, "회사 합계"], BASES.map((b) => [b + (b === basis ? " ◀" : ""), ...all[b].oi.map((v) => ({ t: fmt(v, 1), c: v < 0 ? "u" : "" })), fmt(all[b].total, 1)]));
    const svc = { "직접배부법": M.service(D, "direct"), "단계배부법(전력 먼저)": M.service(D, "step"), "상호배부법": M.service(D, "reciprocal") };
    table("dv-svc", ["방법", ...D.names, "합계"], Object.keys(svc).map((k) => [k, ...svc[k].map((v) => fmt(v, 1)), fmt(sum(svc[k]), 1)]));
    table("dv-use", ["제공 \\ 사용", D.svc.names[0], D.svc.names[1], ...D.names.map((n) => n.split(" ")[0])], D.svc.names.map((n, i) => [n + " (" + fmt(D.svc.cost[i]) + ")", ...D.svc.use[i].map((v) => pc(v, 0))]));
    $("dv-drop").textContent = "C 사업부를 접으면 매출 " + fmt(D.rev[2]) + "과 직접 고정비 " + fmt(D.direct[2]) + "은 사라지지만 본사 공통비 " + fmt(D.common) + "은 그대로 남습니다. 회사 이익은 C의 사업부 공헌이익 " + fmt(drop.loss) + "만큼 줄어 " + fmt(drop.after) + "백만원이 됩니다. 철수 판단은 배부 후 이익이 아니라 '접으면 사라지는 수익과 비용'으로 합니다.";
    const tots = BASES.map((b) => all[b].total), T = M.reciprocalTotals(D);
    checks("dv-check", [["배부 기준과 무관하게 회사 이익 동일", tots.every((t) => near(t, tots[0]))], ["배부액 합계 = 공통비", near(sum(r.alloc), D.common)], ["세 방법 모두 보조부문 원가 합계 " + fmt(sum(D.svc.cost)) + " 보존", Object.keys(svc).every((k) => near(sum(svc[k]), sum(D.svc.cost)))], ["상호배부 연립방정식 성립", near(T[0], D.svc.cost[0] + D.svc.use[1][0] * T[1]) && near(T[1], D.svc.cost[1] + D.svc.use[0][1] * T[0])]]);
  }

  /* ================= 3. 재고 ================= */
  function drawInv() {
    const I = M.inventory(M.INV), target = +$("iv-t").value, cash = Math.max(0, I.total - target * I.perDay);
    $("iv-tv").textContent = target + "일";
    put({ "ik-tot": fmt(I.total, 0), "ik-tot-sub": Object.keys(M.INV.inv).map((k) => k + " " + fmt(M.INV.inv[k])).join(" · "), "ik-dio": fmt(I.dio, 1) + "일", "ik-cash": fmt(cash, 0), "ik-cash-sub": "하루당 " + fmt(I.perDay, 1) + "백만원",
      "ik-res": fmt(I.reserve + I.nrvLoss, 0), "ik-res-sub": "연령 충당 " + fmt(I.reserve, 0) + " + 저가법 " + fmt(I.nrvLoss, 0) });
    $("ik-memo").textContent = "재고는 " + fmt(I.total, 0) + "백만원, 연 매출원가 기준 " + fmt(I.dio, 1) + "일치입니다. 회전일을 " + target + "일로 줄이면 약 " + fmt(cash, 0) + "백만원의 현금이 풀립니다. 1년 넘은 재고 " + fmt(M.INV.aging[3][1]) + "백만원을 포함해 연령 기준 충당금 " + fmt(I.reserve, 0) + "백만원, 판매가가 원가 밑으로 내려간 품목의 저가법 손실 " + fmt(I.nrvLoss, 0) + "백만원이 손익에 반영될 몫입니다.";
    const fr = frame("iv-age", 220, "재고 연령 구간별 금액과 충당금"), svg = fr.svg, A = M.INV.aging, l = 12, r = fr.W - 12, top = Math.max.apply(null, A.map((a) => a[1])), y = lin(0, top * 1.15, 178, 18), bw = (r - l) / A.length;
    A.forEach((a, i) => { const x0 = l + i * bw + bw * 0.18, w = bw * 0.64; sv("rect", { x: x0, y: y(a[1]), width: w, height: y(0) - y(a[1]), fill: c("--mark-muted"), opacity: 0.55, rx: 2 }, svg);
      if (a[2] > 0) sv("rect", { x: x0, y: y(a[1] * a[2]), width: w, height: y(0) - y(a[1] * a[2]), fill: c("--neg"), opacity: 0.8, rx: 2 }, svg);
      tx(svg, x0 + w / 2, y(a[1]) - 5, fmt(a[1]), { "text-anchor": "middle", class: "n", "font-size": 10.5, fill: c("--ink") }); tx(svg, x0 + w / 2, 194, a[0], { "text-anchor": "middle", "font-size": 10.5, fill: c("--ink") }); tx(svg, x0 + w / 2, 210, "충당 " + pc(a[2], 0), { "text-anchor": "middle", "font-size": 10, fill: a[2] ? c("--neg-ink") : c("--muted") }); });
    table("iv-nrv", ["품목", "수량", "장부원가", "순실현가능가치", "평가손실(백만원)"], I.nrv.map((n) => [n.name, fmt(n.qty), fmt(n.cost, 1), { t: fmt(n.nrv, 1), c: n.nrv < n.cost ? "u" : "" }, { t: fmt(n.loss, 1), c: n.loss > 0 ? "u" : "" }]).concat([["합계", "", "", "", fmt(I.nrvLoss, 1)]]), { sum: true });
    /* EOQ */
    const e = Object.assign({}, M.INV.eoq, { S: +$("eo-s").value, H: +$("eo-h").value, z: +$("eo-z").value }), E = M.eoq(e), svcL = window.Stats ? window.Stats.normCdf(e.z) : 0.95;
    $("eo-sv").textContent = fmt(e.S, 1) + "백만원"; $("eo-hv").textContent = fmt(e.H, 1) + "천원"; $("eo-zv").textContent = pc(svcL, 0) + " (z " + fmt(e.z, 2) + ")";
    $("eo-out").textContent = "경제적 주문량 " + fmt(E.q, 0) + "개(연 " + fmt(E.orders, 1) + "회) · 연 주문비+보유비 " + fmt(E.minCost, 1) + "백만원 · 안전재고 " + fmt(E.ss, 0) + "개(보유비 연 " + fmt(E.ssCost, 1) + "백만원) · 재주문점 " + fmt(E.rop, 0) + "개";
    const f2 = frame("eo-fig", 220, "주문량별 주문비, 보유비, 총비용"), s2 = f2.svg, l2 = 46, r2 = f2.W - 12, qmax = E.q * 3, x = lin(0, qmax, l2, r2), S1 = e.S * 1000, oc = (q) => e.D / q * S1 / 1000, hc = (q) => q / 2 * e.H / 1000, ymax = E.minCost * 2.2, y2 = lin(0, ymax, 180, 14), qs = [];
    for (let q = E.q * 0.15; q <= qmax; q += qmax / 120) qs.push(q);
    F.niceTicks(0, ymax, 4).ticks.forEach((v) => { if (v > ymax) return; sv("line", { x1: l2, x2: r2, y1: y2(v), y2: y2(v), stroke: c("--rule-soft") }, s2); tx(s2, l2 - 6, y2(v) + 4, fmt(v, 0), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    [[oc, c("--input"), "주문비"], [hc, c("--accent"), "보유비"], [(q) => oc(q) + hc(q), c("--ink"), "합계"]].forEach((s, k) => { sv("path", { d: path(qs.map((q) => [x(q), y2(Math.min(ymax, s[0](q)))])), fill: "none", stroke: s[1], "stroke-width": k === 2 ? 2.6 : 1.8 }, s2); tx(s2, r2 - 4, y2(Math.min(ymax, s[0](qmax))) - 6, s[2], { "text-anchor": "end", fill: s[1], "font-size": 10.5, "font-weight": 700 }); });
    sv("line", { x1: x(E.q), x2: x(E.q), y1: y2(E.minCost), y2: 180, stroke: c("--muted"), "stroke-dasharray": "4 3" }, s2); sv("circle", { cx: x(E.q), cy: y2(E.minCost), r: 5, fill: c("--ink") }, s2);
    tx(s2, x(E.q) + 6, y2(E.minCost) - 8, "EOQ " + fmt(E.q, 0), { fill: c("--ink"), "font-weight": 700, "font-size": 10.5 });
    tx(s2, r2, 210, "1회 주문량(개) · 세로축 백만원/년", { "text-anchor": "end", fill: c("--muted"), "font-size": 10 });
    const dq = E.q * 1e-4;
    checks("iv-check", [["EOQ에서 주문비 = 보유비", near(oc(E.q), hc(E.q), 1e-9)], ["EOQ 양옆 비용이 더 큼", E.cost(E.q - dq) > E.minCost && E.cost(E.q + dq) > E.minCost], ["저가법 손실 ≥ 0, 원가 이하만 인식", I.nrv.every((n) => n.loss >= 0 && (n.nrv >= n.cost ? n.loss === 0 : true))], ["회전일 = 재고 ÷ 하루 매출원가", near(I.dio, I.total / I.perDay)]]);
  }
  ["iv-t", "eo-s", "eo-h", "eo-z"].forEach((id) => $(id).addEventListener("input", drawInv));

  /* ================= 4. 의사결정 ================= */
  function drawDec() {
    const o = Object.assign({}, M.DEC.special, { qty: +$("sp-q").value, offer: +$("sp-p").value }), sp = M.special(o);
    $("sp-qv").textContent = fmt(o.qty) + "개"; $("sp-pv").textContent = fmt(o.offer) + "천원";
    const parts = [["추가 공헌이익", o.qty * (o.offer - o.vc) / 1000], ["추가 고정비", -o.extraFixed], ["밀려난 기존 판매", -sp.displaced * (o.price - o.vc) / 1000]];
    bars("sp-fig", parts, sp.gain, "증분이익");
    $("sp-out").innerHTML = "남는 설비 " + fmt(sp.free) + "개" + (sp.displaced ? ", 초과분 " + fmt(sp.displaced) + "개는 기존 판매를 밀어냅니다" : "로 충분합니다") + ". 증분이익 <b>" + sg(sp.gain, 0) + "백만원</b> → " + (sp.gain > 0 ? "받는 편이 낫습니다" : "받지 않는 편이 낫습니다") + ". 이 수량이면 단가가 <b>" + fmt(sp.minPrice, 1) + "천원</b> 이상이어야 손해가 아닙니다. 평소 단가(" + fmt(o.price) + ")보다 낮아도 남는 설비를 쓰는 한 변동비만 넘으면 이익입니다. 다만 기존 고객 가격에 미칠 영향은 따로 판단합니다.";
    const m = Object.assign({}, M.DEC.make, { buy: +$("mb-b").value, freedCM: +$("mb-f").value }), mb = M.makeBuy(m);
    $("mb-bv").textContent = fmt(m.buy, 1) + "천원"; $("mb-fv").textContent = fmt(m.freedCM) + "백만원";
    bars("mb-fig", [["자가제조 비용", mb.make], ["외주 비용(설비 활용 반영)", mb.buy]], mb.make - mb.buy, "외주 시 절감", true);
    $("mb-out").innerHTML = "자가제조는 변동비 " + fmt(m.qty * m.vc / 1000) + " + 없앨 수 있는 고정비 " + fmt(m.avoidFixed) + " = " + fmt(mb.make) + "백만원, 외주는 대금 " + fmt(m.qty * m.buy / 1000) + "에서 비운 설비로 버는 " + fmt(m.freedCM) + "을 빼 " + fmt(mb.buy) + "백만원입니다. <b>" + (mb.diff < 0 ? "외주가 " + fmt(-mb.diff) + "백만원 유리" : "자가제조가 " + fmt(mb.diff) + "백만원 유리") + "</b>합니다. 외주 단가가 <b>" + fmt(mb.indiff, 1) + "천원</b>을 넘으면 자가제조가 낫습니다. 품질·납기·기술 유출 같은 질적 요소는 숫자 밖에서 함께 봅니다.";
    /* 병목 배합 */
    const A = M.mix(M.DEC.mix, "min"), B = M.mix(M.DEC.mix, "unit"), it = A.items;
    const fr = frame("mx-fig", 150, "병목 분당 공헌이익 기준과 개당 공헌이익 기준의 총 공헌이익 비교"), svg = fr.svg, l = fr.nar ? 120 : 210, r = fr.W - 60, x = lin(0, Math.max(A.cm, B.cm) * 1.05, l, r);
    [["병목 1분당 공헌이익 순", A, c("--pos")], ["개당 공헌이익 순", B, c("--mark-muted")]].forEach((q, i) => { const yy = 20 + i * 52; tx(svg, l - 8, yy + 17, q[0], { "text-anchor": "end", fill: c("--ink"), "font-weight": i ? 400 : 700 });
      let acc = 0; q[1].qty.forEach((qq, k) => { const v = qq * it[k].cm / 1000; if (v <= 0) return; sv("rect", { x: x(acc), y: yy, width: x(acc + v) - x(acc), height: 26, fill: q[2], opacity: 0.45 + 0.2 * k, stroke: c("--surface") }, svg); if (x(acc + v) - x(acc) > 44) tx(svg, (x(acc) + x(acc + v)) / 2, yy + 17, it[k].name.split(" ")[0], { "text-anchor": "middle", "font-size": 10.5, fill: c("--ink") }); acc += v; });
      tx(svg, x(acc) + 6, yy + 17, fmt(acc, 0), { class: "n", fill: c("--ink"), "font-weight": 700 }); });
    tx(svg, l, 140, "총 공헌이익(백만원) · 병목 " + fmt(M.DEC.mix.cap) + "분", { fill: c("--muted"), "font-size": 10 });
    table("mx-tb", ["제품", "개당 공헌이익(천원)", "병목 분/개", "분당 공헌이익", "최대 수요", "생산(분당 기준)", "생산(개당 기준)"], it.map((p, k) => [p.name, fmt(p.cm), fmt(p.min), { t: fmt(p.cmMin, 1), c: "hl" }, fmt(p.dem), fmt(A.qty[k]), fmt(B.qty[k])]));
    /* 다제품 손익분기 */
    const wA = +$("bp-w").value / 100, d = M.DIV, rest = d.rev.slice(1), rs = sum(rest), w = [wA].concat(rest.map((v) => (1 - wA) * v / rs)), bp = M.multiBep(d, w), base = M.multiBep(d);
    $("bp-wv").textContent = pc(wA, 1);
    $("bp-out").textContent = "가중 공헌이익률 " + pc(bp.wcmr) + " · 고정비 " + fmt(bp.fixed) + " → 손익분기 매출 " + fmt(bp.bep) + "백만원(현재 구성 " + fmt(base.bep) + ") · 현재 매출 " + fmt(bp.rev) + " 기준 안전한계 " + pc(1 - bp.bep / bp.rev);
    const f3 = frame("bp-fig", 200, "A 사업부 비중별 손익분기 매출"), s3 = f3.svg, l3 = 50, r3 = f3.W - 12, x3 = lin(30, 90, l3, r3), pts = []; for (let a = 30; a <= 90; a++) { const ww = [a / 100].concat(rest.map((v) => (1 - a / 100) * v / rs)); pts.push([a, M.multiBep(d, ww).bep]); }
    const yl = Math.min.apply(null, pts.map((p) => p[1])) * 0.97, yh = Math.max.apply(null, pts.map((p) => p[1])) * 1.03, y3 = lin(yl, yh, 164, 14);
    F.niceTicks(yl, yh, 4).ticks.forEach((v) => { if (y3(v) < 12 || y3(v) > 166) return; sv("line", { x1: l3, x2: r3, y1: y3(v), y2: y3(v), stroke: c("--rule-soft") }, s3); tx(s3, l3 - 6, y3(v) + 4, fmt(v), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    sv("path", { d: path(pts.map((p) => [x3(p[0]), y3(p[1])])), fill: "none", stroke: c("--input"), "stroke-width": 2.4 }, s3);
    sv("circle", { cx: x3(wA * 100), cy: y3(bp.bep), r: 5.5, fill: c("--accent") }, s3); tx(s3, x3(wA * 100) + 8, y3(bp.bep) - 6, fmt(bp.bep), { class: "n", fill: c("--accent"), "font-weight": 700 });
    [30, 50, 70, 90].forEach((v) => tx(s3, x3(v), 182, v + "%", { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }));
    tx(s3, r3, 196, "A 사업부(공헌이익률 " + pc(bp.cmr[0], 0) + ") 매출 비중 · 세로축 손익분기 매출", { "text-anchor": "end", fill: c("--muted"), "font-size": 10 });
    checks("dc-check", [["특별주문 증분이익 = 구성요소 합", near(sum(parts.map((p) => p[1])), sp.gain)], ["무차별 단가에서 외주·자가 비용 동일", near(M.makeBuy(Object.assign({}, m, { buy: mb.indiff })).diff, 0, 1e-9)], ["분당 기준 배합 ≥ 개당 기준 배합", A.cm >= B.cm - 1e-9], ["손익분기에서 공헌이익 = 고정비", near(bp.bep * bp.wcmr, bp.fixed)]]);
  }
  function bars(id, parts, total, label, costMode) {
    const fr = frame(id, 46 + parts.length * 34, label), svg = fr.svg, l = fr.nar ? 120 : 170, r = fr.W - 60, vals = parts.map((p) => p[1]).concat([total, 0]), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), x = lin(lo, hi === lo ? lo + 1 : hi, l + 48, r);
    sv("line", { x1: x(0), x2: x(0), y1: 6, y2: 14 + parts.length * 34 + 22, stroke: c("--ink-2") }, svg);
    parts.concat([[label, total]]).forEach((p, i) => { const yy = 10 + i * 34, v = p[1], last = i === parts.length;
      tx(svg, l - 8, yy + 15, p[0], { "text-anchor": "end", fill: c("--ink"), "font-weight": last ? 700 : 400, "font-size": fr.nar ? 10 : 11 });
      sv("rect", { x: Math.min(x(0), x(v)), y: yy, width: Math.max(1, Math.abs(x(v) - x(0))), height: 22, fill: last ? (v >= 0 ? c("--pos") : c("--neg")) : (costMode ? c("--mark-muted") : v >= 0 ? c("--input") : c("--neg")), opacity: last ? 0.9 : 0.6, rx: 2 }, svg);
      tx(svg, v >= 0 ? x(v) + 6 : x(v) - 6, yy + 15, costMode && !last ? fmt(v, 0) : sg(v, 0), { "text-anchor": v >= 0 ? "start" : "end", class: "n", fill: c("--ink"), "font-weight": last ? 700 : 400 }); });
  }
  ["sp-q", "sp-p", "mb-b", "mb-f", "bp-w"].forEach((id) => $(id).addEventListener("input", drawDec));


  /* ================= 5. 판매 차이(PVM) ================= */
  let PV = clone(M.PVM);
  const PVK = [["qb", "계획 수량"], ["pb", "계획 단가"], ["vb", "계획 변동비"], ["qa", "실적 수량"], ["pa", "실적 단가"], ["va", "실적 변동비"]];
  function buildPvm() {
    const t = $("pv-in"); t.textContent = "";
    const th = F.el("thead"), tr = F.el("tr"); tr.appendChild(F.el("th", { text: "제품" })); PVK.forEach((k) => tr.appendChild(F.el("th", { text: k[1] }))); th.appendChild(tr); t.appendChild(th);
    const tb = F.el("tbody");
    PV.items.forEach((it, i) => { const row = F.el("tr"); row.appendChild(F.el("th", { text: it.name }));
      PVK.forEach((k) => { const td = F.el("td"), inp = F.el("input", { type: "number", step: k[0][0] === "q" ? "1" : "0.1", min: "0", value: String(it[k[0]]), "aria-label": it.name + " " + k[1], class: "pv-cell" });
        inp.addEventListener("input", () => { const v = +inp.value; if (inp.value === "" || !isFinite(v) || v < 0) return; PV.items[i][k[0]] = v; drawPvm(); }); td.appendChild(inp); row.appendChild(td); });
      tb.appendChild(row); });
    t.appendChild(tb);
    $("pv-fa").value = PV.fa;
  }
  function drawPvm() {
    PV.fa = +$("pv-fa").value; $("pv-fav").textContent = fmt(PV.fa) + "억원"; $("pv-fbv").textContent = fmt(PV.fb);
    const R = M.pvm(PV), eff = [["물량", R.volume], ["믹스", R.mix], ["단가", R.price], ["변동비", R.cost], ["고정비", R.fixed]];
    const big = eff.slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    put({ "pv-opb": fmt(R.opB, 1), "pv-opb-sub": "매출 " + fmt(R.revB, 1) + " · 이익률 " + pc(R.opB / R.revB), "pv-opa": fmt(R.opA, 1), "pv-opa-sub": sg(R.diff, 1) + " · 매출 " + fmt(R.revA, 1),
      "pv-q": fmt(R.TQb) + " → " + fmt(R.TQa), "pv-q-sub": "천 개 · " + sg((R.TQa / R.TQb - 1) * 100, 1) + "%", "pv-big": big[0] + " " + sg(big[1], 1), "pv-big-sub": "억원 · 다섯 효과 중 절댓값 최대" });
    const worst = R.rows.slice().sort((a, b) => a.mix - b.mix)[0], gain = R.rows.slice().sort((a, b) => b.mix - a.mix)[0];
    $("pv-memo").textContent = "영업이익은 계획 " + fmt(R.opB, 1) + "억원에서 실적 " + fmt(R.opA, 1) + "억원으로 " + sg(R.diff, 1) + "억원 차이가 났습니다. 매출은 " + sg(R.revA - R.revB, 1) + "억원" + (Math.abs(R.revA - R.revB) < Math.abs(R.diff) / 3 ? "으로 거의 같아 매출만 보면 원인이 보이지 않습니다. " : "입니다. ") +
      "총수량이 " + sg((R.TQa / R.TQb - 1) * 100, 1) + "% 바뀌어 물량 효과는 " + sg(R.volume, 1) + "억원이지만, 판매가 " + gain.name + " 쪽으로 옮겨 가고 " + worst.name + " 판매는 줄어 믹스 효과가 " + sg(R.mix, 1) + "억원입니다. 단가 " + sg(R.price, 1) + ", 변동비 " + sg(R.cost, 1) + ", 고정비 " + sg(R.fixed, 1) + "억원을 더하면 차이와 정확히 같습니다.";
    /* 다리 그림 */
    const fr = frame("pv-fig", 250, "계획 영업이익에서 물량·믹스·단가·변동비·고정비 효과를 거쳐 실적 영업이익까지의 다리"), s2 = fr.svg, l = 46, r = fr.W - 10, steps = [["계획", R.opB, true]].concat(eff.map((e) => [e[0], e[1], false])).concat([["실적", R.opA, true]]);
    let run = 0; const segs = steps.map((st) => { if (st[2]) { run = st[1]; return [st[0], 0, st[1], st[2], st[1]]; } const a0 = run; run += st[1]; return [st[0], a0, run, false, st[1]]; });
    const vals = [0].concat(segs.map((g) => g[1]), segs.map((g) => g[2])), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), tk = F.niceTicks(lo, hi, 4), y = lin(Math.min(tk.lo, lo), Math.max(tk.hi, hi), 200, 18);
    tk.ticks.forEach((t) => { sv("line", { x1: l, x2: r, y1: y(t), y2: y(t), stroke: t === 0 ? c("--ink-2") : c("--rule-soft") }, s2); tx(s2, l - 6, y(t) + 4, fmt(t), { "text-anchor": "end", "font-size": 10, fill: c("--muted"), class: "n" }); });
    const n = segs.length, bw = (r - l) / n * 0.6, X = (i) => l + (i + 0.5) * (r - l) / n;
    segs.forEach((g, i) => { const top = Math.max(g[1], g[2]), bot = Math.min(g[1], g[2]), col = g[3] ? c("--total") : g[4] >= 0 ? c("--pos") : c("--neg");
      sv("rect", { x: X(i) - bw / 2, y: y(top), width: bw, height: Math.max(1, y(bot) - y(top)), fill: col, opacity: g[3] ? 0.85 : 0.75, rx: 2 }, s2);
      if (i < n - 1) sv("line", { x1: X(i) + bw / 2, x2: X(i + 1) - bw / 2, y1: y(g[2]), y2: y(g[2]), stroke: c("--muted"), "stroke-dasharray": "3 3" }, s2);
      tx(s2, X(i), y(top) - 5, g[3] ? fmt(g[4], 1) : sg(g[4], 1), { "text-anchor": "middle", "font-size": fr.nar ? 9.5 : 11, fill: c("--ink"), "font-weight": g[3] ? 700 : 400, class: "n" });
      tx(s2, X(i), 222, g[0], { "text-anchor": "middle", "font-size": fr.nar ? 10 : 11.5, fill: c("--ink"), "font-weight": g[3] ? 700 : 400 }); });
    tx(s2, r, 244, "억원 · 초록 = 이익을 늘린 효과, 빨강 = 줄인 효과", { "text-anchor": "end", "font-size": 10, fill: c("--muted") });
    const pe = (v) => ({ t: sg(v, 1), c: v < -0.05 ? "u" : v > 0.05 ? "f" : "" });  /* 이익 효과: 마이너스 = 불리 */
    table("pv-out", ["제품", "구성비 계획→실적", "단위 공헌이익 계획→실적", "믹스", "단가", "변동비"], R.rows.map((q) => [q.name, pc(q.mixB, 0) + " → " + pc(q.mixA, 0), fmt(q.cmb, 1) + " → " + fmt(q.cma, 1), pe(q.mix), pe(q.price), pe(q.cost)]).concat([["합계", "", "", pe(R.mix), pe(R.price), pe(R.cost)]]), { sum: true });
    const same = M.pvm({ items: PV.items.map((x) => Object.assign({}, x, { qa: x.qb, pa: x.pb, va: x.vb })), fb: PV.fb, fa: PV.fb }), scaled = M.pvm({ items: PV.items.map((x) => Object.assign({}, x, { qa: x.qb * 1.1, pa: x.pb, va: x.vb })), fb: PV.fb, fa: PV.fb });
    checks("pv-check", [["다섯 효과의 합 = 실적 − 계획 영업이익", near(R.volume + R.mix + R.price + R.cost + R.fixed, R.diff, 1e-9)], ["실적 = 계획이면 모든 효과 0", [same.volume, same.mix, same.price, same.cost, same.fixed].every((v) => Math.abs(v) < 1e-9)], ["구성비가 그대로면 믹스 0, 물량만 남음", Math.abs(scaled.mix) < 1e-9 && near(scaled.volume, scaled.diff, 1e-9)]]);
  }
  $("pv-fa").addEventListener("input", drawPvm);
  $("pv-same").addEventListener("click", () => { PV.items.forEach((x) => { x.qa = x.qb; x.pa = x.pb; x.va = x.vb; }); PV.fa = PV.fb; buildPvm(); drawPvm(); });
  $("pv-reset").addEventListener("click", () => { PV = clone(M.PVM); buildPvm(); drawPvm(); });
  buildPvm();

  /* ================= 연결 ================= */
  const drawn = {};
  const DRAW = [drawStd, drawDiv, drawInv, drawDec, drawPvm];
  let cur = 0;
  const select = F.tabs(["tab-std", "tab-div", "tab-inv", "tab-dec", "tab-pvm"], (i) => { cur = i; DRAW[i](); drawn[i] = true; try { history.replaceState(null, "", "#" + ["std", "div", "inv", "dec", "pvm"][i]); } catch (e) { /* 무시 */ } });
  fill();
  const h = (location.hash || "").slice(1), idx = ["std", "div", "inv", "dec", "pvm"].indexOf(h);
  select(idx >= 0 ? idx : 0);
  F.onRedraw(() => DRAW[cur]());
})();

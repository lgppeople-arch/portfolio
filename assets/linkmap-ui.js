/* 다단 연결 지도 탐색기(화면). 엔진은 assets/engines/linkmap.js.
   LinkMapUI.mount(host, spec, opts)
   opts: { label(node) 칸 이름, itemName(id) 항목 이름, groups { grp: { name, css } }, score(id) 수익성 같은 점수(선택), scoreName, itemWord "부품" }
   - 기둥 켜고 끄기, 칸 누르면 포함 → 제외 → 해제, 키보드용 선택 상자와 버튼, 조건 칩, 남은 항목 요약 */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  function mount(host, spec, opts) {
    const F = window.Fin, L = window.LinkMap, c = (n) => F.css(n), el = F.el;
    const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
    const label = opts.label || ((n) => n.name), itemName = opts.itemName || ((id) => id), word = opts.itemWord || "항목";
    const byNode = {}; spec.nodes.forEach((n) => { byNode[n.id] = n; });
    const byItem = {}; spec.items.forEach((it) => { byItem[it.id] = it; });
    let states = {}, visible = spec.cols.map((cc) => cc.id), mode = "grp";
    host.textContent = "";
    /* 조작부 */
    const ctl = el("div", { class: "lm-ctl" });
    const colBox = el("div", { class: "lm-cols", role: "group", "aria-label": "보일 기둥(변수) 고르기" });
    colBox.appendChild(el("span", { class: "lbl", text: "기둥(변수)" }));
    spec.cols.forEach((cc) => { const lab = el("label", { class: "lm-chk" }); const cb = el("input", { type: "checkbox" }); cb.checked = true;
      cb.addEventListener("change", () => { const on = spec.cols.map((x) => x.id).filter((id) => (id === cc.id ? cb.checked : visible.indexOf(id) >= 0)); if (on.length < 2) { cb.checked = true; return; } visible = on; draw(); });
      lab.appendChild(cb); lab.appendChild(document.createTextNode(cc.name)); colBox.appendChild(lab); });
    ctl.appendChild(colBox);
    const row2 = el("div", { class: "lm-row" });
    const sel = el("select", { "aria-label": "조건을 걸 칸 고르기" }); sel.appendChild(el("option", { text: "칸 고르기(키보드용)", value: "" }));
    spec.cols.forEach((cc) => { const og = el("optgroup"); og.label = cc.name; spec.nodes.filter((n) => n.col === cc.id).forEach((n) => { const o = el("option", { text: label(n) }); o.value = n.id; og.appendChild(o); }); sel.appendChild(og); });
    row2.appendChild(sel);
    [["in", "포함"], ["out", "제외"], ["", "해제"]].forEach((q) => { const b = el("button", { type: "button", class: "btn sm ghost", text: q[1] }); b.addEventListener("click", () => { if (!sel.value) return; const s = Object.assign({}, states); if (q[0]) s[sel.value] = q[0]; else delete s[sel.value]; states = s; draw(); }); row2.appendChild(b); });
    const reset = el("button", { type: "button", class: "btn sm", text: "조건 모두 지우기" }); reset.addEventListener("click", () => { states = {}; draw(); }); row2.appendChild(reset);
    if (opts.score) { const ms = el("select", { "aria-label": "줄기 색 기준" }); [["grp", "색: 기능 묶음"], ["score", "색: " + (opts.scoreName || "점수")]].forEach((q) => { const o = el("option", { text: q[1] }); o.value = q[0]; ms.appendChild(o); }); ms.addEventListener("change", () => { mode = ms.value; draw(); }); row2.appendChild(ms); }
    ctl.appendChild(row2);
    host.appendChild(ctl);
    const chips = el("div", { class: "lm-chips", "aria-live": "polite" }); host.appendChild(chips);
    const out = el("div", { class: "readout lm-out", "aria-live": "polite" }); host.appendChild(out);
    const lgd = el("div", { class: "lgd" }); host.appendChild(lgd);
    const wrap = el("div", { class: "flowwrap", role: "region", "aria-label": "연결 지도, 가로로 밀어 보기", tabindex: "0" }); const plot = el("div", { class: "plotbox" }); wrap.appendChild(plot); host.appendChild(wrap);
    host.appendChild(el("div", { class: "fig-s", text: "칸을 한 번 누르면 포함(진하게), 두 번 누르면 제외(빨간 테두리), 세 번 누르면 해제입니다. 같은 기둥 안의 포함은 '하나라도 해당', 다른 기둥끼리는 '모두 만족'으로 겹칩니다. 기둥을 끄면 남은 기둥끼리 바로 잇습니다." }));
    function scoreCol(v) { const t = Math.max(0, Math.min(1, (v - 1.5) / 3)); return "color-mix(in srgb, " + c("--accent") + " " + Math.round(15 + t * 85) + "%, " + c("--mark-muted") + ")"; }
    function draw() {
      const items = L.filterItems(spec, states), ids = items.map((it) => it.id), cnt = L.counts(spec, items);
      /* 칩 */
      chips.textContent = "";
      Object.keys(states).forEach((id) => { const b = el("button", { type: "button", class: "lm-chip " + states[id], text: (states[id] === "in" ? "+ " : "− ") + label(byNode[id]) + " ×", "aria-label": label(byNode[id]) + " 조건 지우기" }); b.addEventListener("click", () => { const s = Object.assign({}, states); delete s[id]; states = s; draw(); }); chips.appendChild(b); });
      /* 요약 */
      out.textContent = "";
      if (!items.length) out.append(el("b", { text: "조건을 모두 만족하는 " + word + "이 없습니다." }), " 조건을 하나 지워 보세요.");
      else {
        out.append(el("b", { text: word + " " + items.length + " / " + spec.items.length }), ": " + ids.map(itemName).join(", "));
        const per = spec.cols.filter((cc) => cc.id !== opts.itemCol).map((cc) => cc.name + " " + spec.nodes.filter((n) => n.col === cc.id && cnt[n.id] > 0).length + "칸");
        out.append(" · 닿는 칸: " + per.join(", "));
        if (opts.score) { const avg = ids.reduce((a, id) => a + opts.score(id), 0) / ids.length; out.append(" · 평균 " + (opts.scoreName || "점수") + " " + avg.toFixed(1)); }
      }
      /* 범례 */
      lgd.textContent = "";
      if (mode === "grp" && opts.groups) Object.keys(opts.groups).forEach((g) => { const s = el("span"); const i = el("i"); i.style.background = c(opts.groups[g].css); s.appendChild(i); s.appendChild(document.createTextNode(opts.groups[g].name)); lgd.appendChild(s); });
      else if (mode === "score") [1.5, 3, 4.5].forEach((v) => { const s = el("span"); const i = el("i"); i.style.background = scoreCol(v); s.appendChild(i); s.appendChild(document.createTextNode((opts.scoreName || "점수") + " " + v)); lgd.appendChild(s); });
      /* 그림 */
      plot.textContent = "";
      const vis = spec.cols.filter((cc) => visible.indexOf(cc.id) >= 0), NW = 138, NH = 24, top = 30, n = vis.length;
      const minW = n * NW + (n - 1) * 46 + 16, FW = Math.max(minW, Math.round(plot.clientWidth || minW));
      plot.style.minWidth = minW + "px";
      const maxN = Math.max.apply(null, vis.map((cc) => spec.nodes.filter((q) => q.col === cc.id).length)), H = top + maxN * (NH + 9) + 10;
      const s = sv("svg", { viewBox: "0 0 " + FW + " " + H, width: FW, height: H, role: "img", "aria-label": vis.map((cc) => cc.name).join(" → ") + " 연결 지도. " + word + " " + items.length + "개 표시" }, plot);
      const gapX = (FW - 16 - NW * n) / Math.max(1, n - 1), P = {};
      vis.forEach((cc, ci) => { const list = spec.nodes.filter((q) => q.col === cc.id), span = maxN * (NH + 9), step = span / list.length;
        sv("text", { x: 8 + ci * (NW + gapX) + NW / 2, y: 16, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: c("--ink") }, s).textContent = cc.name;
        list.forEach((q, i) => { P[q.id] = { x: 8 + ci * (NW + gapX), y: top + i * step + (step - NH) / 2 }; }); });
      const colorOf = (b) => { if (mode === "score" && opts.score) return scoreCol(b.items.reduce((a, id) => a + opts.score(id), 0) / b.items.length); const gs = Array.from(new Set(b.items.map((id) => byItem[id].grp))); return gs.length === 1 && opts.groups && opts.groups[gs[0]] ? c(opts.groups[gs[0]].css) : c("--mark-muted"); };
      const path = (b) => { const A = P[b.a], B = P[b.b], x1 = A.x + NW, y1 = A.y + NH / 2, x2 = B.x, y2 = B.y + NH / 2, mx = (x1 + x2) / 2; return "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2; };
      const lw = (w) => Math.min(14, 0.8 + w * 0.9), filtered = Object.keys(states).length > 0;
      const gl = sv("g", {}, s);
      L.bundle(L.links(spec, visible, items)).forEach((b) => sv("path", { d: path(b), fill: "none", stroke: colorOf(b), "stroke-width": lw(b.w), opacity: filtered ? 0.8 : 0.4 }, gl));
      spec.nodes.forEach((q) => { const p = P[q.id]; if (!p) return;
        const st = states[q.id], live = cnt[q.id] > 0, g = sv("g", { class: "nd", opacity: live || st ? 1 : 0.32 }, s);
        sv("rect", { x: p.x, y: p.y, width: NW, height: NH, rx: 4, fill: st === "in" ? c("--accent") : c("--surface"), stroke: st === "out" ? c("--neg") : q.grp && opts.groups && opts.groups[q.grp] ? c(opts.groups[q.grp].css) : c("--rule"), "stroke-width": st === "out" ? 2.4 : q.grp ? 1.6 : 1, "stroke-dasharray": st === "out" ? "4 2" : null }, g);
        const t = sv("text", { x: p.x + 8, y: p.y + NH / 2 + 4, "font-size": 11, fill: st === "in" ? "#fff" : st === "out" ? c("--neg") : c("--ink"), "font-weight": q.grp ? 600 : 500, "text-decoration": st === "out" ? "line-through" : null }, g); t.textContent = label(q);
        if (live && !st) { const ct = sv("text", { x: p.x + NW - 6, y: p.y + NH / 2 + 4, "text-anchor": "end", "font-size": 9.5, fill: c("--muted"), class: "n" }, g); ct.textContent = String(cnt[q.id]); }
        g.addEventListener("click", () => { states = L.cycle(states, q.id); sel.value = q.id; draw(); }); });
      if (opts.onChange) opts.onChange({ states: states, items: items, visible: visible });
    }
    draw();
    F.onRedraw(draw);
    return { redraw: draw, set: (s) => { states = s || {}; draw(); }, setScore: () => { if (mode === "score") draw(); } };
  }
  window.LinkMapUI = { mount: mount };
})();

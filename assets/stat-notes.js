/* 통계 기법 노트(tools/stats-notes.html)의 도표. 계산은 assets/engines/statlab.js, 기초 함수는 assets/stats.js */
(function () {
  "use strict";
  const F = window.Fin, S = window.Stats, L = window.StatLab, $ = F.$, NS = "http://www.w3.org/2000/svg";
  const c = (n) => F.css(n);
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (p, x, y, s, a) => { const e = sv("text", Object.assign({ x: x, y: y, fill: c("--ink-2"), "font-size": 11 }, a || {}), p); e.textContent = s; return e; };
  const lin = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  const path = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sg = (v, d) => (v > 0 ? "+" : "") + fmt(v, d);
  const pc = (v, d) => fmt(v * 100, d === undefined ? 1 : d) + "%";
  const put = (o) => { for (const k in o) { const e = $(k); if (e) e.textContent = o[k]; } };
  const mx = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity), mn = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity);

  function frame(id, H, label) {
    const host = $(id); host.textContent = "";
    const W = Math.max(280, Math.round(host.clientWidth || 640));
    const svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label || "" }, host);
    return { svg: svg, W: W, H: H, nar: W < 520 };
  }
  function gridY(svg, y, ticks, x0, x1, f, right) {
    ticks.forEach((v) => {
      sv("line", { x1: x0, x2: x1, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, svg);
      tx(svg, right ? x1 + 6 : x0 - 6, y(v) + 4, f(v), { "text-anchor": right ? "start" : "end", class: "n", "font-size": 10.5, fill: c("--muted") });
    });
  }
  function ticksX(svg, x, ticks, yb, f) {
    ticks.forEach((v) => {
      sv("line", { x1: x(v), x2: x(v), y1: yb, y2: yb + 4, stroke: c("--rule") }, svg);
      tx(svg, x(v), yb + 16, f(v), { "text-anchor": "middle", class: "n", "font-size": 10.5, fill: c("--muted") });
    });
  }
  function dtable(id, head, rows) {
    const host = $(id); if (!host) return; host.textContent = "";
    const t = F.el("table", { class: "ledger" }), th = F.el("thead"), tr = F.el("tr");
    head.forEach((h) => tr.appendChild(F.el("th", { text: h }))); th.appendChild(tr); t.appendChild(th);
    const tb = F.el("tbody");
    rows.forEach((r) => { const row = F.el("tr"); r.forEach((v, i) => row.appendChild(F.el(i ? "td" : "th", { text: String(v) }))); tb.appendChild(row); });
    t.appendChild(tb); host.appendChild(t);
  }
  const radio = (name) => { const e = document.querySelector('input[name="' + name + '"]:checked'); return e ? +e.value : null; };

  /* ---------- 1. 분포 요약 ---------- */
  const RC = L.receivables(), BX = L.box(RC);
  function drawDesc() {
    const fr = frame("desc-fig", 300, "회수일 히스토그램과 상자 그림. 평균 " + fmt(BX.mean, 1) + "일, 중앙값 " + BX.median + "일"), svg = fr.svg, l = 40, r = fr.W - 14;
    const x = lin(0, 120, l, r), hg = S.histogram(RC, 12, 0, 120), top = mx(hg.counts), yt = F.niceTicks(0, top, 4), y = lin(0, yt.hi, 196, 40);
    gridY(svg, y, yt.ticks, l, r, (v) => String(v));
    tx(svg, l, 24, "거래처 수", { "font-size": 10.5, fill: c("--muted") });
    hg.counts.forEach((n, i) => { const x0 = x(hg.edges[i]) + 1, x1 = x(hg.edges[i] + hg.w) - 1; if (n) sv("rect", { x: x0, y: y(n), width: x1 - x0, height: y(0) - y(n), fill: c("--mark-muted"), opacity: 0.6 }, svg); });
    const vline = (v, col, lab, right) => {
      sv("line", { x1: x(v), x2: x(v), y1: 34, y2: 258, stroke: col, "stroke-width": 1.8, "stroke-dasharray": "5 3" }, svg);
      tx(svg, x(v) + (right ? 6 : -6), 44, lab, { "text-anchor": right ? "start" : "end", fill: col, "font-weight": 700 });
    };
    vline(BX.median, c("--input"), "중앙값 " + BX.median + "일", false);
    vline(BX.mean, c("--neg"), "평균 " + fmt(BX.mean, 1) + "일", true);
    const yb = 232, h = 22;
    sv("line", { x1: x(BX.lo), x2: x(BX.q1), y1: yb, y2: yb, stroke: c("--ink-2"), "stroke-width": 1.4 }, svg);
    sv("line", { x1: x(BX.q3), x2: x(BX.hi), y1: yb, y2: yb, stroke: c("--ink-2"), "stroke-width": 1.4 }, svg);
    [BX.lo, BX.hi].forEach((v) => sv("line", { x1: x(v), x2: x(v), y1: yb - 7, y2: yb + 7, stroke: c("--ink-2"), "stroke-width": 1.4 }, svg));
    sv("rect", { x: x(BX.q1), y: yb - h / 2, width: x(BX.q3) - x(BX.q1), height: h, fill: c("--surface"), stroke: c("--ink-2"), "stroke-width": 1.4, rx: 2 }, svg);
    sv("line", { x1: x(BX.median), x2: x(BX.median), y1: yb - h / 2, y2: yb + h / 2, stroke: c("--input"), "stroke-width": 2.6 }, svg);
    BX.out.forEach((v, i) => sv("circle", { cx: x(v), cy: yb + (i % 2 ? 4 : -4), r: 3.6, fill: c("--neg") }, svg));
    if (BX.out.length) tx(svg, x(BX.out[0]) - 6, yb - 12, "이상치 " + BX.out.length + "곳", { "text-anchor": "end", fill: c("--neg-ink"), "font-size": 10.5 });
    ticksX(svg, x, [0, 20, 40, 60, 80, 100, 120], 266, (v) => v + "일");
    put({ "d-mean": fmt(BX.mean, 1), "d-med": String(BX.median), "d-q1": fmt(BX.q1, 0), "d-q3": fmt(BX.q3, 0), "d-nout": String(BX.out.length), "d-p90": fmt(BX.p90, 0) });
    dtable("desc-tb", ["지표", "값(일)"], [["거래처 수", BX.n + "곳"], ["평균", fmt(BX.mean, 1)], ["표준편차", fmt(BX.sd, 1)], ["최솟값", mn(RC)], ["1사분위", fmt(BX.q1, 2)], ["중앙값", BX.median],
      ["3사분위", fmt(BX.q3, 2)], ["P90", fmt(BX.p90, 1)], ["최댓값", mx(RC)], ["위 울타리(3사분위 + 1.5 × IQR)", fmt(BX.uf, 2)], ["이상치", BX.out.join(", ")], ["왜도", fmt(S.skew(RC), 2)]]);
  }

  /* ---------- 2. 신뢰구간 ---------- */
  const CI = { n: 10, seed: 1, d: null, tot: {} };
  function sampleCI() {
    CI.d = L.ciDraws(CI.n, 20, CI.n * 1000 + CI.seed);
    const h = CI.d.filter((v) => v.hit).length, t = CI.tot[CI.n] || { h: 0, t: 0 };
    t.h += h; t.t += 20; CI.tot[CI.n] = t;
  }
  function drawCI() {
    const d = CI.d, H = 26 + d.length * 14 + 34, fr = frame("ci-fig", H, "표본 " + CI.n + "개로 만든 95% 구간 20개"), svg = fr.svg, l = 14, r = fr.W - 14;
    const x = lin(70, 130, l, r), cl = (v) => Math.max(70, Math.min(130, v));
    [80, 90, 110, 120].forEach((v) => sv("line", { x1: x(v), x2: x(v), y1: 18, y2: H - 30, stroke: c("--rule-soft") }, svg));
    sv("line", { x1: x(100), x2: x(100), y1: 14, y2: H - 30, stroke: c("--ink"), "stroke-width": 1.4, "stroke-dasharray": "4 3" }, svg);
    tx(svg, x(100) + 6, 14, "참값 100", { fill: c("--ink"), "font-size": 10.5 });
    d.forEach((ci, i) => {
      const yy = 28 + i * 14, col = ci.hit ? c("--input") : c("--neg");
      sv("line", { x1: x(cl(ci.lo)), x2: x(cl(ci.hi)), y1: yy, y2: yy, stroke: col, "stroke-width": ci.hit ? 2 : 2.8, "stroke-linecap": "round" }, svg);
      sv("circle", { cx: x(cl(ci.mean)), cy: yy, r: 2.8, fill: col }, svg);
    });
    ticksX(svg, x, [70, 80, 90, 100, 110, 120, 130], H - 28, (v) => String(v));
    const h = d.filter((v) => v.hit).length, t = CI.tot[CI.n], avg = S.mean(d.map((v) => v.half));
    put({ "ci-out": "이번 20개 중 " + h + "개가 참값 포함 · 표본 " + CI.n + "개의 평균 반폭 ±" + fmt(avg, 1) + " · 지금까지 " + t.h + "/" + t.t + "개(" + pc(t.h / t.t, 0) + ")" });
  }
  function ciTable() {
    dtable("ci-tb", ["표본 수", "t값(95%)", "대략적 반폭 t × 12 ÷ √n"], [5, 10, 30, 100].map((n) => { const t = S.tInv(0.975, n - 1); return [n, fmt(t, 3), "±" + fmt(t * 12 / Math.sqrt(n), 2)]; }));
    put({ "ci-ss": String(L.sampleSize(12, 3)) });
  }

  /* ---------- 3. 부트스트랩 ---------- */
  const RP = L.repairs(), BM = L.bootstrap(RP, S.mean, 4000, 31), BD = L.bootstrap(RP, (a) => S.quantile(a, 0.5), 4000, 32), TC = L.meanCI(RP);
  function drawBoot() {
    const fr = frame("boot-fig", 292, "수리비 15건과 부트스트랩 평균 분포. 95% 구간 " + fmt(BM.lo, 2) + "~" + fmt(BM.hi, 2)), svg = fr.svg, l = 16, r = fr.W - 16;
    const x = lin(0, 25, l, r);
    tx(svg, l, 16, "수리 15건(백만원)", { fill: c("--muted"), "font-size": 10.5 });
    RP.forEach((v, i) => sv("circle", { cx: x(v), cy: 34 + (i % 3 - 1) * 5, r: 4, fill: c("--ink-2"), opacity: 0.75 }, svg));
    const hg = S.histogram(BM.v, 50, 0, 25), y = lin(0, mx(hg.counts), 206, 70);
    tx(svg, l, 64, "복원추출 표본 평균 4,000개", { fill: c("--muted"), "font-size": 10.5 });
    hg.counts.forEach((n, i) => {
      if (!n) return; const a = hg.edges[i], b = a + hg.w, mid = (a + b) / 2, inside = mid >= BM.lo && mid <= BM.hi;
      sv("rect", { x: x(a) + 0.5, y: y(n), width: Math.max(1, x(b) - x(a) - 1), height: y(0) - y(n), fill: inside ? c("--input") : c("--mark-muted"), opacity: inside ? 0.7 : 0.5 }, svg);
    });
    sv("line", { x1: l, x2: r, y1: y(0), y2: y(0), stroke: c("--rule") }, svg);
    const bracket = (yy, lo, hi, col, lab) => {
      sv("line", { x1: x(lo), x2: x(hi), y1: yy, y2: yy, stroke: col, "stroke-width": 3, "stroke-linecap": "round" }, svg);
      sv("circle", { cx: x(BM.est), cy: yy, r: 3.6, fill: col }, svg);
      tx(svg, x(hi) + 8, yy + 4, lab + " " + fmt(lo, 2) + "~" + fmt(hi, 2), { fill: col, "font-size": 10.5, "font-weight": 600 });
    };
    bracket(226, BM.lo, BM.hi, c("--input"), fr.nar ? "부트스트랩" : "부트스트랩 95%");
    bracket(248, TC.lo, TC.hi, c("--ink-2"), fr.nar ? "t분포" : "t분포 95%");
    ticksX(svg, x, [0, 5, 10, 15, 20, 25], 266, (v) => String(v));
    put({ "b-mean": fmt(BM.est, 2), "b-lo": fmt(BM.lo, 2), "b-hi": fmt(BM.hi, 2), "b-tlo": fmt(TC.lo, 2), "b-thi": fmt(TC.hi, 2), "b-dn": fmt(BM.est - BM.lo, 2), "b-up": fmt(BM.hi - BM.est, 2),
      "b-med": fmt(BD.est, 1), "b-mlo": fmt(BD.lo, 1), "b-mhi": fmt(BD.hi, 1) });
    dtable("boot-tb", ["방법", "추정값", "95% 하한", "95% 상한", "아래 폭", "위 폭"], [
      ["평균 · 부트스트랩(백분위)", fmt(BM.est, 2), fmt(BM.lo, 2), fmt(BM.hi, 2), fmt(BM.est - BM.lo, 2), fmt(BM.hi - BM.est, 2)],
      ["평균 · t분포", fmt(TC.mean, 2), fmt(TC.lo, 2), fmt(TC.hi, 2), fmt(TC.half, 2), fmt(TC.half, 2)],
      ["중앙값 · 부트스트랩(백분위)", fmt(BD.est, 2), fmt(BD.lo, 2), fmt(BD.hi, 2), fmt(BD.est - BD.lo, 2), fmt(BD.hi - BD.est, 2)]]);
  }

  /* ---------- 4. 두 집단 비교 ---------- */
  const LT = L.lots(), CP = L.compare(LT.before, LT.after);
  function drawTest() {
    const fr = frame("test-fig", 290, "개선 전후 로트별 단위원가와 평균 차이 " + fmt(CP.diff, 2) + ", 95% 구간 " + fmt(CP.lo, 2) + "~" + fmt(CP.hi, 2)), svg = fr.svg, W = fr.W;
    const all = LT.before.concat(LT.after), y = lin(Math.floor(mn(all) - 2), Math.ceil(mx(all) + 2), 236, 30), l = 40, mid = Math.round(W * 0.6), yt = F.niceTicks(Math.floor(mn(all) - 2), Math.ceil(mx(all) + 2), 5);
    gridY(svg, y, yt.ticks.filter((v) => y(v) <= 236 && y(v) >= 30), l, mid - 10, (v) => String(v));
    const col = (arr, cx, color, name, m) => {
      arr.forEach((v, i) => sv("circle", { cx: cx + ((i * 37) % 11 - 5) * 3, cy: y(v), r: 3.6, fill: color, opacity: 0.75 }, svg));
      sv("line", { x1: cx - 26, x2: cx + 26, y1: y(m), y2: y(m), stroke: c("--ink"), "stroke-width": 2.6 }, svg);
      tx(svg, cx + 30, y(m) + 4, fmt(m, 1), { class: "n", fill: c("--ink"), "font-weight": 700 });
      tx(svg, cx, 258, name, { "text-anchor": "middle", fill: c("--ink"), "font-size": 11 });
      tx(svg, cx, 274, arr.length + "개 로트", { "text-anchor": "middle", fill: c("--muted"), "font-size": 10.5 });
    };
    col(LT.before, l + (mid - l) * 0.28, c("--mark-muted"), "개선 전", CP.ma);
    col(LT.after, l + (mid - l) * 0.74, c("--input"), "개선 후", CP.mb);
    const r0 = mid + 34, r1 = W - 16, dy = lin(-8, 2, 236, 30);
    sv("line", { x1: mid + 8, x2: mid + 8, y1: 24, y2: 244, stroke: c("--rule") }, svg);
    [-8, -6, -4, -2, 0, 2].forEach((v) => { sv("line", { x1: r0, x2: r1, y1: dy(v), y2: dy(v), stroke: v === 0 ? c("--ink-2") : c("--rule-soft"), "stroke-dasharray": v === 0 ? "4 3" : null }, svg); tx(svg, r0 - 4, dy(v) + 4, sg(v, 0), { "text-anchor": "end", class: "n", "font-size": 10.5, fill: c("--muted") }); });
    const cx = (r0 + r1) / 2;
    sv("line", { x1: cx, x2: cx, y1: dy(CP.lo), y2: dy(CP.hi), stroke: c("--input"), "stroke-width": 3 }, svg);
    [CP.lo, CP.hi].forEach((v) => sv("line", { x1: cx - 8, x2: cx + 8, y1: dy(v), y2: dy(v), stroke: c("--input"), "stroke-width": 2 }, svg));
    sv("circle", { cx: cx, cy: dy(CP.diff), r: 5, fill: c("--input") }, svg);
    tx(svg, cx + 10, dy(CP.diff) + 4, fmt(CP.diff, 1), { class: "n", fill: c("--input"), "font-weight": 700 });
    tx(svg, cx, 258, "차이(후 − 전)", { "text-anchor": "middle", fill: c("--ink"), "font-size": 11 });
    tx(svg, cx, 274, "95% 신뢰구간", { "text-anchor": "middle", fill: c("--muted"), "font-size": 10.5 });
    put({ "t-ma": fmt(CP.ma, 1), "t-mb": fmt(CP.mb, 1), "t-diff": fmt(Math.abs(CP.diff), 1), "t-p": fmt(CP.p, 3), "t-lo": fmt(CP.lo, 1), "t-hi": fmt(CP.hi, 1), "t-d": fmt(Math.abs(CP.d), 2),
      "t-abs": fmt(Math.abs(CP.diff), 1), "t-rng": fmt(Math.abs(CP.hi), 1) + "~" + fmt(Math.abs(CP.lo), 1) });
    dtable("test-tb", ["지표", "값"], [["개선 전 평균(24개)", fmt(CP.ma, 2)], ["개선 후 평균(20개)", fmt(CP.mb, 2)], ["차이(후 − 전)", fmt(CP.diff, 2)], ["표준오차", fmt(CP.se, 3)],
      ["웰치 자유도", fmt(CP.df, 1)], ["t", fmt(CP.t, 3)], ["p(양측)", fmt(CP.p, 4)], ["95% 신뢰구간", fmt(CP.lo, 2) + " ~ " + fmt(CP.hi, 2)], ["코헨의 d", fmt(CP.d, 2)]]);
  }
  function drawFW() {
    const ms = [1, 5, 10, 20, 50], fr = frame("fw-fig", 190, "검정 횟수별 우연히 하나 이상 유의할 확률"), svg = fr.svg, l = 36, r = fr.W - 10, y = lin(0, 1, 150, 18);
    gridY(svg, y, [0, 0.5, 1], l, r, (v) => pc(v, 0));
    const bw = (r - l) / ms.length;
    ms.forEach((m, i) => {
      const p = L.familywise(m), x0 = l + i * bw + bw * 0.18, w = bw * 0.64;
      sv("rect", { x: x0, y: y(p), width: w, height: y(0) - y(p), fill: m === 20 ? c("--neg") : c("--mark-muted"), opacity: m === 20 ? 0.85 : 0.6, rx: 2 }, svg);
      tx(svg, x0 + w / 2, y(p) - 5, pc(p, 0), { "text-anchor": "middle", class: "n", fill: c("--ink"), "font-size": 10.5, "font-weight": m === 20 ? 700 : 400 });
      tx(svg, x0 + w / 2, 168, m + "번", { "text-anchor": "middle", fill: c("--muted"), "font-size": 10.5 });
    });
    tx(svg, l + (r - l) / 2, 186, "검정 횟수", { "text-anchor": "middle", fill: c("--muted"), "font-size": 10 });
  }
  function pnTable() {
    const host = $("pn-tb"); host.textContent = "";
    const t = F.el("table", { class: "mini" }), th = F.el("thead"), tr = F.el("tr");
    ["집단별 표본", "t", "p(양측)", "판정(5%)"].forEach((h) => tr.appendChild(F.el("th", { text: h }))); th.appendChild(tr); t.appendChild(th);
    const tb = F.el("tbody");
    L.pBySize(1, 6, [20, 200, 2000]).forEach((o) => { const row = F.el("tr"); [o.n.toLocaleString("ko-KR") + "개", fmt(o.t, 2), o.p < 0.0001 ? "< 0.0001" : fmt(o.p, 4), o.p < 0.05 ? "유의" : "유의하지 않음"].forEach((v) => row.appendChild(F.el("td", { text: v }))); tb.appendChild(row); });
    t.appendChild(tb); host.appendChild(t);
  }

  /* ---------- 5. 앤스컴 ---------- */
  function drawAns() {
    const fr = frame("ans-fig", fr0H(), "앤스컴의 네 데이터 산점도"), svg = fr.svg, W = fr.W, gap = 18, pw = (W - 30 - gap) / 2, ph = fr.nar ? 150 : 170;
    function fr0H() { const w = Math.max(280, Math.round($("ans-fig").clientWidth || 640)); return 2 * (w < 520 ? 150 : 170) + 70; }
    L.ANSCOMBE.forEach((d, k) => {
      const ox = 26 + (k % 2) * (pw + gap), oy = 12 + Math.floor(k / 2) * (ph + 34), x = lin(2, 20, ox, ox + pw), y = lin(2, 14, oy + ph, oy);
      sv("rect", { x: ox, y: oy, width: pw, height: ph, fill: "none", stroke: c("--rule-soft") }, svg);
      [5, 10, 15].forEach((v) => tx(svg, x(v), oy + ph + 14, String(v), { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }));
      [4, 8, 12].forEach((v) => tx(svg, ox - 4, y(v) + 3, String(v), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }));
      sv("line", { x1: x(2), x2: x(20), y1: y(3 + 0.5 * 2), y2: y(3 + 0.5 * 20), stroke: c("--accent"), "stroke-width": 1.6 }, svg);
      d.x.forEach((xv, i) => sv("circle", { cx: x(xv), cy: y(d.y[i]), r: 3.6, fill: c("--input"), opacity: 0.85 }, svg));
      tx(svg, ox + 8, oy + 16, ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ"][k], { fill: c("--ink"), "font-weight": 700, "font-size": 13 });
    });
    dtable("ans-tb", ["데이터", "x 평균", "y 평균", "x 분산", "y 분산", "상관계수", "절편", "기울기", "R²"], L.ANSCOMBE.map((d, k) => { const s = L.summary2(d); return [["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ"][k], fmt(s.mx, 2), fmt(s.my, 2), fmt(s.sx, 2), fmt(s.sy, 2), fmt(s.r, 3), fmt(s.a, 2), fmt(s.b, 3), fmt(s.r2, 2)]; }));
  }

  /* ---------- 6. 회귀 ---------- */
  const PW = L.power(), RB = L.regBands(PW.x, PW.y);
  function drawReg() {
    const x0v = +$("reg-x").value, p = RB.at(x0v), out = x0v < RB.xmin || x0v > RB.xmax;
    const fr = frame("reg-fig", 300, "생산량과 전력비 산점도, 회귀선과 신뢰·예측구간"), svg = fr.svg, l = 40, r = fr.W - 12;
    const x = lin(35, 115, l, r), lo = RB.at(35), hi = RB.at(115), yt = F.niceTicks(lo.fit - lo.pi - 0.1, hi.fit + hi.pi + 0.1, 5), y = lin(yt.lo, yt.hi, 262, 20);
    gridY(svg, y, yt.ticks, l, r, (v) => fmt(v, 1));
    sv("rect", { x: x(RB.xmax), y: 20, width: r - x(RB.xmax), height: 242, fill: c("--ink"), opacity: 0.04 }, svg);
    sv("rect", { x: l, y: 20, width: x(RB.xmin) - l, height: 242, fill: c("--ink"), opacity: 0.04 }, svg);
    tx(svg, r - 4, 34, "관측 범위 밖", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 });
    const xs = []; for (let v = 35; v <= 115; v += 1) xs.push(v);
    const band = (k, op) => sv("path", { d: path(xs.map((v) => [x(v), y(RB.at(v).fit + RB.at(v)[k])]).concat(xs.slice().reverse().map((v) => [x(v), y(RB.at(v).fit - RB.at(v)[k])]))) + "Z", fill: c("--input"), opacity: op }, svg);
    band("pi", 0.1); band("ci", 0.22);
    sv("line", { x1: x(35), x2: x(115), y1: y(lo.fit), y2: y(hi.fit), stroke: c("--input"), "stroke-width": 2 }, svg);
    PW.x.forEach((v, i) => sv("circle", { cx: x(v), cy: y(PW.y[i]), r: 3.3, fill: c("--ink-2"), opacity: 0.8 }, svg));
    sv("line", { x1: x(x0v), x2: x(x0v), y1: 20, y2: 262, stroke: c("--accent"), "stroke-dasharray": "4 3" }, svg);
    sv("line", { x1: x(x0v), x2: x(x0v), y1: y(p.fit - p.pi), y2: y(p.fit + p.pi), stroke: c("--accent"), "stroke-width": 3.2, "stroke-linecap": "round" }, svg);
    sv("circle", { cx: x(x0v), cy: y(p.fit), r: 5, fill: c("--accent") }, svg);
    ticksX(svg, x, [40, 60, 80, 100], 262, (v) => String(v));
    tx(svg, r, 296, "월 생산량(만 개)", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 });
    tx(svg, l, 12, "전력비(억원)", { fill: c("--muted"), "font-size": 10.5 });
    if (!fr.nar) {
      const lx = 50, ly = 40;
      sv("rect", { x: lx, y: ly, width: 14, height: 9, fill: c("--input"), opacity: 0.32 }, svg); tx(svg, lx + 20, ly + 8, "평균의 95% 신뢰구간", { "font-size": 10.5 });
      sv("rect", { x: lx, y: ly + 16, width: 14, height: 9, fill: c("--input"), opacity: 0.12 }, svg); tx(svg, lx + 20, ly + 24, "한 달 값의 95% 예측구간", { "font-size": 10.5 });
    }
    /* 잔차 */
    const f2 = frame("reg-res", 104, "회귀 잔차 그림"), s2 = f2.svg, em = mx(RB.resid.map(Math.abs)) * 1.15, yr = lin(-em, em, 86, 12);
    sv("line", { x1: x(35), x2: x(115), y1: yr(0), y2: yr(0), stroke: c("--ink-2"), "stroke-dasharray": "4 3" }, s2);
    tx(s2, l - 6, yr(0) + 4, "0", { "text-anchor": "end", class: "n", "font-size": 10.5, fill: c("--muted") });
    tx(s2, l, 10, "잔차(억원)", { fill: c("--muted"), "font-size": 10.5 });
    PW.x.forEach((v, i) => { sv("line", { x1: x(v), x2: x(v), y1: yr(0), y2: yr(RB.resid[i]), stroke: c("--mark-muted") }, s2); sv("circle", { cx: x(v), cy: yr(RB.resid[i]), r: 3, fill: c("--ink-2") }, s2); });
    $("reg-xv").textContent = String(x0v);
    put({ "reg-out": "생산 " + x0v + "만 개 → 예상 전력비 " + fmt(p.fit, 2) + "억원 · 평균의 95% 구간 " + fmt(p.fit - p.ci, 2) + "~" + fmt(p.fit + p.ci, 2) + " · 한 달 95% 예측구간 " + fmt(p.fit - p.pi, 2) + "~" + fmt(p.fit + p.pi, 2) + "억원" + (out ? " · 관측 범위 밖(외삽)" : "") });
    dtable("reg-tb", ["항목", "추정값", "표준오차"], [["절편(고정 부분, 억원)", fmt(RB.a, 3), fmt(RB.seA, 3)], ["기울기(만 개당, 억원)", fmt(RB.b, 4), fmt(RB.seB, 4)], ["R²", fmt(RB.r2, 3), ""], ["잔차 표준편차(억원)", fmt(RB.se, 3), ""],
      ["관측 범위(만 개)", fmt(RB.xmin, 1) + " ~ " + fmt(RB.xmax, 1), ""], ["생산 " + x0v + "만 개 예상", fmt(p.fit, 3), ""], ["  평균의 95% 반폭", "±" + fmt(p.ci, 3), ""], ["  한 달 값의 95% 반폭", "±" + fmt(p.pi, 3), ""]]);
  }
  function regText() { put({ "r-a": fmt(RB.a, 2), "r-b": "약 " + Math.round(RB.b * 1e4) + "만원", "r-r2": fmt(RB.r2, 2), "r-xr": fmt(RB.xmin, 0) + "~" + fmt(RB.xmax, 0) }); }

  /* ---------- 7. 심슨 ---------- */
  const SP = L.simpson();
  function drawSimp() {
    const fr = frame("simp-fig", 250, "공장 A와 B의 제품별, 합계, 표준화 불량률"), svg = fr.svg, l = 36, r = fr.W - 10, y = lin(0, 0.07, 200, 24);
    gridY(svg, y, [0, 0.02, 0.04, 0.06], l, r, (v) => pc(v, 0));
    const G = fr.nar ? [["X", "X"], ["Y", "Y"], ["total", "합계"], ["std", "표준화"]] : [["X", "제품 X(어려움)"], ["Y", "제품 Y(쉬움)"], ["total", "합계"], ["std", "표준화(50:50)"]];
    const gw = (r - l) / G.length, ca = c("--input"), cb = c("--accent");
    G.forEach((g, i) => {
      const gx = l + i * gw;
      if (g[0] === "total") sv("rect", { x: gx + 4, y: 20, width: gw - 8, height: 182, fill: c("--neg"), opacity: 0.06, rx: 4 }, svg);
      [["A", ca], ["B", cb]].forEach((pp, j) => {
        const v = SP[pp[0]][g[0]], bw = gw * 0.26, x0 = gx + gw * 0.2 + j * (bw + gw * 0.08);
        sv("rect", { x: x0, y: y(v), width: bw, height: y(0) - y(v), fill: pp[1], opacity: 0.85, rx: 2 }, svg);
        tx(svg, x0 + bw / 2, y(v) - 5, pc(v, 1), { "text-anchor": "middle", class: "n", "font-size": fr.nar ? 9.5 : 10.5, fill: c("--ink"), "font-weight": g[0] === "total" ? 700 : 400 });
        tx(svg, x0 + bw / 2, 214, pp[0], { "text-anchor": "middle", fill: pp[1], "font-size": 10.5, "font-weight": 700 });
      });
      tx(svg, gx + gw / 2, 234, g[1], { "text-anchor": "middle", fill: c("--ink"), "font-size": 11, "font-weight": g[0] === "total" ? 700 : 400 });
    });
    tx(svg, l + 1.5 * gw + gw * 0.5 + 6, 34, fr.nar ? "합계만 순서 반대" : "합계에서만 A가 나빠 보임", { "text-anchor": "middle", fill: c("--neg-ink"), "font-size": 10.5, "font-weight": 600 });
    /* 구성비 */
    const f2 = frame("simp-mix", 74, "공장별 제품 구성"), s2 = f2.svg, lx = fr.nar ? 56 : 92, rx = f2.W - 10, xm = lin(0, 1, lx, rx);
    [["A", 14], ["B", 42]].forEach((pp) => {
      const sx = SP[pp[0]].shareX;
      tx(s2, lx - 8, pp[1] + 12, "공장 " + pp[0], { "text-anchor": "end", fill: c("--ink"), "font-size": 11 });
      sv("rect", { x: xm(0), y: pp[1], width: xm(sx) - xm(0), height: 16, fill: c("--ink-2"), opacity: 0.8 }, s2);
      sv("rect", { x: xm(sx), y: pp[1], width: xm(1) - xm(sx), height: 16, fill: c("--mark-muted"), opacity: 0.55 }, s2);
      tx(s2, xm(0) + 6, pp[1] + 12, "X " + pc(sx, 0), { fill: "#FFFFFF", "font-size": 10.5, "font-weight": 600 });
      tx(s2, xm(1) - 6, pp[1] + 12, "Y " + pc(1 - sx, 0), { "text-anchor": "end", fill: c("--ink"), "font-size": 10.5 });
    });
    put({ "sp-ta": pc(SP.A.total), "sp-tb": pc(SP.B.total), "sp-xa": pc(SP.A.X), "sp-xb": pc(SP.B.X), "sp-ya": pc(SP.A.Y), "sp-yb": pc(SP.B.Y), "sp-sa": pc(SP.A.std), "sp-sb": pc(SP.B.std) });
    const D = L.SIMPSON;
    dtable("simp-tb", ["공장", "X 생산", "X 불량", "X 불량률", "Y 생산", "Y 불량", "Y 불량률", "합계 불량률", "표준화(50:50)"], ["A", "B"].map((p) => [p, D[p].X[0], D[p].X[1], pc(SP[p].X), D[p].Y[0], D[p].Y[1], pc(SP[p].Y), pc(SP[p].total), pc(SP[p].std)]));
  }

  /* ---------- 8. 시계열 분해 ---------- */
  const SY = L.sales(), DC = L.decompose(SY);
  const mlab = (t) => (Math.floor(t / 12) + 1) + "년차 " + (t % 12 + 1) + "월";
  const remSd = S.sd(DC.remainder.filter((v) => v !== null));
  function drawTS() {
    const fr = frame("ts-fig", 440, "월매출의 추세, 계절, 불규칙 성분"), svg = fr.svg, l = 40, r = fr.W - 12, x = lin(0, 47, l, r);
    /* 원계열 + 추세 */
    const yt = F.niceTicks(mn(SY) - 2, mx(SY) + 2, 4), y = lin(yt.lo, yt.hi, 160, 22);
    gridY(svg, y, yt.ticks, l, r, (v) => String(v));
    tx(svg, l, 12, "원계열과 추세", { fill: c("--ink"), "font-size": 11, "font-weight": 700 });
    sv("path", { d: path(SY.map((v, t) => [x(t), y(v)])), fill: "none", stroke: c("--mark-muted"), "stroke-width": 1.6 }, svg);
    const tp = DC.trend.map((v, t) => (v === null ? null : [x(t), y(v)])).filter(Boolean);
    sv("path", { d: path(tp), fill: "none", stroke: c("--input"), "stroke-width": 2.6 }, svg);
    if (!fr.nar) { tx(svg, tp[tp.length - 1][0] + 6, tp[tp.length - 1][1] + 4, "추세", { fill: c("--input"), "font-weight": 700 }); }
    [0, 12, 24, 36].forEach((t) => { sv("line", { x1: x(t), x2: x(t), y1: 22, y2: 160, stroke: c("--rule-soft") }, svg); tx(svg, x(t) + 3, 174, (t / 12 + 1) + "년차", { fill: c("--muted"), "font-size": 10.5 }); });
    /* 계절 */
    const oy = 196, sy = lin(-6.5, 6.5, oy + 108, oy + 12), bw = (r - l) / 12;
    tx(svg, l, oy, "계절 몫(달별, 억원)", { fill: c("--ink"), "font-size": 11, "font-weight": 700 });
    sv("line", { x1: l, x2: r, y1: sy(0), y2: sy(0), stroke: c("--rule") }, svg);
    DC.index.forEach((v, m) => {
      const x0 = l + m * bw + bw * 0.18, w = bw * 0.64, hi = m === 1 || m === 2;
      sv("rect", { x: x0, y: Math.min(sy(v), sy(0)), width: w, height: Math.abs(sy(v) - sy(0)), fill: hi ? c("--accent") : c("--input"), opacity: hi ? 0.9 : 0.55, rx: 2 }, svg);
      if (!fr.nar) tx(svg, x0 + w / 2, v >= 0 ? sy(v) - 4 : sy(v) + 12, sg(v, 1), { "text-anchor": "middle", class: "n", "font-size": 9.5, fill: c("--ink-2") });
      tx(svg, x0 + w / 2, oy + 124, fr.nar ? String(m + 1) : (m + 1) + "월", { "text-anchor": "middle", fill: c("--muted"), "font-size": 10 });
    });
    /* 불규칙 */
    const o3 = 346, ry = lin(-3.2 * remSd, 3.2 * remSd, o3 + 84, o3 + 12);
    tx(svg, l, o3, "불규칙 성분과 ±2σ", { fill: c("--ink"), "font-size": 11, "font-weight": 700 });
    [2, -2].forEach((k) => sv("line", { x1: l, x2: r, y1: ry(k * remSd), y2: ry(k * remSd), stroke: c("--neg"), "stroke-dasharray": "4 3", opacity: 0.6 }, svg));
    sv("line", { x1: l, x2: r, y1: ry(0), y2: ry(0), stroke: c("--rule") }, svg);
    DC.remainder.forEach((v, t) => {
      if (v === null) return; const out = Math.abs(v) > 2 * remSd;
      sv("line", { x1: x(t), x2: x(t), y1: ry(0), y2: ry(v), stroke: out ? c("--neg") : c("--mark-muted"), "stroke-width": 2 }, svg);
      if (out) { sv("circle", { cx: x(t), cy: ry(v), r: 3.6, fill: c("--neg") }, svg); tx(svg, x(t) + 6, ry(v) + 4, mlab(t), { fill: c("--neg-ink"), "font-size": 10 }); }
    });
  }
  function tsText() {
    const feb = DC.index[1], mar = DC.index[2], gap = mar - feb, mom = SY[38] - SY[37], adj = mom - gap;
    const flags = DC.remainder.map((v, t) => (v !== null && Math.abs(v) > 2 * remSd ? mlab(t) : null)).filter(Boolean);
    put({ "ts-mar": sg(mar, 1), "ts-feb": sg(feb, 1), "ts-gap": fmt(gap, 1), "ts-flag": flags.length ? flags.join(", ") : "이 예시에는 없음",
      "ts-mom": "4년차 3월 매출은 전월보다 " + fmt(mom, 1) + "억원 늘었지만, 계절 몫의 차이를 빼면 " + (adj >= 0 ? fmt(adj, 1) + "억원 증가에 그칩니다." : "오히려 " + fmt(-adj, 1) + "억원 줄어든 셈입니다.") });
    dtable("ts-tb", ["달", "계절 몫(억원)"], DC.index.map((v, m) => [(m + 1) + "월", sg(v, 2)]).concat([["불규칙 성분 표준편차", fmt(remSd, 2)]]));
  }

  /* ---------- 9. 지수평활 ---------- */
  const MY = L.material(), FC0 = L.holtFit(MY, 6); let FCm = FC0;
  function drawFC() {
    const n = MY.length, fc = FCm.fc, z80 = 1.2816, z95 = 1.96;
    const fr = frame("fc-fig", 300, "원재료 단가 지수와 6개월 예측 팬 차트"), svg = fr.svg, l = 40, r = fr.W - (fr.nar ? 12 : 92), x = lin(0, n - 1 + 6, l, r);
    const yt = F.niceTicks(mn(MY) - 2, mx(fc.map((o) => o.f + z95 * o.sd)) + 1, 5), y = lin(yt.lo, yt.hi, 262, 18);
    gridY(svg, y, yt.ticks, l, r, (v) => String(v));
    sv("rect", { x: x(n - 1), y: 18, width: r - x(n - 1), height: 244, fill: c("--ink"), opacity: 0.035 }, svg);
    tx(svg, x(n - 1) + 6, 30, "예측", { fill: c("--muted"), "font-size": 10.5 });
    const pts = (k) => [[x(n - 1), y(MY[n - 1])]].concat(fc.map((o) => [x(n - 1 + o.h), y(o.f + k * o.sd)]));
    const band = (k, op) => sv("path", { d: path(pts(k).concat(pts(-k).reverse())) + "Z", fill: c("--input"), opacity: op }, svg);
    band(z95, 0.12); band(z80, 0.22);
    sv("path", { d: path(FCm.fit.map((v, t) => (v === null ? null : [x(t), y(v)])).filter(Boolean)), fill: "none", stroke: c("--muted"), "stroke-width": 1.2, "stroke-dasharray": "2 3" }, svg);
    sv("path", { d: path(MY.map((v, t) => [x(t), y(v)])), fill: "none", stroke: c("--ink-2"), "stroke-width": 2 }, svg);
    sv("path", { d: path(pts(0)), fill: "none", stroke: c("--input"), "stroke-width": 2.4, "stroke-dasharray": "6 3" }, svg);
    const last = fc[fc.length - 1];
    if (!fr.nar) {
      tx(svg, r + 6, y(last.f + z95 * last.sd) + 4, "95% " + fmt(last.f + z95 * last.sd, 1), { class: "n", fill: c("--muted"), "font-size": 10.5 });
      tx(svg, r + 6, y(last.f) + 4, "예측 " + fmt(last.f, 1), { class: "n", fill: c("--input"), "font-size": 10.5, "font-weight": 700 });
      tx(svg, r + 6, y(last.f - z95 * last.sd) + 4, "95% " + fmt(last.f - z95 * last.sd, 1), { class: "n", fill: c("--muted"), "font-size": 10.5 });
    }
    [0, 12, 24, 36].forEach((t) => tx(svg, x(t), 278, t < 36 ? (t / 12 + 1) + "년차" : "+1~6개월", { "text-anchor": t < 36 ? "middle" : "start", fill: c("--muted"), "font-size": 10.5 }));
    tx(svg, l, 10, "단가 지수", { fill: c("--muted"), "font-size": 10.5 });
    $("fc-av").textContent = fmt(FCm.alpha, 2); $("fc-bv").textContent = fmt(FCm.beta, 2);
    put({ "fc-out": "α " + fmt(FCm.alpha, 2) + " · β " + fmt(FCm.beta, 2) + " · 과거 1개월 앞 예측오차 MAPE " + pc(FCm.mape, 2) + " · 6개월 뒤 " + fmt(last.f, 1) + " (80% " + fmt(last.f - z80 * last.sd, 1) + "~" + fmt(last.f + z80 * last.sd, 1) + ", 95% " + fmt(last.f - z95 * last.sd, 1) + "~" + fmt(last.f + z95 * last.sd, 1) + ")" });
    dtable("fc-tb", ["개월 뒤", "예측", "80% 하한", "80% 상한", "95% 하한", "95% 상한"], fc.map((o) => [o.h, fmt(o.f, 1), fmt(o.f - z80 * o.sd, 1), fmt(o.f + z80 * o.sd, 1), fmt(o.f - z95 * o.sd, 1), fmt(o.f + z95 * o.sd, 1)]));
  }
  function fcText() { const l6 = FC0.fc[5]; put({ "fc-a0": fmt(FC0.alpha, 2), "fc-b0": fmt(FC0.beta, 2), "fc-f6": fmt(l6.f, 1), "fc-lo": fmt(l6.f - 1.96 * l6.sd, 1), "fc-hi": fmt(l6.f + 1.96 * l6.sd, 1) }); }

  /* ---------- 10. 몬테카를로 ---------- */
  let MCR = null;
  function runMC() { MCR = L.mcRun(+$("mc-rho").value, 5000, 2026); }
  function drawMC() {
    const m = MCR, M = L.MC, rho = +$("mc-rho").value;
    const fr = frame("mc-fig", 290, "영업이익 분포와 누적확률"), svg = fr.svg, l = 36, r = fr.W - 40, lo = Math.floor(S.quantile(m.v, 0.002)), hi = Math.ceil(S.quantile(m.v, 0.998));
    const x = lin(lo, hi, l, r), hg = S.histogram(m.v, hi - lo, lo, hi), y = lin(0, mx(hg.counts) * 1.1, 236, 26), yc = lin(0, 1, 236, 26);
    [0, 0.5, 1].forEach((v) => { sv("line", { x1: l, x2: r, y1: yc(v), y2: yc(v), stroke: c("--rule-soft") }, svg); tx(svg, r + 6, yc(v) + 4, pc(v, 0), { class: "n", "font-size": 10.5, fill: c("--muted") }); });
    hg.counts.forEach((n, i) => { if (!n) return; const a = hg.edges[i], b = a + hg.w; sv("rect", { x: x(a) + 0.5, y: y(n), width: Math.max(1, x(b) - x(a) - 1), height: y(0) - y(n), fill: b <= 0 ? c("--neg") : c("--mark-muted"), opacity: b <= 0 ? 0.75 : 0.55 }, svg); });
    const sorted = m.v.slice().sort((a, b) => a - b), cp = [];
    for (let v = lo; v <= hi; v += 0.25) { let k = 0, h = sorted.length; while (k < h) { const md = (k + h) >> 1; if (sorted[md] <= v) k = md + 1; else h = md; } cp.push([x(v), yc(k / sorted.length)]); }
    sv("path", { d: path(cp), fill: "none", stroke: c("--ink"), "stroke-width": 1.8 }, svg);
    const vl = (v, col, lab, right, yy) => { sv("line", { x1: x(v), x2: x(v), y1: 22, y2: 240, stroke: col, "stroke-width": 1.8, "stroke-dasharray": "5 3" }, svg); tx(svg, x(v) + (right ? 6 : -6), yy, lab, { "text-anchor": right ? "start" : "end", fill: col, "font-size": 10.5, "font-weight": 700 }); };
    vl(m.mean, c("--input"), "평균 " + fmt(m.mean, 1), false, 36);
    vl(M.plan, c("--accent"), "계획 " + M.plan, true, 36);
    [[m.p10, "P10"], [m.p50, "P50"], [m.p90, "P90"]].forEach((pp) => { sv("line", { x1: x(pp[0]), x2: x(pp[0]), y1: 240, y2: 248, stroke: c("--ink-2"), "stroke-width": 1.6 }, svg); tx(svg, x(pp[0]), 260, pp[1] + " " + fmt(pp[0], 1), { "text-anchor": "middle", class: "n", fill: c("--ink-2"), "font-size": fr.nar ? 9.5 : 10.5 }); });
    const ts = F.niceTicks(lo, hi, 6).ticks.filter((v) => v >= lo && v <= hi);
    ts.forEach((v) => tx(svg, x(v), 280, String(v), { "text-anchor": "middle", class: "n", fill: c("--muted"), "font-size": 10 }));
    tx(svg, l, 14, "영업이익(억원) 빈도 · 검은 선: 누적확률", { fill: c("--muted"), "font-size": 10.5 });
    $("mc-rv").textContent = sg(rho, 1);
    put({ "mc-mean": fmt(m.mean, 1), "mc-pach": pc(1 - m.pBelow, 0) + "(상관 " + sg(rho, 1) + " 기준)" });
    put({ "mc-out": "평균 " + fmt(m.mean, 1) + "억원 · 표준편차 " + fmt(m.sd, 1) + " · P10 " + fmt(m.p10, 1) + " · P90 " + fmt(m.p90, 1) + " · 계획(13억) 이상일 확률 " + pc(1 - m.pBelow, 0) + " · 적자 확률 " + pc(m.pLoss, 1) });
    dtable("mc-tb", ["지표", "값(억원)"], [["최빈값끼리 계산한 계획", fmt(m.base, 1)], ["평균", fmt(m.mean, 2)], ["표준편차", fmt(m.sd, 2)], ["P10", fmt(m.p10, 2)], ["P50(중앙값)", fmt(m.p50, 2)], ["P90", fmt(m.p90, 2)], ["계획 이상일 확률", pc(1 - m.pBelow, 1)], ["적자 확률", pc(m.pLoss, 1)],
      ["가정: 판매량(만 개)", M.Q.join(" / ")], ["가정: 단가(천원)", M.P.join(" / ")], ["가정: 변동비(천원)", M.V.join(" / ")], ["가정: 고정비(억원)", M.FC.join(" / ")]]);
  }
  function drawTor() {
    const T = L.tornado(), fr = frame("tor-fig", T.length * 40 + 44, "토네이도 차트"), svg = fr.svg, l = fr.nar ? 70 : 120, r = fr.W - (fr.nar ? 34 : 50);
    const lo = Math.min(-1, mn(T.map((d) => d.lo))), hi = Math.max(1, mx(T.map((d) => d.hi))), x = lin(lo, hi, l + 40, r - 6);
    sv("line", { x1: x(0), x2: x(0), y1: 8, y2: T.length * 40 + 12, stroke: c("--ink-2") }, svg);
    T.forEach((d, i) => {
      const yy = 14 + i * 40;
      sv("rect", { x: x(d.lo), y: yy, width: x(0) - x(d.lo), height: 20, fill: c("--neg"), opacity: 0.75, rx: 2 }, svg);
      sv("rect", { x: x(0), y: yy, width: x(d.hi) - x(0), height: 20, fill: c("--pos"), opacity: 0.75, rx: 2 }, svg);
      tx(svg, l - 8, yy + 11, d.name, { "text-anchor": "end", fill: c("--ink"), "font-weight": 600 });
      tx(svg, l - 8, yy + 25, fmt(d.inLo, d.key === "Q" || d.key === "FC" ? 1 : 2) + "~" + fmt(d.inHi, d.key === "Q" || d.key === "FC" ? 1 : 2), { "text-anchor": "end", class: "n", fill: c("--muted"), "font-size": 9.5 });
      tx(svg, x(d.lo) - 4, yy + 14, fmt(d.lo, 1), { "text-anchor": "end", class: "n", "font-size": 10.5, fill: c("--neg-ink") });
      tx(svg, x(d.hi) + 4, yy + 14, sg(d.hi, 1), { class: "n", "font-size": 10.5, fill: c("--pos") });
    });
    tx(svg, x(0), T.length * 40 + 30, "계획 13억원 대비 영업이익 변화(억원)", { "text-anchor": "middle", fill: c("--muted"), "font-size": 10.5 });
  }

  /* ---------- 11. 베이지안 ---------- */
  function drawBayes() {
    const n = +$("by-n").value, kEl = $("by-k"); kEl.max = String(n); if (+kEl.value > n) kEl.value = String(n);
    const k = +kEl.value, m0 = +$("by-m").value / 100, s = radio("by-s") || 10, B = L.bayes(m0, s, n, k, 0.9);
    const fr = frame("by-fig", 260, "수주율 사전·사후 분포"), svg = fr.svg, l = 16, r = fr.W - 16, x = lin(0, 1, l, r);
    const grid = []; for (let i = 1; i < 200; i++) grid.push(i / 200);
    const post = grid.map((p) => L.betaPdf(p, B.a, B.b)), prior = grid.map((p) => L.betaPdf(p, B.a0, B.b0)), top = mx(post) * 1.18, y = lin(0, top, 216, 30), cy = (v) => y(Math.min(v, top));
    sv("line", { x1: l, x2: r, y1: y(0), y2: y(0), stroke: c("--rule") }, svg);
    const area = (from, to, op) => { const g = grid.filter((p) => p >= from && p <= to); if (g.length < 2) return; sv("path", { d: path([[x(g[0]), y(0)]].concat(g.map((p) => [x(p), cy(L.betaPdf(p, B.a, B.b))])).concat([[x(g[g.length - 1]), y(0)]])) + "Z", fill: c("--input"), opacity: op }, svg); };
    area(0, 1, 0.12); area(B.lo, B.hi, 0.26);
    sv("path", { d: path(grid.map((p, i) => [x(p), cy(prior[i])])), fill: "none", stroke: c("--muted"), "stroke-width": 1.8, "stroke-dasharray": "5 4" }, svg);
    sv("path", { d: path(grid.map((p, i) => [x(p), cy(post[i])])), fill: "none", stroke: c("--input"), "stroke-width": 2.4 }, svg);
    sv("line", { x1: x(B.raw), x2: x(B.raw), y1: 26, y2: 216, stroke: c("--accent"), "stroke-width": 1.6, "stroke-dasharray": "4 3" }, svg);
    tx(svg, x(B.raw) + (B.raw > 0.7 ? -6 : 6), 26, "표본 비율 " + pc(B.raw, 0), { "text-anchor": B.raw > 0.7 ? "end" : "start", fill: c("--accent"), "font-size": 10.5, "font-weight": 700 });
    const pm = x(B.postMean);
    tx(svg, pm, y(L.betaPdf(B.postMean, B.a, B.b)) - 8, "사후 " + pc(B.postMean, 0), { "text-anchor": "middle", fill: c("--input"), "font-size": 10.5, "font-weight": 700 });
    ticksX(svg, x, [0, 0.2, 0.4, 0.6, 0.8, 1], 216, (v) => pc(v, 0));
    if (!fr.nar) { sv("line", { x1: r - 150, x2: r - 128, y1: 46, y2: 46, stroke: c("--muted"), "stroke-width": 1.8, "stroke-dasharray": "5 4" }, svg); tx(svg, r - 122, 50, "사전(경험)", { "font-size": 10.5 }); sv("line", { x1: r - 150, x2: r - 128, y1: 64, y2: 64, stroke: c("--input"), "stroke-width": 2.4 }, svg); tx(svg, r - 122, 68, "사후(경험 + 데이터)", { "font-size": 10.5 }); }
    $("by-nv").textContent = n + "건"; $("by-kv").textContent = k + "건"; $("by-mv").textContent = pc(m0, 0);
    const b1 = (v) => fmt(v, v % 1 ? 1 : 0);
    put({ "by-out": "사전 Beta(" + b1(B.a0) + ", " + b1(B.b0) + ") → 사후 Beta(" + b1(B.a) + ", " + b1(B.b) + ") · 수주율 " + pc(B.postMean) + " · 90% 구간 " + pc(B.lo) + "~" + pc(B.hi) + " · 표본 비율만 쓰면 " + pc(B.raw, 0) + "(윌슨 90% " + pc(Math.max(0, B.wLo)) + "~" + pc(Math.min(1, B.wHi)) + ")" });
    dtable("by-tb", ["구분", "분포", "평균", "90% 구간"], [["사전(경험)", "Beta(" + b1(B.a0) + ", " + b1(B.b0) + ")", pc(B.priorMean), pc(B.priorLo) + " ~ " + pc(B.priorHi)], ["사후(경험 + " + n + "건 중 " + k + "건)", "Beta(" + b1(B.a) + ", " + b1(B.b) + ")", pc(B.postMean), pc(B.lo) + " ~ " + pc(B.hi)], ["표본 비율만(윌슨)", "", pc(B.raw), pc(Math.max(0, B.wLo)) + " ~ " + pc(Math.min(1, B.wHi))]]);
  }
  function byText() { const B = L.bayes(0.3, 10, 8, 4, 0.9); put({ "by-post": pc(B.postMean), "by-lo": pc(B.lo), "by-hi": pc(B.hi) }); }

  /* ---------- 12. 집중도 ---------- */
  const CU = L.customers(), CC = L.concentration(CU);
  function drawConc() {
    const fr = frame("conc-p", 250, "거래처 매출 파레토 차트"), svg = fr.svg, l = 30, r = fr.W - 36, rows = CC.rows, bw = (r - l) / rows.length;
    const y = lin(0, Math.ceil(rows[0].v / 10) * 10, 206, 28), yc = lin(0, 1, 206, 28), cols = { A: c("--input"), B: c("--accent"), C: c("--mark-muted") };
    [0.8, 0.95].forEach((v) => { sv("line", { x1: l, x2: r, y1: yc(v), y2: yc(v), stroke: c("--rule"), "stroke-dasharray": "4 3" }, svg); tx(svg, r + 4, yc(v) + 4, pc(v, 0), { class: "n", "font-size": 10, fill: c("--muted") }); });
    rows.forEach((d, i) => sv("rect", { x: l + i * bw + bw * 0.12, y: y(d.v), width: bw * 0.76, height: y(0) - y(d.v), fill: cols[d.cls], opacity: 0.8 }, svg));
    sv("path", { d: path(rows.map((d, i) => [l + (i + 0.5) * bw, yc(d.cum)])), fill: "none", stroke: c("--ink"), "stroke-width": 1.8 }, svg);
    F.niceTicks(0, rows[0].v, 3).ticks.forEach((v) => { if (v <= Math.ceil(rows[0].v / 10) * 10) tx(svg, l - 4, y(v) + 4, String(v), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    let start = 0;
    ["A", "B", "C"].forEach((k) => { const nk = rows.filter((d) => d.cls === k).length; const mid = l + (start + nk / 2) * bw; tx(svg, mid, 224, k + " " + nk + "곳", { "text-anchor": "middle", fill: cols[k] === c("--mark-muted") ? c("--muted") : cols[k], "font-size": 10.5, "font-weight": 700 }); start += nk; });
    tx(svg, l, 16, "거래처별 매출(큰 순서) · 검은 선: 누적 비중", { fill: c("--muted"), "font-size": 10.5 });
    tx(svg, l, 244, "거래처 " + rows.length + "곳", { fill: c("--muted"), "font-size": 10 });
    /* 로렌츠 */
    const host = $("conc-l"), w = Math.max(220, Math.round(host.clientWidth || 300)), side = Math.min(w - 50, 230), f2 = frame("conc-l", side + 46, "로렌츠 곡선, 지니계수 " + fmt(CC.gini, 2)), s2 = f2.svg;
    const ox = 34, oy = 10, X = lin(0, 1, ox, ox + side), Y = lin(0, 1, oy + side, oy), lz = CC.lorenz;
    sv("rect", { x: ox, y: oy, width: side, height: side, fill: "none", stroke: c("--rule-soft") }, s2);
    sv("path", { d: path([[X(0), Y(0)]].concat(lz.map((p) => [X(p[0]), Y(p[1])]))) + "L" + X(1).toFixed(1) + "," + Y(1).toFixed(1) + "L" + X(0) + "," + Y(0) + "Z", fill: c("--accent"), opacity: 0.18 }, s2);
    sv("line", { x1: X(0), x2: X(1), y1: Y(0), y2: Y(1), stroke: c("--ink-2"), "stroke-dasharray": "4 3" }, s2);
    sv("path", { d: path(lz.map((p) => [X(p[0]), Y(p[1])])), fill: "none", stroke: c("--accent"), "stroke-width": 2.4 }, s2);
    tx(s2, X(0.3), Y(0.62), "완전 균등", { fill: c("--muted"), "font-size": 10, transform: "rotate(-45 " + X(0.3) + " " + Y(0.62) + ")", "text-anchor": "middle" });
    tx(s2, X(0.6), Y(0.45), "지니 " + fmt(CC.gini, 2), { fill: c("--accent"), "font-size": 11, "font-weight": 700, "text-anchor": "middle" });
    [0, 0.5, 1].forEach((v) => { tx(s2, X(v), oy + side + 14, pc(v, 0), { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }); tx(s2, ox - 4, Y(v) + 4, pc(v, 0), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    tx(s2, ox + side, oy + side + 30, "거래처 누적(작은 순)", { "text-anchor": "end", fill: c("--muted"), "font-size": 10 });
    put({ "cc-top": pc(CC.top20), "cc-a": String(CC.nA), "cc-b": String(CC.nB), "cc-c": String(CC.nC), "cc-g": fmt(CC.gini, 2), "cc-h": fmt(CC.hhi, 0), "cc-e": fmt(10000 / CC.hhi, 1) });
    const by = (k) => rows.filter((d) => d.cls === k), sm = (a) => a.reduce((s, d) => s + d.v, 0);
    dtable("conc-tb", ["등급", "거래처 수", "매출(억원)", "비중"], ["A", "B", "C"].map((k) => [k, by(k).length + "곳", fmt(sm(by(k)), 1), pc(sm(by(k)) / CC.total)]).concat([["합계", rows.length + "곳", fmt(CC.total, 1), "100%"], ["상위 20%(8곳) 비중", "", "", pc(CC.top20)], ["지니계수", "", "", fmt(CC.gini, 3)], ["HHI", "", "", fmt(CC.hhi, 0)]]));
  }

  /* ---------- 13. 군집 ---------- */
  const AC = L.accounts(), KMS = {};
  for (let k = 1; k <= 6; k++) KMS[k] = L.kmeans(AC, k, 7, 10);
  function drawKM() {
    const k = radio("km-k") || 3, K = KMS[k], pal = [c("--input"), c("--accent"), c("--pos"), c("--neg"), c("--total")];
    const fr = frame("km-fig", 338 + k * 18, "거래처 군집 산점도, k = " + k), svg = fr.svg, l = 36, r = fr.W - 10, x = lin(-16, 26, l, r), y = lin(0, 28, 276, 14);
    [0, 10, 20].forEach((v) => { sv("line", { x1: l, x2: r, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, svg); tx(svg, l - 4, y(v) + 4, v + "%", { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); });
    [-10, 0, 10, 20].forEach((v) => { sv("line", { x1: x(v), x2: x(v), y1: 14, y2: 276, stroke: v === 0 ? c("--rule") : c("--rule-soft") }, svg); tx(svg, x(v), 292, v + "%", { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }); });
    tx(svg, r, 310, "매출 성장률 →", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 });
    tx(svg, l + 4, 26, "영업이익률", { fill: c("--muted"), "font-size": 10.5 });
    AC.forEach((p, i) => sv("circle", { cx: x(p[0]), cy: y(p[1]), r: 4, fill: pal[K.labels[i]], opacity: 0.8 }, svg));
    K.centers.forEach((cc, j) => {
      sv("circle", { cx: x(cc[0]), cy: y(cc[1]), r: 10, fill: pal[j], stroke: c("--surface"), "stroke-width": 2.5 }, svg);
      tx(svg, x(cc[0]), y(cc[1]) + 4, String(j + 1), { "text-anchor": "middle", fill: "#FFFFFF", "font-size": 11, "font-weight": 700 });
      const ly = 332 + j * 18;
      sv("circle", { cx: l + 6, cy: ly - 4, r: 6, fill: pal[j] }, svg);
      tx(svg, l + 6, ly, String(j + 1), { "text-anchor": "middle", fill: "#FFFFFF", "font-size": 9, "font-weight": 700 });
      tx(svg, l + 18, ly, K.sizes[j] + "곳 · 성장률 " + fmt(cc[0], 1) + "% · 이익률 " + fmt(cc[1], 1) + "%", { fill: c("--ink"), "font-size": 11 });
    });
    const f2 = frame("km-elbow", 220, "엘보 그림"), s2 = f2.svg, el = 40, er = f2.W - 12, ks = [1, 2, 3, 4, 5, 6], ex = lin(1, 6, el, er), top = KMS[1].inertia, ey = lin(0, top * 1.05, 176, 30);
    tx(s2, el, 16, "군집 안 거리 합(표준화 단위)", { fill: c("--muted"), "font-size": 10.5 });
    F.niceTicks(0, top, 3).ticks.forEach((v) => { if (v <= top * 1.05) { sv("line", { x1: el, x2: er, y1: ey(v), y2: ey(v), stroke: c("--rule-soft") }, s2); tx(s2, el - 4, ey(v) + 4, String(v), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); } });
    sv("path", { d: path(ks.map((kk) => [ex(kk), ey(KMS[kk].inertia)])), fill: "none", stroke: c("--ink-2"), "stroke-width": 1.8 }, s2);
    ks.forEach((kk) => { sv("circle", { cx: ex(kk), cy: ey(KMS[kk].inertia), r: kk === k ? 6 : 3.6, fill: kk === k ? c("--accent") : c("--ink-2") }, s2); tx(s2, ex(kk), 194, "k=" + kk, { "text-anchor": "middle", class: "n", "font-size": 10, fill: kk === k ? c("--accent") : c("--muted") }); });
    tx(s2, ex(3) + 8, ey(KMS[3].inertia) - 10, "꺾이는 곳", { fill: c("--muted"), "font-size": 10 });
    dtable("km-tb", ["군집", "거래처 수", "평균 성장률", "평균 이익률"], K.centers.map((cc, j) => [String(j + 1), K.sizes[j] + "곳", fmt(cc[0], 1) + "%", fmt(cc[1], 1) + "%"]).concat(ks.map((kk) => ["k = " + kk + " 거리 합", fmt(KMS[kk].inertia, 1), "", ""])));
  }

  /* ---------- 14. 평균으로의 회귀 ---------- */
  const RT = L.rttm(40, 4040);
  function drawRT() {
    const fr = frame("rt-fig", 320, "첫해와 이듬해 점수 산점도"), svg = fr.svg, all = RT.y1.concat(RT.y2), lo = Math.floor(mn(all) - 1), hi = Math.ceil(mx(all) + 1);
    const side = Math.min(fr.W - 60, 280), l = fr.nar ? 36 : Math.max(36, (fr.W - side) / 2 - 60), x = lin(lo, hi, l, l + side), y = lin(lo, hi, 20 + side, 20);
    F.niceTicks(lo, hi, 4).ticks.filter((v) => v >= lo && v <= hi).forEach((v) => { sv("line", { x1: l, x2: l + side, y1: y(v), y2: y(v), stroke: c("--rule-soft") }, svg); sv("line", { x1: x(v), x2: x(v), y1: 20, y2: 20 + side, stroke: c("--rule-soft") }, svg); tx(svg, l - 4, y(v) + 4, String(v), { "text-anchor": "end", class: "n", "font-size": 10, fill: c("--muted") }); tx(svg, x(v), 34 + side, String(v), { "text-anchor": "middle", class: "n", "font-size": 10, fill: c("--muted") }); });
    sv("line", { x1: x(lo), x2: x(hi), y1: y(lo), y2: y(hi), stroke: c("--muted"), "stroke-dasharray": "5 4", "stroke-width": 1.4 }, svg);
    const LR = S.linreg(RT.y1, RT.y2);
    sv("line", { x1: x(lo), x2: x(hi), y1: y(LR.at(lo)), y2: y(LR.at(hi)), stroke: c("--ink-2"), "stroke-width": 2 }, svg);
    const isB = new Set(RT.bot), isT = new Set(RT.top);
    RT.y1.forEach((v, i) => sv("circle", { cx: x(v), cy: y(RT.y2[i]), r: 4.2, fill: isB.has(i) ? c("--input") : isT.has(i) ? c("--accent") : c("--mark-muted"), opacity: 0.85 }, svg));
    tx(svg, l + side, 50 + side, "첫해 점수", { "text-anchor": "end", fill: c("--muted"), "font-size": 10.5 });
    tx(svg, l, 12, "이듬해 점수", { fill: c("--muted"), "font-size": 10.5 });
    if (!fr.nar) {
      const lx = l + side + 24;
      tx(svg, lx, 60, "첫해 하위 25%", { fill: c("--input"), "font-weight": 700 }); tx(svg, lx, 78, "이듬해 평균 " + sg(RT.botChg, 1) + "점", { class: "n", fill: c("--ink-2") });
      tx(svg, lx, 112, "첫해 상위 25%", { fill: c("--accent"), "font-weight": 700 }); tx(svg, lx, 130, "이듬해 평균 " + sg(RT.topChg, 1) + "점", { class: "n", fill: c("--ink-2") });
      tx(svg, lx, 164, "회귀선 기울기 " + fmt(RT.slope, 2), { fill: c("--ink-2") });
    }
    put({ "rt-bot": fmt(RT.botChg, 1), "rt-top": fmt(Math.abs(RT.topChg), 1), "rt-slope": fmt(RT.slope, 2) });
    const g = (ids) => [S.mean(ids.map((i) => RT.y1[i])), S.mean(ids.map((i) => RT.y2[i]))];
    const b = g(RT.bot), t = g(RT.top), all40 = RT.y1.map((_, i) => i), a = g(all40);
    dtable("rt-tb", ["그룹", "첫해 평균", "이듬해 평균", "변화"], [["하위 25%(10팀)", fmt(b[0], 1), fmt(b[1], 1), sg(b[1] - b[0], 1)], ["상위 25%(10팀)", fmt(t[0], 1), fmt(t[1], 1), sg(t[1] - t[0], 1)], ["전체 40팀", fmt(a[0], 1), fmt(a[1], 1), sg(a[1] - a[0], 1)], ["회귀선 기울기", fmt(RT.slope, 3), "", ""]]);
  }

  /* ---------- 연결 ---------- */
  function all() { drawDesc(); drawCI(); drawBoot(); drawTest(); drawFW(); drawAns(); drawReg(); drawSimp(); drawTS(); drawFC(); drawMC(); drawTor(); drawBayes(); drawConc(); drawKM(); drawRT(); }
  sampleCI(); ciTable(); pnTable(); regText(); tsText(); fcText(); byText(); runMC();
  $("fc-a").value = String(FC0.alpha); $("fc-b").value = String(FC0.beta);
  all();
  document.querySelectorAll('input[name="ci-n"]').forEach((e) => e.addEventListener("change", () => { CI.n = radio("ci-n"); CI.seed = 1; sampleCI(); drawCI(); }));
  $("ci-again").addEventListener("click", () => { CI.seed++; sampleCI(); drawCI(); });
  $("reg-x").addEventListener("input", drawReg);
  const fcIn = () => { FCm = L.holt(MY, +$("fc-a").value, +$("fc-b").value, 6); drawFC(); };
  $("fc-a").addEventListener("input", fcIn); $("fc-b").addEventListener("input", fcIn);
  $("fc-opt").addEventListener("click", () => { FCm = FC0; $("fc-a").value = String(FC0.alpha); $("fc-b").value = String(FC0.beta); drawFC(); });
  $("mc-rho").addEventListener("input", () => { runMC(); drawMC(); });
  ["by-n", "by-k", "by-m"].forEach((id) => $(id).addEventListener("input", drawBayes));
  document.querySelectorAll('input[name="by-s"]').forEach((e) => e.addEventListener("change", drawBayes));
  document.querySelectorAll('input[name="km-k"]').forEach((e) => e.addEventListener("change", drawKM));
  F.onRedraw(all);

  if (window.Report) {
    Report.flows($("hero-art"), {
      area: { span: 0.42, max: 580, min: 1000, within: ".rpt-hero .wrap" },
      nodes: [{ x: 0.10, y: 0.50, label: "데이터" }, { x: 0.90, y: 0.10, label: "요약" }, { x: 0.90, y: 0.30, label: "비교" }, { x: 0.90, y: 0.50, label: "관계" }, { x: 0.90, y: 0.70, label: "예측" }, { x: 0.90, y: 0.90, label: "위험" }],
      links: [{ from: 0, to: 1, bend: -0.12, c: 0, n: 12, label: "분포" }, { from: 0, to: 2, bend: -0.06, c: 1, n: 12, label: "검정" }, { from: 0, to: 3, bend: 0, c: 2, n: 12, label: "회귀" }, { from: 0, to: 4, bend: 0.06, c: 0, n: 12, label: "평활" }, { from: 0, to: 5, bend: 0.12, c: 1, n: 12, label: "시뮬레이션" }]
    });
    Report.toc("#toc", ".rpt-body > section");
    Report.reveal("[data-rv]");
  }
})();

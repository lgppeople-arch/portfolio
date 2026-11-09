/* 홈 스크롤 연출: 경력 숫자 네 개를 스크롤에 따라 하나씩 보여 주고, 오른쪽 그림을 장면마다 바꾼다.
   넓은 화면(900px 이상)이고 '움직임 줄이기'가 꺼져 있을 때만 켜진다. 그 밖에는 원래의 숫자 띠가 그대로 보인다.
   그림의 내용은 홈 본문에 이미 적힌 사실만 쓴다. */
(function () {
  "use strict";
  const sec = document.getElementById("story");
  if (!sec || !("IntersectionObserver" in window) || !window.requestAnimationFrame) return;
  const mqWide = window.matchMedia("(min-width: 900px)"), mqCalm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const $ = (id) => document.getElementById(id);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const track = sec.querySelector(".story-track"), canvas = $("story-art"), ctx = canvas.getContext("2d");
  const STEPS = [
    { n: 6, unit: "년", title: "두 제조업, 6년", desc: "매출 약 1조원 건설소재 회사의 경영관리팀에서 관리회계와 손익 분석을 익혔고, 약 3,000억원 반도체 부품 회사의 재무기획팀에서 투자 심의, 생산부지 인수, 인수 TFT, 이사회 업무로 범위를 넓혔습니다." },
    { n: 1500, unit: "억원", title: "연간 최대 자산투자 건", desc: "구미 생산부지·건물 인수(2026년 공시)의 투자 설명 자료와 차입용 투자·회수 계획을 공동 작성했습니다." },
    { n: 30, unit: "억원/년", title: "비용예산 증액 품의", desc: "비용예산 증액 품의를 담당합니다. 한 해 동안 승인받는 증액 총액은 자산투자를 빼고 약 30억원입니다." },
    { n: null, word: "유지", unit: "결정", title: "주력사업 구조 전환안 검토", desc: "매출 약 1조원 주력사업의 유지안과 전환안을 비교했습니다. 사업부문별 매출·영업이익을 다시 추정하고 수익성 밖의 고려사항 여섯 가지를 정리했고, 전환안은 기각돼 기존 사업 유지로 결정됐습니다." }
  ];
  let on = false, step = -1, prev = -1, tStep = 0, tFade = 0, raf = 0, visible = false, W = 0, H = 0, dpr = 1, countRaf = 0;

  /* ---------- 켜고 끄기 ---------- */
  function enable(v) {
    on = v; sec.hidden = !v;
    document.documentElement.classList.toggle("story-on", v);
    if (v) { size(); onScroll(); }
  }
  const decide = () => enable(mqWide.matches && !mqCalm.matches);
  [mqWide, mqCalm].forEach((m) => (m.addEventListener ? m.addEventListener("change", decide) : m.addListener(decide)));

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- 스크롤 → 장면 ---------- */
  function progress() {
    const r = track.getBoundingClientRect(), span = r.height - window.innerHeight;
    return span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
  }
  function onScroll() {
    if (!on) return;
    const s = Math.min(STEPS.length - 1, Math.floor(progress() * STEPS.length));
    if (s !== step) setStep(s);
    kick();
  }
  function setStep(s) {
    prev = step; step = s; tStep = performance.now(); tFade = tStep;
    const d = STEPS[s];
    $("story-step").textContent = String(s + 1).padStart(2, "0");
    $("story-unit").textContent = d.unit; $("story-title").textContent = d.title; $("story-desc").textContent = d.desc;
    sec.querySelectorAll(".story-dots button").forEach((b, i) => b.setAttribute("aria-current", i === s ? "step" : "false"));
    const num = $("story-num"); cancelAnimationFrame(countRaf);
    if (d.n === null) { num.textContent = d.word; return; }
    const t0 = performance.now(), dur = 750;
    const tick = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); num.textContent = Math.round(d.n * e).toLocaleString("ko-KR"); if (k < 1) countRaf = requestAnimationFrame(tick); };
    countRaf = requestAnimationFrame(tick);
    const txt = sec.querySelector(".story-text"); txt.classList.remove("swap"); void txt.offsetWidth; txt.classList.add("swap");
  }
  sec.querySelectorAll(".story-dots button").forEach((b, i) => b.addEventListener("click", () => {
    const r = track.getBoundingClientRect(), top = window.scrollY + r.top, span = r.height - window.innerHeight;
    window.scrollTo({ top: top + span * (i + 0.5) / STEPS.length, behavior: "smooth" });
  }));

  /* ---------- 그리기 도구 ---------- */
  const C = () => ({ ink: css("--ink"), ink2: css("--ink-2"), mute: css("--muted"), rule: css("--rule"), surf: css("--surface"), acc: css("--accent"), inp: css("--input"), pos: css("--pos"), neg: css("--neg"), total: css("--total") });
  const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
  function text(s, x, y, o) { o = o || {}; ctx.font = (o.w || 500) + " " + (o.size || 13) + "px " + css("--f-body"); ctx.fillStyle = o.color; ctx.textAlign = o.align || "left"; ctx.globalAlpha *= 1; ctx.fillText(s, x, y); }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  /* 등각 투영 정육면체: 화면 위치(x, y)는 윗면 앞 모서리 */
  function cube(x, y, s, top, left, right) {
    const h = s * 0.5;
    ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y - h); ctx.lineTo(x, y - 2 * h); ctx.lineTo(x - s, y - h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = left; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s, y - h); ctx.lineTo(x - s, y - h + s); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = right; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y - h); ctx.lineTo(x + s, y - h + s); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
  }
  const shade = (hex, k) => { const c = hex.replace("#", ""), n = c.length === 3 ? c.split("").map((q) => q + q).join("") : c; const v = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); return "rgb(" + v.map((q) => Math.round(k < 0 ? q * (1 + k) : q + (255 - q) * k)).join(",") + ")"; };

  /* ---------- 장면 ---------- */
  function scene0(t, c, now) {      /* 경력 타임라인 */
    const x0 = W * 0.08, x1 = W * 0.94, y = H * 0.46, yr = (v) => x0 + (v - 2020) / 7 * (x1 - x0), nowY = 2026 + 10 / 12;
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    for (let v = 2020; v <= 2027; v++) { ctx.beginPath(); ctx.moveTo(yr(v), y + 26); ctx.lineTo(yr(v), y + 34); ctx.stroke(); text(String(v), yr(v), y + 52, { color: c.mute, size: 12, align: "center" }); }
    const g = ease(t * 1.4), segA = [2020.42, 2024.92], segB = [2024.92, nowY];
    const draw = (s, col, delay, label, items) => {
      const k = ease((t - delay) * 1.8); if (k <= 0) return;
      const a = yr(s[0]), b = yr(s[0] + (s[1] - s[0]) * k);
      rr(a, y - 9, Math.max(2, b - a), 18, 9); ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = k; text(label, a, y - 22, { color: c.ink, w: 700, size: 14 });
      items.forEach((it, i) => text(it, a, y + 80 + i * 22, { color: c.ink2, size: 13 }));
      ctx.globalAlpha = 1;
    };
    draw(segA, c.total, 0, "유진기업 · 경영관리팀", ["관리회계 · SAP 관리손익", "구조 전환안 검토(2022)", "MBO · 사업계획·예산"]);
    draw(segB, c.acc, 0.45, "미코세라믹스 · 재무기획팀", ["투자 심의 · 생산부지 인수", "인수 TFT 재무 지원", "이사회·규정 정비"]);
    if (g > 0.9) { const pulse = 6 + 3 * Math.sin(now / 380); ctx.fillStyle = c.acc; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(yr(nowY), y, pulse + 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(yr(nowY), y, 6, 0, Math.PI * 2); ctx.fill(); text("지금", yr(nowY), y - 22, { color: c.acc, w: 700, size: 12, align: "center" }); }
  }
  function scene1(t, c, now) {      /* 100억원 블록 15개: 가로 5 × 높이 3 */
    const s = Math.min(W, H) * 0.07, h = s / 2, ox = W * 0.3, oy = H * 0.5, order = [];
    for (let gz = 0; gz < 3; gz++) for (let gx = 0; gx < 5; gx++) order.push({ gx: gx, gz: gz });
    order.forEach((b, i) => {
      const k = ease(t * 2.2 - i * 0.07); if (k <= 0) return;
      const x = ox + b.gx * s, y = oy + b.gx * h - b.gz * s - (1 - k) * H * 0.35;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      cube(x, y, s * 0.96, shade(c.acc, 0.3), shade(c.acc, -0.12), shade(c.acc, -0.32));
      ctx.globalAlpha = 1;
    });
    const k2 = ease(t * 1.6 - 1.2);
    if (k2 > 0) {
      ctx.globalAlpha = k2;
      text("100억원 × 15", ox + 2 * s, oy + 2 * h + s * 1.9, { color: c.ink, w: 700, size: 15, align: "center" });
      const bx = W * 0.72, by = H * 0.3;
      text("구미 생산부지·건물 인수", bx, by, { color: c.ink, w: 700, size: 15 }); text("2026년 공시", bx, by + 22, { color: c.mute, size: 13 });
      ["투자 설명 자료", "차입용 투자·회수 계획"].forEach((q, i) => { rr(bx, by + 46 + i * 46, Math.min(220, W * 0.24), 34, 6); ctx.fillStyle = c.surf; ctx.fill(); ctx.strokeStyle = c.rule; ctx.stroke(); text(q, bx + 12, by + 68 + i * 46, { color: c.ink2, size: 13 }); });
      text("공동 작성", bx, by + 160, { color: c.acc, w: 700, size: 13 });
      ctx.globalAlpha = 1;
    }
  }
  function scene2(t, c, now) {      /* 예산 상자 */
    const bw = W * 0.34, bh = H * 0.42, bx = W * 0.14, by = H * 0.3;
    ctx.strokeStyle = c.ink2; ctx.lineWidth = 2; ctx.setLineDash([]); rr(bx, by, bw, bh, 10); ctx.stroke(); ctx.lineWidth = 1;
    text("승인 한도 · 연 약 30억원", bx, by - 14, { color: c.ink, w: 700, size: 14 }); text("자산투자 제외", bx + bw, by - 14, { color: c.mute, size: 12, align: "right" });
    const tiles = [[0.30, 0.30], [0.40, 0.22], [0.28, 0.38], [0.22, 0.30], [0.36, 0.26], [0.30, 0.24], [0.26, 0.34], [0.34, 0.28], [0.24, 0.22]];
    let cx = bx + 8, cy = by + bh - 8, rowH = 0; const placed = [];
    tiles.forEach((q, i) => { const w = q[0] * bw * 0.95, h = q[1] * bh * 0.95; if (cx + w > bx + bw - 6) { cx = bx + 8; cy -= rowH + 6; rowH = 0; } const fit = cy - h > by + 6; placed.push({ x: cx, y: cy - h, w: w, h: h, fit: fit }); if (fit) { cx += w + 6; rowH = Math.max(rowH, h); } });
    let out = 0;
    placed.forEach((p, i) => {
      const k = ease(t * 2.4 - i * 0.18); if (k <= 0) return;
      let x = p.x, y = p.y;
      if (!p.fit) { x = bx + bw + 30 + (out % 2) * 64; y = by + bh - 40 - Math.floor(out / 2) * 46; out++; }
      y -= (1 - k) * H * 0.4;
      rr(x, y, p.fit ? p.w : 56, p.fit ? p.h : 38, 5); ctx.fillStyle = p.fit ? (i % 3 === 0 ? c.inp : shade(c.inp, 0.35 + 0.15 * (i % 2))) : c.rule; ctx.fill();
    });
    const k2 = ease(t * 1.6 - 1.3);
    if (k2 > 0) { ctx.globalAlpha = k2; text("증액 요청", bx + bw + 30, by + bh + 26, { color: c.mute, size: 12 }); text("한 해 동안 품의로 승인", bx, by + bh + 26, { color: c.ink2, size: 13 }); ctx.globalAlpha = 1; }
  }
  function scene3(t, c, now) {      /* 유지 결정 분기 */
    const sx = W * 0.08, sy = H * 0.5, mx = W * 0.44, ex = W * 0.82, upY = H * 0.28, dnY = H * 0.72;
    const k1 = ease(t * 2);
    rr(sx, sy - 22, W * 0.2, 44, 8); ctx.fillStyle = c.ink; ctx.fill(); text("구조 전환안 검토", sx + W * 0.1, sy + 5, { color: c.surf, w: 700, size: 13, align: "center" });
    const k3 = ease(t * 1.8 - 1.4);
    ctx.lineWidth = 3;
    [[upY, c.pos, "현행 유지", true], [dnY, c.mute, "구조 전환", false]].forEach((b) => {
      ctx.globalAlpha = b[3] ? Math.max(0.25, k3) : 0.25 + 0.35 * (1 - k3);
      ctx.strokeStyle = b[1]; ctx.beginPath(); ctx.moveTo(sx + W * 0.2, sy); ctx.bezierCurveTo(mx, sy, mx + 40, b[0], ex - 10, b[0]); ctx.stroke();
      rr(ex, b[0] - 20, W * 0.14, 40, 8); ctx.fillStyle = b[3] ? b[1] : c.surf; ctx.fill(); if (!b[3]) { ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.stroke(); ctx.lineWidth = 3; }
      text(b[2], ex + W * 0.07, b[0] + 5, { color: b[3] ? c.surf : c.mute, w: 700, size: 13, align: "center" });
      ctx.globalAlpha = 1;
    });
    ctx.lineWidth = 1;
    const checks = ["운영 주체 확보", "사업 연속성", "원재료 수급", "판매망 유지", "자산 가치평가", "부대자산 처리"];
    checks.forEach((q, i) => {
      const k = ease(t * 2.4 - 0.3 - i * 0.12); if (k <= 0) return;
      const y = H * 0.24 + i * H * 0.088;
      ctx.globalAlpha = k; rr(mx - 70, y - 13, 150, 26, 13); ctx.fillStyle = c.surf; ctx.fill(); ctx.strokeStyle = c.rule; ctx.stroke();
      text("✓ " + q, mx - 58, y + 5, { color: c.ink2, size: 12.5 }); ctx.globalAlpha = 1;
    });
    if (k3 > 0.6) { ctx.strokeStyle = c.neg; ctx.lineWidth = 2.5; const x = ex + W * 0.07, y = dnY; ctx.beginPath(); ctx.moveTo(x - 30, y - 14); ctx.lineTo(x + 30, y + 14); ctx.stroke(); ctx.lineWidth = 1; text("기각", ex + W * 0.07, dnY + 40, { color: c.neg, w: 700, size: 12, align: "center" }); text("결정", ex + W * 0.07, upY - 30, { color: c.pos, w: 700, size: 12, align: "center" }); }
  }
  const SCENES = [scene0, scene1, scene2, scene3];

  function frame(now) {
    raf = 0;
    if (!on || !visible || step < 0) return;
    const c = C(), t = (now - tStep) / 1000, f = Math.min(1, (now - tFade) / 420);
    ctx.clearRect(0, 0, W, H);
    if (prev >= 0 && f < 1) { ctx.globalAlpha = 1 - f; SCENES[prev](3, c, now); }
    ctx.globalAlpha = prev >= 0 ? f : 1; SCENES[step](t, c, now); ctx.globalAlpha = 1;
    /* 장면 0은 '지금' 점이 깜빡이므로 계속, 나머지는 그림이 다 그려지면 멈춘다 */
    if (t < 3 || f < 1 || step === 0) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && on && visible) raf = requestAnimationFrame(frame); };

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(sec);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { if (on) { size(); tStep = performance.now() - 3000; kick(); } });
  new MutationObserver(() => { tStep = performance.now() - 3000; kick(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  decide();
})();

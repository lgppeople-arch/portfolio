/* 리포트 템플릿 동작: 히어로 캔버스 아트, 목차 강조, 스크롤 진입 애니메이션, 숫자 세기.
   모든 요소는 처음부터 완성된 모습으로 보이고, 화면에 들어올 때만 짧게 다시 그린다. 모션 줄이기 설정이면 아무것도 움직이지 않는다. */
(function (root) {
  "use strict";
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- 히어로 아트 1: 흐름 (노드 사이를 오가는 입자) ---------- */
  /* spec.area: 노드를 오른쪽 일부 영역(너비 비율 span, 최대 max px)에만 배치해 제목과 겹치지 않게 한다. 좁은 화면에서는 배경 무늬로만 쓴다. */
  function flows(canvas, spec) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1, parts = [], raf = 0, t0 = performance.now(), AX = 0, AW = 0, wide = true;
    const colors = () => [css("--hero-a"), css("--hero-b"), css("--hero-c")];
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const a = spec.area;
      wide = !a || W >= (a.min || 0);
      if (!a || !wide) { AX = 0; AW = W; return; }
      /* 오른쪽 경계는 본문 칼럼(within)의 오른쪽 끝에 맞춘다 */
      let right = W;
      const el = a.within && document.querySelector(a.within);
      if (el) right = el.getBoundingClientRect().right - canvas.getBoundingClientRect().left - parseFloat(getComputedStyle(el).paddingRight || 0);
      AW = Math.min(W * a.span, a.max);
      AX = right - AW;
    }
    /* 글자가 화면 밖이나 글 영역으로 넘어가지 않게 가로 위치를 묶는다 */
    const fitX = (x, w) => Math.max(AX + w / 2, Math.min(W - w / 2 - 10, x));
    const P = (n) => ({ x: AX + n.x * AW, y: n.y * H });
    function bez(a, b, bend, u) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
      const cx = mx - dy * bend, cy = my + dx * bend, v = 1 - u;
      return { x: v * v * a.x + 2 * v * u * cx + u * u * b.x, y: v * v * a.y + 2 * v * u * cy + u * u * b.y };
    }
    function seed() {
      parts = [];
      spec.links.forEach((l, li) => { for (let k = 0; k < (l.n || 26); k++) parts.push({ li: li, u: Math.random(), sp: 0.0016 + Math.random() * 0.0024, r: 0.8 + Math.random() * 1.8 }); });
    }
    function draw(now, still) {
      const C = colors();
      ctx.clearRect(0, 0, W, H);
      /* 격자 */
      ctx.strokeStyle = css("--hero-line"); ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
      ctx.globalAlpha = 1;
      /* 연결선 */
      spec.links.forEach((l) => {
        const a = P(spec.nodes[l.from]), b = P(spec.nodes[l.to]);
        ctx.strokeStyle = C[l.c % 3]; ctx.globalAlpha = 0.22; ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const q = bez(a, b, l.bend, i / 40); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
        ctx.stroke(); ctx.globalAlpha = 1;
        if (l.label && wide && W > 760) {
          const m = bez(a, b, l.bend, l.at || 0.5);
          ctx.font = "500 12px " + css("--f-body"); ctx.fillStyle = css("--hero-dim"); ctx.textAlign = "center";
          ctx.fillText(l.label, fitX(m.x + (l.dx || 0), ctx.measureText(l.label).width), m.y + (l.dy === undefined ? -9 : l.dy));
        }
      });
      /* 입자 */
      parts.forEach((p) => {
        const l = spec.links[p.li];
        if (!still) { p.u += p.sp; if (p.u > 1) p.u -= 1; }
        const q = bez(P(spec.nodes[l.from]), P(spec.nodes[l.to]), l.bend, p.u);
        const glow = 0.35 + 0.65 * Math.sin(Math.PI * p.u);
        ctx.fillStyle = C[l.c % 3]; ctx.globalAlpha = glow;
        ctx.beginPath(); ctx.arc(q.x, q.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      /* 노드 */
      spec.nodes.forEach((n, i) => {
        const q = P(n), pulse = still ? 0 : 3 * Math.sin((now - t0) / 700 + i);
        ctx.strokeStyle = C[i % 3]; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, 22 + pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = css("--hero-bg");
        ctx.beginPath(); ctx.arc(q.x, q.y, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C[i % 3]; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fill();
        if (wide && W > 760) {
          ctx.font = "700 14px " + css("--f-body"); ctx.fillStyle = css("--hero-ink"); ctx.textAlign = "center";
          ctx.fillText(n.label, fitX(q.x, ctx.measureText(n.label).width), q.y + (n.ly || 42));
        }
      });
    }
    function loop(now) { draw(now, false); raf = requestAnimationFrame(loop); }
    function start() {
      cancelAnimationFrame(raf); size(); seed();
      if (reduce()) draw(performance.now(), true); else raf = requestAnimationFrame(loop);
    }
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(start, 150); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce()) raf = requestAnimationFrame(loop); });
    start();
  }

  /* ---------- 히어로 아트 2: 웨이퍼 맵 (원형 웨이퍼 위 다이가 물결처럼 빛남) ---------- */
  function wafer(canvas, opt) {
    opt = opt || {};
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1, dies = [], raf = 0, t0 = performance.now();
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = Math.min(H * 0.62, W * 0.42), cx = W - R * 0.95, cy = H * 0.55, step = Math.max(9, R / 15);
      dies = [];
      for (let x = cx - R; x <= cx + R; x += step) for (let y = cy - R; y <= cy + R; y += step) {
        const dx = x + step / 2 - cx, dy = y + step / 2 - cy;
        if (dx * dx + dy * dy < (R - step * 0.6) * (R - step * 0.6)) dies.push({ x: x, y: y, s: step - 2, d: Math.hypot(dx, dy) / R, a: Math.atan2(dy, dx), k: Math.random() });
      }
      dies.R = R; dies.cx = cx; dies.cy = cy;
    }
    function draw(now, still) {
      const t = still ? 2.2 : (now - t0) / 1000, A = css("--hero-a"), B = css("--hero-b"), C = css("--hero-c");
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = css("--hero-line"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(dies.cx, dies.cy, dies.R, 0, Math.PI * 2); ctx.stroke();
      dies.forEach((d) => {
        const wave = 0.5 + 0.5 * Math.sin(t * 1.6 - d.d * 7 + d.a * 1.2);
        const hot = d.k > 0.965;
        ctx.fillStyle = hot ? A : wave > 0.72 ? C : B;
        ctx.globalAlpha = hot ? 0.95 : 0.10 + wave * 0.42;
        ctx.fillRect(d.x + 1, d.y + 1, d.s, d.s);
      });
      ctx.globalAlpha = 1;
      /* 노치 */
      ctx.fillStyle = css("--hero-bg");
      ctx.beginPath(); ctx.arc(dies.cx, dies.cy + dies.R, 7, 0, Math.PI * 2); ctx.fill();
    }
    function loop(now) { draw(now, false); raf = requestAnimationFrame(loop); }
    function start() { cancelAnimationFrame(raf); size(); if (reduce()) draw(0, true); else raf = requestAnimationFrame(loop); }
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(start, 150); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce()) raf = requestAnimationFrame(loop); });
    start();
  }

  /* ---------- 목차: 지금 읽는 구역 강조 ---------- */
  function toc(navSel, secSel) {
    const nav = document.querySelector(navSel);
    if (!nav) return;
    const secs = Array.from(document.querySelectorAll(secSel));
    nav.textContent = "";
    const h = document.createElement("span"); h.className = "h"; h.textContent = "목차"; nav.appendChild(h);
    const links = secs.map((s) => {
      const a = document.createElement("a"); a.href = "#" + s.id; a.textContent = s.querySelector("h2").textContent; nav.appendChild(a); return a;
    });
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a, i) => a.classList.toggle("on", secs[i] === e.target)); }), { rootMargin: "-30% 0px -60% 0px" });
    secs.forEach((s) => io.observe(s));
  }

  /* ---------- 진입 애니메이션 ---------- */
  function play(el) {
    if (reduce()) return;
    el.classList.remove("rv-play"); void el.offsetWidth; el.classList.add("rv-play");
    el.querySelectorAll("[data-count]").forEach(count);
    /* 다 그린 뒤에는 표시를 떼어, 입력을 바꿔 다시 그릴 때 막대가 처음부터 자라지 않게 한다 */
    clearTimeout(el._rvT); el._rvT = setTimeout(() => el.classList.remove("rv-play"), 1700);
  }
  function count(el) {
    const target = Number(el.dataset.count), dec = Number(el.dataset.dec || 0), dur = 900, t0 = performance.now();
    const fmt = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    function step(now) {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt.format(target * e);
      if (k < 1) requestAnimationFrame(step); else el.textContent = fmt.format(target);
    }
    requestAnimationFrame(step);
  }
  function reveal(sel) {
    if (!("IntersectionObserver" in window) || reduce()) return;
    const seen = new WeakSet();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !seen.has(e.target)) { seen.add(e.target); play(e.target); }
    }), { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    document.querySelectorAll(sel).forEach((el) => {
      /* 처음 화면에 이미 보이는 요소는 건드리지 않는다 */
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.85) { seen.add(el); return; }
      io.observe(el);
    });
  }

  root.Report = { flows: flows, wafer: wafer, toc: toc, reveal: reveal, play: play };
})(typeof self !== "undefined" ? self : this);

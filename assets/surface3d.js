/* 3D 곡면 렌더러: 외부 라이브러리 없이 캔버스 2D에 그린다.
   격자 z[i][j]를 정사영으로 투영하고, 먼 면부터 칠하고(화가 알고리즘), 법선으로 음영을 주며, z = 0 등고선을 곡면과 바닥에 함께 그린다.
   끌어서 돌리기, 가장 가까운 격자점 값 읽기, 시점 버튼, 느린 자동 회전(움직임 줄이기 설정이면 끔)을 지원한다. */
(function (root) {
  "use strict";
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgb = (c) => {
    c = c.trim();
    if (c[0] === "#") { if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
    const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
  };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a === undefined ? 1 : a) + ")";
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function create(canvas, opt) {
    const ctx = canvas.getContext("2d"), host = canvas.parentElement;
    const st = { yaw: opt.yaw === undefined ? -0.7 : opt.yaw, pitch: opt.pitch === undefined ? 0.72 : opt.pitch, auto: !reduce() && opt.auto !== false, drag: null, hover: null, raf: 0, visible: true, data: null };
    let W = 0, H = 0, dpr = 1;
    const tip = document.createElement("div"); tip.className = "s3-tip"; tip.hidden = true; host.appendChild(tip);

    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    /* 정규화 좌표(−1~1, z는 −0.62~0.62) → 화면 */
    function proj(x, y, z) {
      const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy;            /* 수직축 회전 */
      const yy = y1 * cp - z * sp, depth = y1 * sp + z * cp;        /* 기울이기 */
      /* 수직축 회전에 상관없이 들어가도록: 가로 반폭 √2, 세로 반폭 √2·cos + 0.62·sin */
      const padX = W < 500 ? 46 : 78, s = Math.min((W / 2 - padX) / Math.SQRT2, (H / 2 - 30) / (Math.SQRT2 * cp + 0.62 * sp));
      return { x: W / 2 + x1 * s, y: H * 0.5 + yy * s, d: -y1 * cp - z * sp, z: depth };
    }

    function draw() {
      const D = st.data; if (!D || !W) return;
      const C = { ink: rgb(css("--ink")), ink2: rgb(css("--ink-2")), mute: rgb(css("--muted")), rule: rgb(css("--rule")), surf: rgb(css("--surface")), pos: rgb(css("--pos")), neg: rgb(css("--neg")), acc: rgb(css("--accent")) };
      ctx.clearRect(0, 0, W, H);
      const nx = D.xs.length, ny = D.ys.length, zmin = D.zmin, zmax = D.zmax, zr = Math.max(Math.abs(zmin), Math.abs(zmax)) || 1;
      const X = (i) => -1 + 2 * i / (nx - 1), Y = (j) => -1 + 2 * j / (ny - 1), Z = (v) => -0.62 + 1.24 * (v - zmin) / ((zmax - zmin) || 1), FLOOR = -0.62;
      /* 바닥 격자와 테두리 */
      ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const t = -1 + k / 2;
        [[t, -1, t, 1], [-1, t, 1, t]].forEach((s) => { const a = proj(s[0], s[1], FLOOR), b = proj(s[2], s[3], FLOOR); ctx.strokeStyle = rgba(C.rule, 0.9); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
      }
      /* z = 0 평면 높이의 옅은 기준면 테두리 */
      if (zmin < 0 && zmax > 0) {
        const z0 = Z(0), pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map((p) => proj(p[0], p[1], z0));
        ctx.fillStyle = rgba(C.ink, 0.04); ctx.strokeStyle = rgba(C.ink, 0.25); ctx.setLineDash([4, 4]);
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
      /* 곡면 면: 먼 것부터 */
      const quads = [];
      for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) {
        const v = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map((q) => ({ x: X(q[0]), y: Y(q[1]), z: Z(D.z[q[0]][q[1]]), v: D.z[q[0]][q[1]] }));
        const p = v.map((q) => proj(q.x, q.y, q.z)), dep = (p[0].d + p[1].d + p[2].d + p[3].d) / 4;
        /* 법선으로 음영 */
        const ux = v[1].x - v[0].x, uz = v[1].z - v[0].z, vy = v[3].y - v[0].y, vz = v[3].z - v[0].z;
        let n = [-uz * vy, -ux * vz, ux * vy]; const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((q) => q / nl);
        const light = Math.max(0, n[0] * -0.35 + n[1] * -0.45 + n[2] * 0.82);
        quads.push({ p: p, dep: dep, avg: (v[0].v + v[1].v + v[2].v + v[3].v) / 4, light: light });
      }
      quads.sort((a, b) => b.dep - a.dep);
      quads.forEach((q) => {
        const k = Math.min(1, Math.abs(q.avg) / zr), base = q.avg >= 0 ? C.pos : C.neg;
        let col = mix(C.surf, base, 0.18 + 0.72 * Math.sqrt(k));
        col = mix(col, [0, 0, 0], (1 - q.light) * 0.28);
        ctx.fillStyle = rgba(col); ctx.strokeStyle = rgba(C.surf, 0.35);
        ctx.beginPath(); q.p.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      /* z = 0 등고선: 칸마다 선형 보간(마칭 스퀘어) */
      const segs = [];
      for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
        for (let e = 0; e < 4; e++) {
          const a = c[e], b = c[(e + 1) % 4], za = D.z[a[0]][a[1]], zb = D.z[b[0]][b[1]];
          if ((za < 0) !== (zb < 0)) { const t = za / (za - zb); pts.push([X(a[0]) + (X(b[0]) - X(a[0])) * t, Y(a[1]) + (Y(b[1]) - Y(a[1])) * t]); }
        }
        if (pts.length >= 2) segs.push([pts[0], pts[1]]);
        if (pts.length === 4) segs.push([pts[2], pts[3]]);
      }
      const z0 = Z(0);
      [[FLOOR, rgba(C.ink2, 0.6), [5, 4], 1.4], [z0, rgba(C.ink, 0.95), [], 2.4]].forEach((L) => {
        ctx.strokeStyle = L[1]; ctx.lineWidth = L[3]; ctx.setLineDash(L[2]);
        segs.forEach((s) => { const a = proj(s[0][0], s[0][1], L[0]), b = proj(s[1][0], s[1][1], L[0]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
      });
      ctx.setLineDash([]); ctx.lineWidth = 1;
      /* 축 눈금과 이름 */
      const small = W < 500, side = st.pitch > 1.2;
      ctx.font = "500 " + (small ? 10 : 11) + "px " + css("--f-num"); ctx.fillStyle = rgba(C.mute);
      const tick = (x, y, txt, align) => { const p = proj(x, y, FLOOR); ctx.textAlign = align || "center"; ctx.fillText(txt, p.x, p.y + 14); };
      /* 눈금은 보는 사람 쪽(가까운) 모서리에 단다 */
      const nearY = proj(0, -1, FLOOR).d < proj(0, 1, FLOOR).d ? -1 : 1, nearX = proj(-1, 0, FLOOR).d < proj(1, 0, FLOOR).d ? -1 : 1;
      const ends = (a) => (small ? [a[0], a[a.length - 1]] : a);
      ends(D.xTicks).forEach((t) => tick(-1 + 2 * (t - D.xs[0]) / (D.xs[nx - 1] - D.xs[0]), nearY * 1.12, D.fx(t)));
      if (!side) (small ? [D.yTicks[0]] : D.yTicks).forEach((t) => tick(nearX * 1.14, -1 + 2 * (t - D.ys[0]) / (D.ys[ny - 1] - D.ys[0]), D.fy(t)));
      ctx.font = "600 " + (small ? 11 : 12) + "px " + css("--f-body"); ctx.fillStyle = rgba(C.ink2);
      tick(0, nearY * (small ? 1.3 : 1.42), D.xLabel); if (!side) tick(nearX * (small ? 1.36 : 1.5), 0, D.yLabel);
      /* 현재 가정 표시 */
      if (D.mark) {
        const mx = -1 + 2 * (D.mark.x - D.xs[0]) / (D.xs[nx - 1] - D.xs[0]), my = -1 + 2 * (D.mark.y - D.ys[0]) / (D.ys[ny - 1] - D.ys[0]);
        const top = proj(mx, my, Z(D.mark.z)), bot = proj(mx, my, FLOOR);
        ctx.strokeStyle = rgba(C.acc); ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = rgba(C.acc); ctx.beginPath(); ctx.arc(top.x, top.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(C.surf); ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
        ctx.font = "700 12px " + css("--f-body"); ctx.textAlign = "left"; ctx.fillStyle = rgba(C.ink);
        ctx.fillText(D.mark.label, top.x + 10, top.y - 8);
      }
      /* 마우스 위치의 격자점 */
      if (st.hover) {
        const h = st.hover, p = proj(X(h.i), Y(h.j), Z(D.z[h.i][h.j]));
        ctx.fillStyle = rgba(C.ink); ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      }
      st.screen = { X: X, Y: Y, Z: Z };
    }

    function nearest(mx, my) {
      const D = st.data, S = st.screen; if (!D || !S) return null;
      let best = null, bd = 22 * 22;
      for (let i = 0; i < D.xs.length; i++) for (let j = 0; j < D.ys.length; j++) {
        const p = proj(S.X(i), S.Y(j), S.Z(D.z[i][j])), d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
        if (d < bd) { bd = d; best = { i: i, j: j, px: p.x, py: p.y }; }
      }
      return best;
    }
    function showTip(h) {
      const D = st.data;
      if (!h) { tip.hidden = true; return; }
      tip.innerHTML = "<b>" + D.fz(D.z[h.i][h.j]) + "</b><span>" + D.xLabel + " " + D.fx(D.xs[h.i]) + " · " + D.yLabel + " " + D.fy(D.ys[h.j]) + "</span>";
      tip.hidden = false;
      const left = Math.min(W - tip.offsetWidth - 4, Math.max(4, h.px + 12)), top = Math.max(4, h.py - tip.offsetHeight - 10);
      tip.style.left = left + "px"; tip.style.top = top + "px";
    }

    function loop() {
      st.raf = 0;
      if (st.auto && !st.drag && st.visible) { st.yaw += 0.0035; draw(); st.raf = requestAnimationFrame(loop); }
    }
    const kick = () => { if (!st.raf && st.auto) st.raf = requestAnimationFrame(loop); };

    canvas.addEventListener("pointerdown", (e) => { st.drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch, id: e.pointerId, moved: false }; st.auto = false; });
    window.addEventListener("pointerup", () => { st.drag = null; });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (st.drag && st.drag.id === e.pointerId) {
        const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) st.drag.moved = true;
        st.yaw = st.drag.yaw + dx * 0.008;
        if (e.pointerType === "mouse") st.pitch = Math.max(0.02, Math.min(1.45, st.drag.pitch - dy * 0.006));
        st.hover = null; showTip(null); draw(); return;
      }
      st.hover = nearest(mx, my); draw(); showTip(st.hover);
    });
    canvas.addEventListener("pointerleave", () => { st.hover = null; showTip(null); draw(); });
    /* 키보드: 화살표로 회전·기울이기, Home은 기본 시점 */
    if (!canvas.hasAttribute("tabindex")) canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Home");
    canvas.addEventListener("keydown", (e) => {
      const k = e.key; let used = true;
      if (k === "ArrowLeft") st.yaw -= 0.12; else if (k === "ArrowRight") st.yaw += 0.12;
      else if (k === "ArrowUp") st.pitch = Math.max(0.02, st.pitch - 0.08); else if (k === "ArrowDown") st.pitch = Math.min(1.45, st.pitch + 0.08);
      else if (k === "Home") { st.yaw = -0.7; st.pitch = 0.72; } else used = false;
      if (used) { e.preventDefault(); st.auto = false; draw(); }
    });
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { st.visible = es[0].isIntersecting; if (st.visible) kick(); }).observe(canvas);

    const api = {
      set(data) { st.data = data; size(); draw(); kick(); },
      view(name) {
        st.auto = false;
        /* pitch 0 = 바로 위에서, π/2 = 옆에서 */
        if (name === "top") { st.yaw = 0; st.pitch = 0.02; }
        else if (name === "front") { st.yaw = 0; st.pitch = 1.42; }
        else { st.yaw = -0.7; st.pitch = 0.72; }
        draw();
      },
      spin(on) { st.auto = !!on && !reduce(); kick(); return st.auto; },
      redraw() { size(); draw(); },
      state: st
    };
    window.addEventListener("resize", () => { clearTimeout(api._rz); api._rz = setTimeout(() => api.redraw(), 120); });
    return api;
  }

  root.Surface3D = { create: create };
})(typeof self !== "undefined" ? self : this);

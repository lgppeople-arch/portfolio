/* 홈 '경력을 숫자로': 숫자 네 개를 그 뜻이 바로 보이는 그림과 함께 보여 준다.
   넓은 화면 + 움직임 허용: 화면에 붙은 무대에서 스크롤에 따라 장면이 바뀐다.
   휴대폰이나 '움직임 줄이기': 네 장면이 카드로 차례로 놓인다(그림은 다 그려진 상태).
   그림의 내용은 홈 본문에 이미 적힌 사실만 쓰고, 길이·크기가 실제 값이 아닌 그림에는 '개념도'라고 적는다. */
(function () {
  "use strict";
  const sec = document.getElementById("story");
  if (!sec || !("IntersectionObserver" in window)) return;
  const mqWide = window.matchMedia("(min-width: 900px)"), mqCalm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const A = "#E08A57", B = "#6E95FF", G = "#4FC59A", T = "#EEF1F4", M = "#9AA6B2", L = "#26323D", P = "#141C25";
  const a = (d, extra) => 'class="a' + (extra ? " " + extra : "") + '" style="--d:' + d + 's"';
  const tx = (x, y, s, o) => { o = o || {}; return '<text x="' + x + '" y="' + y + '" fill="' + (o.c || T) + '" font-size="' + (o.s || 14) + '" font-weight="' + (o.w || 500) + '"' + (o.a ? ' text-anchor="' + o.a + '"' : "") + (o.cls ? " " + o.cls : "") + ">" + s + "</text>"; };
  const chip = (x, y, w, s, col, d) => '<g ' + a(d) + '><rect x="' + x + '" y="' + y + '" width="' + w + '" height="26" rx="13" fill="' + P + '" stroke="' + col + '" stroke-opacity=".7"/>' + tx(x + w / 2, y + 17.5, s, { s: 12.5, a: "middle" }) + "</g>";
  const grid = (function () { let g = ""; for (let x = 0; x <= 640; x += 40) g += '<line x1="' + x + '" x2="' + x + '" y1="0" y2="420" stroke="' + L + '" stroke-opacity=".55"/>'; for (let y = 20; y <= 420; y += 40) g += '<line x1="0" x2="640" y1="' + y + '" y2="' + y + '" stroke="' + L + '" stroke-opacity=".55"/>'; return g; })();
  const now = new Date(), nowY = now.getFullYear() + now.getMonth() / 12;

  const SCENES = [
    { n: 6, unit: "년", tab: "경력", title: "두 제조업에서 6년, 맡는 범위를 넓혔습니다",
      desc: "매출 약 1조원 건설소재 회사의 경영관리팀에서 관리회계와 손익 분석을 익혔고, 약 3,000억원 반도체 부품 회사의 재무기획팀에서 투자 심의, 생산부지 인수, 인수 TFT, 이사회 업무로 범위를 넓혔습니다.",
      alt: "2020년 6월부터 2024년 12월까지 유진기업 경영관리팀, 이후 미코세라믹스 재무기획팀. 뒤로 갈수록 맡은 일이 늘어난다.",
      art: function () {
        const x = (v) => 50 + (v - 2020) / 7 * 550, y0 = 330, s1 = x(2020.42), s2 = x(2024.92), s3 = x(Math.min(2026.95, nowY));
        let g = "";
        for (let v = 2020; v <= 2027; v++) g += '<line x1="' + x(v) + '" x2="' + x(v) + '" y1="' + (y0 + 22) + '" y2="' + (y0 + 28) + '" stroke="' + M + '"/>' + tx(x(v), y0 + 46, v, { c: M, s: 12, a: "middle" });
        g += '<rect ' + a(0.1, "gx") + ' x="' + s1 + '" y="' + (y0 - 9) + '" width="' + (s2 - s1) + '" height="18" rx="9" fill="' + B + '"/>';
        g += '<rect ' + a(0.7, "gx") + ' x="' + s2 + '" y="' + (y0 - 9) + '" width="' + (s3 - s2) + '" height="18" rx="9" fill="' + A + '"/>';
        g += '<g ' + a(0.2) + ">" + tx(s1, 72, "유진기업 · 경영관리팀", { w: 700, s: 15 }) + tx(s1, 92, "레미콘·건자재 · 매출 약 1조원", { c: M, s: 12 }) + "</g>";
        ["관리회계·원가 분석", "예산·SAP 관리손익", "MBO 설정·평가", "구조 전환안 검토"].forEach((s, i) => { g += chip(s1, y0 - 60 - i * 34, 150, s, B, 0.35 + i * 0.1); });
        g += '<g ' + a(0.8) + ">" + tx(s2, 72, "미코세라믹스 · 재무기획팀", { w: 700, s: 15 }) + tx(s2, 92, "반도체 부품 · 매출 약 3,000억원", { c: M, s: 12 }) + "</g>";
        ["사업계획·손익·MBO", "투자 타당성·사후관리", "생산부지 인수", "인수 TFT 재무 지원", "이사회·규정 정비", "경쟁사 공시 리서치"].forEach((s, i) => { g += chip(s2, y0 - 60 - i * 34, 158, s, A, 0.95 + i * 0.1); });
        g += '<circle ' + a(1.6, "pulse") + ' cx="' + s3 + '" cy="' + y0 + '" r="6" fill="' + T + '"/>' + '<g ' + a(1.6) + ">" + tx(Math.min(s3, 600), y0 - 20, "현재", { s: 12, a: "middle" }) + "</g>";
        return g;
      } },
    { n: 1500, unit: "억원", tab: "투자", title: "연매출의 절반쯤 되는 인수 건의 숫자를 만들었습니다",
      desc: "구미 생산부지·건물 인수(약 1,500억원, 2026년 공시)의 투자 설명 자료와 차입용 투자·회수 계획을 공동 작성했습니다.",
      alt: "회사 연매출 약 3,000억원 막대와 인수 금액 약 1,500억원 막대 비교. 투자 설명 자료와 차입용 투자·회수 계획을 공동 작성.",
      art: function () {
        let g = tx(50, 62, "규모 비교", { c: M, s: 12 });
        g += '<g ' + a(0.1) + ">" + tx(50, 96, "회사 연매출", { s: 13 }) + tx(590, 96, "약 3,000억원", { s: 13, a: "end", c: M }) + "</g>";
        g += '<rect ' + a(0.15, "gx") + ' x="50" y="106" width="540" height="26" rx="4" fill="' + M + '" fill-opacity=".45"/>';
        g += '<g ' + a(0.6) + ">" + tx(50, 166, "구미 생산부지·건물 인수", { s: 13, w: 700 }) + tx(310, 166, "약 1,500억원", { s: 13, a: "end", c: A, w: 700 }) + "</g>";
        g += '<rect ' + a(0.65, "gx") + ' x="50" y="176" width="270" height="26" rx="4" fill="' + A + '"/>';
        g += '<g ' + a(1.1) + '><line x1="320" x2="320" y1="100" y2="210" stroke="' + A + '" stroke-dasharray="4 4"/>' + tx(330, 194, "연매출의 절반쯤", { c: A, s: 12.5 }) + "</g>";
        g += tx(50, 262, "공동 작성한 문서", { c: M, s: 12 });
        const doc = (x, s1, s2, d) => '<g ' + a(d) + '><rect x="' + x + '" y="276" width="170" height="92" rx="8" fill="' + P + '" stroke="' + L + '"/><rect x="' + (x + 14) + '" y="292" width="26" height="32" rx="3" fill="none" stroke="' + A + '" stroke-width="1.6"/><line x1="' + (x + 20) + '" x2="' + (x + 34) + '" y1="302" y2="302" stroke="' + A + '"/><line x1="' + (x + 20) + '" x2="' + (x + 34) + '" y1="309" y2="309" stroke="' + A + '"/><line x1="' + (x + 20) + '" x2="' + (x + 30) + '" y1="316" y2="316" stroke="' + A + '"/>' + tx(x + 52, 306, s1, { s: 13.5, w: 700 }) + tx(x + 52, 325, s2, { s: 12, c: M }) + tx(x + 14, 352, "공동 작성", { s: 11.5, c: A }) + "</g>";
        g += doc(50, "투자 설명 자료", "왜 사는가", 1.3) + doc(236, "투자·회수 계획", "차입용", 1.5);
        /* 투자 → 회수 개념도 */
        g += '<g ' + a(1.8) + ">" + tx(432, 290, "투자 → 회수 (개념도)", { c: M, s: 11.5 }) + '<line x1="432" x2="590" y1="330" y2="330" stroke="' + M + '"/></g>';
        g += '<rect ' + a(1.9, "gy") + ' x="436" y="330" width="16" height="38" fill="' + A + '"/>';
        [10, 16, 20, 24, 26, 28].forEach((h, i) => { g += '<rect ' + a(2.0 + i * 0.08, "gyu") + ' x="' + (460 + i * 22) + '" y="' + (330 - h) + '" width="16" height="' + h + '" fill="' + G + '"/>'; });
        return g;
      } },
    { n: 30, unit: "억원/년", tab: "예산", title: "부서의 증액 요청을 검토해 품의로 올립니다",
      desc: "비용예산 증액 품의를 담당합니다. 한 해 동안 승인받는 증액 총액은 자산투자를 빼고 약 30억원입니다.",
      alt: "부서의 증액 요청을 검토해 품의를 쓰고, 한 해 약 30억원이 승인되는 흐름.",
      art: function () {
        let g = "";
        const st = [[50, "부서의 증액 요청", "여러 부서 · 수시", M, 0.1], [250, "검토 · 품의 작성", "필요성 · 효과 · 금액", B, 0.7], [450, "승인", "한 해 합계", A, 1.3]];
        st.forEach((s, i) => {
          g += '<g ' + a(s[4]) + '><rect x="' + s[0] + '" y="70" width="150" height="64" rx="10" fill="' + P + '" stroke="' + s[3] + '" stroke-opacity=".8"/>' + tx(s[0] + 75, 98, s[1], { s: 14, w: 700, a: "middle" }) + tx(s[0] + 75, 118, s[2], { s: 11.5, c: M, a: "middle" }) + "</g>";
          if (i < 2) g += '<g ' + a(s[4] + 0.3) + '><line x1="' + (s[0] + 156) + '" x2="' + (s[0] + 190) + '" y1="102" y2="102" stroke="' + M + '" stroke-width="1.6"/><path d="M' + (s[0] + 186) + ' 96l8 6-8 6" fill="none" stroke="' + M + '" stroke-width="1.6"/></g>';
        });
        /* 요청 조각이 깔때기를 지나 승인 막대로 */
        const chips = [[60, 176, 54], [120, 176, 36], [162, 176, 34], [60, 206, 30], [96, 206, 46], [148, 206, 48], [60, 236, 44], [110, 236, 28], [144, 236, 52], [74, 266, 40], [120, 266, 34]];
        chips.forEach((c, i) => { g += '<rect ' + a(0.2 + i * 0.04) + ' x="' + c[0] + '" y="' + c[1] + '" width="' + c[2] + '" height="20" rx="4" fill="' + M + '" fill-opacity="' + (0.25 + (i % 3) * 0.12) + '"/>'; });
        g += '<path ' + a(0.8) + ' d="M228 170 L400 196 L400 266 L228 292 Z" fill="' + B + '" fill-opacity=".14" stroke="' + B + '" stroke-opacity=".5"/>';
        g += '<g ' + a(0.9) + ">" + tx(314, 236, "타당한 것만", { s: 12.5, a: "middle", c: B }) + "</g>";
        g += '<rect x="450" y="176" width="150" height="110" rx="8" fill="none" stroke="' + L + '" stroke-width="1.5"/>';
        g += '<rect ' + a(1.4, "gyu") + ' x="454" y="180" width="142" height="102" rx="5" fill="' + A + '"/>';
        g += '<g ' + a(1.9) + ">" + tx(525, 228, "약 30억원", { s: 22, w: 800, a: "middle", c: "#0B1118" }) + tx(525, 250, "연간 승인 총액", { s: 12, a: "middle", c: "#0B1118" }) + "</g>";
        g += '<g ' + a(2.1) + ">" + tx(525, 312, "자산투자 제외", { s: 12, a: "middle", c: M }) + tx(130, 312, "조각 크기는 개념도", { s: 11.5, a: "middle", c: M }) + "</g>";
        return g;
      } },
    { n: null, word: "기각", unit: "→ 유지", tab: "판단", title: "두 안을 같은 잣대로 놓고 비교했습니다",
      desc: "매출 약 1조원 주력사업의 유지안과 구조 전환안을 비교했습니다. 사업부문별 매출·영업이익을 다시 추정하고 수익성 밖의 고려사항 여섯 가지를 정리했습니다. 전환안은 기각되고 기존 사업 유지로 결정됐습니다.",
      alt: "유지안과 전환안 비교표. 전환안은 이익 규모가 줄고 해결이 어려운 리스크가 남아 기각, 기존 사업 유지로 결정.",
      art: function () {
        let g = '<g ' + a(0.1) + ">" + tx(250, 64, "현행 유지안", { s: 14, w: 700, a: "middle", c: G }) + tx(480, 64, "구조 전환안", { s: 14, w: 700, a: "middle", c: M }) + '<line x1="50" x2="590" y1="78" y2="78" stroke="' + L + '" stroke-width="1.5"/></g>';
        g += '<g ' + a(0.3) + ">" + tx(50, 112, "이익 규모", { s: 13 }) + tx(50, 130, "부문별 재추정", { s: 11, c: M }) + "</g>";
        g += '<rect ' + a(0.4, "gx") + ' x="160" y="100" width="180" height="22" rx="4" fill="' + G + '"/>';
        g += '<rect ' + a(0.6, "gx") + ' x="390" y="100" width="118" height="22" rx="4" fill="' + M + '" fill-opacity=".6"/>';
        g += '<g ' + a(0.9) + ">" + tx(516, 116, "줄어듦", { s: 12, c: "#F08C7E" }) + "</g>";
        g += '<line x1="50" x2="590" y1="150" y2="150" stroke="' + L + '"/>';
        g += '<g ' + a(1.0) + ">" + tx(50, 178, "수익성 밖", { s: 13 }) + tx(50, 196, "고려사항 6가지", { s: 11, c: M }) + "</g>";
        ["운영 주체 확보", "사업 연속성", "원재료 수급", "판매망 유지", "자산 가치평가", "부대자산 처리"].forEach((s, i) => {
          const cx = 160 + (i % 2) * 112, cy = 164 + Math.floor(i / 2) * 32;
          g += '<g ' + a(1.1 + i * 0.08) + '><rect x="' + cx + '" y="' + cy + '" width="104" height="24" rx="12" fill="' + P + '" stroke="' + L + '"/><path d="M' + (cx + 10) + " " + (cy + 12) + 'l4 4 7-8" fill="none" stroke="' + G + '" stroke-width="1.8"/>' + tx(cx + 28, cy + 16.5, s, { s: 11.5 }) + "</g>";
        });
        g += '<g ' + a(1.7) + '><rect x="394" y="176" width="190" height="64" rx="8" fill="' + P + '" stroke="#F08C7E" stroke-opacity=".7" stroke-dasharray="5 4"/>' + tx(489, 204, "해결이 어려운", { s: 12.5, a: "middle", c: "#F08C7E" }) + tx(489, 223, "리스크가 남음", { s: 12.5, a: "middle", c: "#F08C7E" }) + "</g>";
        g += '<line x1="50" x2="590" y1="276" y2="276" stroke="' + L + '" stroke-width="1.5"/>';
        g += '<g ' + a(2.1) + '><rect x="160" y="298" width="180" height="50" rx="10" fill="' + G + '"/>' + tx(250, 329, "기존 사업 유지", { s: 16, w: 800, a: "middle", c: "#0B1118" }) + "</g>";
        g += '<g ' + a(2.3) + '><rect x="394" y="298" width="190" height="50" rx="10" fill="none" stroke="' + M + '" stroke-opacity=".6"/>' + tx(489, 329, "기각", { s: 16, w: 700, a: "middle", c: M }) + '<line x1="424" x2="554" y1="323" y2="323" stroke="' + M + '" stroke-opacity=".0"/></g>';
        g += tx(50, 329, "결정", { s: 13 }) + tx(590, 384, "막대 길이는 개념도", { s: 11, c: M, a: "end" });
        return g;
      } }
  ];

  /* ---------- 화면 만들기 ---------- */
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  sec.innerHTML = '<div class="st-track"><div class="st-stage"><div class="wrap wide st-wrap">' +
    '<div class="st-head"><span class="st-kick">CAREER IN NUMBERS</span><div class="st-tabs" role="group" aria-label="장면 이동">' +
    SCENES.map((s, i) => '<button type="button" data-i="' + i + '"><b>' + String(i + 1).padStart(2, "0") + "</b>" + s.tab + "</button>").join("") + '</div><a class="st-skip" href="#career">건너뛰기 ↓</a></div>' +
    '<div class="st-scenes">' + SCENES.map((s, i) =>
      '<article class="st-scene" data-i="' + i + '"><div class="st-text"><div class="st-num"><b>' + (s.n === null ? s.word : s.n.toLocaleString("ko-KR")) + "</b><small>" + s.unit + "</small></div><h3>" + esc(s.title) + "</h3><p>" + esc(s.desc) + "</p></div>" +
      '<div class="st-art"><svg viewBox="0 0 640 420" role="img" aria-label="' + esc(s.alt) + '">' + grid + s.art() + "</svg></div></article>").join("") +
    "</div></div></div></div>";
  const scenes = Array.prototype.slice.call(sec.querySelectorAll(".st-scene")), tabs = Array.prototype.slice.call(sec.querySelectorAll(".st-tabs button")), track = sec.querySelector(".st-track");
  let pinned = false, cur = -1, raf = 0;

  function count(el, n) {
    if (n === null || mqCalm.matches) return;
    const t0 = performance.now(), tick = (t) => { const k = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(n * e).toLocaleString("ko-KR"); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function show(i) {
    if (i === cur) return; cur = i;
    scenes.forEach((s, k) => s.classList.toggle("on", k === i));
    tabs.forEach((b, k) => b.setAttribute("aria-current", k === i ? "step" : "false"));
    count(scenes[i].querySelector(".st-num b"), SCENES[i].n);
  }
  function onScroll() {
    if (!pinned || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = track.getBoundingClientRect(), span = r.height - window.innerHeight, p = span > 0 ? Math.max(0, Math.min(0.999, -r.top / span)) : 0;
      show(Math.floor(p * SCENES.length));
      sec.style.setProperty("--st-p", (p * 100).toFixed(1) + "%");
    });
  }
  tabs.forEach((b, i) => b.addEventListener("click", () => {
    if (!pinned) { scenes[i].scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const r = track.getBoundingClientRect(), span = r.height - window.innerHeight;
    window.scrollTo({ top: window.scrollY + r.top + span * (i + 0.5) / SCENES.length, behavior: mqCalm.matches ? "auto" : "smooth" });
  }));
  /* 카드 모드: 화면에 들어오면 그 장면의 그림을 그린다 */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (!pinned && e.isIntersecting) { if (!e.target.classList.contains("on")) { e.target.classList.add("on"); count(e.target.querySelector(".st-num b"), SCENES[+e.target.dataset.i].n); } } }), { threshold: 0.35 });
  scenes.forEach((s) => io.observe(s));

  function mode() {
    pinned = mqWide.matches && !mqCalm.matches;
    sec.classList.toggle("pinned", pinned); sec.classList.toggle("cards", !pinned);
    cur = -1;
    if (pinned) { scenes.forEach((s) => s.classList.remove("on")); onScroll(); }
    else if (mqCalm.matches) scenes.forEach((s) => s.classList.add("on"));
  }
  [mqWide, mqCalm].forEach((m) => (m.addEventListener ? m.addEventListener("change", mode) : m.addListener(mode)));
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  sec.hidden = false; document.documentElement.classList.add("story-on");
  mode();
})();

/* 화면 테마: 기본은 밝은 화면. 방문자가 고른 테마는 이 브라우저에만 기억한다.
   <head>에서 바로 실행해 페이지가 그려지기 전에 테마를 정한다. */
(function () {
  "use strict";
  var KEY = "lgp.theme", root = document.documentElement;
  var SELF = document.currentScript ? document.currentScript.src : "";
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(t) { try { localStorage.setItem(KEY, t); } catch (e) { /* 저장이 막혀 있으면 이번 방문에만 적용 */ } }
  var start = saved();
  root.setAttribute("data-theme", start === "dark" ? "dark" : "light");

  var SUN = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M20 14.6A8 8 0 0 1 9.4 4a8 8 0 1 0 10.6 10.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  function paint(btn) {
    var dark = root.getAttribute("data-theme") === "dark";
    btn.innerHTML = (dark ? SUN : MOON) + '<span class="lbl">' + (dark ? "밝게" : "어둡게") + "</span>";
    btn.setAttribute("aria-label", dark ? "밝은 화면으로 바꾸기" : "어두운 화면으로 바꾸기");
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
  }
  function wire() {
    var btn = document.getElementById("theme-btn");
    if (!btn) return;
    paint(btn);
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      save(next);
      paint(btn);
    });
  }
  /* 펼침 메뉴: 하나를 열면 나머지는 닫고, 바깥을 누르거나 Esc를 누르면 닫는다 */
  function closeMenus(except) {
    var open = document.querySelectorAll("details.nav-g[open]");
    for (var i = 0; i < open.length; i++) if (open[i] !== except) open[i].removeAttribute("open");
  }
  document.addEventListener("click", function (e) {
    var d = e.target.closest ? e.target.closest("details.nav-g") : null;
    closeMenus(d);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenus(null); });
  /* 표의 빈 머리글 칸(왼쪽 위 모서리)에 화면 낭독기용 이름을 넣는다. 표를 다시 그릴 때마다 적용 */
  function nameCorners() {
    var ths = document.querySelectorAll("th:empty");
    for (var i = 0; i < ths.length; i++) { var sp = document.createElement("span"); sp.className = "sr"; sp.textContent = "구분"; ths[i].appendChild(sp); }
  }
  /* 제목 단계가 건너뛰는 곳(h2 다음 h4 등)은 화면 낭독기가 읽는 단계만 한 칸씩 맞춘다. 모양은 그대로 */
  function levelHeadings() {
    var hs = document.querySelectorAll("h1, h2, h3, h4, h5, h6"), eff = [0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < hs.length; i++) {
      if (!hs[i].getClientRects().length) continue; /* 숨은 제목(접힌 탭 등)은 세지 않는다 */
      var L = +hs[i].tagName.charAt(1), parent = 0, k;
      for (k = L - 1; k >= 1; k--) if (eff[k]) { parent = eff[k]; break; }
      var e = Math.min(L, parent + 1);
      eff[L] = e; for (k = L + 1; k <= 6; k++) eff[k] = 0;
      if (e !== L) { if (hs[i].getAttribute("aria-level") !== String(e)) hs[i].setAttribute("aria-level", String(e)); }
      else if (hs[i].hasAttribute("data-lv")) hs[i].removeAttribute("aria-level");
      if (e !== L) hs[i].setAttribute("data-lv", "1");
    }
  }
  function tidy() { nameCorners(); levelHeadings(); }
  function watchTables() {
    tidy();
    if (!window.MutationObserver) return;
    var t = null;
    var later = function () { clearTimeout(t); t = setTimeout(tidy, 400); };
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", later); /* 탭을 바꾸면 보이는 제목이 달라진다 */
  }
  /* 장식 그림(구역 머리, 제목 옆 그림, 읽기 진행 막대)은 본문이 그려진 뒤에 불러온다 */
  function loadArt() {
    if (!SELF) return;
    var sc = document.createElement("script"); sc.src = SELF.replace(/theme\.js(\?.*)?$/, "art.js"); sc.async = true; document.body.appendChild(sc);
  }
  function ready() { wire(); watchTables(); loadArt(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();

/* 화면 테마: 기본은 밝은 화면. 방문자가 고른 테마는 이 브라우저에만 기억한다.
   <head>에서 바로 실행해 페이지가 그려지기 전에 테마를 정한다. */
(function () {
  "use strict";
  var KEY = "lgp.theme", root = document.documentElement;
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();

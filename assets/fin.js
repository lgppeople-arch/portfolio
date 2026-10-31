/* 공용 도구: 숫자 표기, 재무 계산, SVG 차트 도우미, 탭.
   브라우저에서는 window.Fin, 노드에서는 require()로 쓴다. 계산 함수는 DOM에 의존하지 않는다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Fin = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- 숫자 표기: 금액 음수는 괄호(회계 관행), 비율은 마이너스 기호 ---------- */
  const NF = [0, 1, 2, 3].map((d) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const ok = (x) => x !== null && x !== undefined && isFinite(x);
  const tidy = (x, d) => (Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x);

  function money(x, d) {
    d = d === undefined ? 1 : d;
    if (!ok(x)) return "–";
    const v = tidy(x, d);
    return v < 0 ? "(" + NF[d].format(-v) + ")" : NF[d].format(v);
  }
  function signed(x, d) {
    d = d === undefined ? 1 : d;
    if (!ok(x)) return "–";
    const v = tidy(x, d);
    return v < 0 ? "(" + NF[d].format(-v) + ")" : (v > 0 ? "+" : "") + NF[d].format(v);
  }
  /* x는 소수(0.107 → 10.7%) */
  function pct(x, d) {
    d = d === undefined ? 1 : d;
    if (!ok(x)) return "–";
    const v = tidy(x * 100, d);
    return (v < 0 ? "−" + NF[d].format(-v) : NF[d].format(v)) + "%";
  }
  function pctSigned(x, d) {
    d = d === undefined ? 1 : d;
    if (!ok(x)) return "–";
    const v = tidy(x * 100, d);
    return (v < 0 ? "−" : v > 0 ? "+" : "") + NF[d].format(Math.abs(v)) + "%";
  }
  /* 퍼센트포인트: x는 소수 차이 */
  function pp(x, d) {
    d = d === undefined ? 1 : d;
    if (!ok(x)) return "–";
    const v = tidy(x * 100, d);
    return (v < 0 ? "−" : v > 0 ? "+" : "") + NF[d].format(Math.abs(v)) + "%p";
  }
  function mult(x, d) {
    d = d === undefined ? 1 : d;
    return ok(x) ? NF[d].format(tidy(x, d)) + "배" : "–";
  }
  function num(x, d) {
    d = d === undefined ? 0 : d;
    return ok(x) ? NF[d].format(tidy(x, d)) : "–";
  }
  function years(x) {
    return ok(x) ? NF[1].format(x) + "년" : "–";
  }

  /* ---------- 재무 계산 ---------- */
  /* flows[0]은 0시점. midYear면 1기 이후 현금흐름을 기중(t − 0.5)으로 할인 */
  function npv(rate, flows, midYear) {
    let s = 0;
    for (let i = 0; i < flows.length; i++) {
      const t = i === 0 ? 0 : midYear ? i - 0.5 : i;
      s += flows[i] / Math.pow(1 + rate, t);
    }
    return s;
  }
  /* 이분법. 부호가 바뀌지 않으면 null */
  function irr(flows) {
    const f = (r) => npv(r, flows, false);
    let lo = -0.99, hi = 10;
    let flo = f(lo), fhi = f(hi);
    if (!(flo * fhi < 0)) return null;
    for (let i = 0; i < 300; i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }
  /* 누적 현금흐름이 처음 0 이상이 되는 시점(연, 선형 보간) */
  function payback(flows) {
    let cum = 0;
    for (let i = 0; i < flows.length; i++) {
      const prev = cum;
      cum += flows[i];
      if (i > 0 && prev < 0 && cum >= 0) return i - 1 + -prev / flows[i];
    }
    return null;
  }
  /* 엑셀 PERCENTILE.INC와 같은 선형 보간 */
  function quantile(arr, q) {
    const a = arr.filter(ok).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  }
  const median = (arr) => quantile(arr, 0.5);
  const sum = (arr) => arr.reduce((s, v) => s + v, 0);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => { if (c !== null && c !== undefined) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  /* 큰 숫자 + 작은 단위 */
  function setValue(node, main, unit, isNeg) {
    node.textContent = "";
    node.appendChild(el("span", { class: isNeg ? "neg" : null, text: main }));
    if (unit) node.appendChild(el("small", { text: unit }));
  }
  /* 숫자 입력 읽기: 비었거나 범위를 벗어나면 표시하고 기본값을 쓴다 */
  function readNum(input, fallback) {
    const raw = input.value.trim();
    const v = raw === "" ? NaN : Number(raw);
    const min = input.min !== "" ? Number(input.min) : -Infinity;
    const max = input.max !== "" ? Number(input.max) : Infinity;
    const bad = !isFinite(v) || v < min || v > max;
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    return bad ? fallback : v;
  }
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* 크기·테마·글꼴이 바뀌면 다시 그린다 */
  function onRedraw(fn) {
    let t = null;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fn, 120); });
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", fn);
    }
    new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fn);
  }

  /* ---------- 탭 (ARIA tablist) ---------- */
  function tabs(buttonIds, onChange) {
    const btns = buttonIds.map($);
    function select(i, focus) {
      btns.forEach((b, j) => {
        const on = i === j;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        const panel = b.getAttribute("aria-controls") ? $(b.getAttribute("aria-controls")) : null;
        if (panel) panel.hidden = !on;
      });
      if (focus) btns[i].focus();
      if (onChange) onChange(i);
    }
    btns.forEach((b, i) => {
      b.addEventListener("click", () => select(i));
      b.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); select((i + 1) % btns.length, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); select((i - 1 + btns.length) % btns.length, true); }
      });
    });
    return select;
  }

  /* ---------- SVG ---------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgText(parent, x, y, text, attrs) {
    const t = svgEl("text", Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = text;
    return t;
  }
  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { lo: lo, hi: hi, ticks: ticks, step: step };
  }
  /* 세로 막대: 데이터 끝만 둥글게 */
  function barPath(x, w, y0, y1, r) {
    const h = Math.abs(y1 - y0);
    r = Math.min(r, h, w / 2);
    if (h < 0.5) return "M" + x + "," + y0 + "H" + (x + w);
    if (y1 < y0) return "M" + x + "," + y0 + "V" + (y1 + r) + "Q" + x + "," + y1 + " " + (x + r) + "," + y1 + "H" + (x + w - r) + "Q" + (x + w) + "," + y1 + " " + (x + w) + "," + (y1 + r) + "V" + y0 + "Z";
    return "M" + x + "," + y0 + "V" + (y1 - r) + "Q" + x + "," + y1 + " " + (x + r) + "," + y1 + "H" + (x + w - r) + "Q" + (x + w) + "," + y1 + " " + (x + w) + "," + (y1 - r) + "V" + y0 + "Z";
  }
  function makeTip(host) {
    let tip = host.querySelector(".tip");
    if (!tip) { tip = el("div", { class: "tip" }); tip.hidden = true; host.appendChild(tip); }
    return {
      show(title, rows, x, y) {
        tip.textContent = "";
        tip.appendChild(el("div", { class: "t", text: title }));
        rows.forEach((row) => {
          const l = el("span");
          if (row[2]) { const k = el("i", { class: "key-line" }); k.style.background = row[2]; k.style.marginRight = "6px"; k.style.verticalAlign = "middle"; l.appendChild(k); }
          l.appendChild(document.createTextNode(row[0]));
          tip.appendChild(el("div", { class: "row" }, [l, el("b", { text: row[1] })]));
        });
        tip.hidden = false;
        const hw = host.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
        let left = x + 12; if (left + tw > hw) left = Math.max(0, x - tw - 12);
        let top = y - th - 10; if (top < 0) top = y + 14;
        tip.style.left = left + "px"; tip.style.top = top + "px";
      },
      hide() { tip.hidden = true; }
    };
  }
  function wireHit(rect, host, tipApi, getContent) {
    rect.setAttribute("tabindex", "0");
    const show = (evt) => {
      const c = getContent();
      const hb = host.getBoundingClientRect();
      let x, y;
      if (evt && evt.clientX !== undefined && evt.type !== "focus") { x = evt.clientX - hb.left; y = evt.clientY - hb.top; }
      else { const rb = rect.getBoundingClientRect(); x = rb.left - hb.left + rb.width / 2; y = rb.top - hb.top + 20; }
      rect.classList.add("on");
      tipApi.show(c.title, c.rows, x, y);
    };
    const hide = () => { rect.classList.remove("on"); tipApi.hide(); };
    rect.addEventListener("pointermove", show);
    rect.addEventListener("pointerleave", hide);
    rect.addEventListener("focus", show);
    rect.addEventListener("blur", hide);
    const c0 = getContent();
    rect.setAttribute("aria-label", c0.title + ", " + c0.rows.map((r) => r[0] + " " + r[1]).join(", "));
  }
  /* 차트 틀: host 안 .plot-host를 비우고 svg를 만든다 */
  function plotFrame(host, H, label) {
    const plot = host.querySelector(".plot-host");
    plot.textContent = "";
    const W = Math.max(280, plot.clientWidth || 600);
    const svg = svgEl("svg", { class: "plot", viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label }, plot);
    return { plot: plot, svg: svg, W: W, H: H };
  }

  /* 받침 유무에 따라 조사 고르기: josa("가동률", "이", "가").
     닫는 괄호는 건너뛰고, 영문·숫자·%는 읽는 소리로 판단한다 (A 에이, L 엘, 3 삼, % 퍼센트) */
  const LATIN_BATCHIM = "LMNR", DIGIT_BATCHIM = "013678";
  function josa(word, withBatchim, without) {
    const s = String(word).trim().replace(/[)\]}'"’”\s]+$/, "");
    const ch = s.slice(-1);
    const code = ch.charCodeAt(0) - 0xac00;
    let has;
    if (code >= 0 && code <= 11171) has = code % 28 !== 0;
    else if (/[A-Za-z]/.test(ch)) has = LATIN_BATCHIM.indexOf(ch.toUpperCase()) >= 0;
    else if (/[0-9]/.test(ch)) has = DIGIT_BATCHIM.indexOf(ch) >= 0;
    else if (ch === "%") has = false;
    else has = true;
    return word + (has ? withBatchim : without);
  }

  return {
    money, signed, pct, pctSigned, pp, mult, num, years,
    npv, irr, payback, quantile, median, sum, clamp,
    $, el, setValue, readNum, css, onRedraw, tabs,
    svgEl, svgText, niceTicks, barPath, makeTip, wireHit, plotFrame, josa
  };
});

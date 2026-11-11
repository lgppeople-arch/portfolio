/* 사이트의 모든 화면을 기본값 그대로 PDF로 내보낸다.
   사용법: node scripts/export-pdf.js <출력 폴더> [파일 이름 일부 ...]
   - 화면마다 PDF 한 개(A4 가로)와, 표지·목차·책갈피가 붙은 합본 한 개를 만든다(합본은 python3 + pypdf 필요).
   - 화면과 같은 데스크톱 배치(인쇄 폭에 맞춘 창 크기)로 그리고, 탭·접힌 영역은 모두 펼친다. 입력값은 기본값 그대로다.
   - 쪽 나눔은 직접 계산해 넣는다(아래 paginate). 카드·그래프·표의 행이 쪽 사이에서 잘리지 않고,
     제목이 쪽 끝에 홀로 남지 않으며, 한 쪽보다 긴 표는 행 단위로 나뉘고 다음 쪽에 머리글이 다시 붙는다.
   - pages.json의 plan.pages(예상 쪽수)가 실제 PDF 쪽수와 같으면 계산대로 나뉜 것이다.
   - 움직임 줄이기 설정으로 열어, 애니메이션 도중이 아닌 완성된 화면을 찍는다. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SITE = "lgppeople-arch.github.io/portfolio/";
const PAGES = [
  ["index.html", "01_홈", "홈"],
  ["tools/samsung.html", "02_삼성전자_재무_분석", "삼성전자 재무 분석"],
  ["tools/sectors.html", "03_업종별_재무제표_읽기", "업종별 재무제표 읽기"],
  ["tools/ma-case.html", "04_M_A_사례_HD현대중공업_미포_합병", "M&A 사례: HD현대중공업·미포 합병"],
  ["tools/reading.html", "05_AI_인프라_읽기_노트", "AI 인프라 읽기 노트"],
  ["tools/fsa.html", "06_재무제표_분석_프레임워크", "재무제표 분석 프레임워크"],
  ["tools/semi-cycle.html", "07_반도체_사이클과_재무", "반도체 사이클과 재무"],
  ["tools/deck.html", "08_보고서_PPT_작성_원칙", "보고서·PPT 작성 원칙"],
  ["tools/charts.html", "09_차트_선택과_디자인", "차트 선택과 디자인"],
  ["tools/sources.html", "10_정보_출처와_참고_자료", "정보 출처와 참고 자료"],
  ["tools/stats-notes.html", "11_통계_기법과_활용", "통계 기법과 활용"],
  ["tools/pro-methods.html", "12_추정과_가치의_기법", "추정과 가치의 기법"],
  ["tools/kpi-tree.html", "13_KPI_트리", "KPI 트리"],
  ["tools/plan-risk.html", "14_사업계획_달성_확률", "사업계획 달성 확률"],
  ["tools/budget-opt.html", "15_비용예산_증액_우선순위", "비용예산 증액 우선순위"],
  ["tools/pl-report.html", "16_월_손익_보고", "월 손익 보고"],
  ["tools/cost-stats.html", "17_원가_행태와_불량_관리도", "원가 행태와 불량 관리도"],
  ["tools/mbo-kpi.html", "18_성과평가_MBO_KPI", "성과평가 MBO·KPI"],
  ["tools/cash-13w.html", "19_13주_자금수지", "13주 자금수지"],
  ["tools/capital.html", "20_적정_부채와_파산_위험", "적정 부채와 파산 위험"],
  ["tools/doa.html", "21_위임전결_기준_점검", "위임전결 기준 점검"],
  ["tools/capex-kit.html", "22_설비투자_분석_키트", "설비투자 분석 키트"],
  ["tools/post-review.html", "23_투자_사후관리", "투자 사후관리"],
  ["tools/ma-process.html", "24_M_A_절차_지도", "M&A 절차 지도"],
  ["tools/ma-valuation.html", "25_M_A_가치평가", "M&A 가치평가"],
  ["tools/holdco-nav.html", "26_지주사_포트폴리오_가치", "지주사 포트폴리오 가치"],
  ["tools/fx-hedge.html", "27_환리스크_헤지", "환리스크 헤지"],
  ["tools/checks.html", "28_계산_검산", "계산 검산"],
  ["tools/guide.html", "29_쉬운_가이드", "쉬운 가이드"],
  ["en.html", "30_English_summary", "English summary"]
];

/* A4 가로. 인쇄 배율 0.82면 본문 15px이 약 9pt로 찍히고, 화면은 1,277px 폭의 데스크톱 배치가 된다. */
const MM = 96 / 25.4, SCALE = 0.82;
const MARGIN = { top: 13, bottom: 14, left: 10, right: 10 };
const VIEW_W = Math.round((297 - MARGIN.left - MARGIN.right) * MM / SCALE);
const PAGE_H = (210 - MARGIN.top - MARGIN.bottom) * MM / SCALE;

const PRINT_CSS = `
  :root, :root[data-theme] { --paper: #FFFFFF !important; }
  html { scroll-behavior: auto !important; }
  .site-head { position: static !important; }
  .site-nav, .theme-btn, .tip, .pdf-hide, .rpt-toc, .trail { display: none !important; }
  .rpt-grid { display: block !important; }
  .scroll, .etable-wrap { overflow: visible !important; }
  #cf-table { font-size: 11.5px !important; } #cf-table th, #cf-table td { padding-inline: 5px !important; }
  table.mx { min-width: 0 !important; } table.mx th, table.mx td { padding-inline: 6px !important; } table.mx tbody th { min-width: 150px !important; }
  .pdf-tab-title { font-family: var(--f-display); font-weight: 800; font-size: 19px; color: var(--accent); margin: 26px 0 10px; padding-top: 12px; border-top: 2px solid var(--rule); }
  tr { break-inside: avoid; }
  .site-foot { margin-top: 28px !important; padding-block: 14px 0 !important; }
  .rpt-body > section { padding-bottom: 30px !important; }
`;

/* 페이지 사이에서 잘리지 않게 표시한다. 화면 배치가 인쇄 폭과 같으므로 여기서 잰 높이가 인쇄 높이다.
   - 테두리·배경이 있는 상자, 표·그림, 문단·목록 항목: 한 쪽에 들어가면 통째로 다음 쪽으로 넘긴다.
   - 여러 단으로 놓인 격자·가로 배치: 반 쪽 이하면 통째로 넘긴다. 더 크면 안쪽 상자 단위로 나뉜다.
   - 제목과 머리글은 바로 뒤 내용과 같은 쪽에 둔다. */
function keepTogether(pageH) {
  const fit = pageH - 16;
  const MINZOOM = 0.9;
  const TEXT = /^(P|LI|DT|DD|FIGCAPTION|BLOCKQUOTE|PRE|TR|FIGURE|TABLE|SVG|CANVAS|IMG|DETAILS|SUMMARY|H1|H2|H3|H4|H5)$/;
  const boxy = (cs) => {
    const sides = ["Top", "Right", "Bottom", "Left"].filter((k) => parseFloat(cs["border" + k + "Width"]) > 0 && cs["border" + k + "Style"] !== "none").length;
    const bg = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
    return sides >= 2 || bg || cs.boxShadow !== "none" || cs.backgroundImage !== "none" || (sides === 1 && parseFloat(cs.borderLeftWidth) > 0);
  };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed" && el.getBoundingClientRect().height > 0;
  };
  /* 나란히 놓였는가: 세로로 겹치면서 가로로는 겹치지 않는 두 칸이 있다(가운데 정렬도 잡힌다) */
  const sideBy = (rs) => rs.some((a, i) => rs.some((b, j) => j > i && a.top < b.bottom - 1 && b.top < a.bottom - 1 && (a.right <= b.left + 1 || b.right <= a.left + 1)));
  const oneRow = (rs) => rs.length > 0 && Math.max(...rs.map((r) => r.top)) < Math.min(...rs.map((r) => r.bottom)) - 1;
  /* 세로로 겹치는 칸끼리 한 줄로 묶는다 */
  const rowsOf = (rs) => {
    const rows = [];
    for (const r of rs.slice().sort((a, b) => a.top - b.top)) {
      const row = rows.find((x) => r.top < x.bottom - 1 && x.top < r.bottom - 1);
      if (row) { row.items.push(r); row.bottom = Math.max(row.bottom, r.bottom); } else rows.push({ top: r.top, bottom: r.bottom, items: [r] });
    }
    return rows;
  };
  let marked = 0, zoomed = 0;
  const mark = (el) => { if (el.style.breakInside !== "avoid") { el.style.breakInside = "avoid"; marked++; } };
  const inZoom = (el) => { for (let a = el.parentElement; a; a = a.parentElement) if (a.style.zoom) return true; return false; };
  for (const el of document.body.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.display === "contents" || cs.position === "absolute" || cs.position === "fixed") continue;
    const tag = el.tagName.toUpperCase();
    if (cs.display === "inline" && !/^(SVG|CANVAS|IMG)$/.test(tag)) continue;
    let h = el.getBoundingClientRect().height;
    if (h < 4) continue;
    let layout = /grid|flex/.test(cs.display);
    let kids = layout ? Array.from(el.children).filter(shown) : [];
    let rects = kids.map((k) => k.getBoundingClientRect());
    /* 한 쪽보다 긴 칸이 둘 이상 나란히 있으면(입력·결과 두 단 등) 양쪽이 동시에 쪽을 넘겨 나눔 위치를 맞출 수 없다.
       이런 배치만 위아래로 쌓는다. 한 쪽 안에 들어가는 나란한 배치는 그대로 둔다. */
    if (layout && h > fit && sideBy(rects) && rowsOf(rects).some((row) => row.bottom - row.top > fit && row.items.filter((r) => r.height > fit * 0.45).length >= 2)) {
      if (/grid/.test(cs.display)) {
        el.style.gridTemplateColumns = "minmax(0, 1fr)";
        el.style.gridAutoFlow = "row";
        kids.forEach((k) => { k.style.gridColumn = "1 / -1"; k.style.gridRow = "auto"; });
      } else {
        el.style.flexDirection = "column";
        el.style.flexWrap = "nowrap";
        el.style.alignItems = "stretch";
        kids.forEach((k) => { k.style.flex = "none"; k.style.width = "auto"; k.style.maxWidth = "none"; });
      }
      kids.forEach((k) => { if (getComputedStyle(k).position === "sticky") k.style.position = "static"; });
      kids = kids.filter(shown);
      rects = kids.map((k) => k.getBoundingClientRect());
      h = el.getBoundingClientRect().height;
    }
    const row1 = layout && sideBy(rects) && oneRow(rects);
    /* 한 쪽보다 조금(10% 이내) 큰 상자·그림·표·한 줄짜리 단은 살짝 줄여 한 쪽에 맞춘다 */
    const cardish = tag === "ARTICLE" || /(^|[\s-])card(\s|$|-)/.test(String(el.className));
    if (h > fit && h * MINZOOM <= fit && (boxy(cs) || cardish || /^(TABLE|FIGURE)$/.test(tag) || row1) && !inZoom(el) && el !== document.body && !/^(MAIN|SECTION|HEADER|FOOTER)$/.test(tag)) {
      /* 줄이면 글이 다시 줄바꿈돼 덜 줄어든다: 실제 높이를 재며 몇 번 나눠 줄인다. 폭에 맞춰 커지는 그림처럼 안 줄면 되돌린다 */
      let z = 1, hh = h;
      for (let k = 0; k < 5 && hh > fit; k++) {
        z = z * (fit - 2) / hh;
        if (z < MINZOOM) break;
        el.style.zoom = z.toFixed(4);
        hh = el.getBoundingClientRect().height;
      }
      if (hh > fit) el.style.zoom = ""; else { zoomed++; mark(el); }
      h = el.getBoundingClientRect().height;
    }
    if (layout && sideBy(rects)) {
      /* 나란히 놓인 단: 각 칸은 통째로, 한 줄짜리면 줄 전체를 통째로 */
      kids.forEach((k) => { if (k.getBoundingClientRect().height <= fit) mark(k); });
      if (row1 && h <= fit) mark(el);
    }
    if (layout && h <= fit * 0.5) mark(el);
    if (h <= fit && (TEXT.test(tag) || boxy(cs) || cardish)) mark(el);
  }
  const HEADS = "h1,h2,h3,h4,h5,.lane-head,.cycle-head,.block-head,.board-head,.chart-head,.detail-head,.df-head,.sec-head,.sc-head,.fig-h,.case-top,.eyebrow,.kicker,.pdf-tab-title";
  for (const hd of document.querySelectorAll(HEADS)) {
    hd.style.breakAfter = "avoid";
    const n = hd.nextElementSibling;
    if (n) n.style.breakBefore = "avoid";
  }
  return { marked, zoomed };
}

/* 쪽 나눔 위치를 직접 정한다. Chromium은 격자(grid) 안의 '통째로 넘기기'를 지키지 않을 때가 있어서,
   화면 배치(인쇄 폭과 같음)로 각 덩어리의 위치를 재고, 쪽 끝에 걸치는 덩어리 앞에 강제 쪽 나눔을 넣는다.
   덩어리를 놓는 순서:
   1) 앞의 제목·도입 문단, 그것을 감싼 상자까지 묶어 다음 쪽에 들어가면 묶음째 넘긴다.
   2) 묶음이 한 쪽을 10% 이내로 넘으면 덩어리를 살짝 줄여 맞춘다.
   3) 그래도 안 되면 덩어리 안쪽(표의 행, 칸의 내용)에서 나누되, 제목은 첫 부분과 같은 쪽에 둔다.
   - 한 쪽보다 긴 표는 행 단위로 나누고 다음 쪽 첫머리에 표 머리글을 다시 단다. 다음 쪽에도 최소 3행, 출처 줄은 마지막 행들과 함께.
   - 덩어리 뒤에 닫히는 부모 상자의 아래 여백과, 넘긴 덩어리 위에 겹쳐 붙는 첫 자식의 위 여백까지 계산에 넣는다.
   반환값의 pages는 예상 쪽수다. 실제 PDF 쪽수와 맞으면 계산대로 나뉜 것이다. */
function paginate(opt) {
  const H = opt.pageH - opt.safety;
  const HEADS = "h1,h2,h3,h4,h5,summary,.lane-head,.cycle-head,.block-head,.board-head,.chart-head,.detail-head,.df-head,.sec-head,.sc-head,.fig-h,.case-top,.eyebrow,.kicker,.pdf-tab-title";
  const CAPTIONS = ".fig-s,figcaption,.fig-note,.src-line,.site-foot";
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, h: r.height }; };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed" && el.getBoundingClientRect().height > 0;
  };
  const kidsOf = (el) => {
    const out = [];
    for (const k of el.children) {
      if (getComputedStyle(k).display === "contents") out.push(...kidsOf(k));
      else if (shown(k)) out.push(k);
    }
    return out;
  };
  /* 강제 나눔 뒤에도 남는 위 여백: 자기 margin과, 테두리·안쪽 여백 없이 겹쳐 올라온 첫 자식의 margin 중 큰 값 */
  const effMt = (el) => {
    const cs = getComputedStyle(el);
    let m = parseFloat(cs.marginTop) || 0;
    if (/^(block|list-item)$/.test(cs.display) && !parseFloat(cs.paddingTop) && !parseFloat(cs.borderTopWidth) && cs.overflow === "visible" && cs.float === "none") {
      const k = kidsOf(el)[0];
      if (k && Math.abs(box(k).top - box(el).top) < 0.5) m = Math.max(m, effMt(k));
    }
    return m;
  };
  const mtop = (el) => box(el).top - effMt(el);
  /* el 바로 뒤에서 쪽이 끝날 때 내용이 끝나는 위치: el로 끝나는 바깥 상자들의 테두리 아래까지 */
  const closeBottom = (el) => {
    let e = el, b = box(el).bottom;
    for (let par = e.parentElement; par && par !== document.body; par = e.parentElement) {
      const ks = kidsOf(par);
      if (ks[ks.length - 1] !== e) break;
      e = par; b = Math.max(b, box(par).bottom);
    }
    return b;
  };
  const inZoom = (el) => { for (let a = el.parentElement; a; a = a.parentElement) if (a.style.zoom) return true; return false; };
  const prevOf = (el) => { let p = el.previousElementSibling; while (p && !shown(p)) p = p.previousElementSibling; return p; };
  /* 제목 묶음: 제목 요소, 제목을 품은 낮은 머리 상자(그림·표 없이) */
  const headBlock = (el) => {
    if (el.matches(HEADS) || el.style.breakAfter === "avoid") return true;
    const h = box(el).h;
    return h <= 160 && !!el.querySelector("h1,h2,h3,h4,h5") && !el.querySelector("table,canvas,svg,img,ul,ol");
  };
  const keepNext = (el) => {
    if (headBlock(el)) return true;
    const p = prevOf(el);
    if (!p || !headBlock(p)) return false;
    /* 제목 바로 아래의 짧은 도입 문단과 작은 요소(버튼 줄·범례)도 뒤 내용과 함께 넘긴다 */
    const h = box(el).h;
    return (h <= 110 && (el.tagName === "P" || /lead|intro|dek|desc/.test(el.className))) || h <= 70;
  };
  const inlineOnly = (el) => kidsOf(el).every((k) => /^inline/.test(getComputedStyle(k).display));
  const atomic = (el) => box(el).h <= H && (el.style.breakInside === "avoid" || inlineOnly(el));
  const blockish = (el) => /^(block|flex|grid|table|list-item|flow-root|table-row)$/.test(getComputedStyle(el).display) || /^(LI|TR)$/.test(el.tagName);
  const sideBySide = (el) => {
    const cs = getComputedStyle(el);
    if (!/grid|flex/.test(cs.display)) return false;
    const rs = kidsOf(el).map((k) => k.getBoundingClientRect());
    return rs.some((a, i) => rs.some((b, j) => j > i && a.top < b.bottom - 1 && b.top < a.bottom - 1 && (a.right <= b.left + 1 || b.right <= a.left + 1)));
  };
  let pageTop = 0, pages = 1, pageContent = 0;
  const forced = [];
  const descending = new Set();
  /* 이번 쪽에 제목이 아닌 내용이 놓였는지 센다. 제목만 있는 쪽에서 또 나누면 제목이 홀로 남는다 */
  const placed = (el) => { if (!keepNext(el)) pageContent++; };
  const force = (el) => {
    while (!blockish(el) && el.parentElement && el.parentElement !== document.body) el = el.parentElement;
    if (mtop(el) <= pageTop + 1) return;
    el.style.breakBefore = "page"; pageTop = mtop(el); pages++; pageContent = 0;
    forced.push({ page: pages, top: Math.round(pageTop), text: (el.innerText || el.textContent || "").replace(/[^가-힣0-9]/g, "").slice(0, 8), el: el.tagName + "." + String(el.className || "").split(" ")[0] });
  };
  /* 함께 넘길 묶음의 맨 위: 바로 앞 제목·도입 문단, 첫 자식이면 감싼 상자(이번 쪽에서 시작할 때) */
  const chainStart = (el, limit) => {
    let b = el;
    for (;;) {
      const prev = prevOf(b);
      if (prev && keepNext(prev) && mtop(prev) > pageTop + 1 && (limit === undefined || limit - mtop(prev) <= H)) { b = prev; continue; }
      const par = b.parentElement;
      if (!prev && par && par !== document.body && !descending.has(par) && mtop(par) > pageTop + 1 && !sideBySide(par) && (limit === undefined || limit - mtop(par) <= H)) { b = par; continue; }
      return b;
    }
  };
  /* x가 이미 이번 쪽의 첫 내용인가(자신이나 첫 자식으로 이어진 조상이 쪽 맨 위에서 시작) */
  const atPageStart = (x) => {
    for (let e = x; e && e !== document.body; e = e.parentElement) {
      if (mtop(e) <= pageTop + 1) return true;
      const par = e.parentElement;
      if (!par || kidsOf(par)[0] !== e) return false;
    }
    return false;
  };
  /* 살짝 줄여 맞춘다. 누적 배율이 floor 아래로는 줄이지 않고, 줄였는데도 안 줄면(폭에 맞춰 커지는 그림) 되돌린다 */
  const tryZoom = (el, over, floor = 0.9) => {
    if (over <= 0 || inZoom(el)) return false;
    const before = el.style.zoom, target = box(el).h - over - 3;
    let z = parseFloat(before) || 1, hh = box(el).h;
    for (let k = 0; k < 5 && hh > target + 1; k++) {
      z = (z * target) / hh;
      if (z < floor) break;
      el.style.zoom = z.toFixed(4);
      hh = box(el).h;
    }
    if (hh > target + 1) { el.style.zoom = before; return false; }
    return true;
  };
  /* 잘리면 안 되는 덩어리 놓기. endFn: 덩어리가 끝나는 위치(닫히는 상자 포함), split(onlyIfFirstFits): 안쪽에서 나누기 */
  const place = (el, endFn, split, noZoom) => {
    if (endFn() - pageTop <= H) { placed(el); return; }
    const full = chainStart(el);
    /* 쪽 맨 위이거나, 앞에 제목만 있으면 여기서 해결한다(넘기면 제목만 남는다) */
    const here = atPageStart(full) || pageContent === 0;
    if (!here) {
      if (endFn() - mtop(full) <= H) { force(full); placed(el); return; }
      /* 제목과 같은 쪽에 두려는 경우에는 조금 더(0.84배까지) 줄인다 */
      if (!noZoom && tryZoom(el, endFn() - mtop(full) - H, full !== el ? 0.84 : 0.9)) { place(el, endFn, split, noZoom); return; }
      if (split && split(true)) return;
      force(full);
    }
    const over = endFn() - pageTop - H;
    if (over <= 0) { placed(el); return; }
    if (!noZoom && tryZoom(el, over, pageContent === 0 && !atPageStart(el) ? 0.84 : 0.9)) { place(el, endFn, split, noZoom); return; }
    if (split && split(false)) return;
    /* 나눌 수 없는 덩어리: 혼자서는 한 쪽에 들어가면 새 쪽으로 */
    if (endFn() - mtop(full) <= H) force(full);
    placed(el);
  };
  const PROPS = ["color", "backgroundColor", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "textAlign", "verticalAlign",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderTopStyle", "borderTopColor", "borderBottomWidth",
    "borderBottomStyle", "borderBottomColor", "borderLeftWidth", "borderLeftStyle", "borderLeftColor", "borderRightWidth", "borderRightStyle",
    "borderRightColor", "textTransform", "whiteSpace", "lineHeight", "fontVariantNumeric"];
  const reHead = (table, row) => {
    const head = table.tHead ? Array.from(table.tHead.rows).filter(shown) : [];
    let first = null;
    for (const hr of head) {
      const c = hr.cloneNode(true);
      c.removeAttribute("id");
      c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      c.classList.add("pdf-rehead");
      c.style.backgroundColor = getComputedStyle(hr).backgroundColor;
      Array.from(hr.cells).forEach((cell, i) => { const cs = getComputedStyle(cell); for (const p of PROPS) c.cells[i].style[p] = cs[p]; });
      row.parentNode.insertBefore(c, row);
      if (!first) first = c;
    }
    return first || row;
  };
  const bodyRows = (table) => Array.from(table.rows).filter((r) => r.parentNode !== table.tHead && shown(r));
  const labelRow = (tr) => tr.cells.length === 1 || Array.from(tr.cells).slice(1).every((c) => !c.textContent.trim());
  /* 출처 줄이 넘어갈 때 함께 넘길 마지막 덩어리: 표면 마지막 3행(소제목 행이면 그 위부터), 아니면 마지막 덩어리 */
  const lastUnit = (el) => {
    for (let e = el; e;) {
      if (e.tagName === "TABLE") {
        const rows = bodyRows(e), j = Math.max(3, rows.length - 3);
        if (rows.length < 6) return null;
        return { table: e, row: labelRow(rows[j - 1]) ? rows[j - 1] : rows[j] };
      }
      if (atomic(e)) return { el: e };
      const ks = kidsOf(e);
      if (!ks.length || sideBySide(e)) return null;
      e = ks[ks.length - 1];
    }
    return null;
  };
  /* 안에서 나눌 수 있는 덩어리: 6행 이상인 표, 블록 자식이 둘 이상인 상자 */
  /* 자식이 하나뿐인 감싸개(스크롤 상자 등)는 안쪽을 본다 */
  const only = (el) => { if (el.tagName === "TABLE" || inlineOnly(el)) return null; const ks = kidsOf(el); return ks.length === 1 ? ks[0] : null; };
  const decomposable = (el) => {
    const k = only(el);
    if (k) return decomposable(k);
    return el.tagName === "TABLE" ? bodyRows(el).length >= 6 : !inlineOnly(el) && kidsOf(el).length >= 2;
  };
  const firstFits = (el) => {
    const k1 = only(el);
    if (k1) return firstFits(k1);
    if (el.tagName === "TABLE") { const r = bodyRows(el)[2]; return !!r && box(r).bottom - pageTop <= H; }
    const k = kidsOf(el)[0];
    if (!k) return false;
    if (box(k).bottom - pageTop <= H) return true;
    return decomposable(k) && firstFits(k);
  };
  const inside = (el, ...also) => {
    [el, ...also].forEach((x) => descending.add(x));
    const k = only(el);
    if (k) inside(k);
    else if (el.tagName === "TABLE") visitTable(el);
    else if (sideBySide(el)) visitRows(el);
    else kidsOf(el).forEach(visit);
    [el, ...also].forEach((x) => descending.delete(x));
  };
  /* 덩어리를 안에서 나누는 방법: 나란한 단이면 가장 긴 칸 안에서(다른 칸이 이번 쪽에 다 들어갈 때), 아니면 자식·행 단위로 */
  const splitter = (el) => (onlyIfFirstFits) => {
    if (descending.has(el)) return false;
    if (sideBySide(el)) {
      const items = kidsOf(el);
      const tall = items.reduce((a, k) => (box(k).h > box(a).h ? k : a));
      const othersFit = items.every((k) => k === tall || box(k).bottom - pageTop <= H);
      if (!othersFit || !decomposable(tall) || (onlyIfFirstFits && !firstFits(tall))) return false;
      inside(tall, el);
      return true;
    }
    if (!decomposable(el) || (onlyIfFirstFits && !firstFits(el))) return false;
    inside(el);
    return true;
  };
  const visitTable = (table) => {
    const rows = bodyRows(table);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const end = i === rows.length - 1 ? closeBottom(row) : box(row).bottom;
      if (end - pageTop <= H) { pageContent++; continue; }
      if (i < 3) { // 첫 몇 행만 남기지 않는다: 제목과 함께 표째 넘긴다
        const r = row;
        place(table, () => (r === rows[rows.length - 1] ? closeBottom(r) : box(r).bottom), null, true);
        continue;
      }
      let j = i;
      if (rows.length - j < 3) j = Math.max(3, rows.length - 3); // 다음 쪽에도 최소 3행
      if (labelRow(rows[j - 1]) && box(rows[j - 1]).top > pageTop + 1) j -= 1; // 소제목 행은 아래 행과 함께
      force(reHead(table, rows[j]));
    }
  };
  const visitRows = (el) => {
    const kids = kidsOf(el);
    const last = kids[kids.length - 1];
    const rows = [];
    /* 세로로 겹치는 칸끼리 한 줄로 묶는다 */
    for (const k of kids.slice().sort((a, b) => box(a).top - box(b).top)) {
      const kb = box(k);
      const row = rows.find((r) => kb.top < r.bottom - 1 && r.top < kb.bottom - 1);
      if (row) { row.items.push(k); row.bottom = Math.max(row.bottom, kb.bottom); } else rows.push({ top: kb.top, bottom: kb.bottom, items: [k] });
    }
    rows.sort((a, b) => a.top - b.top);
    rows.forEach((row, i) => {
      const endFn = () => Math.max(...row.items.map((k) => (k === last ? closeBottom(k) : box(k).bottom)));
      if (endFn() - pageTop <= H) { pageContent++; return; }
      const tall = row.items.reduce((a, k) => (box(k).h > box(a).h ? k : a));
      const splitRow = (onlyIfFirstFits) => {
        const othersFit = row.items.every((k) => k === tall || box(k).bottom - pageTop <= H);
        if (!othersFit || !decomposable(tall) || (onlyIfFirstFits && !firstFits(tall))) return false;
        inside(tall);
        return true;
      };
      if (i === 0) { place(el, endFn, splitRow, true); return; }
      const top = Math.min(...row.items.map(mtop));
      if (endFn() - top <= H) { force(row.items[0]); return; }
      force(row.items[0]);
      splitRow(false);
    });
  };
  const visit = (el) => {
    const end = closeBottom(el);
    if (end - pageTop <= H) { placed(el); return; }
    if (atomic(el) || (el.matches(CAPTIONS) && box(el).h <= H)) {
      if (el.matches(CAPTIONS) && prevOf(el) && pageContent > 0) {
        const u = lastUnit(prevOf(el));
        const target = u && (u.el || u.row);
        if (target && mtop(target) > pageTop + 1 && end - mtop(target) <= H) {
          force(u.table ? reHead(u.table, u.row) : chainStart(u.el, end));
          return;
        }
      }
      place(el, () => closeBottom(el), splitter(el));
      return;
    }
    if (el.tagName === "TABLE") { visitTable(el); return; }
    if (sideBySide(el)) { visitRows(el); return; }
    const kids = kidsOf(el);
    if (!kids.length || inlineOnly(el)) {
      while (box(el).bottom - pageTop > H) { pageTop += H; pages++; forced.push({ page: pages, top: Math.round(pageTop), text: "", natural: el.tagName + "." + el.className }); }
      pageContent++;
      return;
    }
    kids.forEach(visit);
  };
  visit(document.body);
  return { pages, forced };
}


/* 한 화면을 PDF로 찍기 직전 상태로 만든다: 탭·접힌 영역 펼치기, 링크 바꾸기, 인쇄용 스타일, 쪽 나눔 계획 */
async function prepare(page, file) {
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
  await page.goto("file://" + path.join(ROOT, file), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const panels = () => Array.from(document.querySelectorAll('[role="tabpanel"]'));
    /* 1) 모든 패널을 보이게 한 뒤, 안쪽 탭 목록부터 하나씩 눌러 보이는 상태에서 그린다 */
    panels().forEach((p) => { p.hidden = false; });
    const depth = (el) => { let d = 0; for (let a = el; a; a = a.parentElement) d++; return d; };
    const lists = Array.from(document.querySelectorAll('[role="tablist"]')).sort((a, b) => depth(b) - depth(a));
    for (const list of lists) {
      for (const tab of Array.from(list.querySelectorAll('[role="tab"]'))) { tab.click(); await sleep(260); }
    }
    /* 2) 모두 펼치고 탭 이름을 소제목으로 단다. 탭 버튼 줄은 감춘다 */
    for (const list of lists) {
      for (const tab of Array.from(list.querySelectorAll('[role="tab"]'))) {
        const p = document.getElementById(tab.getAttribute("aria-controls"));
        if (!p) continue;
        p.hidden = false;
        const h = document.createElement("div");
        h.className = "pdf-tab-title";
        h.textContent = tab.textContent.trim();
        p.parentNode.insertBefore(h, p);
      }
      list.classList.add("pdf-hide");
    }
    document.querySelectorAll("details").forEach((d) => { d.open = true; });
  });
  /* PDF 안의 링크가 내 컴퓨터 경로가 아니라 공개 사이트를 열도록 바꾼다 */
  await page.evaluate((base) => {
    document.querySelectorAll("a[href]").forEach((a) => {
      const h = a.getAttribute("href");
      if (!h || h.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(h)) return;
      a.setAttribute("href", new URL(h, base).href);
    });
  }, "https://" + SITE + file);
  await page.addStyleTag({ content: PRINT_CSS });
  await page.waitForTimeout(400);
  await page.evaluate(keepTogether, PAGE_H);
  return page.evaluate(paginate, { pageH: PAGE_H, safety: 8 });
}

const pdfOptions = (file, title, target) => {
  const font = "font-family: 'WenQuanYi Zen Hei', sans-serif; font-size: 8px; color: #8A939B; width: 100%; padding: 0 10mm; display: flex; justify-content: space-between;";
  return {
    path: target, format: "A4", landscape: true, printBackground: true, scale: SCALE,
    margin: { top: MARGIN.top + "mm", bottom: MARGIN.bottom + "mm", left: MARGIN.left + "mm", right: MARGIN.right + "mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="${font}"><span>이기표 · 재무기획 포트폴리오</span><span>${title}</span></div>`,
    footerTemplate: `<div style="${font}"><span>${SITE}${file === "index.html" ? "" : file}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
  };
};

const newContext = (browser) => browser.newContext({ viewport: { width: VIEW_W, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light" });

/* --pick: 지원서에 붙일 대표 화면만 골라 표지·목차와 함께 묶는다 */
const PICK = ["index.html", "tools/sectors.html", "tools/ma-case.html", "tools/holdco-nav.html"];
/* 선별본에서는 지주사 도구를 ㈜LG 공시값으로 연다 */
const PICK_URL = { "tools/holdco-nav.html": ["tools/holdco-nav.html?preset=lg", "지주사 포트폴리오 가치 (㈜LG 공시값)"] };

async function main() {
  const args = process.argv.slice(2), pick = args.includes("--pick"), rest = args.filter((a) => !a.startsWith("--"));
  const out = path.resolve(rest[0] || path.join(ROOT, "pdf"));
  const only = pick ? PICK : rest.slice(1);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await newContext(browser);
  const results = [];
  for (const [file0, name, title0] of PAGES) {
    if (only.length && !only.some((o) => file0 === o || (!pick && file0.includes(o)))) continue;
    const alt = pick && PICK_URL[file0], file = alt ? alt[0] : file0, title = alt ? alt[1] : title0;
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const plan = await prepare(page, file);
    await page.pdf(pdfOptions(file, title, path.join(out, name + ".pdf")));
    results.push({ file, name, title, errors, plan });
    console.log(name, "예상 " + plan.pages + "쪽, 강제 나눔 " + plan.forced.length, errors.length ? "ERR " + errors.join(" | ") : "");
    await page.close();
  }
  fs.writeFileSync(path.join(out, "pages.json"), JSON.stringify(results, null, 1));
  const merge = pick || !only.length;
  if (merge) await frontMatter(ctx, out, results, pick);
  await browser.close();
  if (merge) {
    const r = spawnSync("python3", [path.join(__dirname, "merge-pdf.py"), out].concat(pick ? ["이기표_포트폴리오_대표선별.pdf"] : []), { encoding: "utf8" });
    console.log(r.status === 0 ? r.stdout.trim() : "합본은 건너뜀(python3 + pypdf 필요): " + (r.stderr || "").trim().split("\n").pop());
  }
}

/* 합본 앞에 붙일 표지와 목차. 쪽 번호는 실제 PDF 쪽수(pdfinfo)로 센다 */
async function frontMatter(ctx, out, results, pick) {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let start = 3;
  for (const r of results) {
    const info = spawnSync("pdfinfo", [path.join(out, r.name + ".pdf")], { encoding: "utf8" }).stdout || "";
    r.pages = +((info.match(/Pages:\s+(\d+)/) || [])[1] || r.plan.pages);
    r.start = start; start += r.pages;
  }
  const kind = (n) => (n === "01" ? "소개" : ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].includes(n) ? "리포트" : ["28", "29", "30"].includes(n) ? "참고" : "도구");
  const rows = results.map((r) => `<tr><td class="no">${r.name.slice(0, 2)}</td><td class="k">${kind(r.name.slice(0, 2))}</td><td class="t">${esc(r.title)}</td><td class="u">${esc(r.file)}</td><td class="p">${r.start}</td><td class="c">${r.pages}쪽</td></tr>`).join("");
  const today = new Date();
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } body { margin: 0; font-family: 'WenQuanYi Zen Hei', sans-serif; color: #12161A; }
    .page { width: 297mm; height: 210mm; padding: 22mm 24mm; position: relative; break-after: page; }
    .cover { background: #0B1118; color: #E8EDF1; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
    .brand b { background: #E8EDF1; color: #0B1118; border-radius: 4px; padding: 2px 6px; font-size: 13px; }
    .kick { margin-top: 34mm; font-size: 13px; letter-spacing: .12em; color: #E07A3F; }
    h1 { font-size: 46px; line-height: 1.18; margin: 10px 0 18px; letter-spacing: -0.02em; }
    .cover p { font-size: 15px; line-height: 1.7; color: #B5BEC6; max-width: 150mm; margin: 0; }
    .meta { position: absolute; left: 24mm; right: 24mm; bottom: 20mm; display: flex; justify-content: space-between; font-size: 12.5px; color: #8A939B; border-top: 1px solid #28323B; padding-top: 10px; }
    h2 { font-size: 24px; margin: 0 0 6px; } .sub { font-size: 12.5px; color: #5C666F; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; } td { padding: 6.2px 8px; border-bottom: 1px solid #E2E5E2; }
    td.no { color: #B5541C; width: 34px; } td.k { color: #5C666F; width: 64px; } td.t { font-weight: 700; } td.u { color: #8A939B; font-size: 11.5px; }
    td.p, td.c { text-align: right; width: 54px; } td.c { color: #5C666F; }
    .note { position: absolute; left: 24mm; right: 24mm; bottom: 14mm; font-size: 11px; color: #8A939B; line-height: 1.6; }
  </style></head><body>
  <section class="page cover"><div class="brand"><b>LGP</b> 이기표</div><div class="kick">PORTFOLIO · ${pick ? "대표 화면 선별본" : "화면 PDF 모음"}</div>
    <h1>복잡한 사업을 재무로 읽고,<br>투자까지 잇는 기획자</h1>
    <p>${pick
      ? "포트폴리오 사이트에서 대표 화면 " + results.length + "개만 골랐습니다. 소개, 7개사 공시를 원문 쪽수와 함께 검산한 업종별 재무제표 리포트, HD현대중공업·미포 합병 사례, ㈜LG 공시값을 넣은 지주사 가치 도구입니다. 나머지 리포트와 도구는 사이트에서 볼 수 있습니다. " + (start - 1) + "쪽."
      : "포트폴리오 사이트의 모든 화면을 기본값 그대로 담았습니다. 분석 리포트 6편, 실무 도구 10개, 계산 검산과 쉬운 가이드, 영문 요약까지 " + results.length + "개 화면, " + (start - 1) + "쪽입니다."}</p>
    <div class="meta"><span>${SITE.replace(/\/$/, "")}</span><span>${today.getFullYear()}년 ${today.getMonth() + 1}월 · A4 가로</span></div></section>
  <section class="page toc"><h2>목차</h2><p class="sub">쪽 번호는 이 합본 기준입니다. 각 화면의 쪽 아래 번호는 그 화면 안에서의 쪽 번호입니다.</p>
    <table>${rows}</table>
    <div class="note">모든 수치는 화면의 기본 예시값입니다. 도구의 예시 수치는 모두 가상이고, 기업 분석은 공개 공시만 썼으며 회사 내부 자료는 쓰지 않았습니다. 접힌 영역과 탭은 모두 펼쳐 실었고, 카드·그래프·표의 행이 쪽 사이에서 잘리지 않게 배치했습니다.</div></section>
  </body></html>`;
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1123, height: 794 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const rects = await page.evaluate(() => {
    const toc = document.querySelector(".toc"), t = toc.getBoundingClientRect().top;
    return Array.from(toc.querySelectorAll("tr")).map((r) => { const q = r.getBoundingClientRect(); return [q.left, q.top - t, q.right, q.bottom - t]; });
  });
  await page.pdf({ path: path.join(out, "_front.pdf"), width: "297mm", height: "210mm", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await page.close();
  fs.writeFileSync(path.join(out, "_front.json"), JSON.stringify({ rects, docs: results.map((r) => ({ name: r.name, title: r.title, start: r.start, pages: r.pages })) }, null, 1));
}

module.exports = { PAGES, PRINT_CSS, keepTogether, paginate, prepare, pdfOptions, newContext, VIEW_W, PAGE_H, SCALE };
if (require.main === module) main();

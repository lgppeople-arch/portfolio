/* 페이지별 링크 미리보기 이미지(1200×630) 만들기: scripts/og.html → assets/og/<이름>.png
   실행: node scripts/make-og.js   (Playwright 필요)
   - 제목은 각 페이지의 h1(리포트는 표지 제목), 설명은 meta description을 그대로 쓴다
   - 만든 뒤 각 HTML의 og:image, twitter:image를 새 이미지로 바꾼다 */
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const root = path.resolve(__dirname, "..");
const BASE = "https://lgppeople-arch.github.io/portfolio/";

const FPA = "Practical tool · FP&A", INV = "Practical tool · Investment & M&A";
const PAGES = [
  ["index.html", "home", { kick: "FP&A · Corporate Finance · M&A", title: "복잡한 사업을 재무로 읽고,<br><em>정량적 가치평가와 실무 도구</em>로<br>투자 의사결정을 돕는 기획자", label: "반도체 부품 · 건설소재 제조업 재무기획 6년", wide: true, size: 62, noDesc: true }],
  ["en.html", "en", { kick: "FP&A · Corporate Finance · M&A", title: "Reading complex businesses<br>through finance, with <em>quantitative<br>valuation and practical tools</em>", label: "Financial planning portfolio · English summary", wide: true, size: 58, noDesc: true }],
  ["tools/index.html", "hub", { kick: "Index", label: "도구 · 리포트 · 노트 모음" }],
  ["tools/guide.html", "guide", { kick: "Easy guide", label: "참고" }],
  ["tools/checks.html", "checks", { kick: "Verification", label: "참고" }],
  ["tools/kpi-tree.html", "kpi-tree", { kick: FPA, label: "실무 도구" }],
  ["tools/plan-risk.html", "plan-risk", { kick: FPA, label: "실무 도구" }],
  ["tools/budget-opt.html", "budget-opt", { kick: FPA, label: "실무 도구" }],
  ["tools/pl-report.html", "pl-report", { kick: FPA, label: "실무 도구" }],
  ["tools/mgmt-kit.html", "mgmt-kit", { kick: FPA, label: "실무 도구" }],
  ["tools/cost-stats.html", "cost-stats", { kick: FPA, label: "실무 도구" }],
  ["tools/mbo-kpi.html", "mbo-kpi", { kick: FPA, label: "실무 도구" }],
  ["tools/cash-13w.html", "cash-13w", { kick: FPA, label: "실무 도구" }],
  ["tools/capital.html", "capital", { kick: FPA, label: "실무 도구" }],
  ["tools/doa.html", "doa", { kick: FPA, label: "실무 도구" }],
  ["tools/capex-kit.html", "capex-kit", { kick: INV, label: "실무 도구" }],
  ["tools/post-review.html", "post-review", { kick: INV, label: "실무 도구" }],
  ["tools/ma-process.html", "ma-process", { kick: INV, label: "실무 도구" }],
  ["tools/ma-valuation.html", "ma-valuation", { kick: INV, label: "실무 도구" }],
  ["tools/holdco-nav.html", "holdco-nav", { kick: INV, label: "실무 도구" }],
  ["tools/fx-hedge.html", "fx-hedge", { kick: INV, label: "실무 도구" }],
  ["tools/fsa.html", "fsa", { label: "분석 리포트" }],
  ["tools/semi-cycle.html", "semi-cycle", { label: "분석 리포트" }],
  ["tools/samsung.html", "samsung", { label: "분석 리포트" }],
  ["tools/reading.html", "reading", { label: "분석 리포트" }],
  ["tools/sectors.html", "sectors", { label: "분석 리포트" }],
  ["tools/ma-case.html", "ma-case", { label: "분석 리포트" }],
  ["tools/deck.html", "deck", { label: "분석·보고 노트" }],
  ["tools/charts.html", "charts", { label: "분석·보고 노트" }],
  ["tools/sources.html", "sources", { label: "분석·보고 노트" }],
  ["tools/stats-notes.html", "stats-notes", { label: "분석·보고 노트" }],
  ["tools/pro-methods.html", "pro-methods", { label: "분석·보고 노트" }]
];
const unesc = (t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

(async () => {
  fs.mkdirSync(path.join(root, "assets", "og"), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto("file://" + path.join(root, "scripts", "og.html"), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  let seed = 11;
  for (const [file, name, o] of PAGES) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    const h1 = (src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
    const tag = (src.match(/class="rpt-tag">([^<]*)</) || [])[1];
    const desc = unesc((src.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "");
    const title = o.title || esc(unesc(h1.replace(/<(?!br\s*\/?>)[^>]+>/g, "")).trim()).replace(/&lt;br&gt;/g, "<br>");
    const d = { kick: o.kick || (tag ? unesc(tag) : ""), title: title, desc: o.noDesc ? "" : desc, label: o.label, wide: !!o.wide, size: o.size, seed: seed += 7 };
    await p.evaluate((x) => window.fill(x), d);
    await p.screenshot({ path: path.join(root, "assets", "og", name + ".png") });
    /* 페이지의 og:image를 새 이미지로 */
    const url = BASE + "assets/og/" + name + ".png";
    let s = src.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + url + '">');
    if (!/name="twitter:image"/.test(s)) s = s.replace(/(<meta name="twitter:card" content="summary_large_image">)/, '$1\n<meta name="twitter:image" content="' + url + '">');
    else s = s.replace(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + url + '">');
    const alt = '<meta property="og:image:alt" content="' + esc(unesc(title.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())) + '">';
    if (!/property="og:image:alt"/.test(s)) s = s.replace(/(<meta property="og:image:height" content="630">)/, '$1\n' + alt);
    else s = s.replace(/<meta property="og:image:alt" content="[^"]*">/, alt);
    if (s !== src) fs.writeFileSync(path.join(root, file), s);
    console.log("og", name);
  }
  await b.close();
})();

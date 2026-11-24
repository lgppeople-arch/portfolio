/* 포트폴리오 안내 PDF(한 장): scripts/intro.html → assets/docs/lee-gipyo-portfolio.pdf
   실행: node scripts/make-intro.js   (Playwright 필요)
   - 도구·리포트·노트 수는 tools/index.html의 build:counts에서, 검산 수는 assets/checks.js 실행 결과에서 읽는다.
   - 경력 기간과 작성 월은 실행한 날 기준. QR 코드는 assets/img/qr-portfolio.svg(사이트 주소). */
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs"), { execFileSync } = require("child_process");
(async () => {
  const root = path.resolve(__dirname, "..");
  const out = path.join(root, "assets", "docs", "lee-gipyo-portfolio.pdf");
  const hub = fs.readFileSync(path.join(root, "tools", "index.html"), "utf8");
  const cm = hub.match(/build:counts -->실무 도구 (\d+)개, 분석 리포트 (\d+)편, 분석·보고 노트 (\d+)편/);
  const ck = execFileSync("node", [path.join(root, "assets", "checks.js")], { encoding: "utf8" }).match(/(\d+) \/ (\d+) 통과/);
  if (!cm || !ck || ck[1] !== ck[2]) throw new Error("개수를 읽지 못했거나 검산이 모두 통과하지 않았습니다");
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.join(root, "scripts", "intro.html"), { waitUntil: "networkidle" });
  await p.evaluate((v) => {
    const now = new Date(), months = (now.getFullYear() - 2020) * 12 + (now.getMonth() + 1 - 6);
    document.getElementById("tenure").textContent = Math.floor(months / 12) + "년 " + (months % 12) + "개월";
    document.getElementById("asof").textContent = now.getFullYear() + "." + String(now.getMonth() + 1).padStart(2, "0");
    document.getElementById("made").textContent = now.getFullYear() + "년 " + (now.getMonth() + 1) + "월 작성";
    document.getElementById("n-tools").textContent = v.t; document.getElementById("n-reports").textContent = v.r;
    document.getElementById("n-notes").textContent = v.n; document.getElementById("n-checks").textContent = v.c;
  }, { t: cm[1], r: cm[2], n: cm[3], c: ck[1] });
  await p.evaluate(() => document.fonts.ready);
  const over = await p.evaluate(() => document.body.scrollHeight > document.body.clientHeight + 1);
  if (over) console.warn("주의: 내용이 한 장을 넘습니다");
  await p.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true, pageRanges: "1" });
  if (process.env.INTRO_PNG) { await p.setViewportSize({ width: 794, height: 1123 }); await p.screenshot({ path: process.env.INTRO_PNG }); }   // 미리보기가 필요할 때만(저장소 밖 경로)
  await b.close();
  console.log("wrote", path.relative(root, out), "도구", cm[1], "리포트", cm[2], "노트", cm[3], "검산", ck[1]);
})();

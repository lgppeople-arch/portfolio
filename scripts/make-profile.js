/* 경력 요약 PDF 만들기: scripts/profile.html → assets/docs/lee-gipyo-profile.pdf
   실행: node scripts/make-profile.js   (Playwright 필요. 경력 기간과 작성 월은 실행한 날 기준으로 채운다) */
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
(async () => {
  const root = path.resolve(__dirname, "..");
  const out = path.join(root, "assets", "docs", "lee-gipyo-profile.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.join(root, "scripts", "profile.html"), { waitUntil: "networkidle" });
  await p.evaluate(() => {
    const now = new Date(), months = (now.getFullYear() - 2020) * 12 + (now.getMonth() + 1 - 6);
    const ym = now.getFullYear() + "년 " + (now.getMonth() + 1) + "월";
    document.getElementById("tenure").textContent = Math.floor(months / 12) + "년 " + (months % 12) + "개월";
    document.getElementById("asof").textContent = ym;
    document.getElementById("made").textContent = ym + " 작성";
  });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log("wrote", path.relative(root, out));
})();

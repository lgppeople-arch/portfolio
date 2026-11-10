/* 화면 점검: 모든 페이지를 실제 브라우저로 열어 본다. Playwright 필요.
   실행: node scripts/qa.js            오류, 가로 넘침, 비어 있는 숫자 자리 (넓은 화면·휴대폰 × 밝은·어두운 화면)
         node scripts/qa.js --axe      접근성 자동 검사까지(axe-core 필요: npm i --no-save axe-core)
   실패가 있으면 종료 코드 1 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const files = ["index.html", "en.html"].concat(fs.readdirSync(path.join(root, "tools")).filter((f) => f.endsWith(".html")).sort().map((f) => "tools/" + f));
const withAxe = process.argv.includes("--axe");
let axeSrc = null;
if (withAxe) {
  try { axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"); }
  catch (e) { console.error("axe-core가 없습니다. 먼저: npm i --no-save axe-core"); process.exit(2); }
}

(async () => {
  const b = await chromium.launch();
  const bad = [], a11y = {};
  for (const w of [1360, 390]) for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("lgp.theme", t); } catch (e) { /* 저장 불가 */ } }, theme);
    for (const f of files) {
      const p = await ctx.newPage(), errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
      await p.goto("file://" + path.join(root, f));
      await p.waitForTimeout(800);
      const r = await p.evaluate(() => ({
        theme: document.documentElement.getAttribute("data-theme"),
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        /* 글 안에서 숫자가 들어가야 할 자리가 비어 있는지 */
        empty: Array.prototype.slice.call(document.querySelectorAll("p b[id], p span[id], li b[id], .callout b[id]"))
          .filter((e) => !e.textContent.trim() && !e.closest("[hidden]") && e.getAttribute("role") !== "status" && e.getClientRects().length).map((e) => e.id)
      }));
      const e = errs.filter((x) => !/fonts\.g|ERR_NAME|net::|Failed to load resource/.test(x));
      const tag = w + " " + theme + " " + f;
      if (r.theme !== theme) bad.push(tag + ": 테마가 적용되지 않음");
      if (r.over > 1) bad.push(tag + ": 가로 넘침 " + r.over + "px");
      if (r.empty.length) bad.push(tag + ": 빈 숫자 자리 " + r.empty.join(","));
      if (e.length) bad.push(tag + ": " + e.join(" | ").slice(0, 200));
      if (axeSrc && w === 1360) {
        await p.evaluate(() => document.querySelectorAll("[data-rv]").forEach((el) => el.classList.add("in")));
        await p.evaluate(axeSrc);
        const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } })).violations.map((x) => [x.id, x.impact, x.nodes.length, x.nodes[0].html.slice(0, 100)]));
        v.forEach((x) => { const k = x[0] + " [" + x[1] + "]"; a11y[k] = a11y[k] || []; a11y[k].push(theme + " " + f + " ×" + x[2] + "  " + x[3]); });
      }
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  console.log(bad.length ? bad.join("\n") : "화면 점검 통과: " + files.length + "개 페이지 × 4 (넓은 화면·휴대폰 × 밝은·어두운 화면)");
  if (withAxe) {
    const keys = Object.keys(a11y);
    if (!keys.length) console.log("접근성 자동 검사 통과: " + files.length + "개 페이지 × 2 (밝은·어두운 화면), 위반 0건");
    keys.forEach((k) => { console.log("\n접근성 " + k + " — " + a11y[k].length + "곳"); a11y[k].slice(0, 5).forEach((s) => console.log("  " + s)); });
    if (keys.length) process.exitCode = 1;
  }
  if (bad.length) process.exitCode = 1;
})();

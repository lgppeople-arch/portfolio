/* 사이트 점검: 계산 검산(assets/checks.js)이 '숫자가 맞는지'를 본다면, 이 스크립트는 '사이트가 서로 맞는지'를 본다.
   실행: node scripts/check-site.js   (실패가 있으면 종료 코드 1)
   1. 검색 노출 차단: 모든 페이지에 noindex, nofollow
   2. 기본 정보: 제목, 설명, 언어, 링크 미리보기 이미지 파일
   3. 링크: 사이트 안 링크와 #위치가 실제로 있는지
   4. 목록 일치: 사이트 지도 = tools/ = 미리보기 이미지 = PDF 내보내기 목록, 빌드 결과가 최신인지
   5. 홈에 적은 숫자 = 계산 엔진 결과, 홈·요약 PDF에 적은 개수 = 실제 개수 */
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const has = (f) => fs.existsSync(path.join(root, f));
const out = [];
const add = (group, name, ok, detail) => out.push({ group: group, name: name, ok: !!ok, detail: detail || "" });
const unesc = (t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

const MAP = JSON.parse(read("scripts/site-map.json"));
const toolFiles = fs.readdirSync(path.join(root, "tools")).filter((f) => f.endsWith(".html")).sort();
const pages = ["index.html", "en.html", "404.html"].concat(toolFiles.map((f) => "tools/" + f));
const src = {}; pages.forEach((p) => { src[p] = read(p); });

/* ---------- 1. 검색 노출 차단 ---------- */
const open = pages.filter((p) => !/<meta name="robots" content="noindex, nofollow">/.test(src[p]));
add("노출 차단", "모든 페이지(" + pages.length + "개)에 noindex, nofollow", open.length === 0, open.join(", "));
add("노출 차단", "sitemap.xml을 두지 않는다", !has("sitemap.xml"), "");

/* ---------- 2. 기본 정보 ---------- */
const BASE = "https://lgppeople-arch.github.io/portfolio/";
const noMeta = [], noOg = [], badUrl = [];
pages.forEach((p) => {
  const s = src[p];
  if (!/<title>[^<]+<\/title>/.test(s) || !/<html lang="(ko|en)"/.test(s)) noMeta.push(p);
  if (p === "404.html") return;
  if (!/<meta name="description" content="[^"]{20,}"/.test(s)) noMeta.push(p);
  const og = (s.match(/<meta property="og:image" content="([^"]+)"/) || [])[1], tw = (s.match(/<meta name="twitter:image" content="([^"]+)"/) || [])[1];
  if (!og || og !== tw || og.indexOf(BASE) !== 0 || !has(og.slice(BASE.length))) noOg.push(p);
  const url = (s.match(/<meta property="og:url" content="([^"]+)"/) || [])[1];
  if (url !== BASE + (p === "index.html" ? "" : p)) badUrl.push(p);
});
add("기본 정보", "제목·설명·언어 표시", noMeta.length === 0, noMeta.join(", "));
add("기본 정보", "링크 미리보기 이미지가 페이지마다 있고 파일이 실제로 있다", noOg.length === 0, noOg.join(", "));
add("기본 정보", "og:url이 실제 주소와 같다", badUrl.length === 0, badUrl.join(", "));

/* ---------- 3. 링크 ---------- */
const ids = {}; pages.forEach((p) => { ids[p] = new Set((src[p].match(/\sid="([^"]+)"/g) || []).map((m) => m.slice(5, -1))); });
/* 화면 코드가 탭으로 바꿔 여는 위치(정적 id가 아님) */
const JS_ANCHORS = { "tools/capex-kit.html": ["bep", "var"] };
const dead = [];
pages.forEach((p) => {
  if (p === "404.html") return; /* 404는 사이트 루트 기준 절대 경로를 쓴다 */
  (src[p].match(/href="([^"]+)"/g) || []).forEach((m) => {
    const h = unesc(m.slice(6, -1));
    if (/^(https?:|mailto:|javascript:|data:)/.test(h)) return;
    const parts = h.split("#"), file = parts[0].split("?")[0], frag = parts[1];
    let tgt = file ? path.posix.normalize(path.posix.join(path.posix.dirname(p), file)) : p;
    if (file.endsWith("/")) tgt = path.posix.join(tgt, "index.html");
    if (!has(tgt)) { dead.push(p + " → " + h); return; }
    if (frag && tgt.endsWith(".html") && ids[tgt] && !ids[tgt].has(frag) && !(JS_ANCHORS[tgt] || []).includes(frag)) dead.push(p + " → " + h);
  });
});
add("링크", "사이트 안 링크와 #위치가 모두 실제로 있다", dead.length === 0, dead.slice(0, 6).join(" | "));
const abs404 = (src["404.html"].match(/(?:href|src)="(\/portfolio\/[^"#?]*)/g) || []).map((m) => m.replace(/^(?:href|src)="\/portfolio\//, "")).filter((f) => f && !has(f.endsWith("/") ? f + "index.html" : f));
add("링크", "404 화면의 링크와 스타일 파일이 실제로 있다", abs404.length === 0, abs404.join(", "));

/* ---------- 4. 목록 일치 ---------- */
const b = spawnSync("python3", [path.join(__dirname, "build-site.py"), "--check"], { encoding: "utf8" });
add("목록 일치", "메뉴·모음·읽는 경로·하단 연결이 사이트 지도와 같다(build-site.py --check)", b.status === 0, (b.stdout || b.stderr || "").trim().slice(0, 160));
const mapFiles = MAP.pages.map((x) => x.file), inPath = [].concat.apply([], MAP.paths.map((x) => x.steps.map((s) => s[0])));
const noPath = MAP.pages.filter((x) => x.kind !== "참고" && !inPath.includes(x.file)).map((x) => x.file);
add("목록 일치", "도구·리포트·노트는 모두 읽는 경로 하나에 들어 있다", noPath.length === 0 && new Set(inPath).size === inPath.length, noPath.join(", "));
const og = read("scripts/make-og.js"), pdf = read("scripts/export-pdf.js");
const noOgList = pages.filter((p) => p !== "404.html" && og.indexOf('["' + p + '"') < 0);
add("목록 일치", "미리보기 이미지 생성 목록에 모든 페이지가 있다", noOgList.length === 0, noOgList.join(", "));
const noPdf = pages.filter((p) => p !== "404.html" && p !== "tools/index.html" && pdf.indexOf('["' + p + '"') < 0);
add("목록 일치", "PDF 내보내기 목록에 모든 페이지가 있다(모음 제외)", noPdf.length === 0, noPdf.join(", "));
const stale = MAP.pages.filter((x) => (x.more || []).some((m) => !has("tools/" + m[0].split("#")[0].split("?")[0]))).map((x) => x.file);
add("목록 일치", "사이트 지도의 '함께 보면 좋은 것'이 가리키는 파일이 있다", stale.length === 0, stale.join(", "));

/* ---------- 5. 적어 둔 숫자 ---------- */
const E = (n) => require(path.join(root, "assets", "engines", n + ".js"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const home = src["index.html"];
const card = (text) => home.indexOf('<span class="qx">' + text + "</span>") >= 0;
const f = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v) => Math.round(v * 100);
(function () {
  const PR = E("planrisk"), BU = E("budget"), CO = E("costs"), CA = E("capital"), CM = E("capexmc"), CS = E("cash"), MB = E("mbo"), PL = E("pl");
  const s = PR.simulate(clone(PR.DEFAULTS));
  let t = "달성 확률 " + pct(s.pAch) + "% · 하위 5% " + f(s.p5, 0) + "억";
  add("홈 숫자", "사업계획 카드 = 엔진", card(t), t);
  const a = BU.analyze(clone(BU.DEFAULTS));
  t = "일률 삭감 대비 +" + f(a.opt.value - a.proRata.value, 1) + "억 · 1억 추가 시 +" + f(a.shadowUp, 2) + "억";
  add("홈 숫자", "예산 카드 = 엔진", card(t), t);
  const pb = PL.planBias(PL.sample(), "전사", 9, "rev");
  t = "계획 편향 p = " + pb.p.toFixed(3);
  add("홈 숫자", "월 손익 카드 = 엔진", card(t), t);
  const m = CO.costModel(CO.sample());
  t = "손익분기 " + f(m.bepPre, 1) + " → " + f(m.bep, 1) + "만 개";
  add("홈 숫자", "원가 카드 = 엔진", card(t), t);
  const x = clone(MB.DEFAULTS), d = MB.distribution(MB.sampleTeams(), x.grades, x.pool);
  t = "보정 시 " + d.changed + "개 팀 등급 변경";
  add("홈 숫자", "성과평가 카드 = 엔진", card(t), t);
  const c = CS.simulate(clone(CS.DEFAULTS));
  t = "한도 필요 " + pct(c.need.p) + "% · 지급불능 " + pct(c.insolv.p) + "%";
  add("홈 숫자", "자금 카드 = 엔진", card(t), t);
  const ca = CA.analyze(clone(CA.DEFAULTS));
  t = "목표 범위 " + f(ca.tradeoff.opt.D, 0) + "~" + f(ca.capacity.cap, 0) + "억";
  add("홈 숫자", "부채 카드 = 엔진", card(t), t);
  const cm = CM.simulate(clone(CM.P0));
  t = "옵션가치 +" + f(cm.option, 0) + "억 · 손실 확률 " + pct(cm.full.pLoss) + " → " + pct(cm.staged.pLoss) + "%";
  add("홈 숫자", "투자 카드 = 엔진", card(t), t);
})();
(function () {
  const env = { Fin: require(path.join(root, "assets", "fin.js")), Stats: require(path.join(root, "assets", "stats.js")), Sectors: require(path.join(root, "assets", "data", "sectors.js")) };
  const res = require(path.join(root, "assets", "checks.js")).run(env), n = res.filter((r) => r.group === "업종별 공시").length;
  add("홈 숫자", "업종별 리포트 카드의 검산 개수 = 실제", home.indexOf("검산 " + n + "개 통과") >= 0, n + "개");
  const st = src["tools/stats-notes.html"], tech = (st.match(/<p class="qline">/g) || []).length, figs = (st.match(/<div class="fig" data-rv/g) || []).length;
  add("홈 숫자", "통계 노트 카드의 기법·도표 수 = 실제", home.indexOf("기법 " + tech + "가지 · 도표 " + figs + "개") >= 0 && st.indexOf("<b>" + tech + "가지</b>") >= 0, tech + "가지 · " + figs + "개");
  const k = (kind) => MAP.pages.filter((p) => p.kind === kind).length;
  const line = "도구 " + k("도구") + "개, 리포트 " + k("리포트") + "편, 노트 " + k("노트") + "편";
  add("홈 숫자", "경력 요약 PDF 원본의 개수 문구 = 사이트 지도", read("scripts/profile.html").indexOf(line) >= 0, line);
  const so = src["tools/sources.html"], gi = so.indexOf("const G = {"), bi = so.indexOf("const BOOKS = ["), be = so.indexOf("];", bi);
  const rows = (so.slice(gi, bi).match(/^      \["/gm) || []).length, std = (so.slice(so.indexOf('"g-std": ['), bi).match(/^      \["/gm) || []).length, books = (so.slice(bi, be).match(/^    \["/gm) || []).length, ins = (so.match(/<article class="ins"/g) || []).length;
  const want = "출처 " + (rows - std) + "곳 · 서적 " + books + "권 · 인사이트 " + ins + "가지";
  add("홈 숫자", "출처 노트 카드의 출처·서적·인사이트 수 = 실제", home.indexOf(want) >= 0 && so.indexOf("인사이트<b>" + ins + "가지") >= 0, want);
  const insIds = (so.match(/<article class="ins" id="([^"]+)"/g) || []).map((m) => m.match(/id="([^"]+)"/)[1]);
  const back = insIds.filter((id) => !pages.some((p) => p !== "tools/sources.html" && src[p].indexOf("sources.html#" + id) >= 0));
  add("홈 숫자", "인사이트 카드마다 그것을 반영한 페이지가 거꾸로 링크한다", back.length === 0, back.join(", "));
  add("홈 숫자", "경력 요약 PDF 파일이 있다", has("assets/docs/lee-gipyo-profile.pdf"), "");
})();

out.forEach((r) => console.log((r.ok ? "PASS" : "FAIL") + "  [" + r.group + "] " + r.name + (r.detail ? "  — " + r.detail : "")));
const bad = out.filter((r) => !r.ok).length;
console.log("\n" + (out.length - bad) + " / " + out.length + " 통과");
process.exitCode = bad ? 1 : 0;

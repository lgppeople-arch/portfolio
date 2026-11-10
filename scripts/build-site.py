"""사이트 지도(scripts/site-map.json) 하나에서 여러 페이지에 흩어진 목록을 다시 만든다.
실행: python3 scripts/build-site.py        (--check 를 붙이면 고치지 않고, 고칠 것이 있으면 1로 끝난다)

만드는 것
  1. tools/*.html 상단 메뉴(리포트·도구 드롭다운, 현재 페이지 표시)
  2. tools/index.html 도구·리포트 모음: 카드, 개수 문구, 읽는 경로
  3. tools/*.html 하단 '이어서 볼 것': 읽는 경로의 이전·다음, 제 경력과의 연결, 함께 보면 좋은 것, 만든 사람
  4. 404.html 의 비슷한 주소 제안 목록
카드 설명은 각 페이지의 meta description을 그대로 쓴다. 새 페이지를 만들면 site-map.json에 한 줄을 더하고 이 스크립트를 돌린다."""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
MAP = json.load(open(os.path.join(ROOT, "scripts", "site-map.json"), encoding="utf-8"))
PAGES = {p["file"]: p for p in MAP["pages"]}
CHECK = "--check" in sys.argv
changed = []


def esc(t):
    return html.escape(t, quote=False)


def nav_title(f):
    p = PAGES[f]
    return p.get("nav", p["title"])


def read(path):
    return open(path, encoding="utf-8").read()


def write(path, old, new):
    if old == new:
        return
    changed.append(os.path.relpath(path, ROOT))
    if not CHECK:
        open(path, "w", encoding="utf-8").write(new)


def between(s, name, body, path):
    """<!-- build:name --> 와 <!-- /build:name --> 사이를 바꾼다."""
    a, b = "<!-- build:%s -->" % name, "<!-- /build:%s -->" % name
    if a not in s or b not in s:
        sys.exit("%s: 표시 %s 가 없습니다" % (path, a))
    i, j = s.index(a) + len(a), s.index(b)
    return s[:i] + body + s[j:]


def description(f):
    m = re.search(r'<meta name="description" content="([^"]*)"', read(os.path.join(TOOLS, f)))
    return html.unescape(m.group(1)) if m else ""


# ---------- 1. 상단 메뉴 ----------
def menu(label, groups, cur, two=False):
    files = [f for _, g in groups for f in g]
    cls = "nav-g cur" if cur in files else "nav-g"
    cols = "".join(
        '<div><span class="nav-h">%s</span>%s</div>' % (
            esc(h), "".join('<a href="%s"%s>%s</a>' % (f, ' aria-current="page"' if f == cur else "", esc(nav_title(f))) for f in g))
        for h, g in groups)
    allx = '<a class="nav-all" href="index.html"%s>도구·리포트 전체 모음 →</a>' % (' aria-current="page"' if cur == "index.html" else "")
    return '      <details class="%s"><summary>%s</summary><div class="nav-m%s">%s%s</div></details>\n' % (cls, label, " two" if two else "", cols, allx)


def nav(cur):
    a = lambda f, t: '      <a href="%s"%s>%s</a>\n' % (f, ' aria-current="page"' if f == cur else "", t)
    return ('    <nav class="site-nav grouped" aria-label="사이트">\n' + a("../index.html", "홈")
            + menu("리포트", MAP["menus"]["reports"], cur)
            + menu('<span class="wide-only">실무 </span>도구', MAP["menus"]["tools"], cur, True)
            + a("guide.html", '<span class="wide-only">쉬운 </span>가이드') + a("checks.html", "검산")
            + '      <a href="../en.html" lang="en">EN</a>\n    </nav>\n')


# ---------- 2. 모음 ----------
def hub_cards():
    out = []
    for p in MAP["pages"]:
        tags = "".join('<span class="ht">%s</span>' % esc(x) for x in p["fields"])
        star = ' <b class="star">먼저 볼 것</b>' if p.get("star") else ""
        out.append('        <a class="hcard" href="%s" data-f="%s" data-k="%s">\n          <span class="hk">%s%s</span>\n          <h3>%s</h3>\n          <p>%s</p>\n          <span class="hts">%s</span>\n        </a>' % (
            p["file"], html.escape("|".join(p["fields"]), quote=True), p["kind"], p["kind"], star, esc(p["title"]), html.escape(description(p["file"]), quote=True), tags))
    return "\n" + "\n".join(out) + "\n    "


def hub_paths():
    out = []
    for i, path in enumerate(MAP["paths"]):
        steps = "".join('<li><a href="%s"><span>%s</span>%s</a></li>' % (f, esc(lab), esc(nav_title(f))) for f, lab in path["steps"])
        out.append('        <article class="pcard" id="path-%s"><span class="pk">경로 %d · %d단계</span><h3>%s</h3><p>%s</p><ol>%s</ol></article>' % (
            path["id"], i + 1, len(path["steps"]), esc(path["name"]), esc(path["why"]), steps))
    return "\n" + "\n".join(out) + "\n      "


def count(kind):
    return sum(1 for p in MAP["pages"] if p["kind"] == kind)


# ---------- 3. 이어서 볼 것 ----------
def flow(cur):
    p = PAGES.get(cur)
    path = next((x for x in MAP["paths"] if any(f == cur for f, _ in x["steps"])), None)
    parts = []
    if path:
        files = [f for f, _ in path["steps"]]
        k = files.index(cur)
        steps = "".join(
            ('<li class="cur" aria-current="step"><span>%s</span></li>' % esc(lab)) if f == cur else ('<li><a href="%s">%s</a></li>' % (f, esc(lab)))
            for f, lab in path["steps"])
        prev = ('<a class="fprev" href="%s"><small>← 이전 단계</small>%s</a>' % (files[k - 1], esc(nav_title(files[k - 1])))) if k > 0 else '<span class="fprev none"><small>경로의 첫 단계</small>여기서 시작합니다</span>'
        nxt = ('<a class="fnext" href="%s"><small>다음 단계 →</small>%s</a>' % (files[k + 1], esc(nav_title(files[k + 1])))) if k + 1 < len(files) else '<a class="fnext" href="index.html#paths"><small>경로의 마지막 단계</small>다른 읽는 경로 보기 →</a>'
        parts.append(
            '      <div class="trail-path">\n        <span class="fk">읽는 경로 · <a href="index.html#path-%s">%s</a> <b>%d</b> / %d</span>\n        <ol class="fsteps">%s</ol>\n        <div class="fnav">%s%s</div>\n      </div>\n' % (
                path["id"], esc(path["name"]), k + 1, len(files), steps, prev, nxt))
    side = []
    if p and p.get("career"):
        side.append('<div><span class="fk">제 경력과의 연결</span><p>%s</p></div>' % esc(p["career"]))
    if p and p.get("more"):
        side.append('<div><span class="fk">함께 보면 좋은 것</span><ul>%s</ul></div>' % "".join('<li><a href="%s">%s</a></li>' % (html.escape(h, quote=True), esc(t)) for h, t in p["more"]))
    if side:
        parts.append('      <div class="trail-side">%s</div>\n' % "".join(side))
    top = ('    <div class="trail-top">\n' + "".join(parts) + "    </div>\n") if parts else ""
    me = ('    <div class="trail-me"><span><b>이기표</b> 재무기획 · 전략기획 포트폴리오</span><span class="fl">'
          '<a href="../index.html#brief">3분 요약</a><a href="../assets/docs/lee-gipyo-profile.pdf" download="이기표_경력요약.pdf">경력 요약 PDF</a>'
          '<a href="index.html#paths">읽는 경로</a><a href="../index.html#contact">연락</a></span></div>\n')
    return '\n<section class="trail" aria-label="이어서 볼 것">\n  <div class="wrap wide">\n' + top + me + "  </div>\n</section>\n"


# ---------- 실행 ----------
on_disk = sorted(f for f in os.listdir(TOOLS) if f.endswith(".html"))
missing = [f for f in on_disk if f != "index.html" and f not in PAGES]
ghost = [f for f in PAGES if f not in on_disk]
if missing or ghost:
    sys.exit("site-map.json 과 tools/ 가 다릅니다. 지도에 없음: %s / 파일 없음: %s" % (missing, ghost))
in_path = [f for x in MAP["paths"] for f, _ in x["steps"]]
if len(in_path) != len(set(in_path)):
    sys.exit("한 페이지가 두 경로에 들어 있습니다")

for f in on_disk:
    path = os.path.join(TOOLS, f)
    s0 = s = read(path)
    m = re.search(r'    <nav class="site-nav grouped" aria-label="사이트">\n.*?    </nav>\n', s, re.S)
    if not m:
        sys.exit(f + ": 상단 메뉴를 찾지 못했습니다")
    s = s[:m.start()] + nav(f) + s[m.end():]
    if f == "index.html":
        s = between(s, "cards", hub_cards(), f)
        s = between(s, "paths", hub_paths(), f)
        s = between(s, "counts", "실무 도구 %d개, 분석 리포트 %d편, 분석·보고 노트 %d편" % (count("도구"), count("리포트"), count("노트")), f)
        s = between(s, "total", str(len(MAP["pages"])), f)
    else:
        a, b = "<!-- build:flow -->", "<!-- /build:flow -->"
        if a in s:
            s = between(s, "flow", flow(f), f)
        else:
            if s.count('<footer class="site-foot">') != 1:
                sys.exit(f + ": 바닥글을 찾지 못했습니다")
            s = s.replace('<footer class="site-foot">', a + flow(f) + b + "\n\n" + '<footer class="site-foot">')
    write(path, s0, s)

path = os.path.join(ROOT, "404.html")
s0 = s = read(path)
a, b = "/* build:pages */", "/* /build:pages */"
if a not in s:
    sys.exit("404.html: 표시가 없습니다")
names = {p["file"][:-5]: p.get("nav", p["title"]) for p in MAP["pages"]}
s = s[:s.index(a) + len(a)] + " const P = " + json.dumps(names, ensure_ascii=False) + "; " + s[s.index(b):]
write(path, s0, s)

if CHECK:
    print("다시 만들 것:", ", ".join(changed) if changed else "없음")
    sys.exit(1 if changed else 0)
print("고친 파일 %d개%s" % (len(changed), (": " + ", ".join(changed)) if 0 < len(changed) <= 8 else ""))

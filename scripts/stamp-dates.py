"""각 페이지 바닥글에 '최종 업데이트 날짜'를 찍는다.
실행: python3 scripts/stamp-dates.py   (커밋 직전에)
- 마지막 커밋 이후 내용이 바뀐 파일(또는 새 파일)은 오늘 날짜
- 바뀌지 않은 파일은 그 파일을 마지막으로 바꾼 커밋 날짜
날짜 표시만 다른 경우는 바뀐 것으로 보지 않는다."""
import datetime, glob, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = datetime.date.today().isoformat()
KO = re.compile(r'<span class="upd">최종 업데이트 [0-9.]+</span>')
EN = re.compile(r'English summary · updated [^<]*')


def git(*args):
    return subprocess.run(["git", "-C", ROOT] + list(args), capture_output=True, text=True).stdout


def strip(s):
    return EN.sub("English summary · updated", KO.sub("", s))


def last_date(rel):
    now = open(os.path.join(ROOT, rel), encoding="utf-8").read()
    old = git("show", "HEAD:" + rel)
    if not old or strip(old) != strip(now):
        return TODAY
    return git("log", "-1", "--format=%cs", "--", rel).strip() or TODAY


files = ["index.html", "en.html"] + sorted(os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "tools", "*.html")))
for rel in files:
    path = os.path.join(ROOT, rel)
    s = open(path, encoding="utf-8").read()
    d = last_date(rel)
    if rel == "en.html":
        t = EN.sub("English summary · updated " + d, s)
    else:
        stamp = '<span class="upd">최종 업데이트 ' + d.replace("-", ".") + "</span>"
        if KO.search(s):
            t = KO.sub(stamp, s)
        elif "<span>마지막 업데이트 " in s:
            t = re.sub(r"<span>마지막 업데이트 [^<]*</span>", stamp, s)
        else:
            t = re.sub(r'(<footer class="site-foot">\s*<div class="wrap wide">)', r"\1" + stamp.replace("\\", "\\\\"), s, count=1)
    if t != s:
        open(path, "w", encoding="utf-8").write(t)
    print(d, rel)

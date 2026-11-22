"""OpenDART에서 코스피 상장 제조업의 연간 주요 계정을 받아 패널 CSV로 만든다.

실행:
  export DART_KEY_FILE=/안전한/경로/dart.key   # 인증키 한 줄. 저장소 안에 두지 않는다
  python3 examples/dart/fetch_dart.py list           # 1) 대상 회사와 업종(회사 개황)
  python3 examples/dart/fetch_dart.py fin 2015 2025  # 2) 연도별 주요 계정(다중회사 조회, 100곳씩)
  python3 examples/dart/fetch_dart.py panel          # 3) cache/panel.csv (회사 식별자가 있어 저장소에는 올리지 않음)

- 응답은 examples/dart/cache/에 저장하고(저장소에 올리지 않음) 다시 받지 않는다.
- 인증키는 요청 주소에만 쓰고 로그·파일·결과에 남기지 않는다.
- 대상: 2026년 3~5월에 2025년 사업보고서를 낸 코스피 상장사(12월 결산) 중 한국표준산업분류 제조업(10~34).
  지금 상장된 회사만 들어가므로 그사이 상장폐지된 회사는 빠진다(생존 편향).
- 계정: 다중회사 주요계정(fnlttMultiAcnt) 사업보고서. 연결(CFS)이 있으면 연결, 없으면 별도(OFS).
  이 API에는 현금흐름표가 없어 설비투자액 대신 비유동자산 증가를 투자 지표로 쓴다.
  (회사별 전체 재무제표 API는 한 건에 수 초가 걸려 회사 478곳 × 11년을 받기 어렵다)
"""
import csv, json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
BASE = "https://opendart.fss.or.kr/api/"


def key():
    path = os.environ.get("DART_KEY_FILE")
    if path and os.path.exists(path):
        return open(path).read().strip()
    k = os.environ.get("DART_KEY", "").strip()
    if not k:
        sys.exit("DART_KEY_FILE 또는 DART_KEY 환경변수가 필요합니다.")
    return k


def get(endpoint, params, timeout=300):
    q = dict(params); q["crtfc_key"] = key()
    url = BASE + endpoint + "?" + urllib.parse.urlencode(q)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # 키가 담긴 주소는 출력하지 않는다
            wait = 10 * (attempt + 1)
            print("  retry", endpoint, type(e).__name__, "wait", wait, flush=True)
            time.sleep(wait)
    raise RuntimeError("failed " + endpoint)


def cached(name, fn):
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        return json.load(open(path)), False
    d = fn()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(d, open(path, "w"), ensure_ascii=False)
    return d, True


def kospi_list():
    """2026년 3~5월에 2025 사업보고서를 낸 코스피 회사(12월 결산, 현재 상장). 공시 검색 10여 회로 끝난다."""
    def fn():
        out, page = {}, 1
        while True:
            d = get("list.json", {"corp_cls": "Y", "bgn_de": "20260301", "end_de": "20260531", "pblntf_detail_ty": "A001", "page_count": "100", "page_no": str(page)})
            for e in d.get("list", []):
                if e.get("stock_code") and "2025.12" in e.get("report_nm", ""):
                    out[e["corp_code"]] = {"corp_code": e["corp_code"], "name": e["corp_name"], "stock": e["stock_code"]}
            if page >= int(d.get("total_page", 1)):
                return list(out.values())
            page += 1
    return cached("kospi.json", fn)[0]


def info(c):
    p = os.path.join(CACHE, "company", c["corp_code"] + ".json")
    return json.load(open(p)) if os.path.exists(p) else {}


def is_target(c):
    d = info(c)
    ind = (d.get("induty_code") or "")[:2]
    return d.get("corp_cls") == "Y" and d.get("acc_mt") == "12" and ind.isdigit() and 10 <= int(ind) <= 34


def targets():
    return [c for c in kospi_list() if is_target(c)]


def run_list():
    corps = kospi_list()
    print("kospi filers", len(corps), flush=True)
    for i, c in enumerate(corps):
        _, fresh = cached("company/" + c["corp_code"] + ".json", lambda: get("company.json", {"corp_code": c["corp_code"]}))
        if fresh:
            time.sleep(0.2)
        if i % 100 == 0:
            print(i, len(corps), flush=True)
    print("kospi manufacturing", len(targets()), flush=True)


def batches(corps, n=100):
    return [corps[i:i + n] for i in range(0, len(corps), n)]


def run_fin(y0, y1):
    """연도 × 100곳 묶음마다 한 번. 한 번에 1~2분 걸린다."""
    B = batches(targets())
    for y in range(y0, y1 + 1):
        for i, b in enumerate(B):
            t = time.time()
            d, fresh = cached("multi/%d_%02d.json" % (y, i), lambda: get("fnlttMultiAcnt.json", {"corp_code": ",".join(c["corp_code"] for c in b), "bsns_year": str(y), "reprt_code": "11011"}))
            print(y, i, d.get("status"), len({x["corp_code"] for x in d.get("list", [])}), "firms", "%.0fs" % (time.time() - t) if fresh else "cached", flush=True)


# 패널 열 → 주요계정 이름
ACC = {"revenue": "매출액", "op": "영업이익", "assets": "자산총계", "nca": "비유동자산", "equity": "자본총계", "liab": "부채총계"}


def num(s):
    s = (s or "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def run_panel(y0=2015, y1=2025):
    T = targets(); ind = {c["corp_code"]: info(c).get("induty_code", "") for c in T}
    rows = []
    for y in range(y0, y1 + 1):
        got = {}
        for i in range(len(batches(T))):
            p = os.path.join(CACHE, "multi", "%d_%02d.json" % (y, i))
            if not os.path.exists(p):
                continue
            for it in json.load(open(p)).get("list", []):
                got.setdefault(it["corp_code"], {}).setdefault(it["fs_div"], {})[it["account_nm"]] = num(it.get("thstrm_amount"))
        for c in T:
            g = got.get(c["corp_code"])
            if not g:
                continue
            fs = "CFS" if "CFS" in g else "OFS"
            rows.append([c["corp_code"], c["stock"], ind[c["corp_code"]], y, fs] + [g[fs].get(v) for v in ACC.values()])
    out = os.path.join(CACHE, "panel.csv")
    with open(out, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["corp_code", "stock", "induty", "year", "fs"] + list(ACC)); w.writerows(rows)
    print("rows", len(rows), "firms", len(T), "->", out)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        run_list()
    elif cmd == "fin":
        run_fin(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "panel":
        run_panel()

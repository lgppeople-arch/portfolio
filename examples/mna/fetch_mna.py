"""경영권 거래 후보 스크리닝용 자료 받기 (OpenDART).

실행(인증키는 저장소 밖 파일에 두고 경로만 넘긴다):
  export DART_KEY_FILE=/안전한/경로/dart.key
  python3 examples/mna/fetch_mna.py fin        # 1) 상장사 전체 주요 계정 2023~2025(다중회사 조회, 100곳씩) + 회사 개황(업종)
  python3 examples/mna/fetch_mna.py deep N      # 2) 1차 점수 상위 N곳: 전체 재무제표(현금·영업현금흐름·설비투자·차입금), 최대주주·자사주·5% 보유자
  python3 examples/mna/fetch_mna.py build       # 3) assets/data/mna-screen.js (회사명·공시 숫자만, 키·식별자 없음)

- 시가총액은 cache/mcap.json(네이버 증권 시가총액 목록, 2026.11.25 장중)에서 읽는다.
- 응답은 examples/mna/cache/에 저장하고(저장소에 올리지 않음) 다시 받지 않는다.
- 인증키는 요청 주소에만 쓰고 로그·파일·결과에 남기지 않는다.
"""
import json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(HERE, "cache")
DART_CACHE = os.path.join(ROOT, "examples", "dart", "cache")
BASE = "https://opendart.fss.or.kr/api/"
YEARS = [2025]   # 2025 사업보고서에 전기·전전기(2024·2023) 값도 함께 있다


def key():
    p = os.environ.get("DART_KEY_FILE")
    if p and os.path.exists(p):
        return open(p).read().strip()
    sys.exit("DART_KEY_FILE 환경변수가 필요합니다.")


def get(endpoint, params, timeout=120):
    q = dict(params); q["crtfc_key"] = key()
    url = BASE + endpoint + "?" + urllib.parse.urlencode(q)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # 키가 담긴 주소는 출력하지 않는다
            time.sleep(5 * (attempt + 1)); print("  retry", endpoint, type(e).__name__, flush=True)
    return {"status": "fail"}


def cached(name, fn):
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        return json.load(open(path))
    d = fn()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(d, open(path, "w"), ensure_ascii=False)
    return d


def universe():
    mc = json.load(open(os.path.join(CACHE, "mcap.json")))
    corps = {c["stock"]: c for c in json.load(open(os.path.join(DART_CACHE, "corps.json")))}
    out = []
    for code, s in mc.items():
        if s["type"] != "stock" or code not in corps:
            continue
        n = s["name"]
        if n.endswith(("우", "우B", "우C", "1우", "2우B")) or "스팩" in n or "리츠" in n:
            continue
        out.append(dict(s, corp=corps[code]["corp_code"]))
    return out


def company(corp):
    p = os.path.join(DART_CACHE, "company", corp + ".json")
    if os.path.exists(p):
        return json.load(open(p))
    return cached("company/" + corp + ".json", lambda: get("company.json", {"corp_code": corp}))


def run_fin():
    from concurrent.futures import ThreadPoolExecutor
    U = universe(); print(len(U), "companies", flush=True)
    jobs = [(y, i) for y in YEARS for i in range(0, len(U), 25)]

    def one(job):
        y, i = job; b = U[i:i + 25]; t = time.time()
        d = cached("multi/%d_%03d.json" % (y, i // 25), lambda: get("fnlttMultiAcnt.json", {"corp_code": ",".join(c["corp"] for c in b), "bsns_year": str(y), "reprt_code": "11011"}, timeout=60))
        return y, i // 25, d.get("status"), time.time() - t
    with ThreadPoolExecutor(8) as ex:
        for r in ex.map(one, jobs):
            print(*r, flush=True)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda c: company(c["corp"]), U))
    print("company done", flush=True)


def deep(n):
    """정밀 조회: 전체 재무제표(연결, 없으면 별도), 최대주주 현황, 주식 총수(자기주식 포함), 5% 대량보유 보고."""
    from concurrent.futures import ThreadPoolExecutor
    S = json.load(open(os.path.join(CACHE, "stage1.json")))[:n]

    def one(c):
        corp = c["corp"]; t = time.time(); p = {"corp_code": corp, "bsns_year": "2025", "reprt_code": "11011"}
        fs = cached("full/%s.json" % corp, lambda: get("fnlttSinglAcntAll.json", dict(p, fs_div="CFS"), timeout=90))
        if fs.get("status") != "000":
            cached("full_ofs/%s.json" % corp, lambda: get("fnlttSinglAcntAll.json", dict(p, fs_div="OFS"), timeout=90))
        cached("hyslr/%s.json" % corp, lambda: get("hyslrSttus.json", p))
        cached("stock/%s.json" % corp, lambda: get("stockTotqySttus.json", p))
        cached("major/%s.json" % corp, lambda: get("majorstock.json", {"corp_code": corp}))
        return c["name"], time.time() - t
    with ThreadPoolExecutor(8) as ex:
        for k, r in enumerate(ex.map(one, S)):
            print(k, r[0], "%.1fs" % r[1], flush=True)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "fin":
        run_fin()
    elif cmd == "deep":
        deep(int(sys.argv[2]))
    else:
        print(__doc__)

"""공식 주가: 금융위원회 주식시세정보(공공데이터포털).

실행(인증키는 저장소 밖 파일에 두고 경로만 넘긴다):
  export DATAGOKR_KEY_FILE=/안전한/경로/datagokr.key
  python3 examples/mna/fetch_price.py snap 20261124      # 그날 전 종목 종가·상장주식수·시가총액 → cache/snap_<날짜>.json
  python3 examples/mna/fetch_price.py hist 20231124 20261124   # 후보 회사들의 일별 종가·거래대금 → cache/hist/<종목>.json

- 응답은 examples/mna/cache/에 저장하고(저장소에 올리지 않음) 다시 받지 않는다.
- 인증키는 요청 주소에만 쓰고 로그·파일·결과에 남기지 않는다.
"""
import json, os, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
URL = "https://apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2"


def key():
    p = os.environ.get("DATAGOKR_KEY_FILE")
    if p and os.path.exists(p):
        return open(p).read().strip()
    sys.exit("DATAGOKR_KEY_FILE 환경변수가 필요합니다.")


def get(params):
    q = dict(params, serviceKey=key(), resultType="json")
    for attempt in range(5):
        try:
            with urllib.request.urlopen(URL + "?" + urllib.parse.urlencode(q), timeout=90) as r:
                b = json.loads(r.read().decode("utf-8"))["response"]["body"]
                it = b.get("items", {}).get("item", []) if b.get("items") else []
                return b.get("totalCount", 0), (it if isinstance(it, list) else [it])
        except Exception as e:  # 키가 담긴 주소는 출력하지 않는다
            time.sleep(5 * (attempt + 1)); print("  retry", type(e).__name__, flush=True)
    return 0, []


def snap(day):
    path = os.path.join(CACHE, "snap_%s.json" % day)
    if os.path.exists(path):
        return json.load(open(path))
    out, page = {}, 1
    while True:
        n, items = get({"basDt": day, "numOfRows": 1000, "pageNo": page})
        for x in items:
            out[x["srtnCd"]] = {"name": x["itmsNm"], "mkt": x["mrktCtg"], "close": float(x["clpr"]), "shares": float(x["lstgStCnt"]),
                                "mcap": float(x["mrktTotAmt"]), "trPrc": float(x["trPrc"])}
        print("page", page, len(out), "/", n, flush=True)
        if page * 1000 >= n or not items:
            break
        page += 1
    json.dump(out, open(path, "w"), ensure_ascii=False)
    return out


def hist(d0, d1, codes):
    os.makedirs(os.path.join(CACHE, "hist"), exist_ok=True)

    def one(code):
        p = os.path.join(CACHE, "hist", code + ".json")
        if os.path.exists(p):
            return code, "cached"
        n, items = get({"likeSrtnCd": code, "beginBasDt": d0, "endBasDt": str(int(d1) + 1), "numOfRows": 1000, "pageNo": 1})
        rows = sorted([[x["basDt"], float(x["clpr"]), float(x["trPrc"])] for x in items if x["srtnCd"] == code])
        json.dump(rows, open(p, "w")); return code, len(rows)
    with ThreadPoolExecutor(6) as ex:
        for r in ex.map(one, codes):
            print(*r, flush=True)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "snap":
        snap(sys.argv[2])
    elif cmd == "hist":
        sys.path.insert(0, HERE)
        D = json.load(open(os.path.join(CACHE, "stage1.json")))
        hist(sys.argv[2], sys.argv[3], [r["code"] for r in D[:450]])   # 정밀 조회한 450곳
    else:
        print(__doc__)

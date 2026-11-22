"""UN Comtrade 공개(키 없음) API에서 반도체 장비·메모리 월별 교역액을 받아 CSV로 저장한다.

실행: python3 examples/trade/fetch_comtrade.py [시작 YYYYMM] [끝 YYYYMM]
- 공개 미리보기 API는 한 번에 한 달만 받으므로 달마다 한 번씩 부른다(요청 사이 1.2초 대기).
- 이미 받은 달(raw/ 폴더의 JSON)은 다시 받지 않는다.
- 결과: examples/trade/comtrade_monthly.csv (보고국, 품목, 방향, 연월, 금액 달러)

품목(HS 2022 기준)
  8486   반도체·디스플레이 제조장비와 부분품
  854232 메모리 반도체(집적회로)
보고국: 한국 410, 일본 392, 네덜란드 528, 미국 842, 중국 156. 상대국은 세계 전체(0).
"""
import csv, json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "comtrade_monthly.csv")
URL = ("https://comtradeapi.un.org/public/v1/preview/C/M/HS?reporterCode=410,392,528,842,156"
       "&period={p}&cmdCode=8486,854232&flowCode=M,X&partnerCode=0")
NAMES = {410: "KOR", 392: "JPN", 528: "NLD", 842: "USA", 156: "CHN"}


def months(a, b):
    y, m = int(a[:4]), int(a[4:])
    while y * 100 + m <= int(b):
        yield "%04d%02d" % (y, m)
        m += 1
        if m > 12:
            y, m = y + 1, 1


def fetch(p):
    path = os.path.join(RAW, p + ".json")
    if os.path.exists(path):
        return json.load(open(path)), False
    for attempt in range(4):
        try:
            with urllib.request.urlopen(URL.format(p=p), timeout=60) as r:
                d = json.loads(r.read().decode("utf-8"))
            json.dump(d, open(path, "w"))
            return d, True
        except urllib.error.HTTPError as e:
            if e.code == 429:            # 요청이 너무 잦음: 기다렸다 다시
                time.sleep(10 * (attempt + 1)); continue
            raise
        except urllib.error.URLError:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("failed " + p)


def main():
    a = sys.argv[1] if len(sys.argv) > 1 else "201501"
    b = sys.argv[2] if len(sys.argv) > 2 else time.strftime("%Y%m")
    os.makedirs(RAW, exist_ok=True)
    rows = []
    for p in months(a, b):
        d, fresh = fetch(p)
        data = d.get("data") or []
        for r in data:
            if r.get("partnerCode") != 0 or r.get("motCode") not in (0, None) or r.get("customsCode") not in ("C00", None) or r.get("partner2Code") not in (0, None):
                continue
            rows.append([NAMES.get(r["reporterCode"], r["reporterCode"]), r["cmdCode"], r["flowCode"], r["period"], r["primaryValue"]])
        print(p, len(data), "new" if fresh else "cached", flush=True)
        if fresh:
            time.sleep(1.2)
    rows.sort(key=lambda x: (x[0], x[1], x[2], x[3]))
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["reporter", "hs", "flow", "period", "value_usd"]); w.writerows(rows)
    print("rows", len(rows), "->", OUT)


if __name__ == "__main__":
    main()

"""SEC EDGAR 무료 API로 미국 상장 장비사 연간 재무를 받는다(키 없음).

실행:
  export SEC_UA="회사나 프로젝트 이름 연락용이메일@도메인"   # SEC 공정 접근 정책: User-Agent에 연락처 필수. 저장소에 적지 않는다
  python3 examples/equip/fetch_sec.py            # cache에 companyfacts JSON 저장 → sec_annual.json

- 엔드포인트: https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json (회사가 제출한 XBRL 사실 전체)
- 초당 10회 이하로 요청한다(SEC 권고). 여기서는 회사 4곳이라 한 번씩만 부른다.
- 연간 값: form이 10-K/20-F이고 기간이 약 1년(330~380일)인 사실 중, 그 회계연도를 처음 보고한 제출 건의 값을 쓴다
  (나중 연도 보고서의 비교 수치는 재작성될 수 있어 원래 보고 값과 구분한다).
"""
import json, os, sys, time, urllib.request
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(os.path.dirname(HERE), "dart", "cache", "sec")
COS = {"AMAT": 6951, "LRCX": 707549, "KLAC": 319201, "ASML": 937966}
# 표준 항목 → 후보 태그(앞에서부터 먼저 있는 것)
TAGS = {
    "rev": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "gp": ["GrossProfit"],
    "rd": ["ResearchAndDevelopmentExpense"],
    "op": ["OperatingIncomeLoss"],
    "ni": ["NetIncomeLoss"],
    "ocf": ["NetCashProvidedByUsedInOperatingActivities"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "buyback": ["PaymentsForRepurchaseOfCommonStock"],
    "div": ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
}


def fetch(cik):
    ua = os.environ.get("SEC_UA", "").strip()
    if "@" not in ua:
        sys.exit("SEC_UA 환경변수에 '이름 이메일' 형식의 연락처가 필요합니다(SEC 정책).")
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, "CIK%010d.json" % cik)
    if not os.path.exists(p):
        req = urllib.request.Request("https://data.sec.gov/api/xbrl/companyfacts/CIK%010d.json" % cik, headers={"User-Agent": ua, "Accept-Encoding": "identity"})
        with urllib.request.urlopen(req, timeout=60) as r:
            open(p, "wb").write(r.read())
        time.sleep(0.5)
    return json.load(open(p))


def days(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def annual(facts, tags, cur):
    """회계연도 끝날짜 → (값, 처음 보고한 제출 번호, 양식). 회사가 연도에 따라 태그를 바꾸므로 후보 태그를 합친다(앞 태그 우선)"""
    g = facts["facts"].get("us-gaap", {}); out = {}
    for t in tags:
        units = g.get(t, {}).get("units", {}).get(cur) or []
        best = {}
        for f in units:
            if f.get("form") not in ("10-K", "20-F", "10-K/A", "20-F/A") or "start" not in f or not (330 <= days(f["start"], f["end"]) <= 380):
                continue
            prev = best.get(f["end"])
            if prev is None or f["filed"] < prev["filed"]:
                best[f["end"]] = {"v": f["val"], "filed": f["filed"], "accn": f["accn"], "form": f["form"], "tag": t}
        for e, q in best.items():
            out.setdefault(e, q)
    return out


def main():
    res = {}
    for co, cik in COS.items():
        fx = fetch(cik); cur = "EUR" if co == "ASML" else "USD"
        cols = {k: annual(fx, tg, cur) for k, tg in TAGS.items()}
        ends = sorted(cols["rev"])[-6:]
        res[co] = {"cik": cik, "entity": fx.get("entityName"), "cur": cur, "years": []}
        for e in ends:
            row = {"end": e}
            for k in TAGS:
                q = cols[k].get(e)
                row[k] = q["v"] / 1e6 if q else None
                if k == "rev" and q:
                    row["accn"] = q["accn"]; row["form"] = q["form"]; row["tag"] = q["tag"]
            res[co]["years"].append(row)
        print(co, fx.get("entityName"), [(y["end"], round(y["rev"]), y["form"]) for y in res[co]["years"]])
    json.dump(res, open(os.path.join(CACHE, "sec_annual.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()

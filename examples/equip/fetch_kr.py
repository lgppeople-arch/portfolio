"""국내 상장 반도체 장비사 찾기와 매출 규모 거르기 (OpenDART)

실행:
  export DART_KEY_FILE=/안전한/경로/dart.key
  python3 examples/equip/fetch_kr.py list     # 코스피·코스닥 사업보고서 제출사의 업종 → 반도체 제조용 기계(KSIC 29271)
  python3 examples/equip/fetch_kr.py fin      # 그 회사들의 2021~2025 주요 계정(다중회사 조회)
  python3 examples/equip/fetch_kr.py rank     # 2025년 매출 순위(cache/kr_rank.json)
  python3 examples/equip/fetch_kr.py build    # 화면용 자료 assets/data/equip-kr.js (다른 업종 코드로 등록된 장비사는 cache/kr_extra.json·multi_kr/extra_*.json)

- 수집·캐시 함수는 examples/dart/fetch_dart.py를 그대로 쓴다(인증키는 요청 주소에만, 캐시는 저장소 밖).
- 업종 정의: 회사 개황의 표준산업분류 코드가 29271(반도체 제조용 기계 제조업)인 회사. 검사·계측 장비를 만들어도
  측정기기(27)로 분류된 회사는 빠진다(한계로 적는다).
"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dart"))
import fetch_dart as F  # noqa: E402

KSIC = "29271"


def market_list(cls):
    """cls: Y(코스피) / K(코스닥). 2026년 3~5월 2025 사업보고서 제출사"""
    def fn():
        out, page = {}, 1
        while True:
            d = F.get("list.json", {"corp_cls": cls, "bgn_de": "20260301", "end_de": "20260531", "pblntf_detail_ty": "A001", "page_count": "100", "page_no": str(page)})
            for e in d.get("list", []):
                if e.get("stock_code") and "2025.12" in e.get("report_nm", ""):
                    out[e["corp_code"]] = {"corp_code": e["corp_code"], "name": e["corp_name"], "stock": e["stock_code"], "cls": cls}
            if page >= int(d.get("total_page", 1)):
                return list(out.values())
            page += 1
    return F.cached("listed_%s.json" % cls, fn)[0]


def run_list():
    corps = market_list("Y") + market_list("K")
    print("filers", len(corps), flush=True)
    n = 0
    for i, c in enumerate(corps):
        _, fresh = F.cached("company/" + c["corp_code"] + ".json", lambda: F.get("company.json", {"corp_code": c["corp_code"]}))
        if fresh:
            n += 1; time.sleep(0.1)
        if i % 200 == 0:
            print(i, len(corps), "new", n, flush=True)
    eq = [c for c in corps if (F.info(c).get("induty_code") or "").startswith(KSIC)]
    json.dump(eq, open(os.path.join(F.CACHE, "kr_equip.json"), "w"), ensure_ascii=False)
    print("equipment makers", len(eq), flush=True)


def run_fin(y0=2021, y1=2025):
    eq = json.load(open(os.path.join(F.CACHE, "kr_equip.json")))
    B = F.batches(eq)
    for y in range(y0, y1 + 1):
        for i, b in enumerate(B):
            t = time.time()
            d, fresh = F.cached("multi_kr/%d_%02d.json" % (y, i), lambda: F.get("fnlttMultiAcnt.json", {"corp_code": ",".join(c["corp_code"] for c in b), "bsns_year": str(y), "reprt_code": "11011"}))
            print(y, i, d.get("status"), len({x["corp_code"] for x in d.get("list", [])}), "firms", "%.0fs" % (time.time() - t) if fresh else "cached", flush=True)


def run_rank(y0=2021, y1=2025):
    eq = json.load(open(os.path.join(F.CACHE, "kr_equip.json")))
    B = F.batches(eq); rows = {}
    for y in range(y0, y1 + 1):
        for i in range(len(B)):
            p = os.path.join(F.CACHE, "multi_kr", "%d_%02d.json" % (y, i))
            if not os.path.exists(p):
                continue
            got = {}
            for it in json.load(open(p)).get("list", []):
                got.setdefault(it["corp_code"], {}).setdefault(it["fs_div"], {})[it["account_nm"]] = F.num(it.get("thstrm_amount"))
            for cc, g in got.items():
                fs = "CFS" if "CFS" in g else "OFS"
                rows.setdefault(cc, {})[y] = {"fs": fs, **{k: g[fs].get(v) for k, v in F.ACC.items()}}
    out = []
    for c in eq:
        r = rows.get(c["corp_code"], {})
        if y1 in r and r[y1].get("revenue"):
            out.append({**c, "induty": F.info(c).get("induty_code"), "years": r})
    out.sort(key=lambda q: -q["years"][y1]["revenue"])
    json.dump(out, open(os.path.join(F.CACHE, "kr_rank.json"), "w"), ensure_ascii=False)
    for i, q in enumerate(out[:30]):
        print(i + 1, q["name"], q["stock"], q["cls"], round(q["years"][y1]["revenue"] / 1e8), "억원", q["years"][y1]["fs"])


if __name__ == "__main__" and (len(sys.argv) < 2 or sys.argv[1] != "build"):
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    {"list": run_list, "fin": run_fin, "rank": run_rank}[cmd]()


# ---------- 화면용 자료: 국내 상장 장비사(매출 규모 기준) ----------
# 업종 코드가 29271이 아닌 주요 반도체 장비사(회사 개황상 292·29229·272·27212 등). 모집단에 더한다.
EXTRA = ["원익IPS", "주성엔지니어링", "케이씨텍", "파크시스템스", "오로스테크놀로지", "디아이", "넥스틴"]
# 완성 장비가 주력인 회사만 남긴다. 부품·모듈·부대설비·서비스가 주력인 회사는 유형을 밝혀 뺀다.
NOT_EQUIP = {"뉴파워프라즈마": "RF 전원(부품·모듈)", "GST": "스크러버·칠러(부대설비)", "에스티아이": "약액 공급 장치(부대설비)", "유니셈": "스크러버·칠러(부대설비)",
             "엘오티베큠": "진공 펌프(부품)", "고영": "주력이 전자기판(SMT) 검사"}
FOCUS = {"원익IPS": "증착(CVD·ALD), 열처리", "한미반도체": "후공정(TC 본더, 절단·검사)", "디아이": "테스트(번인·메모리 테스터)", "제우스": "세정, 이송 로봇", "케이씨텍": "CMP, 세정",
         "이오테크닉스": "레이저(마킹·어닐링·절단)", "테스": "증착(PECVD), 가스 식각", "유진테크": "증착(LPCVD·ALD), 열처리", "주성엔지니어링": "증착(ALD·CVD)"}
MIN_REV = 3000e8   # 2025년 매출 3,000억 원 이상


def run_build(y0=2021, y1=2025):
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    base = json.load(open(os.path.join(F.CACHE, "kr_rank.json")))
    extra = json.load(open(os.path.join(F.CACHE, "kr_extra.json")))
    rows = {}
    for y in range(y0, y1 + 1):
        p = os.path.join(F.CACHE, "multi_kr", "extra_%d.json" % y)
        got = {}
        for it in json.load(open(p)).get("list", []):
            got.setdefault(it["corp_code"], {}).setdefault(it["fs_div"], {})[it["account_nm"]] = F.num(it.get("thstrm_amount"))
        for cc, g in got.items():
            fs = "CFS" if "CFS" in g else "OFS"
            rows.setdefault(cc, {})[str(y)] = {"fs": fs, **{k: g[fs].get(v) for k, v in F.ACC.items()}}
    pool = base + [{**c, "induty": F.info(c).get("induty_code"), "years": rows.get(c["corp_code"], {})} for c in extra]
    out = []
    for c in pool:
        ys = {str(k): v for k, v in c["years"].items()}
        rev = (ys.get(str(y1)) or {}).get("revenue") or 0
        if c["name"] in FOCUS and rev >= MIN_REV:
            out.append({"name": c["name"], "stock": c["stock"], "market": "코스피" if c["cls"] == "Y" else "코스닥", "ksic": c.get("induty"), "focus": FOCUS[c["name"]],
                        "years": [{"fy": y, "fs": ys[str(y)]["fs"], **{k: (round(ys[str(y)][k] / 1e8, 1) if ys[str(y)].get(k) is not None else None) for k in F.ACC}} for y in range(y0, y1 + 1) if str(y) in ys]})
    out.sort(key=lambda q: -q["years"][-1]["revenue"])
    excluded = [{"name": n, "why": w} for n, w in NOT_EQUIP.items()]
    data = {"asof": "2026-11-23", "unit": "억원", "rule": "표준산업분류 반도체 제조용 기계(29271) 상장사와 다른 코드로 등록된 주요 반도체 장비사 중, 완성 장비가 주력이고 2025년 매출 3,000억 원 이상인 회사",
            "cos": out, "excluded": excluded}
    with open(os.path.join(root, "assets", "data", "equip-kr.js"), "w") as f:
        f.write("/* 국내 상장 반도체 장비사(2025년 매출 3,000억 원 이상) 2021~2025 주요 계정. examples/equip/fetch_kr.py build로 만듦(OpenDART 다중회사 주요계정). 손으로 고치지 않는다. */\n")
        f.write("(function (root) { const D = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
        f.write("  if (typeof module === \"object\" && module.exports) module.exports = D; else root.EquipKr = D; })(typeof self !== \"undefined\" ? self : this);\n")
    for q in out:
        print(q["name"], q["years"][-1]["revenue"], [y["fy"] for y in q["years"]])


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "build":
    run_build()

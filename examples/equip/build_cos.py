"""해외 장비사 5곳 비교 자료 만들기 → assets/data/equip-cos.js

입력
- Fiscal.ai 표준화 재무제표·세그먼트(ASML, Applied Materials, Lam Research, KLA). 값마다 SEC 제출 원문(10-K, 20-F) 주소와 쪽수가 붙어 있다.
  (유료 API 응답이라 원본 JSON은 저장소에 올리지 않고, 여기서 뽑은 숫자와 원문 주소만 남긴다.)
- Tokyo Electron: Fiscal.ai에 손익·현금흐름이 없어 회사 IR 원문(결산 설명회 자료, 연결재무제표)에서 옮겼다. TEL 아래 표 참고.
- 환율: 미 연준 G.5A 연평균(2026.1.5 발표). 2025년 EUR 1.1306 USD, JPY 149.5686/USD.

실행: python3 examples/equip/build_cos.py <Fiscal.ai 응답에서 뽑은 extracted.json>
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FX = {"source": "Federal Reserve G.5A (2026-01-05), annual averages", "EUR": {2022: 1.0534, 2023: 1.0817, 2024: 1.0820, 2025: 1.1306}, "JPY": {2022: 131.4589, 2023: 140.5001, 2024: 151.4551, 2025: 149.5686}}

# Tokyo Electron(일본 기준, 3월 결산, 십억 엔). 출처는 각 줄 끝
TEL = {
    2021: dict(rev=1399.1, gp=1399.1 * 0.404, rd=136.6, op=320.6, ni=242.9, ocf=52.7 + 53.1 - 18.6 + 58.6, capex=53.8, ocfNote="분기 합계"),  # FY2022 결산 설명회 자료(FY2021 비교)
    2022: dict(rev=2003.8, gp=911.8, rd=158.2, op=599.2, ni=437.0, ocf=111.2 + 94.6 + 114.6 - 37.1, capex=57.2, ocfNote="분기 합계"),  # FY2022 결산 설명회 자료, FY2026 자료의 5년 추이
    2023: dict(rev=2209.0, gp=984.4, rd=191.196, op=617.7, ni=471.5, ocf=426.270, capex=74.4),  # FY2024 연결재무제표, FY2026 자료
    2024: dict(rev=1830.5, gp=830.2, rd=202.873, op=456.2, ni=363.9, ocf=434.720, capex=121.8),
    2025: dict(rev=2431.5, gp=1146.2, rd=250.017, op=697.3, ni=544.1, ocf=582.174, capex=162.1),  # FY2026 연결재무제표
    2026: dict(rev=2443.5, gp=1107.8, rd=277.866, op=624.9, ni=574.4, ocf=539.732, capex=216.0),
}
TEL_SRC = ["https://www.tel.com/ir/library/report/pjuomj00000000tf-att/fy26q4transcript-e.pdf", "https://www.tel.com/ir/library/consolidated-financial-statements/i242su00000000yk-att/Consolidated_Financial_Statements_FY2026.pdf",
           "https://www.tel.com/ir/library/consolidated-financial-statements/hbu2s80000000099-att/Consolidated_Financial_Statements_FY2024.pdf", "https://www.tel.com/ir/library/report/hq95qj00000007nc-att/fy22q4presentations-e.pdf"]
# TEL 지역별(십억 엔)·현장 솔루션(Field Solutions)·신규 장비 용도 구성: Fiscal.ai 세그먼트(TEL 공시 기반)와 FY2026 설명회 자료
TEL_GEO = {2024: dict(China=813.307, Korea=284.455, Taiwan=205.5, Japan=184.982, US=168.116, Europe=119.408, Other=54.756),
           2025: dict(China=1015.06, Korea=409.009, Taiwan=410.627, Japan=189.979, US=242.964, Europe=75.524, Other=88.402),
           2026: dict(China=832.555, Korea=543.858, Taiwan=499.853, Japan=239.427, US=166.446, Europe=67.407, Other=93.985)}
TEL_SVC = {2022: 456.116, 2023: 474.218, 2024: 428.5, 2025: 538.488, 2026: 626.282}
TEL_END = {2025: {"로직·파운드리 등": 62, "DRAM": 31, "낸드": 7}, 2026: {"로직·파운드리 등": 59, "DRAM": 31, "낸드": 10}}

IS = {"rev": "income_statement_total_revenues", "gp": "income_statement_gross_profit", "rd": "income_statement_research_and_development_expenses", "op": "income_statement_operating_profit", "ni": "income_statement_net_income_attributable_to_common_shareholders"}
CF = {"ocf": "cash_flow_statement_cash_from_operating_activities", "capex": "cash_flow_statement_purchases_of_property_plant_and_equipment", "buyback": "cash_flow_statement_repurchases_of_common_shares", "div": "cash_flow_statement_common_share_dividends_paid"}
GEO = {  # 세그먼트 이름 → 공통 지역
    "AMAT": {"China Revenue": "China", "Korea Revenue": "Korea", "Taiwan Revenue": "Taiwan", "Japan Revenue": "Japan", "United States Revenue": "US", "Europe Revenue": "Europe", "Southeast Asia Revenue": "Other"},
    "LRCX": {"China Revenue": "China", "Korea Revenue": "Korea", "Taiwan Revenue": "Taiwan", "Japan Revenue": "Japan", "United States Revenue": "US", "Europe Revenue": "Europe", "Southeast Asia Revenue": "Other"},
    "KLAC": {"China Revenue": "China", "Korea Revenue": "Korea", "Taiwan Revenue": "Taiwan", "Japan Revenue": "Japan", "North America Revenue": "US", "Europe and Israel Revenue": "Europe", "Rest of Asia Revenue": "Other"},
    "ASML": {"China Revenue": "China", "South Korea Revenue": "Korea", "Taiwan Revenue": "Taiwan", "Japan Revenue": "Japan", "United States Revenue": "US", "Total EMEA (Incl. Netherlands) Revenue": "Europe", "Singapore Revenue": "Other", "Rest of Asia Revenue": "Other"},
}
SVC = {"AMAT": "Applied Global Services Revenue", "LRCX": "Customer Support & Other Revenue", "KLAC": "Services Revenue", "ASML": "Service and Field Option Revenue"}
MIX = {  # 제품·사업 구성(최근 3년)
    "AMAT": [("Semiconductor Systems Revenue", "반도체 장비"), ("Applied Global Services Revenue", "서비스(AGS)"), ("Display Revenue", "디스플레이"), ("Corporate and Other Revenue", "기타(FY2026부터 디스플레이 포함)")],
    "LRCX": [("Systems Revenue", "장비"), ("Customer Support & Other Revenue", "고객 지원·서비스(CSBG)")],
    "KLAC": [("Wafer Inspection Revenue", "웨이퍼 검사"), ("Patterning Revenue", "패터닝(계측·마스크)"), ("Specialty Semiconductor Process (Product) Revenue", "특수 공정 장비"), ("PCB and Component Inspection Revenue", "PCB·부품 검사"), ("Services Revenue", "서비스"), ("Other Product Revenue", "기타")],
    "ASML": [("Total EUV Net System Sales Revenue", "EUV 장비"), ("Total DUV Net System Sales Revenue", "DUV 장비"), ("Metrology & Inspection Net System Sales Revenue", "계측·검사 장비"), ("Service and Field Option Revenue", "설치 기반 서비스")],
}
END = {"AMAT": [("Foundry and Logic % Semiconductor Systems Revenue", "로직·파운드리"), ("DRAM % Semiconductor Systems Revenue", "DRAM"), ("Flash Memory % Semiconductor Systems Revenue", "낸드")],
       "LRCX": [("Foundry Revenue % Total Systems Revenue", "파운드리"), ("Logic / Integrated Device Manufacturing Revenue % Total Systems Revenue", "로직·IDM"), ("Memory Revenue % Total Systems Revenue", "메모리")]}

META = {
    "ASML": dict(name="ASML", hq="네덜란드", fy="12월 결산", cur="EUR", gaap="US GAAP(20-F)", focus="노광(EUV 단독 공급, DUV), 계측·검사"),
    "AMAT": dict(name="Applied Materials", hq="미국", fy="10월 말 결산", cur="USD", gaap="US GAAP(10-K)", focus="증착(CVD·PVD·ALD·에피), 식각, CMP, 이온주입, 열처리, 검사"),
    "LRCX": dict(name="Lam Research", hq="미국", fy="6월 말 결산", cur="USD", gaap="US GAAP(10-K)", focus="식각(도체·유전체), 증착(CVD·ALD·ECD), 세정"),
    "TEL": dict(name="Tokyo Electron", hq="일본", fy="3월 결산", cur="JPY", gaap="일본 기준(J-GAAP)", focus="코터·디벨로퍼, 식각, 증착(퍼니스·ALD), 세정, 웨이퍼 프로버"),
    "KLAC": dict(name="KLA", hq="미국", fy="6월 말 결산", cur="USD", gaap="US GAAP(10-K)", focus="결함 검사, 계측(패터닝), 특수 공정 장비, PCB 검사"),
}


def main(path):
    X = json.load(open(path)); cos = []
    for co in ["ASML", "AMAT", "LRCX", "TEL", "KLAC"]:
        m = dict(META[co]); m["id"] = co; m["years"] = []; m["geo"] = {}; m["svc"] = {}; m["mix"] = {}; m["end"] = {}; m["src"] = []
        if co == "TEL":
            for fy, r in TEL.items():
                m["years"].append(dict(fy=fy, end="%d-03-31" % fy, **{k: round(v * 1000, 1) if isinstance(v, float) else v for k, v in r.items()}))
            m["geo"] = {str(y): {k: round(v * 1000, 1) for k, v in g.items()} for y, g in TEL_GEO.items()}
            m["svc"] = {str(y): round(v * 1000, 1) for y, v in TEL_SVC.items()}
            m["svcName"] = "현장 솔루션(Field Solutions: 부품·서비스·중고·개조)"
            m["end"] = {str(y): v for y, v in TEL_END.items()}; m["endBase"] = "신규 장비 매출 기준"
            m["src"] = TEL_SRC
        else:
            x = X[co]; names = x["segnames"]
            for fy in sorted(int(k) for k in x["is"])[-6:]:
                r, c = x["is"][str(fy)], x["cf"].get(str(fy), {})
                row = dict(fy=fy, end=r["end"])
                for k, mid in IS.items(): row[k] = round(r[mid] / 1e6, 1) if r.get(mid) is not None else None
                for k, mid in CF.items(): row[k] = round(abs(c[mid]) / 1e6, 1) if c.get(mid) is not None else None
                m["years"].append(row)
                if x["src"].get(str(fy)): m["src"].append(x["src"][str(fy)])
            inv = {v: k for k, v in names.items()}
            for dt in sorted(x["seg"])[-3:]:
                y = str(int(dt[:4])); v = x["seg"][dt]
                g = {}
                for nm, reg in GEO[co].items():
                    if inv.get(nm) in v: g[reg] = round(g.get(reg, 0) + v[inv[nm]] / 1e6, 1)
                m["geo"][y] = g
                if inv.get(SVC[co]) in v: m["svc"][y] = round(v[inv[SVC[co]]] / 1e6, 1)
                m["mix"][y] = [[lab, round(v[inv[nm]] / 1e6, 1)] for nm, lab in MIX[co] if inv.get(nm) in v and v[inv[nm]]]
                if co in END: m["end"][y] = {lab: v[inv[nm]] for nm, lab in END[co] if inv.get(nm) in v}
                if co == "ASML":
                    u = {k: v.get(inv.get(k)) for k in ["Total EUV Net System Sales (Units)", "Total DUV Net System Sales (Units)"]}
                    m.setdefault("units", {})[y] = {"EUV": u["Total EUV Net System Sales (Units)"], "DUV": u["Total DUV Net System Sales (Units)"]}
                    m.setdefault("bookings", {})[y] = round(v.get(inv.get("Net Bookings"), 0) / 1e6, 1)
                    m["end"][y] = {"로직": round(v[inv["Logic Revenue"]] / v[inv["Net System Sales Revenue"]] * 100), "메모리": round(v[inv["Memory Revenue"]] / v[inv["Net System Sales Revenue"]] * 100)}
            if co == "ASML": m["endBase"] = "장비 매출 기준"
            if co in END: m["endBase"] = "장비 매출 기준"
            m["svcName"] = {"AMAT": "Applied Global Services(부품·서비스·업그레이드)", "LRCX": "Customer Support Business Group(부품·서비스·업그레이드)", "KLAC": "서비스", "ASML": "설치 기반 관리(서비스·필드 옵션)"}[co]
            m["src"] = sorted(set(m["src"]))
        cos.append(m)
    data = {"asof": "2026-11-23", "fx": FX, "cos": cos, "note": "금액 단위: 각 회사 보고 통화 백만(엔화는 백만 엔)"}
    with open(os.path.join(ROOT, "assets", "data", "equip-cos.js"), "w") as f:
        f.write("/* 해외 장비사 5곳 연간 재무·세그먼트. examples/equip/build_cos.py로 만듦(Fiscal.ai·SEC 원문, TEL IR 원문). 손으로 고치지 않는다. */\n")
        f.write("(function (root) { const D = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
        f.write("  if (typeof module === \"object\" && module.exports) module.exports = D; else root.EquipCos = D; })(typeof self !== \"undefined\" ? self : this);\n")
    for c in cos:
        y = c["years"][-1]; print(c["id"], y["fy"], y["rev"], "svc", list(c["svc"].items())[-1], "geo", c["geo"].get(str(y["fy"]) if c["id"] != "TEL" else "2026"))


if __name__ == "__main__":
    main(sys.argv[1])

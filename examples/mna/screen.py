"""경영권 거래 후보 스크리닝: 계산.

  python3 examples/mna/screen.py stage1   # 주요 계정으로 1차 점수 → cache/stage1.json (정밀 조회 대상 순서)
  python3 examples/mna/screen.py build    # 정밀 자료(현금·영업현금흐름·설비투자·차입금·지분)로 최종 → assets/data/mna-screen.js

원칙
- 숫자는 OpenDART 사업보고서(2025 회계연도, 연결 우선) 원문 값. 시가총액은 2026.11.25 장중 값.
- 금융업(은행·보험·증권·여신)은 영업이익·부채 구조가 달라 제외한다.
- 작성자와 이해관계가 있을 수 있는 회사는 기준을 넘더라도 넣지 않는다(이름은 결과에 남기지 않는다).
"""
import json, os, sys, math
from fetch_mna import CACHE, DART_CACHE, ROOT, universe, company

EXCLUDE_FILE = os.path.join(CACHE, "exclude.json")   # 저장소에 올리지 않는 로컬 파일: {"codes": [...], "names": [...]}
EX = json.load(open(EXCLUDE_FILE)) if os.path.exists(EXCLUDE_FILE) else {"codes": [], "names": []}
EXCLUDE = set(EX["codes"])
ACC = {"매출액": "rev", "영업이익": "op", "당기순이익(손실)": "ni", "자산총계": "ta", "부채총계": "tl", "자본총계": "te", "유동자산": "ca", "유동부채": "cl"}

# 한국표준산업분류 앞자리 → 읽기 쉬운 업종 묶음
GROUPS = [
    ("반도체·전자부품", ["261", "262"]), ("전자기기·디스플레이", ["263", "264", "265", "266", "267", "268"]),
    ("전기장비·2차전지", ["28"]), ("화학·소재", ["20", "22"]), ("제약·바이오", ["21", "7011", "70113", "70121"]),
    ("의료·정밀기기", ["27"]), ("기계·장비", ["29"]), ("자동차·부품", ["30"]), ("조선·운송장비", ["31"]),
    ("금속·철강", ["24", "25"]), ("식품·음료·생활", ["10", "11", "12", "204"]), ("섬유·의류·화장품", ["13", "14", "15"]),
    ("건설·건자재", ["41", "42", "23"]), ("유통·상사", ["45", "46", "47"]), ("운송·물류", ["49", "50", "51", "52"]),
    ("소프트웨어·IT서비스", ["582", "62", "63"]), ("게임·미디어·엔터", ["5821", "59", "60", "90", "91"]),
    ("통신·인터넷", ["61"]), ("에너지·유틸리티", ["35", "36", "19"]), ("지주·투자", ["715", "6420", "64992"]),
]
FIN = ("64", "65", "66")   # 6420 지주회사는 위에서 먼저 잡는다


def group_of(ind):
    best = None
    for name, pre in GROUPS:
        for p in pre:
            if ind.startswith(p) and (best is None or len(p) > best[1]):
                best = (name, len(p))
    return best[0] if best else "기타"


def num(s):
    try:
        return float(str(s).replace(",", ""))
    except Exception:
        return None


def load_multi():
    out = {}
    d = os.path.join(CACHE, "multi")
    for f in sorted(os.listdir(d)):
        y = int(f[:4]); j = json.load(open(os.path.join(d, f)))
        if y != 2025:
            continue
        for it in j.get("list", []):
            k = ACC.get(it["account_nm"])
            if not k:
                continue
            for yy, col in ((2025, "thstrm_amount"), (2024, "frmtrm_amount"), (2023, "bfefrmtrm_amount")):
                r = out.setdefault(it["corp_code"], {}).setdefault(it["fs_div"], {}).setdefault(yy, {})
                if k not in r:
                    r[k] = num(it.get(col))
    return out


def stage1():
    U = universe(); M = load_multi(); rows = []
    for c in U:
        if c["code"] in EXCLUDE:
            continue
        info = company(c["corp"]); ind = info.get("induty_code", "") or ""
        if ind.startswith(FIN) and not ind.startswith(("6420", "64992")):
            continue
        g = M.get(c["corp"]);
        if not g:
            continue
        fs = "CFS" if "CFS" in g else "OFS"; f = g[fs]
        if 2025 not in f or not f[2025].get("rev") or f[2025].get("te") in (None, 0):
            continue
        a = f[2025]; b = f.get(2024, {}); z = f.get(2023, {})
        rev, op, ni, te = a["rev"], a.get("op") or 0, a.get("ni") or 0, a["te"]
        cagr = (rev / z["rev"]) ** 0.5 - 1 if z.get("rev") and z["rev"] > 0 and rev > 0 else None
        rows.append({"code": c["code"], "corp": c["corp"], "name": c["name"], "mkt": c["mkt"], "mcap": c["mcap"], "price": c["price"],
                     "ind": ind, "group": group_of(ind), "fs": fs, "est": info.get("est_dt", ""), "ceo": info.get("ceo_nm", ""),
                     "rev": rev, "op": op, "ni": ni, "te": te, "ta": a.get("ta"), "tl": a.get("tl"),
                     "op24": b.get("op"), "op23": z.get("op"), "rev24": b.get("rev"), "rev23": z.get("rev"), "cagr": cagr,
                     "pbr": c["mcap"] / te if te > 0 else None, "pop": c["mcap"] / op if op > 0 else None, "opm": op / rev if rev else None})
    # 1차 점수: 정밀 조회를 어디부터 할지 정하는 용도. 이익을 내는 회사 중 싸고 성장하는 순
    def pct(vals, v, rev=False):
        s = sorted(x for x in vals if x is not None)
        if v is None or not s:
            return 0.0
        k = sum(1 for x in s if x <= v) / len(s)
        return 1 - k if rev else k
    ok = [r for r in rows if r["op"] > 0 and (r["op24"] or 0) > 0]
    pops = [r["pop"] for r in ok]; pbrs = [r["pbr"] for r in ok]; gs = [r["cagr"] for r in ok]; ms = [r["opm"] for r in ok]
    for r in rows:
        r["s1"] = (0.35 * pct(pops, r["pop"], True) + 0.15 * pct(pbrs, r["pbr"], True) + 0.25 * pct(gs, r["cagr"]) + 0.25 * pct(ms, r["opm"])) if r in ok else -1
    rows.sort(key=lambda r: -r["s1"])
    json.dump(rows, open(os.path.join(CACHE, "stage1.json"), "w"), ensure_ascii=False)
    print(len(U), "universe ->", len(rows), "non-financial with 2025 data;", len(ok), "profitable 2y")
    from collections import Counter
    print(Counter(r["group"] for r in rows).most_common())

import re


def amt(it):
    return num(it.get("thstrm_amount")) or 0.0


def deep_fin(corp):
    for d in ("full", "full_ofs"):
        p = os.path.join(CACHE, d, corp + ".json")
        if os.path.exists(p):
            j = json.load(open(p))
            if j.get("status") == "000":
                return j["list"], ("CFS" if d == "full" else "OFS")
    return None, None


def pick(L, sj, pat, excl=r"및|할인|조정|할증|상환|증가|감소|처분|이자|평가|손상|환율|대손|순증", ids=()):
    seen = set(); tot = 0.0
    for it in L:
        if it["sj_div"] != sj:
            continue
        n = it["account_nm"].replace(" ", "")
        if (it["account_id"] in ids) or (re.search(pat, n) and not (excl and re.search(excl, n))):
            key = (n, it.get("thstrm_amount"))
            if key in seen:
                continue
            seen.add(key); tot += amt(it)
    return tot


def own(corp):
    h = json.load(open(os.path.join(CACHE, "hyslr", corp + ".json"))) if os.path.exists(os.path.join(CACHE, "hyslr", corp + ".json")) else {}
    st = json.load(open(os.path.join(CACHE, "stock", corp + ".json"))) if os.path.exists(os.path.join(CACHE, "stock", corp + ".json")) else {}
    mj = json.load(open(os.path.join(CACHE, "major", corp + ".json"))) if os.path.exists(os.path.join(CACHE, "major", corp + ".json")) else {}
    L = [x for x in h.get("list", []) if x.get("stock_knd", "").startswith("보통")]
    tot = next((x for x in L if x["nm"].replace(" ", "") == "계"), None)
    rows = [x for x in L if x["nm"].replace(" ", "") != "계"]
    top = max(rows, key=lambda x: num(x.get("trmend_posesn_stock_co")) or 0) if rows else None
    S = next((x for x in st.get("list", []) if x.get("se") == "보통주"), None)
    issued = num(S["istc_totqy"]) if S else None; tre = num(S["tesstk_co"]) if S else None
    grp_sh = num(tot["trmend_posesn_stock_co"]) if tot else None
    names = {x["nm"].replace(" ", "") for x in rows}
    last = {}
    for r in mj.get("list", []):
        k = r["repror"].replace(" ", "")
        if k not in last or r["rcept_dt"] >= last[k]["rcept_dt"]:
            last[k] = r
    others = sorted([(r["repror"], num(r["stkrt"])) for k, r in last.items() if k not in names and (num(r["stkrt"]) or 0) >= 5], key=lambda x: -x[1])
    vote = grp_sh / (issued - (tre or 0)) if grp_sh and issued and issued - (tre or 0) > 0 else None
    g = num(tot["trmend_posesn_stock_qota_rt"]) if tot else None
    if g is None and grp_sh and issued:
        g = 100 * grp_sh / issued
    return {"grp": g / 100 if g is not None else None, "vote": vote, "top": top["nm"] if top else None,
            "topRel": top.get("relate") if top else None, "issued": issued, "tre": tre, "treR": tre / issued if tre and issued else 0, "others": others[:3]}


def pctl(vals, v, low=False):
    s = sorted(x for x in vals if x is not None)
    if v is None or not s:
        return 0.5
    k = (sum(1 for x in s if x < v) + 0.5 * sum(1 for x in s if x == v)) / len(s)
    return 1 - k if low else k


def build():
    S1 = json.load(open(os.path.join(CACHE, "stage1.json")))
    allrows = {r["corp"]: r for r in S1}
    out = []
    for r in S1:
        L, fs = deep_fin(r["corp"])
        if L is None or not os.path.exists(os.path.join(CACHE, "hyslr", r["corp"] + ".json")):
            continue
        cash = pick(L, "BS", r"^현금및현금성자산$", None) + pick(L, "BS", r"^단기금융(상품|자산)$|^단기투자자산$", None)
        debt = pick(L, "BS", r"차입금$|사채$|리스부채$|유동성장기부채$|유동성장기차입금$")
        ocf = next((amt(it) for it in L if it["account_id"] == "ifrs-full_CashFlowsFromUsedInOperatingActivities"), None)
        capex = abs(pick(L, "CF", r"^유형자산의취득$|^무형자산의취득$", None))
        da = pick(L, "CF", r"^감가상각비$|^무형자산상각비$|^사용권자산상각비$|^감가상각비및무형자산상각비$", None)
        o = own(r["corp"])
        implied = r["mcap"] / r["price"]   # 지금 시가총액이 전제하는 주식 수
        if not o["issued"]:   # 주식 총수 자료가 없으면 시가총액 ÷ 주가로 대신한다
            o["issued"] = round(implied); o["tre"] = o["tre"] or 0
        elif not 0.8 <= o["issued"] / implied <= 1.25:   # 2025년 말 이후 분할·병합·증자나 단위 오류: 지금 주식 수로 바꾸고 자기주식 비율은 유지
            o["issued"] = round(implied); o["tre"] = round(o["treR"] * implied); o["sharesAdj"] = 1
        ev = r["mcap"] + debt - cash
        x = dict(r, cash=cash, debt=debt, ocf=ocf, capex=capex, da=da, ev=ev, fcf=(ocf - capex) if ocf is not None else None,
                 evebit=ev / r["op"] if r["op"] > 0 and ev > 0 else None, ebitda=r["op"] + da,
                 fcfy=(ocf - capex) / r["mcap"] if ocf is not None else None, netcash=(cash - debt) / r["mcap"], fsDeep=fs, **o)
        out.append(x)
    conflict = lambda x: x["group"] == "지주·투자" or any(k in x["name"] for k in EX["names"])   # 지주사는 자회사 합산 가치로 따로 본다   # 지주사는 자회사 합산 가치로 따로 봐야 해 뺀다
    # A. 경영권 거래 후보: 2년 연속 영업이익, 시가총액 1,000억~3조, 최대주주 등 지분 35% 미만, 지분 자료 있음
    A = [x for x in out if not conflict(x) and x["op"] > 0 and (x["op24"] or 0) > 0 and 1e11 <= x["mcap"] <= 3e12 and x["grp"] is not None and x["grp"] < 0.35 and x["evebit"] and x["opm"] >= 0.05 and x["netcash"] <= 0.7]   # 순현금이 시총의 70%를 넘으면 금융 자회사 현금이 섞였을 가능성이 커 뺀다
    V = lambda k: [y[k] for y in A]
    for x in A:
        sv = 0.5 * pctl(V("evebit"), x["evebit"], True) + 0.25 * pctl(V("fcfy"), x["fcfy"]) + 0.25 * pctl(V("pbr"), x["pbr"], True)
        sq = 0.4 * pctl(V("cagr"), x["cagr"]) + 0.4 * pctl(V("opm"), x["opm"]) + 0.2 * (1 if (x["op23"] or 0) > 0 else 0)
        sc = pctl(V("grp"), x["grp"], True)
        sf = pctl(V("netcash"), x["netcash"])
        x["sA"] = {"value": sv, "quality": sq, "contest": sc, "fund": sf, "total": 0.4 * sv + 0.25 * sq + 0.25 * sc + 0.1 * sf}
    A.sort(key=lambda x: -x["sA"]["total"])
    # B. 업종별 볼트온: 영업이익 흑자, 시가총액 1조 이하, 성장률 자료 있음
    B = [x for x in out if not conflict(x) and x["op"] > 0 and x["mcap"] <= 1e12 and x["cagr"] is not None and x["evebit"]]
    for g in {x["group"] for x in B}:
        G = [x for x in B if x["group"] == g]; W = lambda k: [y[k] for y in G]
        for x in G:
            path = 1.0 if x["grp"] is not None and 0.3 <= x["grp"] <= 0.7 else 0.5 if x["grp"] is not None and 0.2 <= x["grp"] < 0.3 else 0.2
            x["sB"] = {"growth": pctl(W("cagr"), x["cagr"]), "margin": pctl(W("opm"), x["opm"]), "value": pctl(W("evebit"), x["evebit"], True),
                       "path": path, "cash": 1.0 if (x["fcf"] or 0) > 0 else 0.0}
            b = x["sB"]; b["total"] = 0.3 * b["growth"] + 0.25 * b["margin"] + 0.2 * b["value"] + 0.15 * b["path"] + 0.1 * b["cash"]
    groups = {}
    for g in sorted({x["group"] for x in B}):
        G = sorted([x for x in B if x["group"] == g], key=lambda x: -x["sB"]["total"])
        if len(G) < 4 or g == "기타":
            continue
        big = sorted([y for y in S1 if y["group"] == g and not conflict(y)], key=lambda y: -y["mcap"])[:3]
        groups[g] = {"n": len(G), "top": [x["corp"] for x in G[:6]], "acq": [{"name": y["name"], "mcap": y["mcap"]} for y in big]}
    keep = {x["corp"] for x in A[:40]} | {c for g in groups.values() for c in g["top"]}
    F = ["name", "mkt", "group", "ind", "mcap", "price", "rev", "rev23", "op", "op24", "op23", "ni", "te", "ta", "cash", "debt", "ocf", "capex", "da", "ev", "evebit", "fcfy", "pbr", "opm", "cagr", "netcash", "grp", "vote", "top", "topRel", "issued", "tre", "treR", "others", "fsDeep", "est", "sharesAdj"]
    rnd = lambda v: round(v, 4) if isinstance(v, float) and abs(v) < 100 else (round(v) if isinstance(v, float) else v)
    cos = {x["corp"]: {k: rnd(x.get(k)) for k in F} for x in out if x["corp"] in keep}
    for x in out:
        if x["corp"] in cos:
            if "sA" in x: cos[x["corp"]]["sA"] = {k: round(v, 3) for k, v in x["sA"].items()}
            if "sB" in x: cos[x["corp"]]["sB"] = {k: round(v, 3) for k, v in x["sB"].items()}
    # 시장 지도용: 정밀 자료가 있는 회사 전체의 점(이름 없이 업종·지분·EV/EBIT만)
    dots = [[x["group"], rnd(x["grp"]), rnd(x["evebit"]), rnd(x["mcap"] / 1e8), 1 if x["corp"] in {y["corp"] for y in A[:20]} else 0] for x in out if x["grp"] is not None and x["evebit"] and not conflict(x)]
    meta = {"asof": "2026-11-25", "price": "네이버 증권 시가총액 목록(2026.11.25 장중)", "fin": "OpenDART 2025 사업보고서(연결 우선)", "listed": len(universe()), "universe": len(S1), "deep": len(out), "nA": len(A), "nB": len(B)}
    data = {"meta": meta, "A": [x["corp"] for x in A[:40]], "groups": groups, "cos": cos, "dots": dots}
    js = "/* 경영권 거래 후보 스크리닝 자료. examples/mna/screen.py build 로 만든다. 공시 숫자(원)와 시가총액만 담는다 */\n(function (root) { const D = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n  if (typeof module === \"object\" && module.exports) module.exports = D; else root.MNA_DATA = D; })(typeof self !== \"undefined\" ? self : this);\n"
    open(os.path.join(ROOT, "assets", "data", "mna-screen.js"), "w").write(js)
    print("deep", len(out), "A", len(A), "B", len(B), "groups", len(groups), "kb", len(js) // 1024)
    for x in A[:25]:
        print("%-12s %-10s mcap %6.0f억 EV/EBIT %5.1f FCFy %5.1f%% PBR %4.2f g %5.1f%% opm %5.1f%% 지분 %4.1f%% 순현금/시총 %5.1f%% %s" % (x["name"], x["group"], x["mcap"] / 1e8, x["evebit"], 100 * (x["fcfy"] or 0), x["pbr"] or 0, 100 * (x["cagr"] or 0), 100 * x["opm"], 100 * x["grp"], 100 * x["netcash"], x["top"]))
    for g, v in groups.items():
        print(g, "|", ", ".join(cos[c]["name"] for c in v["top"]), "| 인수자 후보:", ", ".join(a["name"] for a in v["acq"]))


if __name__ == "__main__":
    {"stage1": stage1, "build": build}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: print(__doc__))()

"""투자를 많이 늘린 제조업체는 3년 뒤 수익성이 좋아지나: cache/panel.csv → 결과(JSON)와 화면용 익명 데이터(JS).

실행: python3 examples/dart/analyze.py   (먼저 fetch_dart.py로 cache/panel.csv를 만든다)
필요: 표준 라이브러리만. 같은 계산을 브라우저 엔진(assets/engines/capexpanel.js)으로도 해서 검산 페이지에서 대조한다.

미리 정한 질문과 가설
 Q1 투자율(비유동자산 증가 ÷ 전년 말 총자산)이 높은 회사는 3년 뒤 ROA(영업이익 ÷ 총자산)가 올라가나?
    (비유동자산 = 유형·무형자산, 장기 투자 등. 현금흐름표의 설비투자액은 대량 조회 API에 없어 장부상 장기 투자 증가로 대신한다)
    실무 통념(가설): 그렇다. 많이 투자한 회사가 나중에 더 번다.
 Q2 그 관계는 '수익성이 높던 회사가 평균으로 돌아오는 현상'(평균 회귀)을 빼고도 남나?
 Q3 투자율은 3년 뒤 수익성 변화를 '평균 회귀만 쓴 예측'보다 더 잘 맞히나? (과거 자료만으로 표본 밖 예측)
 Q4 수익성이 아니라 매출 성장은 따라오나?

관측치: 회사 i, 연도 t(2016~2022). t-1, t, t+3의 사업보고서가 모두 있고 연결/별도 기준이 같아야 한다.
공개 데이터: 회사 이름·코드·금액은 빼고 연도·업종(2자리)·규모 10분위·비율만 남긴다(소수 다섯째 자리).
"""
import csv, json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.environ.get("PANEL_CSV") or os.path.join(HERE, "cache", "panel.csv")
Y0, Y1, H = 2016, 2022, 3
COLS = ["year", "ind", "size", "roa0", "roa3", "inv", "ag", "g0", "sg3"]


def fnum(s):
    return None if s in ("", None) else float(s)


def build():
    """패널 → 관측치(익명). 규모 10분위는 연도 안에서 총자산 순위로 매긴다."""
    P = {}
    for r in csv.DictReader(open(SRC)):
        P[(r["corp_code"], int(r["year"]))] = r
    obs = []
    for (c, t), r in P.items():
        if not (Y0 <= t <= Y1):
            continue
        a, b = P.get((c, t - 1)), P.get((c, t + H))
        if not a or not b or not (a["fs"] == r["fs"] == b["fs"]):
            continue
        A0, A1, A3 = fnum(a["assets"]), fnum(r["assets"]), fnum(b["assets"])
        R0, R1, R3 = fnum(a["revenue"]), fnum(r["revenue"]), fnum(b["revenue"])
        O1, O3, N0, N1 = fnum(r["op"]), fnum(b["op"]), fnum(a["nca"]), fnum(r["nca"])
        if None in (A0, A1, A3, R0, R1, R3, O1, O3, N0, N1) or min(A0, A1, A3, R0, R1, R3) <= 0:
            continue
        obs.append({"year": t, "ind": int(r["induty"][:2]), "assets": A1, "roa0": O1 / A1, "roa3": O3 / A3, "inv": (N1 - N0) / A0, "ag": A1 / A0 - 1,
                    "g0": R1 / R0 - 1, "sg3": (R3 / R1) ** (1 / H) - 1, "firm": c})
    for t in range(Y0, Y1 + 1):
        g = sorted([o for o in obs if o["year"] == t], key=lambda o: o["assets"])
        for i, o in enumerate(g):
            o["size"] = i * 10 // len(g) + 1
    obs.sort(key=lambda o: (o["year"], o["ind"], o["size"], o["roa0"]))
    rows = [[o["year"], o["ind"], o["size"]] + [round(o[k], 5) for k in COLS[3:]] for o in obs]
    return rows, len({o["firm"] for o in obs})


# ---------- 통계 도구 (브라우저 엔진과 같은 식) ----------
def mean(v):
    return sum(v) / len(v)


def winsor(v, p=0.01):
    """가장 가까운 순위 방식: 아래 floor(p(n-1))번째, 위 ceil((1-p)(n-1))번째 값으로 자른다."""
    s = sorted(v); n = len(s)
    lo, hi = s[int(math.floor(p * (n - 1)))], s[int(math.ceil((1 - p) * (n - 1)))]
    return [min(max(x, lo), hi) for x in v]


def solve(A, b):
    """가우스 소거(부분 피벗)."""
    n = len(b); M = [A[i][:] + [b[i]] for i in range(n)]
    for k in range(n):
        p = max(range(k, n), key=lambda i: abs(M[i][k])); M[k], M[p] = M[p], M[k]
        for i in range(k + 1, n):
            f = M[i][k] / M[k][k]
            for j in range(k, n + 1):
                M[i][j] -= f * M[k][j]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (M[i][n] - sum(M[i][j] * x[j] for j in range(i + 1, n))) / M[i][i]
    return x


def ols(X, y):
    k = len(X[0])
    A = [[sum(r[i] * r[j] for r in X) for j in range(k)] for i in range(k)]
    b = [sum(r[i] * yy for r, yy in zip(X, y)) for i in range(k)]
    return solve(A, b)


def nw_t(b, L=2):
    """연도별 계수의 평균과 t값: 단순(표준편차/√T)과 뉴이-웨스트(겹치는 3년 구간 때문에 시차 2까지 보정)."""
    T = len(b); m = mean(b); e = [x - m for x in b]
    g = lambda l: sum(e[t] * e[t - l] for t in range(l, T)) / T
    v_nw = g(0) + 2 * sum((1 - l / (L + 1)) * g(l) for l in range(1, L + 1))
    sd = math.sqrt(sum(x * x for x in e) / (T - 1))
    return {"mean": m, "t": m / (sd / math.sqrt(T)), "t_nw": m / math.sqrt(max(v_nw, 1e-300) / T)}


def prep(rows):
    """연도별 1%·99% 절단 후 ΔROA = ROA(t+3) − ROA(t). 업종 효과 제거는 (연도, 업종) 평균을 뺀다(5곳 미만 업종은 '기타'로 묶음)."""
    D = [dict(zip(COLS, r)) for r in rows]
    years = sorted({d["year"] for d in D})
    for t in years:
        g = [d for d in D if d["year"] == t]
        for k in ["roa0", "roa3", "inv", "ag", "g0", "sg3"]:
            w = winsor([d[k] for d in g])
            for d, x in zip(g, w):
                d[k + "_w"] = x
        cnt = {}
        for d in g:
            cnt[d["ind"]] = cnt.get(d["ind"], 0) + 1
        for d in g:
            d["grp"] = d["ind"] if cnt[d["ind"]] >= 5 else 0
    for d in D:
        d["droa"] = d["roa3_w"] - d["roa0_w"]
    return D, years


VARS = {"M0": ["roa0_w"], "M1": ["inv_w"], "M2": ["inv_w", "roa0_w", "size", "g0_w"], "M3": ["ag_w", "roa0_w", "size", "g0_w"]}


def demean(g, keys):
    """(연도, 업종) 안에서 평균을 뺀 값"""
    s = {}
    for d in g:
        q = s.setdefault(d["grp"], {k: 0.0 for k in keys + ["n"]})
        q["n"] += 1
        for k in keys:
            q[k] += d[k]
    return [{k: d[k] - s[d["grp"]][k] / s[d["grp"]]["n"] for k in keys} for d in g]


def fama_macbeth(D, years, model, fe):
    xs = VARS[model]; coefs = []
    for t in years:
        g = [d for d in D if d["year"] == t]
        z = demean(g, xs + ["droa"]) if fe else [{k: d[k] for k in xs + ["droa"]} for d in g]
        coefs.append(ols([[1.0] + [q[k] for k in xs] for q in z], [q["droa"] for q in z]))
    return {"vars": xs, "by_year": coefs, "stats": [nw_t([c[j + 1] for c in coefs]) for j in range(len(xs))]}


def quintiles(D, years, key="inv_w"):
    """연도 안에서 투자율 순위로 5분위. 분위별 평균을 연도마다 낸 뒤 연도 평균. 잔차 = ΔROA − (그해 평균 회귀식 예측)."""
    out = {k: [[] for _ in range(5)] for k in ["inv", "roa0", "droa", "resid", "sg3"]}
    spread = {"droa": [], "resid": [], "sg3": []}
    for t in years:
        g = sorted([d for d in D if d["year"] == t], key=lambda d: (d[key], d["roa0_w"]))
        a, b = ols([[1.0, d["roa0_w"]] for d in g], [d["droa"] for d in g])
        n = len(g); qs = [[] for _ in range(5)]
        for i, d in enumerate(g):
            qs[i * 5 // n].append(d)
        m = {}
        for q in range(5):
            m[q] = {"inv": mean([d["inv_w"] for d in qs[q]]), "roa0": mean([d["roa0_w"] for d in qs[q]]), "droa": mean([d["droa"] for d in qs[q]]),
                    "resid": mean([d["droa"] - a - b * d["roa0_w"] for d in qs[q]]), "sg3": mean([d["sg3_w"] for d in qs[q]])}
            for k in out:
                out[k][q].append(m[q][k])
        for k in spread:
            spread[k].append(m[4][k] - m[0][k])
    return {"mean": {k: [mean(v) for v in out[k]] for k in out}, "spread": {k: nw_t(v) for k, v in spread.items()}}


def oos(D, years, first=2019):
    """표본 밖 예측: 대상 연도 t의 ΔROA는 t+3에야 확정되므로, t 시점에 알 수 있는 것은 t−3년 이전 관측치의 결과뿐이다.
    그 자료로 합동 OLS를 추정해 t년 관측치의 3년 뒤 ΔROA를 예측한다. 비교: 평균 회귀만(M0) vs 투자율 등 추가(M2)."""
    res = []
    for t in [y for y in years if y >= first]:
        tr = [d for d in D if d["year"] <= t - H]; te = [d for d in D if d["year"] == t]
        r = {"year": t, "n": len(te)}
        for m in ["M0", "M2"]:
            xs = VARS[m]; b = ols([[1.0] + [d[k] for k in xs] for d in tr], [d["droa"] for d in tr])
            pred = [b[0] + sum(b[j + 1] * d[k] for j, k in enumerate(xs)) for d in te]
            r[m] = sum(abs(p - d["droa"]) for p, d in zip(pred, te)) / len(te)
        r["naive"] = sum(abs(d["droa"]) for d in te) / len(te)   # 'ROA 그대로 유지' 예측
        res.append(r)
    tot = sum(r["n"] for r in res)
    w = {k: sum(r[k] * r["n"] for r in res) / tot for k in ["M0", "M2", "naive"]}
    return {"years": res, "mae": w, "wins": sum(1 for r in res if r["M2"] < r["M0"])}


def deciles_roa(D, years):
    """평균 회귀 그림: 연도 안 ROA(t) 10분위별 ΔROA 평균의 연도 평균"""
    acc = [[] for _ in range(10)]; x = [[] for _ in range(10)]
    for t in years:
        g = sorted([d for d in D if d["year"] == t], key=lambda d: (d["roa0_w"], d["inv_w"])); n = len(g)
        qs = [[] for _ in range(10)]
        for i, d in enumerate(g):
            qs[i * 10 // n].append(d)
        for q in range(10):
            acc[q].append(mean([d["droa"] for d in qs[q]])); x[q].append(mean([d["roa0_w"] for d in qs[q]]))
    return {"roa0": [mean(v) for v in x], "droa": [mean(v) for v in acc]}


def main():
    rows, n_firms = build()
    D, years = prep(rows)
    fm = {m + ("_fe" if fe else ""): fama_macbeth(D, years, m, fe) for m in VARS for fe in (False, True)}
    qt = quintiles(D, years)
    oo = oos(D, years)
    dr = deciles_roa(D, years)
    res = {"n_obs": len(rows), "n_firms": n_firms, "years": years, "fm": fm, "quint": qt, "oos": oo, "roa_dec": dr}
    json.dump(res, open(os.path.join(HERE, "result.json"), "w"), ensure_ascii=False, indent=1)
    S = lambda m, j: fm[m]["stats"][j]
    py = {"n": len(rows), "m1_b": S("M1", 0)["mean"], "m1_t": S("M1", 0)["t_nw"], "m0_b": S("M0", 0)["mean"],
          "m2_inv": S("M2_fe", 0)["mean"], "m2_inv_t": S("M2_fe", 0)["t_nw"], "m2_inv_t0": S("M2_fe", 0)["t"], "m2_roa": S("M2_fe", 1)["mean"], "m3_ag": S("M3_fe", 0)["mean"], "m3_ag_t": S("M3_fe", 0)["t_nw"],
          "q_droa": qt["spread"]["droa"]["mean"], "q_resid": qt["spread"]["resid"]["mean"], "q_resid_t": qt["spread"]["resid"]["t_nw"], "q_sg3": qt["spread"]["sg3"]["mean"],
          "oos_m0": oo["mae"]["M0"], "oos_m2": oo["mae"]["M2"], "oos_naive": oo["mae"]["naive"], "oos_wins": oo["wins"]}
    meta = {"n_firms": n_firms, "years": [years[0], years[-1]], "source": "OpenDART 다중회사 주요계정(사업보고서)"}
    data = {"py": py, "meta": meta, "cols": COLS, "rows": rows}
    with open(os.path.join(ROOT, "assets", "data", "capex-panel.js"), "w") as f:
        f.write("/* 코스피 제조업 관측치(회사 이름·코드·금액 없음). examples/dart/fetch_dart.py → analyze.py로 만듦. 손으로 고치지 않는다. */\n")
        f.write("(function (root) { const D = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
        f.write("  if (typeof module === \"object\" && module.exports) module.exports = D; else root.CapexPanelData = D; })(typeof self !== \"undefined\" ? self : this);\n")
    print(json.dumps({"n_firms": n_firms, **py}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()

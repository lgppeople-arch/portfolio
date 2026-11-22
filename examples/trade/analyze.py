"""반도체 장비 수출입으로 업황 읽기: comtrade_monthly.csv → 분석 결과(JSON)와 화면용 데이터(JS).

실행: python3 examples/trade/analyze.py
필요: 표준 라이브러리만(설치 없음). 결과는 브라우저 엔진(assets/engines/tradelead.js)과 같은 식으로 계산해,
검산 페이지에서 두 언어의 답이 같은지 대조한다.

질문
 Q1 한국 메모리 수출(HS 854232)과 한국 장비 수입(HS 8486) 중 어느 쪽이 몇 달 앞서는가
    (처음 가설: 메모리가 앞선다. 결과: 반대로 장비가 약 6개월 앞섰다)
 Q2 앞서는 쪽으로 6개월 뒤를 예측하면 '지금 값 유지(나이브)'보다 나은가 (과거 구간 표본 밖 검증, 두 방향 모두)
 Q3 세계 장비 수요에서 중국과 한국 수입의 몫은 어떻게 바뀌었나

변환: 3개월 합계의 전년 동기 대비 증가율(%). 계절성과 월별 잡음을 줄인다.
"""
import csv, json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, "comtrade_monthly.csv")


def load():
    s = {}
    for r in csv.DictReader(open(SRC)):
        key = r["reporter"] + "_" + r["flow"] + "_" + r["hs"]
        s.setdefault(key, {})[r["period"]] = float(r["value_usd"])
    return s


def month_list(a, b):
    y, m = int(a[:4]), int(a[4:]); out = []
    while y * 100 + m <= int(b):
        out.append("%04d%02d" % (y, m)); m += 1
        if m > 12: y, m = y + 1, 1
    return out


def yoy3(vals):
    """3개월 합계의 전년 동기 대비 증가율(%). 앞 14개월은 None."""
    out = [None] * len(vals)
    for i in range(14, len(vals)):
        a, b = vals[i - 2:i + 1], vals[i - 14:i - 11]
        if None in a or None in b or sum(b) <= 0: continue
        out[i] = (sum(a) / sum(b) - 1) * 100
    return out


def corr(x, y):
    n = len(x); mx = sum(x) / n; my = sum(y) / n
    sxy = sum((a - mx) * (b - my) for a, b in zip(x, y)); sxx = sum((a - mx) ** 2 for a in x); syy = sum((b - my) ** 2 for b in y)
    return sxy / math.sqrt(sxx * syy)


def pairs(x, y, k):
    """x(t)와 y(t+k)의 짝. 둘 다 값이 있는 달만."""
    out = []
    for t in range(len(x)):
        if 0 <= t + k < len(y) and x[t] is not None and y[t + k] is not None:
            out.append((x[t], y[t + k]))
    return out


def ac1(v):
    v = [a for a in v if a is not None]; return corr(v[:-1], v[1:])


def xcorr(x, y, maxlag):
    rows = []
    for k in range(-maxlag, maxlag + 1):
        p = pairs(x, y, k)
        rows.append({"lag": k, "r": corr([a for a, _ in p], [b for _, b in p]), "n": len(p)})
    return rows


def ols(xs, ys):
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    b = sum((a - mx) * (c - my) for a, c in zip(xs, ys)) / sum((a - mx) ** 2 for a in xs)
    return my - b * mx, b


def backtest(x, y, lag, horizon, start):
    """표본 밖 예측: 시점 t에서 알 수 있는 자료만으로 y(t+h)를 예측.
    모형: y(s) = a + b·x(s − lag)를 s ≤ t 자료로 추정한 뒤, y(t+h) = a + b·x(t+h−lag) (lag ≥ h이면 x는 이미 관측됨).
    비교: 나이브 y(t+h) = y(t)."""
    out = []
    for t in range(start, len(y) - horizon):
        tr = [(x[s - lag], y[s]) for s in range(lag, t + 1) if x[s - lag] is not None and y[s] is not None]
        xi = t + horizon - lag
        if len(tr) < 24 or xi > t or x[xi] is None or y[t + horizon] is None or y[t] is None: continue
        a, b = ols([p[0] for p in tr], [p[1] for p in tr])
        out.append({"t": t, "actual": y[t + horizon], "model": a + b * x[xi], "naive": y[t]})
    def score(key):
        e = [abs(r[key] - r["actual"]) for r in out]
        hit = [((r[key] - r["naive"]) * (r["actual"] - r["naive"]) > 0) if key != "naive" else None for r in out]
        return {"mae": sum(e) / len(e), "hit": (sum(1 for h in hit if h) / len(hit)) if key != "naive" else None}
    return {"n": len(out), "model": score("model"), "naive": score("naive"), "rows": out}


def diff1(v):
    return [None if i == 0 or v[i] is None or v[i - 1] is None else v[i] - v[i - 1] for i in range(len(v))]


def sig_test(x, y, k):
    """x(t)와 y(t+k)의 상관과, 두 계열의 1차 자기상관으로 줄인 유효 표본 수·기준(±2/√n_eff)"""
    p = pairs(x, y, k); a1, a2 = ac1(x), ac1(y)
    n_eff = len(p) * (1 - a1 * a2) / (1 + a1 * a2)
    return {"lag": k, "r": corr([q[0] for q in p], [q[1] for q in p]), "n": len(p), "ac1": [a1, a2], "n_eff": n_eff, "thr": 2 / math.sqrt(max(n_eff, 3))}


def main():
    s = load()
    last = max(p for v in s.values() for p in v)
    ms = month_list("201501", last)
    # 마지막 달에 핵심 계열이 비어 있으면(늦게 집계되는 나라) 그 달은 뺀다
    core = ["KOR_X_854232", "KOR_M_8486"]
    while any(ms[-1] not in s.get(k, {}) for k in core): ms.pop()
    # 공개하는 화면용 데이터와 같은 값(백만 달러, 소수 셋째 자리)으로 계산해 브라우저 엔진과 답을 맞춘다
    ser = {k: [None if s[k].get(m) is None else round(s[k][m] / 1e6, 3) for m in ms] for k in s}
    mem, eq = yoy3(ser["KOR_X_854232"]), yoy3(ser["KOR_M_8486"])
    # 시차 k: 메모리(t)와 장비(t+k). k > 0이면 메모리가 앞섬, k < 0이면 장비가 앞섬
    xc = xcorr(mem, eq, 12)
    peak = max(xc, key=lambda r: r["r"])
    # 증가율은 자기상관이 매우 높아(0.9 이상) 수준끼리의 상관은 우연과 구별하기 어렵다 → 월간 변화(차분)로 검정
    dm, de = diff1(mem), diff1(eq)
    xcd = xcorr(dm, de, 12)
    peak_d = max(xcd, key=lambda r: r["r"])
    test_h1 = sig_test(dm, de, 6)            # 처음 가설: 메모리가 6개월 앞선다
    test_h2 = sig_test(dm, de, peak_d["lag"])  # 데이터가 보여 준 방향
    start = ms.index("202001")
    lead = abs(peak_d["lag"])
    bt1 = backtest(mem, eq, 6, 6, start)        # 메모리 → 6개월 뒤 장비
    bt2 = backtest(eq, mem, max(lead, 6), 6, start)  # 장비 → 6개월 뒤 메모리
    sup = ["JPN_X_8486", "NLD_X_8486", "USA_X_8486"]
    def year_sum(k, yr): return sum(v for m, v in s.get(k, {}).items() if m.startswith(str(yr)))
    comp = []
    for yr in sorted({int(m[:4]) for m in ms}):
        if sum(1 for m in s.get("CHN_M_8486", {}) if m.startswith(str(yr))) < 12: continue
        supply = sum(year_sum(k, yr) for k in sup)
        comp.append({"year": yr, "chn": year_sum("CHN_M_8486", yr) / supply * 100, "kor": year_sum("KOR_M_8486", yr) / supply * 100})
    slim = lambda b: {k: v for k, v in b.items() if k != "rows"}
    res = {"months": [ms[0], ms[-1]], "n_months": len(ms), "level_peak": peak, "diff_peak": peak_d, "test_h1": test_h1, "test_h2": test_h2,
           "xcorr": xc, "xcorr_diff": xcd, "bt_mem_to_eq": slim(bt1), "bt_eq_to_mem": slim(bt2), "comp": comp}
    json.dump(res, open(os.path.join(HERE, "result.json"), "w"), ensure_ascii=False, indent=1)
    # 화면용 데이터: 월별 원자료(백만 달러)
    keys = ["KOR_X_854232", "KOR_M_8486", "CHN_M_8486", "JPN_X_8486", "NLD_X_8486", "USA_X_8486"]
    py = {"level_lag": peak["lag"], "level_r": peak["r"], "diff_lag": peak_d["lag"], "diff_r": peak_d["r"], "h1_r": test_h1["r"], "h1_thr": test_h1["thr"], "h2_thr": test_h2["thr"], "bt1_mae": bt1["model"]["mae"], "bt1_naive": bt1["naive"]["mae"], "bt1_hit": bt1["model"]["hit"], "bt2_mae": bt2["model"]["mae"], "bt2_naive": bt2["naive"]["mae"], "bt2_hit": bt2["model"]["hit"], "n_bt": bt2["n"]}
    data = {"py": py, "months": ms, "series": {k: ser.get(k, [None] * len(ms)) for k in keys}}
    with open(os.path.join(ROOT, "assets", "data", "trade-semi.js"), "w") as f:
        f.write("/* UN Comtrade 월별 교역액(백만 달러). examples/trade/fetch_comtrade.py → analyze.py로 만듦. 손으로 고치지 않는다. */\n")
        f.write("(function (root) { const D = " + json.dumps(data, separators=(",", ":")) + ";\n")
        f.write("  if (typeof module === \"object\" && module.exports) module.exports = D; else root.TradeSemi = D; })(typeof self !== \"undefined\" ? self : this);\n")
    print(json.dumps(py, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()

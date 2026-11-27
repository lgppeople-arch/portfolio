"""외국인 매매와 주가: 삼성전자·SK하이닉스 60거래일(2026.8.31~11.25).

  python3 examples/memflow/flows.py      # 회귀와 누적 분해 → assets/data/mem-flows.js

- 매매 수량: 네이버 증권 일별 투자자별 순매수(naver_trend.txt, 2026.11.27 수집)
- 가격: 금융위원회 주식시세정보 한국거래소 종가(official.json). 네이버 종가는 대체거래소 시간외까지 반영해 다르므로 쓰지 않는다
- 순매수 금액 = 순매수 수량 × 그날 종가(근사). 같은 날의 매매와 수익률이라 '외국인이 팔아서 내렸다'와
  '내려서 팔았다'를 가르지 못한다(인과가 아니라 동행 관계)
"""
import json, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OFF = json.load(open(os.path.join(HERE, "official.json")))
rows = {}
for ln in open(os.path.join(HERE, "naver_trend.txt")):
    if ln.startswith("#") or not ln.strip():
        continue
    c, d, f, o, i, h = ln.split()
    rows.setdefault(c, {})[d] = (int(f), int(o), int(i), float(h))

def ols(x, y):
    n = len(x); mx = sum(x) / n; my = sum(y) / n
    sxx = sum((a - mx) ** 2 for a in x); sxy = sum((a - mx) * (b - my) for a, b in zip(x, y)); syy = sum((b - my) ** 2 for b in y)
    b = sxy / sxx; a = my - b * mx; r2 = sxy * sxy / (sxx * syy)
    res = [yy - a - b * xx for xx, yy in zip(x, y)]; se = math.sqrt(sum(e * e for e in res) / (n - 2) / sxx)
    return {"a": a, "b": b, "r2": r2, "t": b / se, "n": n}

def month(ser):
    m = {}
    for s in ser:
        k = s["d"][:6]; x = m.setdefault(k, {"f": 0, "o": 0, "i": 0, "r": 1.0, "n": 0})
        x["f"] += s["f"]; x["o"] += s["o"]; x["i"] += s["i"]; x["r"] *= 1 + s["ret"]; x["n"] += 1
    return [[k, round(v["f"], 2), round(v["o"], 2), round(v["i"], 2), round(-(v["f"] + v["o"] + v["i"]), 2), round(v["r"] - 1, 4), v["n"]] for k, v in sorted(m.items()) if v["n"] >= 5]


out = {}
for code, name in (("000660", "SK하이닉스"), ("005930", "삼성전자")):
    days = sorted(d for d in rows[code] if d in OFF[code])
    allp = sorted(OFF[code])
    ser = []
    for d in days:
        k = allp.index(d)
        if k == 0:
            continue
        p, p0 = OFF[code][d][0], OFF[code][allp[k - 1]][0]
        mcap = OFF[code][d][2]
        f, o, i, h = rows[code][d]
        ser.append({"d": d, "ret": p / p0 - 1, "f": f * p / 1e12, "o": o * p / 1e12, "i": i * p / 1e12, "fp": f * p / mcap * 100, "hold": h, "p": p})
    fx = [s["f"] for s in ser]; ox = [s["o"] for s in ser]; rx = [s["ret"] for s in ser]
    reg = ols(fx, rx); rego = ols(ox, rx)
    p0 = OFF[code][allp[allp.index(ser[0]["d"]) - 1]][0]; p1 = ser[-1]["p"]
    cum = sum(fx); move = p1 / p0 - 1
    out[code] = {"name": name, "from": ser[0]["d"], "to": ser[-1]["d"], "n": len(ser), "p0": p0, "p1": p1, "move": move,
                 "cumF": cum, "cumO": sum(ox), "cumI": sum(s["i"] for s in ser), "holdFrom": ser[0]["hold"], "holdTo": ser[-1]["hold"],
                 "beta": reg["b"], "r2": reg["r2"], "t": reg["t"], "alpha": reg["a"], "r2Org": rego["r2"],
                 "explained": reg["b"] * cum, "month": month(ser), "series": [[s["d"], round(s["ret"], 5), round(s["f"], 4), round(s["o"], 4), s["hold"]] for s in ser]}
    print(name, "%s~%s n=%d 주가 %+.1f%% 외국인 누적 %.2f조 기관 %.2f조 개인 %.2f조 보유율 %.2f→%.2f" % (ser[0]["d"], ser[-1]["d"], len(ser), move * 100, cum, sum(ox), out[code]["cumI"], ser[0]["hold"], ser[-1]["hold"]))
    print("   일별 수익률 = %.4f + %.4f × 외국인 순매수(조원)  R²=%.2f t=%.1f   기관 R²=%.2f   외국인 누적×기울기 = %+.1f%%" % (reg["a"], reg["b"], reg["r2"], reg["t"], rego["r2"], reg["b"] * cum * 100))
js = "/* 외국인 매매와 주가(60거래일). examples/memflow/flows.py 로 만든다 */\n(function (root) { const D = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n  if (typeof module === \"object\" && module.exports) module.exports = D; else root.MEM_FLOWS = D; })(typeof self !== \"undefined\" ? self : this);\n"
open(os.path.join(ROOT, "assets", "data", "mem-flows.js"), "w").write(js)

"""월 손익 보고를 pandas로 다시 계산한다.

사이트의 월 손익 보고 도구(tools/pl-report.html)와 같은 입력(sample_pl.csv)으로
누계 손익과 영업이익 차이 분해를 계산해, 두 결과가 같은지 확인하는 용도다.

    python examples/pl_report.py --as-of 9
"""
import argparse
from pathlib import Path

import pandas as pd

KEY = {"매출액": "rev", "재료비": "mat", "노무비": "lab", "제조경비": "ovh", "판매관리비": "sga"}


def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"기간": str})
    df["월"] = df["기간"].str[5:7].astype(int)
    df["항목"] = df["계정"].map(KEY)
    return df


def pnl(frame: pd.DataFrame, col: str) -> pd.Series:
    """계정별 합계를 손익 항목으로 바꾼다."""
    v = frame.groupby("항목")[col].sum().reindex(KEY.values(), fill_value=0.0)
    cogs = v["mat"] + v["lab"] + v["ovh"]
    op = v["rev"] - cogs - v["sga"]
    return pd.concat([v, pd.Series({"cogs": cogs, "op": op, "cmr": (v["rev"] - v["mat"]) / v["rev"]})])


def bridge(p: pd.Series, a: pd.Series) -> pd.Series:
    """영업이익 차이를 매출 증감, 공헌이익률 변화, 고정비 항목으로 나눈다. 합계 = 영업이익 차이."""
    return pd.Series({
        "매출 증감": (a["rev"] - p["rev"]) * p["cmr"],
        "공헌이익률 변화": (a["cmr"] - p["cmr"]) * a["rev"],
        "노무비": p["lab"] - a["lab"],
        "제조경비": p["ovh"] - a["ovh"],
        "판매관리비": p["sga"] - a["sga"],
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", type=int, default=9, help="기준월(누계 마지막 달)")
    ap.add_argument("--csv", type=Path, default=Path(__file__).with_name("sample_pl.csv"))
    args = ap.parse_args()

    df = load(args.csv)
    ytd = df[df["월"] <= args.as_of]
    rows = []
    for scope, part in [("전사", ytd)] + [(bu, g) for bu, g in ytd.groupby("사업부")]:
        p, a = pnl(part, "계획"), pnl(part, "실적")
        b = bridge(p, a)
        assert abs(b.sum() - (a["op"] - p["op"])) < 1e-9  # 분해 합 = 영업이익 차이
        rows.append({"범위": scope, "누계 매출 계획": p["rev"], "누계 매출 실적": a["rev"],
                     "누계 영업이익 계획": p["op"], "누계 영업이익 실적": a["op"], **b.to_dict()})

    out = pd.DataFrame(rows).set_index("범위").round(1)
    with pd.option_context("display.max_columns", None, "display.width", 200):
        print(f"{args.as_of}월 누계 손익과 영업이익 차이 분해 (억원)")
        print(out.to_string())


if __name__ == "__main__":
    main()

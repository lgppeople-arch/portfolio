"""export-pdf.js가 만든 화면별 PDF를 표지·목차와 함께 하나로 묶는다.
목차의 각 줄은 해당 쪽으로 가는 링크이고, 화면마다 책갈피를 단다.
사용법: python3 scripts/merge-pdf.py <출력 폴더>"""
import json
import os
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, FloatObject, NameObject, NumberObject

out = sys.argv[1]
front = json.load(open(os.path.join(out, "_front.json"), encoding="utf-8"))
w = PdfWriter()
w.append(PdfReader(os.path.join(out, "_front.pdf")))
for d in front["docs"]:
    w.append(PdfReader(os.path.join(out, d["name"] + ".pdf")), import_outline=False)

w.add_outline_item("표지", 0)
w.add_outline_item("목차", 1)
for d in front["docs"]:
    w.add_outline_item(f"{d['name'][:2]} {d['title']}", d["start"] - 1)

# 목차 줄 → 해당 쪽. 화면 좌표(px, 위에서부터)를 PDF 좌표(pt, 아래에서부터)로 바꾼다
toc = w.pages[1]
height = float(toc.mediabox.height)
annots = toc.get("/Annots")
if annots is None:
    annots = ArrayObject()
    toc[NameObject("/Annots")] = annots
for (x1, y1, x2, y2), d in zip(front["rects"], front["docs"]):
    link = DictionaryObject({
        NameObject("/Type"): NameObject("/Annot"),
        NameObject("/Subtype"): NameObject("/Link"),
        NameObject("/Rect"): ArrayObject([FloatObject(x1 * 0.75), FloatObject(height - y2 * 0.75), FloatObject(x2 * 0.75), FloatObject(height - y1 * 0.75)]),
        NameObject("/Border"): ArrayObject([NumberObject(0)] * 3),
        NameObject("/Dest"): ArrayObject([w.pages[d["start"] - 1].indirect_reference, NameObject("/Fit")]),
    })
    annots.append(w._add_object(link))

w.add_metadata({"/Title": "이기표 · 재무기획 포트폴리오 화면 PDF 모음", "/Author": "이기표"})
w.page_mode = "/UseOutlines"
target = os.path.join(out, "이기표_포트폴리오_전체화면.pdf")
with open(target, "wb") as f:
    w.write(f)
print(f"합본: {target} ({len(w.pages)}쪽, {os.path.getsize(target) // 1024}KB)")

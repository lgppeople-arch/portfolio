# 작업 안내 (Claude Code용)

이 저장소는 이기표 재무기획 포트폴리오(GitHub Pages)입니다. 페이지를 고치거나 더할 때 아래 순서를 지킵니다.

## 고친 뒤 반드시 돌릴 것

```
python3 scripts/build-site.py   # 메뉴·모음·읽는 경로·하단 '이어서 볼 것'을 site-map.json에서 다시 만든다
node assets/checks.js           # 계산 엔진 검산 (현재 243개)
node scripts/check-site.js      # 사이트 구성 검사 (현재 26개)
```

## 페이지를 더하거나 뺄 때

1. `scripts/site-map.json`에 페이지 항목, 메뉴, 읽는 경로를 넣는다. 메뉴와 경로를 직접 HTML에서 고치지 않는다.
2. `scripts/make-og.js`와 `scripts/export-pdf.js`의 목록에 넣고, 미리보기 이미지 `assets/og/<이름>.png`를 만든다.
3. 계산이 있으면 엔진은 `assets/engines/`에 UMD로 두고, `assets/checks.js`와 `tools/checks.html`에 검산을 단다.
4. `README.md` 표와 `scripts/profile.html`의 개수 문구를 맞춘다.

## 최근 변경: 메모리 사이클 시나리오 가치평가 v2 (2026-11-25)

- v1(2026-11-20, 변수 8개)을 v2로 다시 설계했습니다.
- 파일:
  - `tools/mem-scenario.html`: 화면(리포트 형식)
  - `assets/mem-scenario.js`: 화면 스크립트
  - `assets/engines/memscen.js`: 계산 엔진
  - `docs/mem-scenario-model.md`: 모형 설명
- 내용:
  - 변수 9개 × 5단계(1,953,125개 조합)를 고릅니다.
  - 범용 D램·HBM·낸드의 수요·공급을 따로 세우고, HBM 웨이퍼 잠식을 넣었습니다.
  - 이어서 LTA → 회사별 제품 손익 → 잔여이익모델 적정주가를 계산합니다.
  - 대표 시나리오 5개, 상관을 넣은 몬테카를로(가우스 코퓰러), 주가 역산을 함께 보여 줍니다.
- 모형을 고치기 전에 `docs/mem-scenario-model.md`를 먼저 읽습니다. 그 문서에 계산식, 변수 정의, 출처, 분기 갱신 순서, 한계가 있습니다.
- 분기 실적이 나오면 `CO.skh/sec`의 `exit`·`costR`·`q3`·`bps0`·`shares`·`price`를 갱신합니다. 이때 화면의 기준일 문구도 함께 고칩니다.

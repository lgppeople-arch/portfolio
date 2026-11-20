# 작업 안내 (Claude Code용)

이 저장소는 이기표 재무기획 포트폴리오(GitHub Pages)입니다. 페이지를 고치거나 더할 때 아래 순서를 지킵니다.

## 고친 뒤 반드시 돌릴 것

```
python3 scripts/build-site.py   # 메뉴·모음·읽는 경로·하단 '이어서 볼 것'을 site-map.json에서 다시 만든다
node assets/checks.js           # 계산 엔진 검산 (현재 212개)
node scripts/check-site.js      # 사이트 구성 검사 (현재 26개)
```

## 페이지를 더하거나 뺄 때

1. `scripts/site-map.json`에 페이지 항목, 메뉴, 읽는 경로를 넣는다. 메뉴와 경로를 직접 HTML에서 고치지 않는다.
2. `scripts/make-og.js`와 `scripts/export-pdf.js`의 목록에 넣고, 미리보기 이미지 `assets/og/<이름>.png`를 만든다.
3. 계산이 있으면 엔진은 `assets/engines/`에 UMD로 두고, `assets/checks.js`와 `tools/checks.html`에 검산을 단다.
4. `README.md` 표와 `scripts/profile.html`의 개수 문구를 맞춘다.

## 최근 변경: 메모리 사이클 시나리오 가치평가 (2026-11-20)

- 다른 Claude 세션(claude.ai)에서 만들어 브랜치 `claude/mem-scenario`로 올린 변경입니다.
- 새 파일:
  - `tools/mem-scenario.html`: 화면
  - `assets/engines/memscen.js`: 계산 엔진
  - `assets/og/mem-scenario.png`: 미리보기 이미지
  - `docs/mem-scenario-model.md`: 모형 설명
- 내용: 변수 8개 × 5단계(390,625개 조합)로 삼성전자와 SK하이닉스의 수급 갭, 시장·계약·실현 가격, 2027~29년 손익, 잔여이익모델 적정주가를 계산합니다.
- 모형을 고치기 전에 `docs/mem-scenario-model.md`를 먼저 읽습니다. 그 문서에 계산식, 변수 정의, 출처, 분기 갱신 순서, 한계가 있습니다.
- 남은 개선 후보:
  - 함께 움직이는 변수를 묶은 대표 조합 프리셋(예: 긴축+원화 강세, 무역분쟁+AI 수요 둔화)
  - 분기 실적 발표 때 `CO.skh/sec`의 출발점(`exit`, `op26`, `bps0`, `price`) 갱신. 이때 `tools/mem-scenario.html` 상단의 분석 기준일·기준주가 상자와 하단 문구도 같은 날짜로 고친다

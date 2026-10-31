# 이기표 재무기획 포트폴리오

제조업 재무기획·경영관리 실무자의 경력과, 실무에서 쓰는 계산을 브라우저에서 바로 돌려 볼 수 있는 도구 모음입니다.

- 사이트: https://lgppeople-arch.github.io/portfolio/

## 구성

| 경로 | 내용 |
|---|---|
| `index.html` | 홈: 경력, 업무 사례, 투자 의사결정 단계별 도구 |
| `tools/capex-kit.html` | 설비투자 분석 키트: 투자 타당성, 가동률과 원가, 계획 대비 실적 |
| `tools/post-review.html` | 투자 사후관리: 승인 가정 대비 재추정, 샤플리 값 기반 NPV 차이 분해 |
| `tools/ma-valuation.html` | M&A 가치평가: DCF, 유사기업·거래사례 배수, 제시가 검토, 인수 후 재무 |
| `tools/holdco-nav.html` | 지주사 포트폴리오 가치: NAV, 지주사 할인, 지주회사 요건, 지분 매각 시나리오 |
| `tools/cash-13w.html` | 13주 자금수지: 영업일 규칙, 한도대출, 분기말 재무약정 |
| `tools/ma-process.html` | M&A 절차 지도: 비밀유지계약부터 인수 후 통합까지 13단계와 경력 위치 |
| `tools/fx-hedge.html` | 환리스크 헤지: 인수대금(선물환·옵션·딜 컨틴전트), 수출 순노출 구간별 헤지 |
| `tools/checks.html` | 계산 검산: 모든 계산 엔진의 항등식·대조·실무 규칙 테스트 |
| `assets/fin.js`, `assets/engines/` | 공용 계산 함수와 도구별 계산 엔진 (화면 코드와 분리) |
| `assets/checks.js` | 검산 묶음. `node assets/checks.js`로도 실행 |
| `assets/site.css` | 공용 스타일 |

## 원칙

- 도구의 예시 수치는 모두 가상이며, 회사 내부 자료는 쓰지 않았습니다.
- 계산 기준은 각 도구 아래에 공개합니다.
- 설치 없이 브라우저에서 실행되고, 입력값을 외부로 보내지 않습니다.
- Claude, Cursor 같은 AI 코딩 도구로 만들고 계산 결과는 직접 검산했습니다.

# 이기표 재무기획 포트폴리오

제조업 재무기획·경영관리 실무자의 경력과, 실무에서 쓰는 계산을 브라우저에서 바로 돌려 볼 수 있는 도구 모음입니다.

- 사이트: https://lgppeople-arch.github.io/portfolio/

## 구성

| 경로 | 내용 |
|---|---|
| `index.html` | 홈: 경력, 업무 사례, 분석 리포트, 투자 의사결정 단계별 도구 |
| `tools/guide.html` | 쉬운 가이드: 화면 읽는 법, 도구별 사용법, 붕어빵 가게 비유 용어 사전, 미니 계산기 |
| `tools/fsa.html` | 재무제표 분석 프레임워크(리포트 형식): 세 재무제표 연결 모형, 읽는 순서, 꼭 읽는 주석, 비율 사전과 ROE 분해, 위험 신호 |
| `tools/semi-cycle.html` | 반도체 사이클과 재무(산업 노트): 밸류체인 단계별 재무 체크, 국면별 재무제표 신호, 재고·가격·설비투자 사이클 개념 모형(재고평가손실·저조업 비용 회계 포함), 부품·소재 기업 체크포인트 |
| `tools/pl-report.html` | 월 손익 보고: SAP 조회 형식 데이터로 당월·누계 손익, 영업이익 차이 분해, 3개월 추정과 연간 전망 |
| `tools/mbo-kpi.html` | 성과평가 MBO·KPI: KPI 구간 점수, 조직 등급, 인센티브 배분, KPI 설계 점검 |
| `tools/capex-kit.html` | 설비투자 분석 키트: 투자 타당성, 가동률과 원가, 계획 대비 실적 |
| `tools/post-review.html` | 투자 사후관리: 승인 가정 대비 재추정, 샤플리 값 기반 NPV 차이 분해 |
| `tools/ma-valuation.html` | M&A 가치평가: DCF, 유사기업·거래사례 배수, 제시가 검토, 인수 후 재무 |
| `tools/holdco-nav.html` | 지주사 포트폴리오 가치: NAV, 지주사 할인, 지주회사 요건, 지분 매각 시나리오 |
| `tools/cash-13w.html` | 13주 자금수지: 영업일 규칙, 한도대출, 분기말 재무약정 |
| `tools/ma-process.html` | M&A 절차 지도: 관통 원칙, 거래 방식·인수 대상 비교, 위험 배분표, 13단계 세부 절차와 경력 위치 |
| `tools/fx-hedge.html` | 환리스크 헤지: 인수대금(선물환·옵션·딜 컨틴전트), 수출 순노출 구간별 헤지 |
| `tools/checks.html` | 계산 검산: 모든 계산 엔진의 항등식·대조·실무 규칙 테스트 |
| `assets/fin.js`, `assets/engines/` | 공용 계산 함수와 도구별 계산 엔진 (화면 코드와 분리) |
| `assets/checks.js` | 검산 묶음. `node assets/checks.js`로도 실행 |
| `examples/` | 월 손익 보고를 pandas로 다시 계산하는 예제(`python examples/pl_report.py`)와 예시 데이터 |
| `assets/site.css`, `assets/theme.js` | 공용 스타일, 밝은 화면 기본과 테마 전환 |
| `assets/report.css`, `assets/report.js` | 분석 리포트 템플릿: 캔버스 표지 그림(흐름·웨이퍼), 목차 강조, 스크롤 진입 애니메이션 |

## 원칙

- 도구의 예시 수치는 모두 가상이며, 회사 내부 자료는 쓰지 않았습니다.
- 계산 기준은 각 도구 아래에 공개합니다.
- 설치 없이 브라우저에서 실행되고, 입력값을 외부로 보내지 않습니다.
- Claude, Cursor 같은 AI 코딩 도구로 만들고 계산 결과는 직접 검산했습니다.

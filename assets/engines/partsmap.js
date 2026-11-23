/* 반도체 장비 부품 세그먼트 지도: 자료와 계산 엔진.
   공개 자료(업계 보고서·언론·기업 소개)와 일반 공학 문헌을 바탕으로 한 정성 판단이다. 특정 회사의 내부 자료나 전략을 담지 않는다.
   점수는 1~5(높을수록 해당 성질이 강함), 인접성은 0~3(3 거의 그대로, 2 일부 개조, 1 신규 구축, 0 별개 역량). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.PartsMap = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  /* 공정 */
  const PROCS = [
    { id: "cvd", name: "증착 CVD·ALD" }, { id: "pvd", name: "증착 PVD" }, { id: "ccp", name: "식각 CCP" }, { id: "icp", name: "식각 ICP" },
    { id: "diff", name: "확산·열처리" }, { id: "clean", name: "세정·CMP·검사" }, { id: "xfer", name: "이송·공통" }, { id: "pkg", name: "후공정·패키징" }
  ];
  /* 기능 묶음 */
  const GROUPS = { hold: "웨이퍼 지지·온도", face: "플라즈마 대면", heat: "열처리", struct: "구조·이송", raw: "원료·표면" };
  /* 제품 세그먼트.
     m 성숙도(1 도입 ~ 5 성숙), 수익성 요인: b 진입장벽, r 반복 매출(소모·교체), p 가격 방어(대체·저가 압력이 낮을수록 높음), raw 원료 안정성,
     확장성 요인: g 성장 동인 연동(HBM·3D NAND·선단 로직), br 적용 폭(다른 공정·용도로 넓힐 여지).
     외부 노출: cyc 신규 장비 투자 사이클 민감도(1~3), y 이트륨 노출(0~3), cn 중국 국산화·저가 압력(0~3) */
  const SEGS = [
    { id: "heater", name: "AlN 서셉터 히터", grp: "hold", procs: { cvd: 2, pvd: 1 }, mat: "AlN, 몰리브덴 발열체 매립", alt: "–", tech: "hp", tier: "3~4",
      m: 3, b: 5, r: 3, p: 4, raw: 3, g: 4, br: 3, cyc: 3, y: 2, cn: 2,
      why: "질화물 고온 소결과 발열체 동시 소결, 온도 균일도 사양이 진입장벽. 수명이 길어 교체 주기는 중간. 소결조제로 이트륨을 씀" },
    { id: "esc_dep", name: "증착용 정전척(존슨-라벡형)", grp: "hold", procs: { cvd: 2, pvd: 2 }, mat: "AlN, 도핑으로 저항 제어", alt: "–", tech: "hp", tier: "4",
      m: 2, b: 5, r: 3, p: 4, raw: 3, g: 5, br: 3, cyc: 3, y: 2, cn: 2,
      why: "체적 저항을 좁은 범위로 맞추는 소재 설계와 표면 극초정밀 가공. 선단 증착 공정이 늘수록 수요가 함께 큼" },
    { id: "esc_etch", name: "식각용 정전척(쿨롱형)", grp: "hold", procs: { ccp: 2, icp: 2 }, mat: "Al₂O₃·Y₂O₃ 유전층 + 알루미늄 베이스 접합", alt: "–", tech: "hp_ps", tier: "4",
      m: 3, b: 5, r: 4, p: 3, raw: 3, g: 4, br: 3, cyc: 2, y: 2, cn: 2,
      why: "세라믹 위에 RF·냉각 설계와 금속 베이스 접합이 더해져 역량 범위가 넓음. 플라즈마에 닳아 재생·교체가 잦음" },
    { id: "bond", name: "본딩 히터·다공성 척", grp: "hold", procs: { pkg: 2, clean: 1 }, mat: "AlN·Si₃N₄, 다공성 Al₂O₃·SiC", alt: "–", tech: "hp_gps", tier: "4",
      m: 1, b: 4, r: 2, p: 4, raw: 3, g: 5, br: 3, cyc: 2, y: 1, cn: 1,
      why: "열압착·하이브리드 본딩 장비용. 적층 메모리와 첨단 패키징 투자에 연동되나 사양이 아직 바뀌는 도입기" },
    { id: "ring_si", name: "포커스·에지링(실리콘)", grp: "face", procs: { ccp: 2, icp: 1 }, mat: "단결정·다결정 Si", alt: "CVD-SiC", tech: "xtal", tier: "2~3",
      m: 4, b: 3, r: 5, p: 2, raw: 4, g: 4, br: 2, cyc: 1, y: 0, cn: 2,
      why: "웨이퍼와 전기적 성질이 비슷해야 하는 자리. 플라즈마에 깎여 자주 바꾸는 대표 소모품이나 SiC와 대체 경쟁" },
    { id: "ring_sic", name: "포커스·에지링(CVD-SiC)", grp: "face", procs: { ccp: 2, icp: 2 }, mat: "CVD-SiC", alt: "Si", tech: "cvd", tier: "2~3",
      m: 3, b: 5, r: 5, p: 3, raw: 4, g: 4, br: 2, cyc: 1, y: 0, cn: 2,
      why: "초고순도 벌크를 수 mm 쌓는 데 며칠~몇 주. 설비비와 성장 노하우가 장벽이고, 고단 적층 식각에서 Si보다 오래 감" },
    { id: "ring_cer", name: "커버·인슐레이터·섀도링(세라믹)", grp: "face", procs: { cvd: 1, pvd: 2, ccp: 2, icp: 2 }, mat: "Al₂O₃·Y₂O₃·AlN", alt: "쿼츠", tech: "ps", tier: "2~3",
      m: 4, b: 2, r: 4, p: 2, raw: 3, g: 3, br: 3, cyc: 1, y: 1, cn: 3,
      why: "절연과 내플라즈마성이 핵심인 자리로 쿼츠와 경쟁. 가공 등급이 상대적으로 낮아 공급자가 많음" },
    { id: "y2o3", name: "Y₂O₃ 벌크 파츠(윈도우·돔·라이너)", grp: "face", procs: { icp: 2, ccp: 1 }, mat: "Y₂O₃", alt: "Al₂O₃, 코팅 부품", tech: "ps_hip", tier: "3",
      m: 2, b: 4, r: 3, p: 3, raw: 1, g: 4, br: 3, cyc: 2, y: 3, cn: 2,
      why: "불소 플라즈마에 강해 고종횡비 식각에서 수요가 늘지만, 원료인 산화이트륨 조달이 사업성을 좌우" },
    { id: "coat", name: "내플라즈마 코팅·세정 재생", grp: "raw", procs: { ccp: 2, icp: 2, cvd: 1 }, mat: "Y₂O₃·YOF(용사·에어로졸 증착·ALD)", alt: "벌크 Y₂O₃", tech: "spray", tier: "–",
      m: 3, b: 3, r: 5, p: 3, raw: 2, g: 4, br: 4, cyc: 1, y: 3, cn: 2,
      why: "장비가 돌아가는 한 반복되는 서비스 매출. 코팅 원료가 이트륨이라 원료 가격에 직접 노출" },
    { id: "shower", name: "샤워헤드·가스분배판·상부전극", grp: "face", procs: { cvd: 2, ccp: 2, icp: 1 }, mat: "AlN·알루미늄 합금 / Si·SiC", alt: "Al₂O₃", tech: "mixed", tier: "4",
      m: 3, b: 4, r: 4, p: 3, raw: 4, g: 4, br: 2, cyc: 2, y: 0, cn: 2,
      why: "수천 개 미세홀의 위치·지름 공차가 장벽. 소재가 공정마다 달라(CVD는 AlN·금속, 식각은 Si·SiC) 한 역량으로 다 덮기 어려움" },
    { id: "quartz", name: "쿼츠웨어(튜브·보트·링·윈도우)", grp: "heat", procs: { diff: 2, ccp: 1, icp: 1 }, mat: "용융 석영", alt: "SiC(확산로), 세라믹(링)", tech: "fuse", tier: "2~3",
      m: 5, b: 3, r: 4, p: 2, raw: 3, g: 3, br: 2, cyc: 2, y: 0, cn: 3,
      why: "용융과 유리 가공이라 세라믹 소결과 공정이 다름. 성숙 시장이고 일부 자리는 세라믹으로 대체되는 흐름" },
    { id: "struct", name: "구조·이송 파츠(리프트핀·엔드이펙터·지그)", grp: "struct", procs: { xfer: 2, clean: 1, pkg: 1 }, mat: "Al₂O₃·SiC·사파이어", alt: "–", tech: "ps", tier: "1~2",
      m: 5, b: 1, r: 2, p: 1, raw: 4, g: 2, br: 4, cyc: 2, y: 0, cn: 3,
      why: "일반 가공 등급으로 만들 수 있어 공급자가 많고 가격 경쟁이 심함. 대신 어느 장비에나 들어가 적용 폭은 넓음" },
    { id: "powder", name: "원료 파우더(AlN·Al₂O₃·Y₂O₃)", grp: "raw", procs: {}, mat: "합성 파우더", alt: "–", tech: "synth", tier: "–",
      m: 4, b: 4, r: 3, p: 3, raw: 2, g: 3, br: 4, cyc: 2, y: 2, cn: 2,
      why: "순도·입도 관리가 장벽. 반도체 외 방열 기판 등 용도가 넓음. Y₂O₃ 파우더는 원료 통제에 직접 노출" }
  ];
  /* 제조기술 */
  const TECHS = {
    ps: { name: "상압 소결", cond: "Al₂O₃ 약 1,500~1,650℃, 대기", pro: "대형·대량, 낮은 비용", con: "고밀도가 어려운 소재가 있음", capex: 1 },
    gps: { name: "가스압 소결", cond: "Si₃N₄ 약 1,750~1,900℃, 질소 수 MPa", pro: "질화물 분해 억제", con: "적용 소재 제한", capex: 2 },
    hp: { name: "핫프레스", cond: "AlN 약 1,750~1,900℃, 질소, 소결조제 Y₂O₃", pro: "고밀도, 전극·발열체 동시 소결", con: "원판형 위주, 한 번에 넣는 양이 적어 병목", capex: 3 },
    hip: { name: "열간 등방 가압", cond: "약 1,400~1,700℃, 아르곤 100~200 MPa", pro: "남은 기공 제거", con: "고가 설비, 긴 사이클", capex: 4 },
    sps: { name: "방전 플라즈마 소결", cond: "수 분~수십 분", pro: "미세조직 제어", con: "대형화 어려움", capex: 2 },
    cvd: { name: "CVD 벌크 증착", cond: "SiC 약 1,200~1,500℃, 시간당 수십 µm", pro: "초고순도", con: "수 mm에 며칠~몇 주", capex: 4 },
    rbsc: { name: "상압·반응 소결 SiC", cond: "약 2,000~2,200℃, 아르곤", pro: "대형 구조체", con: "순도 낮음", capex: 3 },
    fuse: { name: "용융(쿼츠)", cond: "약 1,700~2,000℃ 이상", pro: "–", con: "세라믹 소결과 별개 공정", capex: 3 }
  };
  const TECH_ORDER = ["ps", "gps", "hp", "hip", "sps", "cvd", "rbsc", "fuse"];
  const TECH_LABEL = { hp: "핫프레스", hp_ps: "핫프레스·상압 + 접합", hp_gps: "핫프레스·가스압·상압", xtal: "단결정 성장", cvd: "CVD 증착", ps: "상압 소결", ps_hip: "상압 소결 + HIP", spray: "용사·에어로졸 증착·ALD", mixed: "소재별 상이", fuse: "용융", synth: "합성" };
  /* 가공 정밀도 등급 */
  const TIERS = [
    { t: "1 일반", tol: "±30~50 µm", flat: "50 µm 이상", ra: "0.8~1.6 µm", how: "머시닝센터, 다이아몬드 공구", use: "지그, 구조 파츠", learn: "수개월", out: "높음" },
    { t: "2 정밀", tol: "±10~20 µm", flat: "10~30 µm", ra: "0.4~0.8 µm", how: "정밀 연삭, 5축 가공", use: "링, 라이너, 리프트핀", learn: "1~2년", out: "중간" },
    { t: "3 초정밀", tol: "±2~5 µm", flat: "5~10 µm", ra: "0.1~0.4 µm", how: "래핑, 초음파 가공", use: "히터 표면, 섀도링, Y₂O₃ 윈도우", learn: "2~3년", out: "낮음" },
    { t: "4 극초정밀", tol: "±1 µm 이하", flat: "2~5 µm 이하", ra: "0.05~0.1 µm 미만", how: "폴리싱, 엠보·메사 패턴, 미세홀, 레이저", use: "정전척 표면, 본딩 히터, 샤워헤드 미세홀", learn: "3~5년", out: "내재화" }
  ];
  /* 링 자리별 소재 대체 경쟁: 2 주력, 1 대체 후보, 0 쓰지 않음 */
  const RING_MATS = ["Si", "CVD-SiC", "쿼츠", "Y₂O₃", "Al₂O₃", "AlN"];
  const RINGS = [
    { pos: "포커스·에지링 (식각)", need: "웨이퍼와 비슷한 전기적 성질", v: [2, 2, 1, 0, 0, 0] },
    { pos: "커버·인슐레이터링 (식각)", need: "절연, 내플라즈마성", v: [0, 0, 2, 1, 2, 0] },
    { pos: "섀도·클램프링 (증착)", need: "고온 치수 안정, 절연", v: [0, 0, 1, 0, 2, 2] },
    { pos: "윈도우·돔 (ICP 식각)", need: "RF 투과, 불소 플라즈마 내성", v: [0, 0, 1, 2, 2, 0] }
  ];
  /* 플레이어 유형별 참여: 2 주력, 1 참여, 0 거의 없음 (공개 제품 소개 기준, 유형 수준의 판단) */
  const PLAYERS = [
    { id: "jp", name: "일본 종합 세라믹·전자부품사", ex: "Kyocera, NGK Insulators 등", v: { heater: 2, esc_dep: 2, esc_etch: 2, bond: 2, ring_si: 0, ring_sic: 1, ring_cer: 2, y2o3: 2, coat: 0, shower: 1, quartz: 0, struct: 2, powder: 0 } },
    { id: "west", name: "미·유럽 소재 전문사", ex: "CoorsTek, CeramTec 등", v: { heater: 1, esc_dep: 0, esc_etch: 1, bond: 0, ring_si: 1, ring_sic: 2, ring_cer: 2, y2o3: 2, coat: 0, shower: 1, quartz: 0, struct: 2, powder: 0 } },
    { id: "oem", name: "장비사 계열·내재화", ex: "장비사의 부품 자회사·사내 부문", v: { heater: 1, esc_dep: 1, esc_etch: 1, bond: 1, ring_si: 2, ring_sic: 1, ring_cer: 0, y2o3: 0, coat: 0, shower: 1, quartz: 0, struct: 0, powder: 0 } },
    { id: "qz", name: "쿼츠 전문·수직계열화", ex: "Heraeus, Shin-Etsu Quartz, Tosoh 등", v: { heater: 0, esc_dep: 0, esc_etch: 0, bond: 0, ring_si: 0, ring_sic: 0, ring_cer: 1, y2o3: 0, coat: 0, shower: 0, quartz: 2, struct: 0, powder: 0 } },
    { id: "svc", name: "코팅·세정·재생 서비스", ex: "Entegris, TOCALO 등", v: { heater: 1, esc_dep: 0, esc_etch: 1, bond: 0, ring_si: 0, ring_sic: 0, ring_cer: 1, y2o3: 0, coat: 2, shower: 1, quartz: 0, struct: 0, powder: 0 } },
    { id: "chem", name: "원료 화학사", ex: "Tokuyama, Denka 등", v: { heater: 0, esc_dep: 0, esc_etch: 0, bond: 0, ring_si: 0, ring_sic: 0, ring_cer: 0, y2o3: 0, coat: 0, shower: 0, quartz: 0, struct: 0, powder: 2 } },
    { id: "kr", name: "한국 부품 전문사군", ex: "실명 생략", v: { heater: 1, esc_dep: 1, esc_etch: 1, bond: 1, ring_si: 2, ring_sic: 2, ring_cer: 2, y2o3: 1, coat: 2, shower: 1, quartz: 2, struct: 2, powder: 1 } },
    { id: "cn", name: "중국 국산화 신흥 업체군", ex: "실명 생략", v: { heater: 1, esc_dep: 1, esc_etch: 1, bond: 0, ring_si: 1, ring_sic: 1, ring_cer: 2, y2o3: 1, coat: 1, shower: 1, quartz: 2, struct: 2, powder: 1 } }
  ];
  /* 역량 유형별 인접성(0~3). 특정 회사가 아니라 '이 역량을 가진 회사'가 어디로 넓히기 쉬운지를 대칭으로 본다 */
  const BASES = [
    { id: "A", name: "질화물 핫프레스 + 전극 매립 + 극초정밀 가공", v: { heater: 3, esc_dep: 3, esc_etch: 2, bond: 2, ring_si: 0, ring_sic: 0, ring_cer: 2, y2o3: 1, coat: 1, shower: 2, quartz: 0, struct: 2, powder: 1 } },
    { id: "B", name: "산화물 상압 소결·HIP + 정밀 가공", v: { heater: 1, esc_dep: 1, esc_etch: 2, bond: 1, ring_si: 0, ring_sic: 0, ring_cer: 3, y2o3: 3, coat: 1, shower: 2, quartz: 0, struct: 3, powder: 1 } },
    { id: "C", name: "CVD 벌크 증착(SiC)", v: { heater: 0, esc_dep: 0, esc_etch: 0, bond: 0, ring_si: 1, ring_sic: 3, ring_cer: 0, y2o3: 0, coat: 1, shower: 2, quartz: 0, struct: 1, powder: 0 } },
    { id: "D", name: "단결정 실리콘 성장·가공", v: { heater: 0, esc_dep: 0, esc_etch: 0, bond: 0, ring_si: 3, ring_sic: 1, ring_cer: 0, y2o3: 0, coat: 0, shower: 2, quartz: 0, struct: 1, powder: 0 } },
    { id: "E", name: "용융 석영·유리 가공", v: { heater: 0, esc_dep: 0, esc_etch: 0, bond: 0, ring_si: 0, ring_sic: 0, ring_cer: 1, y2o3: 0, coat: 0, shower: 0, quartz: 3, struct: 1, powder: 0 } },
    { id: "F", name: "용사·코팅 + 세정·재생", v: { heater: 1, esc_dep: 1, esc_etch: 1, bond: 0, ring_si: 0, ring_sic: 0, ring_cer: 1, y2o3: 1, coat: 3, shower: 1, quartz: 0, struct: 1, powder: 0 } },
    { id: "G", name: "원료 합성(세라믹 파우더)", v: { heater: 0, esc_dep: 0, esc_etch: 0, bond: 0, ring_si: 0, ring_sic: 0, ring_cer: 0, y2o3: 1, coat: 1, shower: 0, quartz: 0, struct: 0, powder: 3 } }
  ];
  const PROFIT_KEYS = ["b", "r", "p", "raw"], PROFIT_NAMES = { b: "진입장벽", r: "반복 매출", p: "가격 방어", raw: "원료 안정성" };
  const W0 = { b: 35, r: 30, p: 20, raw: 15 };
  /* 수익성 점수 = 요인 점수의 가중 평균(가중치는 합으로 나눠 맞춤). 가중치가 모두 0이면 단순 평균 */
  function profit(s, w) {
    w = w || W0; let sw = 0, sv = 0;
    PROFIT_KEYS.forEach((k) => { const x = Math.max(0, +w[k] || 0); sw += x; sv += x * s[k]; });
    return sw > 0 ? sv / sw : PROFIT_KEYS.reduce((a, k) => a + s[k], 0) / PROFIT_KEYS.length;
  }
  const scal = (s) => (s.g + s.br) / 2;
  function score(w) {
    const rows = SEGS.map((s) => ({ id: s.id, name: s.name, grp: s.grp, m: s.m, profit: profit(s, w), scal: scal(s) }));
    const order = rows.slice().sort((a, b) => b.profit - a.profit || b.scal - a.scal || a.id.localeCompare(b.id));
    order.forEach((r, i) => { r.rank = i + 1; });
    return { rows: rows, order: order };
  }
  /* 역량 유형 하나에서 본 인접 세그먼트(인접성 높은 순) */
  function reach(baseId, w) {
    const B = BASES.find((b) => b.id === baseId), S = score(w).rows;
    return SEGS.map((s, i) => ({ id: s.id, name: s.name, adj: B.v[s.id], profit: S[i].profit, scal: S[i].scal }))
      .sort((a, b) => b.adj - a.adj || b.profit - a.profit || a.id.localeCompare(b.id));
  }
  /* 세그먼트별로 가장 가까운 역량 유형(인접성 3이 하나도 없으면 '별도 역량 필요') */
  function owners(id) { return BASES.filter((b) => b.v[id] === 3).map((b) => b.id); }
  /* ---------- 한 장 지도: 공정 → 부품 → 제조기술 → 가공 등급 → 플레이어 유형 ----------
     부품 세그먼트를 가운데 축으로 두고, 나머지 네 기둥은 모두 부품과 이어진다. 선 굵기 1 일부, 2 주력 */
  const MAP_TECH = [
    { id: "t_hp", name: "핫프레스" }, { id: "t_ps", name: "상압 소결" }, { id: "t_gps", name: "가스압 소결" }, { id: "t_hip", name: "열간 등방 가압" },
    { id: "t_cvd", name: "CVD 증착" }, { id: "t_xtal", name: "단결정 성장" }, { id: "t_fuse", name: "용융(쿼츠)" }, { id: "t_spray", name: "용사·코팅" },
    { id: "t_bond", name: "금속 접합·RF 설계" }, { id: "t_synth", name: "파우더 합성" }
  ];
  const SEG_TECH = {
    heater: { t_hp: 2 }, esc_dep: { t_hp: 2 }, esc_etch: { t_hp: 2, t_ps: 1, t_bond: 2 }, bond: { t_hp: 2, t_gps: 1, t_ps: 1 },
    ring_si: { t_xtal: 2 }, ring_sic: { t_cvd: 2 }, ring_cer: { t_ps: 2, t_hip: 1 }, y2o3: { t_ps: 2, t_hip: 2 }, coat: { t_spray: 2 },
    shower: { t_hp: 1, t_xtal: 1, t_cvd: 1, t_ps: 1 }, quartz: { t_fuse: 2 }, struct: { t_ps: 2 }, powder: { t_synth: 2 }
  };
  const MAP_TIER = [{ id: "g1", name: "가공 1 일반" }, { id: "g2", name: "가공 2 정밀" }, { id: "g3", name: "가공 3 초정밀" }, { id: "g4", name: "가공 4 극초정밀" }, { id: "g0", name: "가공 해당 없음" }];
  /* 가공 등급 문자열("2~3", "4", "–") → 등급 노드. 범위의 위쪽 끝을 주력(2), 아래쪽을 일부(1)로 본다 */
  function segTiers(s) {
    if (!/\d/.test(s.tier)) return { g0: 2 };
    const n = s.tier.split("~").map(Number), out = {};
    for (let t = n[0]; t <= n[n.length - 1]; t++) out["g" + t] = t === n[n.length - 1] ? 2 : 1;
    return out;
  }
  const COLS = [{ id: "proc", name: "공정" }, { id: "seg", name: "부품" }, { id: "tech", name: "제조기술" }, { id: "tier", name: "가공 등급" }, { id: "player", name: "플레이어 유형" }];
  function graph() {
    const nodes = [], links = [];
    PROCS.forEach((p) => nodes.push({ id: "p_" + p.id, col: "proc", name: p.name }));
    nodes.push({ id: "p_raw", col: "proc", name: "원료(공정 앞단)" });
    SEGS.forEach((s) => nodes.push({ id: "s_" + s.id, col: "seg", name: s.name, seg: s.id, grp: s.grp }));
    MAP_TECH.forEach((t) => nodes.push({ id: t.id, col: "tech", name: t.name }));
    MAP_TIER.forEach((t) => nodes.push({ id: t.id, col: "tier", name: t.name }));
    PLAYERS.forEach((p) => nodes.push({ id: "pl_" + p.id, col: "player", name: p.name }));
    SEGS.forEach((s) => {
      const pr = Object.keys(s.procs);
      if (pr.length) pr.forEach((k) => links.push({ a: "p_" + k, b: "s_" + s.id, seg: s.id, w: s.procs[k] }));
      else links.push({ a: "p_raw", b: "s_" + s.id, seg: s.id, w: 2 });
      /* 부품마다 한 줄기: 부품 → 제조기술 → 가공 등급 → 플레이어. 이웃 기둥끼리만 잇고, 굵기는 두 끝 중 약한 쪽 */
      const te = SEG_TECH[s.id], tr = segTiers(s);
      Object.keys(te).forEach((k) => links.push({ a: "s_" + s.id, b: k, seg: s.id, w: te[k] }));
      Object.keys(te).forEach((k) => Object.keys(tr).forEach((g) => links.push({ a: k, b: g, seg: s.id, w: Math.min(te[k], tr[g]) })));
      Object.keys(tr).forEach((g) => PLAYERS.forEach((p) => { if (p.v[s.id]) links.push({ a: g, b: "pl_" + p.id, seg: s.id, w: Math.min(tr[g], p.v[s.id]) }); }));
    });
    return { cols: COLS, nodes: nodes, links: links };
  }
  /* 노드 하나를 고르면 그 노드를 지나는 부품 줄기들을 찾고, 그 줄기의 선을 모두 켠다.
     단, 고른 노드가 있는 기둥에서는 고른 노드를 지나는 선만 남긴다(같은 기둥의 다른 칸까지 켜면 무엇을 골랐는지 흐려진다) */
  function select(G, nodeId) {
    const n = G.nodes.find((q) => q.id === nodeId);
    if (!n) return null;
    const col = {}; G.nodes.forEach((q) => { col[q.id] = q.col; });
    const segs = n.col === "seg" ? [n.seg] : Array.from(new Set(G.links.filter((l) => l.a === nodeId || l.b === nodeId).map((l) => l.seg)));
    const keep = (end) => n.col === "seg" || col[end] !== n.col || end === nodeId;
    const links = G.links.filter((l) => segs.indexOf(l.seg) >= 0 && keep(l.a) && keep(l.b));
    const on = new Set([nodeId]); links.forEach((l) => { on.add(l.a); on.add(l.b); });
    return { node: n, segs: segs, links: links, nodes: on };
  }
  /* 같은 두 노드를 잇는 줄기를 하나로 합친다(그리기용): 굵기 합, 지나는 부품 목록 */
  function bundle(links) {
    const m = {};
    links.forEach((l) => { const k = l.a + ">" + l.b; const q = m[k] || (m[k] = { a: l.a, b: l.b, w: 0, segs: [] }); q.w += l.w; if (q.segs.indexOf(l.seg) < 0) q.segs.push(l.seg); });
    return Object.keys(m).map((k) => m[k]);
  }
  /* 공용 지도 탐색기(assets/engines/linkmap.js)용 자료: 부품 세그먼트 하나가 항목 하나 */
  function lmSpec() {
    const G = graph(), items = SEGS.map((s) => {
      const m = { proc: {}, seg: {}, tech: Object.assign({}, SEG_TECH[s.id]), tier: segTiers(s), player: {} };
      const pr = Object.keys(s.procs); if (pr.length) pr.forEach((k) => { m.proc["p_" + k] = s.procs[k]; }); else m.proc.p_raw = 2;
      m.seg["s_" + s.id] = 2;
      PLAYERS.forEach((p) => { if (p.v[s.id]) m.player["pl_" + p.id] = p.v[s.id]; });
      return { id: s.id, name: s.name, grp: s.grp, m: m };
    });
    return { cols: G.cols, nodes: G.nodes, items: items };
  }
  return { PROCS, GROUPS, SEGS, TECHS, TECH_ORDER, TECH_LABEL, TIERS, RING_MATS, RINGS, PLAYERS, BASES, PROFIT_KEYS, PROFIT_NAMES, W0, profit, scal, score, reach, owners, MAP_TECH, SEG_TECH, MAP_TIER, COLS, segTiers, graph, select, bundle, lmSpec };
});

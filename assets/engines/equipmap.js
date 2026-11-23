/* 반도체 장비 세그먼트 지도: 자료와 계산 엔진.
   공개 자료(각사 연차보고서·제품 소개, 업계 보도)와 일반 공학 지식을 바탕으로 한 정성 판단이다. 점수는 1~5, 연결 굵기는 1 일부·2 주력.
   업체 칸은 해외 상장 대형사만 실명으로 두고, 한국·중국 장비사는 묶음으로만 표시한다. 회사별 시장점유율 수치는 넣지 않는다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.EquipMap = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const GROUPS = { litho: { name: "노광·트랙", css: "--total" }, etch: { name: "식각", css: "--accent" }, dep: { name: "증착", css: "--input" }, therm: { name: "열처리·이온주입", css: "--neg" },
    clean: { name: "세정·CMP", css: "--pos" }, meas: { name: "계측·검사", css: "--violet" }, back: { name: "후공정", css: "--mark-muted" } };
  const COLS = [{ id: "step", name: "공정 단계" }, { id: "eq", name: "장비" }, { id: "tech", name: "핵심 기술" }, { id: "part", name: "주요 부품군" }, { id: "co", name: "업체" }];
  const STEPS = [["s_litho", "노광(리소그래피)"], ["s_etch", "식각"], ["s_dep", "증착"], ["s_therm", "열처리·확산"], ["s_imp", "이온주입"], ["s_clean", "세정"], ["s_cmp", "CMP(평탄화)"], ["s_meas", "계측·검사"], ["s_back", "후공정(패키징)"]];
  const TECH = [["t_opt", "광학·광원"], ["t_stage", "정밀 스테이지·기구"], ["t_plasma", "플라즈마·RF"], ["t_vac", "진공·가스 제어"], ["t_chem", "공정 화학·레시피"], ["t_heat", "열 제어"], ["t_ion", "이온빔"], ["t_ebeam", "전자빔"], ["t_sw", "영상 처리·소프트웨어"], ["t_hand", "웨이퍼 이송·핸들링"]];
  const PARTS = [["pt_esc", "정전척"], ["pt_heater", "히터·서셉터"], ["pt_ring", "포커스·에지링"], ["pt_cer", "세라믹 링·창·라이너"], ["pt_shower", "샤워헤드·상부전극"], ["pt_quartz", "쿼츠웨어"], ["pt_coat", "코팅·세정 재생"],
    ["pt_rf", "RF 전원·매칭"], ["pt_vac", "진공 펌프·밸브"], ["pt_gas", "가스·약액 공급"], ["pt_optic", "광학 모듈"], ["pt_source", "광원(EUV·엑시머)"], ["pt_robot", "로봇·핸들러"], ["pt_sensor", "센서·카메라"]];
  /* 부품 지도(tools/parts-map.html)의 세그먼트와 이어지는 부품군 */
  const PART_LINK = { pt_esc: ["esc_dep", "esc_etch"], pt_heater: ["heater", "bond"], pt_ring: ["ring_si", "ring_sic"], pt_cer: ["ring_cer", "y2o3"], pt_shower: ["shower"], pt_quartz: ["quartz"], pt_coat: ["coat"] };
  const COS = [["c_asml", "ASML"], ["c_amat", "Applied Materials"], ["c_lam", "Lam Research"], ["c_tel", "Tokyo Electron"], ["c_kla", "KLA"], ["c_asm", "ASM International"], ["c_kok", "Kokusai Electric"], ["c_scr", "SCREEN"],
    ["c_hht", "Hitachi High-Tech"], ["c_nik", "Nikon"], ["c_can", "Canon"], ["c_eba", "Ebara"], ["c_dis", "Disco"], ["c_las", "Lasertec"], ["c_axc", "Axcelis"], ["c_ont", "Onto Innovation"], ["c_bes", "Besi"], ["c_kr", "한국 장비사군"], ["c_cn", "중국 장비사군"]];
  /* 장비 세그먼트. m 성숙도(1 도입~5 성숙), con 집중도(1 분산~5 사실상 한 회사), g 성장 동인 연동(AI·HBM·선단), cn 중국 노출·국산화 압력, svc 설치 기반 서비스 중요도 */
  const SEGS = [
    { id: "euv", name: "EUV 노광", grp: "litho", step: { s_litho: 2 }, tech: { t_opt: 2, t_stage: 2, t_vac: 1, t_sw: 1 }, part: { pt_optic: 2, pt_source: 2, pt_vac: 1, pt_robot: 1, pt_sensor: 1 }, co: { c_asml: 2 },
      m: 2, con: 5, g: 5, cn: 1, svc: 5, why: "한 회사만 공급. 대당 가격과 설치 기반 서비스가 모두 크다. 대중국 수출이 막혀 있어 중국 노출은 낮다" },
    { id: "duv", name: "DUV 노광(ArF 액침·ArF·KrF·i-line)", grp: "litho", step: { s_litho: 2 }, tech: { t_opt: 2, t_stage: 2, t_sw: 1 }, part: { pt_optic: 2, pt_source: 2, pt_robot: 1 }, co: { c_asml: 2, c_nik: 2, c_can: 1 },
      m: 4, con: 4, g: 3, cn: 4, svc: 4, why: "성숙 노드와 중국 투자의 주력 노광. 공급자가 세 곳뿐이라 집중도가 높다" },
    { id: "track", name: "코터·디벨로퍼(트랙)", grp: "litho", step: { s_litho: 2 }, tech: { t_chem: 2, t_heat: 1, t_hand: 2 }, part: { pt_heater: 1, pt_gas: 1, pt_robot: 2 }, co: { c_tel: 2, c_scr: 1, c_kr: 1, c_cn: 1 },
      m: 4, con: 4, g: 3, cn: 3, svc: 3, why: "노광기와 한 몸처럼 붙어 도는 장비. EUV용 트랙은 공급자가 매우 적다" },
    { id: "etch_c", name: "도체 식각", grp: "etch", step: { s_etch: 2 }, tech: { t_plasma: 2, t_vac: 2, t_heat: 1, t_sw: 1 }, part: { pt_esc: 2, pt_ring: 2, pt_cer: 2, pt_shower: 2, pt_coat: 2, pt_rf: 2, pt_vac: 2, pt_gas: 2 },
      co: { c_lam: 2, c_amat: 1, c_tel: 1, c_hht: 1, c_kr: 1, c_cn: 1 }, m: 3, con: 3, g: 5, cn: 4, svc: 5, why: "게이트·배선 패턴을 깎는다. 소모 부품이 가장 많이 도는 장비라 설치 기반 매출이 크다" },
    { id: "etch_d", name: "유전체 식각(고종횡비 포함)", grp: "etch", step: { s_etch: 2 }, tech: { t_plasma: 2, t_vac: 2, t_heat: 1 }, part: { pt_esc: 2, pt_ring: 2, pt_cer: 1, pt_shower: 2, pt_coat: 2, pt_rf: 2, pt_vac: 2, pt_gas: 2 },
      co: { c_tel: 2, c_lam: 2, c_cn: 1 }, m: 3, con: 4, g: 5, cn: 4, svc: 5, why: "3D 낸드 채널홀·DRAM 커패시터처럼 깊고 좁은 구멍을 뚫는다. 적층이 높아질수록 수요가 커진다" },
    { id: "cvd", name: "CVD(플라즈마·열)", grp: "dep", step: { s_dep: 2 }, tech: { t_chem: 2, t_plasma: 1, t_heat: 2, t_vac: 2 }, part: { pt_heater: 2, pt_esc: 1, pt_shower: 2, pt_cer: 1, pt_rf: 1, pt_vac: 2, pt_gas: 2 },
      co: { c_amat: 2, c_lam: 2, c_tel: 1, c_asm: 1, c_kr: 1, c_cn: 1 }, m: 3, con: 3, g: 4, cn: 4, svc: 4, why: "절연막·하드마스크를 쌓는다. 공급자가 비교적 많고 한국·중국 업체의 진입이 활발하다" },
    { id: "ald", name: "ALD(원자층 증착)", grp: "dep", step: { s_dep: 2 }, tech: { t_chem: 2, t_vac: 2, t_heat: 1 }, part: { pt_heater: 2, pt_shower: 2, pt_vac: 2, pt_gas: 2, pt_rf: 1 },
      co: { c_asm: 2, c_tel: 1, c_lam: 1, c_amat: 1, c_kok: 1, c_kr: 1 }, m: 2, con: 3, g: 5, cn: 3, svc: 3, why: "원자 한 층씩 쌓아 GAA·고유전막에 필수. 선단 로직과 DRAM 미세화에 따라 커진다" },
    { id: "pvd", name: "PVD(스퍼터링)", grp: "dep", step: { s_dep: 2 }, tech: { t_plasma: 2, t_vac: 2 }, part: { pt_esc: 2, pt_heater: 1, pt_cer: 1, pt_rf: 1, pt_vac: 2, pt_gas: 1 },
      co: { c_amat: 2, c_cn: 1 }, m: 4, con: 4, g: 3, cn: 3, svc: 3, why: "금속 배선·장벽막을 입힌다. 오래된 시장이고 한 회사 비중이 크다" },
    { id: "epi", name: "에피택시", grp: "dep", step: { s_dep: 2 }, tech: { t_heat: 2, t_chem: 2, t_vac: 1 }, part: { pt_heater: 2, pt_quartz: 2, pt_gas: 2, pt_vac: 1 },
      co: { c_amat: 2, c_asm: 2 }, m: 3, con: 4, g: 4, cn: 2, svc: 3, why: "결정 성장으로 소스·드레인과 채널을 만든다. GAA 전환으로 단계 수가 늘었다" },
    { id: "furnace", name: "퍼니스(배치 열처리·증착)", grp: "therm", step: { s_therm: 2, s_dep: 1 }, tech: { t_heat: 2, t_chem: 1, t_hand: 1 }, part: { pt_quartz: 2, pt_heater: 1, pt_gas: 2, pt_robot: 1 },
      co: { c_tel: 2, c_kok: 2, c_asm: 1, c_kr: 1, c_cn: 1 }, m: 4, con: 4, g: 3, cn: 3, svc: 3, why: "웨이퍼 백여 장을 한 번에 데운다. 쿼츠 튜브·보트가 대표 소모품" },
    { id: "rtp", name: "급속 열처리·어닐", grp: "therm", step: { s_therm: 2 }, tech: { t_heat: 2, t_opt: 1 }, part: { pt_quartz: 1, pt_heater: 1, pt_sensor: 1 },
      co: { c_amat: 2, c_scr: 1, c_kr: 1, c_cn: 1 }, m: 4, con: 3, g: 3, cn: 3, svc: 2, why: "램프·레이저로 몇 초 안에 데우고 식힌다. 온도 측정과 균일도가 장벽" },
    { id: "imp", name: "이온주입", grp: "therm", step: { s_imp: 2 }, tech: { t_ion: 2, t_vac: 2 }, part: { pt_vac: 2, pt_esc: 1, pt_robot: 1, pt_sensor: 1 },
      co: { c_amat: 2, c_axc: 2, c_cn: 1 }, m: 4, con: 4, g: 2, cn: 4, svc: 3, why: "불순물을 원하는 깊이에 넣는다. 전력 반도체(SiC)와 성숙 노드 투자 비중이 크다" },
    { id: "clean", name: "세정(매엽·배치)", grp: "clean", step: { s_clean: 2 }, tech: { t_chem: 2, t_hand: 2 }, part: { pt_robot: 2, pt_gas: 1, pt_quartz: 1 },
      co: { c_scr: 2, c_tel: 2, c_lam: 2, c_kr: 1, c_cn: 1 }, m: 4, con: 3, g: 3, cn: 4, svc: 3, why: "공정 단계마다 끼어 횟수가 가장 많다. 약액과 건조 기술, 이물 관리가 경쟁 요소" },
    { id: "cmp", name: "CMP", grp: "clean", step: { s_cmp: 2 }, tech: { t_stage: 2, t_chem: 1, t_sw: 1 }, part: { pt_sensor: 1, pt_robot: 1 },
      co: { c_amat: 2, c_eba: 2, c_cn: 1 }, m: 4, con: 4, g: 3, cn: 3, svc: 3, why: "깎아서 평평하게 만든다. 두 회사가 대부분이고 패드·슬러리 같은 소모품 시장이 따로 크다" },
    { id: "insp", name: "웨이퍼 결함 검사", grp: "meas", step: { s_meas: 2 }, tech: { t_opt: 2, t_ebeam: 1, t_sw: 2 }, part: { pt_optic: 2, pt_sensor: 2, pt_robot: 1, pt_source: 1 },
      co: { c_kla: 2, c_amat: 1, c_hht: 1, c_ont: 1 }, m: 3, con: 5, g: 4, cn: 3, svc: 4, why: "수율을 지키는 눈. 광학·알고리즘 축적이 장벽이라 한 회사 비중이 매우 크다" },
    { id: "metro", name: "계측(CD·오버레이·박막)", grp: "meas", step: { s_meas: 2, s_litho: 1 }, tech: { t_opt: 2, t_ebeam: 2, t_sw: 2 }, part: { pt_optic: 2, pt_sensor: 2, pt_robot: 1 },
      co: { c_kla: 2, c_hht: 2, c_asml: 1, c_ont: 1, c_kr: 1 }, m: 3, con: 4, g: 4, cn: 3, svc: 4, why: "선폭·겹침 정밀도를 잰다. 노광과 묶어 보정하는 데이터 연동이 경쟁력" },
    { id: "mask", name: "마스크 검사·쓰기", grp: "meas", step: { s_meas: 2, s_litho: 1 }, tech: { t_opt: 2, t_ebeam: 2, t_sw: 1 }, part: { pt_optic: 2, pt_sensor: 2, pt_source: 1 },
      co: { c_kla: 2, c_las: 2 }, m: 3, con: 5, g: 4, cn: 1, svc: 3, why: "EUV 마스크 결함을 찾는다. 공급자가 극소수" },
    { id: "bond", name: "본딩(TC·하이브리드)", grp: "back", step: { s_back: 2 }, tech: { t_stage: 2, t_heat: 2, t_sw: 1 }, part: { pt_heater: 2, pt_sensor: 1, pt_robot: 1 },
      co: { c_bes: 2, c_amat: 1, c_kr: 1 }, m: 1, con: 2, g: 5, cn: 2, svc: 2, why: "HBM 적층과 칩렛 패키징의 핵심. 방식이 바뀌는 도입기라 순위가 아직 굳지 않았다" },
    { id: "dice", name: "다이싱·그라인딩", grp: "back", step: { s_back: 2 }, tech: { t_stage: 2, t_opt: 1 }, part: { pt_sensor: 1, pt_robot: 1, pt_optic: 1 },
      co: { c_dis: 2, c_kr: 1 }, m: 5, con: 5, g: 3, cn: 2, svc: 4, why: "웨이퍼를 얇게 갈고 자른다. 한 회사 비중이 크고 블레이드·휠 같은 소모품 매출이 꾸준하다" }
  ];
  const SCORE_KEYS = ["m", "con", "g", "cn", "svc"], SCORE_NAMES = { m: "성숙도", con: "집중도", g: "성장 동인", cn: "중국 노출", svc: "서비스 중요도" };
  function lmSpec() {
    const nodes = [];
    STEPS.forEach((q) => nodes.push({ id: q[0], col: "step", name: q[1] }));
    SEGS.forEach((s) => nodes.push({ id: "e_" + s.id, col: "eq", name: s.name, grp: s.grp }));
    TECH.forEach((q) => nodes.push({ id: q[0], col: "tech", name: q[1] }));
    PARTS.forEach((q) => nodes.push({ id: q[0], col: "part", name: q[1] }));
    COS.forEach((q) => nodes.push({ id: q[0], col: "co", name: q[1] }));
    const items = SEGS.map((s) => ({ id: s.id, name: s.name, grp: s.grp, m: { step: s.step, eq: { ["e_" + s.id]: 2 }, tech: s.tech, part: s.part, co: s.co } }));
    return { cols: COLS, nodes: nodes, items: items };
  }
  /* 업체별 주력·참여 세그먼트 수와 기능 묶음 폭 */
  function coBreadth() {
    return COS.map((q) => { const main = SEGS.filter((s) => s.co[q[0]] === 2), part = SEGS.filter((s) => s.co[q[0]] === 1);
      return { id: q[0], name: q[1], main: main.length, part: part.length, groups: Array.from(new Set(main.concat(part).map((s) => s.grp))).length }; });
  }
  /* 부품군별로 그것을 쓰는 장비 세그먼트 수(주력 2만) */
  function partDemand() { return PARTS.map((q) => ({ id: q[0], name: q[1], main: SEGS.filter((s) => s.part[q[0]] === 2).length, any: SEGS.filter((s) => s.part[q[0]]).length })); }
  return { GROUPS, COLS, STEPS, TECH, PARTS, PART_LINK, COS, SEGS, SCORE_KEYS, SCORE_NAMES, lmSpec, coBreadth, partDemand };
});

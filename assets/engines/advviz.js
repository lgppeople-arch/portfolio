/* 고급 차트(tools/charts.html '복잡하지만 쓸 만한 차트')의 자료와 배치 계산. 수치는 모두 가상(억원).
   그림이 숫자를 정확히 옮기는지 검산할 수 있게, 화면 코드와 분리해 둔다.
   - sankey: 중간 노드의 들어온 양 = 나간 양(흐름 보존)
   - squarify: 트리맵 사각형 넓이 ∝ 값, 넓이 합 = 전체(Bruls·Huizing·van Wijk 2000의 squarified 방식)
   - mekko: 폭 = 매출 비중, 높이 = 이익률 → 넓이 = 이익
   - chord: 호의 각 ∝ 행 합계
   - kde: 가우시안 핵 밀도, 적분 ≈ 1 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.AdvViz = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  /* ---------- 1. 생키: 손익 흐름 ---------- */
  const SANKEY = {
    nodes: [
      { id: "a", label: "A 제품", col: 0 }, { id: "b", label: "B 제품", col: 0 }, { id: "c", label: "C 제품", col: 0 },
      { id: "rev", label: "매출", col: 1 },
      { id: "cogs", label: "매출원가", col: 2, bad: true }, { id: "gp", label: "매출총이익", col: 2 },
      { id: "mat", label: "재료비", col: 3, bad: true }, { id: "lab", label: "노무비", col: 3, bad: true }, { id: "ovh", label: "제조경비", col: 3, bad: true },
      { id: "sga", label: "판관비", col: 3, bad: true }, { id: "op", label: "영업이익", col: 3 },
      { id: "tax", label: "금융·법인세", col: 4, bad: true }, { id: "ni", label: "순이익", col: 4 }
    ],
    links: [["a", "rev", 520], ["b", "rev", 330], ["c", "rev", 150], ["rev", "cogs", 680], ["rev", "gp", 320],
      ["cogs", "mat", 380], ["cogs", "lab", 120], ["cogs", "ovh", 180], ["gp", "sga", 190], ["gp", "op", 130], ["op", "tax", 40], ["op", "ni", 90]]
  };
  function sankey(d) {
    const io = {}; d.nodes.forEach((n) => { io[n.id] = { in: 0, out: 0 }; });
    d.links.forEach((l) => { io[l[0]].out += l[2]; io[l[1]].in += l[2]; });
    const nodes = d.nodes.map((n) => Object.assign({}, n, { in: io[n.id].in, out: io[n.id].out, value: Math.max(io[n.id].in, io[n.id].out) }));
    const mid = nodes.filter((n) => n.in > 0 && n.out > 0);
    return { nodes: nodes, balanced: mid.every((n) => Math.abs(n.in - n.out) < 1e-9), total: sum(nodes.filter((n) => n.in === 0).map((n) => n.out)) };
  }
  /* 열마다 위에서 아래로 쌓는다. H: 그림 높이, gap: 노드 사이 간격. 반환: 노드 y0·y1, 링크의 양 끝 세로 구간 */
  function sankeyLayout(d, H, gap) {
    const S = sankey(d), cols = {}; S.nodes.forEach((n) => { (cols[n.col] = cols[n.col] || []).push(n); });
    const maxLoad = Math.max.apply(null, Object.keys(cols).map((k) => sum(cols[k].map((n) => n.value)))), maxN = Math.max.apply(null, Object.keys(cols).map((k) => cols[k].length));
    const k = (H - gap * (maxN - 1)) / maxLoad, pos = {};
    Object.keys(cols).forEach((c) => { const list = cols[c], used = sum(list.map((n) => n.value)) * k + gap * (list.length - 1); let y = (H - used) / 2;
      list.forEach((n) => { pos[n.id] = { y0: y, y1: y + n.value * k, so: y, si: y, col: +c, node: n }; y += n.value * k + gap; }); });
    const links = d.links.map((l) => { const a = pos[l[0]], b = pos[l[1]], h = l[2] * k, r = { from: l[0], to: l[1], v: l[2], sy0: a.so, sy1: a.so + h, ty0: b.si, ty1: b.si + h }; a.so += h; b.si += h; return r; });
    return { k: k, pos: pos, links: links, ncol: Object.keys(cols).length };
  }

  /* ---------- 2. 마리메꼬: 사업부 매출 × 이익률 ---------- */
  const MEKKO = [{ name: "A 사업부", rev: 400, m: 18 }, { name: "B 사업부", rev: 300, m: 9 }, { name: "C 사업부", rev: 200, m: -4 }, { name: "D 사업부", rev: 100, m: 25 }];
  function mekko(d) {
    const tot = sum(d.map((x) => x.rev)); let x0 = 0;
    const rows = d.map((x) => { const w = x.rev / tot, r = { name: x.name, rev: x.rev, m: x.m, x0: x0, w: w, profit: x.rev * x.m / 100 }; x0 += w; return r; });
    return { rows: rows, total: tot, profit: sum(rows.map((r) => r.profit)), margin: sum(rows.map((r) => r.profit)) / tot * 100 };
  }

  /* ---------- 3. 평행 좌표: 투자안 다기준 비교. good: 1이면 클수록 좋음, −1이면 작을수록 좋음 ---------- */
  const PC = {
    axes: [{ k: "npv", label: "NPV", unit: "억", good: 1 }, { k: "irr", label: "IRR", unit: "%", good: 1 }, { k: "pb", label: "회수기간", unit: "년", good: -1 }, { k: "loss", label: "손실확률", unit: "%", good: -1 }, { k: "capex", label: "투자액", unit: "억", good: -1 }],
    items: [
      { name: "증설 A", npv: 85, irr: 14.5, pb: 5.2, loss: 28, capex: 600 },
      { name: "증설 B(단계)", npv: 70, irr: 13.0, pb: 5.8, loss: 16, capex: 380 },
      { name: "신공장", npv: 140, irr: 12.2, pb: 7.4, loss: 35, capex: 1500 },
      { name: "자동화", npv: 32, irr: 19.0, pb: 3.1, loss: 9, capex: 120 },
      { name: "노후 교체", npv: 12, irr: 10.1, pb: 6.5, loss: 12, capex: 90 },
      { name: "신제품 라인", npv: 55, irr: 16.4, pb: 4.6, loss: 41, capex: 300 }
    ]
  };
  /* 축마다 0(가장 나쁨)~1(가장 좋음)로 맞춘 값 */
  function pcScale(d) {
    const rng = {}; d.axes.forEach((a) => { const v = d.items.map((it) => it[a.k]); rng[a.k] = [Math.min.apply(null, v), Math.max.apply(null, v)]; });
    return { range: rng, rows: d.items.map((it) => ({ name: it.name, t: d.axes.map((a) => { const r = rng[a.k], u = (it[a.k] - r[0]) / (r[1] - r[0]); return a.good > 0 ? u : 1 - u; }) })) };
  }
  /* 다른 안에 모든 축에서 지지 않고 하나 이상에서 이기는 안이 있으면 '지배당함' */
  function dominated(d) {
    const S = pcScale(d).rows;
    return S.map((a, i) => S.some((b, j) => j !== i && b.t.every((v, k) => v >= a.t[k] - 1e-12) && b.t.some((v, k) => v > a.t[k] + 1e-12)));
  }

  /* ---------- 4. 연결 산점도: 재고와 단가의 순환(12분기) ---------- */
  const LOOP = (function () { const out = []; for (let i = 0; i < 12; i++) { const th = 2 * Math.PI * i / 11.2; out.push({ q: "Q" + (i % 4 + 1), yr: 2024 + Math.floor(i / 4), inv: 62 + 22 * Math.cos(th - 0.3) + (i % 3 - 1) * 1.5, price: 100 + 24 * Math.sin(th - 0.3) * -1 + (i % 2 ? 1.5 : -1.5) }); } return out; })();
  /* 닫힌 경로의 부호 있는 넓이(신발끈 공식). 화면 좌표가 아닌 자료 좌표 기준: 양수 = 반시계 */
  function loopArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a.inv * b.price - b.inv * a.price; } return s / 2; }

  /* ---------- 5. 트리맵: 비용 구조(크기 = 금액, 색 = 예산 대비 증감 %) ---------- */
  const TREE = [
    { group: "제조원가", name: "재료비", v: 380, d: 4.5 }, { group: "제조원가", name: "노무비", v: 120, d: 1.2 }, { group: "제조원가", name: "감가상각비", v: 90, d: 0 }, { group: "제조원가", name: "전력·용수", v: 50, d: 9.8 }, { group: "제조원가", name: "수선비", v: 40, d: -6.0 },
    { group: "판관비", name: "인건비", v: 80, d: 2.0 }, { group: "판관비", name: "연구개발비", v: 60, d: -3.5 }, { group: "판관비", name: "물류비", v: 30, d: 7.2 }, { group: "판관비", name: "기타", v: 20, d: -1.0 }
  ];
  /* squarified treemap: 값이 큰 순서로, 줄의 최악 가로세로비가 나빠지기 전까지 한 줄에 채운다 */
  function squarify(items, x, y, w, h) {
    const tot = sum(items.map((i) => i.v)), out = []; if (!(tot > 0)) return out;
    const list = items.slice().sort((a, b) => b.v - a.v).map((i) => ({ it: i, a: i.v / tot * w * h }));
    const worst = (row, side) => { const s = sum(row.map((r) => r.a)), mx = Math.max.apply(null, row.map((r) => r.a)), mn = Math.min.apply(null, row.map((r) => r.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
    let i = 0;
    while (i < list.length) {
      const side = Math.min(w, h), row = [list[i]]; i++;
      while (i < list.length && worst(row.concat([list[i]]), side) <= worst(row, side)) { row.push(list[i]); i++; }
      const s = sum(row.map((r) => r.a));
      if (w >= h) { const rw = s / h; let yy = y; row.forEach((r) => { const rh = r.a / rw; out.push({ it: r.it, x: x, y: yy, w: rw, h: rh }); yy += rh; }); x += rw; w -= rw; }
      else { const rh = s / w; let xx = x; row.forEach((r) => { const rw = r.a / rh; out.push({ it: r.it, x: xx, y: y, w: rw, h: rh }); xx += rw; }); y += rh; h -= rh; }
    }
    return out;
  }
  /* 두 단계: 묶음별 사각형을 먼저 나누고, 그 안을 다시 나눈다 */
  function treemap(d, W, H) {
    const groups = {}; d.forEach((x) => { (groups[x.group] = groups[x.group] || []).push(x); });
    const top = squarify(Object.keys(groups).map((g) => ({ name: g, v: sum(groups[g].map((x) => x.v)) })), 0, 0, W, H), cells = [];
    top.forEach((t) => squarify(groups[t.it.name], t.x, t.y, t.w, t.h).forEach((c) => cells.push(Object.assign({ group: t.it.name }, c))));
    return { groups: top, cells: cells, total: sum(d.map((x) => x.v)) };
  }

  /* ---------- 6. 코드 다이어그램 대 행렬: 계열사 간 내부거래(행 = 파는 회사, 열 = 사는 회사) ---------- */
  const FLOW = { names: ["지주", "소재", "부품", "장비", "물류"], m: [[0, 12, 18, 6, 2], [4, 0, 95, 22, 3], [3, 14, 0, 40, 5], [2, 8, 26, 0, 1], [1, 30, 44, 12, 0]] };
  function chord(d, gap) {
    const n = d.names.length, row = d.m.map((r) => sum(r)), tot = sum(row), k = (2 * Math.PI - gap * n) / tot, groups = []; let a = 0;
    for (let i = 0; i < n; i++) { groups.push({ i: i, a0: a, a1: a + row[i] * k, v: row[i] }); a += row[i] * k + gap; }
    const sub = d.m.map((r, i) => { let p = groups[i].a0; return r.map((v) => { const s = { a0: p, a1: p + v * k }; p += v * k; return s; }); });
    const ribbons = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (d.m[i][j] + d.m[j][i] > 0) ribbons.push({ i: i, j: j, s: sub[i][j], t: sub[j][i], v: d.m[i][j], back: d.m[j][i] });
    return { groups: groups, ribbons: ribbons, total: tot, k: k, colSum: d.names.map((_, j) => sum(d.m.map((r) => r[j]))) };
  }

  /* ---------- 7. 능선 그림: 본부별 평가 점수 분포 ---------- */
  const RIDGE = [{ name: "영업본부", mu: 78, sd: 7, n: 60 }, { name: "생산본부", mu: 72, sd: 5, n: 90 }, { name: "연구소", mu: 81, sd: 9, n: 45 }, { name: "구매·SCM", mu: 74, sd: 4, n: 30 }, { name: "경영지원", mu: 84, sd: 3.5, n: 35 }];
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function samples(d, seed) { const r = rng(seed || 77); return d.map((g) => { const v = []; for (let i = 0; i < g.n; i++) { const u = Math.max(1e-12, r()), w = r(); v.push(g.mu + g.sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w)); } return { name: g.name, v: v }; }); }
  function kde(v, xs) {
    const n = v.length, m = sum(v) / n, sd = Math.sqrt(sum(v.map((x) => (x - m) * (x - m))) / (n - 1)), h = 1.06 * sd * Math.pow(n, -0.2);
    return { h: h, mean: m, sd: sd, y: xs.map((x) => sum(v.map((q) => Math.exp(-0.5 * Math.pow((x - q) / h, 2)))) / (n * h * Math.sqrt(2 * Math.PI))) };
  }

  /* ---------- 8. 버블 매트릭스: 자회사 포트폴리오(가로 = ROIC − WACC, 세로 = 매출 성장률, 크기 = 투하자본) ---------- */
  const PORT = [{ name: "소재", sp: 6.5, g: 4, ic: 1800 }, { name: "부품", sp: 3.0, g: 14, ic: 2600 }, { name: "장비", sp: -2.5, g: 18, ic: 900 }, { name: "물류", sp: 1.0, g: 2, ic: 500 }, { name: "신사업", sp: -6.0, g: 30, ic: 350 }, { name: "건자재", sp: -1.5, g: -3, ic: 1400 }];
  /* 면적이 값에 비례하도록 반지름 ∝ √값 */
  function bubbleR(v, vmax, rmax) { return rmax * Math.sqrt(v / vmax); }
  function portfolio(d) { const ic = sum(d.map((x) => x.ic)); return { ic: ic, eva: sum(d.map((x) => x.ic * x.sp / 100)), wsp: sum(d.map((x) => x.ic * x.sp)) / ic, pos: sum(d.filter((x) => x.sp > 0).map((x) => x.ic)) / ic }; }

  return { SANKEY, sankey, sankeyLayout, MEKKO, mekko, PC, pcScale, dominated, LOOP, loopArea, TREE, squarify, treemap, FLOW, chord, RIDGE, samples, kde, PORT, bubbleR, portfolio };
});

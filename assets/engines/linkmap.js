/* 다단 연결 지도(공용 엔진). 부품 지도와 장비 지도가 함께 쓴다.
   spec = { cols: [{ id, name }], nodes: [{ id, col, name }], items: [{ id, name, grp, m: { 기둥id: { 노드id: 굵기(1 일부, 2 주력) } } }] }
   - 항목(item): 지도를 지나가는 한 줄기(부품 세그먼트, 장비 세그먼트 등). 항목마다 기둥별로 닿는 칸이 있다.
   - 기둥을 끄면, 켜진 기둥끼리 순서대로 바로 잇는다(항목 줄기는 유지).
   - 칸 상태: 포함(in) 또는 제외(out). 같은 기둥 안의 포함은 '하나라도', 다른 기둥끼리는 '모두'(OR 안, AND 밖). 제외는 그 칸에 닿는 항목을 뺀다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.LinkMap = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const touches = (it, nodeId, col) => !!(it.m[col] && it.m[col][nodeId]);
  /* 상태에 맞는 항목 */
  function filterItems(spec, states) {
    states = states || {};
    const col = {}; spec.nodes.forEach((n) => { col[n.id] = n.col; });
    const ins = {}, outs = [];
    Object.keys(states).forEach((id) => { if (states[id] === "in") (ins[col[id]] = ins[col[id]] || []).push(id); else if (states[id] === "out") outs.push(id); });
    return spec.items.filter((it) => Object.keys(ins).every((c) => ins[c].some((id) => touches(it, id, c))) && outs.every((id) => !touches(it, id, col[id])));
  }
  /* 켜진 기둥 순서대로 이웃끼리 잇는 줄기. 굵기는 두 끝 중 약한 쪽 */
  function links(spec, visible, items) {
    const out = [];
    for (let i = 0; i + 1 < visible.length; i++) {
      const A = visible[i], B = visible[i + 1];
      items.forEach((it) => { const a = it.m[A] || {}, b = it.m[B] || {};
        Object.keys(a).forEach((x) => Object.keys(b).forEach((y) => out.push({ a: x, b: y, item: it.id, w: Math.min(a[x], b[y]) }))); });
    }
    return out;
  }
  /* 같은 두 칸 사이 줄기를 묶는다(그리기용) */
  function bundle(ls) {
    const m = {};
    ls.forEach((l) => { const k = l.a + ">" + l.b; const q = m[k] || (m[k] = { a: l.a, b: l.b, w: 0, items: [] }); q.w += l.w; if (q.items.indexOf(l.item) < 0) q.items.push(l.item); });
    return Object.keys(m).map((k) => m[k]);
  }
  /* 칸마다 남은 항목 수 */
  function counts(spec, items) {
    const c = {}; spec.nodes.forEach((n) => { c[n.id] = 0; });
    items.forEach((it) => Object.keys(it.m).forEach((cc) => Object.keys(it.m[cc]).forEach((id) => { if (id in c) c[id]++; })));
    return c;
  }
  /* 상태 순환: 없음 → 포함 → 제외 → 없음 */
  function cycle(states, id) { const s = Object.assign({}, states), v = s[id]; if (!v) s[id] = "in"; else if (v === "in") s[id] = "out"; else delete s[id]; return s; }
  return { filterItems, links, bundle, counts, cycle };
});

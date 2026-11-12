/* 홈의 영업이익 미니 시뮬레이터. 가상 제조사업: 매출 1,000억원, 변동비 650억원(65%), 고정비 250억원, 영업이익 100억원.
   단가 p, 물량 v, 단위 변동비 c(모두 변동률)를 바꾸면
     매출 = 1,000 × (1 + p) × (1 + v), 변동비 = 650 × (1 + v) × (1 + c)
   영업이익 차이를 세 효과로 나누고 합계가 정확히 맞게 한다(물량 → 단가 → 원가 순서).
     물량 효과 = 기준 공헌이익 350 × v
     단가 효과 = 1,000 × (1 + v) × p
     원가 효과 = −650 × (1 + v) × c */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.OpSim = api;
  if (typeof document !== "undefined") api.mount();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const BASE = { rev: 1000, vc: 650, fixed: 250 };
  function calc(p, v, c, b) {
    b = b || BASE;
    const op0 = b.rev - b.vc - b.fixed, rev = b.rev * (1 + p) * (1 + v), vc = b.vc * (1 + v) * (1 + c), op = rev - vc - b.fixed;
    const eff = { volume: (b.rev - b.vc) * v, price: b.rev * (1 + v) * p, cost: -b.vc * (1 + v) * c };
    return { op0: op0, m0: op0 / b.rev, rev: rev, vc: vc, op: op, m: rev > 0 ? op / rev : 0, eff: eff, dol: (b.rev - b.vc) / op0 };
  }
  function mount() {
    const go = () => {
      const host = document.getElementById("opsim"); if (!host) return;
      const $ = (id) => document.getElementById(id), f = (x, d) => (x < 0 ? "−" : "") + Math.abs(x).toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
      const sg = (x, d) => (x > 1e-9 ? "+" : "") + f(Math.abs(x) < 1e-9 ? 0 : x, d);
      function draw() {
        const p = +$("os-p").value / 100, v = +$("os-v").value / 100, c = +$("os-c").value / 100, R = calc(p, v, c);
        $("os-pv").textContent = sg(p * 100) + "%"; $("os-vv").textContent = sg(v * 100) + "%"; $("os-cv").textContent = sg(c * 100) + "%";
        $("os-rev").textContent = f(R.rev, 0); $("os-rev-d").textContent = "기준 1,000 · " + sg(R.rev - BASE.rev, 0);
        $("os-op").textContent = f(R.op, 1); $("os-op").classList.toggle("neg", R.op < 0); $("os-op-d").textContent = "기준 100 · " + sg(R.op - R.op0, 1);
        $("os-m").textContent = f(R.m * 100, 1) + "%"; $("os-m-d").textContent = "기준 10.0% · " + sg((R.m - R.m0) * 100, 1) + "%p";
        const rows = [["단가", R.eff.price], ["물량", R.eff.volume], ["원가", R.eff.cost], ["합계", R.op - R.op0]], mx = Math.max(20, ...rows.map((r) => Math.abs(r[1])));
        rows.forEach((r, i) => { const bar = $("os-b" + i), w = Math.abs(r[1]) / mx * 50; bar.style.width = w + "%"; bar.style.left = (r[1] >= 0 ? 50 : 50 - w) + "%"; bar.className = "osb " + (r[1] > 1e-9 ? "up" : r[1] < -1e-9 ? "dn" : "") + (i === 3 ? " tot" : ""); $("os-n" + i).textContent = sg(r[1], 1); });
        $("os-note").textContent = Math.abs(R.op - R.op0) < 1e-9 ? "기준 상태입니다. 막대를 움직여 보세요. 단가 1%는 영업이익을 10억원(10%), 물량 1%는 3.5억원, 단위 변동비 1%는 6.5억원 움직입니다. 고정비 250억원 때문에 이익은 매출보다 " + f(R.dol, 1) + "배 크게 흔들립니다(영업레버리지)."
          : "매출이 " + sg((R.rev / BASE.rev - 1) * 100, 1) + "% 바뀌는 동안 영업이익은 " + sg((R.op / R.op0 - 1) * 100, 1) + "% 바뀌었습니다. 세 효과를 더하면 영업이익 차이 " + sg(R.op - R.op0, 1) + "억원과 정확히 같습니다.";
      }
      ["os-p", "os-v", "os-c"].forEach((id) => $(id).addEventListener("input", draw));
      $("os-reset").addEventListener("click", () => { ["os-p", "os-v", "os-c"].forEach((id) => { $(id).value = 0; }); draw(); });
      draw();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  }
  return { BASE: BASE, calc: calc, mount: mount };
});

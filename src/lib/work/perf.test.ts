import { describe, expect, it } from "vitest";
import { bigBudget } from "@/lib/budget/synthetic";
import { detectLayout, loadWorkbook, parseBudget } from "@/lib/budget/parse";
import { buildPlan } from "./buildPlan";

// SRS SR-NF-03·05·08: 가정값 수정 후 재계산(검증 포함) 3초 이내, 동시 3명에서도 유지, 같은 입력이면 결과 동일
async function setup() {
  const wb = await loadWorkbook(await bigBudget(100, 800));
  const layout = detectLayout(wb);
  if (!layout.ok) throw new Error(layout.reason);
  return parseBudget(wb, layout.mapping);
}
const input = (parsed: Awaited<ReturnType<typeof setup>>, startDate: string) => ({
  parsed,
  startDate,
  durationDays: "200",
  holidaysText: "2026-12-25\n2027-01-01",
  schedule: {},
  extraLabor: [],
  extraEquipment: [],
});

describe("재계산 성능·재현성", () => {
  it("800행·100공종 내역서에서 착공일을 바꿔 다시 계산(검증 포함)하는 데 3초가 안 걸린다 (SR-NF-03)", async () => {
    const parsed = await setup();
    buildPlan(input(parsed, "2026-11-02")); // 첫 호출의 준비 비용은 제외
    const t0 = performance.now();
    const out = buildPlan(input(parsed, "2026-12-01"));
    expect((performance.now() - t0) / 1000).toBeLessThan(3);
    expect(out.result?.validation.passed).toBe(true);
  });

  it("3명이 동시에 계산해도 각각 3초 안에 끝난다 (SR-NF-05)", async () => {
    const parsed = await setup();
    const run = async () => {
      const t0 = performance.now();
      buildPlan(input(parsed, "2026-11-02"));
      return (performance.now() - t0) / 1000;
    };
    const times = await Promise.all([run(), run(), run()]);
    for (const t of times) expect(t).toBeLessThan(3);
  });

  it("같은 입력·가정값이면 결과가 100% 같다 (SR-NF-08)", async () => {
    const parsed = await setup();
    const a = JSON.stringify(buildPlan(input(parsed, "2026-11-02")));
    const b = JSON.stringify(buildPlan(input(parsed, "2026-11-02")));
    expect(a).toBe(b);
  });
});

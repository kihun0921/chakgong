import { describe, expect, it } from "vitest";
import { computePlan } from "@/domain/plan";
import { assemblePlanInput } from "./assemble";
import type { ParsedBudget } from "./parse";

// SRS SR-SC-01·03·04, SR-RS-01·05 / PRD AC-F2-2, AC-F4-1 (T-05, T-10의 조립 부분)
const parsed: ParsedBudget = {
  summary: [
    { code: "A01", name: "냉난방기", material: 5000, labor: 3000, expense: 1000, total: 9000 },
    { code: "A02", name: "배관", material: 2000, labor: 6000, expense: 500, total: 8500 },
    { code: "A03", name: "관급 분리발주", material: 0, labor: 0, expense: 0, total: 0 },
  ],
  summaryTotal: 17_500,
  grandTotal: 17_500,
  summaryTotalMatchesGrandTotal: true,
  labor: [
    { code: "A02", trade: "배관공(급수급탕)", quantity: 44, wage: 250_000 },
    { code: "A02", trade: "배관공(오배수)", quantity: 53, wage: 250_000 },
    { code: "A02", trade: "배관공(철거)", quantity: 4, wage: 250_000 },
  ],
  equipment: [{ code: "A01", name: "크레인 100ton", hours: 18 }],
  warnings: [],
};

const settings = {
  start: "2026-11-02",
  durationDays: 70,
  holidays: new Set(["2026-12-25", "2027-01-01"]),
};

describe("파싱 결과를 계산 입력으로 조립", () => {
  const a = assemblePlanInput(parsed, settings);

  it("집계표 공종마다 공정이 만들어지고 0원 공종도 남는다", () => {
    expect(a.input.processes.map((p) => [p.key, p.amount])).toEqual([
      ["A01", 9000],
      ["A02", 8500],
      ["A03", 0],
    ]);
    expect(a.cooperationKeys).toEqual(["A03"]); // 금액 없이 협조 구간으로만 표시
  });

  it("일정을 정하지 않은 공정은 전체 공기(1~70일차)를 기본값으로 쓴다", () => {
    expect(a.input.processes.every((p) => p.startDay === 1 && p.endDay === 70)).toBe(true);
  });

  it("공정별 일정을 지정하면 그대로 쓴다", () => {
    const b = assemblePlanInput(parsed, { ...settings, schedule: { A02: { startDay: 10, endDay: 30 } } });
    const a02 = b.input.processes.find((p) => p.key === "A02");
    expect([a02?.startDay, a02?.endDay]).toEqual([10, 30]);
  });

  it("내역서 노무 수량이 그대로 투입수에 들어가고 방식은 '내역서'다 (T-10)", () => {
    expect(a.input.laborLines.map((l) => [l.name, l.manDays, l.method])).toEqual([
      ["배관공(급수급탕)", 44, "내역서"],
      ["배관공(오배수)", 53, "내역서"],
      ["배관공(철거)", 4, "내역서"],
    ]);
  });

  it("내역서 장비(HR)는 올림(HR÷8) 대·일로 들어간다", () => {
    expect(a.input.equipmentLines).toHaveLength(1);
    expect(a.input.equipmentLines[0]).toMatchObject({ name: "크레인 100ton", manDays: 3, method: "내역서" });
  });

  it("집계표 합계가 계산 입력의 순공사비가 되고 검증을 통과한다", () => {
    expect(a.input.summaryTotalWon).toBe(17_500);
    const r = computePlan(a.input);
    expect(r.validation).toEqual({ passed: true, issues: [] });
    expect(r.labor.total).toBe(101);
  });

  it("공종코드가 집계표에 없는 노무 행은 조립하지 않고 알려 준다", () => {
    const bad: ParsedBudget = {
      ...parsed,
      labor: [...parsed.labor, { code: "ZZ9", trade: "용접공", quantity: 5, wage: 1 }],
    };
    const b = assemblePlanInput(bad, settings);
    expect(b.input.laborLines).toHaveLength(3);
    expect(b.unmatched.map((u) => u.name)).toEqual(["용접공"]);
  });

  it("노무 수량이 소수이면 반올림해 담고 경고한다", () => {
    const frac: ParsedBudget = {
      ...parsed,
      labor: [{ code: "A02", trade: "배관공", quantity: 10.5, wage: 1 }],
    };
    const b = assemblePlanInput(frac, settings);
    expect(b.input.laborLines[0].manDays).toBe(11);
    expect(b.warnings.join(" ")).toContain("소수");
  });
});

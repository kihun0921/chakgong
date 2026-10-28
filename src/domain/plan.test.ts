import { describe, expect, it } from "vitest";
import { computePlan, type PlanInput } from "./plan";
import { DAAI } from "./golden/daai-fixture";
import { round2 } from "./progress";

// SRS SR-PG-04, SR-VR-07 / PRD AC-F3-2 (T-08의 계산 규칙 부분): 착공일을 바꿔도 합계는 변하지 않는다
const base: PlanInput = {
  start: "2026-11-02",
  durationDays: 70,
  holidays: new Set(["2026-12-25", "2027-01-01"]),
  processes: [
    { key: "A", name: "A 공정", amount: 600, startDay: 1, endDay: 15 },
    { key: "B", name: "B 공정", amount: 300, startDay: 16, endDay: 45 },
    { key: "C", name: "C 공정", amount: 100, startDay: 46, endDay: 70 },
  ],
  laborLines: [
    { processKey: "A", name: "배관공", manDays: 10, method: "내역서", basis: "내역서" },
    { processKey: "B", name: "배관공", manDays: 20, method: "내역서", basis: "내역서" },
    { processKey: "C", name: "보통인부", manDays: 5, method: "가정", basis: "직접 지정" },
  ],
  equipmentLines: [{ processKey: "A", name: "크레인", manDays: 3, method: "내역서", basis: "18HR ÷ 8" }],
  summaryTotalWon: 1000,
};

describe("공정·인원·장비를 한 번에 계산하고 검증한다", () => {
  const r = computePlan(base);

  it("준공일과 구간을 만든다", () => {
    expect(r.completion).toBe("2027-01-10");
    expect(r.periods).toHaveLength(5);
  });

  it("진도율 누계가 100.00이고 검증을 통과한다", () => {
    expect(round2(r.progress.cumulative.at(-1) ?? 0)).toBe(100);
    expect(r.validation).toEqual({ passed: true, issues: [] });
  });

  it("연인원·장비 합계가 구간 합과 같다", () => {
    expect(r.labor.total).toBe(35);
    expect(r.labor.periodTotals.reduce((s, v) => s + v, 0)).toBe(35);
    expect(r.equipment.total).toBe(3);
    expect(r.labor.assumedTotal).toBe(5);
  });

  it("구간별 일평균은 작업일수가 0이면 null이다", () => {
    expect(r.dailyAverage).toHaveLength(5);
    expect(r.dailyAverage[0]).not.toBeNull();
  });
});

describe("착공일·가정값 변경 시 재계산 (T-08)", () => {
  it("착공일을 2026-11-16으로 바꾸면 구간 머리글·준공일은 바뀌고 합계는 같다", () => {
    const a = computePlan(base);
    const b = computePlan({ ...base, start: "2026-11-16" });
    expect(b.completion).toBe("2027-01-24");
    expect(b.periods[0].start).toBe("2026-11-01");
    expect(b.periods.at(-1)?.end).toBe("2027-01-31");
    expect(b.labor.total).toBe(a.labor.total);
    expect(b.equipment.total).toBe(a.equipment.total);
    expect(round2(b.progress.cumulative.at(-1) ?? 0)).toBe(100);
    expect(b.validation.passed).toBe(true);
  });

  it("공정 금액 합이 집계표와 다르면 검증에 실패하고 차이를 알려 준다", () => {
    const r = computePlan({ ...base, summaryTotalWon: 1001 });
    expect(r.validation.passed).toBe(false);
    expect(r.validation.issues[0]).toMatchObject({ code: "V-1", diffWon: -1 });
  });

  it("완료일차가 공기를 넘으면 검증에 실패한다", () => {
    const r = computePlan({
      ...base,
      processes: base.processes.map((p) => (p.key === "C" ? { ...p, endDay: 75 } : p)),
    });
    expect(r.validation.passed).toBe(false);
    expect(r.validation.issues.some((i) => i.code === "DURATION")).toBe(true);
  });

  it("같은 입력이면 결과가 항상 같다 (재현성)", () => {
    expect(computePlan(base)).toEqual(computePlan(base));
  });
});

// ─────────────────────────────────────────────────────────────
// 기준 수치(golden) 시험: 실제 기준 공정표(중대범죄수사청(본청·서울청) 사무환경 조성사업(기계))의 값으로 맞춘다.
// 개발자 승인 없이 수정하지 않는다. (SRS 13.1 T-04·T-05·T-07·T-10·T-11)
const D = DAAI;
const goldenInput = (): PlanInput => ({
  start: D.start,
  durationDays: D.durationDays,
  holidays: new Set<string>(D.holidays),
  processes: D.processes.map((p) => ({ ...p })),
  laborLines: D.laborLines.map((l) => ({ ...l, basis: "기준 산정근거" })),
  equipmentLines: D.equipmentLines.map((l) => ({ ...l, basis: "기준 산정근거" })),
  summaryTotalWon: D.summaryTotalWon,
});

describe("기준 공정표 기준 수치", () => {
  const r = computePlan(goldenInput());

  it("T-05 순공사비 합계 622,764,021원, 집계표 차이 0원, 보할 합 100.00", () => {
    const total = D.processes.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(622_764_021);
    expect(total - D.summaryTotalWon).toBe(0);
    expect(round2(r.progress.rows.reduce((s, x) => s + x.weight, 0))).toBe(100);
    expect(r.validation.passed).toBe(true);
  });

  it("T-07 준공 2027-01-10, 진도율 누계 2.99 → 34.17 → 67.34 → 95.98 → 100.00, 구간 진도율도 같다", () => {
    expect(r.completion).toBe("2027-01-10");
    expect(r.periods).toHaveLength(5);
    expect(r.progress.cumulative.map(round2)).toEqual([2.99, 34.17, 67.34, 95.98, 100]);
    expect(r.progress.periodTotals.map(round2)).toEqual([...D.expected.periodProgress]);
  });

  it("T-10 배관공 급수급탕 44인·오배수 53인·철거 4인이 내역서 수량 그대로 투입수에 포함", () => {
    const find = (key: string, name: string) => r.labor.basisList.find((b) => b.processKey === key && b.name === name);
    expect(find("WSUP", "배관공")).toMatchObject({ manDays: 44, method: "내역서" });
    expect(find("WDRN", "배관공")).toMatchObject({ manDays: 53, method: "내역서" });
    expect(find("DEM", "배관공")).toMatchObject({ manDays: 4, method: "내역서" });
  });

  it("T-11 연인원 1,338인일, 장비 296대·일, 직종·장비별 구간 값이 정답표와 같고 정수·합이 보존된다", () => {
    expect(r.labor.total).toBe(1338);
    expect(r.equipment.total).toBe(296);
    expect(r.labor.byName).toEqual(D.expected.labor);
    expect(r.equipment.byName).toEqual(D.expected.equipment);
    expect(r.labor.periodTotals).toEqual([...D.expected.laborPeriodTotals]);
    expect(r.equipment.periodTotals).toEqual([...D.expected.equipmentPeriodTotals]);
    for (const row of [...Object.values(r.labor.byName), ...Object.values(r.equipment.byName)]) {
      expect(row.every(Number.isInteger)).toBe(true);
    }
  });

  it("구간 일평균 투입인원이 정답표와 같다 (0.6 / 31.36 / 49.45 / 37.09 / 7.00)", () => {
    expect(r.dailyAverage.map((v) => (v === null ? null : round2(v)))).toEqual([...D.expected.dailyAverage]);
  });
});

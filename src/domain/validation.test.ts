import { describe, expect, it } from "vitest";
import { validateCore, type CoreCheckInput } from "./validation";

// SRS SR-VR-01~03·05·06·07, 6.8 / PRD AC-F6-1, AC-F2-3, AC-F3-3, AC-F4-3 (T-06, T-09, T-12, T-16)
const ok: CoreCheckInput = {
  processTotalWon: 622_764_021,
  summaryTotalWon: 622_764_021,
  cumulativeLast: 100,
  laborTotals: { schedule: 1338, plan: 1338, basis: 1338 },
  equipmentTotals: { schedule: 296, plan: 296, basis: 296 },
  processes: [
    { key: "A", endDay: 70 },
    { key: "B", endDay: 45 },
  ],
  durationDays: 70,
};

describe("핵심 검증 (금액·진도율·연인원·공기)", () => {
  it("모두 맞으면 '통과'다 (T-16)", () => {
    const r = validateCore(ok);
    expect(r.passed).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("V-1: 공정표와 집계표 금액이 다르면 차이(원)와 함께 실패한다", () => {
    const r = validateCore({ ...ok, processTotalWon: 622_764_020 });
    expect(r.passed).toBe(false);
    expect(r.issues[0]).toMatchObject({ code: "V-1", diffWon: -1 });
  });

  it("V-2: 진도율 누계가 100.00이 아니면 실패한다 (T-09)", () => {
    const r = validateCore({ ...ok, cumulativeLast: 99.5 });
    expect(r.issues.map((i) => i.code)).toContain("V-2");
  });

  it("V-2: 부동소수 오차(99.9999999)는 100.00으로 본다", () => {
    expect(validateCore({ ...ok, cumulativeLast: 99.9999999 }).passed).toBe(true);
  });

  it("V-3: 공정표·투입계획표·산정근거의 연인원이 다르면 어긋난 항목을 알려 준다 (T-12)", () => {
    const r = validateCore({ ...ok, laborTotals: { schedule: 1338, plan: 1337, basis: 1338 } });
    const issue = r.issues.find((i) => i.code === "V-3");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("연인원");
  });

  it("V-3: 장비 대·일 합계도 같은지 본다", () => {
    const r = validateCore({ ...ok, equipmentTotals: { schedule: 296, plan: 296, basis: 295 } });
    expect(r.issues.find((i) => i.code === "V-3")?.message).toContain("장비");
  });

  it("공기 초과: 완료일차 75, 공기 70이면 경고하고 실패한다 (T-06)", () => {
    const r = validateCore({ ...ok, processes: [{ key: "A", endDay: 75 }] });
    expect(r.passed).toBe(false);
    expect(r.issues[0]).toMatchObject({ code: "DURATION", processKey: "A" });
  });

  it("여러 문제가 있으면 모두 모아서 알려 준다", () => {
    const r = validateCore({
      ...ok,
      processTotalWon: 1,
      cumulativeLast: 50,
      processes: [{ key: "A", endDay: 99 }],
    });
    expect(r.issues.map((i) => i.code).sort()).toEqual(["DURATION", "V-1", "V-2"]);
  });
});

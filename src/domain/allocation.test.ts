import { describe, expect, it } from "vitest";
import { buildPeriods } from "./calendar";
import { allocateByCumulativeRounding, distributeOverPeriods } from "./allocation";

// SRS SR-RS-04, 6.5 / PRD AC-F4-2 (T-07 누적 반올림)
describe("누적 반올림 배분", () => {
  it("모든 구간 값이 정수이고 합이 총량과 같다", () => {
    expect(allocateByCumulativeRounding(10, [1, 1, 1])).toEqual([3, 4, 3]);
  });

  it("0.5는 올림한다(엑셀 ROUND와 같다)", () => {
    expect(allocateByCumulativeRounding(5, [1, 1])).toEqual([3, 2]);
  });

  it("가중치가 0인 구간은 0이다", () => {
    expect(allocateByCumulativeRounding(7, [0, 2, 0, 5])).toEqual([0, 2, 0, 5]);
  });

  it("총량이 0이면 모두 0이다", () => {
    expect(allocateByCumulativeRounding(0, [3, 1])).toEqual([0, 0]);
  });

  it("임의 입력에서도 정수이고 합이 보존된다", () => {
    for (const total of [1, 7, 53, 1338, 296]) {
      for (const w of [[10, 11, 4], [1, 2, 3, 4, 5], [3, 0, 9], [1]]) {
        const x = allocateByCumulativeRounding(total, w);
        expect(x.every(Number.isInteger)).toBe(true);
        expect(x.reduce((s, v) => s + v, 0)).toBe(total);
      }
    }
  });

  it("가중치 합이 0인데 총량이 있으면 거부한다", () => {
    expect(() => allocateByCumulativeRounding(5, [0, 0])).toThrow(RangeError);
  });
});

describe("공정의 총량을 구간에 배분", () => {
  const periods = buildPeriods("2026-11-02", 70);
  const holidays = new Set(["2026-12-25", "2027-01-01"]);

  it("작업일수에 비례해 배분하고 합이 보존된다", () => {
    // 11/2~12/16 (공정 B 일정과 동일): 11/2~11/15 10일, 11/16~11/30 11일, 12/1~12/15 11일, 12/16 1일
    const x = distributeOverPeriods(44, "2026-11-02", "2026-12-16", periods, holidays);
    expect(x.reduce((s, v) => s + v, 0)).toBe(44);
    expect(x.every(Number.isInteger)).toBe(true);
    expect(x[4]).toBe(0); // 일정 밖 구간
  });

  it("공정 기간이 전부 휴일이면 달력일수로 배분한다", () => {
    // 2026-11-07(토)~11-08(일)
    const x = distributeOverPeriods(6, "2026-11-07", "2026-11-08", periods, holidays);
    expect(x.reduce((s, v) => s + v, 0)).toBe(6);
    expect(x[0]).toBe(6);
  });
});

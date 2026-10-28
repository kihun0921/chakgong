import { describe, expect, it } from "vitest";
import {
  addDays,
  buildPeriods,
  completionDate,
  countWorkdays,
  isWorkday,
} from "./calendar";

// SRS SR-SC-05, SR-RS-03, SR-PG-02 / PRD AC-F2-1 (T-04)
describe("준공일 = 착공일 + 공사기간 − 1", () => {
  it("착공일 2026-11-02, 공기 70일이면 준공예정일은 2027-01-10이다 (T-04)", () => {
    expect(completionDate("2026-11-02", 70)).toBe("2027-01-10");
  });

  it("공기 1일이면 준공일은 착공일과 같다", () => {
    expect(completionDate("2026-11-02", 1)).toBe("2026-11-02");
  });

  it("공사기간은 1 이상의 정수여야 한다", () => {
    expect(() => completionDate("2026-11-02", 0)).toThrow(RangeError);
    expect(() => completionDate("2026-11-02", 1.5)).toThrow(RangeError);
  });

  it("날짜 더하기는 월·연 경계를 넘는다", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("작업일수 (주5일, 공휴일 제외)", () => {
  const holidays = new Set(["2026-12-25"]);

  it("월~금은 작업일, 토·일과 공휴일은 아니다", () => {
    expect(isWorkday("2026-11-02", holidays)).toBe(true); // 월
    expect(isWorkday("2026-11-07", holidays)).toBe(false); // 토
    expect(isWorkday("2026-11-08", holidays)).toBe(false); // 일
    expect(isWorkday("2026-12-25", holidays)).toBe(false); // 금, 공휴일
  });

  it("11/2~11/15는 작업일이 10일이다", () => {
    expect(countWorkdays("2026-11-02", "2026-11-15", holidays)).toBe(10);
  });

  it("12/16~12/31은 공휴일(12/25)을 빼고 11일이다", () => {
    expect(countWorkdays("2026-12-16", "2026-12-31", holidays)).toBe(11);
    expect(countWorkdays("2026-12-16", "2026-12-31", new Set())).toBe(12);
  });

  it("끝이 시작보다 앞서면 0일이다", () => {
    expect(countWorkdays("2026-11-10", "2026-11-09", holidays)).toBe(0);
  });
});

describe("구간(반월) 만들기", () => {
  it("착공일 2026-11-02, 공기 70일이면 5개 구간이다", () => {
    expect(buildPeriods("2026-11-02", 70)).toEqual([
      { index: 0, start: "2026-11-01", end: "2026-11-15" },
      { index: 1, start: "2026-11-16", end: "2026-11-30" },
      { index: 2, start: "2026-12-01", end: "2026-12-15" },
      { index: 3, start: "2026-12-16", end: "2026-12-31" },
      { index: 4, start: "2027-01-01", end: "2027-01-15" },
    ]);
  });

  it("착공일이 하순이어도 그 달 상순(1일)부터 구간을 시작한다", () => {
    const periods = buildPeriods("2026-11-20", 20); // 준공 2026-12-09
    expect(periods[0]).toEqual({ index: 0, start: "2026-11-01", end: "2026-11-15" });
    expect(periods[periods.length - 1].end >= "2026-12-09").toBe(true);
  });

  it("2월 하순은 28일(평년)·29일(윤년)에서 끝난다", () => {
    const p = buildPeriods("2027-02-01", 28);
    expect(p[1]).toEqual({ index: 1, start: "2027-02-16", end: "2027-02-28" });
    const q = buildPeriods("2028-02-01", 29);
    expect(q[1]).toEqual({ index: 1, start: "2028-02-16", end: "2028-02-29" });
  });
});

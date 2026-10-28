import { describe, expect, it } from "vitest";
import { buildPeriods, periodWorkdays } from "./calendar";
import {
  calcManDays,
  dailyAverage,
  distributeResources,
  equipmentDaysFromHours,
  splitProductivity,
} from "./labor";

// SRS SR-RS-01·02·04~06, 6.4~6.7 / PRD AC-F4-1·2 (T-10, T-11의 계산 규칙 부분)
describe("직종별 인일 산정 (우선순위: 내역서 → 환산 → 생산성 → 직접 지정)", () => {
  it("내역서 수량은 그대로 쓰고 방식은 '내역서'다 (T-10)", () => {
    expect(calcManDays({ kind: "budgetQty", trade: "배관공(급수급탕)", manDays: 44 })).toMatchObject({
      manDays: 44,
      method: "내역서",
    });
    expect(calcManDays({ kind: "budgetQty", trade: "배관공(오배수)", manDays: 53 }).manDays).toBe(53);
    expect(calcManDays({ kind: "budgetQty", trade: "배관공(철거)", manDays: 4 }).manDays).toBe(4);
  });

  it("노무비 환산: 반올림(노무비 × 배분율 ÷ 노임단가), 방식 '환산', 근거 문구를 남긴다", () => {
    const r = calcManDays({
      kind: "laborCost",
      trade: "보통인부",
      laborCost: 1_234_567,
      share: 0.3,
      wage: 200_000,
    });
    expect(r.manDays).toBe(2); // 1,234,567 × 0.3 ÷ 200,000 = 1.85
    expect(r.method).toBe("환산");
    expect(r.basis).toContain("1,234,567");
    expect(r.basis).toContain("200,000");
  });

  it("직접 지정: 인원/일 × 작업일수, 방식 '가정'", () => {
    const r = calcManDays({ kind: "direct", trade: "T.A.B 기술자", perDay: 3, workdays: 20 });
    expect(r).toMatchObject({ manDays: 60, method: "가정" });
  });

  it("음수·비수치 입력은 거부한다", () => {
    expect(() => calcManDays({ kind: "budgetQty", trade: "x", manDays: -1 })).toThrow(RangeError);
    expect(() =>
      calcManDays({ kind: "laborCost", trade: "x", laborCost: 1, share: 0.5, wage: 0 }),
    ).toThrow(RangeError);
  });
});

describe("생산성 방식: 직종별 분할과 반올림 오차 보정", () => {
  it("반올림 오차는 지정한 직종(보통인부)에 반영해 공정 총량을 보존한다", () => {
    const r = splitProductivity({
      items: [
        { quantity: 10, productivity: 1.55 },
        { quantity: 4, productivity: 2.2 },
      ],
      shares: [
        { trade: "배관공", share: 0.6 },
        { trade: "용접공", share: 0.3 },
      ],
      remainderTrade: "보통인부",
    });
    // 총량 round(15.5 + 8.8) = 24, 배관공 round(14.4)=14, 용접공 round(7.2)=7, 보통인부 24-14-7=3
    expect(r.total).toBe(24);
    expect(r.byTrade).toEqual({ 배관공: 14, 용접공: 7, 보통인부: 3 });
    expect(r.method).toBe("가정");
  });
});

describe("장비 대·일", () => {
  it("내역서 장비(HR)는 올림(HR ÷ 8)이다", () => {
    expect(equipmentDaysFromHours(18)).toBe(3);
    expect(equipmentDaysFromHours(8)).toBe(1);
    expect(equipmentDaysFromHours(0)).toBe(0);
    expect(equipmentDaysFromHours(8.5)).toBe(2);
  });
});

describe("구간별 배분 (직종별 합계)", () => {
  const start = "2026-11-02";
  const periods = buildPeriods(start, 70);
  const holidays = new Set(["2026-12-25", "2027-01-01"]);
  const processes = [{ key: "P", startDay: 1, endDay: 29 }]; // 11/2~11/30, 작업일수 10 + 11

  it("모든 구간 값이 정수이고 직종·구간 합이 총량과 같다", () => {
    const r = distributeResources(
      [
        { processKey: "P", name: "배관공", manDays: 21, method: "내역서", basis: "내역서" },
        { processKey: "P", name: "보통인부", manDays: 10, method: "가정", basis: "직접 지정" },
      ],
      processes,
      periods,
      start,
      holidays,
    );
    expect(r.byName["배관공"]).toEqual([10, 11, 0, 0, 0]);
    expect(r.byName["보통인부"]).toEqual([5, 5, 0, 0, 0]);
    expect(r.periodTotals).toEqual([15, 16, 0, 0, 0]);
    expect(r.total).toBe(31);
  });

  it("'가정' 값의 합을 따로 알려 준다 (가정 비중 표시용)", () => {
    const r = distributeResources(
      [
        { processKey: "P", name: "배관공", manDays: 21, method: "내역서", basis: "내역서" },
        { processKey: "P", name: "보통인부", manDays: 10, method: "가정", basis: "직접 지정" },
      ],
      processes,
      periods,
      start,
      holidays,
    );
    expect(r.assumedTotal).toBe(10);
  });

  it("같은 직종이 여러 공정에 있으면 구간별로 합친다", () => {
    const two = [
      { key: "P", startDay: 1, endDay: 29 },
      { key: "Q", startDay: 30, endDay: 44 }, // 12/1~12/15
    ];
    const r = distributeResources(
      [
        { processKey: "P", name: "배관공", manDays: 21, method: "내역서", basis: "" },
        { processKey: "Q", name: "배관공", manDays: 11, method: "내역서", basis: "" },
      ],
      two,
      periods,
      start,
      holidays,
    );
    expect(r.byName["배관공"]).toEqual([10, 11, 11, 0, 0]);
    expect(r.total).toBe(32);
  });

  it("없는 공정을 가리키면 거부한다", () => {
    expect(() =>
      distributeResources(
        [{ processKey: "NOPE", name: "x", manDays: 1, method: "가정", basis: "" }],
        processes,
        periods,
        start,
        holidays,
      ),
    ).toThrow(Error);
  });
});

describe("일평균 투입인원", () => {
  const start = "2026-11-02";
  const holidays = new Set(["2026-12-25", "2027-01-01"]);

  it("구간 일평균 = 구간 소계 ÷ 공기 내 작업일수", () => {
    const periods = buildPeriods(start, 70);
    expect(periodWorkdays(periods[0], start, 70, holidays)).toBe(10);
    expect(dailyAverage(15, 10)).toBe(1.5);
  });

  it("공기 안의 마지막 구간 작업일수는 준공일(1/10)까지만 센다", () => {
    const periods = buildPeriods(start, 70);
    // 1/1 공휴일, 1/4~1/8 5일, 1/9~1/10 주말
    expect(periodWorkdays(periods[4], start, 70, holidays)).toBe(5);
  });

  it("작업일수가 0이면 빈칸(null)이다", () => {
    expect(dailyAverage(0, 0)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildPeriods } from "./calendar";
import { progressTable, round2, type Process } from "./progress";

// SRS SR-PG-01~03, 6.1~6.2 / PRD AC-F3-1 (T-07의 계산 규칙 부분)
// 손으로 계산한 값: 합계 1,000원, 보할 60·30·10 → 구간 56·18·15·7·4, 누계 56·74·89·96·100
const START = "2026-11-02";
const processes: Process[] = [
  { key: "A", name: "A 공정", amount: 600, startDay: 1, endDay: 15 },
  { key: "B", name: "B 공정", amount: 300, startDay: 16, endDay: 45 },
  { key: "C", name: "C 공정", amount: 100, startDay: 46, endDay: 70 },
];

describe("보할과 구간별 진도율", () => {
  const periods = buildPeriods(START, 70);
  const t = progressTable(processes, periods, START);

  it("보할 = 공정 금액 ÷ 전체 × 100 이고 합계는 100이다 (T-02)", () => {
    expect(t.rows.map((r) => r.weight)).toEqual([60, 30, 10]);
    expect(t.rows.reduce((s, r) => s + r.weight, 0)).toBeCloseTo(100, 10);
  });

  it("공정별 구간 진도율은 겹치는 달력일 수에 비례한다", () => {
    expect(t.rows[0].byPeriod.map(round2)).toEqual([56, 4, 0, 0, 0]);
    expect(t.rows[1].byPeriod.map(round2)).toEqual([0, 14, 15, 1, 0]);
    expect(t.rows[2].byPeriod.map(round2)).toEqual([0, 0, 0, 6, 4]);
  });

  it("구간 계와 누계를 계산하고 누계 최종값은 100.00이다", () => {
    expect(t.periodTotals.map(round2)).toEqual([56, 18, 15, 7, 4]);
    expect(t.cumulative.map(round2)).toEqual([56, 74, 89, 96, 100]);
  });
});

describe("금액이 0원인 공종(협조 구간)", () => {
  it("보할과 진도율이 0이고 합계에 영향을 주지 않는다", () => {
    const periods = buildPeriods(START, 70);
    const withZero: Process[] = [
      ...processes,
      { key: "Z", name: "관급 분리발주", amount: 0, startDay: 1, endDay: 70 },
    ];
    const t = progressTable(withZero, periods, START);
    expect(t.rows[3].weight).toBe(0);
    expect(t.rows[3].byPeriod).toEqual([0, 0, 0, 0, 0]);
    expect(t.cumulative.map(round2)).toEqual([56, 74, 89, 96, 100]);
  });

  it("전체 금액이 0원이면 모든 진도율이 0이다", () => {
    const periods = buildPeriods(START, 70);
    const t = progressTable(
      [{ key: "Z", name: "Z", amount: 0, startDay: 1, endDay: 70 }],
      periods,
      START,
    );
    expect(t.cumulative.every((v) => v === 0)).toBe(true);
  });
});

describe("입력 검사", () => {
  it("착수일차가 완료일차보다 크면 거부한다", () => {
    const periods = buildPeriods(START, 70);
    expect(() =>
      progressTable([{ key: "X", name: "X", amount: 1, startDay: 10, endDay: 5 }], periods, START),
    ).toThrow(RangeError);
  });
});

describe("표시용 반올림", () => {
  it("소수 둘째 자리로 반올림한다", () => {
    expect(round2(2.985)).toBe(2.99);
    expect(round2(33.3333)).toBe(33.33);
  });
});

describe("음수 금액 공정 (고재처리 등)", () => {
  // 연천읍지구 기준 공정표의 '고재처리'처럼 순공사비를 줄이는 공정: 보할이 음수여도 합은 100%
  const withScrap: Process[] = [
    { key: "A", name: "A 공정", amount: 1100, startDay: 1, endDay: 35 },
    { key: "S", name: "고재처리", amount: -100, startDay: 36, endDay: 70 },
  ];
  it("음수 금액을 받아 보할이 음수가 되고, 보할 합과 누계 최종값은 100", () => {
    const periods = buildPeriods(START, 70);
    const t = progressTable(withScrap, periods, START);
    expect(round2(t.rows[0].weight)).toBe(110);
    expect(round2(t.rows[1].weight)).toBe(-10);
    expect(round2(t.rows.reduce((s, r) => s + r.weight, 0))).toBe(100);
    expect(round2(t.cumulative.at(-1)!)).toBe(100);
    // 음수 공정이 진행되는 구간에서는 구간 진도율이 음수 기여를 한다
    expect(t.rows[1].byPeriod.some((v) => v < 0)).toBe(true);
  });
  it("숫자가 아닌 금액은 여전히 거부한다", () => {
    expect(() => progressTable([{ key: "X", name: "X", amount: Number.NaN, startDay: 1, endDay: 2 }], buildPeriods(START, 70), START)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { ParsedBudget } from "@/lib/budget/parse";
import { buildPlan, parseHolidays } from "./buildPlan";

// 화면의 입력값(문자열)을 계산 입력으로 바꾸고 계산한다. SRS SR-PG-04, SR-RS-01, SR-VR-07
const parsed: ParsedBudget = {
  summary: [
    { code: "A01", name: "냉난방기", material: 5000, labor: 3000, expense: 1000, total: 9000 },
    { code: "A02", name: "배관", material: 2000, labor: 6000, expense: 500, total: 8500 },
  ],
  summaryTotal: 17_500,
  grandTotal: 17_500,
  summaryTotalMatchesGrandTotal: true,
  labor: [{ code: "A02", trade: "배관공", quantity: 44, wage: 250_000 }],
  equipment: [],
  warnings: [],
};

const base = {
  parsed,
  startDate: "2026-11-02",
  durationDays: "70",
  holidaysText: "2026-12-25, 2027-01-01",
  schedule: {},
  extraLabor: [],
  extraEquipment: [],
};

describe("공휴일 입력 해석", () => {
  it("쉼표·공백·줄바꿈으로 나눈 날짜를 읽고, 잘못된 값은 따로 알려 준다", () => {
    const r = parseHolidays("2026-12-25,\n2027-01-01  2026-13-40 abc");
    expect([...r.dates].sort()).toEqual(["2026-12-25", "2027-01-01"]);
    expect(r.invalid).toEqual(["2026-13-40", "abc"]);
  });
  it("비어 있으면 공휴일이 없다", () => {
    expect(parseHolidays("").dates.size).toBe(0);
  });
});

describe("화면 입력으로 계산", () => {
  it("착공일·공기가 올바르면 준공일과 검증 결과를 낸다", () => {
    const r = buildPlan(base);
    expect(r.error).toBeUndefined();
    expect(r.result?.completion).toBe("2027-01-10");
    expect(r.result?.validation.passed).toBe(true);
  });

  it("착공일·공기가 비었거나 잘못되면 오류 메시지를 낸다", () => {
    expect(buildPlan({ ...base, startDate: "" }).error).toContain("착공일");
    expect(buildPlan({ ...base, durationDays: "0" }).error).toContain("공사기간");
    expect(buildPlan({ ...base, durationDays: "abc" }).error).toContain("공사기간");
  });

  it("내역서를 아직 불러오지 않았으면 계산하지 않는다", () => {
    expect(buildPlan({ ...base, parsed: null }).result).toBeUndefined();
  });

  it("직접 지정(인원/일 × 일수)한 가정 라인이 '가정'으로 들어간다", () => {
    const r = buildPlan({
      ...base,
      extraLabor: [{ id: 1, processKey: "A01", name: "T.A.B 기술자", perDay: 3, workdays: 20 }],
    });
    expect(r.result?.labor.total).toBe(44 + 60);
    expect(r.result?.labor.assumedTotal).toBe(60);
  });

  it("직접 지정 값이 정수가 아니면 해당 라인을 제외하고 알린다", () => {
    const r = buildPlan({
      ...base,
      extraLabor: [{ id: 1, processKey: "A01", name: "기술자", perDay: 1.5, workdays: 3 }],
    });
    expect(r.warnings.join(" ")).toContain("정수");
    expect(r.result?.labor.total).toBe(44);
  });

  it("공정 일정을 지정하고 공기를 넘기면 검증에 실패한다", () => {
    const r = buildPlan({ ...base, schedule: { A01: { startDay: 1, endDay: 75 } } });
    expect(r.result?.validation.passed).toBe(false);
  });

  it("잘못된 공휴일 입력은 경고로 남기고 계산은 계속한다", () => {
    const r = buildPlan({ ...base, holidaysText: "2026-12-25 오늘" });
    expect(r.warnings.join(" ")).toContain("오늘");
    expect(r.result).toBeDefined();
  });
});

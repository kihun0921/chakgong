import { describe, expect, it } from "vitest";
import { referralRate, reorderIntervals, reorderRate, type DeliveryRecord } from "./retention-metrics";

// docs/RETENTION.md 4장 / T-51~T-53. 사업자등록번호는 가짜 값만 쓴다.
const A = "123-45-67891";
const B = "000-00-00000";
const C = "111-11-11111";
const d = (bizNo: string, deliveredAt: string): DeliveryRecord => ({ bizNo, deliveredAt });

describe("재의뢰율 (T-51, 180일)", () => {
  const asOf = "2027-06-01";

  it("첫 납품 후 180일 안에 다시 납품받은 업체 ÷ 관찰 가능한 업체", () => {
    const r = reorderRate(
      [d(A, "2026-10-01"), d(A, "2026-12-01"), d(B, "2026-10-05"), d(C, "2026-10-10"), d(C, "2027-05-01")],
      asOf,
    );
    // A: 61일 만에 재의뢰, B: 없음, C: 203일 뒤라 180일 밖
    expect(r).toEqual({ eligible: 3, reordered: 1, rate: 1 / 3 });
  });

  it("표기가 다른 같은 사업자등록번호는 한 업체로 센다", () => {
    const r = reorderRate([d("123-45-67891", "2026-10-01"), d("1234567891", "2026-11-01")], asOf);
    expect(r).toEqual({ eligible: 1, reordered: 1, rate: 1 });
  });

  it("첫 납품 후 180일이 아직 지나지 않은 업체는 분모에서 뺀다", () => {
    const r = reorderRate([d(A, "2026-10-01"), d(B, "2027-04-01")], asOf);
    expect(r).toEqual({ eligible: 1, reordered: 0, rate: 0 });
  });

  it("관찰 가능한 업체가 없으면 비율은 null이다(0으로 오해하지 않게)", () => {
    expect(reorderRate([d(A, "2027-05-01")], asOf)).toEqual({ eligible: 0, reordered: 0, rate: null });
    expect(reorderRate([], asOf)).toEqual({ eligible: 0, reordered: 0, rate: null });
  });
});

describe("재의뢰 간격 (T-52)", () => {
  it("업체별로 납품일 사이 평균 일수를 낸다", () => {
    const r = reorderIntervals([
      d(A, "2026-01-01"), d(A, "2026-01-31"), d(A, "2026-03-02"),
      d(B, "2026-02-01"),
    ]);
    expect(r).toEqual([{ bizNo: "1234567891", count: 3, avgDays: 30 }]);
  });

  it("납품이 한 번뿐인 업체는 목록에 넣지 않는다", () => {
    expect(reorderIntervals([d(A, "2026-01-01")])).toEqual([]);
  });

  it("입력 순서와 관계없이 같은 결과다(SR-NF-08)", () => {
    const a = [d(A, "2026-03-02"), d(A, "2026-01-01")];
    const b = [d(A, "2026-01-01"), d(A, "2026-03-02")];
    expect(reorderIntervals(a)).toEqual(reorderIntervals(b));
  });
});

describe("소개율 (T-53)", () => {
  it("신규 업체 중 소개로 온 비율을 낸다", () => {
    expect(referralRate([{ referrerBizNo: A }, { referrerBizNo: null }, { referrerBizNo: null }, { referrerBizNo: B }])).toEqual({
      newCompanies: 4, referred: 2, rate: 0.5,
    });
  });

  it("신규 업체가 없으면 비율은 null이다", () => {
    expect(referralRate([])).toEqual({ newCompanies: 0, referred: 0, rate: null });
  });
});

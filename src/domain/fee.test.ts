import { describe, expect, it } from "vitest";
import { calcFee, formatWon } from "./fee";

// SRS SR-FEE-01 / PRD AC-F10-1: 공급가액 500,000원 + 부가세 50,000원 = 550,000원
describe("용역비 금액", () => {
  it("기본 공급가액 500,000원이면 부가세 50,000원, 합계 550,000원이다", () => {
    expect(calcFee()).toEqual({ supply: 500_000, vat: 50_000, total: 550_000 });
  });

  it("공급가액이 정수(원)가 아니면 거부한다", () => {
    expect(() => calcFee(500_000.5)).toThrow(RangeError);
    expect(() => calcFee(-1)).toThrow(RangeError);
  });

  it("금액을 천 단위 구분과 '원'으로 표시한다", () => {
    expect(formatWon(550_000)).toBe("550,000원");
  });
});

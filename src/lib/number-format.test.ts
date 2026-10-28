import { describe, expect, it } from "vitest";
import { formatNumber, groupDigits, stripNumber } from "./number-format";

describe("숫자 쉼표 표기", () => {
  it("3자리마다 쉼표를 찍는다", () => {
    expect(groupDigits("0")).toBe("0");
    expect(groupDigits("999")).toBe("999");
    expect(groupDigits("1000")).toBe("1,000");
    expect(groupDigits("17511921000")).toBe("17,511,921,000");
    expect(groupDigits("")).toBe("");
  });
  it("소수와 입력 중인 소수점을 보존한다", () => {
    expect(groupDigits("1234.5")).toBe("1,234.5");
    expect(groupDigits("12.")).toBe("12.");
    expect(groupDigits("0.25")).toBe("0.25");
  });
  it("앞쪽 0은 하나만 남긴다", () => {
    expect(groupDigits("0012")).toBe("12");
    expect(groupDigits("00")).toBe("0");
  });
  it("입력에서 숫자만 남긴다 (쉼표·글자 제거, 소수점은 선택)", () => {
    expect(stripNumber("1,234,567원")).toBe("1234567");
    expect(stripNumber("12.5")).toBe("125");
    expect(stripNumber("1,234.50", true)).toBe("1234.50");
    expect(stripNumber("1.2.3", true)).toBe("1.23");
  });
  it("숫자를 쉼표 표기로 바꾼다", () => {
    expect(formatNumber(1338)).toBe("1,338");
    expect(formatNumber(1234.567, 2)).toBe("1,234.57");
    expect(formatNumber(-1500)).toBe("-1,500");
  });
});

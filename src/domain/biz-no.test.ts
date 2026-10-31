import { describe, expect, it } from "vitest";
import { isValidBizNo, maskBizNo, normalizeBizNo } from "./biz-no";

// docs/RETENTION.md 7장 / T-46: 업체 식별 키 = 사업자등록번호
// 시험 데이터는 가짜 값만 쓴다(보안 규칙). 123-45-67891은 검증 자릿수가 맞는 가짜 번호다.
describe("사업자등록번호 정규화 (T-46)", () => {
  it("하이픈·공백을 없애 숫자 10자리로 만든다", () => {
    expect(normalizeBizNo("123-45-67891")).toBe("1234567891");
    expect(normalizeBizNo(" 123 45 67891 ")).toBe("1234567891");
    expect(normalizeBizNo("1234567891")).toBe("1234567891");
  });

  it("10자리가 아니면 null이다", () => {
    expect(normalizeBizNo("123-45-6789")).toBeNull();
    expect(normalizeBizNo("123-45-678911")).toBeNull();
    expect(normalizeBizNo("")).toBeNull();
    expect(normalizeBizNo("abc-de-fghij")).toBeNull();
  });

  it("표기가 달라도 같은 업체는 같은 키가 된다", () => {
    expect(normalizeBizNo("123-45-67891")).toBe(normalizeBizNo("1234567891"));
  });
});

describe("사업자등록번호 검증 자릿수 (T-46)", () => {
  it("검증 자릿수가 맞으면 유효하다", () => {
    expect(isValidBizNo("123-45-67891")).toBe(true);
    expect(isValidBizNo("000-00-00000")).toBe(true);
  });

  it("검증 자릿수가 틀리거나 10자리가 아니면 유효하지 않다", () => {
    expect(isValidBizNo("123-45-67890")).toBe(false);
    expect(isValidBizNo("123-45-6789")).toBe(false);
  });
});

describe("사업자등록번호 마스킹 (T-46, SR-NF-13)", () => {
  it("뒤 5자리를 가려 표시한다", () => {
    expect(maskBizNo("123-45-67891")).toBe("123-45-*****");
    expect(maskBizNo("1234567891")).toBe("123-45-*****");
  });

  it("형식이 맞지 않는 값은 원본을 드러내지 않는다", () => {
    expect(maskBizNo("12345")).not.toContain("12345");
  });
});

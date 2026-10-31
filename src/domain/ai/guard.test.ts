import { describe, expect, it } from "vitest";
import { detectPii, scrubPii } from "./guard";

// T-59: Gemini로 보내는 글에서 개인정보로 보이는 값을 찾아 막는다(SR-NF-13·15). 시험 값은 모두 가짜다.
describe("개인정보 탐지 (T-59)", () => {
  it("주민등록번호 형식(하이픈 유무)을 찾는다", () => {
    expect(detectPii("대표 000000-1000000")).toContain("주민등록번호");
    expect(detectPii("0000001000000")).toContain("주민등록번호");
  });

  it("전화번호를 찾는다", () => {
    expect(detectPii("연락처 010-0000-0000")).toContain("전화번호");
    expect(detectPii("02-000-0001")).toContain("전화번호");
    expect(detectPii("01000000000")).toContain("전화번호");
  });

  it("사업자등록번호를 찾는다", () => {
    expect(detectPii("번호 123-45-67891")).toContain("사업자등록번호");
  });

  it("계좌번호 형식을 찾는다", () => {
    expect(detectPii("계좌 000-000-000000")).toContain("계좌번호");
  });

  it("공사명·금액·날짜·공정 이름은 개인정보가 아니다", () => {
    const ok = [
      "연천읍지구 풍수해생활권 종합정비사업",
      "순공사비 622,764,021원",
      "착공일 2026-11-02, 준공 2027-01-10",
      "한 공정 1차 타설 3회",
      "문서번호 2026-03-001",
    ];
    for (const t of ok) expect(detectPii(t)).toEqual([]);
  });

  it("같은 입력이면 같은 결과다(SR-NF-08)", () => {
    expect(detectPii("010-0000-0000 123-45-67891")).toEqual(detectPii("010-0000-0000 123-45-67891"));
  });
});

describe("개인정보 가리기 (T-59)", () => {
  it("찾은 값을 [제외]로 바꾼다", () => {
    const s = scrubPii("대표 000000-1000000, 전화 010-0000-0000, 사업자 123-45-67891, 계좌 000-000-000000");
    expect(s).not.toMatch(/\d{6}-\d{7}|010-0000-0000|123-45-67891|000-000-000000/);
    expect(s).toContain("[제외]");
  });

  it("개인정보가 없으면 그대로 둔다", () => {
    expect(scrubPii("순공사비 622,764,021원")).toBe("순공사비 622,764,021원");
  });
});

import { describe, expect, it } from "vitest";
import { gwa, koreanWon } from "./format";

// 기준 착공계(연천읍지구)에 적힌 한글 금액과 같아야 한다
describe("한글 금액", () => {
  it("계약금액 17,511,921,000원 → 금일백칠십오억일천일백구십이만일천원", () => {
    expect(koreanWon(17_511_921_000)).toBe("일백칠십오억일천일백구십이만일천원");
  });
  it("직접노무비 5,549,924,648원 → 오십오억사천구백구십이만사천육백사십팔원", () => {
    expect(koreanWon(5_549_924_648)).toBe("오십오억사천구백구십이만사천육백사십팔원");
  });
  it("단위가 비는 자리는 건너뛴다", () => {
    expect(koreanWon(100_000_000)).toBe("일억원");
    expect(koreanWon(10_000)).toBe("일만원");
    expect(koreanWon(1_000_001)).toBe("일백만일원");
    expect(koreanWon(622_764_021)).toBe("육억이천이백칠십육만사천이십일원");
  });
  it("0원과 음수", () => {
    expect(koreanWon(0)).toBe("영원");
    expect(koreanWon(-1500)).toBe("마이너스 일천오백원");
  });
});

describe("조사 과/와", () => {
  it("받침 있으면 과, 없으면 와", () => {
    expect(gwa("연천읍지구 풍수해생활권 종합정비사업")).toBe("과"); // 업
    expect(gwa("조성사업(기계)")).toBe("와"); // 계 (괄호 무시)
    expect(gwa("")).toBe("와");
  });
});

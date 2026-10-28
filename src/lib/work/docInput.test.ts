import { describe, expect, it } from "vitest";
import { INITIAL_WORK } from "@/lib/projects/types";
import { checkRequired } from "@/domain/documents/build";
import { toDocInput } from "./docInput";

describe("화면 입력을 서류 입력으로 바꾼다", () => {
  it("아무것도 입력하지 않으면 필수 항목이 모두 누락으로 나온다", () => {
    const missing = checkRequired(toDocInput(INITIAL_WORK));
    expect(missing).toEqual(
      expect.arrayContaining(["공사명", "계약금액", "착공일", "공사기간", "시공사 상호", "계약 유형", "현장대리인"]),
    );
  });

  it("문자열 숫자(계약금액·공사기간)를 정수로 읽는다", () => {
    const w = { ...INITIAL_WORK, general: { ...INITIAL_WORK.general, contractAmount: "622764021", durationDays: "70" } };
    const d = toDocInput(w);
    expect(d.contractAmount).toBe(622_764_021);
    expect(d.durationDays).toBe(70);
  });

  it("회사 정보와 기술인·공동수급체가 그대로 전달된다", () => {
    const w = {
      ...INITIAL_WORK,
      general: { ...INITIAL_WORK.general, companyName: "시험건설", representative: "김대표" },
    };
    expect(toDocInput(w).company.name).toBe("시험건설");
    expect(toDocInput(w).company.representative).toBe("김대표");
  });
});

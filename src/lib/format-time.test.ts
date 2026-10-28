import { describe, expect, it } from "vitest";
import { formatKst } from "./format-time";

describe("formatKst", () => {
  it("UTC 시각을 한국 시간으로 바꿔 쓴다 (날짜가 넘어가는 경우 포함)", () => {
    expect(formatKst("2026-10-17T11:38:07.000Z")).toBe("2026-10-17 20:38");
    expect(formatKst("2026-12-31T15:30:00.000Z")).toBe("2027-01-01 00:30");
  });
  it("올바르지 않은 값은 빈 문자열", () => {
    expect(formatKst("")).toBe("");
    expect(formatKst("abc")).toBe("");
  });
});

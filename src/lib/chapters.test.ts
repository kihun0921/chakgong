import { describe, expect, it } from "vitest";
import { CHAPTERS } from "./chapters";

// 제출서류 목차 15종이 챕터 4개의 문서 탭에 빠짐없이, 한 번씩 들어 있어야 한다.
describe("착공계 챕터 구성", () => {
  it("챕터는 일반사항·직접시공계획서·공정표+인원장비계획서·기타서류 4개다", () => {
    expect(CHAPTERS.map((c) => c.label)).toEqual([
      "1. 일반사항",
      "2. 직접시공계획서",
      "3. 공정표·인원장비계획서",
      "4. 기타서류",
    ]);
  });

  it("제출서류 목차 ①~⑮가 문서 탭에 한 번씩 들어 있다", () => {
    const all = CHAPTERS.flatMap((c) => c.docs.flatMap((d) => d.toc)).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("문서 탭 키는 챕터 안에서 겹치지 않는다", () => {
    for (const c of CHAPTERS) {
      const keys = c.docs.map((d) => d.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("공정표(④)와 인력 및 장비투입계획서(⑨)는 같은 챕터(3장)에 있다", () => {
    const ch3 = CHAPTERS.find((c) => c.key === "schedule");
    expect(ch3?.docs.flatMap((d) => d.toc).sort((a, b) => a - b)).toEqual([4, 9]);
  });
});

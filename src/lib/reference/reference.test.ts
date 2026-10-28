import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyScheduleTemplate, pctToDays } from "@/domain/template";
import { createLocalReferenceStore } from "@/lib/ports/reference.local";
import { DEFAULT_REFERENCE, mergeHolidaysText, validateReference, type ReferenceData } from "./types";

// SRS SR-DM-02~04, SR-SC-02·03 / PRD AC-F8-1 (T-22)
const good: ReferenceData = {
  ...DEFAULT_REFERENCE,
  trades: [{ name: "배관공", wage: 250_000 }],
  equipment: [{ name: "크레인 100ton" }],
  productivity: [{ name: "덕트 설치", unit: "m", manDaysPerUnit: 0.35 }],
  scheduleTemplates: [
    { workType: "기계설비", items: [{ keyword: "배관", startPct: 10, endPct: 60 }] },
  ],
  holidays: ["2026-12-25", "2027-01-01"],
};

describe("기준정보 검사", () => {
  it("올바른 입력은 정리해서 받아들인다(이름 공백 제거, 공휴일 정렬)", () => {
    const r = validateReference({ ...good, trades: [{ name: " 배관공 ", wage: 250_000 }], holidays: ["2027-01-01", "2026-12-25"] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.trades[0].name).toBe("배관공");
      expect(r.data.holidays).toEqual(["2026-12-25", "2027-01-01"]);
    }
  });

  it("기본값(빈 목록, 용역비 500,000원)은 올바르다", () => {
    expect(validateReference(DEFAULT_REFERENCE).ok).toBe(true);
    expect(DEFAULT_REFERENCE.feeSupply).toBe(500_000);
  });

  it("노임단가가 음수·소수, 이름이 비거나 겹치면 이유를 모두 알려 준다", () => {
    const r = validateReference({
      ...good,
      trades: [{ name: "배관공", wage: -1 }, { name: "배관공", wage: 1.5 }, { name: "", wage: 1 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join(" ")).toContain("노임단가");
      expect(r.errors.join(" ")).toContain("겹치는");
      expect(r.errors.join(" ")).toContain("빈 항목");
    }
  });

  it("잘못된 공휴일·템플릿 비율·공종 유형·용역비를 거부한다", () => {
    const r = validateReference({
      ...good,
      holidays: ["2026-13-40", "2026-12-25", "2026-12-25"],
      scheduleTemplates: [{ workType: "통신", items: [{ keyword: "x", startPct: 70, endPct: 20 }] }],
      feeSupply: -5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const t = r.errors.join(" ");
      for (const w of ["yyyy-mm-dd", "두 번", "5종", "시작이 종료보다", "용역비"]) expect(t).toContain(w);
    }
  });
});

describe("기준정보 저장소 (코드 수정 없이 이후 계산에 반영, T-22)", () => {
  it("저장한 값을 다시 읽고, 처음에는 기본값을 준다", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "chakgong-ref-"));
    const store = createLocalReferenceStore(dir);
    expect(await store.get()).toEqual(DEFAULT_REFERENCE);
    await store.save(good);
    expect(await store.get()).toEqual(good);
  });
});

describe("공휴일 가져오기", () => {
  it("기준정보 공휴일을 공사 입력에 합치고 중복은 건너뛴다", () => {
    expect(mergeHolidaysText("2026-12-25", ["2026-12-25", "2027-01-01"])).toBe("2026-12-25, 2027-01-01");
    expect(mergeHolidaysText("", ["2027-01-01"])).toBe("2027-01-01");
  });
});

describe("일정 템플릿 적용", () => {
  it("비율을 일차로 바꾼다(공기 70일)", () => {
    expect(pctToDays(0, 50, 70)).toEqual({ startDay: 1, endDay: 35 });
    expect(pctToDays(50, 100, 70)).toEqual({ startDay: 36, endDay: 70 });
    expect(pctToDays(99, 100, 70)).toEqual({ startDay: 70, endDay: 70 });
  });

  it("공정 이름에 포함어가 있으면 그 일정을 쓰고, 없으면 건드리지 않는다", () => {
    const s = applyScheduleTemplate(
      [
        { key: "A", name: "냉난방기 배관" },
        { key: "B", name: "자동제어" },
      ],
      [{ keyword: "배관", startPct: 10, endPct: 60 }],
      100,
    );
    expect(s).toEqual({ A: { startDay: 11, endDay: 60 } });
  });

  it("먼저 나온 항목이 우선이고, 빈 포함어는 무시한다", () => {
    const s = applyScheduleTemplate(
      [{ key: "A", name: "배관 보온" }],
      [
        { keyword: "", startPct: 0, endPct: 100 },
        { keyword: "배관", startPct: 0, endPct: 50 },
        { keyword: "보온", startPct: 50, endPct: 100 },
      ],
      70,
    );
    expect(s.A).toEqual({ startDay: 1, endDay: 35 });
  });
});

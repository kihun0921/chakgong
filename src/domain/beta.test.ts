import { describe, expect, it } from "vitest";
import { judgeKpi, summarizeBeta, validateBetaNote, type BetaNote } from "./beta";

// SRS SR-NF-22·23, D-11, 13.3 / PRD 1장 KPI: 북극성 90%, 50% 미만이면 피봇
const note = (over: Partial<BetaNote> = {}): BetaNote => ({
  projectId: "p1",
  supplementRequests: null,
  supplementDueToMismatch: null,
  manualMinutes: null,
  comparison: "",
  submittable: null,
  updatedAt: "2026-10-17T00:00:00Z",
  updatedBy: "a",
  ...over,
});

describe("북극성 KPI 판정", () => {
  it("90% 이상이면 목표 달성, 50% 미만이면 피봇, 그 사이는 개선 필요", () => {
    expect(judgeKpi(0.9, 10).verdict).toBe("pass");
    expect(judgeKpi(1, 3).verdict).toBe("pass");
    expect(judgeKpi(0.89, 10).verdict).toBe("improve");
    expect(judgeKpi(0.5, 10).verdict).toBe("improve");
    expect(judgeKpi(0.49, 10).verdict).toBe("pivot");
    expect(judgeKpi(0, 5).verdict).toBe("pivot");
  });
  it("시작한 공사가 없으면 판정하지 않는다", () => {
    expect(judgeKpi(null, 0)).toMatchObject({ verdict: "none" });
  });
  it("표본이 너무 적으면(3건 미만) 판정은 하되 참고용이라고 알린다", () => {
    expect(judgeKpi(1, 2).caution).toContain("참고");
    expect(judgeKpi(1, 3).caution).toBeNull();
  });
});

describe("베타 기록 검사", () => {
  it("횟수는 0 이상의 정수, 빈 값은 '아직 모름(null)'으로 받는다", () => {
    const r = validateBetaNote({ supplementRequests: 2, supplementDueToMismatch: "", manualMinutes: 180, comparison: " 같음 ", submittable: true });
    expect(r).toMatchObject({ ok: true, value: { supplementRequests: 2, supplementDueToMismatch: null, manualMinutes: 180, comparison: "같음", submittable: true } });
  });
  it("음수·소수·원인 횟수가 전체 횟수보다 큰 경우는 거절한다", () => {
    expect(validateBetaNote({ supplementRequests: -1 })).toMatchObject({ ok: false });
    expect(validateBetaNote({ manualMinutes: 1.5 })).toMatchObject({ ok: false });
    expect(validateBetaNote({ supplementRequests: 1, supplementDueToMismatch: 2 })).toMatchObject({ ok: false });
  });
});

describe("베타 종합", () => {
  it("보완 요구 횟수·불일치 원인 횟수·제출 가능 확인·수작업 대비 시간을 합산한다", () => {
    const s = summarizeBeta(
      [
        note({ projectId: "a", supplementRequests: 1, supplementDueToMismatch: 0, submittable: true, manualMinutes: 240 }),
        note({ projectId: "b", supplementRequests: 3, supplementDueToMismatch: 1, submittable: false, manualMinutes: 120 }),
        note({ projectId: "c" }),
      ],
      new Map([
        ["a", 5],
        ["b", 20],
      ]),
    );
    expect(s.notes).toBe(3);
    expect(s.supplementRequests).toBe(4);
    expect(s.supplementDueToMismatch).toBe(1);
    expect(s.submittable).toEqual({ yes: 1, no: 1, unknown: 1 });
    expect(s.manualMinutes).toBe(360);
    expect(s.toolMinutes).toBe(25);
    expect(s.measured).toBe(2);
  });
});

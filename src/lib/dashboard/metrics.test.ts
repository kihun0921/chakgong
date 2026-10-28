import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/lib/ports/audit";
import { computeMetrics } from "./metrics";

// SRS SR-ADM-02 / T-35
const parse = (outcome: string, at = "2026-10-05T01:00:00Z"): AuditEntry => ({ at, user: "a", action: "budget.parse", detail: { outcome } });

describe("운영 지표 (T-35)", () => {
  it("파싱 성공률·수동 보정률·오류 건수를 기간 안 이력에서 계산한다", () => {
    const m = computeMetrics(
      [parse("auto"), parse("auto"), parse("needsMapping"), parse("mapped"), parse("error"), parse("auto", "2026-09-01T00:00:00Z")],
      "2026-10-01",
      "2026-10-31",
    );
    expect(m.parse.attempts).toBe(4);
    expect(m.parse.autoRate).toBe(0.5);
    expect(m.parse.manualRate).toBeCloseTo(1 / 3);
    expect(m.parse.errors).toBe(1);
  });
  it("검증 실패 유형별 건수를 센다", () => {
    const rej = (codes: string[]): AuditEntry => ({ at: "2026-10-05T01:00:00Z", user: "a", action: "export.rejected", detail: { codes } });
    const m = computeMetrics([rej(["V-1"]), rej(["V-1", "V-3"])], "2026-10-01", "2026-10-31");
    expect(m.validationFailures).toEqual({ "V-1": 2, "V-3": 1 });
  });
  it("북극성 KPI: 시작한 공사 중 5분 안에 통과한 비율과 평균 소요 시간 (T-42)", () => {
    const e = (action: AuditEntry["action"], detail?: Record<string, unknown>): AuditEntry => ({ at: "2026-10-05T01:00:00Z", user: "a", action, detail });
    const m = computeMetrics(
      [e("draft.start"), e("draft.start"), e("draft.start"), e("draft.ready", { ms: 120_000 }), e("draft.ready", { ms: 400_000 })],
      "2026-10-01",
      "2026-10-31",
    );
    expect(m.draft).toEqual({ started: 3, ready: 2 });
    expect(m.kpi5min).toBeCloseTo(1 / 3);
    expect(m.draftSeconds).toBe(260);
  });
  it("기록이 없으면 비율은 null이고, 측정하지 않는 지표도 null이다", () => {
    const m = computeMetrics([], "2026-10-01", "2026-10-31");
    expect(m.parse.autoRate).toBeNull();
    expect([m.draftSeconds, m.recalcSeconds, m.kpi5min, m.naraApiSuccessRate]).toEqual([null, null, null, null]);
  });
});

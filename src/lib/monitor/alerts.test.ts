import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/lib/ports/audit";
import { evaluateAlerts } from "./alerts";

// SRS SR-NF-28·30·31, D-5
const NOW = new Date("2026-10-17T10:00:00Z");
const at = (minAgo: number) => new Date(NOW.getTime() - minAgo * 60_000).toISOString();
const perf = (metric: string, ms: number, minAgo = 1): AuditEntry => ({ at: at(minAgo), user: "a", action: "perf", detail: { metric, ms } });
const pii = (user: string, count: number, minAgo = 5): AuditEntry => ({ at: at(minAgo), user, action: "pii.export", detail: { count } });

describe("성능 한도 연속 초과 (SR-NF-28)", () => {
  it("연속 3회 넘으면 알린다", () => {
    const a = evaluateAlerts([perf("export", 31_000, 3), perf("export", 40_000, 2), perf("export", 35_000, 1)], NOW);
    expect(a.map((x) => x.kind)).toEqual(["slow"]);
  });
  it("2회만 넘었거나 중간에 정상이 끼면 알리지 않는다", () => {
    expect(evaluateAlerts([perf("export", 31_000, 3), perf("export", 40_000, 2)], NOW)).toEqual([]);
    expect(evaluateAlerts([perf("export", 31_000, 3), perf("export", 1_000, 2), perf("export", 35_000, 1)], NOW)).toEqual([]);
  });
  it("초안 5분 초과도 같은 규칙", () => {
    const a = evaluateAlerts([perf("draft", 301_000, 3), perf("draft", 400_000, 2), perf("draft", 500_000, 1)], NOW);
    expect(a[0].message).toContain("초안");
  });
});

describe("개인정보 대량 출력 (SR-NF-30)", () => {
  it("관리자 1명이 1시간에 20건을 넘으면 알린다", () => {
    expect(evaluateAlerts([pii("a", 12), pii("a", 9)], NOW)[0].kind).toBe("pii.bulk");
  });
  it("정확히 20건이거나, 1시간이 지난 기록이거나, 관리자가 다르면 알리지 않는다", () => {
    expect(evaluateAlerts([pii("a", 20)], NOW)).toEqual([]);
    expect(evaluateAlerts([pii("a", 15), pii("a", 15, 90)], NOW)).toEqual([]);
    expect(evaluateAlerts([pii("a", 15), pii("b", 15)], NOW)).toEqual([]);
  });
});

describe("입금 중복 시도 (SR-NF-31)", () => {
  it("이미 입금 완료인데 다시 기록하려는 시도를 알린다", () => {
    const e: AuditEntry = { at: at(10), user: "a", action: "fee.payment.rejected", detail: { reason: "duplicate" } };
    expect(evaluateAlerts([e], NOW)[0].kind).toBe("fee.duplicate");
    expect(evaluateAlerts([{ ...e, detail: { reason: "missing" } }], NOW)).toEqual([]);
  });
});

describe("저장된 알림(이력 기록 실패)", () => {
  it("즉시 알림으로 함께 돌려준다 (SR-NF-27)", () => {
    const a = evaluateAlerts([], NOW, [{ kind: "audit.failure", message: "이력을 쓰지 못했습니다.", at: at(1) }]);
    expect(a).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { createMemoryAlertStore, withFailureAlert } from "@/lib/ports/alerts";
import { createMemoryAuditLog, type AuditLog } from "@/lib/ports/audit";
import { markDraftReady, markDraftStart } from "./kpi";

// SRS SR-NF-22·27, D-4 / T-42
describe("북극성 측정 기록 (T-42)", () => {
  it("시작은 공사당 한 번만, 통과는 시작 뒤 처음 납품에서 한 번만 소요 시간과 함께 기록한다", async () => {
    const audit = createMemoryAuditLog();
    await markDraftReady(audit, "p1", "a"); // 시작 전에는 기록하지 않는다
    expect(await audit.list({ action: "draft.ready" })).toHaveLength(0);

    await markDraftStart(audit, "p1", "a");
    await markDraftStart(audit, "p1", "a");
    expect(await audit.list({ action: "draft.start" })).toHaveLength(1);

    const [start] = await audit.list({ action: "draft.start" });
    const later = new Date(new Date(start.at).getTime() + 150_000);
    await markDraftReady(audit, "p1", "a", later);
    await markDraftReady(audit, "p1", "a", new Date(later.getTime() + 60_000));
    const ready = await audit.list({ action: "draft.ready" });
    expect(ready).toHaveLength(1);
    expect(ready[0].detail?.ms).toBe(150_000);
  });
});

describe("이력 기록 실패 (D-4, SR-NF-27)", () => {
  it("이력을 쓰지 못하면 즉시 알림을 남기고 오류를 그대로 던져 동작을 실패시킨다", async () => {
    const broken: AuditLog = {
      async record() {
        throw new Error("disk full");
      },
      async list() {
        return [];
      },
    };
    const alerts = createMemoryAlertStore();
    const audit = withFailureAlert(broken, alerts);
    await expect(audit.record({ user: "a", action: "delivery" })).rejects.toThrow("disk full");
    const [a] = await alerts.list();
    expect(a.kind).toBe("audit.failure");
    expect(a.message).toContain("delivery");
  });
  it("정상일 때는 알림이 없다", async () => {
    const alerts = createMemoryAlertStore();
    await withFailureAlert(createMemoryAuditLog(), alerts).record({ user: "a", action: "logout" });
    expect(await alerts.list()).toEqual([]);
  });
});

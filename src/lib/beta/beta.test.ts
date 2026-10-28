import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryAuditLog } from "@/lib/ports/audit";
import { createLocalBetaStore, createMemoryBetaStore } from "@/lib/ports/beta";
import { createLocalProjectStore } from "@/lib/ports/projects.local";
import { markDraftReady, markDraftStart } from "@/lib/monitor/kpi";
import { loadBetaReport } from "./service";

// SRS SR-NF-22·23, 13.3 인수 기준 / T-42
async function env() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chakgong-beta-"));
  return { audit: createMemoryAuditLog(), beta: createMemoryBetaStore(), projects: createLocalProjectStore(dir), dir };
}

describe("베타 종합 보고", () => {
  it("시작·5분 안 통과를 세어 북극성 KPI와 판정을 낸다", async () => {
    const e = await env();
    for (const id of ["a", "b", "c", "d"]) await markDraftStart(e.audit, id, "x");
    const [s] = await e.audit.list({ action: "draft.start", target: "a" });
    const t = new Date(s.at).getTime();
    await markDraftReady(e.audit, "a", "x", new Date(t + 60_000));
    await markDraftReady(e.audit, "b", "x", new Date(t + 120_000));
    await markDraftReady(e.audit, "c", "x", new Date(t + 400_000)); // 5분 초과
    const r = await loadBetaReport(e);
    expect(r.kpi).toMatchObject({ started: 4, ready: 3, within5: 2, rate: 0.5 });
    expect(r.kpi.judgement.verdict).toBe("improve");
    expect(r.rows.find((x) => x.projectId === "d")?.delivered).toBe(false);
  });

  it("막은 서류 불일치 건수와 집계표 차이(원)를 합산한다", async () => {
    const e = await env();
    await e.audit.record({ user: "x", action: "doc.mismatch", target: "a", detail: { count: 2 } });
    await e.audit.record({ user: "x", action: "export.rejected", target: "a", detail: { codes: ["V-1"], diffWon: 1500 } });
    const r = await loadBetaReport(e);
    expect(r.mismatch).toEqual({ blocked: 2, tableDiffWon: 1500 });
  });

  it("베타 기록(보완 요구·수작업 시간)과 도구 시간을 함께 보여 주고, 인수 기준 점검표를 만든다", async () => {
    const e = await env();
    await markDraftStart(e.audit, "a", "x");
    await markDraftReady(e.audit, "a", "x", new Date(Date.now() + 180_000));
    await e.beta.put({ projectId: "a", supplementRequests: 1, supplementDueToMismatch: 0, manualMinutes: 240, comparison: "수작업과 동일", submittable: true, updatedAt: "", updatedBy: "x" });
    const r = await loadBetaReport(e);
    expect(r.summary).toMatchObject({ supplementRequests: 1, measured: 1, manualMinutes: 240 });
    expect(r.summary.toolMinutes).toBeGreaterThanOrEqual(3);
    const ok = (part: string) => r.acceptance.find((a) => a.label.includes(part))?.ok;
    expect(ok("실제 업체 의뢰")).toBe(true);
    expect(ok("내역서 2건 이상")).toBe(false);
    expect(r.acceptance.filter((a) => a.manual)).toHaveLength(2);
  });
});

describe("베타 기록 저장 (로컬 파일)", () => {
  it("저장한 기록을 다시 읽고, 같은 공사는 덮어쓴다", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "chakgong-beta-"));
    const s = createLocalBetaStore(dir);
    const n = { projectId: "a", supplementRequests: 1, supplementDueToMismatch: 0, manualMinutes: 10, comparison: "", submittable: null, updatedAt: "", updatedBy: "x" };
    await s.put(n);
    await s.put({ ...n, supplementRequests: 2 });
    expect((await s.list()).length).toBe(1);
    expect((await s.get("a"))?.supplementRequests).toBe(2);
  });
});

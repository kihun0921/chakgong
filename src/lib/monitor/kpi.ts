// 북극성 KPI·성능 측정 기록 (SRS SR-NF-22·28, T-42)
// 시작: 내역서 원본을 처음 올린 때. 통과: 그 공사가 처음 납품(검증 통과 출력)된 때. 시각은 공사별로 이력에 남긴다.

import type { AuditLog } from "@/lib/ports/audit";

export async function markDraftStart(audit: AuditLog, projectId: string, by: string): Promise<void> {
  if ((await audit.list({ action: "draft.start", target: projectId })).length > 0) return;
  await audit.record({ user: by, action: "draft.start", target: projectId });
}

export async function markDraftReady(audit: AuditLog, projectId: string, by: string, now = new Date()): Promise<void> {
  const [start] = await audit.list({ action: "draft.start", target: projectId });
  if (!start) return;
  if ((await audit.list({ action: "draft.ready", target: projectId })).length > 0) return;
  const ms = now.getTime() - new Date(start.at).getTime();
  await audit.record({ user: by, action: "draft.ready", target: projectId, detail: { ms } });
  await audit.record({ user: by, action: "perf", target: projectId, detail: { metric: "draft", ms } });
}

export async function recordPerf(audit: AuditLog, by: string, metric: "export", ms: number, projectId: string): Promise<void> {
  await audit.record({ user: by, action: "perf", target: projectId, detail: { metric, ms: Math.round(ms) } });
}

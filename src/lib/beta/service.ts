// 베타 종합 (SRS SR-NF-22·23, 13.3 인수 기준): 이력과 베타 기록에서 북극성 KPI·보조 KPI·인수 기준 점검을 계산한다.

import { judgeKpi, summarizeBeta, type BetaNote, type BetaSummary, type KpiJudgement } from "@/domain/beta";
import type { AuditLog } from "@/lib/ports/audit";
import type { BetaStore } from "@/lib/ports/beta";
import type { ProjectStore } from "@/lib/ports/projects";

export type BetaRow = { projectId: string; projectName: string; delivered: boolean; toolMinutes: number | null; note: BetaNote | null };
export type AcceptanceItem = { label: string; ok: boolean; detail: string; manual?: boolean };
export type BetaReport = {
  kpi: { started: number; ready: number; within5: number; rate: number | null; judgement: KpiJudgement };
  /** 보조 1: 서류 간 불일치와 집계표 차이. 막은 건수이며 납품본에는 0건이어야 한다 */
  mismatch: { blocked: number; tableDiffWon: number };
  summary: BetaSummary;
  rows: BetaRow[];
  acceptance: AcceptanceItem[];
};

export async function loadBetaReport(deps: { audit: AuditLog; beta: BetaStore; projects: ProjectStore }): Promise<BetaReport> {
  const entries = await deps.audit.list();
  const names = new Map((await deps.projects.list()).map((p) => [p.id, p.name]));
  const notes = await deps.beta.list();
  const noteOf = new Map(notes.map((n) => [n.projectId, n]));

  const starts = new Set(entries.filter((e) => e.action === "draft.start" && e.target).map((e) => e.target as string));
  const readyMs = new Map<string, number>();
  for (const e of entries) if (e.action === "draft.ready" && e.target) readyMs.set(e.target, Number(e.detail?.ms) || 0);
  const within5 = [...readyMs.values()].filter((ms) => ms <= 300_000).length;
  const rate = starts.size === 0 ? null : within5 / starts.size;

  const blocked = entries.filter((e) => e.action === "doc.mismatch").reduce((n, e) => n + (Number(e.detail?.count) || 0), 0);
  const tableDiffWon = entries.filter((e) => e.action === "export.rejected").reduce((n, e) => n + (Number(e.detail?.diffWon) || 0), 0);

  const toolMin = new Map([...readyMs].map(([id, ms]) => [id, Math.round(ms / 60_000)]));
  const summary = summarizeBeta(notes, toolMin);

  const ids = new Set([...starts, ...notes.map((n) => n.projectId)]);
  const rows: BetaRow[] = [...ids].map((id) => ({
    projectId: id,
    projectName: names.get(id) ?? "(삭제된 공사)",
    delivered: readyMs.has(id),
    toolMinutes: toolMin.get(id) ?? null,
    note: noteOf.get(id) ?? null,
  }));

  const parseOk = entries.filter((e) => e.action === "budget.parse" && (e.detail?.outcome === "auto" || e.detail?.outcome === "mapped")).length;
  const judgement = judgeKpi(rate, starts.size);
  const acceptance: AcceptanceItem[] = [
    { label: "내역서 2건 이상 파싱 성공(또는 수동 보정 후 완료)", ok: parseOk >= 2, detail: `성공 ${parseOk}건` },
    { label: "실제 업체 의뢰 1건을 납품", ok: readyMs.size >= 1, detail: `납품 ${readyMs.size}건` },
    { label: "관리자가 '제출 가능 수준'이라고 확인한 공사 1건 이상", ok: summary.submittable.yes >= 1, detail: `확인 ${summary.submittable.yes}건`, manual: true },
    { label: "수작업 결과와 비교 기록 1건 이상", ok: notes.some((n) => n.comparison !== ""), detail: `${notes.filter((n) => n.comparison !== "").length}건`, manual: true },
    { label: "북극성 KPI 판정(90% 이상 달성 / 50% 미만 피봇)", ok: judgement.verdict === "pass", detail: judgement.label + (judgement.caution ? ` — ${judgement.caution}` : "") },
  ];
  return { kpi: { started: starts.size, ready: readyMs.size, within5, rate, judgement }, mismatch: { blocked, tableDiffWon }, summary, rows, acceptance };
}

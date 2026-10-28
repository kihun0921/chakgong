// 공정표·인원장비투입계획 최종 출력 (SRS SR-OUT-01·02·03·08, SR-VR-06)
// 검증을 통과해야 출력하고, 출력에 성공하면 납품 이력을 남긴다(실패하면 남기지 않는다).
// 입력을 서버에서 다시 계산해서, 화면이 보낸 계산 결과를 믿지 않는다.

import type { DocInput } from "@/domain/documents/model";
import { buildLaborDoc, buildScheduleDoc, type PlanDocData } from "@/domain/documents/plan-docs";
import type { Issue } from "@/domain/validation";
import { buildPlan, type BuildPlanInput } from "@/lib/work/buildPlan";
import { mergeParts } from "@/lib/pdf/merge";
import { renderDocPdf } from "@/lib/pdf/render";
import type { DeliveryLog } from "@/lib/ports/delivery";
import { buildPlanWorkbook } from "./xlsx";

export type ExportRequest = { projectId: string; doc: DocInput; plan: BuildPlanInput };
export type ExportContext = { log: DeliveryLog; user: string };

export type ExportResult =
  | { ok: true; bytes: Uint8Array; filename: string; contentType: string }
  | { ok: false; reason: "noPlan"; message: string }
  | { ok: false; reason: "invalid"; issues: Issue[] };

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** 입력을 다시 계산하고 검증을 통과한 경우에만 출력용 데이터를 돌려준다 (SR-OUT-01). */
export function preparePlan(req: ExportRequest):
  | { ok: true; data: PlanDocData; warnings: string[] }
  | Extract<ExportResult, { ok: false }> {
  const out = buildPlan(req.plan);
  if (out.error) return { ok: false, reason: "noPlan", message: out.error };
  if (!out.result) return { ok: false, reason: "noPlan", message: "내역서를 확정한 뒤에 출력할 수 있습니다." };
  if (!out.result.validation.passed) return { ok: false, reason: "invalid", issues: out.result.validation.issues };
  return {
    ok: true,
    warnings: out.warnings,
    data: {
      processes: out.processes,
      result: out.result,
      summaryTotalWon: req.plan.parsed?.grandTotal ?? req.plan.parsed?.summaryTotal ?? 0,
      remarks: req.plan.remarks,
      locations: req.plan.locations,
    },
  };
}

export async function exportPlan(
  kind: "xlsx" | "pdf",
  req: ExportRequest,
  ctx: ExportContext,
): Promise<ExportResult> {
  const prep = preparePlan(req);
  if (!prep.ok) return prep;

  if (kind === "xlsx") {
    const bytes = await buildPlanWorkbook(req.doc, prep.data);
    const filename = "공정표_인원장비투입계획표.xlsx";
    await ctx.log.record({ projectId: req.projectId, by: ctx.user, kind: "xlsx", files: [filename] });
    return { ok: true, bytes, filename, contentType: XLSX_TYPE };
  }

  const parts = [
    { title: "공사예정공정표", bytes: await renderDocPdf(buildScheduleDoc(req.doc, prep.data)) },
    { title: "인원 및 장비투입계획표", bytes: await renderDocPdf(buildLaborDoc(req.doc, prep.data)) },
  ];
  const bytes = await mergeParts(parts);
  const filename = "공정표_인원장비투입계획표.pdf";
  await ctx.log.record({ projectId: req.projectId, by: ctx.user, kind: "pdf", files: [filename] });
  return { ok: true, bytes, filename, contentType: "application/pdf" };
}

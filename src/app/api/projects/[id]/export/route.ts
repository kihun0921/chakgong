// 공정표·인원장비투입계획표 xlsx/PDF 내려받기 (SRS SR-OUT-01~03·08)
// body: { kind: "xlsx" | "pdf" }. 저장된 공사를 서버에서 다시 계산하고 검증을 통과해야 만든다.

import { requireAdmin } from "@/lib/auth/guard";
import { exportPlan } from "@/lib/export/service";
import { markDraftReady, recordPerf } from "@/lib/monitor/kpi";
import { deliverGuarded } from "@/lib/fees/service";
import { getAuditLog, getDeliveryLog, getFeeDeps, getFileStore, getProjectStore } from "@/lib/ports";
import { loadForGeneration } from "@/lib/projects/generate";
import { ID_PATTERN } from "@/lib/projects/validate";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });

  let kind: unknown;
  try {
    kind = ((await request.json()) as { kind?: unknown }).kind;
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (kind !== "xlsx" && kind !== "pdf") return Response.json({ error: "kind는 xlsx 또는 pdf여야 합니다." }, { status: 400 });

  try {
    const g = await loadForGeneration({ projects: getProjectStore(), files: getFileStore() }, id);
    if (!g.ok) return Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 });

    // 용역비 상태(환불 요청·환불·취소)를 확인하고, 만들어 납품 이력을 남기는 동안 취소 요청이 끼어들지 못하게 한 줄로 처리한다
    const t0 = performance.now();
    const gate = await deliverGuarded(getFeeDeps(), id, admin.user, () =>
      exportPlan(kind, { projectId: id, doc: g.doc, plan: g.plan }, { log: getDeliveryLog(), user: admin.user }),
    );
    if (!gate.ok) return Response.json({ reason: "feeBlocked", error: gate.message }, { status: 403 });
    const r = gate.value;
    if (!r.ok) {
      if (r.reason === "invalid") {
        await getAuditLog().record({ user: admin.user, action: "export.rejected", target: id, detail: { codes: r.issues.map((i) => i.code), diffWon: r.issues.reduce((n, i) => n + ("diffWon" in i ? Math.abs(i.diffWon) : 0), 0) } });
      }
      return Response.json(r, { status: 422 });
    }
    const audit = getAuditLog();
    await audit.record({ user: admin.user, action: "delivery", target: id, detail: { kind } });
    await recordPerf(audit, admin.user, "export", performance.now() - t0, id);
    await markDraftReady(audit, id, admin.user);
    return new Response(Buffer.from(r.bytes), {
      headers: {
        "Content-Type": r.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.filename)}`,
      },
    });
  } catch (e) {
    console.error("[projects/export]", e);
    return Response.json({ error: "출력 파일을 만드는 중 오류가 났습니다. 입력값을 확인해 주세요." }, { status: 500 });
  }
}

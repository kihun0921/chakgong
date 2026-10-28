// 착공계 합본 PDF 만들기 (SRS SR-CM-10, SR-VR-06, SR-OUT-04·05·08, SR-NF-15·16)
// 저장된 공사를 서버에서 다시 읽어 만든다. 서류에는 주민등록번호 전체 값이 들어가므로 출력 이력(pii.export)을 남긴다.

import { requireAdmin } from "@/lib/auth/guard";
import { preparePlan } from "@/lib/export/service";
import { buildPackage } from "@/lib/pdf/package";
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

  try {
    const g = await loadForGeneration({ projects: getProjectStore(), files: getFileStore() }, id);
    if (!g.ok) {
      return g.reason === "notFound"
        ? Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 })
        : Response.json({ reason: "badFiles", bad: (g.names ?? []).map((t) => ({ title: t, reason: "저장된 파일을 읽지 못했습니다." })) }, { status: 422 });
    }

    // 용역비 상태 확인과 만들기·납품 이력 기록을 공사별로 한 줄로 처리한다(환불 요청과 출력이 겹치면 먼저 온 쪽만 성립)
    const t0 = performance.now();
    const gate = await deliverGuarded(getFeeDeps(), id, admin.user, async () => {
      // 공정표·투입계획: 내역서를 확정하고 검증을 통과한 경우에만 합본에 넣는다(서버에서 다시 계산)
      const prep = preparePlan({ projectId: id, doc: g.doc, plan: g.plan });
      const result = await buildPackage(g.doc, g.uploads, prep.ok ? prep.data : undefined);
      if (!result.ok) return { result };

      // 합본 PDF에는 개인정보 전체 값이 들어간다: 출력 이력을 먼저 남기고(실패하면 출력하지 않는다), 납품 이력을 남긴다
      const audit = getAuditLog();
      if (g.engineerCount > 0) {
        await audit.record({ user: admin.user, action: "pii.export", target: id, detail: { fields: ["rrn"], count: g.engineerCount } });
      }
      await getDeliveryLog().record({ projectId: id, by: admin.user, kind: "package", files: ["착공계_합본.pdf"] });
      await audit.record({ user: admin.user, action: "delivery", target: id, detail: { kind: "package" } });
      return { result };
    });
    if (!gate.ok) return Response.json({ reason: "feeBlocked", error: gate.message }, { status: 403 });
    const { result } = gate.value;
    if (!result.ok) {
      if (result.reason === "mismatch") {
        // 서류 간 불일치를 막은 기록(SR-NF-23): 납품본에는 불일치가 나가지 않았다는 근거
        await getAuditLog().record({ user: admin.user, action: "doc.mismatch", target: id, detail: { count: result.mismatches.length, facts: result.mismatches.map((m) => m.fact) } });
      }
      return Response.json(result, { status: 422 });
    }
    await recordPerf(getAuditLog(), admin.user, "export", performance.now() - t0, id);
    await markDraftReady(getAuditLog(), id, admin.user);

    return new Response(Buffer.from(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("착공계_합본.pdf")}`,
        "X-Notices": encodeURIComponent(JSON.stringify(result.notices)),
        "X-Total-Pages": String(result.totalPages),
      },
    });
  } catch (e) {
    console.error("[projects/package]", e);
    return Response.json({ error: "합본을 만드는 중 오류가 났습니다. 입력값을 확인해 주세요." }, { status: 500 });
  }
}

import { requireAdmin } from "@/lib/auth/guard";
import { createFeeFor } from "@/lib/fees/service";
import { getFeeDeps, getProjectDeps } from "@/lib/ports";
import { duplicateProject } from "@/lib/projects/service";
import { ID_PATTERN } from "@/lib/projects/validate";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });
  try {
    const copy = await duplicateProject(getProjectDeps(), id, admin.user);
    // 복제본은 새 의뢰이므로 용역비도 새로 시작한다(미입금)
    await createFeeFor(getFeeDeps(), copy.id, admin.user);
    return Response.json({ id: copy.id }, { status: 201 });
  } catch (e) {
    const notFound = e instanceof Error && e.message.includes("찾을 수 없");
    return Response.json({ error: notFound ? "공사를 찾을 수 없습니다." : "복제하지 못했습니다." }, { status: notFound ? 404 : 500 });
  }
}

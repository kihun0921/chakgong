// 공사별 베타 기록 (SRS SR-NF-23, D-11): 보완 요구 횟수·수작업 비교·제출 가능 확인을 관리자가 직접 기록한다.
import { validateBetaNote } from "@/domain/beta";
import { requireAdmin } from "@/lib/auth/guard";
import { getBetaStore, getProjectStore } from "@/lib/ports";
import { ID_PATTERN } from "@/lib/projects/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });
  return Response.json({ note: await getBetaStore().get(id) });
}

export async function PUT(request: Request, ctx: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });
  if (!(await getProjectStore().get(id))) return Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const v = validateBetaNote(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 422 });
  const note = { projectId: id, ...v.value, updatedAt: new Date().toISOString(), updatedBy: admin.user };
  await getBetaStore().put(note);
  return Response.json({ note });
}

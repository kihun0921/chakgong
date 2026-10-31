// 공사 조회·저장 (SRS SR-DM-01·06, SR-NF-15). 화면으로는 주민등록번호를 마스킹해서만 내려보낸다.

import { requireAdmin } from "@/lib/auth/guard";
import { repriceIfCompanyChanged } from "@/lib/fees/pricing";
import { getFeeDeps, getProjectDeps, getProjectStore } from "@/lib/ports";
import { saveProject, toClient } from "@/lib/projects/service";
import { ID_PATTERN, coerceWorkState } from "@/lib/projects/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });
  const p = await getProjectStore().get(id);
  if (!p) return Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(toClient(p));
}

export async function PUT(request: Request, ctx: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });

  let body: { data?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const data = coerceWorkState(body.data);
  if (!data) return Response.json({ error: "공사 입력 형식이 올바르지 않습니다." }, { status: 400 });

  try {
    const name = typeof body.name === "string" && body.name.trim() !== "" ? body.name.trim().slice(0, 100) : undefined;
    const prev = await getProjectStore().get(id);
    const saved = await saveProject(getProjectDeps(), id, data, admin.user, name);
    // 업체 번호·소개 업체가 바뀌면 납품·입금 전 용역비의 할인을 다시 정한다(SR-FEE-14). 실패해도 저장은 유지한다.
    if (prev) {
      try {
        await repriceIfCompanyChanged(getFeeDeps(), id, prev.data.general, data.general, admin.user);
      } catch (e) {
        console.error("[projects/reprice]", e);
      }
    }
    return Response.json(saved);
  } catch (e) {
    if (e instanceof Error && e.message.includes("찾을 수 없")) {
      return Response.json({ error: e.message }, { status: 404 });
    }
    console.error("[projects/save]", e);
    return Response.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}

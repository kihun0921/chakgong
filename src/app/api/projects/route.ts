// 공사 목록·만들기 (SRS SR-DM-01, SR-PL-04): 모든 관리자가 모든 공사를 본다.

import { requireAdmin } from "@/lib/auth/guard";
import { createFeeFor } from "@/lib/fees/service";
import { getFeeDeps, getProjectDeps, getProjectStore } from "@/lib/ports";
import { createProject } from "@/lib/projects/service";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  return Response.json({ projects: await getProjectStore().list() });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  let name = "";
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name === "string") name = body.name.slice(0, 100);
  } catch {
    /* 이름 없이 만든다 */
  }
  const p = await createProject(getProjectDeps(), name, admin.user);
  await createFeeFor(getFeeDeps(), p.id, admin.user);
  return Response.json({ id: p.id }, { status: 201 });
}

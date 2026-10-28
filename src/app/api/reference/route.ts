// 기준정보 조회·수정 (SRS SR-DM-02·03, AC-F8-1·3): 관리자만. 저장 전에 서버가 검사한다.

import { requireAdmin } from "@/lib/auth/guard";
import { getAuditLog, getReferenceStore } from "@/lib/ports";
import { validateReference } from "@/lib/reference/types";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  return Response.json(await getReferenceStore().get());
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const v = validateReference(body);
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 422 });

  const store = getReferenceStore();
  const before = await store.get();
  const changed = (Object.keys(v.data) as (keyof typeof v.data)[]).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(v.data[k]),
  );
  await store.save(v.data);
  await getAuditLog().record({ user: admin.user, action: "reference.update", detail: { changed } });
  return Response.json(v.data);
}

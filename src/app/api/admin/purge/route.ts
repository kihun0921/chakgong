// 보존 기간(공사 종료 후 5년)이 지난 공사 삭제 (SRS SR-NF-17). 관리자가 실행한다.

import { requireAdmin } from "@/lib/auth/guard";
import { getProjectDeps } from "@/lib/ports";
import { purgeExpired } from "@/lib/projects/service";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const removed = await purgeExpired(getProjectDeps(), new Date(), 5, admin.user);
  return Response.json({ removed });
}

// 베타 종합 보고 (SRS SR-NF-22·23, 13.3): 관리자만.
import { requireAdmin } from "@/lib/auth/guard";
import { loadBetaReport } from "@/lib/beta/service";
import { getAuditLog, getBetaStore, getProjectStore } from "@/lib/ports";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  return Response.json(await loadBetaReport({ audit: getAuditLog(), beta: getBetaStore(), projects: getProjectStore() }));
}

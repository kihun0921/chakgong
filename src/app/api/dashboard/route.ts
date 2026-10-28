// 관리자 대시보드 (SRS SR-ADM-01~05): 관리자만. 기간은 ?from=yyyy-mm-dd&to=yyyy-mm-dd (기본: 이번 달).

import { requireAdmin } from "@/lib/auth/guard";
import { loadDashboard } from "@/lib/dashboard/service";
import { todayKst } from "@/lib/fees/service";
import { getAlertStore, getFeeDeps, getProjectStore } from "@/lib/ports";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const today = todayKst();
  const q = new URL(request.url).searchParams;
  const from = q.get("from") ?? `${today.slice(0, 7)}-01`;
  const to = q.get("to") ?? today;
  if (!DATE.test(from) || !DATE.test(to) || from > to) {
    return Response.json({ error: "기간 형식이 올바르지 않습니다." }, { status: 400 });
  }
  return Response.json(await loadDashboard({ ...getFeeDeps(), projects: getProjectStore(), alerts: getAlertStore() }, from, to, today));
}

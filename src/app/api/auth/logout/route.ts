import { cookies } from "next/headers";
import { getAdmin } from "@/lib/auth/guard";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { getAuditLog } from "@/lib/ports";

export async function POST() {
  const admin = await getAdmin();
  if (admin) await getAuditLog().record({ user: admin.user, action: "logout" });
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}

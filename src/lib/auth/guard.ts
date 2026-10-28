// 관리자 확인 (SRS SR-PL-01~03, SR-NF-12). 모든 API(Route Handler)와 페이지는 처음에 이 중 하나를 불러야 한다.
// 서버에서 검사한다. 화면 숨김만으로 권한을 대신하지 않는다. 확인에 실패하면 시도를 이력으로 남긴다.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminStore, getAuditLog } from "@/lib/ports";
import { SESSION_COOKIE, getSessionSecret } from "./config";
import { readSession } from "./session";

export type AdminUser = { user: string };
export type AdminCheck = { ok: true; user: string } | { ok: false; response: Response };

/** 세션 서명·만료를 확인하고, 계정이 아직 있는지도 본다(삭제된 계정은 바로 막는다). */
export async function getAdmin(): Promise<AdminUser | null> {
  // 요청마다 달라지는 값(현재 시각)을 쓰므로 미리 그려 두는 단계에서는 실행하지 않는다
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token, getSessionSecret(), Date.now());
  if (!session) return null;
  const account = await getAdminStore().get(session.u);
  return account ? { user: session.u } : null;
}

/** Route Handler용: 관리자가 아니면 401 응답을 돌려주고 접근 시도를 이력에 남긴다. */
export async function requireAdmin(request?: Request): Promise<AdminCheck> {
  const admin = await getAdmin();
  if (admin) return { ok: true, user: admin.user };
  await getAuditLog().record({
    user: "-",
    action: "access.denied",
    detail: request ? { path: new URL(request.url).pathname, method: request.method } : undefined,
  });
  return { ok: false, response: Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 }) };
}

/** 페이지용: 관리자가 아니면 접근 시도를 이력에 남기고 로그인 화면으로 보낸다. */
export async function requirePageAdmin(path: string): Promise<AdminUser> {
  const admin = await getAdmin();
  if (admin) return admin;
  await getAuditLog().record({ user: "-", action: "access.denied", detail: { path } });
  redirect("/login");
}

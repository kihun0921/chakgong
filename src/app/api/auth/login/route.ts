// 관리자 로그인 (SRS SR-PL-01). 아이디·비밀번호가 맞으면 서명된 세션 쿠키를 심는다. 회원가입은 없다.

import { cookies } from "next/headers";
import { SESSION_COOKIE, getSessionSecret } from "@/lib/auth/config";
import { login } from "@/lib/auth/service";
import { getAdminStore, getAuditLog, getLoginLimiter } from "@/lib/ports";

export async function POST(request: Request) {
  let body: { id?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof body.id !== "string" || typeof body.password !== "string" || body.password.length > 200) {
    return Response.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const r = await login(body.id, body.password, {
    admins: getAdminStore(),
    audit: getAuditLog(),
    limiter: getLoginLimiter(),
    secret: getSessionSecret(),
  });
  if (!r.ok) {
    return r.reason === "locked"
      ? Response.json({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 })
      : Response.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, r.token, {
    httpOnly: true,
    secure: process.env.cookie_ENV === "true",
    sameSite: "lax",
    path: "/",
    expires: new Date(r.expiresAt),
  });
  return Response.json({ ok: true });
}

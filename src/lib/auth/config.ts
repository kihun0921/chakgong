// 인증 설정. 운영(production)에서는 SESSION_SECRET이 없으면 시작하지 않는다.

export const SESSION_COOKIE = "chakgong_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8시간

export function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET(32자 이상)이 설정되지 않았습니다.");
  }
  return "dev-only-session-secret-do-not-use-in-production!!";
}

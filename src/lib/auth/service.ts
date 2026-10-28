// 관리자 로그인 (SRS SR-PL-01·03, SR-NF-12·16)
// 아이디가 없든 비밀번호가 틀리든 같은 응답을 주고, 연속 실패하면 잠시 잠근다. 비밀번호는 이력에 남기지 않는다.

import type { AdminStore } from "@/lib/ports/admins";
import type { AuditLog } from "@/lib/ports/audit";
import { SESSION_TTL_MS } from "./config";
import { hashPassword, verifyPassword } from "./password.mjs";
import { signSession } from "./session";

export type LoginLimiter = {
  isLocked(key: string, now: number): boolean;
  fail(key: string, now: number): void;
  reset(key: string): void;
};

/** 연속 max번 실패하면 마지막 실패 후 lockMs 동안 잠근다. */
export function createLoginLimiter(max = 5, lockMs = 15 * 60 * 1000): LoginLimiter {
  const state = new Map<string, { count: number; last: number }>();
  return {
    isLocked(key, now) {
      const s = state.get(key);
      if (!s) return false;
      if (now - s.last >= lockMs) {
        state.delete(key);
        return false;
      }
      return s.count >= max;
    },
    fail(key, now) {
      const s = state.get(key);
      state.set(key, { count: (s?.count ?? 0) + 1, last: now });
    },
    reset(key) {
      state.delete(key);
    },
  };
}

export type LoginDeps = {
  admins: AdminStore;
  audit: AuditLog;
  limiter: LoginLimiter;
  secret: string;
  now?: () => number;
};

export type LoginResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; reason: "invalid" | "locked" };

// 없는 아이디도 같은 시간이 걸리도록 비교할 가짜 해시(한 번만 만든다)
let dummyHash: Promise<string> | null = null;

export async function login(id: string, password: string, deps: LoginDeps): Promise<LoginResult> {
  const now = (deps.now ?? Date.now)();
  const who = id.trim().slice(0, 64) || "-";

  if (deps.limiter.isLocked(who, now)) {
    await deps.audit.record({ user: who, action: "login.locked" });
    return { ok: false, reason: "locked" };
  }

  const account = await deps.admins.get(who);
  dummyHash ??= hashPassword("dummy-password-for-timing");
  const ok = await verifyPassword(password, account?.passwordHash ?? (await dummyHash));

  if (!account || !ok) {
    deps.limiter.fail(who, now);
    await deps.audit.record({ user: who, action: "login.fail" });
    return { ok: false, reason: "invalid" };
  }

  deps.limiter.reset(who);
  const expiresAt = now + SESSION_TTL_MS;
  const token = await signSession({ u: account.id, exp: expiresAt }, deps.secret);
  await deps.audit.record({ user: account.id, action: "login.success" });
  return { ok: true, token, expiresAt };
}

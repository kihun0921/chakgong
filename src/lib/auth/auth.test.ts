import { describe, expect, it } from "vitest";
import { createMemoryAdminStore } from "@/lib/ports/admins";
import { createMemoryAuditLog } from "@/lib/ports/audit";
import { checkPasswordStrength, hashPassword, verifyPassword } from "./password.mjs";
import { createLoginLimiter, login } from "./service";
import { readSession, signSession } from "./session";

// SRS SR-PL-01·03, SR-NF-12·16 / PRD AC-F9-1·3 (T-25, T-27의 서버 부분)
const SECRET = "test-secret-test-secret-test-secret-1234";

describe("비밀번호", () => {
  it("해시로 저장하고 맞는 비밀번호만 통과한다", async () => {
    const h = await hashPassword("Correct-horse-9");
    expect(h).not.toContain("Correct-horse-9");
    expect(await verifyPassword("Correct-horse-9", h)).toBe(true);
    expect(await verifyPassword("wrong-password-1", h)).toBe(false);
  });
  it("같은 비밀번호도 해시가 매번 다르다(salt)", async () => {
    expect(await hashPassword("Same-password-1")).not.toBe(await hashPassword("Same-password-1"));
  });
  it("10자 이상이고 영문·숫자를 모두 넣어야 한다", () => {
    expect(checkPasswordStrength("short1")).toContain("10자");
    expect(checkPasswordStrength("onlyletterss")).toContain("영문과 숫자");
    expect(checkPasswordStrength("long-enough-123")).toBeNull();
  });
});

describe("서명된 세션", () => {
  const now = 1_000_000;
  it("서명이 맞고 만료 전이면 읽힌다", async () => {
    const t = await signSession({ u: "admin", exp: now + 1000 }, SECRET);
    expect(await readSession(t, SECRET, now)).toEqual({ u: "admin", exp: now + 1000 });
  });
  it("만료되면 거부한다", async () => {
    const t = await signSession({ u: "admin", exp: now + 1000 }, SECRET);
    expect(await readSession(t, SECRET, now + 1000)).toBeNull();
  });
  it("내용을 고치거나 다른 키로 서명하면 거부한다", async () => {
    const t = await signSession({ u: "admin", exp: now + 1000 }, SECRET);
    const [, sig] = t.split(".");
    const forged = `${btoa(JSON.stringify({ u: "root", exp: now + 99999 })).replace(/=+$/, "")}.${sig}`;
    expect(await readSession(forged, SECRET, now)).toBeNull();
    expect(await readSession(t, "another-secret-another-secret-1234567", now)).toBeNull();
    expect(await readSession("garbage", SECRET, now)).toBeNull();
    expect(await readSession(undefined, SECRET, now)).toBeNull();
  });
});

describe("관리자 로그인", () => {
  async function setup() {
    const admins = createMemoryAdminStore([
      { id: "admin", passwordHash: await hashPassword("Correct-horse-9"), createdAt: "2026-10-17" },
    ]);
    const audit = createMemoryAuditLog();
    return { admins, audit, limiter: createLoginLimiter(3, 60_000), secret: SECRET, now: () => 5_000 };
  }

  it("맞는 아이디·비밀번호면 세션이 만들어지고 성공 이력이 남는다 (T-25)", async () => {
    const d = await setup();
    const r = await login("admin", "Correct-horse-9", d);
    expect(r.ok).toBe(true);
    if (r.ok) expect((await readSession(r.token, SECRET, 5_000))?.u).toBe("admin");
    expect((await d.audit.list({ action: "login.success" }))[0].user).toBe("admin");
  });

  it("틀린 비밀번호와 없는 아이디는 같은 응답이고 비밀번호는 이력에 없다", async () => {
    const d = await setup();
    const a = await login("admin", "wrong-password-1", d);
    const b = await login("nobody", "wrong-password-1", d);
    expect(a).toEqual({ ok: false, reason: "invalid" });
    expect(b).toEqual({ ok: false, reason: "invalid" });
    const fails = await d.audit.list({ action: "login.fail" });
    expect(fails).toHaveLength(2);
    expect(JSON.stringify(fails)).not.toContain("wrong-password-1");
  });

  it("연속 3번 실패하면 잠기고, 잠긴 동안은 맞는 비밀번호도 거부한다", async () => {
    const d = await setup();
    for (let i = 0; i < 3; i++) await login("admin", "bad-password-1", d);
    const r = await login("admin", "Correct-horse-9", d);
    expect(r).toEqual({ ok: false, reason: "locked" });
    expect(await d.audit.list({ action: "login.locked" })).toHaveLength(1);
  });

  it("잠금 시간이 지나면 다시 로그인할 수 있다", async () => {
    const d = await setup();
    for (let i = 0; i < 3; i++) await login("admin", "bad-password-1", d);
    const later = { ...d, now: () => 5_000 + 61_000 };
    expect((await login("admin", "Correct-horse-9", later)).ok).toBe(true);
  });

  it("이력을 쓰지 못하면 로그인도 실패한다 (D-4)", async () => {
    const d = await setup();
    const broken = {
      ...d,
      audit: {
        record: async () => {
          throw new Error("disk full");
        },
        list: async () => [],
      },
    };
    await expect(login("admin", "Correct-horse-9", broken)).rejects.toThrow("disk full");
  });
});

// 서명된 세션 쿠키 (SRS SR-PL-01, SR-NF-12). 서버가 비밀 키로 서명하므로 화면에서 고칠 수 없다.
// Web Crypto만 써서 어느 실행 환경에서든 동작한다.

const enc = new TextEncoder();

export type SessionPayload = { u: string; exp: number };

function toB64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64u(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = toB64u(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${toB64u(sig)}`;
}

/** 서명이 맞고 만료되지 않았으면 내용을, 아니면 null을 돌려준다. */
export async function readSession(
  token: string | undefined,
  secret: string,
  nowMs: number,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64u(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64u(body))) as SessionPayload;
    if (typeof payload.u !== "string" || typeof payload.exp !== "number" || payload.exp <= nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}

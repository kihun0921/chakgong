// 필드·파일 단위 암호화 (SRS SR-NF-13): AES-256-GCM.
// 주민등록번호·주소·계좌번호와 업로드 파일을 저장하기 전에 암호화한다. 키는 환경변수(FIELD_ENCRYPTION_KEY)에만 둔다.
// 운영(production)에서 키가 없으면 시작하지 않는다.

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

const PREFIX = "enc:v1:";

export function getFieldKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw && raw.length >= 32) {
    // base64로 32바이트면 그대로, 아니면 문구에서 32바이트 키를 만든다
    const b = Buffer.from(raw, "base64");
    return b.length === 32 ? b : scryptSync(raw, "chakgong-field-key", 32);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("FIELD_ENCRYPTION_KEY(32자 이상)가 설정되지 않았습니다.");
  }
  return createHash("sha256").update("dev-only-field-key-do-not-use-in-production").digest();
}

export function encryptBytes(plain: Uint8Array, key: Buffer = getFieldKey()): Uint8Array {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decryptBytes(blob: Uint8Array, key: Buffer = getFieldKey()): Uint8Array {
  const buf = Buffer.from(blob);
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

export function encryptString(plain: string, key: Buffer = getFieldKey()): string {
  if (plain === "") return "";
  return PREFIX + Buffer.from(encryptBytes(Buffer.from(plain, "utf8"), key)).toString("base64");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function decryptString(value: string, key: Buffer = getFieldKey()): string {
  if (value === "" || !isEncrypted(value)) return value;
  return Buffer.from(decryptBytes(Buffer.from(value.slice(PREFIX.length), "base64"), key)).toString("utf8");
}

// 관리자 비밀번호 해시 (SRS SR-NF-12): scrypt + 임의 salt. 비밀번호 원문은 저장하지 않는다.
// 서버 코드와 관리자 계정 생성 스크립트(scripts/create-admin.mjs)가 같이 쓰므로 순수 .mjs로 둔다.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

/** @param {string} password @returns {Promise<string>} */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** @param {string} password @param {string} stored @returns {Promise<boolean>} */
export async function verifyPassword(password, stored) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 비밀번호 규칙: 10자 이상, 영문과 숫자를 모두 포함. 통과하면 null, 아니면 이유 문장. @param {string} pw */
export function checkPasswordStrength(pw) {
  if (pw.length < 10) return "비밀번호는 10자 이상이어야 합니다.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "비밀번호에 영문과 숫자를 모두 넣어 주세요.";
  return null;
}

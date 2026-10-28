// 관리자 계정 만들기 (회원가입 화면은 없다). 사용: node scripts/create-admin.mjs <아이디> <비밀번호>
// 개발 중에는 .data/admins.json 에 쓴다. Supabase로 바꾸면 같은 계정을 DB에 넣는다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkPasswordStrength, hashPassword } from "../src/lib/auth/password.mjs";

const [id, password] = process.argv.slice(2);
if (!id || !password) {
  console.error("사용법: node scripts/create-admin.mjs <아이디> <비밀번호>");
  process.exit(1);
}
const weak = checkPasswordStrength(password);
if (weak) {
  console.error(`비밀번호가 약합니다: ${weak}`);
  process.exit(1);
}
const dir = path.join(process.cwd(), ".data");
const file = path.join(dir, "admins.json");
let all = [];
try {
  all = JSON.parse(await readFile(file, "utf8"));
} catch {
  /* 처음 만든다 */
}
if (all.some((a) => a.id === id)) {
  console.error("이미 있는 아이디입니다.");
  process.exit(1);
}
await mkdir(dir, { recursive: true });
all.push({ id, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() });
await writeFile(file, JSON.stringify(all, null, 2), "utf8");
console.log(`관리자 '${id}' 계정을 만들었습니다.`);

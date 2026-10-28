// 사용: node scripts/restore.mjs <백업 폴더>   (서비스를 멈춘 뒤 실행. 기존 .data는 .data.before-restore-… 로 보관한다)
import path from "node:path";
import { restoreData } from "./backup-lib.mjs";

const from = process.argv[2];
if (!from) {
  console.error("사용법: node scripts/restore.mjs <백업 폴더>");
  process.exit(1);
}
const r = await restoreData(path.resolve(from), path.join(process.cwd(), ".data"));
console.log(`복구 완료: ${r.restored}${r.previous ? ` (이전 데이터: ${r.previous})` : ""}`);

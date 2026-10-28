// 사용: node scripts/backup.mjs [백업폴더=backups] [보관개수=14]   (하루 1회 이상 실행: docs/DEPLOY.md의 cron)
import path from "node:path";
import { backupData } from "./backup-lib.mjs";

const root = process.cwd();
const dest = await backupData(path.join(root, ".data"), path.resolve(process.argv[2] ?? "backups"), new Date(), Number(process.argv[3] ?? 14));
console.log(`백업 완료: ${dest}`);

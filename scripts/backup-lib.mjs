// 백업·복구 (SRS SR-NF-11: 일 1회 이상, RPO 24시간). 개발 중 로컬 데이터(.data)용이다.
// 데이터는 이미 암호화되어 저장되므로(주민등록번호 필드·업로드 파일) 복사본도 같은 보호를 받는다. 백업 폴더는 서버 밖에도 한 벌 더 둬야 한다.
// Supabase로 옮긴 뒤에는 Supabase 백업(유료 요금제의 일일 백업/PITR 또는 pg_dump + Storage 복사)으로 대체한다 — docs/DEPLOY.md.

import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const stamp = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;

/** src(데이터 폴더)를 destRoot/<시각>/ 으로 복사하고, 오래된 백업은 keep개만 남긴다. 만든 백업 폴더 경로를 돌려준다. */
export async function backupData(src, destRoot, now = new Date(), keep = 14) {
  await stat(src); // 원본이 없으면 오류
  const dest = path.join(destRoot, stamp(now));
  await mkdir(destRoot, { recursive: true });
  await cp(src, dest, { recursive: true });
  const all = (await readdir(destRoot)).filter((n) => /^\d{8}-\d{6}$/.test(n)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) {
    await rm(path.join(destRoot, old), { recursive: true, force: true });
  }
  return dest;
}

/** backupDir의 내용을 dest(데이터 폴더)로 되돌린다. 기존 dest는 dest.before-restore로 옮겨 둔다(되돌릴 수 있게). */
export async function restoreData(backupDir, dest, now = new Date()) {
  await stat(backupDir);
  let moved = null;
  try {
    await stat(dest);
    moved = `${dest}.before-restore-${stamp(now)}`;
    await cp(dest, moved, { recursive: true });
    await rm(dest, { recursive: true, force: true });
  } catch {
    /* 되돌릴 기존 데이터가 없다 */
  }
  await cp(backupDir, dest, { recursive: true });
  return { restored: dest, previous: moved };
}

// 관리자 계정의 로컬 파일 구현(개발용): .data/admins.json. 배포 전에 Supabase 구현으로 교체한다.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdminAccount, AdminStore } from "./admins";

export function createLocalAdminStore(dir = path.join(process.cwd(), ".data")): AdminStore {
  const file = path.join(dir, "admins.json");
  const read = async (): Promise<AdminAccount[]> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as AdminAccount[];
    } catch {
      return [];
    }
  };
  return {
    async get(id) {
      return (await read()).find((a) => a.id === id) ?? null;
    },
    async create(a) {
      const all = await read();
      if (all.some((x) => x.id === a.id)) throw new Error("이미 있는 관리자 아이디입니다.");
      await mkdir(dir, { recursive: true });
      await writeFile(file, JSON.stringify([...all, a], null, 2), "utf8");
    },
    async list() {
      return read();
    },
  };
}

// 용역비 내역의 로컬 파일 구현(개발용): .data/fees.json. 배포 전에 Supabase 구현으로 교체한다.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeeRecord } from "@/domain/fee-ledger";
import type { FeeStore } from "./fees";

export function createLocalFeeStore(dir = path.join(process.cwd(), ".data")): FeeStore {
  const file = path.join(dir, "fees.json");
  const read = async (): Promise<FeeRecord[]> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as FeeRecord[];
    } catch {
      return [];
    }
  };
  const write = async (all: FeeRecord[]) => {
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(all, null, 2), "utf8");
    await rename(tmp, file);
  };
  // 서로 다른 공사의 동시 쓰기가 같은 파일을 덮어쓰지 않도록 한 줄로 세운다
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    async get(id) {
      return (await read()).find((f) => f.projectId === id) ?? null;
    },
    put(fee) {
      return serial(async () => {
        const all = await read();
        await write([...all.filter((f) => f.projectId !== fee.projectId), fee]);
      });
    },
    async list() {
      return read();
    },
    remove(id) {
      return serial(async () => write((await read()).filter((f) => f.projectId !== id)));
    },
  };
}

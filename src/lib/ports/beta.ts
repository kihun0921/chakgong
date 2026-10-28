// 베타 기록 저장소 (SRS SR-NF-23, D-11): 공사별 보완 요구 횟수·수작업 비교·제출 가능 확인.
// 개발 중에는 로컬 파일(.data/beta.json), 배포 직전에 Supabase 구현으로 교체한다.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BetaNote } from "@/domain/beta";

export interface BetaStore {
  get(projectId: string): Promise<BetaNote | null>;
  put(note: BetaNote): Promise<void>;
  list(): Promise<BetaNote[]>;
}

export function createMemoryBetaStore(): BetaStore {
  const map = new Map<string, BetaNote>();
  return {
    async get(id) {
      return map.get(id) ?? null;
    },
    async put(n) {
      map.set(n.projectId, n);
    },
    async list() {
      return [...map.values()];
    },
  };
}

export function createLocalBetaStore(dir = path.join(process.cwd(), ".data")): BetaStore {
  const file = path.join(dir, "beta.json");
  const read = async (): Promise<BetaNote[]> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as BetaNote[];
    } catch {
      return [];
    }
  };
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async get(id) {
      return (await read()).find((n) => n.projectId === id) ?? null;
    },
    put(note) {
      const run = queue.then(async () => {
        const all = (await read()).filter((n) => n.projectId !== note.projectId);
        await mkdir(dir, { recursive: true });
        const tmp = `${file}.tmp`;
        await writeFile(tmp, JSON.stringify([...all, note], null, 2), "utf8");
        await rename(tmp, file);
      });
      queue = run.catch(() => undefined);
      return run;
    },
    async list() {
      return read();
    },
  };
}

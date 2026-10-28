// 기준정보 저장소와 로컬 파일 구현(개발용): .data/reference.json. 배포 전에 Supabase 구현으로 교체한다.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_REFERENCE, type ReferenceData } from "@/lib/reference/types";

export interface ReferenceStore {
  get(): Promise<ReferenceData>;
  /** 호출하는 쪽이 validateReference로 검사한 값만 넘긴다 */
  save(data: ReferenceData): Promise<void>;
}

export function createLocalReferenceStore(dir = path.join(process.cwd(), ".data")): ReferenceStore {
  const file = path.join(dir, "reference.json");
  return {
    async get() {
      try {
        return { ...DEFAULT_REFERENCE, ...(JSON.parse(await readFile(file, "utf8")) as Partial<ReferenceData>) };
      } catch {
        return DEFAULT_REFERENCE;
      }
    },
    async save(data) {
      await mkdir(dir, { recursive: true });
      await writeFile(file, JSON.stringify(data, null, 2), "utf8");
    },
  };
}

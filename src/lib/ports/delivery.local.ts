// 납품 이력의 로컬 파일 구현(개발용). 한 줄에 한 건(JSON Lines)으로 .data/delivery-log.jsonl에 쌓는다.
// 서버에서만 쓴다. Supabase 구현으로 교체하기 전까지만 쓴다.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DeliveryLog, DeliveryRecord } from "./delivery";

export function createLocalDeliveryLog(dir = path.join(process.cwd(), ".data")): DeliveryLog {
  const file = path.join(dir, "delivery-log.jsonl");
  const all = async (): Promise<DeliveryRecord[]> => {
    try {
      const text = await readFile(file, "utf8");
      return text
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as DeliveryRecord);
    } catch {
      return [];
    }
  };
  return {
    async record(r) {
      await mkdir(dir, { recursive: true });
      const row: DeliveryRecord = { ...r, at: r.at ?? new Date().toISOString() };
      await appendFile(file, `${JSON.stringify(row)}\n`, "utf8");
    },
    async list(projectId) {
      return (await all()).filter((x) => x.projectId === projectId);
    },
    async hasDelivered(projectId) {
      return (await all()).some((x) => x.projectId === projectId);
    },
  };
}

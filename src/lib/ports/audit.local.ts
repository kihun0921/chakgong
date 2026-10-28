// 이력의 로컬 파일 구현(개발용). 한 줄에 한 건(JSON Lines)으로 .data/audit-log.jsonl에 쌓는다.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AuditEntry, AuditLog } from "./audit";

export function createLocalAuditLog(dir = path.join(process.cwd(), ".data")): AuditLog {
  const file = path.join(dir, "audit-log.jsonl");
  const all = async (): Promise<AuditEntry[]> => {
    try {
      return (await readFile(file, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as AuditEntry);
    } catch {
      return [];
    }
  };
  return {
    async record(e) {
      await mkdir(dir, { recursive: true });
      await appendFile(file, `${JSON.stringify({ ...e, at: e.at ?? new Date().toISOString() })}\n`, "utf8");
    },
    async list(f) {
      return (await all()).filter((r) => (!f?.action || r.action === f.action) && (!f?.target || r.target === f.target));
    },
  };
}

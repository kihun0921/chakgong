// 알림 저장소 (SRS SR-NF-27, D-4): 이력(audit)을 쓰지 못한 순간처럼 이력에 남길 수 없는 일을 따로 보관한다.
// 개발 중에는 로컬 파일(.data/alerts.jsonl), 배포 단계에서 Supabase 구현과 바깥 알림 채널(메일 등)을 붙인다.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Alert } from "@/lib/monitor/alerts";
import type { AuditLog } from "./audit";

export interface AlertStore {
  add(a: Alert): Promise<void>;
  list(): Promise<Alert[]>;
}

export function createLocalAlertStore(dir = path.join(process.cwd(), ".data")): AlertStore {
  const file = path.join(dir, "alerts.jsonl");
  return {
    async add(a) {
      await mkdir(dir, { recursive: true });
      await appendFile(file, `${JSON.stringify(a)}\n`, "utf8");
    },
    async list() {
      try {
        return (await readFile(file, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Alert);
      } catch {
        return [];
      }
    },
  };
}

export function createMemoryAlertStore(): AlertStore {
  const rows: Alert[] = [];
  return {
    async add(a) {
      rows.push(a);
    },
    async list() {
      return [...rows];
    },
  };
}

/** 이력 기록이 실패하면 즉시 알림을 남기고 오류는 그대로 던진다 — 해당 동작도 실패한다 (D-4). */
export function withFailureAlert(audit: AuditLog, alerts: AlertStore): AuditLog {
  return {
    async record(e) {
      try {
        await audit.record(e);
      } catch (err) {
        await alerts
          .add({ kind: "audit.failure", message: `이력(${e.action})을 기록하지 못해 해당 동작을 중단했습니다.`, at: new Date().toISOString() })
          .catch(() => undefined);
        throw err;
      }
    },
    list: (f) => audit.list(f),
  };
}

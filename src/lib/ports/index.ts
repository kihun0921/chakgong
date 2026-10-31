// 서버에서 쓰는 저장소 연결 지점. 지금은 로컬 파일 구현이고, 배포 직전에 여기만 Supabase 구현으로 바꾼다 (docs/WAVES.md).

import { createLoginLimiter, type LoginLimiter } from "@/lib/auth/service";
import type { FeeDeps } from "@/lib/fees/service";
import type { ProjectDeps } from "@/lib/projects/service";
import type { AdminStore } from "./admins";
import { createLocalAdminStore } from "./admins.local";
import type { AuditLog } from "./audit";
import { createLocalAuditLog } from "./audit.local";
import { createLocalAlertStore, withFailureAlert, type AlertStore } from "./alerts";
import type { DeliveryLog } from "./delivery";
import { createLocalDeliveryLog } from "./delivery.local";
import type { BetaStore } from "./beta";
import { createLocalBetaStore } from "./beta";
import type { FeeStore } from "./fees";
import { createLocalFeeStore } from "./fees.local";
import type { FileStore, ProjectStore } from "./projects";
import { createLocalFileStore, createLocalProjectStore } from "./projects.local";
import { createLocalReferenceStore, type ReferenceStore } from "./reference.local";

// 개발 서버가 코드를 다시 불러와도 같은 인스턴스를 쓰도록 globalThis에 둔다
const g = globalThis as unknown as { __chakgong?: Record<string, unknown> };
const cache = (g.__chakgong ??= {});
const once = <T,>(key: string, make: () => T): T => (cache[key] ??= make()) as T;

export const getDeliveryLog = (): DeliveryLog => once("delivery", createLocalDeliveryLog);
export const getAlertStore = (): AlertStore => once("alerts", createLocalAlertStore);
export const getAuditLog = (): AuditLog => once("audit", () => withFailureAlert(createLocalAuditLog(), getAlertStore()));
export const getAdminStore = (): AdminStore => once("admins", createLocalAdminStore);
export const getProjectStore = (): ProjectStore => once("projects", createLocalProjectStore);
export const getFileStore = (): FileStore => once("files", createLocalFileStore);
export const getReferenceStore = (): ReferenceStore => once("reference", createLocalReferenceStore);
export const getFeeStore = (): FeeStore => once("fees", createLocalFeeStore);
export const getBetaStore = (): BetaStore => once("beta", createLocalBetaStore);
export const getLoginLimiter = (): LoginLimiter => once("limiter", () => createLoginLimiter());

export const getProjectDeps = (): ProjectDeps => ({
  projects: getProjectStore(),
  files: getFileStore(),
  audit: getAuditLog(),
});

export const getFeeDeps = (): FeeDeps => ({
  fees: getFeeStore(),
  delivery: getDeliveryLog(),
  audit: getAuditLog(),
  reference: getReferenceStore(),
  projects: getProjectStore(),
});

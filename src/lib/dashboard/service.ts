// 대시보드 데이터 (SRS SR-ADM-01·05): 합계와 목록이 같은 용역비 내역에서 나온다.

import { refundAlert, summarizeFees, type FeeRecord, type FeeSummary, type RefundAlert } from "@/domain/fee-ledger";
import { evaluateAlerts, type Alert } from "@/lib/monitor/alerts";
import type { AlertStore } from "@/lib/ports/alerts";
import { findInconsistencies, type FeeDeps } from "@/lib/fees/service";
import { retentionReport, type RetentionReport } from "@/lib/fees/pricing";
import type { ProjectStore } from "@/lib/ports/projects";
import { computeMetrics, type OpsMetrics } from "./metrics";

export type DashboardRow = { fee: FeeRecord; projectName: string; alert: RefundAlert };
export type Dashboard = {
  from: string;
  to: string;
  summary: FeeSummary;
  rows: DashboardRow[];
  metrics: OpsMetrics;
  alerts: Alert[];
  inconsistencies: { projectId: string; projectName: string; message: string }[];
  retention: RetentionReport;
};

export async function loadDashboard(
  deps: FeeDeps & { projects: ProjectStore; alerts: AlertStore },
  from: string,
  to: string,
  today: string,
): Promise<Dashboard> {
  const fees = await deps.fees.list();
  const names = new Map((await deps.projects.list()).map((p) => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? "(삭제된 공사)";
  const summary = summarizeFees(fees, from, to, today);
  const rows = fees
    .filter((f) => f.createdAt >= from && f.createdAt <= to)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((fee) => ({ fee, projectName: nameOf(fee.projectId), alert: refundAlert(fee, today) }));
  const inconsistencies = (await findInconsistencies(deps)).map((x) => ({ ...x, projectName: nameOf(x.projectId) }));
  const entries = await deps.audit.list();
  const alerts = evaluateAlerts(entries, new Date(), await deps.alerts.list());
  const retention = await retentionReport(deps, today);
  return { from, to, summary, rows, metrics: computeMetrics(entries, from, to), alerts, inconsistencies, retention };
}

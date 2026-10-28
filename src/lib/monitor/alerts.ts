// 알림 판단 (SRS SR-NF-27~31, D-4·D-5): 이력(audit)을 보고 지금 알려야 할 것을 순수하게 계산한다.
// 알림은 대시보드 맨 위에 표시한다. 메일·메신저 같은 바깥 알림 채널은 배포 단계에서 이 결과를 보내도록 붙인다.

import type { AuditEntry } from "@/lib/ports/audit";

export type Alert = {
  kind: "audit.failure" | "slow" | "pii.bulk" | "fee.duplicate";
  message: string;
  at: string;
};

/** 연속 발생 기준(D-5) */
export const CONSECUTIVE = 3;
/** 개인정보 대량 조회·출력 기준: 관리자당 1시간 20건 초과(D-5) */
export const PII_LIMIT_PER_HOUR = 20;
/** 성능 한도(ms): 초안 5분, 800행 처리 30초 (SR-NF-01·02) */
export const LIMITS_MS = { draft: 5 * 60_000, export: 30_000 } as const;
const LABEL = { draft: "초안 생성(5분)", export: "출력 처리(30초)" } as const;
const HOUR = 3_600_000;

export function evaluateAlerts(entries: AuditEntry[], now: Date, stored: Alert[] = []): Alert[] {
  const alerts: Alert[] = [...stored];

  // 개인정보 대량 출력: 최근 1시간, 관리자별 건수 합계 (SR-NF-30)
  const perUser = new Map<string, number>();
  for (const e of entries) {
    if (e.action !== "pii.export") continue;
    if (now.getTime() - new Date(e.at).getTime() > HOUR) continue;
    perUser.set(e.user, (perUser.get(e.user) ?? 0) + (typeof e.detail?.count === "number" ? e.detail.count : 1));
  }
  for (const [user, n] of perUser) {
    if (n > PII_LIMIT_PER_HOUR) {
      alerts.push({ kind: "pii.bulk", message: `관리자 '${user}'가 최근 1시간에 개인정보 ${n}건을 출력했습니다(기준 ${PII_LIMIT_PER_HOUR}건).`, at: now.toISOString() });
    }
  }

  // 성능 한도 연속 초과: 같은 지표의 최근 3건이 모두 넘으면 (SR-NF-28)
  for (const metric of Object.keys(LIMITS_MS) as (keyof typeof LIMITS_MS)[]) {
    const recent = entries.filter((e) => e.action === "perf" && e.detail?.metric === metric).slice(-CONSECUTIVE);
    if (recent.length === CONSECUTIVE && recent.every((e) => Number(e.detail?.ms) > LIMITS_MS[metric])) {
      alerts.push({ kind: "slow", message: `${LABEL[metric]} 한도를 연속 ${CONSECUTIVE}회 넘었습니다.`, at: recent[CONSECUTIVE - 1].at });
    }
  }

  // 입금 확인 중복 기록 시도 (SR-NF-31): 최근 24시간
  for (const e of entries) {
    if (e.action === "fee.payment.rejected" && e.detail?.reason === "duplicate" && now.getTime() - new Date(e.at).getTime() <= 24 * HOUR) {
      alerts.push({ kind: "fee.duplicate", message: `이미 입금 완료인 공사에 입금 확인을 다시 기록하려 했습니다(${e.user}).`, at: e.at });
    }
  }
  return alerts.sort((a, b) => b.at.localeCompare(a.at));
}

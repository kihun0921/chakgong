// 운영 지표 (SRS SR-ADM-02): 이력(audit)에서 계산한다. 기록이 없는 지표는 null(집계 전)로 둔다.
// 나라장터 API 성공률은 API 연결 전이라 집계하지 않는다. 재계산 시간은 브라우저에서 일어나 성능 시험(perf.test.ts)으로 확인한다.

import type { AuditEntry } from "@/lib/ports/audit";

export type OpsMetrics = {
  parse: {
    attempts: number;
    /** 수동 보정 없이 한 번에 읽은 비율(0~1). 시도가 없으면 null */
    autoRate: number | null;
    /** 열 위치를 직접 지정해야 했던 비율(0~1) */
    manualRate: number | null;
    errors: number;
  };
  /** 출력 거절 사유별 건수(검증 코드) */
  validationFailures: Record<string, number>;
  draft: { started: number; ready: number };
  /** 시작부터 첫 납품까지 평균 초. 없으면 null */
  draftSeconds: number | null;
  /** 재계산은 브라우저에서 일어나 서버가 재지 않는다(시험으로 확인) */
  recalcSeconds: null;
  /** 시작한 공사 중 5분 안에 검증 통과 초안이 나온 비율(0~1) */
  kpi5min: number | null;
  naraApiSuccessRate: null;
};

const inRange = (e: AuditEntry, from: string, to: string) => {
  const d = e.at.slice(0, 10);
  return d >= from && d <= to;
};

export function computeMetrics(entries: AuditEntry[], from: string, to: string): OpsMetrics {
  let auto = 0;
  let mapped = 0;
  let errors = 0;
  let started = 0;
  const readyMs: number[] = [];
  const validationFailures: Record<string, number> = {};
  for (const e of entries) {
    if (!inRange(e, from, to)) continue;
    if (e.action === "budget.parse") {
      const o = e.detail?.outcome;
      if (o === "auto") auto++;
      else if (o === "mapped") mapped++;
      else if (o === "error") errors++;
    } else if (e.action === "draft.start") started++;
    else if (e.action === "draft.ready") readyMs.push(Number(e.detail?.ms) || 0);
    else if (e.action === "export.rejected") {
      for (const c of (e.detail?.codes as string[] | undefined) ?? []) validationFailures[c] = (validationFailures[c] ?? 0) + 1;
    }
  }
  const attempts = auto + mapped + errors;
  return {
    parse: {
      attempts,
      autoRate: attempts === 0 ? null : auto / attempts,
      manualRate: auto + mapped === 0 ? null : mapped / (auto + mapped),
      errors,
    },
    validationFailures,
    draft: { started, ready: readyMs.length },
    draftSeconds: readyMs.length === 0 ? null : readyMs.reduce((a, b) => a + b, 0) / readyMs.length / 1000,
    recalcSeconds: null,
    kpi5min: started === 0 ? null : readyMs.filter((ms) => ms <= 300_000).length / started,
    naraApiSuccessRate: null,
  };
}

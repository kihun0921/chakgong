// 보할·구간별 진도율 (SRS SR-PG-01~03, 6.1~6.2)
// 내부 계산은 반올림하지 않는다. 표시할 때만 round2를 쓴다.

import { addDays, diffDays, type DateStr, type Period } from "./calendar";

export type Process = {
  key: string;
  name: string;
  /** 공정 순공사비(원). 0원이면 금액 없이 협조 구간으로만 표시한다 (SR-SC-04). 음수(고재처리 등)도 가능하다. */
  amount: number;
  /** 착수 일차(착공일 = 1일차) */
  startDay: number;
  /** 완료 일차 */
  endDay: number;
};

export type ProgressRow = {
  key: string;
  weight: number; // 보할(%)
  byPeriod: number[]; // 구간별 진도율(%)
};

export type ProgressTable = {
  rows: ProgressRow[];
  periodTotals: number[];
  cumulative: number[];
};

/** 표시용: 소수 둘째 자리 반올림 */
export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function checkProcess(p: Process): void {
  if (!Number.isInteger(p.startDay) || !Number.isInteger(p.endDay) || p.startDay < 1) {
    throw new RangeError(`공정 ${p.key}: 착수·완료 일차는 1 이상의 정수여야 합니다.`);
  }
  if (p.startDay > p.endDay) {
    throw new RangeError(`공정 ${p.key}: 착수일차가 완료일차보다 클 수 없습니다.`);
  }
  // 음수 금액도 허용한다: 고재처리(고철·폐자재 매각)처럼 순공사비를 줄이는 항목이 있다
  if (!Number.isFinite(p.amount)) {
    throw new RangeError(`공정 ${p.key}: 금액이 숫자가 아닙니다.`);
  }
}

export function progressTable(
  processes: readonly Process[],
  periods: readonly Period[],
  projectStart: DateStr,
): ProgressTable {
  processes.forEach(checkProcess);
  const total = processes.reduce((s, p) => s + p.amount, 0);

  const rows: ProgressRow[] = processes.map((p) => {
    const weight = total === 0 ? 0 : (p.amount / total) * 100;
    const s = addDays(projectStart, p.startDay - 1);
    const e = addDays(projectStart, p.endDay - 1);
    const length = diffDays(s, e) + 1;
    const byPeriod = periods.map((per) => {
      if (weight === 0) return 0;
      const from = per.start > s ? per.start : s;
      const to = per.end < e ? per.end : e;
      const overlap = Math.max(0, diffDays(from, to) + 1);
      return (weight * overlap) / length;
    });
    return { key: p.key, weight, byPeriod };
  });

  const periodTotals = periods.map((_, k) => rows.reduce((s, r) => s + r.byPeriod[k], 0));
  const cumulative: number[] = [];
  periodTotals.reduce((acc, v) => {
    const next = acc + v;
    cumulative.push(next);
    return next;
  }, 0);

  return { rows, periodTotals, cumulative };
}

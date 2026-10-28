// 공정·일정·보할·인원·장비·검증을 한 번에 계산한다 (SRS SR-PG-04, SR-VR-07).
// 같은 입력이면 항상 같은 결과다(SR-NF-08). 입력을 바꾸면 이 함수를 다시 부르면 된다.

import {
  completionDate,
  buildPeriods,
  periodWorkdays,
  type DateStr,
  type Period,
} from "./calendar";
import { dailyAverage, distributeResources, type ResourceLine, type ResourcePlan } from "./labor";
import { progressTable, type Process, type ProgressTable } from "./progress";
import { validateCore, type ValidationResult } from "./validation";

export type PlanInput = {
  start: DateStr;
  durationDays: number;
  holidays: ReadonlySet<DateStr>;
  processes: Process[];
  laborLines: ResourceLine[];
  equipmentLines: ResourceLine[];
  /** 집계표 순공사비 합계(원) */
  summaryTotalWon: number;
};

export type PlanResult = {
  completion: DateStr;
  periods: Period[];
  progress: ProgressTable;
  labor: ResourcePlan;
  equipment: ResourcePlan;
  /** 구간별 일평균 투입인원. 작업일수가 0이면 null */
  dailyAverage: (number | null)[];
  /** 구간별 공기 내 작업일수 (일평균 계산의 분모) */
  workdays: number[];
  validation: ValidationResult;
};

const sum = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0);

export function computePlan(input: PlanInput): PlanResult {
  const completion = completionDate(input.start, input.durationDays);
  const periods = buildPeriods(input.start, input.durationDays);
  const progress = progressTable(input.processes, periods, input.start);

  const labor = distributeResources(
    input.laborLines,
    input.processes,
    periods,
    input.start,
    input.holidays,
  );
  const equipment = distributeResources(
    input.equipmentLines,
    input.processes,
    periods,
    input.start,
    input.holidays,
  );

  const workdays = periods.map((p) => periodWorkdays(p, input.start, input.durationDays, input.holidays));
  const daily = periods.map((_, k) =>
    dailyAverage(
      labor.periodTotals[k],
      workdays[k],
    ),
  );

  // V-3의 세 합계: 공정표(직종별 행 합), 투입계획표(구간 합), 산정근거(라인 합)
  const totals = (r: ResourcePlan) => ({
    schedule: sum(Object.values(r.byName).map((row) => sum(row))),
    plan: sum(r.periodTotals),
    basis: sum(r.basisList.map((b) => b.manDays)),
  });

  const validation = validateCore({
    processTotalWon: sum(input.processes.map((p) => p.amount)),
    summaryTotalWon: input.summaryTotalWon,
    cumulativeLast: progress.cumulative.at(-1) ?? 0,
    laborTotals: totals(labor),
    equipmentTotals: totals(equipment),
    processes: input.processes.map((p) => ({ key: p.key, endDay: p.endDay })),
    durationDays: input.durationDays,
  });

  return { completion, periods, progress, labor, equipment, dailyAverage: daily, workdays, validation };
}

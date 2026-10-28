// 인원·장비 산정 (SRS SR-RS-01~07, 6.4~6.7)
// 우선순위: 내역서 수량 → 노무비 환산 → 생산성 → 직접 지정. 환산·생산성·직접 지정은 '가정'으로 표시한다.

import { dayToDate, distributeOverPeriods } from "./allocation";
import type { DateStr, Period } from "./calendar";

/** 산정 방식(SR-RS-02): 내역서 / 환산 / 생산성 / 가정 */
export type LaborMethod = "내역서" | "환산" | "생산성" | "가정";

export type ManDaysInput =
  | { kind: "budgetQty"; trade: string; manDays: number }
  | { kind: "laborCost"; trade: string; laborCost: number; share: number; wage: number }
  | { kind: "direct"; trade: string; perDay: number; workdays: number };

export type ManDaysResult = { trade: string; manDays: number; method: LaborMethod; basis: string };

const won = (n: number) => n.toLocaleString("ko-KR");

function mustBe(cond: boolean, msg: string): void {
  if (!cond) throw new RangeError(msg);
}

export function calcManDays(input: ManDaysInput): ManDaysResult {
  switch (input.kind) {
    case "budgetQty": {
      mustBe(Number.isFinite(input.manDays) && input.manDays >= 0, "내역서 수량은 0 이상이어야 합니다.");
      return {
        trade: input.trade,
        manDays: input.manDays,
        method: "내역서",
        basis: "내역서 노무비 행의 수량",
      };
    }
    case "laborCost": {
      mustBe(Number.isFinite(input.laborCost) && input.laborCost >= 0, "노무비는 0 이상이어야 합니다.");
      mustBe(input.share >= 0 && input.share <= 1, "직종 배분율은 0~1 사이여야 합니다.");
      mustBe(Number.isFinite(input.wage) && input.wage > 0, "노임단가는 0보다 커야 합니다.");
      const manDays = Math.round((input.laborCost * input.share) / input.wage);
      return {
        trade: input.trade,
        manDays,
        method: "환산",
        basis: `노무비 ${won(input.laborCost)}원 × 배분율 ${input.share} ÷ 노임단가 ${won(input.wage)}원`,
      };
    }
    case "direct": {
      mustBe(input.perDay >= 0 && input.workdays >= 0, "인원/일과 작업일수는 0 이상이어야 합니다.");
      return {
        trade: input.trade,
        manDays: input.perDay * input.workdays,
        method: "가정",
        basis: `직접 지정: ${input.perDay}명/일 × 작업일수 ${input.workdays}일`,
      };
    }
  }
}

export type ProductivitySplit = {
  total: number;
  byTrade: Record<string, number>;
  method: LaborMethod;
  basis: string;
};

/**
 * 생산성 방식: 총 인일 = round(Σ 물량 × 생산성)을 직종 배분율로 나눈다.
 * 반올림 오차는 remainderTrade(보통인부)에 반영해 공정 총량을 보존한다 (6.4).
 */
export function splitProductivity(input: {
  items: { quantity: number; productivity: number }[];
  shares: { trade: string; share: number }[];
  remainderTrade: string;
}): ProductivitySplit {
  const raw = input.items.reduce((s, i) => s + i.quantity * i.productivity, 0);
  mustBe(Number.isFinite(raw) && raw >= 0, "물량 × 생산성 합계가 올바르지 않습니다.");
  const total = Math.round(raw);
  const byTrade: Record<string, number> = {};
  let used = 0;
  for (const { trade, share } of input.shares) {
    mustBe(share >= 0 && share <= 1, "직종 배분율은 0~1 사이여야 합니다.");
    const v = Math.round(total * share);
    byTrade[trade] = v;
    used += v;
  }
  const remainder = total - used;
  mustBe(remainder >= 0, "직종 배분율 합이 너무 커서 보통인부 몫이 음수가 됩니다.");
  byTrade[input.remainderTrade] = (byTrade[input.remainderTrade] ?? 0) + remainder;
  return {
    total,
    byTrade,
    method: "가정",
    basis: `생산성 방식: Σ(물량 × 생산성) = ${raw}를 반올림해 ${total}인일, 직종 배분 후 오차는 ${input.remainderTrade}에 반영`,
  };
}

/** 내역서 장비(HR)는 대·일 = 올림(HR ÷ 8) (6.6) */
export function equipmentDaysFromHours(hours: number): number {
  mustBe(Number.isFinite(hours) && hours >= 0, "장비 시간(HR)은 0 이상이어야 합니다.");
  return Math.ceil(hours / 8);
}

export type ResourceLine = {
  processKey: string;
  /** 직종명 또는 장비명 */
  name: string;
  /** 인일 또는 대·일(정수) */
  manDays: number;
  method: LaborMethod;
  basis: string;
};

export type ResourcePlan = {
  byName: Record<string, number[]>;
  periodTotals: number[];
  total: number;
  /** 내역서가 아닌 방식(환산·생산성·가정)으로 만든 값의 합 (가정 비중 표시용) */
  assumedTotal: number;
  /** 산정근거 목록 (SR-RS-07) */
  basisList: { processKey: string; name: string; method: LaborMethod; manDays: number; basis: string }[];
};

/** 공정별 총량을 구간에 배분해 직종(장비)별로 합친다 (SR-RS-04). */
export function distributeResources(
  lines: readonly ResourceLine[],
  processes: readonly { key: string; startDay: number; endDay: number }[],
  periods: readonly Period[],
  projectStart: DateStr,
  holidays: ReadonlySet<DateStr>,
): ResourcePlan {
  const byName: Record<string, number[]> = {};
  const periodTotals = periods.map(() => 0);
  let total = 0;
  let assumedTotal = 0;

  for (const line of lines) {
    const proc = processes.find((p) => p.key === line.processKey);
    if (!proc) throw new Error(`산정 라인이 없는 공정을 가리킵니다: ${line.processKey}`);
    if (!Number.isInteger(line.manDays) || line.manDays < 0) {
      throw new RangeError(`${line.name}: 인일·대·일은 0 이상의 정수여야 합니다(${line.manDays}).`);
    }
    const from = dayToDate(projectStart, proc.startDay);
    const to = dayToDate(projectStart, proc.endDay);
    const dist = distributeOverPeriods(line.manDays, from, to, periods, holidays);
    const row = (byName[line.name] ??= periods.map(() => 0));
    dist.forEach((v, k) => {
      row[k] += v;
      periodTotals[k] += v;
    });
    total += line.manDays;
    if (line.method !== "내역서") assumedTotal += line.manDays;
  }

  return {
    byName,
    periodTotals,
    total,
    assumedTotal,
    basisList: lines.map((l) => ({
      processKey: l.processKey,
      name: l.name,
      method: l.method,
      manDays: l.manDays,
      basis: l.basis,
    })),
  };
}

/** 구간 일평균 = 구간 소계 ÷ 공기 내 작업일수. 작업일수가 0이면 빈칸(null) (SR-RS-06, 6.7) */
export function dailyAverage(periodTotal: number, workdays: number): number | null {
  return workdays === 0 ? null : periodTotal / workdays;
}


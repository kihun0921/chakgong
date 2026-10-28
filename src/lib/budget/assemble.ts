// 파싱 결과 → 계산 입력 조립 (SRS SR-SC-01·03·04, SR-RS-01·05)
// 집계표 공종마다 공정을 만들고, 내역서 노무·장비 행을 산정 라인으로 바꾼다.

import type { DateStr } from "@/domain/calendar";
import { calcManDays, equipmentDaysFromHours, type ResourceLine } from "@/domain/labor";
import type { PlanInput } from "@/domain/plan";
import type { Process } from "@/domain/progress";
import { defaultComposition, routeLine, type Composition } from "@/lib/work/composition";
import type { ParsedBudget } from "./parse";

export type PlanSettings = {
  start: DateStr;
  durationDays: number;
  holidays: ReadonlySet<DateStr>;
  /** 공종코드별 착수·완료 일차. 지정하지 않으면 전체 공기(1~공기)로 둔다. */
  schedule?: Record<string, { startDay: number; endDay: number }>;
  /** 공정 구성(나누기·합치기를 반영한 공정 목록). 없으면 집계표 공종마다 공정 하나 */
  composition?: Composition;
};

export type AssembleResult = {
  input: PlanInput;
  /** 금액이 0원이라 협조 구간으로만 표시할 공정의 키 (SR-SC-04) */
  cooperationKeys: string[];
  /** 집계표에 없는 공종코드를 가리켜서 조립하지 못한 행 */
  unmatched: { code: string; name: string }[];
  warnings: string[];
};

export function assemblePlanInput(parsed: ParsedBudget, settings: PlanSettings): AssembleResult {
  const warnings: string[] = [];

  const comp = settings.composition ?? defaultComposition(parsed);
  const processes: Process[] = comp.map((def) => {
    const sch = settings.schedule?.[def.id];
    return {
      key: def.id,
      name: def.name,
      amount: def.amount,
      startDay: sch?.startDay ?? 1,
      endDay: sch?.endDay ?? settings.durationDays,
    };
  });
  const keys = new Set(processes.map((p) => p.key));
  const cooperationKeys = processes.filter((p) => p.amount === 0).map((p) => p.key);

  const unmatched: { code: string; name: string }[] = [];

  const laborLines: ResourceLine[] = [];
  for (const row of parsed.labor) {
    const key = routeLine(parsed, comp, row);
    if (key === undefined || !keys.has(key)) {
      unmatched.push({ code: row.code, name: row.trade });
      continue;
    }
    let manDays = row.quantity;
    if (!Number.isInteger(manDays)) {
      manDays = Math.round(manDays);
      if (row.source !== "일위대가") warnings.push(`노무 '${row.trade}'의 수량 ${row.quantity}이 소수라 ${manDays}로 반올림했습니다.`);
    }
    const r = calcManDays({ kind: "budgetQty", trade: row.trade, manDays });
    laborLines.push({
      processKey: key,
      name: row.trade,
      manDays: r.manDays,
      method: r.method,
      basis: row.source === "일위대가" ? "일위대가 노임÷단가 × 내역 수량" : r.basis,
    });
  }

  const equipmentLines: ResourceLine[] = [];
  for (const row of parsed.equipment) {
    const key = routeLine(parsed, comp, row);
    if (key === undefined || !keys.has(key)) {
      unmatched.push({ code: row.code, name: row.name });
      continue;
    }
    const days = equipmentDaysFromHours(row.hours);
    equipmentLines.push({
      processKey: key,
      name: row.name,
      manDays: days,
      method: "내역서",
      basis: `내역서 ${row.hours}HR ÷ 8 올림 = ${days}대·일`,
    });
  }
  if (unmatched.length > 0) {
    warnings.push(`집계표에 없는 공종코드를 가리키는 행 ${unmatched.length}개는 제외했습니다. 확인이 필요합니다.`);
  }

  return {
    input: {
      start: settings.start,
      durationDays: settings.durationDays,
      holidays: settings.holidays,
      processes,
      laborLines,
      equipmentLines,
      summaryTotalWon: parsed.grandTotal ?? parsed.summaryTotal,
    },
    cooperationKeys,
    unmatched,
    warnings,
  };
}

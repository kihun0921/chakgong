// 화면 입력(문자열)을 계산 입력으로 바꿔 계산한다 (SRS SR-PG-04, SR-RS-01, SR-VR-07).
// 브라우저에서 바로 다시 계산해 3초 이내 갱신을 지킨다. 계산 규칙은 src/domain에만 있다.

import { parseDate, type DateStr } from "@/domain/calendar";
import { calcManDays, type ResourceLine } from "@/domain/labor";
import { computePlan, type PlanResult } from "@/domain/plan";
import type { Process } from "@/domain/progress";
import { assemblePlanInput } from "@/lib/budget/assemble";
import type { ParsedBudget } from "@/lib/budget/parse";
import type { LocationSpan } from "@/domain/documents/model";
import { defaultComposition, type Composition } from "./composition";

/**
 * 직접 지정(가정) 인원·장비 한 줄. 산정 방식(SR-RS-01):
 *  - perDay(기본): 인원/일(장비는 대수) × 일수
 *  - cost(환산): 공정 노무비 × 직종 배분율 ÷ 노임단가 (인원만)
 *  - qty(생산성): 물량 × 생산성(인일/단위) × 직종 배분율 (인원만)
 *  - days: 인일(대·일)을 직접 입력
 */
export type ExtraLine = {
  id: number;
  processKey: string;
  name: string;
  /** 인원/일 (장비는 대수) */
  perDay: number;
  workdays: number;
  mode?: "perDay" | "cost" | "qty" | "days";
  /** cost·qty: 직종 배분율(0~1) */
  share?: number;
  /** cost: 노임단가(원/일) */
  wage?: number;
  /** qty: 물량과 생산성(인일/단위) */
  quantity?: number;
  productivity?: number;
  /** days: 인일 또는 대·일 */
  manDays?: number;
};

export type BuildPlanInput = {
  parsed: ParsedBudget | null;
  startDate: string;
  durationDays: string;
  holidaysText: string;
  schedule: Record<string, { startDay: number; endDay: number }>;
  /** 공정 구성. 없으면 집계표 공종마다 공정 하나 */
  composition?: Composition | null;
  /** 공정표 '주요 공정내용' (공정 키 → 글) */
  remarks?: Record<string, string>;
  /** 투입계획표 '위치별' 작업 구간 */
  locations?: LocationSpan[];
  extraLabor: ExtraLine[];
  extraEquipment: ExtraLine[];
};

export type BuildPlanOutput = {
  /** 계산에 쓴 공정 목록(일정 포함) */
  processes: Process[];
  result?: PlanResult;
  /** 협조 구간(0원) 공정 키 */
  cooperationKeys: string[];
  warnings: string[];
  error?: string;
};

export function parseHolidays(text: string): { dates: Set<DateStr>; invalid: string[] } {
  const dates = new Set<DateStr>();
  const invalid: string[] = [];
  for (const token of text.split(/[\s,]+/).filter(Boolean)) {
    try {
      parseDate(token);
      dates.add(token);
    } catch {
      invalid.push(token);
    }
  }
  return { dates, invalid };
}

export function extraToLines(lines: ExtraLine[], comp: Composition, warnings: string[]): ResourceLine[] {
  const out: ResourceLine[] = [];
  const skip = (l: ExtraLine, why: string) => warnings.push(`직접 지정 '${l.name || "(이름 없음)"}': ${why} 제외했습니다.`);
  for (const l of lines) {
    if (l.name.trim() === "") {
      skip(l, "이름이 비어 있어");
      continue;
    }
    const mode = l.mode ?? "perDay";
    try {
      if (mode === "cost") {
        const def = comp.find((d) => d.id === l.processKey);
        if (!def) throw new RangeError("공정을 찾을 수 없어");
        const r = calcManDays({ kind: "laborCost", trade: l.name, laborCost: def.laborCost, share: l.share ?? 0, wage: l.wage ?? 0 });
        out.push({ processKey: l.processKey, name: l.name, manDays: r.manDays, method: r.method, basis: r.basis });
      } else if (mode === "qty") {
        const q = l.quantity ?? 0;
        const pr = l.productivity ?? 0;
        const share = l.share ?? 1;
        if (!(q >= 0 && pr >= 0 && share >= 0 && share <= 1)) throw new RangeError("물량·생산성·배분율이 올바르지 않아");
        const manDays = Math.round(q * pr * share);
        out.push({
          processKey: l.processKey,
          name: l.name,
          manDays,
          method: "생산성",
          basis: `생산성 방식: 물량 ${q} × 생산성 ${pr}인일 × 배분율 ${share} = ${manDays}인일`,
        });
      } else if (mode === "days") {
        const manDays = l.manDays ?? 0;
        if (!Number.isInteger(manDays) || manDays < 0) throw new RangeError("값이 0 이상의 정수가 아니어서");
        out.push({ processKey: l.processKey, name: l.name, manDays, method: "가정", basis: `직접 지정: ${manDays} 직접 입력` });
      } else {
        const manDays = l.perDay * l.workdays;
        if (!Number.isInteger(manDays) || manDays < 0) throw new RangeError("값이 정수가 아니어서(인원/일 × 일수는 정수여야 합니다)");
        const r = calcManDays({ kind: "direct", trade: l.name, perDay: l.perDay, workdays: l.workdays });
        out.push({ processKey: l.processKey, name: l.name, manDays: r.manDays, method: r.method, basis: r.basis });
      }
    } catch (e) {
      skip(l, `${e instanceof Error ? e.message : "계산할 수 없어"}`);
    }
  }
  return out;
}

export function buildPlan(input: BuildPlanInput): BuildPlanOutput {
  const warnings: string[] = [];
  if (!input.parsed) return { processes: [], cooperationKeys: [], warnings };

  if (input.startDate === "") return { processes: [], cooperationKeys: [], warnings, error: "착공일을 입력해 주세요(1장 공사·계약 정보)." };
  try {
    parseDate(input.startDate);
  } catch {
    return { processes: [], cooperationKeys: [], warnings, error: "착공일 형식이 올바르지 않습니다." };
  }
  const duration = Number(input.durationDays);
  if (!Number.isInteger(duration) || duration < 1) {
    return { processes: [], cooperationKeys: [], warnings, error: "공사기간은 1 이상의 정수(일)로 입력해 주세요." };
  }

  const holidays = parseHolidays(input.holidaysText);
  if (holidays.invalid.length > 0) {
    warnings.push(`날짜로 읽지 못한 공휴일 입력: ${holidays.invalid.join(", ")}`);
  }

  try {
    const comp = input.composition ?? defaultComposition(input.parsed);
    const assembled = assemblePlanInput(input.parsed, {
      start: input.startDate,
      durationDays: duration,
      holidays: holidays.dates,
      schedule: input.schedule,
      composition: comp,
    });
    warnings.push(...assembled.warnings);
    assembled.input.laborLines.push(...extraToLines(input.extraLabor, comp, warnings));
    assembled.input.equipmentLines.push(...extraToLines(input.extraEquipment, comp, warnings));
    return {
      processes: assembled.input.processes,
      result: computePlan(assembled.input),
      cooperationKeys: assembled.cooperationKeys,
      warnings,
    };
  } catch (e) {
    return {
      processes: [],
      cooperationKeys: [],
      warnings,
      error: e instanceof Error ? e.message : "계산 중 오류가 났습니다.",
    };
  }
}

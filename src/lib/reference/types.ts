// 기준정보 (SRS SR-DM-02~04): 직종·노임단가·장비·생산성·일정 템플릿·공휴일·서류 템플릿·용역비 금액.
// 관리자가 화면에서 고치면 코드 수정 없이 이후 계산에 반영된다. 실제 값은 샘플·기준 데이터를 받는 대로 채운다.

import { parseDate } from "@/domain/calendar";

export const WORK_TYPES = ["기계설비", "건축", "토목", "조경", "전기"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export type ScheduleTemplateItem = { keyword: string; startPct: number; endPct: number };

export type ReferenceData = {
  trades: { name: string; wage: number }[];
  equipment: { name: string }[];
  productivity: { name: string; unit: string; manDaysPerUnit: number }[];
  scheduleTemplates: { workType: WorkType; items: ScheduleTemplateItem[] }[];
  /** 공휴일(yyyy-mm-dd). 연 1회 수동 갱신 */
  holidays: string[];
  /** 서류 템플릿(고정 문안 등록용). 서식 샘플을 받으면 여기에 문안을 등록한다 */
  documentTemplates: { key: string; name: string; body: string }[];
  /** 용역비 공급가액(원). 부가세 10%는 따로 계산한다 (SR-FEE-01) */
  feeSupply: number;
};

export const DEFAULT_REFERENCE: ReferenceData = {
  trades: [],
  equipment: [],
  productivity: [],
  scheduleTemplates: WORK_TYPES.map((workType) => ({ workType, items: [] })),
  holidays: [],
  documentTemplates: [],
  feeSupply: 500_000,
};

export type ValidationOutcome = { ok: true; data: ReferenceData } | { ok: false; errors: string[] };

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** 서버에서 저장 전에 검사한다. 화면 입력을 믿지 않는다 (AC-F8-1). */
export function validateReference(input: unknown): ValidationOutcome {
  const errors: string[] = [];
  const o = (input ?? {}) as Partial<ReferenceData>;
  const list = <T,>(v: unknown, label: string): T[] => {
    if (!Array.isArray(v)) {
      errors.push(`${label} 형식이 올바르지 않습니다.`);
      return [];
    }
    return v as T[];
  };
  const uniq = (names: string[], label: string) => {
    if (names.some((n) => n.trim() === "")) errors.push(`${label}: 이름이 빈 항목이 있습니다.`);
    const set = new Set(names.map((n) => n.trim()));
    if (set.size !== names.length) errors.push(`${label}: 이름이 겹치는 항목이 있습니다.`);
  };

  const trades = list<ReferenceData["trades"][number]>(o.trades, "직종");
  uniq(trades.map((t) => String(t.name ?? "")), "직종");
  trades.forEach((t) => {
    if (!isInt(t.wage)) errors.push(`직종 '${t.name}': 노임단가는 0 이상의 정수(원)여야 합니다.`);
  });

  const equipment = list<ReferenceData["equipment"][number]>(o.equipment, "장비");
  uniq(equipment.map((e) => String(e.name ?? "")), "장비");

  const productivity = list<ReferenceData["productivity"][number]>(o.productivity, "생산성");
  uniq(productivity.map((p) => String(p.name ?? "")), "생산성");
  productivity.forEach((p) => {
    if (typeof p.manDaysPerUnit !== "number" || !(p.manDaysPerUnit >= 0)) {
      errors.push(`생산성 '${p.name}': 단위당 인일은 0 이상의 수여야 합니다.`);
    }
  });

  const templates = list<ReferenceData["scheduleTemplates"][number]>(o.scheduleTemplates, "일정 템플릿");
  for (const t of templates) {
    if (!WORK_TYPES.includes(t.workType)) errors.push(`일정 템플릿: 공종 유형 '${t.workType}'은 5종 중 하나여야 합니다.`);
    for (const it of list<ScheduleTemplateItem>(t.items, `일정 템플릿(${t.workType})`)) {
      if (String(it.keyword ?? "").trim() === "") errors.push(`일정 템플릿(${t.workType}): 공정 이름 포함어가 빈 항목이 있습니다.`);
      const okPct = (n: unknown) => typeof n === "number" && n >= 0 && n <= 100;
      if (!okPct(it.startPct) || !okPct(it.endPct) || it.startPct > it.endPct) {
        errors.push(`일정 템플릿(${t.workType}) '${it.keyword}': 시작·종료 비율은 0~100이고 시작이 종료보다 클 수 없습니다.`);
      }
    }
  }

  const holidays = list<string>(o.holidays, "공휴일");
  holidays.forEach((h) => {
    try {
      parseDate(h);
    } catch {
      errors.push(`공휴일 '${h}'은 yyyy-mm-dd 날짜가 아닙니다.`);
    }
  });
  if (new Set(holidays).size !== holidays.length) errors.push("공휴일: 같은 날짜가 두 번 들어 있습니다.");

  const docTemplates = list<ReferenceData["documentTemplates"][number]>(o.documentTemplates, "서류 템플릿");
  uniq(docTemplates.map((d) => String(d.key ?? "")), "서류 템플릿 키");

  if (!isInt(o.feeSupply)) errors.push("용역비 공급가액은 0 이상의 정수(원)여야 합니다.");

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      trades: trades.map((t) => ({ name: t.name.trim(), wage: t.wage })),
      equipment: equipment.map((e) => ({ name: e.name.trim() })),
      productivity: productivity.map((p) => ({ name: p.name.trim(), unit: String(p.unit ?? "").trim(), manDaysPerUnit: p.manDaysPerUnit })),
      scheduleTemplates: templates.map((t) => ({
        workType: t.workType,
        items: t.items.map((it) => ({ keyword: it.keyword.trim(), startPct: it.startPct, endPct: it.endPct })),
      })),
      holidays: [...holidays].sort(),
      documentTemplates: docTemplates.map((d) => ({ key: d.key.trim(), name: String(d.name ?? "").trim(), body: String(d.body ?? "") })),
      feeSupply: o.feeSupply as number,
    },
  };
}

/** 기준정보 공휴일을 공사의 공휴일 입력에 합친다(이미 있는 날짜는 건너뜀). 가져오는 순간에만 바뀐다. */
export function mergeHolidaysText(current: string, reference: readonly string[]): string {
  const existing = current.split(/[\s,]+/).filter(Boolean);
  const set = new Set(existing);
  const added = reference.filter((h) => !set.has(h));
  return [...existing, ...added].join(", ");
}

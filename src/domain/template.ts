// 일정 템플릿 적용 (SRS SR-SC-02·03): 공종 유형별 템플릿으로 공정의 착수·완료 일차 초기값을 채운다.
// 공정 이름에 템플릿의 포함어가 들어 있으면 그 비율(공기 대비 %)로 일차를 정한다. 값은 기준정보에서 관리한다.

import type { Process } from "./progress";

export type TemplateItem = { keyword: string; startPct: number; endPct: number };

/** 비율(0~100)을 일차(1~공기)로. 착수는 올림 후 최소 1, 완료는 올림 후 공기 이내, 완료 ≥ 착수 */
export function pctToDays(startPct: number, endPct: number, durationDays: number): { startDay: number; endDay: number } {
  const startDay = Math.max(1, Math.min(durationDays, Math.floor((startPct / 100) * durationDays) + 1));
  const endDay = Math.max(startDay, Math.min(durationDays, Math.ceil((endPct / 100) * durationDays)));
  return { startDay, endDay };
}

/**
 * 템플릿과 이름이 맞는 공정의 일정을 돌려준다. 맞는 템플릿이 없으면 그 공정은 건드리지 않는다(기본값: 전체 공기).
 * 여러 항목이 맞으면 목록에서 먼저 나온 항목을 쓴다.
 */
export function applyScheduleTemplate(
  processes: readonly Pick<Process, "key" | "name">[],
  items: readonly TemplateItem[],
  durationDays: number,
): Record<string, { startDay: number; endDay: number }> {
  const out: Record<string, { startDay: number; endDay: number }> = {};
  for (const p of processes) {
    const hit = items.find((it) => it.keyword !== "" && p.name.includes(it.keyword));
    if (hit) out[p.key] = pctToDays(hit.startPct, hit.endPct, durationDays);
  }
  return out;
}

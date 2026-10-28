// 가정값 변경 비교 (SRS SR-DM-06): 저장할 때 이전 값과 달라진 가정값을 찾아 이력으로 남긴다.
// 가정값 = 착공일·공사기간·공휴일·공정 일차·직접 지정 인원/장비·내역서 추출값에서 관리자가 고친 수치.
// 이력에는 주민등록번호 같은 개인정보를 넣지 않는다(이 목록에는 개인정보 항목이 없다).

import type { WorkState } from "./types";

export type AssumptionChange = { field: string; before: string; after: string };

const NONE = "(없음)";

export function diffAssumptions(prev: WorkState, next: WorkState): AssumptionChange[] {
  const out: AssumptionChange[] = [];
  const push = (field: string, before: unknown, after: unknown) => {
    const b = before === undefined || before === "" ? NONE : String(before);
    const a = after === undefined || after === "" ? NONE : String(after);
    if (b !== a) out.push({ field, before: b, after: a });
  };

  push("착공일", prev.general.startDate, next.general.startDate);
  push("공사기간(일)", prev.general.durationDays, next.general.durationDays);
  push("공휴일", prev.holidaysText.trim(), next.holidaysText.trim());

  // 공정 일차
  const keys = new Set([...Object.keys(prev.schedule), ...Object.keys(next.schedule)]);
  for (const k of [...keys].sort()) {
    const f = (s: WorkState["schedule"][string] | undefined) => (s ? `${s.startDay}~${s.endDay}일차` : "(기본)");
    push(`공정 ${k} 일정`, f(prev.schedule[k]), f(next.schedule[k]));
  }

  // 직접 지정(가정) 인원·장비
  for (const [label, a, b] of [
    ["직접 지정 인원", prev.extraLabor, next.extraLabor],
    ["직접 지정 장비", prev.extraEquipment, next.extraEquipment],
  ] as const) {
    const fmt = (l: (typeof a)[number]) => `${l.name} ${l.perDay}×${l.workdays}일(공정 ${l.processKey})`;
    const before = new Map(a.map((l) => [l.id, l]));
    const after = new Map(b.map((l) => [l.id, l]));
    for (const [id, l] of after) push(`${label} ${l.name}`, before.has(id) ? fmt(before.get(id)!) : NONE, fmt(l));
    for (const [id, l] of before) if (!after.has(id)) push(`${label} ${l.name}`, fmt(l), NONE);
  }

  // 내역서 추출값에서 관리자가 고친 수치
  const p = prev.parsed;
  const n = next.parsed;
  if (p && n) {
    n.summary.forEach((row, i) => push(`집계표 ${row.name} 합계`, p.summary[i]?.total, row.total));
    push("집계표 합계 행", p.grandTotal ?? "", n.grandTotal ?? "");
    n.labor.forEach((row, i) => push(`노무 ${row.trade} 수량`, p.labor[i]?.quantity, row.quantity));
    n.equipment.forEach((row, i) => push(`장비 ${row.name} 시간(HR)`, p.equipment[i]?.hours, row.hours));
  }
  return out;
}

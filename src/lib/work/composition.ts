// 공정 구성: 내역서의 어느 단위를 하나의 공정으로 볼지 정한다 (SRS SR-SC-01·04, 6.1).
// 기본은 집계표의 말단 공종 하나가 공정 하나이고, 관리자가 아래 규칙으로 고친다.
//   - 소분류로 나누기: 공종(또는 그룹)을 내역서의 바로 아래 구조 단위로 나눈다
//   - 합치기: 여러 공정을 하나로 합친다(예: 바닥공조 2·3·4·5층 그룹 → 2~5층)
//   - 직접 나누기: 금액·노무비를 직접 정해 둘 이상으로 나눈다(예: 장비설치 → 실외기 / 실내기)
//   - 공정 추가: 금액 없는 협조 공정(시운전·준공검사 등)을 넣는다
// 금액은 항상 보존한다: 나누거나 합쳐도 공정 금액의 합은 변하지 않는다.
// 화면·서버가 같은 규칙을 쓰도록 순수 함수로만 둔다.

import type { ParsedBudget, ParsedSection } from "@/lib/budget/parse";

export type ProcessDef = {
  /** 공정 키. 일정·산정 라인이 이 키를 쓴다 */
  id: string;
  name: string;
  /** 소속 공종의 집계표 코드 */
  code: string;
  /** 순공사비(원). 음수(고재처리 등)도 가능하다 */
  amount: number;
  /** 노무비(원). 노무비 환산 인원 산정에 쓴다 */
  laborCost: number;
  /** 이 공정이 맡는 내역서 구조 단위. 노무·장비 행을 공정에 잇는 데 쓴다 */
  sectionIds: string[];
  /** 직접 나누거나 추가한 공정 */
  manual?: boolean;
};

export type Composition = ProcessDef[];

export type ManualPart = { name: string; amount: number; laborCost: number };

export type Edit<T = Composition> = { ok: true; value: T } | { ok: false; error: string };

const sections = (parsed: ParsedBudget): ParsedSection[] => parsed.sections ?? [];

/** 기본 공정 구성: 집계표 말단 공종마다 공정 하나 (이전 방식과 같은 키) */
export function defaultComposition(parsed: ParsedBudget): Composition {
  const secs = sections(parsed);
  return parsed.summary.map((row, i) => {
    const code = row.code || `ROW${i + 1}`;
    // 이 공종을 대표하는 구조 단위: 시트 전체(가상 뿌리, depth -1)가 있으면 그것, 없으면 공종 제목(depth 0)
    const sec =
      secs.find((s) => s.code === row.code && s.depth === -1) ??
      secs.find((s) => s.code === row.code && s.depth === 0 && !s.outside);
    return {
      id: code,
      name: row.name,
      code: row.code,
      amount: row.total,
      laborCost: row.labor,
      sectionIds: sec ? [sec.id] : [],
    };
  });
}

/** 공정이 맡은 구조 단위의 바로 아래 단위들(순공사비 밖 항목 제외) */
export function childSections(parsed: ParsedBudget, def: ProcessDef): ParsedSection[] {
  if (def.sectionIds.length !== 1) return [];
  const parentId = def.sectionIds[0];
  return sections(parsed).filter((s) => s.parentId === parentId && !s.outside);
}

export function canSplitByChildren(parsed: ParsedBudget, def: ProcessDef): boolean {
  return childSections(parsed, def).length >= 1;
}

function uniqueId(comp: Composition, base: string): string {
  const used = new Set(comp.map((d) => d.id));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}~${n}`)) return `${base}~${n}`;
}

function indexOfId(comp: Composition, id: string): number {
  return comp.findIndex((d) => d.id === id);
}

/** 소분류로 나누기. 아래 단위에 들어가지 않는 나머지 금액은 '기타' 공정으로 남긴다. */
export function splitByChildren(parsed: ParsedBudget, comp: Composition, id: string): Edit {
  const at = indexOfId(comp, id);
  if (at < 0) return { ok: false, error: "공정을 찾을 수 없습니다." };
  const def = comp[at];
  const kids = childSections(parsed, def);
  if (kids.length === 0) return { ok: false, error: "내역서에 이 공정을 더 나눌 소분류가 없습니다. '직접 나누기'를 쓰세요." };

  // 다른 공정이나 형제 그룹과 이름이 겹치면 상위 공정 이름을 앞에 붙인다(공정표에 같은 이름이 둘 나오지 않게)
  const taken = comp.filter((d) => d.id !== def.id).map((d) => d.name.trim());
  const count = (n: string) => kids.filter((k) => k.name === n).length;
  const parts: ProcessDef[] = kids.map((k) => ({
    id: `${def.id}/${k.id}`,
    name: taken.includes(k.name.trim()) || count(k.name) > 1 ? `${def.name} ${k.name}` : k.name,
    code: def.code,
    amount: k.total,
    laborCost: k.labor,
    sectionIds: [k.id],
  }));
  const restAmount = def.amount - parts.reduce((a, p) => a + p.amount, 0);
  const restLabor = def.laborCost - parts.reduce((a, p) => a + p.laborCost, 0);
  if (restAmount !== 0 || restLabor !== 0 || def.sectionIds.length === 0) {
    // 소분류에 속하지 않은 품목(공종 바로 아래 품목)과 집계표·내역서의 차이
    parts.push({ id: `${def.id}/rest`, name: `${def.name} 기타`, code: def.code, amount: restAmount, laborCost: restLabor, sectionIds: [...def.sectionIds] });
  }
  const next = [...comp.slice(0, at), ...parts, ...comp.slice(at + 1)];
  return { ok: true, value: next };
}

/** 합치기: 고른 공정을 하나로. 순서는 목록에서 가장 앞선 공정 자리를 따른다. */
export function mergeProcesses(comp: Composition, ids: string[], name?: string): Edit {
  const picked = comp.filter((d) => ids.includes(d.id));
  if (picked.length < 2) return { ok: false, error: "합칠 공정을 둘 이상 고르세요." };
  const first = picked[0];
  const merged: ProcessDef = {
    id: uniqueId(comp.filter((d) => !ids.includes(d.id)), `${first.id}+${picked.length}`),
    name: name?.trim() || `${first.name} 외 ${picked.length - 1}건`,
    code: first.code,
    amount: picked.reduce((a, d) => a + d.amount, 0),
    laborCost: picked.reduce((a, d) => a + d.laborCost, 0),
    sectionIds: picked.flatMap((d) => d.sectionIds),
    manual: true,
  };
  const at = indexOfId(comp, first.id);
  const rest = comp.filter((d) => !ids.includes(d.id));
  // rest에서 first가 있던 자리(앞쪽 공정 개수)에 넣는다
  const pos = comp.slice(0, at).filter((d) => !ids.includes(d.id)).length;
  return { ok: true, value: [...rest.slice(0, pos), merged, ...rest.slice(pos)] };
}

/** 직접 나누기: 금액·노무비의 합이 원래와 같아야 한다. 노무·장비 행은 첫 번째 부분이 이어받는다. */
export function splitManual(comp: Composition, id: string, parts: ManualPart[]): Edit {
  const at = indexOfId(comp, id);
  if (at < 0) return { ok: false, error: "공정을 찾을 수 없습니다." };
  const def = comp[at];
  if (parts.length < 2) return { ok: false, error: "둘 이상으로 나눠야 합니다." };
  if (parts.some((p) => p.name.trim() === "")) return { ok: false, error: "이름이 빈 부분이 있습니다." };
  const amountDiff = parts.reduce((a, p) => a + p.amount, 0) - def.amount;
  if (amountDiff !== 0) return { ok: false, error: `금액의 합이 원래 공정 금액과 ${Math.abs(amountDiff).toLocaleString("ko-KR")}원 ${amountDiff > 0 ? "많습니다" : "적습니다"}.` };
  const laborDiff = parts.reduce((a, p) => a + p.laborCost, 0) - def.laborCost;
  if (laborDiff !== 0) return { ok: false, error: `노무비의 합이 원래 공정 노무비와 ${Math.abs(laborDiff).toLocaleString("ko-KR")}원 ${laborDiff > 0 ? "많습니다" : "적습니다"}.` };

  const others = comp.filter((d) => d.id !== id);
  const made: ProcessDef[] = [];
  parts.forEach((p, k) => {
    const pid = uniqueId([...others, ...made], `${def.id}#${k + 1}`);
    made.push({ id: pid, name: p.name.trim(), code: def.code, amount: p.amount, laborCost: p.laborCost, sectionIds: k === 0 ? [...def.sectionIds] : [], manual: true });
  });
  return { ok: true, value: [...comp.slice(0, at), ...made, ...comp.slice(at + 1)] };
}

/** 공정 추가(기본은 금액 없는 협조 공정). 속할 공종 코드는 맨 앞 공정을 따른다. */
export function addProcess(comp: Composition, name: string, amount = 0): Edit {
  if (name.trim() === "") return { ok: false, error: "공정 이름을 입력하세요." };
  const def: ProcessDef = { id: uniqueId(comp, "x"), name: name.trim(), code: comp[0]?.code ?? "", amount, laborCost: 0, sectionIds: [], manual: true };
  return { ok: true, value: [...comp, def] };
}

export function renameProcess(comp: Composition, id: string, name: string): Composition {
  return comp.map((d) => (d.id === id ? { ...d, name } : d));
}

export function moveProcess(comp: Composition, id: string, delta: -1 | 1): Composition {
  const at = indexOfId(comp, id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= comp.length) return comp;
  const next = [...comp];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** 금액이 0원인 공정만 지울 수 있다(금액이 있는 공정을 지우면 순공사비가 빈다). */
export function removeProcess(comp: Composition, id: string): Edit {
  const def = comp.find((d) => d.id === id);
  if (!def) return { ok: false, error: "공정을 찾을 수 없습니다." };
  if (def.amount !== 0) return { ok: false, error: "금액이 있는 공정은 지울 수 없습니다. 다른 공정과 합치거나 금액을 옮기세요." };
  return { ok: true, value: comp.filter((d) => d.id !== id) };
}

type LineRef = { code: string; sectionId?: string };

/** 노무·장비 행이 속할 공정의 키. 행이 속한 구조 단위에서 위로 올라가며 가장 가까운 공정을 찾는다. */
export function routeLine(parsed: ParsedBudget, comp: Composition, row: LineRef): string | undefined {
  const secs = sections(parsed);
  const byId = new Map(secs.map((s) => [s.id, s]));
  for (let cur = row.sectionId ? byId.get(row.sectionId) : undefined; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
    const hit = comp.find((d) => d.sectionIds.includes(cur!.id));
    if (hit) return hit.id;
  }
  // 구조 단위가 없는 내역서: 공종코드로 찾는다
  return (comp.find((d) => d.id === row.code) ?? comp.find((d) => d.code === row.code && d.code !== ""))?.id;
}

export type CompositionCheck = { ok: boolean; messages: string[] };

/** 공정 구성의 합이 집계표 순공사비와 같은지 본다 */
export function checkComposition(parsed: ParsedBudget, comp: Composition): CompositionCheck {
  const messages: string[] = [];
  const total = comp.reduce((a, d) => a + d.amount, 0);
  const target = parsed.grandTotal ?? parsed.summaryTotal;
  if (total !== target) messages.push(`공정 금액의 합(${total.toLocaleString("ko-KR")}원)이 집계표 순공사비(${target.toLocaleString("ko-KR")}원)와 ${Math.abs(total - target).toLocaleString("ko-KR")}원 다릅니다.`);
  const names = comp.map((d) => d.name.trim());
  if (names.some((n) => n === "")) messages.push("이름이 빈 공정이 있습니다.");
  if (new Set(names).size !== names.length) messages.push("이름이 겹치는 공정이 있습니다.");
  return { ok: messages.length === 0, messages };
}

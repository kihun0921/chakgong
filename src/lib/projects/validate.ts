// 화면에서 받은 공사 입력을 저장 전에 검사한다. 화면이 보낸 값을 믿지 않는다 (SR-NF-12).

import { EMPTY_DIRECT, EMPTY_LABOR_AGREEMENT } from "@/domain/documents/model";
import { INITIAL_WORK, type WorkState } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 올바른 모양이면 빠진 칸을 기본값으로 채운 WorkState를, 아니면 null을 돌려준다. */
export function coerceWorkState(input: unknown): WorkState | null {
  if (!isObj(input)) return null;
  const arrays = ["jointMembers", "engineers", "tocOrder", "uploads", "extraLabor", "extraEquipment", "locations"] as const;
  for (const k of arrays) if (input[k] !== undefined && !Array.isArray(input[k])) return null;
  if (input.general !== undefined && !isObj(input.general)) return null;
  if (input.siteScale !== undefined && !isObj(input.siteScale)) return null;
  if (input.schedule !== undefined && !isObj(input.schedule)) return null;
  if (input.composition !== undefined && input.composition !== null) {
    if (!Array.isArray(input.composition)) return null;
    for (const d of input.composition) {
      if (!isObj(d) || typeof d.id !== "string" || typeof d.name !== "string" || typeof d.amount !== "number" || !Number.isFinite(d.amount)) return null;
      if (typeof d.laborCost !== "number" || !Number.isFinite(d.laborCost) || !Array.isArray(d.sectionIds)) return null;
    }
    if (new Set((input.composition as { id: string }[]).map((d) => d.id)).size !== input.composition.length) return null;
  }
  if (input.remarks !== undefined && (!isObj(input.remarks) || Object.values(input.remarks).some((v) => typeof v !== "string"))) return null;
  for (const l of (input.locations ?? []) as unknown[]) {
    if (!isObj(l) || typeof l.id !== "string" || typeof l.name !== "string" || !Number.isInteger(l.startDay) || !Number.isInteger(l.endDay)) return null;
  }
  if (input.direct !== undefined && !isObj(input.direct)) return null;
  if (input.laborAgreement !== undefined && !isObj(input.laborAgreement)) return null;
  if (isObj(input.direct) && input.direct.items !== undefined) {
    const items = input.direct.items;
    if (!Array.isArray(items)) return null;
    for (const it of items) {
      if (!isObj(it) || typeof it.id !== "string" || typeof it.name !== "string" || typeof it.amount !== "string" || (it.kind !== "direct" && it.kind !== "sub")) return null;
    }
  }
  if (input.holidaysText !== undefined && typeof input.holidaysText !== "string") return null;

  const engineers = (input.engineers ?? []) as unknown[];
  for (const e of engineers) {
    if (!isObj(e) || typeof e.id !== "string" || typeof e.rrn !== "string" || typeof e.name !== "string") return null;
  }
  const tocOrder = (input.tocOrder ?? INITIAL_WORK.tocOrder) as unknown[];
  if (tocOrder.some((n) => !Number.isInteger(n) || (n as number) < 1 || (n as number) > 15)) return null;

  return {
    ...INITIAL_WORK,
    ...(input as Partial<WorkState>),
    general: { ...INITIAL_WORK.general, ...((input.general ?? {}) as object) },
    siteScale: { ...INITIAL_WORK.siteScale, ...((input.siteScale ?? {}) as object) },
    direct: { ...EMPTY_DIRECT, ...((input.direct ?? {}) as object) },
    laborAgreement: { ...EMPTY_LABOR_AGREEMENT, ...((input.laborAgreement ?? {}) as object) },
  } as WorkState;
}

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

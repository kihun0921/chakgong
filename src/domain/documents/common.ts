// 서류 생성에 함께 쓰는 작은 도우미 (build.ts와 forms.ts가 같이 쓴다)

import { completionDate } from "../calendar";
import type { DocInput, FactKey } from "./model";

/** '으로/로' 고르기: 마지막 한글 글자에 받침이 있으면(ㄹ 제외) '으로' */
export function eulo(word: string): string {
  const letters = [...word].filter((c) => /[가-힣]/.test(c));
  const last = letters.at(-1);
  if (!last) return "으로";
  const jong = (last.charCodeAt(0) - 0xac00) % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

/** 수신처(비우면 계약기관) */
export const receiverName = (i: DocInput) => (i.receiver || i.contractAgency).trim();
export const receiverOf = (i: DocInput) => `${receiverName(i)} 귀하`;

export function period(i: DocInput): { start: string; end: string } {
  return { start: i.startDate, end: completionDate(i.startDate as string, i.durationDays) };
}

export function commonFacts(i: DocInput): Partial<Record<FactKey, string>> {
  return {
    projectName: i.projectName,
    companyName: i.company.name,
    representative: i.company.representative,
  };
}

/** 공동수급체 회사(대표사 먼저). 공동수급체가 아니면 시공사 하나 */
export function consortiumMembers(i: DocInput): { name: string; representative: string }[] {
  if (i.jointMembers.length > 0) {
    const sorted = [...i.jointMembers].sort((a, b) => Number(b.isLead) - Number(a.isLead));
    return sorted.map((m) => ({ name: m.name, representative: m.representative }));
  }
  return [{ name: i.company.name, representative: i.company.representative }];
}

/** 간지·확약서의 날짜 표기: '2026. 3.' / '2026. 3. 11.' (제출일이 없으면 착공일의 연·월) */
export function shortDate(i: DocInput, withDay: boolean): string {
  const s = i.submitDate || i.startDate;
  if (!s) return "20    .     .";
  const y = s.slice(0, 4);
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return withDay && i.submitDate ? `${y}. ${m}. ${d}.` : `${y}. ${m}.`;
}

/** 글자 사이를 한 칸씩 띄운 제목: 선임계 → 선 임 계 */
export const spaceTitle = (t: string) => [...t.replace(/\s/g, "")].join(" ");

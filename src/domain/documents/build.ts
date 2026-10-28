// 착공계 서류 명세 만들기와 서류 간 교차 검사 (SRS SR-CM-01~07, SR-VR-04, 8.5)
// 모든 서류를 같은 입력(DocInput)에서 만든다. 화면·PDF와 무관한 순수 함수라서 시험하기 쉽다.
// 양식과 법정 고정 문안은 실제 제출본(forms.ts)에서 가져온 것이다. 샘플에 없는 문안은 만들지 않는다.

import { period } from "./common";
import { buildDirectPlanDoc, checkDirectPlan } from "./direct-plan";
import { normalizeFact } from "./format";
import {
  buildAppointment,
  buildCover,
  buildCoverLetter,
  buildEmployment,
  buildEngineersToc,
  buildLaborAgreement,
  buildOrg,
  buildPledges,
  buildSafetyChief,
  buildSeal,
  buildStartNotice,
  buildToc,
  sortedEngineers,
} from "./forms";
import { buildLaborDoc, buildScheduleDoc, type PlanDocData } from "./plan-docs";
import type { DocInput, DocSpec, FactKey } from "./model";

export { buildToc };

// ── 필수 입력값 (SR-CM-07) ─────────────────────────────────

export function checkRequired(input: DocInput): string[] {
  const missing: string[] = [];
  if (input.projectName.trim() === "") missing.push("공사명");
  if (input.contractAmount <= 0) missing.push("계약금액");
  if (input.contractDate === "") missing.push("계약일");
  if (input.startDate === "") missing.push("착공일");
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1) missing.push("공사기간");
  if (input.company.name.trim() === "") missing.push("시공사 상호");
  if (input.company.address.trim() === "") missing.push("시공사 주소");
  if (input.company.representative.trim() === "") missing.push("대표자");
  if (input.contractType === "") missing.push("계약 유형");
  if ((input.receiver || input.contractAgency).trim() === "") missing.push("수신처(계약기관)");
  if (!input.engineers.some((e) => e.role === "siteManager" && e.name.trim() !== "")) missing.push("현장대리인");
  // 직접시공계획서: 노무비 합계가 안 맞는 등 서식 자체의 오류 (계약금액 불일치는 교차 검사가 막는다)
  for (const issue of checkDirectPlan(input)) {
    if (issue.level === "error" && issue.code !== "sum") missing.push(`직접시공계획서 — ${issue.text}`);
  }
  return missing;
}

/** 공사예정공정표 머리부의 값(공정표 출력은 Wave 3). 준공일이 다른 서류와 같은지 보려고 쓴다. */
function scheduleHeader(i: DocInput): DocSpec {
  const p = period(i);
  return {
    id: "scheduleHeader",
    title: "공사예정공정표(머리부)",
    toc: [4],
    facts: { projectName: i.projectName, startDate: p.start, completionDate: p.end },
    blocks: [],
  };
}

// ── 교차 검사 (SR-VR-04) ──────────────────────────────────

export type Mismatch = {
  fact: FactKey;
  values: { docId: string; docTitle: string; value: string }[];
};

export function crossCheck(specs: readonly DocSpec[]): Mismatch[] {
  const byFact = new Map<FactKey, { docId: string; docTitle: string; value: string }[]>();
  for (const s of specs) {
    for (const [k, v] of Object.entries(s.facts) as [FactKey, string | undefined][]) {
      if (v === undefined || v === "") continue;
      const list = byFact.get(k) ?? [];
      list.push({ docId: s.id, docTitle: s.title, value: v });
      byFact.set(k, list);
    }
  }
  const out: Mismatch[] = [];
  for (const [fact, values] of byFact) {
    if (new Set(values.map((x) => normalizeFact(x.value))).size > 1) out.push({ fact, values });
  }
  return out;
}

// ── 전체 생성 ──────────────────────────────────────────────

export type GenerateResult =
  | { ok: false; missing: string[] }
  | {
      ok: true;
      /** 출력(PDF)할 서류 명세 */
      specs: DocSpec[];
      /** 교차 검사에 쓰는 명세(공정표 머리부 포함) */
      checkSpecs: DocSpec[];
      mismatches: Mismatch[];
    };

/** 간지가 필요한 목차 번호와 간지 문구 (실제 제출본의 간지) */
export const DIVIDERS: { toc: number; name: string }[] = [
  { toc: 14, name: "품질관리계획서" },
  { toc: 3, name: "안전관리계획서" },
  { toc: 8, name: "환경관리계획서" },
  { toc: 4, name: "공사예정공정표" },
  { toc: 11, name: "고용,산재보험 가입증명원" },
  { toc: 5, name: "공사도급계약서" },
  { toc: 6, name: "공사도급내역서" },
  { toc: 12, name: "직접시공계획서" },
];

/** 간지 */
export function buildDivider(i: DocInput, name: string, toc: number): DocSpec {
  return buildCover(i, name, [toc], `divider:${toc}`);
}

/**
 * plan을 주면 공정표(④)·인원 및 장비투입계획표(⑨)도 서류로 만든다. 주지 않으면 공정표 머리부의 값만
 * 교차 검사에 쓴다(준공일이 다른 서류와 같은지 보려는 용도).
 */
export function generateDocs(input: DocInput, pages?: Record<number, string>, plan?: PlanDocData): GenerateResult {
  void pages; // 제출서류 목차는 쪽수 없이 목록만 쓴다(실제 제출본)
  const missing = checkRequired(input);
  if (missing.length > 0) return { ok: false, missing };

  const chief =
    input.engineers.find((e) => e.id === input.safetyChiefId) ??
    input.engineers.find((e) => e.role === "siteManager")!;

  const engineerDocs: DocSpec[] = sortedEngineers(input).flatMap((e) => [
    buildAppointment(input, e),
    buildEmployment(input, e),
    ...(e.role === "siteManager" ? [buildSeal(input, e)] : []),
  ]);
  const directPlan = buildDirectPlanDoc(input);
  const agreement = buildLaborAgreement(input);

  const specs: DocSpec[] = [
    buildCoverLetter(input),
    buildCover(input, "착공신고서", [], "coverStart"),
    buildStartNotice(input),
    buildToc(input),
    buildCover(input, "현장기술자 지정신고서", [1], "coverEngineers"),
    buildEngineersToc(input),
    ...engineerDocs,
    buildOrg(input),
    buildSafetyChief(input, chief),
    ...DIVIDERS.map((d) => buildDivider(input, d.name, d.toc)),
    ...(directPlan ? [directPlan] : []),
    ...(agreement ? [agreement] : []),
    ...buildPledges(input),
    ...(plan ? [buildScheduleDoc(input, plan), buildLaborDoc(input, plan)] : []),
  ];
  const checkSpecs = plan ? specs : [...specs, scheduleHeader(input)];
  return { ok: true, specs, checkSpecs, mismatches: crossCheck(checkSpecs) };
}

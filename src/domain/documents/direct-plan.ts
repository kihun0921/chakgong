// 직접시공계획서 — 건설산업기본법 시행규칙 [별지 제22호의6서식] <개정 2024. 10. 16.> (SRS SR-CM-09)
// 서식 문구는 실제 서식 샘플(옥렬도로, 유승종합건설)의 고정 문구를 그대로 옮긴 것이다. 임의로 고치지 않는다.
// 화면·PDF와 무관한 순수 함수로 두어 시험하기 쉽게 한다.

import { completionDate } from "../calendar";
import { blankableDate, koreanDate, won } from "./format";
import type { Block, DirectItem, DirectPlanInput, DocInput, DocSpec, FactKey } from "./model";

export const DIRECT_FORM_HEADER = "■ 건설산업기본법 시행규칙[별지 제22호의6서식] <개정 2024. 10. 16.>";
export const DIRECT_FORM_TITLE = "건설공사의 직접시공계획서";
export const DIRECT_FORM_BASIS =
  "건설산업기본법 제28조의 2 제2항, 같은 법 시행령 제30조의2 제4항 및 같은 법 시행규칙 제25조의5 제1항에 따라 건설공사의 직접시공계획을 통보합니다.";
export const DIRECT_FORM_ATTACHMENTS = [
  "1. 직접 시공 및 하도급 할 공사량ㆍ공사단가 및 공사금액(노무비를 포함합니다)이 분명하게 적힌 공사내역서",
  "2. 예정공정표",
];
export const DIRECT_FORM_PAPER = "210mm×297mm[백상지(80g/㎡) 또는 중질지(80g/㎡)]";

/** 금액 입력칸 → 원 단위 정수. 비었거나 숫자가 아니면 0 */
export function parseWon(s: string): number {
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export type DirectTotals = {
  directAmount: number;
  subAmount: number;
  total: number;
  /** 직접시공 금액 ÷ 도급금액(계약금액). 계약금액이 없으면 null */
  ratio: number | null;
};

export function directTotals(d: DirectPlanInput, contractAmount: number): DirectTotals {
  const sum = (kind: DirectItem["kind"]) =>
    d.items.filter((x) => x.kind === kind).reduce((a, x) => a + parseWon(x.amount), 0);
  const directAmount = sum("direct");
  const subAmount = sum("sub");
  return {
    directAmount,
    subAmount,
    total: directAmount + subAmount,
    ratio: contractAmount > 0 ? directAmount / contractAmount : null,
  };
}

/**
 * 도급금액 구간별 직접시공 비율 기준(샘플 양식 옆 안내 문구에 적힌 값).
 * 3억 미만 50%, 3억~10억 30%, 10억~30억 20%, 30억~70억 10%. 70억 이상은 샘플에 기준이 없어 검사하지 않는다.
 */
export function requiredDirectRatio(contractAmount: number): number | null {
  if (contractAmount <= 0) return null;
  if (contractAmount < 300_000_000) return 0.5;
  if (contractAmount < 1_000_000_000) return 0.3;
  if (contractAmount < 3_000_000_000) return 0.2;
  if (contractAmount < 7_000_000_000) return 0.1;
  return null;
}

/** code "sum": 계약금액과 합이 다른 경우. 서류 간 교차 검사(contractAmount)가 따로 막는다 */
export type DirectIssue = { level: "error" | "warn"; text: string; code?: "sum" };

/** 입력 점검. error는 서식의 합계가 맞지 않는 경우, warn은 확인을 권하는 경우 */
export function checkDirectPlan(i: DocInput): DirectIssue[] {
  const d = i.direct;
  if (!d || d.items.length === 0) return [];
  const out: DirectIssue[] = [];
  const t = directTotals(d, i.contractAmount);

  if (d.items.some((x) => x.name.trim() === "")) out.push({ level: "error", text: "이름이 빈 세부공종이 있습니다." });
  if (t.directAmount === 0) out.push({ level: "warn", text: "직접시공 공종 금액이 0원입니다. 직접시공 공종과 금액을 넣어 주세요." });

  // 직접시공 + 하도급 = 도급금액(계약금액). 원 단위 반올림 오차 1원은 허용한다
  if (i.contractAmount > 0 && Math.abs(t.total - i.contractAmount) > 1) {
    out.push({
      level: "error",
      code: "sum",
      text: `직접시공(${won(t.directAmount)})과 하도급(${won(t.subAmount)})의 합 ${won(t.total)}이 계약금액 ${won(i.contractAmount)}과 다릅니다.`,
    });
  }

  // 직접시공 노무비 + 하도급 총 노무비 = 총 노무비
  const labor = parseWon(d.totalLabor);
  const parts = parseWon(d.directLabor) + parseWon(d.subLabor);
  if (labor > 0 && Math.abs(labor - parts) > 1) {
    out.push({
      level: "error",
      text: `직접시공 노무비(${won(parseWon(d.directLabor))})와 하도급 총 노무비(${won(parseWon(d.subLabor))})의 합 ${won(parts)}이 총 노무비 ${won(labor)}과 다릅니다.`,
    });
  }
  if (labor === 0) out.push({ level: "warn", text: "⑤ 총 노무비가 비어 있습니다." });

  const need = requiredDirectRatio(i.contractAmount);
  if (need !== null && t.ratio !== null && t.ratio < need) {
    out.push({
      level: "warn",
      text: `직접시공 금액이 도급금액의 ${(t.ratio * 100).toFixed(1)}%입니다. 샘플 양식 안내 기준은 ${Math.round(need * 100)}% 이상입니다.`,
    });
  }
  return out;
}

const check = (on: boolean) => (on ? "[ V ]" : "[  ]");

function itemTable(items: DirectItem[]): Block {
  return {
    type: "table",
    header: ["⑥ 세부공종", "금액(원)"],
    colWidths: [3, 2],
    align: ["left", "right"],
    rows: items.length === 0 ? [["", ""]] : items.map((x, k) => [`${k + 1}. ${x.name}`, parseWon(x.amount).toLocaleString("ko-KR")]),
  };
}

/** 직접시공 공종이 하나라도 있으면 서류를 만든다. 없으면 null (업로드 첨부만 사용) */
export function buildDirectPlanDoc(i: DocInput): DocSpec | null {
  const d = i.direct;
  if (!d || d.items.length === 0) return null;
  const end = completionDate(i.startDate as string, i.durationDays);
  const t = directTotals(d, i.contractAmount);
  const direct = d.items.filter((x) => x.kind === "direct");
  const sub = d.items.filter((x) => x.kind === "sub");
  const owner = (i.demandAgency || i.contractAgency).trim();
  const receiver = (i.receiver || i.contractAgency).trim();

  // 계약금액과 1원 이내 차이는 반올림 오차로 보고 같은 값으로 교차 검사한다
  const sameAmount = Math.abs(t.total - i.contractAmount) <= 1;
  const facts: Partial<Record<FactKey, string>> = {
    projectName: i.projectName,
    companyName: i.company.name,
    representative: i.company.representative,
    startDate: i.startDate,
    completionDate: end,
    contractAmount: String(sameAmount ? i.contractAmount : t.total),
  };

  return {
    id: "directPlan",
    title: DIRECT_FORM_TITLE,
    toc: [12],
    compact: true,
    facts,
    blocks: [
      { type: "paragraph", text: DIRECT_FORM_HEADER },
      { type: "title", text: DIRECT_FORM_TITLE },
      { type: "paragraph", text: "(앞쪽)", align: "right" },
      {
        type: "fields",
        rows: [
          { label: "공사명", value: i.projectName },
          { label: "① 공사종류", value: d.workType },
          { label: "①-1 공종그룹종류", value: d.groupType },
          { label: "①-2 세부공사종류(종합)", value: d.subType },
          { label: "현장소재지", value: i.siteAddress },
          { label: "발주자 상호(기관명)", value: owner },
          { label: "발주자 구분", value: `${check(d.ownerKind === "공공기관")} 공공기관  ${check(d.ownerKind === "민간")} 민간` },
          { label: "발주자 대표자", value: d.ownerRepresentative },
          { label: "발주자 주소", value: d.ownerAddress },
          { label: "수급인 상호", value: i.company.name },
          { label: "수급인 대표자", value: i.company.representative },
          { label: "수급인 영업소 소재지", value: i.company.address },
          {
            label: "도급방법",
            value: `${check(d.contractMethod === "단독도급")} 단독도급  공동도급(${check(d.contractMethod === "공동이행방식")} 공동이행방식 ${check(d.contractMethod === "분담이행방식")} 분담이행방식 ${check(d.contractMethod === "주계약자관리방식")} 주계약자관리방식)`,
          },
          {
            label: "계약성질",
            value: `${check(d.contractNature === "장기계속공사")} 장기계속공사  ${check(d.contractNature === "기타공사")} 기타공사`,
          },
          { label: "② 계약일", value: koreanDate(i.contractDate) },
          { label: "③ 착공일", value: koreanDate(i.startDate) },
          { label: "④ 준공예정일", value: koreanDate(end) },
          { label: "⑤ 총 노무비", value: won(parseWon(d.totalLabor)) },
        ],
      },
      { type: "paragraph", text: "직 접 시 공 계 획", align: "center", bold: true },
      {
        type: "paragraph",
        text: `직접시공 공종(기능인력 투입예정 인원 : ${d.skilledWorkers.trim() === "" ? "      " : parseWon(d.skilledWorkers)}명)`,
        bold: true,
      },
      itemTable(direct),
      { type: "paragraph", text: "하도급(예정) 공종", bold: true },
      itemTable(sub),
      {
        type: "fields",
        rows: [
          { label: "⑦ 직접시공 금액 합계", value: won(t.directAmount) },
          { label: "(직접시공 노무비)", value: won(parseWon(d.directLabor)) },
          { label: "⑧ 하도급(예정) 총 노무비", value: won(parseWon(d.subLabor)) },
        ],
      },
      { type: "paragraph", text: DIRECT_FORM_BASIS },
      { type: "paragraph", text: blankableDate(i.submitDate), align: "center" },
      { type: "signature", lines: [`수급인 ${i.company.name}  (서명 또는 인)`] },
      { type: "paragraph", text: `${receiver} 귀하`, bold: true },
      { type: "paragraph", text: `구비서류\n${DIRECT_FORM_ATTACHMENTS.join("\n")}` },
      { type: "paragraph", text: DIRECT_FORM_PAPER, align: "right" },
    ],
  };
}

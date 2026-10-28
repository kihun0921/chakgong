import type { DirectPlanInput, Engineer, JointMember, LaborAgreementInput, LocationSpan, SiteScale } from "@/domain/documents/model";
import { DEFAULT_TOC_ORDER, EMPTY_DIRECT, EMPTY_LABOR_AGREEMENT } from "@/domain/documents/model";
import type { ParsedBudget } from "@/lib/budget/parse";
import type { ExtraLine } from "@/lib/work/buildPlan";
import type { Composition } from "@/lib/work/composition";

export type GeneralInfo = {
  projectName: string;
  projectNo: string;
  contractAgency: string;
  demandAgency: string;
  contractType: "" | "국가" | "지방";
  contractNo: string;
  contractDate: string;
  startDate: string;
  durationDays: string;
  contractAmount: string;
  siteAddress: string;
  companyName: string;
  representative: string;
  companyAddress: string;
  companyPhone: string;
  companyBizNo: string;
  /** 회사 팩스(공문 머리글) */
  companyFax: string;
  /** 대표 휴대폰(노무비 합의서) */
  companyMobile: string;
  /** 공문 참조(예: 안전총괄과) */
  reference: string;
  receiver: string;
  submitDate: string;
  docNumber: string;
  copies: string;
};

/** 업로드 첨부(PDF, 서버에 암호화 저장). 합본에 목차 번호 위치로 끼워 넣는다 (SR-CM-09·10) */
export type UploadItem = { id: string; toc: number; name: string; size: number };

/** 올린 내역서 원본(수정 없이 보관, SR-DM-05) */
export type BudgetOriginal = { fileId: string; name: string; size: number };

export type WorkState = {
  general: GeneralInfo;
  jointMembers: JointMember[];
  engineers: Engineer[];
  safetyChiefId: string;
  siteScale: SiteScale;
  tocOrder: number[];
  uploads: UploadItem[];
  budgetOriginal: BudgetOriginal | null;
  parsed: ParsedBudget | null;
  /** 관리자가 추출값을 확인하고 '확정'한 상태 (SR-IN-06) */
  confirmed: boolean;
  schedule: Record<string, { startDay: number; endDay: number }>;
  holidaysText: string;
  extraLabor: ExtraLine[];
  extraEquipment: ExtraLine[];
  /** 공정 구성(나누기·합치기 결과). null이면 집계표 공종마다 공정 하나 */
  composition: Composition | null;
  /** 공정표의 '주요 공정내용'(공정 키 → 글) */
  remarks: Record<string, string>;
  /** 인원 및 장비투입계획표의 '위치별' 작업 구간 */
  locations: LocationSpan[];
  /** 직접시공계획서(별지 제22호의6서식) 입력 */
  direct: DirectPlanInput;
  /** 노무비 구분관리 및 지급확인제 합의서 입력 */
  laborAgreement: LaborAgreementInput;
};

export type PatchWork = (patch: Partial<WorkState>) => void;

export const INITIAL_WORK: WorkState = {
  general: {
    projectName: "",
    projectNo: "",
    contractAgency: "",
    demandAgency: "",
    contractType: "",
    contractNo: "",
    contractDate: "",
    startDate: "",
    durationDays: "",
    contractAmount: "",
    siteAddress: "",
    companyName: "",
    representative: "",
    companyAddress: "",
    companyPhone: "",
    companyBizNo: "",
    companyFax: "",
    companyMobile: "",
    reference: "",
    receiver: "",
    submitDate: "",
    docNumber: "",
    copies: "1",
  },
  jointMembers: [],
  engineers: [],
  safetyChiefId: "",
  siteScale: {
    workerCount: "",
    excavationDepth: "",
    maxHeight: "",
    maxBridgeSpan: "",
    tunnelLength: "",
    embankmentHeight: "",
  },
  tocOrder: DEFAULT_TOC_ORDER,
  uploads: [],
  budgetOriginal: null,
  parsed: null,
  confirmed: false,
  schedule: {},
  holidaysText: "",
  extraLabor: [],
  extraEquipment: [],
  composition: null,
  remarks: {},
  locations: [],
  direct: EMPTY_DIRECT,
  laborAgreement: EMPTY_LABOR_AGREEMENT,
};


/** 저장된 공사에 이후에 생긴 입력 칸이 없어도 기본값으로 채운다(중첩된 입력 묶음 포함) */
export function withDefaults(d: Partial<WorkState>): WorkState {
  return {
    ...INITIAL_WORK,
    ...d,
    general: { ...INITIAL_WORK.general, ...(d.general ?? {}) },
    siteScale: { ...INITIAL_WORK.siteScale, ...(d.siteScale ?? {}) },
    direct: { ...EMPTY_DIRECT, ...(d.direct ?? {}) },
    laborAgreement: { ...EMPTY_LABOR_AGREEMENT, ...(d.laborAgreement ?? {}) },
    composition: d.composition ?? null,
    remarks: d.remarks ?? {},
    locations: d.locations ?? [],
  };
}

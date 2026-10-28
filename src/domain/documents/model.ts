// 착공계 서류의 입력 모델과 서류 명세(DocSpec) 형식 (SRS SR-CM-02·04·05·06, 8.4~8.5)
// 모든 서류는 같은 입력(DocInput) 한 곳에서 만들어서, 같은 값이 서류마다 어긋나지 않게 한다 (ADR-1).

import type { DateStr } from "../calendar";

export type EngineerRole =
  | "siteManager" // 현장대리인
  | "qualityMain" // 품질관리자(주력)
  | "qualitySub" // 품질관리자(보조)
  | "safetyManager"; // 안전관리자

export const ROLE_LABEL: Record<EngineerRole, string> = {
  siteManager: "현장대리인",
  qualityMain: "품질관리자(주력)",
  qualitySub: "품질관리자(보조)",
  safetyManager: "안전관리자",
};

export type Engineer = {
  id: string;
  role: EngineerRole;
  name: string;
  position: string; // 직책
  birthDate: string; // yyyy-mm-dd
  rrn: string; // 주민등록번호 — 화면에서는 마스킹, 전체 값은 출력 PDF에만 표기 (SR-NF-15)
  address: string;
  techField: string; // 기술종목
  licenseNo: string; // 등록번호
  grade: string;
  hireDate: string; // 입사일자
  dedicated: "전담" | "겸임";
  /** 연락처(조직도에 표기) */
  phone?: string;
};

export type JointMember = {
  id: string;
  name: string;
  representative: string;
  shareRate: string;
  isLead: boolean;
};

export type SiteScale = {
  workerCount: string; // 상시근로자수
  excavationDepth: string;
  maxHeight: string;
  maxBridgeSpan: string;
  tunnelLength: string;
  embankmentHeight: string;
};

/** 직접시공계획서(건설산업기본법 시행규칙 별지 제22호의6서식)에만 쓰는 입력 (SR-CM-09) */
export type DirectItem = {
  id: string;
  /** 세부공종 이름 */
  name: string;
  /** 금액(원). 입력 전에는 빈 문자열 */
  amount: string;
  kind: "direct" | "sub";
};

export type DirectPlanInput = {
  /** ① 공사종류 (예: 토목) */
  workType: string;
  /** ①-1 공종그룹종류 (예: 교통시설) */
  groupType: string;
  /** ①-2 세부공사종류(종합) (예: 일반도로) */
  subType: string;
  ownerKind: "" | "공공기관" | "민간";
  /** 발주자 대표자 */
  ownerRepresentative: string;
  ownerAddress: string;
  /** 도급방법 */
  contractMethod: "" | "단독도급" | "공동이행방식" | "분담이행방식" | "주계약자관리방식";
  /** 계약성질 */
  contractNature: "" | "장기계속공사" | "기타공사";
  /** ⑤ 총 노무비(원) */
  totalLabor: string;
  /** 직접시공 공종에 투입할 기능인력 예정 인원(명) */
  skilledWorkers: string;
  /** (직접시공 노무비)(원) */
  directLabor: string;
  /** ⑧ 하도급(예정) 총 노무비(원) */
  subLabor: string;
  items: DirectItem[];
};

export const EMPTY_DIRECT: DirectPlanInput = {
  workType: "",
  groupType: "",
  subType: "",
  ownerKind: "",
  ownerRepresentative: "",
  ownerAddress: "",
  contractMethod: "",
  contractNature: "",
  totalLabor: "",
  skilledWorkers: "",
  directLabor: "",
  subLabor: "",
  items: [],
};

/** 노무비 구분관리 및 지급확인제 합의서(서식1-1)에 쓰는 입력 */
export type LaborAgreementInput = {
  /** 계약상의 직접노무비(원). 비우면 내역서(집계표) 노무비 합을 쓴다 */
  directLaborCost: string;
  /** 청구일(매월 N일) */
  billingDay: string;
  /** 지급기일(매월 N일) */
  paymentDay: string;
  bankName: string;
  accountNo: string;
};

export const EMPTY_LABOR_AGREEMENT: LaborAgreementInput = { directLaborCost: "", billingDay: "5", paymentDay: "12", bankName: "", accountNo: "" };

export type DocInput = {
  projectName: string;
  projectNo: string;
  contractAgency: string;
  demandAgency: string;
  contractType: "" | "국가" | "지방";
  contractNo: string;
  contractDate: DateStr | "";
  startDate: DateStr | "";
  durationDays: number;
  contractAmount: number;
  siteAddress: string;
  /** 수신처. 비우면 계약기관을 쓴다 */
  receiver: string;
  /** 제출일. 비워도 서류는 생성되고 공란으로 출력한다 (SR-CM-07) */
  submitDate: DateStr | "";
  docNumber: string;
  copies: string;
  company: { name: string; representative: string; address: string; phone: string; bizNo: string; fax?: string; mobile?: string };
  /** 공문의 참조(예: 안전총괄과) */
  reference?: string;
  /** 내역서(집계표) 노무비 합 — 노무비 합의서의 직접노무비 기본값 */
  budgetDirectLabor?: number;
  /** 노무비 구분관리 및 지급확인제 합의서 입력 */
  laborAgreement?: LaborAgreementInput;
  jointMembers: JointMember[];
  engineers: Engineer[];
  /** 안전보건관리책임자로 선임할 기술인(현장대리인 겸임 가능) */
  safetyChiefId: string;
  siteScale: SiteScale;
  /** 제출서류 목차 순서(번호 1~15) */
  tocOrder: number[];
  /** 직접시공계획서 입력. 세부공종을 하나도 넣지 않으면 서류를 만들지 않는다(업로드 첨부만 사용) */
  direct?: DirectPlanInput;
};

/** 서류 간 일치를 검사하는 값의 종류 (SR-VR-04) */
export type FactKey =
  | "projectName"
  | "contractAmount"
  | "startDate"
  | "completionDate"
  | "contractAgency"
  | "demandAgency"
  | "companyName"
  | "representative"
  | `engineer:${string}`; // 기술인별 이름 (같은 기술인이 서류마다 같은 이름으로 나오는지)

/** 격자 표의 한 칸. 행·열 번호는 0부터, 합치는 칸 수는 rs(행)·cs(열) */
export type GridCell = {
  r: number;
  c: number;
  rs?: number;
  cs?: number;
  text: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  bold?: boolean;
  size?: number;
  /** 글자 사이를 띄워 쓴다(성 명 → 성    명) */
  spaced?: boolean;
  fill?: string;
  /** true면 이 칸의 안쪽 선을 긋지 않는다(표 안의 서명란처럼) */
  noBorder?: boolean;
};

export type OrgNode = { label: string; lines: string[] };

/** 공정표·투입계획표의 구간 머리글(연·월·구간 끝 날짜) */
export type PeriodHeader = {
  years: { label: string; from: number; to: number }[];
  months: { label: string; from: number; to: number }[];
  days: number[];
};

export type GanttRow = {
  name: string;
  weight: number;
  amount: number;
  /** 구간별 진도율(%) */
  values: number[];
  /** 막대의 시작·끝 위치(구간 단위, 0 ~ 구간 수). 일정이 없으면 null */
  bar: [number, number] | null;
  remark: string;
};

/** 인원 및 장비투입계획표의 '위치별' 줄: 작업 구간(일차)과 비고 */
export type LocationSpan = { id: string; name: string; startDay: number; endDay: number; remark: string };

export type ResourceRow = {
  name: string;
  total: number;
  unit: string;
  values: number[];
  bold?: boolean;
  decimals?: number;
  /** 위치별 줄의 막대(구간 단위 위치)와 비고 */
  bar?: [number, number];
  remark?: string;
};

export type Block =
  | { type: "title"; text: string }
  | {
      type: "paragraph";
      text: string;
      align?: "left" | "center" | "right";
      bold?: boolean;
      size?: number;
      /** 왼쪽 들여쓰기(pt) */
      indent?: number;
      /** 줄 간격 배수 */
      leading?: number;
    }
  | { type: "letterhead"; title: string; subtitle: string }
  | { type: "rule"; thick?: boolean }
  | { type: "pagebreak" }
  /** '공 사 명 : 연천읍지구…'처럼 이름표와 값을 한 줄에 */
  | { type: "pairs"; rows: { label: string; value: string }[]; labelWidth?: number; indent?: number; size?: number; gap?: number }
  | { type: "grid"; cols: number[]; rowHeights: number[]; cells: GridCell[]; size?: number; /** 표 전체의 바깥 테두리 */ outer?: boolean }
  /** 간지(표지): 테두리 안에 두루마리 모양 제목, 공사명, 날짜, 참여 회사 */
  | { type: "cover"; title: string; projectName: string; dateText: string; names: string[] }
  /** 공사예정공정표: 막대 그래프 격자 (A3 가로) */
  | {
      type: "gantt";
      title: string;
      projectName: string;
      rightNote: string;
      periods: PeriodHeader;
      rows: GanttRow[];
      totals: { weight: number; amount: number; byPeriod: number[]; cumulative: number[] };
    }
  /** 인원 및 장비투입계획표: 구간별 투입 수 격자 (A3 가로) */
  | {
      type: "resource";
      title: string;
      projectName: string;
      rightNote: string;
      periods: PeriodHeader;
      groups: { label: string; rows: ResourceRow[] }[];
      notes: string[];
    }
  /** 현장관리조직도: 위 오른쪽에 본사, 가운데 현장대리인, 아래에 담당자 상자들 */
  | { type: "orgchart"; head: OrgNode; manager: OrgNode; staff: { label: string; position: string; name: string; phone: string }[] }
  | { type: "fields"; rows: { label: string; value: string }[] }
  | {
      type: "table";
      header: string[];
      rows: string[][];
      fontSize?: number;
      boldRows?: number[];
      firstColWidth?: number;
      /** 열 너비 비율(예: [1, 6, 1]). 없으면 같은 너비 */
      colWidths?: number[];
      /** 열 정렬. 금액 열은 "right" */
      align?: ("left" | "center" | "right")[];
    }
  | { type: "signature"; lines: string[] }
  | { type: "org"; levels: { title: string; lines: string[] }[] }
  | { type: "spacer"; size?: number };

export type DocSpec = {
  id: string;
  title: string;
  /** 제출서류 목차 번호 (목차 밖 서류는 빈 배열) */
  toc: number[];
  blocks: Block[];
  /** 이 서류가 표기하는 공통 값. 서류 간 교차 검사에 쓴다 */
  facts: Partial<Record<FactKey, string>>;
  /** 용지. 없으면 A4 세로. 공정표·투입계획표는 A3 가로 (SR-OUT-03) */
  page?: { size: "A3" | "A4"; landscape: boolean };
  /** 법정 서식처럼 A4 한 쪽에 빽빽하게 넣어야 하는 서류: 글자와 여백을 줄여 출력한다 */
  compact?: boolean;
  /** 쪽 가장자리에 테두리 상자를 두른다(간지, 확약서 등) */
  frame?: boolean;
};

export const TOC_ITEMS: Record<number, string> = {
  1: "현장기술자 지정신고서",
  2: "하도급지킴이 이용 확약서",
  3: "안전관리계획서",
  4: "공사예정공정표",
  5: "공사 도급계약서 사본",
  6: "공사 도급내역서",
  7: "노무비 구분관리 및 지급확인제 합의서",
  8: "환경관리계획서",
  9: "인력 및 장비투입계획서",
  10: "착공전 현장사진",
  11: "고용·산재보험 가입증명원",
  12: "직접시공계획서",
  13: "하도급대금 직불조건부 입찰참가 확약서",
  14: "품질관리계획서",
  15: "조직도",
};

/** 제출서류 목차 기본 순서: 실제 제출본(연천읍지구 착공계)의 순서 */
export const DEFAULT_TOC_ORDER = [1, 15, 14, 3, 8, 4, 9, 10, 11, 5, 6, 12, 7, 13, 2];

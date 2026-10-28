// 시험·개발용 합성 입력. 실제 개인정보를 쓰지 않는다 (주민등록번호는 가짜 값).

import { DEFAULT_TOC_ORDER, type DocInput, type Engineer } from "./model";

export function sampleEngineer(over: Partial<Engineer> & Pick<Engineer, "id" | "role" | "name">): Engineer {
  return {
    position: "과장",
    birthDate: "1980-01-01",
    rrn: "800101-1000000",
    address: "서울특별시 시험구 시험로 1",
    techField: "기계설비",
    licenseNo: "T-0001",
    grade: "특급",
    hireDate: "2020-03-02",
    dedicated: "전담",
    ...over,
  };
}

export function sampleInput(over: Partial<DocInput> = {}): DocInput {
  return {
    projectName: "시험 사무환경 조성사업(기계)",
    projectNo: "R26DC00000000",
    contractAgency: "조달청",
    demandAgency: "시험수사청",
    contractType: "국가",
    contractNo: "C-2026-0001",
    contractDate: "2026-10-20",
    startDate: "2026-11-02",
    durationDays: 70,
    contractAmount: 622_764_021,
    siteAddress: "서울특별시 시험구 시험로 100",
    receiver: "",
    submitDate: "",
    docNumber: "",
    copies: "1",
    company: {
      name: "시험건설",
      representative: "김대표",
      address: "서울특별시 시험구 회사로 5",
      phone: "02-000-0000",
      bizNo: "000-00-00000",
    },
    jointMembers: [
      { id: "j1", name: "시험건설", representative: "김대표", shareRate: "60", isLead: true },
      { id: "j2", name: "공동설비", representative: "이대표", shareRate: "40", isLead: false },
    ],
    engineers: [
      sampleEngineer({ id: "e1", role: "siteManager", name: "홍현장", position: "현장대리인" }),
      sampleEngineer({ id: "e2", role: "qualityMain", name: "김품질" }),
      sampleEngineer({ id: "e3", role: "safetyManager", name: "박안전" }),
    ],
    safetyChiefId: "e1",
    siteScale: {
      workerCount: "12",
      excavationDepth: "",
      maxHeight: "",
      maxBridgeSpan: "",
      tunnelLength: "",
      embankmentHeight: "",
    },
    tocOrder: DEFAULT_TOC_ORDER,
    ...over,
  };
}

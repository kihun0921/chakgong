// 화면 입력(WorkState) → 서류 입력(DocInput). 서류는 모두 이 한 입력에서 만든다 (SR-CM-02, ADR-1).

import type { DocInput } from "@/domain/documents/model";
import type { WorkState } from "@/lib/projects/types";
import type { BuildPlanInput } from "./buildPlan";

const toInt = (s: string) => {
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function toDocInput(w: WorkState): DocInput {
  const g = w.general;
  return {
    projectName: g.projectName,
    projectNo: g.projectNo,
    contractAgency: g.contractAgency,
    demandAgency: g.demandAgency,
    contractType: g.contractType,
    contractNo: g.contractNo,
    contractDate: g.contractDate,
    startDate: g.startDate,
    durationDays: toInt(g.durationDays),
    contractAmount: toInt(g.contractAmount),
    siteAddress: g.siteAddress,
    receiver: g.receiver,
    submitDate: g.submitDate,
    docNumber: g.docNumber,
    copies: g.copies,
    company: {
      name: g.companyName,
      representative: g.representative,
      address: g.companyAddress,
      phone: g.companyPhone,
      bizNo: g.companyBizNo,
      fax: g.companyFax,
      mobile: g.companyMobile,
    },
    reference: g.reference,
    budgetDirectLabor: w.parsed ? w.parsed.summary.reduce((a, r) => a + r.labor, 0) : undefined,
    laborAgreement: w.laborAgreement,
    jointMembers: w.jointMembers,
    engineers: w.engineers,
    safetyChiefId: w.safetyChiefId,
    siteScale: w.siteScale,
    tocOrder: w.tocOrder,
    direct: w.direct,
  };
}

/** 화면 입력 → 공정표·투입계획 계산 입력 (내역서를 확정한 경우에만 계산한다) */
export function toPlanInput(w: WorkState): BuildPlanInput {
  return {
    parsed: w.confirmed ? w.parsed : null,
    startDate: w.general.startDate,
    durationDays: w.general.durationDays,
    holidaysText: w.holidaysText,
    schedule: w.schedule,
    composition: w.composition,
    remarks: w.remarks,
    locations: w.locations,
    extraLabor: w.extraLabor,
    extraEquipment: w.extraEquipment,
  };
}

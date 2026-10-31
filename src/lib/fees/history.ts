// 업체별 공사 이력과 할인 판정 입력 (SRS SR-FEE-14·15, docs/RETENTION.md)
// 업체는 사업자등록번호(정규화)로 묶는다. 공사 저장소·용역비·납품 이력을 읽기만 한다.
// service.ts가 이 파일을 불러오므로 service.ts에서는 타입만 가져온다(순환 불러오기 방지).

import { normalizeBizNo } from "@/domain/biz-no";
import type { FeeRecord } from "@/domain/fee-ledger";
import { availableReferralCredits, priceFee, type PricedFee, type PriorProject } from "@/domain/retention-pricing";
import type { ProjectStore } from "@/lib/ports/projects";
import type { FeeDeps } from "./service";

export type HistoryDeps = FeeDeps & { projects: ProjectStore };

export type CompanyProject = {
  id: string;
  createdAt: string;
  /** 정규화한 사업자등록번호. 입력이 없거나 형식이 틀리면 null */
  bizNo: string | null;
  /** 소개한 업체의 사업자등록번호(정규화) */
  referrer: string | null;
  fee: FeeRecord | null;
  /** 첫 납품(최종 출력) 날짜(한국 시간) */
  deliveredAt: string | null;
};

const kstDate = (iso: string): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));

const isVoid = (f: FeeRecord | null) => f !== null && (f.status === "환불" || f.status === "취소");

/** 모든 공사를 업체 번호·소개·용역비·납품일과 함께 읽는다. 오래된 공사부터 정렬한다. */
export async function loadCompanyProjects(deps: HistoryDeps): Promise<CompanyProject[]> {
  const out: CompanyProject[] = [];
  for (const s of await deps.projects.list()) {
    const p = await deps.projects.get(s.id);
    if (!p) continue;
    const deliveries = await deps.delivery.list(s.id);
    const first = deliveries.map((d) => d.at).sort()[0];
    out.push({
      id: s.id,
      createdAt: s.createdAt,
      bizNo: normalizeBizNo(p.data.general.companyBizNo ?? ""),
      referrer: normalizeBizNo(p.data.general.referrerBizNo ?? ""),
      fee: await deps.fees.get(s.id),
      deliveredAt: first ? kstDate(first) : null,
    });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/** 이 공사에 적용할 할인을 계산한다. 사업자등록번호가 없으면 정가다. */
export async function priceProject(deps: HistoryDeps, projectId: string, today: string): Promise<PricedFee> {
  const baseSupply = (await deps.reference.get()).feeSupply;
  const self = await deps.projects.get(projectId);
  const bizNo = self ? normalizeBizNo(self.data.general.companyBizNo ?? "") : null;
  if (!bizNo) return priceFee({ today, priorProjects: [], referralCredit: false, baseSupply });

  const others = (await loadCompanyProjects(deps)).filter((p) => p.id !== projectId);
  const mine = others.filter((p) => p.bizNo === bizNo);
  const priorProjects: PriorProject[] = mine.map((p) => ({ deliveredAt: p.deliveredAt, feeStatus: p.fee?.status ?? "미입금" }));

  // 소개 보상: 내가 소개한 업체(첫 공사가 나를 소개자로 적은 업체)가 첫 용역비를 입금하면 1건당 크레딧 1개
  const firstOf = new Map<string, CompanyProject>();
  for (const p of others) if (p.bizNo && p.bizNo !== bizNo && !firstOf.has(p.bizNo)) firstOf.set(p.bizNo, p);
  const referred = [...firstOf.values()]
    .filter((p) => p.referrer === bizNo)
    .map((p) => ({ firstFeeStatus: p.fee?.status ?? ("미입금" as const) }));
  const used = mine.filter((p) => p.fee?.discount?.referralApplied === true && !isVoid(p.fee)).length;

  return priceFee({ today, priorProjects, referralCredit: availableReferralCredits(referred, used) > 0, baseSupply });
}

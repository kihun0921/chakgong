// 할인 재산정과 리텐션 지표 (SRS SR-FEE-14·15, docs/RETENTION.md)

import { normalizeBizNo } from "@/domain/biz-no";
import { repriceFee } from "@/domain/fee-ledger";
import {
  referralRate,
  reorderIntervals,
  reorderRate,
  type ReferralRate,
  type ReorderInterval,
  type ReorderRate,
} from "@/domain/retention-metrics";
import type { GeneralInfo } from "@/lib/projects/types";
import { loadCompanyProjects, priceProject, type HistoryDeps } from "./history";
import { createFeeFor, todayKst, withProjectLock, type FeeActionResult, type FeeDeps } from "./service";

/** 납품·입금 전 공사의 할인을 다시 정한다. 금액이 바뀌면 이력(fee.reprice)을 남긴다. */
export function repriceFor(deps: FeeDeps, projectId: string, by: string, now = new Date()): Promise<FeeActionResult> {
  return withProjectLock(projectId, async () => {
    const fee = await createFeeFor(deps, projectId, by, now);
    if (!deps.projects) return { ok: false, message: "공사 저장소가 없어 할인을 다시 계산할 수 없습니다.", fee };
    const priced = await priceProject({ ...deps, projects: deps.projects }, projectId, todayKst(now));
    const r = repriceFee(fee, priced, await deps.delivery.hasDelivered(projectId));
    if (!r.ok) return { ok: false, message: r.message, fee };
    if (!r.changed) return { ok: true, fee, message: "할인 변동이 없습니다." };
    await deps.fees.put(r.fee);
    await deps.audit.record({
      user: by,
      action: "fee.reprice",
      target: projectId,
      detail: { beforeTotal: fee.total, afterTotal: r.fee.total, discountRate: r.fee.discount?.rate ?? 0 },
    });
    return { ok: true, fee: r.fee, message: `용역비를 ${r.fee.total.toLocaleString("ko-KR")}원으로 다시 정했습니다.` };
  });
}

/** 공사 저장 뒤 업체 번호나 소개 업체가 바뀌었을 때만 할인을 다시 정한다(저장마다 전체 공사를 읽지 않도록). */
export async function repriceIfCompanyChanged(
  deps: FeeDeps,
  projectId: string,
  before: GeneralInfo,
  after: GeneralInfo,
  by: string,
): Promise<FeeActionResult | null> {
  const key = (g: GeneralInfo) => [normalizeBizNo(g.companyBizNo ?? ""), normalizeBizNo(g.referrerBizNo ?? "")].join("|");
  if (key(before) === key(after)) return null;
  return repriceFor(deps, projectId, by);
}

export type RetentionReport = {
  asOf: string;
  reorder: ReorderRate;
  intervals: ReorderInterval[];
  referral: ReferralRate;
  /** 할인이 적용된 공사 수와 공급가액 기준 할인 총액(환불·취소 공사 제외) */
  discounted: { count: number; totalWon: number };
  /** 사업자등록번호를 입력하지 않았거나 형식이 틀려 집계에서 뺀 공사 수 */
  missingBizNo: number;
};

export async function retentionReport(deps: HistoryDeps, asOf: string): Promise<RetentionReport> {
  const all = await loadCompanyProjects(deps);
  const withBiz = all.filter((p): p is typeof p & { bizNo: string } => p.bizNo !== null);

  const deliveries = withBiz.filter((p) => p.deliveredAt !== null).map((p) => ({ bizNo: p.bizNo, deliveredAt: p.deliveredAt as string }));

  // 신규 업체의 소개 여부는 업체의 첫 공사(오래된 순)에 적힌 소개자로 본다
  const firstOf = new Map<string, (typeof withBiz)[number]>();
  for (const p of withBiz) if (!firstOf.has(p.bizNo)) firstOf.set(p.bizNo, p);

  const active = all.filter((p) => p.fee?.discount && p.fee.discount.rate > 0 && p.fee.status !== "환불" && p.fee.status !== "취소");

  return {
    asOf,
    reorder: reorderRate(deliveries, asOf),
    intervals: reorderIntervals(deliveries),
    referral: referralRate([...firstOf.values()].map((p) => ({ referrerBizNo: p.referrer }))),
    discounted: { count: active.length, totalWon: active.reduce((sum, p) => sum + (p.fee?.discount?.amountWon ?? 0), 0) },
    missingBizNo: all.length - withBiz.length,
  };
}

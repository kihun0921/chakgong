// 재의뢰·단골·소개 할인 (SRS SR-FEE-14, docs/RETENTION.md 3장 D·E)
// 순수 함수: 같은 입력이면 항상 같은 결과다(SR-NF-08). 금액은 원 단위 정수.
// 비율·기간·상한은 코드에 박지 않고 설정으로 받는다(SR-DM-04).

import { diffDays, type DateStr } from "./calendar";
import { DEFAULT_SUPPLY_WON, calcFee, type Fee } from "./fee";
import type { FeeStatus } from "./fee-ledger";

export type RetentionConfig = {
  /** 직전 납품일부터 새 공사 생성일까지 이 일수 이내(포함)면 재의뢰 */
  windowDays: number;
  reorderRate: number; // %
  loyalRate: number; // %
  /** 이 순번의 공사부터 단골 할인 */
  loyalFromOrder: number;
  referralRate: number; // %
  /** 할인 합계 상한(%) */
  capRate: number;
  /** 직전 건이 '입금 완료'일 때만 재의뢰 할인 */
  requirePaid: boolean;
};

export const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  windowDays: 180,
  reorderRate: 10,
  loyalRate: 15,
  loyalFromOrder: 3,
  referralRate: 5,
  capRate: 20,
  requirePaid: true,
};

/** 같은 사업자등록번호 업체의 이전 공사 */
export type PriorProject = { deliveredAt: DateStr | null; feeStatus: FeeStatus };

export type LoyaltyReason = "first" | "expired" | "unpaid" | "reorder" | "loyal";
export type LoyaltyResult = { rate: number; reason: LoyaltyReason; /** 새 공사가 연속 몇 번째인가 */ order: number };

type Delivered = { deliveredAt: DateStr; feeStatus: FeeStatus };

/** 환불·취소 공사, 납품 이력이 없는 공사, 새 공사 생성일보다 나중에 납품된 공사는 이전 공사로 세지 않는다. 최근 납품이 앞에 온다. */
function deliveredNewestFirst(today: DateStr, prior: PriorProject[]): Delivered[] {
  return prior
    .filter((p): p is Delivered => p.deliveredAt !== null && p.deliveredAt <= today && p.feeStatus !== "환불" && p.feeStatus !== "취소")
    .sort((a, b) => (a.deliveredAt < b.deliveredAt ? 1 : a.deliveredAt > b.deliveredAt ? -1 : 0));
}

export function loyaltyDiscount(
  today: DateStr,
  prior: PriorProject[],
  config: RetentionConfig = DEFAULT_RETENTION_CONFIG,
): LoyaltyResult {
  const list = deliveredNewestFirst(today, prior);
  if (list.length === 0) return { rate: 0, reason: "first", order: 1 };

  const latest = list[0];
  if (diffDays(latest.deliveredAt, today) > config.windowDays) return { rate: 0, reason: "expired", order: 1 };
  if (config.requirePaid && latest.feeStatus !== "입금 완료") return { rate: 0, reason: "unpaid", order: 1 };

  let chain = 1;
  while (chain < list.length && diffDays(list[chain].deliveredAt, list[chain - 1].deliveredAt) <= config.windowDays) {
    chain += 1;
  }
  const order = chain + 1;
  return order >= config.loyalFromOrder
    ? { rate: config.loyalRate, reason: "loyal", order }
    : { rate: config.reorderRate, reason: "reorder", order };
}

/** 소개한 업체의 첫 용역비가 '입금 완료'인 건수에서 이미 쓴 크레딧을 뺀 수 */
export function availableReferralCredits(referred: { firstFeeStatus: FeeStatus }[], used: number): number {
  const earned = referred.filter((r) => r.firstFeeStatus === "입금 완료").length;
  return Math.max(0, earned - used);
}

export type PriceInput = {
  today: DateStr;
  priorProjects: PriorProject[];
  /** 이 공사에 쓸 소개 크레딧이 있는가 */
  referralCredit: boolean;
  baseSupply?: number;
};

export type PricedFee = Fee & {
  rate: number;
  loyalty: LoyaltyResult;
  referralApplied: boolean;
  /** 공급가액에서 깎은 금액(원) */
  discountWon: number;
};

/** 공급가액에만 할인을 반영하고 부가세·합계를 다시 계산한다. 할인액은 내림. */
export function priceFee(input: PriceInput, config: RetentionConfig = DEFAULT_RETENTION_CONFIG): PricedFee {
  const base = input.baseSupply ?? DEFAULT_SUPPLY_WON;
  const loyalty = loyaltyDiscount(input.today, input.priorProjects, config);
  const referralApplied = input.referralCredit;
  const rate = Math.min(loyalty.rate + (referralApplied ? config.referralRate : 0), config.capRate);
  const discountWon = Math.floor((base * rate) / 100);
  return { ...calcFee(base - discountWon), rate, loyalty, referralApplied, discountWon };
}

// 용역비 내역과 상태 규칙 (SRS SR-FEE-01~13, SR-ADM-01·05, D-1·D-2·D-8~D-10·D-15)
// 순수 함수: 화면·저장소와 무관하게 같은 입력이면 같은 결과를 낸다. 금액은 모두 정수(원).
// 후불이므로 '미입금'에서도 출력할 수 있다. 카드·계좌 인증 정보는 다루지 않는다(SR-FEE-11).

import { addDays, diffDays, type DateStr } from "./calendar";
import { calcFee, formatWon } from "./fee";
import type { LoyaltyReason, PricedFee } from "./retention-pricing";

export type FeeStatus = "미입금" | "입금 완료" | "환불" | "취소";
export const FEE_STATUSES: FeeStatus[] = ["미입금", "입금 완료", "환불", "취소"];

export const REFUND_DAYS = 7;
export const REFUND_WARN_DAYS = 2;

/** 재의뢰·단골·소개 할인 내용 (SR-FEE-14). 할인 판정을 거친 공사에 기록된다. */
export type FeeDiscount = { rate: number; reason: LoyaltyReason; referralApplied: boolean; amountWon: number };

export type FeeRecord = {
  projectId: string;
  supply: number;
  vat: number;
  total: number;
  discount?: FeeDiscount;
  status: FeeStatus;
  taxInvoice: { issued: boolean; date: DateStr | null };
  payment: { date: DateStr; payer: string; amount: number } | null;
  /** 입금액이 맞지 않았던 입력 등을 보존하는 메모 (D-15) */
  memo: string;
  /** 환불 요청일(의뢰 취소 기록일). 입금 완료 건을 취소할 때만 생긴다 */
  cancelRequestedAt: DateStr | null;
  refundedAt: DateStr | null;
  createdAt: DateStr;
};

export type PaymentInput = { date: string; payer: string; amount: number };

export function createFee(projectId: string, supply: number, createdAt: DateStr): FeeRecord {
  const f = calcFee(supply);
  return {
    projectId,
    ...f,
    status: "미입금",
    taxInvoice: { issued: false, date: null },
    payment: null,
    memo: "",
    cancelRequestedAt: null,
    refundedAt: null,
    createdAt,
  };
}

export const toDiscount = (p: PricedFee): FeeDiscount => ({
  rate: p.rate,
  reason: p.loyalty.reason,
  referralApplied: p.referralApplied,
  amountWon: p.discountWon,
});

export type RepriceResult =
  | { ok: true; fee: FeeRecord; changed: boolean }
  | { ok: false; reason: "paid" | "delivered" | "closed"; message: string; fee: FeeRecord };

/**
 * 할인 재산정 (SR-FEE-14): '미입금'이고 납품 전이며 환불 요청·환불·취소가 아닐 때만 금액을 다시 정한다.
 * 입금·납품 뒤에는 기록된 금액을 바꾸지 않는다(SR-FEE-06).
 */
export function repriceFee(fee: FeeRecord, priced: PricedFee, delivered: boolean): RepriceResult {
  if (fee.status === "환불" || fee.status === "취소" || fee.cancelRequestedAt !== null) {
    return { ok: false, reason: "closed", message: "환불 요청·환불·취소된 공사의 금액은 바꿀 수 없습니다.", fee };
  }
  if (fee.status === "입금 완료") {
    return { ok: false, reason: "paid", message: "입금 완료된 공사의 금액은 바꿀 수 없습니다.", fee };
  }
  if (delivered) {
    return { ok: false, reason: "delivered", message: "납품한 공사의 금액은 바꿀 수 없습니다.", fee };
  }
  const discount = toDiscount(priced);
  const next: FeeRecord = { ...fee, supply: priced.supply, vat: priced.vat, total: priced.total, discount };
  const changed =
    fee.supply !== next.supply || fee.vat !== next.vat || fee.total !== next.total || JSON.stringify(fee.discount) !== JSON.stringify(discount);
  return { ok: true, fee: next, changed };
}

const appendMemo = (memo: string, line: string) => (memo ? `${memo}\n${line}` : line);

/** 환불 요청 중이거나 환불·취소로 끝난 공사인가 */
const isClosed = (f: FeeRecord) => f.status === "환불" || f.status === "취소" || f.cancelRequestedAt !== null;

export type PaymentResult =
  | { ok: true; fee: FeeRecord }
  | { ok: false; reason: "missing"; missing: string[]; fee: FeeRecord }
  | { ok: false; reason: "mismatch"; diff: number; fee: FeeRecord }
  | { ok: false; reason: "duplicate" | "closed"; message: string; fee: FeeRecord };

/** 입금 확인 기록 (SR-FEE-03·04). 맞지 않으면 상태를 바꾸지 않는다. */
export function recordPayment(fee: FeeRecord, input: PaymentInput): PaymentResult {
  if (fee.status === "입금 완료" && !fee.cancelRequestedAt) {
    return { ok: false, reason: "duplicate", message: "이미 입금 완료로 기록된 공사입니다.", fee };
  }
  if (isClosed(fee)) {
    return { ok: false, reason: "closed", message: "환불 요청·환불·취소된 공사에는 입금을 기록할 수 없습니다.", fee };
  }
  const missing: string[] = [];
  if (input.date.trim() === "") missing.push("입금일");
  if (input.payer.trim() === "") missing.push("입금자명");
  if (!Number.isInteger(input.amount) || input.amount <= 0) missing.push("입금액");
  if (missing.length > 0) return { ok: false, reason: "missing", missing, fee };

  if (input.amount !== fee.total) {
    const diff = input.amount - fee.total;
    const note = `입금 확인 시도 ${input.date} ${input.payer.trim()} ${formatWon(input.amount)} (합계 ${formatWon(fee.total)}과 차액 ${diff.toLocaleString("ko-KR")}원)`;
    return { ok: false, reason: "mismatch", diff, fee: { ...fee, memo: appendMemo(fee.memo, note) } };
  }
  return {
    ok: true,
    fee: { ...fee, status: "입금 완료", payment: { date: input.date, payer: input.payer.trim(), amount: input.amount } },
  };
}

/** 세금계산서 발행 여부·발행일 (SR-FEE-05). 시스템은 세금계산서를 발행하지 않고 기록만 한다. */
export function recordTaxInvoice(fee: FeeRecord, t: { issued: boolean; date: DateStr | null }): FeeRecord {
  return { ...fee, taxInvoice: { issued: t.issued, date: t.issued ? t.date : null } };
}

export type CancelResult =
  | { ok: true; fee: FeeRecord; refundDue: DateStr | null }
  | { ok: false; reason: "delivered" | "closed"; message: string };

/** 의뢰 취소 (SR-FEE-07). 납품 이력이 있으면 환불·취소로 처리하지 않는다. */
export function requestCancel(fee: FeeRecord, delivered: boolean, today: DateStr): CancelResult {
  if (delivered) {
    return { ok: false, reason: "delivered", message: "납품 후에는 환불할 수 없습니다. 용역비 상태는 그대로 둡니다." };
  }
  if (isClosed(fee)) return { ok: false, reason: "closed", message: "이미 환불 요청·환불·취소가 기록된 공사입니다." };
  if (fee.status === "입금 완료") {
    return { ok: true, fee: { ...fee, cancelRequestedAt: today }, refundDue: addDays(today, REFUND_DAYS) };
  }
  return { ok: true, fee: { ...fee, status: "취소" }, refundDue: null };
}

export type RefundResult = { ok: true; fee: FeeRecord } | { ok: false; message: string };

/** 환불일 기록 → '환불' (SR-FEE-07 가). 환불 요청이 있는 입금 완료 건만 가능하다. */
export function recordRefund(fee: FeeRecord, date: DateStr): RefundResult {
  if (fee.status !== "입금 완료" || !fee.cancelRequestedAt) {
    return { ok: false, message: "환불 요청이 기록된 입금 완료 건만 환불 처리할 수 있습니다." };
  }
  if (date.trim() === "") return { ok: false, message: "환불일을 입력해 주세요." };
  if (date < fee.cancelRequestedAt) return { ok: false, message: `환불일은 환불 요청일(${fee.cancelRequestedAt}) 이후여야 합니다.` };
  return { ok: true, fee: { ...fee, status: "환불", refundedAt: date } };
}

/** 최종 출력 허용 여부 (SR-OUT-01, SR-FEE-02·08). 입금 여부는 보지 않는다(후불). */
export function canExport(fee: FeeRecord): { ok: true } | { ok: false; message: string } {
  if (fee.status === "환불" || fee.status === "취소") {
    return { ok: false, message: `용역비가 '${fee.status}'인 공사는 출력하지 않습니다. 다시 의뢰되면 공사를 복제해 새로 진행해 주세요.` };
  }
  if (fee.cancelRequestedAt) return { ok: false, message: "환불 요청이 기록된 공사는 출력하지 않습니다." };
  return { ok: true };
}

export type RefundAlert = "none" | "imminent" | "overdue";

/** 환불 기한(요청일+7일) 표시 (SR-FEE-09, D-8): 기한 2일 전부터 '임박', 넘기면 '초과'. */
export function refundAlert(fee: FeeRecord, today: DateStr): RefundAlert {
  if (!fee.cancelRequestedAt || fee.refundedAt) return "none";
  const left = diffDays(today, addDays(fee.cancelRequestedAt, REFUND_DAYS));
  if (left < 0) return "overdue";
  return left <= REFUND_WARN_DAYS ? "imminent" : "none";
}

/** 용역비 상태와 납품 이력이 맞지 않으면 알릴 문장을 돌려준다 (SR-FEE-13). */
export function detectInconsistency(fee: FeeRecord, delivered: boolean): string | null {
  if (delivered && (fee.status === "환불" || fee.status === "취소")) {
    return `용역비 상태가 '${fee.status}'인데 납품 이력이 있습니다. 확인해 주세요.`;
  }
  if (delivered && fee.cancelRequestedAt) return "환불 요청이 있는데 납품 이력이 있습니다. 확인해 주세요.";
  return null;
}

export type FeeSummary = {
  count: number;
  supply: number;
  vat: number;
  total: number;
  byStatus: Record<FeeStatus, number>;
  /** 미입금 건의 합계 */
  receivable: number;
  refundAlerts: { projectId: string; level: Exclude<RefundAlert, "none">; due: DateStr }[];
};

/** 기간(생성일 기준, 양끝 포함)의 용역비 집계 (SR-ADM-01·05). 개별 내역의 합과 항상 같다. */
export function summarizeFees(fees: FeeRecord[], from: DateStr, to: DateStr, today: DateStr): FeeSummary {
  const inRange = fees.filter((f) => f.createdAt >= from && f.createdAt <= to);
  const byStatus: Record<FeeStatus, number> = { 미입금: 0, "입금 완료": 0, 환불: 0, 취소: 0 };
  const s: FeeSummary = { count: inRange.length, supply: 0, vat: 0, total: 0, byStatus, receivable: 0, refundAlerts: [] };
  for (const f of inRange) {
    s.supply += f.supply;
    s.vat += f.vat;
    s.total += f.total;
    byStatus[f.status] += 1;
    if (f.status === "미입금") s.receivable += f.total;
    const level = refundAlert(f, today);
    if (level !== "none" && f.cancelRequestedAt) {
      s.refundAlerts.push({ projectId: f.projectId, level, due: addDays(f.cancelRequestedAt, REFUND_DAYS) });
    }
  }
  return s;
}

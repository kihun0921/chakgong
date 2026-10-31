import { describe, expect, it } from "vitest";
import { createFee, recordPayment } from "./fee-ledger";
import {
  DEFAULT_RETENTION_CONFIG,
  availableReferralCredits,
  loyaltyDiscount,
  priceFee,
  type PriorProject,
} from "./retention-pricing";

// docs/RETENTION.md 3장 D·E / T-47~T-50
// 새 공사 생성일 = 2026-11-01. 180일 전은 2026-05-05(포함), 181일 전은 2026-05-04(초과).
const TODAY = "2026-11-01";
const paid = (deliveredAt: string | null): PriorProject => ({ deliveredAt, feeStatus: "입금 완료" });

describe("재의뢰 할인 판정 (T-47, 180일 롤링)", () => {
  it("납품 이력이 없는 업체는 정가다", () => {
    expect(loyaltyDiscount(TODAY, [])).toMatchObject({ rate: 0, reason: "first" });
  });

  it("직전 납품이 180일 이내이고 입금 완료면 10%다", () => {
    expect(loyaltyDiscount(TODAY, [paid("2026-08-01")])).toMatchObject({ rate: 10, reason: "reorder" });
  });

  it("경계: 정확히 180일 전 납품은 포함하고 181일 전은 정가다", () => {
    expect(loyaltyDiscount(TODAY, [paid("2026-05-05")])).toMatchObject({ rate: 10 });
    expect(loyaltyDiscount(TODAY, [paid("2026-05-04")])).toMatchObject({ rate: 0, reason: "expired" });
  });

  it("직전 건이 '미입금'이면 할인하지 않는다", () => {
    const r = loyaltyDiscount(TODAY, [{ deliveredAt: "2026-08-01", feeStatus: "미입금" }]);
    expect(r).toMatchObject({ rate: 0, reason: "unpaid" });
  });

  it("입금 여부는 가장 최근 납품 건만 본다(그 이전 건의 미입금은 영향 없음)", () => {
    const r = loyaltyDiscount(TODAY, [
      { deliveredAt: "2026-01-01", feeStatus: "미입금" },
      paid("2026-09-01"),
    ]);
    expect(r).toMatchObject({ rate: 10, reason: "reorder" });
  });

  it("환불·취소 공사와 납품 이력이 없는 공사는 직전 납품으로 세지 않는다", () => {
    const r = loyaltyDiscount(TODAY, [
      paid("2026-08-01"),
      { deliveredAt: "2026-09-15", feeStatus: "환불" },
      { deliveredAt: "2026-10-01", feeStatus: "취소" },
      { deliveredAt: null, feeStatus: "미입금" },
    ]);
    expect(r).toMatchObject({ rate: 10, reason: "reorder" });
  });

  it("새 공사 생성일보다 나중에 납품된 공사는 이전 공사가 아니다", () => {
    expect(loyaltyDiscount(TODAY, [paid("2026-11-15")])).toMatchObject({ rate: 0, reason: "first" });
  });

  it("전달 순서와 관계없이 같은 결과다(SR-NF-08)", () => {
    const a = [paid("2026-01-10"), paid("2026-05-10")];
    const b = [paid("2026-05-10"), paid("2026-01-10")];
    expect(loyaltyDiscount("2026-09-01", a)).toEqual(loyaltyDiscount("2026-09-01", b));
  });
});

describe("단골 할인: 연속 3번째 공사부터 15% (T-47)", () => {
  it("180일 이내로 이어진 3번째 공사는 15%다", () => {
    const r = loyaltyDiscount("2026-09-01", [paid("2026-01-10"), paid("2026-05-10")]);
    expect(r).toMatchObject({ rate: 15, reason: "loyal", order: 3 });
  });

  it("중간에 180일을 넘게 끊겼으면 사슬이 끊겨 10%다", () => {
    const r = loyaltyDiscount("2026-09-01", [paid("2025-01-10"), paid("2026-05-10")]);
    expect(r).toMatchObject({ rate: 10, reason: "reorder", order: 2 });
  });
});

describe("소개 보상 크레딧 (T-48)", () => {
  it("소개한 업체가 첫 용역비를 입금했을 때만 크레딧이 생긴다", () => {
    expect(availableReferralCredits([{ firstFeeStatus: "입금 완료" }, { firstFeeStatus: "미입금" }], 0)).toBe(1);
  });

  it("쓴 크레딧만큼 줄고 0 미만이 되지 않는다", () => {
    const refs = [{ firstFeeStatus: "입금 완료" as const }, { firstFeeStatus: "입금 완료" as const }];
    expect(availableReferralCredits(refs, 1)).toBe(1);
    expect(availableReferralCredits(refs, 5)).toBe(0);
  });

  it("환불·취소된 소개 건은 크레딧이 아니다", () => {
    expect(availableReferralCredits([{ firstFeeStatus: "환불" }, { firstFeeStatus: "취소" }], 0)).toBe(0);
  });
});

describe("할인 반영 용역비 (T-49)", () => {
  const base = { today: TODAY, referralCredit: false };

  it("정가: 500,000 + 50,000 = 550,000", () => {
    expect(priceFee({ ...base, priorProjects: [] })).toMatchObject({
      rate: 0, supply: 500_000, vat: 50_000, total: 550_000,
    });
  });

  it("재의뢰 10%: 450,000 + 45,000 = 495,000", () => {
    expect(priceFee({ ...base, priorProjects: [paid("2026-08-01")] })).toMatchObject({
      rate: 10, supply: 450_000, vat: 45_000, total: 495_000,
    });
  });

  it("단골 15%: 425,000 + 42,500 = 467,500", () => {
    const r = priceFee({ today: "2026-09-01", referralCredit: false, priorProjects: [paid("2026-01-10"), paid("2026-05-10")] });
    expect(r).toMatchObject({ rate: 15, supply: 425_000, vat: 42_500, total: 467_500 });
  });

  it("재의뢰 + 소개 = 15%: 467,500", () => {
    const r = priceFee({ today: TODAY, referralCredit: true, priorProjects: [paid("2026-08-01")] });
    expect(r).toMatchObject({ rate: 15, total: 467_500 });
  });

  it("단골 + 소개 = 20%: 400,000 + 40,000 = 440,000", () => {
    const r = priceFee({ today: "2026-09-01", referralCredit: true, priorProjects: [paid("2026-01-10"), paid("2026-05-10")] });
    expect(r).toMatchObject({ rate: 20, supply: 400_000, vat: 40_000, total: 440_000 });
  });

  it("첫 의뢰라도 소개 크레딧이 있으면 5%: 475,000 + 47,500 = 522,500", () => {
    const r = priceFee({ ...base, referralCredit: true, priorProjects: [] });
    expect(r).toMatchObject({ rate: 5, supply: 475_000, vat: 47_500, total: 522_500 });
  });

  it("할인 합계는 상한(20%)을 넘지 않는다. 비율은 설정값이다(SR-DM-04)", () => {
    const cfg = { ...DEFAULT_RETENTION_CONFIG, loyalRate: 18 };
    const r = priceFee(
      { today: "2026-09-01", referralCredit: true, priorProjects: [paid("2026-01-10"), paid("2026-05-10")] },
      cfg,
    );
    expect(r.rate).toBe(20);
    expect(r.supply).toBe(400_000);
  });

  it("기준 공급가액이 달라도 결과는 원 단위 정수다(할인액은 내림)", () => {
    const r = priceFee({ ...base, baseSupply: 333_333, priorProjects: [paid("2026-08-01")] });
    expect([r.supply, r.vat, r.total].every(Number.isInteger)).toBe(true);
    expect(r.supply).toBe(300_000); // 할인액 floor(33,333.3) = 33,333
  });

  it("같은 입력이면 항상 같은 결과다(SR-NF-08)", () => {
    const input = { ...base, priorProjects: [paid("2026-08-01")] };
    expect(priceFee(input)).toEqual(priceFee(input));
  });
});

// SR-FEE-03·04 변경 승인: 입금 확인은 공사에 기록된(할인 반영) 합계와 비교한다.
describe("할인 용역비의 입금 확인 (T-50, SR-FEE-03·04, D-15)", () => {
  const discounted = () => {
    const p = priceFee({ today: TODAY, referralCredit: false, priorProjects: [paid("2026-08-01")] });
    return createFee("p2", p.supply, TODAY);
  };
  const pay = { date: "2026-11-05", payer: "홍길동", amount: 495_000 };

  it("기록된 합계(495,000원)와 같은 입금액이면 '입금 완료'다", () => {
    const r = recordPayment(discounted(), pay);
    expect(r.ok).toBe(true);
  });

  it("정가(550,000원)를 입금하면 불일치로 차액 +55,000원을 알려 주고 상태를 바꾸지 않는다", () => {
    const r = recordPayment(discounted(), { ...pay, amount: 550_000 });
    expect(r).toMatchObject({ ok: false, reason: "mismatch", diff: 55_000 });
  });
});

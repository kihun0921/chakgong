import { describe, expect, it } from "vitest";
import { createFee, recordPayment, repriceFee } from "./fee-ledger";
import { priceFee, type PriorProject } from "./retention-pricing";

// docs/RETENTION.md 3장 D / T-54: 납품·입금 전까지만 할인 금액을 다시 정한다(개발자 결정).
const TODAY = "2026-11-01";
const prior: PriorProject[] = [{ deliveredAt: "2026-08-01", feeStatus: "입금 완료" }];
const discounted = () => priceFee({ today: TODAY, referralCredit: false, priorProjects: prior });
const fee = () => createFee("p1", 500_000, "2026-11-01");

describe("할인 재산정 (T-54, SR-FEE-14)", () => {
  it("'미입금'이고 납품 전이면 금액과 할인 정보를 바꾼다", () => {
    const r = repriceFee(fee(), discounted(), false);
    expect(r).toMatchObject({ ok: true, changed: true });
    if (r.ok) {
      expect([r.fee.supply, r.fee.vat, r.fee.total]).toEqual([450_000, 45_000, 495_000]);
      expect(r.fee.discount).toEqual({ rate: 10, reason: "reorder", referralApplied: false, amountWon: 50_000 });
      expect(r.fee.status).toBe("미입금");
    }
  });

  it("계산 결과가 같으면 바뀐 것이 없다", () => {
    const first = repriceFee(fee(), discounted(), false);
    if (!first.ok) throw new Error("setup");
    expect(repriceFee(first.fee, discounted(), false)).toMatchObject({ ok: true, changed: false });
  });

  it("할인이 사라지면 정가로 되돌린다", () => {
    const first = repriceFee(fee(), discounted(), false);
    if (!first.ok) throw new Error("setup");
    const none = priceFee({ today: TODAY, referralCredit: false, priorProjects: [] });
    const back = repriceFee(first.fee, none, false);
    expect(back).toMatchObject({ ok: true, changed: true });
    if (back.ok) expect(back.fee.total).toBe(550_000);
  });

  it("납품했으면 금액을 바꾸지 않는다", () => {
    const r = repriceFee(fee(), discounted(), true);
    expect(r).toMatchObject({ ok: false, reason: "delivered" });
    if (!r.ok) expect(r.fee.total).toBe(550_000);
  });

  it("입금 완료면 금액을 바꾸지 않는다", () => {
    const paid = recordPayment(fee(), { date: "2026-11-02", payer: "홍길동", amount: 550_000 });
    if (!paid.ok) throw new Error("setup");
    expect(repriceFee(paid.fee, discounted(), false)).toMatchObject({ ok: false, reason: "paid" });
  });

  it("환불 요청·환불·취소된 공사는 바꾸지 않는다", () => {
    const closed = { ...fee(), status: "취소" as const };
    expect(repriceFee(closed, discounted(), false)).toMatchObject({ ok: false, reason: "closed" });
    const requested = { ...fee(), cancelRequestedAt: "2026-11-02" };
    expect(repriceFee(requested, discounted(), false)).toMatchObject({ ok: false, reason: "closed" });
  });
});

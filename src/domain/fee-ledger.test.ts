import { describe, expect, it } from "vitest";
import {
  canExport,
  createFee,
  detectInconsistency,
  recordPayment,
  recordRefund,
  recordTaxInvoice,
  refundAlert,
  requestCancel,
  summarizeFees,
} from "./fee-ledger";

// SRS SR-FEE-01~13, SR-ADM-01·05 / T-28~T-33, T-38, T-39, T-43, T-34
const fee = () => createFee("p1", 500_000, "2026-10-01");
const pay = { date: "2026-10-05", payer: "홍길동", amount: 550_000 };
const paidFee = () => {
  const r = recordPayment(fee(), pay);
  if (!r.ok) throw new Error("setup");
  return r.fee;
};
const cancelledPaid = () => {
  const c = requestCancel(paidFee(), false, "2026-10-10");
  if (!c.ok) throw new Error("setup");
  return c.fee;
};

describe("용역비 생성 (SR-FEE-01)", () => {
  it("공급가액 500,000 + 부가세 50,000 = 합계 550,000, '미입금'으로 시작", () => {
    const f = fee();
    expect([f.supply, f.vat, f.total, f.status]).toEqual([500_000, 50_000, 550_000, "미입금"]);
  });
});

describe("후불 출력 (T-28, SR-FEE-02)", () => {
  it("미입금 상태에서도 출력할 수 있고 금액·상태는 그대로다", () => {
    const f = fee();
    expect(canExport(f)).toEqual({ ok: true });
    expect(f.status).toBe("미입금");
  });
});

describe("입금 확인 (T-29·T-30, SR-FEE-03·04, D-15)", () => {
  it("입금일·입금자명·550,000원이 맞으면 '입금 완료'", () => {
    const f = paidFee();
    expect(f.status).toBe("입금 완료");
    expect(f.payment).toEqual(pay);
  });
  it("항목이 비면 상태를 바꾸지 않고 누락 항목을 알려 준다", () => {
    const r = recordPayment(fee(), { date: "", payer: " ", amount: 550_000 });
    expect(r).toMatchObject({ ok: false, reason: "missing", missing: ["입금일", "입금자명"] });
  });
  it("금액이 다르면 상태를 바꾸지 않고 차액을 알려 주며, 입력 내용은 메모로 남긴다", () => {
    const r = recordPayment(fee(), { ...pay, amount: 500_000 });
    expect(r).toMatchObject({ ok: false, reason: "mismatch", diff: -50_000 });
    if (!r.ok && r.reason === "mismatch") {
      expect(r.fee.status).toBe("미입금");
      expect(r.fee.payment).toBeNull();
      expect(r.fee.memo).toContain("500,000");
      expect(r.fee.memo).toContain("홍길동");
    }
  });
  it("이미 입금 완료면 중복 기록을 만들지 않는다", () => {
    const again = recordPayment(paidFee(), { ...pay, date: "2026-10-06" });
    expect(again).toMatchObject({ ok: false, reason: "duplicate" });
  });
  it("환불 요청이 있거나 환불·취소된 공사에는 입금을 기록하지 않는다", () => {
    expect(recordPayment(cancelledPaid(), pay)).toMatchObject({ ok: false, reason: "closed" });
  });
});

describe("세금계산서 (SR-FEE-05)", () => {
  it("입금 전에도 발행 여부·발행일을 기록할 수 있다", () => {
    const f = recordTaxInvoice(fee(), { issued: true, date: "2026-10-02" });
    expect(f.taxInvoice).toEqual({ issued: true, date: "2026-10-02" });
    expect(f.status).toBe("미입금");
  });
});

describe("취소·환불 (T-32·T-33, SR-FEE-07·08)", () => {
  it("(가) 납품 없는 입금 완료: 취소하면 환불 요청일이 남고 7일 안에 환불, 환불일을 기록하면 '환불'", () => {
    const c = requestCancel(paidFee(), false, "2026-10-10");
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.fee.status).toBe("입금 완료");
    expect(c.fee.cancelRequestedAt).toBe("2026-10-10");
    expect(c.refundDue).toBe("2026-10-17");
    const r = recordRefund(c.fee, "2026-10-14");
    expect(r.ok && r.fee.status).toBe("환불");
  });
  it("(나) 납품 없는 미입금: 취소하면 바로 '취소'", () => {
    const c = requestCancel(fee(), false, "2026-10-10");
    expect(c.ok && c.fee.status).toBe("취소");
  });
  it("(다) 납품한 공사는 환불·취소를 안내와 함께 거절한다", () => {
    const c = requestCancel(paidFee(), true, "2026-10-10");
    expect(c).toMatchObject({ ok: false, reason: "delivered" });
    if (!c.ok) expect(c.message).toContain("납품 후에는 환불할 수 없습니다");
  });
  it("환불 요청이 없으면 환불일을 기록할 수 없다", () => {
    expect(recordRefund(paidFee(), "2026-10-14")).toMatchObject({ ok: false });
  });
  it("환불일이 환불 요청일보다 빠르면 거절한다", () => {
    expect(recordRefund(cancelledPaid(), "2026-10-09")).toMatchObject({ ok: false });
  });
  it("이미 취소·환불 요청된 공사에 다시 취소를 요청하면 거절한다", () => {
    expect(requestCancel(cancelledPaid(), false, "2026-10-11")).toMatchObject({ ok: false, reason: "closed" });
  });
  it("환불 요청 뒤에는 환불이 끝나기 전에도, 환불·취소 뒤에도 출력할 수 없다 (T-38)", () => {
    const c = cancelledPaid();
    expect(canExport(c)).toMatchObject({ ok: false });
    const r = recordRefund(c, "2026-10-12");
    if (!r.ok) throw new Error("setup");
    expect(canExport(r.fee)).toMatchObject({ ok: false });
    const x = requestCancel(fee(), false, "2026-10-10");
    if (!x.ok) throw new Error("setup");
    expect(canExport(x.fee)).toMatchObject({ ok: false });
  });
});

describe("환불 기한 표시 (T-43, SR-FEE-09, D-8)", () => {
  it("3일 경과까지는 표시 없음, 5일 경과(기한 2일 전)부터 '임박', 8일 경과는 '초과'", () => {
    const f = cancelledPaid();
    expect(refundAlert(f, "2026-10-13")).toBe("none");
    expect(refundAlert(f, "2026-10-15")).toBe("imminent");
    expect(refundAlert(f, "2026-10-17")).toBe("imminent");
    expect(refundAlert(f, "2026-10-18")).toBe("overdue");
  });
  it("환불일이 기록되면 표시하지 않는다", () => {
    const r = recordRefund(cancelledPaid(), "2026-10-12");
    if (!r.ok) throw new Error("setup");
    expect(refundAlert(r.fee, "2026-10-30")).toBe("none");
  });
});

describe("상태·납품 이력 불일치 감지 (T-39, SR-FEE-13)", () => {
  it("'환불'·'취소'인데 납품 이력이 있으면 알린다", () => {
    const c = requestCancel(fee(), false, "2026-10-10");
    if (!c.ok) throw new Error("setup");
    expect(detectInconsistency(c.fee, true)).not.toBeNull();
    expect(detectInconsistency(c.fee, false)).toBeNull();
    expect(detectInconsistency(fee(), true)).toBeNull();
  });
});

describe("집계 (T-34, SR-ADM-01·05)", () => {
  it("기간 안 용역비의 건수·금액 합계·상태별 건수·미수금이 개별 내역의 합과 같다", () => {
    const paidB = recordPayment(createFee("p2", 500_000, "2026-10-03"), pay);
    const cancelled = requestCancel(createFee("p4", 500_000, "2026-10-04"), false, "2026-10-09");
    if (!paidB.ok || !cancelled.ok) throw new Error("setup");
    const all = [fee(), paidB.fee, createFee("p3", 500_000, "2026-11-20"), cancelled.fee];
    const s = summarizeFees(all, "2026-10-01", "2026-10-31", "2026-10-31");
    expect(s.count).toBe(3);
    expect([s.supply, s.vat, s.total]).toEqual([1_500_000, 150_000, 1_650_000]);
    expect(s.byStatus).toEqual({ 미입금: 1, "입금 완료": 1, 환불: 0, 취소: 1 });
    expect(s.receivable).toBe(550_000);
    expect(s.supply + s.vat).toBe(s.total);
  });
  it("환불 기한 임박·초과 건을 함께 돌려준다", () => {
    const s = summarizeFees([cancelledPaid()], "2026-10-01", "2026-10-31", "2026-10-18");
    expect(s.refundAlerts).toEqual([{ projectId: "p1", level: "overdue", due: "2026-10-17" }]);
  });
});

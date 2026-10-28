import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryAuditLog } from "@/lib/ports/audit";
import { createMemoryDeliveryLog } from "@/lib/ports/delivery";
import { createMemoryFeeStore } from "@/lib/ports/fees";
import { createLocalFeeStore } from "@/lib/ports/fees.local";
import { createLocalReferenceStore } from "@/lib/ports/reference.local";
import {
  cancelFor,
  deliverGuarded,
  findInconsistencies,
  getFee,
  recordPaymentFor,
  refundFor,
  todayKst,
  type FeeDeps,
} from "./service";

// SRS SR-FEE-01~13 / T-28~T-33, T-37, T-38, T-39, T-40
async function deps(): Promise<FeeDeps & { dir: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chakgong-fee-"));
  return {
    dir,
    fees: createMemoryFeeStore(),
    delivery: createMemoryDeliveryLog(),
    audit: createMemoryAuditLog(),
    reference: createLocalReferenceStore(dir),
  };
}
const pay = { date: "2026-10-05", payer: "홍길동", amount: 550_000 };
const NOW = new Date("2026-10-10T03:00:00Z");

describe("용역비 생성과 금액 고정 (SR-FEE-01)", () => {
  it("처음 조회하면 설정 금액으로 '미입금'을 만들고, 이후 설정이 바뀌어도 이미 만든 금액은 그대로", async () => {
    const d = await deps();
    const f1 = await getFee(d, "p1", "admin", NOW);
    expect(f1).toMatchObject({ supply: 500_000, vat: 50_000, total: 550_000, status: "미입금", createdAt: "2026-10-10" });
    await d.reference.save({ ...(await d.reference.get()), feeSupply: 700_000 });
    expect((await getFee(d, "p1", "admin", NOW)).total).toBe(550_000);
    expect((await getFee(d, "p2", "admin", NOW)).total).toBe(770_000);
  });
  it("한국 날짜로 오늘을 센다", () => {
    expect(todayKst(new Date("2026-10-09T16:00:00Z"))).toBe("2026-10-10");
  });
});

describe("후불 납품 (T-28·T-31)", () => {
  it("미입금 상태에서 출력되고 납품 이력이 남으며 용역비는 그대로", async () => {
    const d = await deps();
    const r = await deliverGuarded(d, "p1", "admin", async () => {
      await d.delivery.record({ projectId: "p1", by: "admin", kind: "package", files: ["a.pdf"] });
      return "ok";
    });
    expect(r).toEqual({ ok: true, value: "ok" });
    expect(await d.delivery.hasDelivered("p1")).toBe(true);
    // 다시 출력해도 추가 용역비가 생기지 않는다
    await deliverGuarded(d, "p1", "admin", async () => d.delivery.record({ projectId: "p1", by: "admin", kind: "pdf", files: [] }));
    const f = await getFee(d, "p1", "admin");
    expect([f.total, f.status]).toEqual([550_000, "미입금"]);
    expect((await d.fees.list()).length).toBe(1);
  });
});

describe("입금 확인 (T-29·T-30·T-37)", () => {
  it("맞게 기록하면 '입금 완료'이고 이력에 이전/이후 상태가 남는다", async () => {
    const d = await deps();
    const r = await recordPaymentFor(d, "p1", pay, "admin", NOW);
    expect(r.ok && r.fee.status).toBe("입금 완료");
    const [e] = await d.audit.list({ action: "fee.payment" });
    expect(e.detail).toMatchObject({ before: "미입금", after: "입금 완료" });
  });
  it("누락·차액은 상태를 바꾸지 않고 거절 이력을 남기며, 차액 입력은 메모에 보존", async () => {
    const d = await deps();
    expect(await recordPaymentFor(d, "p1", { ...pay, payer: "" }, "admin", NOW)).toMatchObject({ ok: false, missing: ["입금자명"] });
    const m = await recordPaymentFor(d, "p1", { ...pay, amount: 500_000 }, "admin", NOW);
    expect(m).toMatchObject({ ok: false, diff: -50_000 });
    const f = await getFee(d, "p1", "admin");
    expect(f.status).toBe("미입금");
    expect(f.memo).toContain("500,000");
    expect((await d.audit.list({ action: "fee.payment.rejected" })).length).toBe(2);
  });
  it("같은 공사에 입금 확인을 동시에 보내도 하나만 성립한다", async () => {
    const d = await deps();
    const rs = await Promise.all([1, 2, 3, 4].map(() => recordPaymentFor(d, "p1", pay, "admin", NOW)));
    expect(rs.filter((r) => r.ok).length).toBe(1);
    expect((await d.audit.list({ action: "fee.payment" })).length).toBe(1);
  });
});

describe("취소·환불과 납품 (T-32·T-33·T-38)", () => {
  it("납품 없는 입금 완료 → 취소 → 환불일 기록 → '환불', 이후 출력 차단", async () => {
    const d = await deps();
    await recordPaymentFor(d, "p1", pay, "admin", NOW);
    const c = await cancelFor(d, "p1", "admin", NOW);
    expect(c.ok && c.message).toContain("2026-10-17");
    const blocked = await deliverGuarded(d, "p1", "admin", async () => "x");
    expect(blocked).toMatchObject({ ok: false });
    const r = await refundFor(d, "p1", "2026-10-12", "admin", NOW);
    expect(r.ok && r.fee.status).toBe("환불");
  });
  it("납품한 공사는 취소할 수 없고 안내하며 상태는 그대로", async () => {
    const d = await deps();
    await recordPaymentFor(d, "p1", pay, "admin", NOW);
    await d.delivery.record({ projectId: "p1", by: "admin", kind: "xlsx", files: [] });
    const c = await cancelFor(d, "p1", "admin", NOW);
    expect(c).toMatchObject({ ok: false });
    if (!c.ok) expect(c.message).toContain("납품 후에는 환불할 수 없습니다");
    expect((await getFee(d, "p1", "admin")).status).toBe("입금 완료");
    expect((await d.audit.list({ action: "fee.cancel.rejected" })).length).toBe(1);
  });
  it("취소와 출력을 동시에 요청하면 먼저 온 쪽만 성립한다", async () => {
    for (const order of ["cancelFirst", "deliverFirst"] as const) {
      const d = await deps();
      await recordPaymentFor(d, "p1", pay, "admin", NOW);
      const deliver = () =>
        deliverGuarded(d, "p1", "admin", async () => {
          await new Promise((r) => setTimeout(r, 5));
          await d.delivery.record({ projectId: "p1", by: "admin", kind: "package", files: [] });
        });
      const cancel = () => cancelFor(d, "p1", "admin", NOW);
      const [a, b] = order === "cancelFirst" ? await Promise.all([cancel(), deliver()]) : await Promise.all([deliver(), cancel()]);
      const cancelRes = order === "cancelFirst" ? a : b;
      const deliverRes = order === "cancelFirst" ? b : a;
      // 어느 쪽이 성립하든 둘이 함께 성립하지는 않는다
      expect(Boolean((cancelRes as { ok: boolean }).ok) && Boolean((deliverRes as { ok: boolean }).ok)).toBe(false);
      const delivered = await d.delivery.hasDelivered("p1");
      const f = await getFee(d, "p1", "admin");
      expect(delivered && f.cancelRequestedAt !== null).toBe(false);
    }
  });
});

describe("상태·납품 이력 불일치 알림 (T-39)", () => {
  it("'취소'인데 납품 이력이 있는 상태를 찾아낸다", async () => {
    const d = await deps();
    await cancelFor(d, "p1", "admin", NOW);
    expect(await findInconsistencies(d)).toEqual([]);
    await d.delivery.record({ projectId: "p1", by: "admin", kind: "pdf", files: [] });
    const found = await findInconsistencies(d);
    expect(found).toHaveLength(1);
    expect(found[0].projectId).toBe("p1");
  });
});

describe("금융 인증 정보 비저장 (T-40, SR-FEE-11)", () => {
  it("입금 기록 뒤 저장 파일에는 정해진 항목만 있다", async () => {
    const d = await deps();
    const store = createLocalFeeStore(d.dir);
    const withFiles = { ...d, fees: store };
    await recordPaymentFor(withFiles, "p1", { ...pay }, "admin", NOW);
    const text = await readFile(path.join(d.dir, "fees.json"), "utf8");
    const keys = Object.keys(JSON.parse(text)[0]).sort();
    expect(keys).toEqual(["cancelRequestedAt", "createdAt", "memo", "payment", "projectId", "refundedAt", "status", "supply", "taxInvoice", "total", "vat"].sort());
    expect(text).not.toMatch(/card|account|계좌번호|카드번호|cvc/i);
  });
});

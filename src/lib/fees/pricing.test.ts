import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryAuditLog } from "@/lib/ports/audit";
import { createMemoryDeliveryLog } from "@/lib/ports/delivery";
import { createMemoryFeeStore } from "@/lib/ports/fees";
import type { ProjectStore } from "@/lib/ports/projects";
import { createLocalProjectStore } from "@/lib/ports/projects.local";
import { createLocalReferenceStore } from "@/lib/ports/reference.local";
import { INITIAL_WORK, type WorkState } from "@/lib/projects/types";
import { cancelFor, createFeeFor, recordPaymentFor, type FeeDeps } from "./service";
import { repriceFor, retentionReport } from "./pricing";

// docs/RETENTION.md / SRS SR-FEE-14·15 / T-55~T-58. 사업자등록번호는 가짜 값이다.
const A = "123-45-67891";
const B = "000-00-00000";
const NOW = new Date("2026-11-01T03:00:00Z"); // KST 2026-11-01
const DAY = (s: string) => new Date(`${s}T03:00:00Z`);

async function setup() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chakgong-pricing-"));
  const deps: FeeDeps & { projects: ProjectStore } = {
    fees: createMemoryFeeStore(),
    delivery: createMemoryDeliveryLog(),
    audit: createMemoryAuditLog(),
    reference: createLocalReferenceStore(dir),
    projects: createLocalProjectStore(dir),
  };
  return deps;
}
type D = Awaited<ReturnType<typeof setup>>;
const work = (companyBizNo: string, referrerBizNo = ""): WorkState => ({
  ...INITIAL_WORK,
  general: { ...INITIAL_WORK.general, companyBizNo, referrerBizNo },
});

/** 공사를 만들고(용역비 포함) 필요하면 납품·입금까지 해 둔다 */
async function project(d: D, bizNo: string, opts: { referrer?: string; at?: Date; deliveredAt?: string; paid?: boolean } = {}) {
  const p = await d.projects!.create("공사", "admin", work(bizNo, opts.referrer ?? ""));
  await createFeeFor(d, p.id, "admin", opts.at ?? DAY("2026-01-05"));
  if (opts.deliveredAt) await d.delivery.record({ projectId: p.id, by: "admin", kind: "xlsx", files: ["a.xlsx"], at: `${opts.deliveredAt}T03:00:00Z` });
  if (opts.paid) {
    const fee = await d.fees.get(p.id);
    await recordPaymentFor(d, p.id, { date: "2026-02-01", payer: "홍길동", amount: fee!.total }, "admin", DAY("2026-02-01"));
  }
  return p;
}

describe("공사 생성 때 할인 적용 (T-55, SR-FEE-14)", () => {
  it("사업자등록번호가 없으면 정가다", async () => {
    const d = await setup();
    const p = await d.projects!.create("공사", "admin", work(""));
    expect(await createFeeFor(d, p.id, "admin", NOW)).toMatchObject({ total: 550_000 });
  });

  it("같은 번호의 이전 공사가 180일 이내 납품·입금 완료면 10% 할인(495,000원)이고 이유를 기록한다", async () => {
    const d = await setup();
    await project(d, A, { deliveredAt: "2026-08-01", paid: true });
    const p = await d.projects!.create("새 공사", "admin", work("123-45-67891"));
    const fee = await createFeeFor(d, p.id, "admin", NOW);
    expect(fee).toMatchObject({ supply: 450_000, vat: 45_000, total: 495_000 });
    expect(fee.discount).toEqual({ rate: 10, reason: "reorder", referralApplied: false, amountWon: 50_000 });
  });

  it("표기가 다른 같은 번호(하이픈 없음)도 같은 업체로 본다", async () => {
    const d = await setup();
    await project(d, "1234567891", { deliveredAt: "2026-08-01", paid: true });
    const p = await d.projects!.create("새 공사", "admin", work(A));
    expect((await createFeeFor(d, p.id, "admin", NOW)).total).toBe(495_000);
  });

  it("다른 업체의 납품은 영향이 없다", async () => {
    const d = await setup();
    await project(d, B, { deliveredAt: "2026-08-01", paid: true });
    const p = await d.projects!.create("새 공사", "admin", work(A));
    expect((await createFeeFor(d, p.id, "admin", NOW)).total).toBe(550_000);
  });

  it("직전 건이 미입금이면 정가다", async () => {
    const d = await setup();
    await project(d, A, { deliveredAt: "2026-08-01", paid: false });
    const p = await d.projects!.create("새 공사", "admin", work(A));
    expect((await createFeeFor(d, p.id, "admin", NOW)).total).toBe(550_000);
  });

  it("납품 이력이 없는 이전 공사는 세지 않는다", async () => {
    const d = await setup();
    await project(d, A, { paid: true });
    const p = await d.projects!.create("새 공사", "admin", work(A));
    expect((await createFeeFor(d, p.id, "admin", NOW)).total).toBe(550_000);
  });

  it("환불·취소된 이전 공사는 세지 않는다", async () => {
    const d = await setup();
    const old = await project(d, A, { paid: false });
    await cancelFor(d, old.id, "admin", NOW);
    const p = await d.projects!.create("새 공사", "admin", work(A));
    expect((await createFeeFor(d, p.id, "admin", NOW)).total).toBe(550_000);
  });

  it("복제 공사는 원본의 번호로 할인을 받는다. 원본도 이전 공사로 센다", async () => {
    const d = await setup();
    const src = await project(d, A, { deliveredAt: "2026-08-01", paid: true });
    const srcData = (await d.projects!.get(src.id))!.data;
    const copy = await d.projects!.create("공사 (복사)", "admin", srcData);
    expect((await createFeeFor(d, copy.id, "admin", NOW)).total).toBe(495_000);
  });

  it("projects 저장소를 주지 않으면 기존처럼 정가다", async () => {
    const d = await setup();
    const { projects: _omit, ...legacy } = d;
    void _omit;
    expect((await createFeeFor(legacy, "p-legacy", "admin", NOW)).total).toBe(550_000);
  });
});

describe("납품·입금 전 재산정 (T-56, SR-FEE-14)", () => {
  it("공사를 만든 뒤 사업자등록번호를 입력하면 할인으로 다시 정하고 이력을 남긴다", async () => {
    const d = await setup();
    await project(d, A, { deliveredAt: "2026-08-01", paid: true });
    const p = await d.projects!.create("새 공사", "admin", work(""));
    await createFeeFor(d, p.id, "admin", NOW);
    await d.projects!.save(p.id, work(A), "admin");

    const r = await repriceFor(d, p.id, "admin", NOW);
    expect(r).toMatchObject({ ok: true, fee: { total: 495_000 } });
    const log = await d.audit.list();
    expect(log.some((e) => e.action === "fee.reprice" && e.target === p.id)).toBe(true);
  });

  it("번호를 지우면 정가로 돌아간다", async () => {
    const d = await setup();
    await project(d, A, { deliveredAt: "2026-08-01", paid: true });
    const p = await d.projects!.create("새 공사", "admin", work(A));
    await createFeeFor(d, p.id, "admin", NOW);
    await d.projects!.save(p.id, work(""), "admin");
    expect(await repriceFor(d, p.id, "admin", NOW)).toMatchObject({ ok: true, fee: { total: 550_000 } });
  });

  it("납품한 공사는 금액을 바꾸지 않는다", async () => {
    const d = await setup();
    await project(d, A, { deliveredAt: "2026-08-01", paid: true });
    const p = await d.projects!.create("새 공사", "admin", work(""));
    await createFeeFor(d, p.id, "admin", NOW);
    await d.delivery.record({ projectId: p.id, by: "admin", kind: "xlsx", files: ["a.xlsx"] });
    await d.projects!.save(p.id, work(A), "admin");
    expect(await repriceFor(d, p.id, "admin", NOW)).toMatchObject({ ok: false, fee: { total: 550_000 } });
  });

  it("입금 완료된 공사는 금액을 바꾸지 않는다", async () => {
    const d = await setup();
    await project(d, A, { deliveredAt: "2026-08-01", paid: true });
    const p = await d.projects!.create("새 공사", "admin", work(""));
    await createFeeFor(d, p.id, "admin", NOW);
    await recordPaymentFor(d, p.id, { date: "2026-11-02", payer: "홍길동", amount: 550_000 }, "admin", NOW);
    await d.projects!.save(p.id, work(A), "admin");
    expect(await repriceFor(d, p.id, "admin", NOW)).toMatchObject({ ok: false, fee: { total: 550_000 } });
  });
});

describe("소개 보상 (T-57, SR-FEE-14)", () => {
  it("소개한 업체가 첫 용역비를 입금하면 소개한 업체의 다음 공사는 5% 더 할인한다(첫 의뢰 정가 → 5%)", async () => {
    const d = await setup();
    await project(d, B, { referrer: A, paid: true }); // 신규 업체 B가 A의 소개로 와서 입금
    const p = await d.projects!.create("A의 공사", "admin", work(A));
    const fee = await createFeeFor(d, p.id, "admin", NOW);
    expect(fee).toMatchObject({ supply: 475_000, vat: 47_500, total: 522_500 });
    expect(fee.discount).toEqual({ rate: 5, reason: "first", referralApplied: true, amountWon: 25_000 });
  });

  it("소개받은 업체가 미입금이면 보상이 없다", async () => {
    const d = await setup();
    await project(d, B, { referrer: A, paid: false });
    const p = await d.projects!.create("A의 공사", "admin", work(A));
    expect((await createFeeFor(d, p.id, "admin", NOW)).total).toBe(550_000);
  });

  it("크레딧은 한 번만 쓰이고, 쓴 공사가 취소되면 돌아온다", async () => {
    const d = await setup();
    await project(d, B, { referrer: A, paid: true });
    const p1 = await d.projects!.create("A 1", "admin", work(A));
    expect((await createFeeFor(d, p1.id, "admin", NOW)).discount?.referralApplied).toBe(true);
    const p2 = await d.projects!.create("A 2", "admin", work(A));
    expect((await createFeeFor(d, p2.id, "admin", NOW)).discount?.referralApplied).toBe(false);

    await cancelFor(d, p1.id, "admin", NOW); // 미입금·납품 없음 → '취소'
    const p3 = await d.projects!.create("A 3", "admin", work(A));
    expect((await createFeeFor(d, p3.id, "admin", NOW)).discount?.referralApplied).toBe(true);
  });

  it("자기 자신을 소개한 것으로 적어도 보상은 없다", async () => {
    const d = await setup();
    await project(d, A, { referrer: A, paid: true });
    const p = await d.projects!.create("A의 공사", "admin", work(A));
    expect((await createFeeFor(d, p.id, "admin", NOW)).discount?.referralApplied).toBe(false);
  });
});

describe("리텐션 지표 (T-58, SR-FEE-15)", () => {
  it("공사·납품 기록으로 재의뢰율·소개율·할인 건수를 계산한다", async () => {
    const d = await setup();
    // A: 첫 납품 2026-01-10, 60일 뒤 재납품 → 재의뢰. B: 소개(A)로 온 신규, 납품 1건
    await project(d, A, { deliveredAt: "2026-01-10", paid: true });
    await project(d, A, { deliveredAt: "2026-03-11", paid: true });
    await project(d, B, { referrer: A, deliveredAt: "2026-02-01", paid: true });
    // A의 세 번째 공사(6월 생성): 연속 3번째 15% + 소개 5% = 20% → 공급가액 100,000원 할인
    await project(d, A, { at: DAY("2026-06-01") });
    const r = await retentionReport(d, "2026-11-01");
    expect(r.reorder).toEqual({ eligible: 2, reordered: 1, rate: 0.5 });
    expect(r.referral).toEqual({ newCompanies: 2, referred: 1, rate: 0.5 });
    expect(r.intervals).toEqual([{ bizNo: "1234567891", count: 2, avgDays: 60 }]);
    expect(r.discounted).toEqual({ count: 1, totalWon: 100_000 });
    expect(r.missingBizNo).toBe(0);
  });

  it("사업자등록번호를 입력하지 않은 공사는 집계에서 빼고 개수를 알려 준다", async () => {
    const d = await setup();
    await project(d, "", { deliveredAt: "2026-01-10", paid: true });
    const r = await retentionReport(d, "2026-11-01");
    expect(r.reorder.eligible).toBe(0);
    expect(r.missingBizNo).toBe(1);
  });
});

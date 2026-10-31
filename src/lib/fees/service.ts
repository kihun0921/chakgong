// 용역비 처리 (SRS SR-FEE-01~13, SR-OUT-08)
// 같은 공사에 대한 입금·취소·출력은 공사별로 한 줄로 세워 처리한다(동시·중복 요청은 먼저 온 것만 성립, T-37·T-38).
// 모든 변경은 이전/이후 상태와 함께 이력으로 남기고, 이력을 쓰지 못하면 동작도 실패한다(D-4).

import {
  canExport,
  createFee,
  detectInconsistency,
  recordPayment,
  recordRefund,
  recordTaxInvoice,
  requestCancel,
  toDiscount,
  type FeeRecord,
  type PaymentInput,
} from "@/domain/fee-ledger";
import type { AuditLog } from "@/lib/ports/audit";
import type { DeliveryLog } from "@/lib/ports/delivery";
import type { FeeStore } from "@/lib/ports/fees";
import type { ProjectStore } from "@/lib/ports/projects";
import type { ReferenceStore } from "@/lib/ports/reference.local";
import { priceProject } from "./history";

/** projects가 있으면 같은 사업자등록번호의 이전 공사를 보고 할인을 적용한다(SR-FEE-14). 없으면 정가다. */
export type FeeDeps = { fees: FeeStore; delivery: DeliveryLog; audit: AuditLog; reference: ReferenceStore; projects?: ProjectStore };

/** 한국 날짜(yyyy-mm-dd). 서버 시간대와 상관없이 같은 날로 본다. */
export const todayKst = (now = new Date()): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);

const tails = new Map<string, Promise<unknown>>();

/** 공사 하나에 대한 작업을 순서대로 실행한다. */
export function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const run = (tails.get(projectId) ?? Promise.resolve()).then(fn, fn);
  const tail = run.catch(() => undefined);
  tails.set(projectId, tail);
  void tail.then(() => {
    if (tails.get(projectId) === tail) tails.delete(projectId);
  });
  return run;
}

/**
 * 공사를 만들 때 용역비를 '미입금'으로 기록한다. 금액은 그때의 설정값(할인 반영)으로 정해진다 (SR-FEE-01·14).
 * 납품·입금 전에는 사업자등록번호를 입력한 뒤 repriceFor로 다시 정할 수 있다.
 */
export async function createFeeFor(deps: FeeDeps, projectId: string, by: string, now = new Date()): Promise<FeeRecord> {
  const existing = await deps.fees.get(projectId);
  if (existing) return existing;
  const today = todayKst(now);
  let fee: FeeRecord;
  if (deps.projects) {
    const priced = await priceProject({ ...deps, projects: deps.projects }, projectId, today);
    fee = { ...createFee(projectId, priced.supply, today), discount: toDiscount(priced) };
  } else {
    fee = createFee(projectId, (await deps.reference.get()).feeSupply, today);
  }
  await deps.fees.put(fee);
  await deps.audit.record({ user: by, action: "fee.create", target: projectId, detail: { total: fee.total, discountRate: fee.discount?.rate ?? 0 } });
  return fee;
}

/** 용역비 기능 이전에 만든 공사에도 내역이 생기도록 처음 조회할 때 만든다. */
export const getFee = (deps: FeeDeps, projectId: string, by: string, now = new Date()) =>
  withProjectLock(projectId, () => createFeeFor(deps, projectId, by, now));

const beforeAfter = (b: FeeRecord, a: FeeRecord) => ({ before: b.status, after: a.status });

export type FeeActionResult =
  | { ok: true; fee: FeeRecord; message?: string }
  | { ok: false; message: string; missing?: string[]; diff?: number; fee: FeeRecord };

export function recordPaymentFor(deps: FeeDeps, projectId: string, input: PaymentInput, by: string, now = new Date()): Promise<FeeActionResult> {
  return withProjectLock(projectId, async () => {
    const fee = await createFeeFor(deps, projectId, by, now);
    const r = recordPayment(fee, input);
    if (r.ok) {
      await deps.fees.put(r.fee);
      await deps.audit.record({ user: by, action: "fee.payment", target: projectId, detail: { ...beforeAfter(fee, r.fee), date: input.date, amount: input.amount } });
      return { ok: true, fee: r.fee };
    }
    if (r.reason === "mismatch") await deps.fees.put(r.fee); // 입력 내용을 메모로 보존 (D-15)
    await deps.audit.record({ user: by, action: "fee.payment.rejected", target: projectId, detail: { reason: r.reason, amount: input.amount } });
    const message =
      r.reason === "missing"
        ? `빠진 항목이 있습니다: ${r.missing.join(", ")}`
        : r.reason === "mismatch"
          ? `입금액이 합계(${fee.total.toLocaleString("ko-KR")}원)와 ${Math.abs(r.diff).toLocaleString("ko-KR")}원 ${r.diff < 0 ? "부족" : "초과"}합니다. 상태는 바꾸지 않았고 입력 내용은 메모에 남겼습니다.`
          : r.message;
    return { ok: false, message, missing: r.reason === "missing" ? r.missing : undefined, diff: r.reason === "mismatch" ? r.diff : undefined, fee: r.fee };
  });
}

export function recordTaxInvoiceFor(deps: FeeDeps, projectId: string, t: { issued: boolean; date: string | null }, by: string, now = new Date()): Promise<FeeActionResult> {
  return withProjectLock(projectId, async () => {
    const fee = await createFeeFor(deps, projectId, by, now);
    if (t.issued && !t.date) return { ok: false, message: "발행일을 입력해 주세요.", fee };
    const next = recordTaxInvoice(fee, t);
    await deps.fees.put(next);
    await deps.audit.record({ user: by, action: "fee.taxinvoice", target: projectId, detail: { issued: t.issued, date: t.date } });
    return { ok: true, fee: next };
  });
}

export function cancelFor(deps: FeeDeps, projectId: string, by: string, now = new Date()): Promise<FeeActionResult> {
  return withProjectLock(projectId, async () => {
    const fee = await createFeeFor(deps, projectId, by, now);
    const delivered = await deps.delivery.hasDelivered(projectId);
    const r = requestCancel(fee, delivered, todayKst(now));
    if (!r.ok) {
      await deps.audit.record({ user: by, action: "fee.cancel.rejected", target: projectId, detail: { reason: r.reason } });
      return { ok: false, message: r.message, fee };
    }
    await deps.fees.put(r.fee);
    await deps.audit.record({ user: by, action: "fee.cancel", target: projectId, detail: { ...beforeAfter(fee, r.fee), refundDue: r.refundDue } });
    return {
      ok: true,
      fee: r.fee,
      message: r.refundDue ? `환불 요청을 기록했습니다. ${r.refundDue}까지 ${r.fee.total.toLocaleString("ko-KR")}원 전액을 환불해야 합니다.` : "취소로 기록했습니다.",
    };
  });
}

export function refundFor(deps: FeeDeps, projectId: string, date: string, by: string, now = new Date()): Promise<FeeActionResult> {
  return withProjectLock(projectId, async () => {
    const fee = await createFeeFor(deps, projectId, by, now);
    const r = recordRefund(fee, date);
    if (!r.ok) return { ok: false, message: r.message, fee };
    await deps.fees.put(r.fee);
    await deps.audit.record({ user: by, action: "fee.refund", target: projectId, detail: { ...beforeAfter(fee, r.fee), date } });
    return { ok: true, fee: r.fee };
  });
}

export type DeliverGate<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * 최종 출력을 용역비 상태 확인과 함께 한 줄로 처리한다 (SR-FEE-02·08, T-38).
 * 출력 허용을 확인한 뒤 만들고, run이 납품 이력까지 남기는 동안 취소 요청이 끼어들지 못한다.
 * run이 실패(던짐)하면 납품 이력은 남지 않는다.
 */
export function deliverGuarded<T>(deps: FeeDeps, projectId: string, by: string, run: () => Promise<T>): Promise<DeliverGate<T>> {
  return withProjectLock(projectId, async () => {
    const fee = await createFeeFor(deps, projectId, by);
    const gate = canExport(fee);
    if (!gate.ok) return { ok: false, message: gate.message };
    return { ok: true, value: await run() };
  });
}

/** 상태·납품 이력이 어긋난 공사 목록 (SR-FEE-13). 대시보드가 맨 위에 경고로 보여 준다. */
export async function findInconsistencies(deps: FeeDeps): Promise<{ projectId: string; message: string }[]> {
  const out: { projectId: string; message: string }[] = [];
  for (const fee of await deps.fees.list()) {
    const message = detectInconsistency(fee, await deps.delivery.hasDelivered(fee.projectId));
    if (message) out.push({ projectId: fee.projectId, message });
  }
  return out;
}

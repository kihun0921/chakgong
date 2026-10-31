"use client";

import { useEffect, useState } from "react";
import type { FeeRecord, RefundAlert } from "@/domain/fee-ledger";
import type { LoyaltyReason } from "@/domain/retention-pricing";
import { btnCls, btnGhostCls, inputCls, labelCls } from "@/components/work/types";
import { NumInput } from "@/components/NumInput";

type View = { fee: FeeRecord; delivered: boolean; alert: RefundAlert };
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const DISCOUNT_LABEL: Record<LoyaltyReason, string> = {
  first: "첫 의뢰",
  expired: "직전 납품 후 180일 초과",
  unpaid: "직전 건 미입금",
  reorder: "재의뢰",
  loyal: "단골(연속 3번째 공사부터)",
};

// 용역비 내역 (SRS SR-FEE-03~07·10): 입금 확인·세금계산서·의뢰 취소·환불. 은행과 연동하지 않고 관리자가 직접 기록한다.
export function FeePanel({ projectId }: { projectId: string }) {
  const [v, setV] = useState<View | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [date, setDate] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [taxDate, setTaxDate] = useState("");
  const [refundDate, setRefundDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/projects/${projectId}/fee`)
      .then((r) => (r.ok ? (r.json() as Promise<View>) : null))
      .then((j) => {
        if (alive && j) setV(j);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as View & { ok?: boolean; message?: string; error?: string };
      if (j.fee) setV({ fee: j.fee, delivered: j.delivered, alert: j.alert });
      setMsg({ ok: res.ok, text: j.message ?? j.error ?? (res.ok ? "기록했습니다." : "기록하지 못했습니다.") });
    } catch {
      setMsg({ ok: false, text: "서버에 연결하지 못했습니다." });
    }
    setBusy(false);
  }

  if (!v) return null;
  const f = v.fee;
  const closed = f.status === "환불" || f.status === "취소";
  // 입금액 칸은 청구 합계를 실제 값으로 채워 둔다(회색 안내 글자는 입력된 것처럼 보여 혼동된다). 다르면 고쳐 쓴다.
  const amountValue = amount === "" ? String(f.total) : amount;
  const waitingRefund = f.status === "입금 완료" && f.cancelRequestedAt && !f.refundedAt;

  return (
    <section aria-label="용역비" className="mt-6 rounded-md border border-border bg-surface p-4 shadow-sm">
      <details>
        <summary className="cursor-pointer text-[15px] font-bold">
          용역비 · {f.status} · 합계 {won(f.total)}
          {v.delivered && <span className="ml-2 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-normal">납품함</span>}
          {v.alert !== "none" && (
            <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-normal text-danger">
              환불 기한 {v.alert === "overdue" ? "초과" : "임박"}
            </span>
          )}
        </summary>

        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-1 text-[13px]">
          <dt className="text-text-secondary">공급가액</dt><dd>{won(f.supply)}</dd>
          <dt className="text-text-secondary">부가세</dt><dd>{won(f.vat)}</dd>
          <dt className="text-text-secondary">합계</dt><dd className="font-bold">{won(f.total)}</dd>
          {f.discount && f.discount.rate > 0 && (
            <>
              <dt className="text-text-secondary">할인</dt>
              <dd>
                {f.discount.rate}% ({won(f.discount.amountWon)} 할인) · {DISCOUNT_LABEL[f.discount.reason]}
                {f.discount.referralApplied && " · 소개 보상 포함"}
              </dd>
            </>
          )}
          <dt className="text-text-secondary">상태</dt><dd>{f.status}</dd>
          <dt className="text-text-secondary">세금계산서</dt><dd>{f.taxInvoice.issued ? `발행 ${f.taxInvoice.date ?? ""}` : "미발행"}</dd>
          {f.payment && (
            <>
              <dt className="text-text-secondary">입금</dt>
              <dd>{f.payment.date} · {f.payment.payer} · {won(f.payment.amount)}</dd>
            </>
          )}
          {f.cancelRequestedAt && (
            <>
              <dt className="text-text-secondary">환불 요청일</dt><dd>{f.cancelRequestedAt}</dd>
            </>
          )}
          {f.refundedAt && (
            <>
              <dt className="text-text-secondary">환불일</dt><dd>{f.refundedAt}</dd>
            </>
          )}
          {f.memo && (
            <>
              <dt className="text-text-secondary">메모</dt><dd className="whitespace-pre-line">{f.memo}</dd>
            </>
          )}
        </dl>

        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`mt-3 rounded-sm p-3 text-[13px] ${msg.ok ? "bg-success-soft" : "bg-danger-soft"}`}>
            {msg.text}
          </p>
        )}

        {f.status === "미입금" && !f.cancelRequestedAt && (
          <form
            className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ action: "payment", date, payer, amount: Number(amountValue.replace(/[^\d]/g, "")) });
            }}
          >
            <div>
              <label htmlFor="payDate" className={labelCls}>입금일</label>
              <input id="payDate" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="payer" className={labelCls}>입금자명</label>
              <input id="payer" className={inputCls} value={payer} onChange={(e) => setPayer(e.target.value)} />
            </div>
            <div>
              <label htmlFor="payAmount" className={labelCls}>입금액(원)</label>
              <NumInput id="payAmount" className={`${inputCls} text-right`} value={amountValue} onValue={setAmount} />
            </div>
            <button type="submit" className={btnCls} disabled={busy}>입금 확인 기록</button>
          </form>
        )}

        {f.status === "미입금" && !f.cancelRequestedAt && !v.delivered && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className={btnGhostCls} disabled={busy} onClick={() => void act({ action: "reprice" })}>
              할인 다시 계산
            </button>
            <span className="text-[12px] text-text-secondary">
              일반 장의 사업자등록번호·소개 업체를 바꾸거나 이전 공사가 입금된 뒤에 누르세요. 납품·입금 뒤에는 금액이 바뀌지 않습니다.
            </span>
          </div>
        )}

        {!closed && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="taxDate" className={labelCls}>세금계산서 발행일</label>
              <input id="taxDate" type="date" className={inputCls} value={taxDate} onChange={(e) => setTaxDate(e.target.value)} />
            </div>
            <button type="button" className={btnGhostCls} disabled={busy} onClick={() => void act({ action: "taxInvoice", issued: true, date: taxDate })}>
              발행 기록
            </button>
            {f.taxInvoice.issued && (
              <button type="button" className={btnGhostCls} disabled={busy} onClick={() => void act({ action: "taxInvoice", issued: false })}>
                발행 취소
              </button>
            )}
          </div>
        )}

        {waitingRefund && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="refundDate" className={labelCls}>환불일(이체한 날)</label>
              <input id="refundDate" type="date" className={inputCls} value={refundDate} onChange={(e) => setRefundDate(e.target.value)} />
            </div>
            <button type="button" className={btnCls} disabled={busy} onClick={() => void act({ action: "refund", date: refundDate })}>
              환불 완료 기록
            </button>
          </div>
        )}

        {!closed && !f.cancelRequestedAt && (
          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              className="text-[13px] text-danger underline"
              disabled={busy}
              onClick={() => {
                if (window.confirm("이 의뢰를 취소합니다. 취소하면 이 공사는 더 이상 출력할 수 없습니다. 계속할까요?")) void act({ action: "cancel" });
              }}
            >
              의뢰 취소
            </button>
            {v.delivered && <span className="ml-2 text-[12px] text-text-secondary">납품한 공사는 취소·환불할 수 없습니다.</span>}
          </div>
        )}
      </details>
    </section>
  );
}

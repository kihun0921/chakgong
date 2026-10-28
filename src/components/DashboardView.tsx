"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FEE_STATUSES } from "@/domain/fee-ledger";
import type { Dashboard } from "@/lib/dashboard/service";
import { btnCls, inputCls, labelCls } from "@/components/work/types";
import { formatKst } from "@/lib/format-time";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const pct = (r: number | null) => (r === null ? "집계 전" : `${(r * 100).toFixed(0)}%`);

export function DashboardView({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (f: string, t: string) => {
    const res = await fetch(`/api/dashboard?from=${f}&to=${t}`);
    if (res.ok) {
      setError("");
      setD((await res.json()) as Dashboard);
    } else setError(((await res.json()) as { error?: string }).error ?? "불러오지 못했습니다.");
  }, []);
  useEffect(() => {
    let alive = true;
    void fetch(`/api/dashboard?from=${initialFrom}&to=${initialTo}`)
      .then((r) => (r.ok ? (r.json() as Promise<Dashboard>) : null))
      .then((j) => {
        if (alive && j) setD(j);
      });
    return () => {
      alive = false;
    };
  }, [initialFrom, initialTo]);

  const card = "rounded-md border border-border bg-surface p-4 shadow-sm";

  return (
    <div>
      <h1 className="text-[26px]">대시보드</h1>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load(from, to);
        }}
      >
        <div>
          <label htmlFor="from" className={labelCls}>시작일</label>
          <input id="from" type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="to" className={labelCls}>종료일</label>
          <input id="to" type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="submit" className={btnCls}>조회</button>
        <span className="text-[12px] text-text-secondary">용역비를 만든 날 기준</span>
      </form>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">⚠ {error}</p>}

      {d && (
        <>
          {d.inconsistencies.length > 0 && (
            <ul role="alert" className="mt-4 list-disc rounded-sm border border-danger bg-danger-soft p-3 pl-7 text-[13px]">
              {d.inconsistencies.map((x) => (
                <li key={x.projectId}>
                  <strong className="text-danger">⚠ 확인 필요</strong> — <Link className="underline" href={`/work/${x.projectId}`}>{x.projectName}</Link>: {x.message}
                </li>
              ))}
            </ul>
          )}
          {d.summary.refundAlerts.length > 0 && (
            <ul role="alert" className="mt-4 list-disc rounded-sm border border-warn bg-warn-soft p-3 pl-7 text-[13px]">
              {d.summary.refundAlerts.map((a) => (
                <li key={a.projectId}>
                  <strong className="text-warn">환불 기한 {a.level === "overdue" ? "초과" : "임박"}</strong> — {d.rows.find((r) => r.fee.projectId === a.projectId)?.projectName} (기한 {a.due})
                </li>
              ))}
            </ul>
          )}

          {d.alerts.length > 0 && (
            <ul role="alert" className="mt-4 list-disc rounded-sm border border-danger bg-danger-soft p-3 pl-7 text-[13px]">
              {d.alerts.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <strong className="text-danger">⚠ 알림</strong> — {a.message} <span className="text-text-secondary">({formatKst(a.at)})</span>
                </li>
              ))}
            </ul>
          )}

          <section aria-label="용역비 합계" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={card}><p className="text-[12px] text-text-secondary">용역비 건수</p><p className="text-[22px] font-bold">{d.summary.count}건</p></div>
            <div className={card}><p className="text-[12px] text-text-secondary">합계 (공급가액 {won(d.summary.supply)} + 부가세 {won(d.summary.vat)})</p><p className="text-[22px] font-bold">{won(d.summary.total)}</p></div>
            <div className={card}><p className="text-[12px] text-text-secondary">미수금(미입금 합계)</p><p className="text-[22px] font-bold">{won(d.summary.receivable)}</p></div>
            <div className={card}>
              <p className="text-[12px] text-text-secondary">상태별</p>
              <p className="text-[14px]">{FEE_STATUSES.map((s) => `${s} ${d.summary.byStatus[s]}`).join(" · ")}</p>
            </div>
          </section>

          <section aria-label="용역비 내역" className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-alt text-left">
                  <th className="p-2">공사</th><th className="p-2">만든 날</th><th className="p-2">상태</th>
                  <th className="p-2 text-right">합계</th><th className="p-2">입금</th><th className="p-2">세금계산서</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map(({ fee, projectName }) => (
                  <tr key={fee.projectId} className="border-t border-border">
                    <td className="p-2"><Link className="underline" href={`/work/${fee.projectId}`}>{projectName}</Link></td>
                    <td className="whitespace-nowrap p-2">{fee.createdAt}</td>
                    <td className="whitespace-nowrap p-2">{fee.status}</td>
                    <td className="p-2 text-right">{won(fee.total)}</td>
                    <td className="whitespace-nowrap p-2">{fee.payment ? `${fee.payment.date} ${fee.payment.payer}` : "-"}</td>
                    <td className="whitespace-nowrap p-2">{fee.taxInvoice.issued ? fee.taxInvoice.date : "-"}</td>
                  </tr>
                ))}
                {d.rows.length === 0 && (
                  <tr><td className="p-3 text-text-muted" colSpan={6}>이 기간의 용역비가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section aria-label="운영 지표" className="mt-8">
            <h2 className="text-[18px]">운영 지표</h2>
            <dl className="mt-3 grid grid-cols-[220px_1fr] gap-y-1 text-[13px]">
              <dt className="text-text-secondary">내역서 파싱 시도</dt><dd>{d.metrics.parse.attempts}건 (오류 {d.metrics.parse.errors}건)</dd>
              <dt className="text-text-secondary">수동 보정 없이 읽은 비율</dt><dd>{pct(d.metrics.parse.autoRate)}</dd>
              <dt className="text-text-secondary">수동 보정률</dt><dd>{pct(d.metrics.parse.manualRate)}</dd>
              <dt className="text-text-secondary">출력 거절(검증 실패) 유형</dt>
              <dd>{Object.keys(d.metrics.validationFailures).length === 0 ? "없음" : Object.entries(d.metrics.validationFailures).map(([k, n]) => `${k} ${n}건`).join(" · ")}</dd>
              <dt className="text-text-secondary">초안 시작 → 통과</dt><dd>{d.metrics.draft.started}건 시작, {d.metrics.draft.ready}건 통과{d.metrics.draftSeconds === null ? "" : ` (평균 ${Math.round(d.metrics.draftSeconds)}초)`}</dd>
              <dt className="text-text-secondary">검증 통과 초안 5분 달성률</dt><dd>{pct(d.metrics.kpi5min)}</dd>
              <dt className="text-text-secondary">나라장터 API 성공률</dt><dd>집계 전 (API 연결 후)</dd>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

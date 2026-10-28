"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BetaReport } from "@/lib/beta/service";

const pct = (r: number | null) => (r === null ? "-" : `${Math.round(r * 100)}%`);
const TONE = { pass: "bg-success-soft", improve: "bg-warn-soft", pivot: "bg-danger-soft", none: "bg-surface-alt" } as const;

export function BetaReportView() {
  const [r, setR] = useState<BetaReport | null>(null);
  useEffect(() => {
    let alive = true;
    void fetch("/api/beta")
      .then((x) => (x.ok ? (x.json() as Promise<BetaReport>) : null))
      .then((j) => {
        if (alive && j) setR(j);
      });
    return () => {
      alive = false;
    };
  }, []);
  if (!r) return <p className="text-sm text-text-secondary">불러오는 중…</p>;
  const card = "rounded-md border border-border bg-surface p-4 shadow-sm";
  const s = r.summary;

  return (
    <div>
      <h1 className="text-[26px]">베타 종합</h1>
      <p className="mt-1 text-sm text-text-secondary">북극성 KPI는 시스템이 기록한 시각으로, 보완 요구 횟수와 수작업 비교는 공사별 &apos;베타 기록&apos;에서 관리자가 적은 값으로 계산합니다.</p>

      <section aria-label="북극성 KPI" className={`mt-6 rounded-md border border-border p-5 ${TONE[r.kpi.judgement.verdict]}`}>
        <p className="text-[13px] text-text-secondary">검증 통과 초안 5분 달성률 (목표 90% 이상, 50% 미만이면 피봇)</p>
        <p className="mt-1 text-[32px] font-bold">{pct(r.kpi.rate)}</p>
        <p className="text-[14px]">
          시작 {r.kpi.started}건 · 통과 {r.kpi.ready}건 · 5분 안 통과 {r.kpi.within5}건 — <strong>{r.kpi.judgement.label}</strong>
        </p>
        {r.kpi.judgement.caution && <p className="mt-1 text-[13px] text-warn">{r.kpi.judgement.caution}</p>}
      </section>

      <section aria-label="보조 지표" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}><p className="text-[12px] text-text-secondary">서류 불일치(막은 건수)</p><p className="text-[22px] font-bold">{r.mismatch.blocked}건</p><p className="text-[12px] text-text-secondary">납품본에는 0건이어야 합니다</p></div>
        <div className={card}><p className="text-[12px] text-text-secondary">집계표 차이(막은 금액)</p><p className="text-[22px] font-bold">{r.mismatch.tableDiffWon.toLocaleString("ko-KR")}원</p></div>
        <div className={card}><p className="text-[12px] text-text-secondary">첫 제출 보완 요구</p><p className="text-[22px] font-bold">{s.supplementRequests}회</p><p className="text-[12px] text-text-secondary">그중 불일치 원인 {s.supplementDueToMismatch}회</p></div>
        <div className={card}><p className="text-[12px] text-text-secondary">수작업 대비 시간 ({s.measured}건)</p><p className="text-[22px] font-bold">{s.measured === 0 ? "-" : `${s.toolMinutes}분 / ${s.manualMinutes}분`}</p><p className="text-[12px] text-text-secondary">도구 / 수작업</p></div>
      </section>

      <section aria-label="인수 기준" className="mt-8">
        <h2 className="text-[18px]">인수 기준 점검</h2>
        <ul className="mt-3 space-y-1 text-[13px]">
          {r.acceptance.map((a) => (
            <li key={a.label} className="flex flex-wrap gap-2 rounded-sm bg-surface-alt px-3 py-2">
              <strong className={a.ok ? "text-success" : "text-warn"}>{a.ok ? "✓" : "○"}</strong>
              <span>{a.label}</span>
              <span className="text-text-secondary">— {a.detail}{a.manual ? " (관리자 기록 기준)" : ""}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-text-secondary">기준 수치(622,764,021원, 2027-01-10 등)와 Excel·LibreOffice 확인, 다른 공종 내역서 차이 0원은 실제 샘플로 사람이 확인합니다. docs/BETA.md 참고.</p>
      </section>

      <section aria-label="공사별" className="mt-8 overflow-x-auto">
        <h2 className="text-[18px]">공사별</h2>
        <table className="mt-3 w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-alt text-left">
              <th className="p-2">공사</th><th className="p-2">납품</th><th className="p-2 text-right">도구(분)</th><th className="p-2 text-right">수작업(분)</th>
              <th className="p-2 text-right">보완 요구</th><th className="p-2">제출 가능</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.projectId} className="border-t border-border">
                <td className="p-2"><Link className="underline" href={`/work/${x.projectId}`}>{x.projectName}</Link></td>
                <td className="p-2">{x.delivered ? "납품함" : "-"}</td>
                <td className="p-2 text-right">{x.toolMinutes ?? "-"}</td>
                <td className="p-2 text-right">{x.note?.manualMinutes ?? "-"}</td>
                <td className="p-2 text-right">{x.note?.supplementRequests ?? "-"}</td>
                <td className="p-2">{x.note?.submittable === true ? "예" : x.note?.submittable === false ? "아니오" : "-"}</td>
              </tr>
            ))}
            {r.rows.length === 0 && <tr><td className="p-3 text-text-muted" colSpan={6}>아직 시작한 공사가 없습니다.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

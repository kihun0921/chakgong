"use client";

import { useEffect, useState } from "react";
import type { BetaNote } from "@/domain/beta";
import { btnCls, inputCls, labelCls } from "@/components/work/types";
import { NumInput } from "@/components/NumInput";

// 베타 기록 (SRS SR-NF-23, D-11): 발주기관 회신은 시스템이 알 수 없어 관리자가 직접 적는다.
export function BetaPanel({ projectId }: { projectId: string }) {
  const [f, setF] = useState({ supplementRequests: "", supplementDueToMismatch: "", manualMinutes: "", comparison: "", submittable: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/projects/${projectId}/beta`)
      .then((r) => (r.ok ? (r.json() as Promise<{ note: BetaNote | null }>) : null))
      .then((j) => {
        if (!alive || !j?.note) return;
        const n = j.note;
        setF({
          supplementRequests: n.supplementRequests === null ? "" : String(n.supplementRequests),
          supplementDueToMismatch: n.supplementDueToMismatch === null ? "" : String(n.supplementDueToMismatch),
          manualMinutes: n.manualMinutes === null ? "" : String(n.manualMinutes),
          comparison: n.comparison,
          submittable: n.submittable === null ? "" : String(n.submittable),
        });
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/beta`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, submittable: f.submittable === "" ? null : f.submittable === "true" }),
    });
    const j = (await res.json()) as { error?: string };
    setMsg({ ok: res.ok, text: res.ok ? "베타 기록을 저장했습니다." : (j.error ?? "저장하지 못했습니다.") });
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <section aria-label="베타 기록" className="mt-6 rounded-md border border-border bg-surface p-4 shadow-sm">
      <details>
        <summary className="cursor-pointer text-[15px] font-bold">베타 기록 (발주기관 회신·수작업 비교)</summary>
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bsr" className={labelCls}>첫 제출 보완 요구 횟수</label>
            <NumInput id="bsr" className={inputCls} value={f.supplementRequests} onValue={(raw) => setF({ ...f, supplementRequests: raw })} placeholder="모르면 비워 두세요" />
          </div>
          <div>
            <label htmlFor="bsm" className={labelCls}>그중 수치·표기 불일치가 원인인 횟수</label>
            <NumInput id="bsm" className={inputCls} value={f.supplementDueToMismatch} onValue={(raw) => setF({ ...f, supplementDueToMismatch: raw })} />
          </div>
          <div>
            <label htmlFor="bmm" className={labelCls}>수작업으로 만들 때 걸리는 시간(분)</label>
            <NumInput id="bmm" className={inputCls} value={f.manualMinutes} onValue={(raw) => setF({ ...f, manualMinutes: raw })} />
          </div>
          <div>
            <label htmlFor="bsub" className={labelCls}>이대로 제출 가능한 수준인가</label>
            <select id="bsub" className={inputCls} value={f.submittable} onChange={set("submittable")}>
              <option value="">아직 확인 안 함</option>
              <option value="true">예, 제출 가능</option>
              <option value="false">아니오, 고쳐야 함</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="bcmp" className={labelCls}>수작업 결과와 비교한 내용</label>
            <textarea id="bcmp" className={`${inputCls} h-20`} value={f.comparison} onChange={set("comparison")} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className={btnCls}>베타 기록 저장</button>
            {msg && <span role={msg.ok ? "status" : "alert"} className={`text-[13px] ${msg.ok ? "" : "text-danger"}`}>{msg.text}</span>}
          </div>
        </form>
      </details>
    </section>
  );
}

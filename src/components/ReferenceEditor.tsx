"use client";

import { useState } from "react";
import { WORK_TYPES, type ReferenceData } from "@/lib/reference/types";
import { btnCls, btnGhostCls, inputCls } from "@/components/work/types";
import { NumInput } from "@/components/NumInput";

// 기준정보 관리 (SRS SR-DM-02·03): 직종·노임, 장비, 생산성, 일정 템플릿, 공휴일, 서류 템플릿, 용역비.
// 저장 전에 서버가 다시 검사하고, 바뀐 항목은 이력에 남긴다.
export function ReferenceEditor({ initial }: { initial: ReferenceData }) {
  const [ref, setRef] = useState<ReferenceData>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ReferenceData>(k: K, v: ReferenceData[K]) => setRef((r) => ({ ...r, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v.replace(/[^\d.]/g, "")) || 0);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ref),
      });
      const body = await res.json();
      if (res.ok) setMsg({ ok: true, lines: ["기준정보를 저장했습니다. 이미 만든 공사는 바뀌지 않고, 새로 만드는 계산부터 적용됩니다."] });
      else setMsg({ ok: false, lines: body.errors ?? [body.error ?? "저장하지 못했습니다."] });
    } catch {
      setMsg({ ok: false, lines: ["서버에 연결하지 못했습니다."] });
    }
    setBusy(false);
  }

  const card = "mt-6 rounded-md border border-border bg-surface p-6 shadow-sm";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px]">기준정보</h1>
        <button type="button" className={btnCls} disabled={busy} onClick={save}>{busy ? "저장하는 중…" : "저장"}</button>
      </div>
      {msg && (
        <ul role={msg.ok ? "status" : "alert"} className={`mt-3 list-disc rounded-sm p-3 pl-7 text-[13px] ${msg.ok ? "bg-success-soft" : "bg-danger-soft"}`}>
          {msg.lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}

      <section className={card} aria-label="직종·노임단가">
        <h2 className="text-[16px]">직종·노임단가 (원/일)</h2>
        {ref.trades.map((t, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <input aria-label="직종" className={inputCls} value={t.name} onChange={(e) => set("trades", ref.trades.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            <NumInput aria-label="노임단가" className={`${inputCls} text-right`} value={String(t.wage)} onValue={(raw) => set("trades", ref.trades.map((x, k) => (k === i ? { ...x, wage: num(raw) } : x)))} />
            <button type="button" className="text-danger underline" onClick={() => set("trades", ref.trades.filter((_, k) => k !== i))}>삭제</button>
          </div>
        ))}
        <button type="button" className={`${btnGhostCls} mt-3`} onClick={() => set("trades", [...ref.trades, { name: "", wage: 0 }])}>직종 추가</button>
      </section>

      <section className={card} aria-label="장비">
        <h2 className="text-[16px]">장비</h2>
        {ref.equipment.map((t, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <input aria-label="장비 이름" className={inputCls} value={t.name} onChange={(e) => set("equipment", ref.equipment.map((x, k) => (k === i ? { name: e.target.value } : x)))} />
            <button type="button" className="text-danger underline" onClick={() => set("equipment", ref.equipment.filter((_, k) => k !== i))}>삭제</button>
          </div>
        ))}
        <button type="button" className={`${btnGhostCls} mt-3`} onClick={() => set("equipment", [...ref.equipment, { name: "" }])}>장비 추가</button>
      </section>

      <section className={card} aria-label="생산성">
        <h2 className="text-[16px]">공종별 생산성 (단위당 인일)</h2>
        {ref.productivity.map((t, i) => (
          <div key={i} className="mt-2 grid grid-cols-[1fr_100px_120px_auto] gap-2">
            <input aria-label="공종" className={inputCls} value={t.name} onChange={(e) => set("productivity", ref.productivity.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            <input aria-label="단위" className={inputCls} value={t.unit} onChange={(e) => set("productivity", ref.productivity.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)))} />
            <NumInput aria-label="단위당 인일" allowDecimal className={`${inputCls} text-right`} value={String(t.manDaysPerUnit)} onValue={(raw) => set("productivity", ref.productivity.map((x, k) => (k === i ? { ...x, manDaysPerUnit: num(raw) } : x)))} />
            <button type="button" className="text-danger underline" onClick={() => set("productivity", ref.productivity.filter((_, k) => k !== i))}>삭제</button>
          </div>
        ))}
        <button type="button" className={`${btnGhostCls} mt-3`} onClick={() => set("productivity", [...ref.productivity, { name: "", unit: "", manDaysPerUnit: 0 }])}>생산성 추가</button>
      </section>

      <section className={card} aria-label="일정 템플릿">
        <h2 className="text-[16px]">일정 템플릿 (공종 유형별, 전체 공기 대비 %)</h2>
        <p className="mt-1 text-[13px] text-text-secondary">공정 이름에 &apos;포함어&apos;가 들어 있으면 그 시작~종료 비율로 일정을 채웁니다.</p>
        {WORK_TYPES.map((wt) => {
          const items = ref.scheduleTemplates.find((t) => t.workType === wt)?.items ?? [];
          const setItems = (next: typeof items) =>
            set("scheduleTemplates", [...ref.scheduleTemplates.filter((t) => t.workType !== wt), { workType: wt, items: next }]);
          return (
            <fieldset key={wt} className="mt-4">
              <legend className="text-[14px] font-bold">{wt}</legend>
              {items.map((it, i) => (
                <div key={i} className="mt-2 grid grid-cols-[1fr_90px_90px_auto] gap-2">
                  <input aria-label={`${wt} 포함어`} className={inputCls} value={it.keyword} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, keyword: e.target.value } : x)))} />
                  <NumInput aria-label={`${wt} 시작 %`} allowDecimal className={`${inputCls} text-right`} value={String(it.startPct)} onValue={(raw) => setItems(items.map((x, k) => (k === i ? { ...x, startPct: num(raw) } : x)))} />
                  <NumInput aria-label={`${wt} 종료 %`} allowDecimal className={`${inputCls} text-right`} value={String(it.endPct)} onValue={(raw) => setItems(items.map((x, k) => (k === i ? { ...x, endPct: num(raw) } : x)))} />
                  <button type="button" className="text-danger underline" onClick={() => setItems(items.filter((_, k) => k !== i))}>삭제</button>
                </div>
              ))}
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setItems([...items, { keyword: "", startPct: 0, endPct: 100 }])}>공정 추가</button>
            </fieldset>
          );
        })}
      </section>

      <section className={card} aria-label="공휴일">
        <h2 className="text-[16px]">공휴일 (한 줄에 하나, yyyy-mm-dd)</h2>
        <textarea aria-label="공휴일 목록" className={`${inputCls} mt-2 h-32`} value={ref.holidays.join("\n")} onChange={(e) => set("holidays", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
      </section>

      <section className={card} aria-label="서류 템플릿">
        <h2 className="text-[16px]">서류 템플릿 (고정 문안)</h2>
        <p className="mt-1 text-[13px] text-text-secondary">서식 샘플을 받으면 법정 문안을 그대로 등록합니다. 문안은 임의로 만들지 않습니다.</p>
        {ref.documentTemplates.map((t, i) => (
          <div key={i} className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input aria-label="서류 키" className={inputCls} value={t.key} onChange={(e) => set("documentTemplates", ref.documentTemplates.map((x, k) => (k === i ? { ...x, key: e.target.value } : x)))} />
              <input aria-label="서류 이름" className={inputCls} value={t.name} onChange={(e) => set("documentTemplates", ref.documentTemplates.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <button type="button" className="text-danger underline" onClick={() => set("documentTemplates", ref.documentTemplates.filter((_, k) => k !== i))}>삭제</button>
            </div>
            <textarea aria-label="서류 문안" className={`${inputCls} h-24`} value={t.body} onChange={(e) => set("documentTemplates", ref.documentTemplates.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)))} />
          </div>
        ))}
        <button type="button" className={`${btnGhostCls} mt-3`} onClick={() => set("documentTemplates", [...ref.documentTemplates, { key: "", name: "", body: "" }])}>서류 템플릿 추가</button>
      </section>

      <section className={card} aria-label="용역비">
        <h2 className="text-[16px]">용역비 공급가액 (원, 부가세 10% 별도)</h2>
        <NumInput aria-label="용역비 공급가액" className={`${inputCls} mt-2 max-w-[240px] text-right`} value={String(ref.feeSupply)} onValue={(raw) => set("feeSupply", num(raw))} />
      </section>
    </div>
  );
}

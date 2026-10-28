"use client";

import { useState } from "react";
import type { LayoutMapping, ParsedBudget } from "@/lib/budget/parse";
import { btnCls, btnGhostCls, inputCls, labelCls, type PatchWork, type WorkState } from "./types";
import { NumInput } from "@/components/NumInput";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "needsMapping"; reason: string; sheetNames: string[] };

const won = (n: number) => n.toLocaleString("ko-KR");

function withTotals(p: ParsedBudget): ParsedBudget {
  const summaryTotal = p.summary.reduce((s, r) => s + r.total, 0);
  return {
    ...p,
    summaryTotal,
    summaryTotalMatchesGrandTotal: p.grandTotal === null ? null : p.grandTotal === summaryTotal,
  };
}

const num = (v: string) => (v === "" ? 0 : Number(v.replace(/[^\d.-]/g, "")) || 0);

export function BudgetImport({ work, patch, projectId }: { work: WorkState; patch: PatchWork; projectId: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const parsed = work.parsed;

  async function send(file: File, mapping?: LayoutMapping) {
    setStatus({ kind: "loading" });
    const form = new FormData();
    form.set("file", file);
    if (mapping) form.set("mapping", JSON.stringify(mapping));
    try {
      const res = await fetch("/api/budget/parse", { method: "POST", body: form });
      const body = await res.json();
      if (res.status === 422 && body.needsMapping) {
        setStatus({ kind: "needsMapping", reason: body.reason, sheetNames: body.sheetNames });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: body.error ?? "내역서를 읽지 못했습니다." });
        return;
      }
      // 원본은 수정 없이 서버에 보관한다(SR-DM-05)
      const keep = new FormData();
      keep.set("file", file);
      keep.set("kind", "budget");
      const saved = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: keep });
      const kept = saved.ok ? ((await saved.json()) as { budgetOriginal: WorkState["budgetOriginal"] }).budgetOriginal : work.budgetOriginal;
      patch({ parsed: body.parsed, confirmed: false, schedule: {}, composition: null, extraLabor: [], extraEquipment: [], budgetOriginal: kept });
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    void send(picked);
  }

  const editSummary = (i: number, total: number) => {
    if (!parsed) return;
    const summary = parsed.summary.map((r, k) => (k === i ? { ...r, total } : r));
    patch({ parsed: withTotals({ ...parsed, summary }) });
  };
  const editLabor = (i: number, quantity: number) => {
    if (!parsed) return;
    patch({ parsed: { ...parsed, labor: parsed.labor.map((r, k) => (k === i ? { ...r, quantity } : r)) } });
  };
  const editEquip = (i: number, hours: number) => {
    if (!parsed) return;
    patch({ parsed: { ...parsed, equipment: parsed.equipment.map((r, k) => (k === i ? { ...r, hours } : r)) } });
  };
  const editGrand = (v: string) => {
    if (!parsed) return;
    patch({ parsed: withTotals({ ...parsed, grandTotal: v === "" ? null : num(v) }) });
  };

  return (
    <section aria-label="내역서 불러오기" className="mt-6 rounded-md border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px]">내역서 불러오기</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            내역서(.xlsx 또는 구형 .xls, 20MB 이하)를 올리면 집계표·노무·장비를 읽어 옵니다. 읽은 값을 확인·수정하고 &apos;확정&apos;해야 계산됩니다.
          </p>
        </div>
        <label className={`${btnGhostCls} cursor-pointer`}>
          {parsed ? "다른 내역서 올리기" : "내역서 선택"}
          <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={onFile} aria-label="내역서 엑셀 파일 선택" />
        </label>
      </div>

      {status.kind === "loading" && (
        <p role="status" className="mt-4 text-sm text-text-secondary">내역서를 읽는 중입니다…</p>
      )}
      {status.kind === "error" && (
        <div role="alert" className="mt-4 rounded-sm border border-danger bg-danger-soft p-3 text-sm">
          <strong className="text-danger">⚠ 읽지 못했습니다.</strong> {status.message}
        </div>
      )}
      {status.kind === "needsMapping" && file && (
        <MappingForm
          reason={status.reason}
          sheetNames={status.sheetNames}
          onSubmit={(m) => void send(file, m)}
        />
      )}

      {parsed && (
        <div className="mt-5">
          {parsed.warnings.length > 0 && (
            <ul role="alert" className="mb-4 list-disc rounded-sm border border-warn bg-warn-soft p-3 pl-7 text-[13px]">
              {parsed.warnings.map((w) => (
                <li key={w}>
                  <strong className="text-warn">⚠</strong> {w}
                </li>
              ))}
            </ul>
          )}

          {work.confirmed ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-success-soft p-3 text-sm">
              <span>
                <strong className="text-success">✓ 확정됨</strong> — 공종 {parsed.summary.length}개, 순공사비 {won(parsed.summaryTotal)}원, 노무 {parsed.labor.length}행, 장비 {parsed.equipment.length}행
              </span>
              <button type="button" className={btnGhostCls} onClick={() => patch({ confirmed: false })}>
                수정하기
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-[15px] font-bold">집계표 (공종별 합계, 원)</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface-alt text-left">
                      <th className="p-2">공종코드</th>
                      <th className="p-2">공종명</th>
                      <th className="p-2 text-right">재료비</th>
                      <th className="p-2 text-right">노무비</th>
                      <th className="p-2 text-right">경비</th>
                      <th className="p-2 text-right">합계(수정 가능)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.summary.map((r, i) => (
                      <tr key={`${r.code}-${i}`} className="border-t border-border">
                        <td className="p-2">{r.code}</td>
                        <td className="p-2">
                          {r.name}
                          {r.total === 0 && (
                            <span className="ml-2 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] text-text-secondary">협조 구간</span>
                          )}
                        </td>
                        <td className="p-2 text-right">{won(r.material)}</td>
                        <td className="p-2 text-right">{won(r.labor)}</td>
                        <td className="p-2 text-right">{won(r.expense)}</td>
                        <td className="p-2 text-right">
                          <NumInput
                            aria-label={`${r.name} 합계`}
                            className={`${inputCls} text-right`}
                            value={String(r.total)}
                            onValue={(raw) => editSummary(i, num(raw))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold">
                      <td className="p-2" colSpan={5}>순공사비 합계 (공종 합계의 합)</td>
                      <td className="p-2 text-right">{won(parsed.summaryTotal)}</td>
                    </tr>
                    <tr>
                      <td className="p-2" colSpan={5}>
                        <label htmlFor="grandTotal" className="font-semibold">집계표의 합계 행 (검산 기준)</label>
                      </td>
                      <td className="p-2 text-right">
                        <NumInput
                          id="grandTotal"
                          className={`${inputCls} text-right`}
                          value={parsed.grandTotal === null ? "" : String(parsed.grandTotal)}
                          onValue={editGrand}
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {parsed.summaryTotalMatchesGrandTotal === false && (
                <p role="alert" className="mt-2 text-[13px] text-danger">
                  ⚠ 공종 합계의 합이 합계 행과 다릅니다. 확정하면 3장 검증에서 차이가 표시됩니다.
                </p>
              )}

              <h3 className="mt-6 text-[15px] font-bold">노무 (내역서 수량, 인)</h3>
              {parsed.labor.length === 0 ? (
                <p className="mt-2 text-[13px] text-text-secondary">노무 행(단위 &apos;인&apos;)을 찾지 못했습니다. 3장에서 직접 지정으로 입력할 수 있습니다.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-surface-alt text-left">
                        <th className="p-2">공종코드</th>
                        <th className="p-2">직종</th>
                        <th className="p-2 text-right">수량(인, 수정 가능)</th>
                        <th className="p-2 text-right">노임단가</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.labor.map((r, i) => (
                        <tr key={`${r.code}-${r.trade}-${i}`} className="border-t border-border">
                          <td className="p-2">{r.code}</td>
                          <td className="p-2">{r.trade}</td>
                          <td className="p-2 text-right">
                            <NumInput
                              aria-label={`${r.trade} 수량`}
                              allowDecimal
                              className={`${inputCls} text-right`}
                              value={String(r.quantity)}
                              onValue={(raw) => editLabor(i, num(raw))}
                            />
                          </td>
                          <td className="p-2 text-right">{won(r.wage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="mt-6 text-[15px] font-bold">장비 (내역서 시간, HR → 대·일은 올림(HR÷8))</h3>
              {parsed.equipment.length === 0 ? (
                <p className="mt-2 text-[13px] text-text-secondary">장비 행(단위 HR)이 없습니다. 3장에서 가정 장비를 직접 지정할 수 있습니다.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-surface-alt text-left">
                        <th className="p-2">공종코드</th>
                        <th className="p-2">장비</th>
                        <th className="p-2 text-right">시간(HR, 수정 가능)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.equipment.map((r, i) => (
                        <tr key={`${r.code}-${r.name}-${i}`} className="border-t border-border">
                          <td className="p-2">{r.code}</td>
                          <td className="p-2">{r.name}</td>
                          <td className="p-2 text-right">
                            <NumInput
                              aria-label={`${r.name} 시간`}
                              allowDecimal
                              className={`${inputCls} text-right`}
                              value={String(r.hours)}
                              onValue={(raw) => editEquip(i, num(raw))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button type="button" className={btnCls} onClick={() => patch({ confirmed: true })}>
                  확인했습니다. 확정하고 계산하기
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ── 열 매핑 (SR-IN-05) ─────────────────────────────────────────

const SUMMARY_COLS: [string, string][] = [
  ["code", "공종코드"],
  ["name", "공종명"],
  ["material", "재료비"],
  ["labor", "노무비"],
  ["expense", "경비"],
  ["total", "합계"],
];
const DETAIL_COLS: [string, string][] = [
  ["code", "공종코드"],
  ["name", "품명"],
  ["spec", "규격"],
  ["unit", "단위"],
  ["quantity", "수량"],
  ["wage", "노임단가"],
];

function MappingForm({
  reason,
  sheetNames,
  onSubmit,
}: {
  reason: string;
  sheetNames: string[];
  onSubmit: (m: LayoutMapping) => void;
}) {
  const [summarySheet, setSummarySheet] = useState(sheetNames[0] ?? "");
  const [detailSheet, setDetailSheet] = useState(sheetNames[1] ?? sheetNames[0] ?? "");
  const [summaryHeader, setSummaryHeader] = useState("1");
  const [detailHeader, setDetailHeader] = useState("1");
  const [sc, setSc] = useState<Record<string, string>>({ code: "1", name: "2", material: "3", labor: "4", expense: "5", total: "6" });
  const [dc, setDc] = useState<Record<string, string>>({ code: "1", name: "2", spec: "3", unit: "4", quantity: "5", wage: "6" });

  const toCols = (c: Record<string, string>) =>
    Object.fromEntries(Object.entries(c).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));

  return (
    <form
      className="mt-4 rounded-sm border border-warn bg-warn-soft p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          summary: { sheet: summarySheet, headerRow: Number(summaryHeader), columns: toCols(sc) },
          detail: { sheet: detailSheet, headerRow: Number(detailHeader), columns: toCols(dc) },
        });
      }}
    >
      <p role="alert" className="text-sm">
        <strong className="text-warn">⚠ 자동 인식 실패</strong> — {reason}
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <fieldset>
          <legend className="text-[14px] font-bold">집계표</legend>
          <label className={`${labelCls} mt-2`} htmlFor="sumSheet">시트</label>
          <select id="sumSheet" className={inputCls} value={summarySheet} onChange={(e) => setSummarySheet(e.target.value)}>
            {sheetNames.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className={`${labelCls} mt-2`} htmlFor="sumHeader">머리글 행 번호</label>
          <input id="sumHeader" inputMode="numeric" className={inputCls} value={summaryHeader} onChange={(e) => setSummaryHeader(e.target.value)} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SUMMARY_COLS.map(([k, label]) => (
              <div key={k}>
                <label className="text-[12px] text-text-secondary" htmlFor={`s-${k}`}>{label} 열</label>
                <input id={`s-${k}`} inputMode="numeric" className={inputCls} value={sc[k]} onChange={(e) => setSc({ ...sc, [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[14px] font-bold">내역서</legend>
          <label className={`${labelCls} mt-2`} htmlFor="detSheet">시트</label>
          <select id="detSheet" className={inputCls} value={detailSheet} onChange={(e) => setDetailSheet(e.target.value)}>
            {sheetNames.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className={`${labelCls} mt-2`} htmlFor="detHeader">머리글 행 번호</label>
          <input id="detHeader" inputMode="numeric" className={inputCls} value={detailHeader} onChange={(e) => setDetailHeader(e.target.value)} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DETAIL_COLS.map(([k, label]) => (
              <div key={k}>
                <label className="text-[12px] text-text-secondary" htmlFor={`d-${k}`}>{label} 열</label>
                <input id={`d-${k}`} inputMode="numeric" className={inputCls} value={dc[k]} onChange={(e) => setDc({ ...dc, [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex justify-end">
        <button type="submit" className={btnCls}>이 열 위치로 다시 읽기</button>
      </div>
    </form>
  );
}

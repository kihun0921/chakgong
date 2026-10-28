"use client";

import { useMemo, useState } from "react";
import { addDays, periodLabel, type DateStr, type Period } from "@/domain/calendar";
import type { LaborMethod, ResourcePlan } from "@/domain/labor";
import type { PlanResult } from "@/domain/plan";
import { round2 } from "@/domain/progress";
import { CHAPTERS } from "@/lib/chapters";
import { applyScheduleTemplate } from "@/domain/template";
import { mergeHolidaysText, WORK_TYPES, type ReferenceData, type WorkType } from "@/lib/reference/types";
import { buildPlan, extraToLines, type BuildPlanOutput, type ExtraLine } from "@/lib/work/buildPlan";
import { defaultComposition, type Composition } from "@/lib/work/composition";
import { ProcessComposer } from "./ProcessComposer";
import { BudgetImport } from "./BudgetImport";
import { Tabs } from "./Tabs";
import { btnCls, btnGhostCls, inputCls, labelCls, type PatchWork, type WorkState } from "./types";
import { NumInput } from "@/components/NumInput";

const chapter = CHAPTERS.find((c) => c.key === "schedule")!;
const won = (n: number) => n.toLocaleString("ko-KR");


function outsidePeriod(p: Period, start: DateStr, completion: DateStr): boolean {
  return p.end < start || p.start > completion;
}

type Props = {
  work: WorkState;
  patch: PatchWork;
  docKey: string;
  onDocChange: (key: string) => void;
  projectId: string;
  onSave: () => Promise<boolean>;
  reference: ReferenceData;
};

export function ScheduleChapter({ work, patch, docKey, onDocChange, projectId, onSave, reference }: Props) {
  const g = work.general;
  const out = useMemo(
    () =>
      buildPlan({
        parsed: work.confirmed ? work.parsed : null,
        startDate: g.startDate,
        durationDays: g.durationDays,
        holidaysText: work.holidaysText,
        schedule: work.schedule,
        composition: work.composition,
        remarks: work.remarks,
        locations: work.locations,
        extraLabor: work.extraLabor,
        extraEquipment: work.extraEquipment,
      }),
    [work.confirmed, work.parsed, g.startDate, g.durationDays, work.holidaysText, work.schedule, work.composition, work.remarks, work.locations, work.extraLabor, work.extraEquipment],
  );

  const doc = chapter.docs.find((d) => d.key === docKey) ?? chapter.docs[0];

  return (
    <div>
      <BudgetImport work={work} patch={patch} projectId={projectId} />

      {work.confirmed && (
        <>
          <ValidationPanel out={out} />
          <ExportBar out={out} projectId={projectId} onSave={onSave} />
          <Settings work={work} patch={patch} reference={reference} />
          {work.parsed && <ProcessComposer work={work} patch={patch} parsed={work.parsed} />}
        </>
      )}

      {out.result && (
        <>
          <Tabs
            variant="doc"
            ariaLabel="공정표·인원장비계획서 문서"
            active={doc.key}
            onChange={onDocChange}
            items={chapter.docs.map((d) => ({ key: d.key, label: d.label, hint: `목차 ${d.toc.join("·")}` }))}
          />
          {doc.key === "gantt" && <GanttTab out={out} work={work} patch={patch} result={out.result} reference={reference} />}
          {doc.key === "labor" && <LaborTab out={out} work={work} patch={patch} result={out.result} reference={reference} />}
        </>
      )}
    </div>
  );
}

// ── 검증 결과 ─────────────────────────────────────────────

function ValidationPanel({ out }: { out: BuildPlanOutput }) {
  if (out.error) {
    return (
      <div role="alert" className="mt-4 rounded-md border border-danger bg-danger-soft p-4 text-sm">
        <strong className="text-danger">⚠ 계산할 수 없습니다.</strong> {out.error}
      </div>
    );
  }
  if (!out.result) return null;
  const v = out.result.validation;
  return (
    <div
      role={v.passed ? "status" : "alert"}
      className={`mt-4 rounded-md border p-4 text-sm ${v.passed ? "border-success bg-success-soft" : "border-danger bg-danger-soft"}`}
    >
      {v.passed ? (
        <strong className="text-success">✓ 검증 통과 — 금액·진도율·연인원·공기가 모두 맞습니다.</strong>
      ) : (
        <>
          <strong className="text-danger">⚠ 검증 미통과 — 아래를 고치면 출력할 수 있습니다.</strong>
          <ul className="mt-2 list-disc pl-5">
            {v.issues.map((i) => (
              <li key={i.message}>{i.message}</li>
            ))}
          </ul>
        </>
      )}
      {out.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[13px] text-text-secondary">
          {out.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 일정 설정 (착공일·공기·공휴일) ─────────────────────────────

function Settings({ work, patch, reference }: { work: WorkState; patch: PatchWork; reference: ReferenceData }) {
  const g = work.general;
  return (
    <section aria-label="일정 설정" className="mt-4 rounded-md border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-[18px]">일정 설정</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <span className={labelCls}>착공일</span>
          <div className="rounded-sm bg-surface-alt px-3 py-2 text-sm">{g.startDate || "미입력 (1장에서 입력)"}</div>
        </div>
        <div>
          <span className={labelCls}>공사기간(일)</span>
          <div className="rounded-sm bg-surface-alt px-3 py-2 text-sm">{g.durationDays || "미입력 (1장에서 입력)"}</div>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="holidays" className={labelCls}>
            공휴일 (공기 안의 공휴일을 날짜로 입력. 쉼표·줄바꿈·공백으로 구분)
          </label>
          <textarea
            id="holidays"
            rows={2}
            className={inputCls}
            placeholder="예: 2026-12-25, 2027-01-01"
            value={work.holidaysText}
            onChange={(e) => patch({ holidaysText: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" className={btnGhostCls} disabled={reference.holidays.length === 0} onClick={() => patch({ holidaysText: mergeHolidaysText(work.holidaysText, reference.holidays) })}>
              기준정보 공휴일 가져오기 ({reference.holidays.length}일)
            </button>
            <p className="text-[12px] text-text-muted">토·일은 자동으로 제외됩니다. 기준정보의 공휴일은 가져오는 순간에만 이 공사에 반영됩니다(저장된 결과가 저절로 바뀌지 않게).</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 공사예정공정표 ────────────────────────────────────────

function GanttTab({ out, work, patch, result, reference }: { out: BuildPlanOutput; work: WorkState; patch: PatchWork; result: PlanResult; reference: ReferenceData }) {
  const start = work.general.startDate;
  const { periods, progress } = result;
  const totalWeight = progress.rows.reduce((s, r) => s + r.weight, 0);
  const totalAmount = out.processes.reduce((s, p) => s + p.amount, 0);
  const grand = work.parsed?.grandTotal ?? work.parsed?.summaryTotal ?? totalAmount;

  const setDay = (key: string, field: "startDay" | "endDay", v: string, cur: { startDay: number; endDay: number }) => {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 1) return;
    patch({ schedule: { ...work.schedule, [key]: { ...cur, [field]: n } } });
  };

  return (
    <section aria-label="공사예정공정표" className="mt-4 rounded-md border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-[18px]">공사예정공정표</h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        준공예정일 {result.completion}. 공종마다 착수·완료 일차(착공일 = 1일차)를 입력하면 진도율이 바로 다시 계산됩니다. 일정을 정하지 않은 공정은 전체 공기로 둡니다.
      </p>
      <TemplateBar out={out} work={work} patch={patch} reference={reference} />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-surface-alt text-left">
              <th className="p-2">공종</th>
              <th className="p-2 text-right">보할(%)</th>
              <th className="p-2 text-right">순공사비(원)</th>
              <th className="p-2">착수일차</th>
              <th className="p-2">완료일차</th>
              <th className="p-2">착수일</th>
              <th className="p-2">완료일</th>
              <th className="p-2">주요 공정내용</th>
              {periods.map((p) => {
                const gray = outsidePeriod(p, start, result.completion);
                return (
                  <th key={p.index} className={`p-2 text-right ${gray ? "bg-border text-text-muted" : ""}`} scope="col">
                    {periodLabel(p)}
                    {gray && <span className="block text-[10px]">공기 밖</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {out.processes.map((p, i) => {
              const row = progress.rows[i];
              const over = p.endDay > Number(work.general.durationDays);
              return (
                <tr key={p.key} className="border-t border-border">
                  <td className="p-2">
                    {p.name}
                    {p.amount === 0 && (
                      <span className="ml-1 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] text-text-secondary">협조</span>
                    )}
                  </td>
                  <td className="p-2 text-right">{round2(row.weight).toFixed(2)}</td>
                  <td className="p-2 text-right">{p.amount === 0 ? "-" : won(p.amount)}</td>
                  <td className="p-2">
                    <NumInput
                      aria-label={`${p.name} 착수일차`}
                      className={`${inputCls} w-16 text-right`}
                      value={String(p.startDay)}
                      onValue={(raw) => setDay(p.key, "startDay", raw, p)}
                    />
                  </td>
                  <td className="p-2">
                    <NumInput
                      aria-label={`${p.name} 완료일차`}
                      aria-invalid={over}
                      className={`${inputCls} w-16 text-right ${over ? "border-danger" : ""}`}
                      value={String(p.endDay)}
                      onValue={(raw) => setDay(p.key, "endDay", raw, p)}
                    />
                    {over && <span className="block text-[11px] text-danger">⚠ 공기 초과</span>}
                  </td>
                  <td className="p-2">{addDays(start, p.startDay - 1)}</td>
                  <td className="p-2">{addDays(start, p.endDay - 1)}</td>
                  <td className="p-2">
                    <input
                      aria-label={`${p.name} 주요 공정내용`}
                      className={`${inputCls} min-w-[180px]`}
                      value={work.remarks[p.key] ?? ""}
                      placeholder="예: 설계도서 검토, 현장조사"
                      onChange={(e) => patch({ remarks: { ...work.remarks, [p.key]: e.target.value } })}
                    />
                  </td>
                  {row.byPeriod.map((v, k) => (
                    <td
                      key={k}
                      className="p-2 text-right"
                      style={v > 0 ? { background: "color-mix(in oklch, var(--accent) 16%, transparent)" } : undefined}
                    >
                      {v > 0 ? round2(v).toFixed(2) : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td className="p-2">합계 / 구간 진도율 계</td>
              <td className="p-2 text-right">{round2(totalWeight).toFixed(2)}</td>
              <td className="p-2 text-right">{won(totalAmount)}</td>
              <td className="p-2" colSpan={5}></td>
              {progress.periodTotals.map((v, k) => (
                <td key={k} className="p-2 text-right">{round2(v).toFixed(2)}</td>
              ))}
            </tr>
            <tr className="font-bold">
              <td className="p-2" colSpan={8}>진도율 누계</td>
              {progress.cumulative.map((v, k) => (
                <td key={k} className="p-2 text-right">{round2(v).toFixed(2)}</td>
              ))}
            </tr>
            <tr>
              <td className="p-2" colSpan={8}>검산: 공정표 합계 − 집계표 합계 (원)</td>
              <td className="p-2 text-right font-bold" colSpan={periods.length}>
                {totalAmount - grand === 0 ? "✓ 0 (일치)" : `⚠ ${won(totalAmount - grand)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ── 인력 및 장비투입계획서 ─────────────────────────────────

const METHOD_ICON: Record<LaborMethod, string> = { 내역서: "●", 환산: "▲", 생산성: "▲", 가정: "▲" };

function methodsOf(plan: ResourcePlan, name: string): LaborMethod[] {
  return [...new Set(plan.basisList.filter((b) => b.name === name).map((b) => b.method))];
}

function ResourceTable({
  title,
  unit,
  plan,
  periods,
  daily,
}: {
  title: string;
  unit: string;
  plan: ResourcePlan;
  periods: Period[];
  daily?: (number | null)[];
}) {
  const names = Object.keys(plan.byName);
  return (
    <div className="mt-6">
      <h3 className="text-[15px] font-bold">{title}</h3>
      {names.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-secondary">입력된 {title} 항목이 없습니다. 아래 &apos;직접 지정&apos;으로 추가할 수 있습니다.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-surface-alt text-left">
                <th className="p-2">{unit === "인일" ? "직종" : "장비"}</th>
                <th className="p-2">산정 방식</th>
                {periods.map((p) => (
                  <th key={p.index} className="p-2 text-right" scope="col">{periodLabel(p)}</th>
                ))}
                <th className="p-2 text-right">투입수({unit})</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const methods = methodsOf(plan, n);
                const assumed = methods.some((m) => m !== "내역서");
                return (
                  <tr key={n} className="border-t border-border">
                    <td className="p-2">{n}</td>
                    <td className="p-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${assumed ? "bg-warn-soft text-warn" : "bg-primary-soft text-primary"}`}
                      >
                        {methods.map((m) => `${METHOD_ICON[m]} ${m}`).join(" · ")}
                      </span>
                    </td>
                    {plan.byName[n].map((v, k) => (
                      <td key={k} className="p-2 text-right">{v ? won(v) : ""}</td>
                    ))}
                    <td className="p-2 text-right font-bold">{won(plan.byName[n].reduce((s, v) => s + v, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td className="p-2" colSpan={2}>소계</td>
                {plan.periodTotals.map((v, k) => (
                  <td key={k} className="p-2 text-right">{won(v)}</td>
                ))}
                <td className="p-2 text-right">{won(plan.total)}</td>
              </tr>
              {daily && (
                <tr>
                  <td className="p-2" colSpan={2}>일평균 투입인원</td>
                  {daily.map((v, k) => (
                    <td key={k} className="p-2 text-right">{v === null ? "" : v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                  ))}
                  <td className="p-2"></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
      {plan.total > 0 && (
        <p className="mt-2 text-[12.5px] text-text-secondary">
          ▲ 가정(환산·생산성·직접 지정)으로 만든 값: {won(plan.assumedTotal)}{unit} / 전체 {won(plan.total)}{unit} ({round2((plan.assumedTotal / plan.total) * 100)}%). 가정이 들어간 값은 납품 전에 사람이 확인해야 합니다.
        </p>
      )}
      <details className="mt-2 text-[12.5px]">
        <summary className="cursor-pointer font-semibold text-text-secondary">산정근거 보기 ({plan.basisList.length}건)</summary>
        <ul className="mt-2 list-disc pl-5 text-text-secondary">
          {plan.basisList.map((b, i) => (
            <li key={i}>
              {b.name}({b.processKey}) {b.manDays}{unit} — {METHOD_ICON[b.method]} {b.method}: {b.basis}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

type ExtraMode = NonNullable<ExtraLine["mode"]>;
const LABOR_MODES: { key: ExtraMode; label: string }[] = [
  { key: "perDay", label: "인원/일 × 일수" },
  { key: "cost", label: "노무비 환산 (공정 노무비 × 배분율 ÷ 노임단가)" },
  { key: "qty", label: "물량 × 생산성 × 배분율" },
  { key: "days", label: "인일 직접 입력" },
];
const EQUIP_MODES: { key: ExtraMode; label: string }[] = [
  { key: "perDay", label: "대수 × 일수" },
  { key: "days", label: "대·일 직접 입력" },
];

function ExtraForm({
  label,
  unitLabel,
  lines,
  processes,
  composition,
  wageHints,
  traitNames,
  onChange,
}: {
  label: string;
  unitLabel: string;
  lines: ExtraLine[];
  processes: { key: string; name: string }[];
  composition: Composition;
  /** 직종별 노임단가 후보(내역서 노무 행, 기준정보) */
  wageHints: Record<string, number>;
  traitNames: string[];
  onChange: (lines: ExtraLine[]) => void;
}) {
  const isLabor = label === "인원";
  const modes = isLabor ? LABOR_MODES : EQUIP_MODES;
  const [processKey, setProcessKey] = useState(processes[0]?.key ?? "");
  const [mode, setMode] = useState<ExtraMode>("perDay");
  const [name, setName] = useState("");
  const [perDay, setPerDay] = useState("1");
  const [workdays, setWorkdays] = useState("1");
  const [share, setShare] = useState("100"); // %
  const [wage, setWage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [productivity, setProductivity] = useState("");
  const [manDays, setManDays] = useState("");

  // 공정 목록이 바뀌어(나누기·합치기) 고른 공정이 사라졌으면 첫 공정으로 되돌린다
  const effectiveKey = processes.some((p) => p.key === processKey) ? processKey : (processes[0]?.key ?? "");
  const def = composition.find((d) => d.id === effectiveKey);
  const wageValue = wage !== "" ? wage : String(wageHints[name.trim()] ?? "");

  const draft = (id: number): ExtraLine => ({
    id,
    processKey: effectiveKey,
    name: name.trim(),
    perDay: mode === "perDay" ? Number(perDay) || 0 : 0,
    workdays: mode === "perDay" ? Number(workdays) || 0 : 0,
    mode,
    ...(mode === "cost" ? { share: (Number(share) || 0) / 100, wage: Number(wageValue) || 0 } : {}),
    ...(mode === "qty" ? { quantity: Number(quantity) || 0, productivity: Number(productivity) || 0, share: (Number(share) || 0) / 100 } : {}),
    ...(mode === "days" ? { manDays: Number(manDays) || 0 } : {}),
  });
  // 입력 중에 결과를 미리 보여 준다(추가하기 전에 값을 확인하게)
  const preview = (() => {
    if (name.trim() === "" || effectiveKey === "") return null;
    const w: string[] = [];
    const r = extraToLines([draft(0)], composition, w);
    return r[0] ? { value: r[0].manDays, basis: r[0].basis } : { error: w[0] ?? "계산할 수 없습니다." };
  })();

  const add = () => {
    if (name.trim() === "" || effectiveKey === "" || !preview || "error" in preview) return;
    onChange([...lines, draft(Date.now())]);
    setName("");
    setWage("");
  };

  const lineText = (l: ExtraLine) => {
    const w: string[] = [];
    const r = extraToLines([l], composition, w)[0];
    const pname = processes.find((p) => p.key === l.processKey)?.name ?? l.processKey;
    return r ? `▲ ${r.method}: ${l.name} (${pname}) — ${r.basis} = ${won(r.manDays)}` : `⚠ ${l.name}: ${w[0] ?? "계산할 수 없습니다"}`;
  };

  return (
    <fieldset className="mt-4 rounded-sm border border-border p-4">
      <legend className="px-1 text-[13px] font-bold">{label} 직접 지정 (가정)</legend>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor={`x-p-${label}`} className={labelCls}>공정</label>
          <select id={`x-p-${label}`} className={inputCls} value={effectiveKey} onChange={(e) => setProcessKey(e.target.value)}>
            {processes.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`x-m-${label}`} className={labelCls}>산정 방식</label>
          <select id={`x-m-${label}`} className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ExtraMode)}>
            {modes.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`x-n-${label}`} className={labelCls}>{isLabor ? "직종" : "장비 이름"}</label>
          <input id={`x-n-${label}`} list={`x-l-${label}`} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={isLabor ? "예: 기계설비공" : "예: 고소작업대"} />
          <datalist id={`x-l-${label}`}>{traitNames.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {mode === "perDay" && (
          <>
            <div>
              <label htmlFor={`x-d-${label}`} className={labelCls}>{unitLabel}</label>
              <NumInput id={`x-d-${label}`} className={inputCls} value={perDay} onValue={setPerDay} />
            </div>
            <div>
              <label htmlFor={`x-w-${label}`} className={labelCls}>일수</label>
              <NumInput id={`x-w-${label}`} className={inputCls} value={workdays} onValue={setWorkdays} />
            </div>
          </>
        )}
        {mode === "cost" && (
          <>
            <div>
              <span className={labelCls}>공정 노무비(원)</span>
              <div className="rounded-sm bg-surface-alt px-3 py-2 text-sm">{won(def?.laborCost ?? 0)}</div>
            </div>
            <div>
              <label htmlFor={`x-s-${label}`} className={labelCls}>직종 배분율(%)</label>
              <NumInput id={`x-s-${label}`} allowDecimal className={inputCls} value={share} onValue={setShare} />
            </div>
            <div>
              <label htmlFor={`x-g-${label}`} className={labelCls}>노임단가(원/일)</label>
              <NumInput id={`x-g-${label}`} className={inputCls} value={wageValue} onValue={setWage} />
              {wageHints[name.trim()] !== undefined && wage === "" && <p className="mt-1 text-[11px] text-text-muted">내역서·기준정보의 노임단가를 불러왔습니다.</p>}
            </div>
          </>
        )}
        {mode === "qty" && (
          <>
            <div>
              <label htmlFor={`x-q-${label}`} className={labelCls}>물량</label>
              <NumInput id={`x-q-${label}`} allowDecimal className={inputCls} value={quantity} onValue={setQuantity} />
            </div>
            <div>
              <label htmlFor={`x-r-${label}`} className={labelCls}>생산성(인일/단위)</label>
              <NumInput id={`x-r-${label}`} allowDecimal className={inputCls} value={productivity} onValue={setProductivity} />
            </div>
            <div>
              <label htmlFor={`x-s-${label}`} className={labelCls}>직종 배분율(%)</label>
              <NumInput id={`x-s-${label}`} allowDecimal className={inputCls} value={share} onValue={setShare} />
            </div>
          </>
        )}
        {mode === "days" && (
          <div>
            <label htmlFor={`x-i-${label}`} className={labelCls}>{isLabor ? "인일" : "대·일"}</label>
            <NumInput id={`x-i-${label}`} className={inputCls} value={manDays} onValue={setManDays} />
          </div>
        )}
        <div className="flex items-end">
          <button type="button" className={btnCls} disabled={!preview || "error" in preview} onClick={add}>추가</button>
        </div>
      </div>
      {preview && (
        <p className={`mt-2 text-[12.5px] ${"error" in preview ? "text-warn" : "text-text-secondary"}`} aria-live="polite">
          {"error" in preview ? `⚠ ${preview.error}` : `미리보기: ${won(preview.value)}${isLabor ? "인일" : "대·일"} — ${preview.basis}`}
        </p>
      )}
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px]">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-sm bg-warn-soft px-3 py-1.5">
              <span>{lineText(l)}</span>
              <button type="button" className="shrink-0 text-danger underline" onClick={() => onChange(lines.filter((x) => x.id !== l.id))}>삭제</button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

// '위치별' 작업 구간: 투입계획표 위쪽에 막대로 표시한다(예: 옥상(실외기 양중·설치) 15~21일차)
function LocationsEditor({ work, patch }: { work: WorkState; patch: PatchWork }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("");
  const [remark, setRemark] = useState("");
  const duration = Number(work.general.durationDays) || 0;
  const f = Number(from);
  const t = Number(to);
  const valid = name.trim() !== "" && Number.isInteger(f) && Number.isInteger(t) && f >= 1 && t >= f && (duration === 0 || t <= duration);
  const add = () => {
    if (!valid) return;
    patch({ locations: [...work.locations, { id: String(Date.now()), name: name.trim(), startDay: f, endDay: t, remark: remark.trim() }] });
    setName("");
    setRemark("");
  };
  return (
    <fieldset className="mt-4 rounded-sm border border-border p-4">
      <legend className="px-1 text-[13px] font-bold">위치별 작업 구간 (투입계획표 위쪽 표시)</legend>
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <label htmlFor="loc-name" className={labelCls}>위치 이름</label>
          <input id="loc-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 옥상(실외기 양중·설치), 차탄1지구" />
        </div>
        <div>
          <label htmlFor="loc-from" className={labelCls}>착수일차</label>
          <NumInput id="loc-from" className={inputCls} value={from} onValue={setFrom} />
        </div>
        <div>
          <label htmlFor="loc-to" className={labelCls}>완료일차</label>
          <NumInput id="loc-to" className={inputCls} value={to} onValue={setTo} />
        </div>
        <div className="flex items-end">
          <button type="button" className={btnCls} disabled={!valid} onClick={add}>추가</button>
        </div>
        <div className="sm:col-span-5">
          <label htmlFor="loc-remark" className={labelCls}>비고(막대 옆에 작게 표시, 비워도 됩니다)</label>
          <input id="loc-remark" className={inputCls} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="예: 주 작업 구간(공정표 해당 공정과 연동)" />
        </div>
      </div>
      {work.locations.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px]">
          {work.locations.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-sm bg-surface-alt px-3 py-1.5">
              <span>
                {l.name} — {l.startDay}~{l.endDay}일차{l.remark ? ` · ${l.remark}` : ""}
              </span>
              <button type="button" className="shrink-0 text-danger underline" onClick={() => patch({ locations: work.locations.filter((x) => x.id !== l.id) })}>삭제</button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function LaborTab({ out, work, patch, result, reference }: { out: BuildPlanOutput; work: WorkState; patch: PatchWork; result: PlanResult; reference: ReferenceData }) {
  const processes = out.processes.map((p) => ({ key: p.key, name: p.name }));
  const composition: Composition = work.composition ?? (work.parsed ? defaultComposition(work.parsed) : []);
  // 노임단가 후보: 내역서 노무 행의 단가 → 기준정보 직종 단가 순
  const wageHints: Record<string, number> = {};
  for (const t of reference.trades) if (t.wage > 0) wageHints[t.name] = t.wage;
  for (const l of work.parsed?.labor ?? []) if (l.wage > 0) wageHints[l.trade] = l.wage;
  const tradeNames = [...new Set([...Object.keys(wageHints), ...(work.parsed?.labor ?? []).map((l) => l.trade)])];
  return (
    <section aria-label="인력 및 장비투입계획서" className="mt-4 rounded-md border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-[18px]">인력 및 장비투입계획서</h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        내역서 수량(●)은 그대로 쓰고, 직접 지정한 값(▲ 가정)은 따로 표시합니다. 구간별 값은 작업일수에 비례해 정수로 나누고 합이 총량과 같습니다.
      </p>
      <LocationsEditor work={work} patch={patch} />
      <ResourceTable title="인원투입 (직종별 연인원)" unit="인일" plan={result.labor} periods={result.periods} daily={result.dailyAverage} />
      <ExtraForm
        label="인원"
        unitLabel="인원/일"
        lines={work.extraLabor}
        processes={processes}
        composition={composition}
        wageHints={wageHints}
        traitNames={tradeNames}
        onChange={(extraLabor) => patch({ extraLabor })}
      />
      <ResourceTable title="장비투입 (대·일)" unit="대·일" plan={result.equipment} periods={result.periods} />
      <ExtraForm
        label="장비"
        unitLabel="대수"
        lines={work.extraEquipment}
        processes={processes}
        composition={composition}
        wageHints={{}}
        traitNames={reference.equipment.map((e) => e.name)}
        onChange={(extraEquipment) => patch({ extraEquipment })}
      />
    </section>
  );
}

// ── 출력 (xlsx·PDF) ───────────────────────────────────────

function ExportBar({ out, projectId, onSave }: { out: BuildPlanOutput; projectId: string; onSave: () => Promise<boolean> }) {
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");
  const [message, setMessage] = useState("");
  const ok = out.result?.validation.passed === true;

  async function download(kind: "xlsx" | "pdf") {
    setBusy(kind);
    setMessage("");
    try {
      // 서버는 저장된 공사로 만들므로 먼저 저장한다
      if (!(await onSave())) {
        setMessage("저장하지 못해 출력할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const body = await res.json();
        setMessage(
          body.reason === "invalid"
            ? "검증을 통과하지 못해 출력할 수 없습니다. 위의 항목을 먼저 고쳐 주세요."
            : (body.message ?? body.error ?? "출력하지 못했습니다."),
        );
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "xlsx" ? "공정표_인원장비투입계획표.xlsx" : "공정표_인원장비투입계획표.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setMessage("파일을 내려받았습니다. 납품 이력에 기록했습니다.");
    } catch {
      setMessage("서버에 연결하지 못했습니다.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section aria-label="출력" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-text-secondary">
        {ok ? "검증을 통과했습니다. 엑셀(수식 유지)이나 A3 가로 PDF로 내려받을 수 있습니다." : "검증을 통과해야 출력할 수 있습니다."}
      </p>
      <div className="flex gap-2">
        <button type="button" className={btnCls} disabled={!ok || busy !== ""} onClick={() => download("xlsx")}>
          {busy === "xlsx" ? "만드는 중…" : "엑셀(xlsx) 내려받기"}
        </button>
        <button type="button" className={btnCls} disabled={!ok || busy !== ""} onClick={() => download("pdf")}>
          {busy === "pdf" ? "만드는 중…" : "PDF(A3) 내려받기"}
        </button>
      </div>
      {message && (
        <p role="status" className="w-full text-[13px] text-text-secondary">{message}</p>
      )}
    </section>
  );
}

// ── 일정 템플릿 적용 (SR-SC-02·03) ────────────────────────────

function TemplateBar({
  out,
  work,
  patch,
  reference,
}: {
  out: BuildPlanOutput;
  work: WorkState;
  patch: PatchWork;
  reference: ReferenceData;
}) {
  const [workType, setWorkType] = useState<WorkType>("기계설비");
  const [message, setMessage] = useState("");

  function apply() {
    const items = reference.scheduleTemplates.find((t) => t.workType === workType)?.items ?? [];
    if (items.length === 0) {
      setMessage(`'${workType}' 일정 템플릿이 비어 있습니다. 기준정보에서 등록해 주세요.`);
      return;
    }
    const days = Number(work.general.durationDays);
    const s = applyScheduleTemplate(out.processes, items, days);
    const n = Object.keys(s).length;
    patch({ schedule: { ...work.schedule, ...s } });
    setMessage(n === 0 ? "이름이 맞는 공정이 없어 바뀐 것이 없습니다." : `공정 ${n}개의 일정을 템플릿으로 채웠습니다. 필요하면 고쳐 쓰세요.`);
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-sm bg-surface-alt p-3">
      <div>
        <label htmlFor="workType" className={labelCls}>공종 유형</label>
        <select id="workType" className={inputCls} value={workType} onChange={(e) => setWorkType(e.target.value as WorkType)}>
          {WORK_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <button type="button" className={btnGhostCls} onClick={apply}>일정 템플릿 적용</button>
      {message && <p role="status" className="text-[13px] text-text-secondary">{message}</p>}
    </div>
  );
}

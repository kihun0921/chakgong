"use client";

import { useMemo, useState } from "react";
import type { ParsedBudget } from "@/lib/budget/parse";
import {
  addProcess,
  canSplitByChildren,
  checkComposition,
  defaultComposition,
  mergeProcesses,
  moveProcess,
  removeProcess,
  renameProcess,
  splitByChildren,
  splitManual,
  type Composition,
  type Edit,
  type ManualPart,
  type ProcessDef,
} from "@/lib/work/composition";
import { NumInput } from "@/components/NumInput";
import { btnCls, btnGhostCls, inputCls, labelCls, type PatchWork, type WorkState } from "./types";

const won = (n: number) => n.toLocaleString("ko-KR");

type Props = { work: WorkState; patch: PatchWork; parsed: ParsedBudget };

// 공정 구성 편집 (SR-SC-01·04): 내역서의 어느 단위를 하나의 공정으로 볼지 정한다.
// 나누기·합치기를 해도 금액 합은 변하지 않는다. 일정·인원·장비는 아래 공정표에서 이 공정 단위로 입력한다.
export function ProcessComposer({ work, patch, parsed }: Props) {
  const comp: Composition = work.composition ?? defaultComposition(parsed);
  const isDefault = work.composition === null;
  const [picked, setPicked] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState("");
  const [newName, setNewName] = useState("");
  const [splitting, setSplitting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const check = useMemo(() => checkComposition(parsed, comp), [parsed, comp]);

  const apply = (e: Edit, okText?: string) => {
    if (!e.ok) {
      setMsg({ ok: false, text: e.error });
      return false;
    }
    patch({ composition: e.value });
    setPicked([]);
    setMsg(okText ? { ok: true, text: okText } : null);
    return true;
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section aria-label="공정 구성" className="mt-4 rounded-md border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px]">공정 구성</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            공정표의 한 줄(공정)을 어떻게 나눌지 정합니다. 처음에는 집계표 공종마다 공정 하나입니다. 내역서에 소분류 그룹이 있으면 &apos;소분류로 나누기&apos;로 쪼개고,
            작게 나뉜 그룹은 &apos;합치기&apos;로 묶고, 그룹 하나를 둘로 가르려면 &apos;직접 나누기&apos;를 쓰세요. 어떤 편집을 해도 금액 합은 집계표 순공사비와 같게 유지해야 합니다.
          </p>
        </div>
        <button type="button" className={btnGhostCls} disabled={isDefault} onClick={() => { if (window.confirm("공정 구성을 처음(집계표 공종 그대로)으로 되돌릴까요? 나누기·합치기·추가한 공정과 그 일정·직접 지정 인원이 맞지 않게 될 수 있습니다.")) { patch({ composition: null }); setPicked([]); setMsg({ ok: true, text: "처음 구성으로 되돌렸습니다." }); } }}>
          처음 구성으로
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-alt text-left">
              <th className="w-8 p-2"><span className="sr-only">합칠 공정 선택</span></th>
              <th className="p-2">공정 이름</th>
              <th className="p-2 text-right">순공사비(원)</th>
              <th className="p-2 text-right">노무비(원)</th>
              <th className="p-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {comp.map((d, i) => (
              <ProcessRow
                key={d.id}
                def={d}
                index={i}
                last={i === comp.length - 1}
                picked={picked.includes(d.id)}
                splittable={canSplitByChildren(parsed, d)}
                splitting={splitting === d.id}
                onPick={() => toggle(d.id)}
                onRename={(name) => patch({ composition: renameProcess(comp, d.id, name) })}
                onMove={(delta) => patch({ composition: moveProcess(comp, d.id, delta) })}
                onSplitChildren={() => apply(splitByChildren(parsed, comp, d.id), `'${d.name}'을 내역서 소분류로 나눴습니다.`)}
                onOpenManual={() => setSplitting(splitting === d.id ? null : d.id)}
                onRemove={() => apply(removeProcess(comp, d.id), `'${d.name}'을 지웠습니다.`)}
                manualForm={
                  splitting === d.id ? (
                    <ManualSplitForm
                      def={d}
                      onCancel={() => setSplitting(null)}
                      onSubmit={(parts) => {
                        if (apply(splitManual(comp, d.id, parts), `'${d.name}'을 ${parts.length}개로 나눴습니다.`)) setSplitting(null);
                      }}
                      onError={(text) => setMsg({ ok: false, text })}
                    />
                  ) : null
                }
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td className="p-2" colSpan={2}>합계 ({comp.length}개 공정)</td>
              <td className="p-2 text-right">{won(comp.reduce((a, d) => a + d.amount, 0))}</td>
              <td className="p-2 text-right">{won(comp.reduce((a, d) => a + d.laborCost, 0))}</td>
              <td className="p-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="merge-name" className={labelCls}>고른 공정 합치기 — 새 이름(비우면 자동)</label>
            <input id="merge-name" className={inputCls} value={mergeName} onChange={(e) => setMergeName(e.target.value)} placeholder="예: FTU 이설·신설(2~5층)" />
          </div>
          <button type="button" className={btnGhostCls} disabled={picked.length < 2} onClick={() => { if (apply(mergeProcesses(comp, picked, mergeName), `${picked.length}개 공정을 합쳤습니다.`)) setMergeName(""); }}>
            합치기 ({picked.length}개 선택)
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="add-name" className={labelCls}>공정 추가 (금액 없는 협조 공정) — 이름</label>
            <input id="add-name" className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 시운전·준공검사 및 정리" />
          </div>
          <button type="button" className={btnGhostCls} onClick={() => { if (apply(addProcess(comp, newName), `'${newName.trim()}' 공정을 추가했습니다.`)) setNewName(""); }}>
            추가
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-[13px] ${msg.ok ? "text-success" : "text-danger"}`}>{msg.ok ? "✓" : "⚠"} {msg.text}</p>}
        {!check.ok && (
          <ul role="alert" className="mt-2 list-disc pl-5 text-[13px] text-danger">
            {check.messages.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

function ProcessRow({
  def, index, last, picked, splittable, splitting, onPick, onRename, onMove, onSplitChildren, onOpenManual, onRemove, manualForm,
}: {
  def: ProcessDef; index: number; last: boolean; picked: boolean; splittable: boolean; splitting: boolean;
  onPick: () => void; onRename: (name: string) => void; onMove: (d: -1 | 1) => void;
  onSplitChildren: () => void; onOpenManual: () => void; onRemove: () => void; manualForm: React.ReactNode;
}) {
  return (
    <>
      <tr className="border-t border-border align-middle">
        <td className="p-2"><input type="checkbox" aria-label={`${def.name} 선택`} checked={picked} onChange={onPick} /></td>
        <td className="p-2">
          <input aria-label={`${index + 1}번 공정 이름`} className={inputCls} value={def.name} onChange={(e) => onRename(e.target.value)} />
          {def.manual && <span className="mt-1 block text-[11px] text-text-muted">직접 편성</span>}
        </td>
        <td className="p-2 text-right">{def.amount === 0 ? <span className="text-text-muted">협조 (0)</span> : won(def.amount)}</td>
        <td className="p-2 text-right">{won(def.laborCost)}</td>
        <td className="p-2">
          <div className="flex flex-wrap gap-1">
            <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-[12px]`} aria-label={`${def.name} 위로`} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
            <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-[12px]`} aria-label={`${def.name} 아래로`} disabled={last} onClick={() => onMove(1)}>↓</button>
            <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-[12px]`} disabled={!splittable} title={splittable ? "" : "내역서에 이 공정의 소분류 그룹이 없습니다"} onClick={onSplitChildren}>소분류로 나누기</button>
            <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-[12px]`} aria-expanded={splitting} disabled={def.amount === 0} onClick={onOpenManual}>직접 나누기</button>
            <button type="button" className="px-2 py-1 text-[12px] text-danger underline disabled:text-text-muted disabled:no-underline" disabled={def.amount !== 0} title={def.amount !== 0 ? "금액이 있는 공정은 지울 수 없습니다" : ""} onClick={onRemove}>삭제</button>
          </div>
        </td>
      </tr>
      {manualForm && <tr className="bg-surface-alt"><td colSpan={5} className="p-3">{manualForm}</td></tr>}
    </>
  );
}

function ManualSplitForm({ def, onSubmit, onCancel, onError }: { def: ProcessDef; onSubmit: (parts: ManualPart[]) => void; onCancel: () => void; onError: (t: string) => void }) {
  const [parts, setParts] = useState<{ name: string; amount: string; laborCost: string }[]>([
    { name: `${def.name} 1`, amount: String(def.amount), laborCost: String(def.laborCost) },
    { name: `${def.name} 2`, amount: "0", laborCost: "0" },
  ]);
  const num = (s: string) => (s === "" ? 0 : Number(s.replace(/[^\d-]/g, "")) || 0);
  const sumA = parts.reduce((a, p) => a + num(p.amount), 0);
  const sumL = parts.reduce((a, p) => a + num(p.laborCost), 0);
  const set = (i: number, patchPart: Partial<(typeof parts)[number]>) => setParts(parts.map((p, k) => (k === i ? { ...p, ...patchPart } : p)));
  const diffA = def.amount - sumA;
  const diffL = def.laborCost - sumL;
  return (
    <div>
      <p className="text-[13px] text-text-secondary">
        &apos;{def.name}&apos; (금액 {won(def.amount)}원, 노무비 {won(def.laborCost)}원)을 나눕니다. 금액과 노무비의 합이 원래와 같아야 합니다. 이 공정의 내역서 노무·장비는 첫 번째 부분이 이어받습니다.
      </p>
      <div className="mt-2 space-y-2">
        {parts.map((p, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_180px_180px_auto]">
            <input aria-label={`부분 ${i + 1} 이름`} className={inputCls} value={p.name} onChange={(e) => set(i, { name: e.target.value })} />
            <NumInput aria-label={`부분 ${i + 1} 금액`} className={`${inputCls} text-right`} value={p.amount} onValue={(raw) => set(i, { amount: raw })} />
            <NumInput aria-label={`부분 ${i + 1} 노무비`} className={`${inputCls} text-right`} value={p.laborCost} onValue={(raw) => set(i, { laborCost: raw })} />
            <button type="button" className="text-danger underline disabled:text-text-muted" disabled={parts.length <= 2} onClick={() => setParts(parts.filter((_, k) => k !== i))}>삭제</button>
          </div>
        ))}
      </div>
      <p className={`mt-2 text-[12.5px] ${diffA === 0 && diffL === 0 ? "text-success" : "text-warn"}`}>
        {diffA === 0 && diffL === 0 ? "✓ 금액·노무비 합이 맞습니다." : `남은 금액 ${won(diffA)}원, 남은 노무비 ${won(diffL)}원 — 0이 되게 맞춰 주세요.`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={btnGhostCls} onClick={() => setParts([...parts, { name: `${def.name} ${parts.length + 1}`, amount: "0", laborCost: "0" }])}>+ 부분 추가</button>
        <button type="button" className={btnCls} onClick={() => (diffA === 0 && diffL === 0 ? onSubmit(parts.map((p) => ({ name: p.name, amount: num(p.amount), laborCost: num(p.laborCost) }))) : onError("금액·노무비 합을 원래와 같게 맞춰 주세요."))}>나누기 적용</button>
        <button type="button" className={btnGhostCls} onClick={onCancel}>닫기</button>
      </div>
    </div>
  );
}

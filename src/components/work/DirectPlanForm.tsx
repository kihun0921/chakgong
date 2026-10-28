"use client";

import { useMemo } from "react";
import { buildDirectPlanDoc, checkDirectPlan, directTotals, requiredDirectRatio } from "@/domain/documents/direct-plan";
import { won } from "@/domain/documents/format";
import type { Block, DirectItem, DirectPlanInput } from "@/domain/documents/model";
import { toDocInput } from "@/lib/work/docInput";
import { btnGhostCls, inputCls, labelCls, type PatchWork, type WorkState } from "./types";
import { NumInput } from "@/components/NumInput";

type Props = { work: WorkState; patch: PatchWork };

const OWNER_KINDS = ["", "공공기관", "민간"] as const;
const METHODS = ["", "단독도급", "공동이행방식", "분담이행방식", "주계약자관리방식"] as const;
const NATURES = ["", "장기계속공사", "기타공사"] as const;

const newId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-text-muted">{hint}</p>}
    </div>
  );
}

// 웹 화면용 서식 미리보기. 합본 PDF와 같은 서류 명세(DocSpec)를 그린다.
function Preview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="mx-auto max-w-[640px] rounded-sm border border-border bg-white p-8 text-[12px] leading-relaxed text-black shadow-sm">
      {blocks.map((b, k) => {
        switch (b.type) {
          case "title":
            return <p key={k} className="my-3 text-center text-[18px] font-bold">{b.text}</p>;
          case "paragraph":
            return (
              <p key={k} className="my-1 whitespace-pre-wrap" style={{ textAlign: b.align ?? "left", fontWeight: b.bold ? 700 : 400 }}>{b.text}</p>
            );
          case "fields":
            return (
              <table key={k} className="my-2 w-full border-collapse">
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-y border-neutral-400">
                      <th className="w-[34%] bg-neutral-100 p-1 text-left font-semibold">{r.label}</th>
                      <td className="p-1">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case "table":
            return (
              <table key={k} className="my-2 w-full border-collapse">
                <thead>
                  <tr className="bg-neutral-100">{b.header.map((h, j) => <th key={j} className={`border border-neutral-400 p-1 ${j === 1 ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>{r.map((c, n) => <td key={n} className={`border border-neutral-400 p-1 ${n === 1 ? "text-right" : ""}`}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            );
          case "signature":
            return <div key={k} className="mt-4 text-right">{b.lines.map((l, j) => <p key={j}>{l}</p>)}</div>;
          default:
            return null;
        }
      })}
    </div>
  );
}

// 직접시공계획서 — 건설산업기본법 시행규칙 [별지 제22호의6서식] (SR-CM-09)
export function DirectPlanForm({ work, patch }: Props) {
  const d = work.direct;
  const set = (p: Partial<DirectPlanInput>) => patch({ direct: { ...d, ...p } });
  const setItem = (id: string, p: Partial<DirectItem>) => set({ items: d.items.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  const input = useMemo(() => toDocInput(work), [work]);
  const issues = useMemo(() => checkDirectPlan(input), [input]);
  const totals = useMemo(() => directTotals(d, input.contractAmount), [d, input.contractAmount]);
  const spec = useMemo(() => {
    try {
      return input.startDate === "" || input.durationDays < 1 ? null : buildDirectPlanDoc(input);
    } catch {
      return null;
    }
  }, [input]);
  const need = requiredDirectRatio(input.contractAmount);

  const importNames = () => {
    const names = (work.parsed?.summary ?? []).map((r) => r.name).filter((n) => n.trim() !== "");
    const have = new Set(d.items.map((x) => x.name));
    set({ items: [...d.items, ...names.filter((n) => !have.has(n)).map<DirectItem>((name) => ({ id: newId(), name, amount: "", kind: "sub" }))] });
  };

  const card = "mt-6 rounded-md border border-border bg-surface p-6 shadow-sm";
  const text = (id: string, key: keyof DirectPlanInput, label: string, hint?: string, numeric = false) => (
    <Field id={id} label={label} hint={hint}>
      {numeric ? (
        <NumInput id={id} className={`${inputCls} text-right`} value={d[key] as string} onValue={(raw) => set({ [key]: raw } as Partial<DirectPlanInput>)} />
      ) : (
        <input id={id} className={inputCls} value={d[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<DirectPlanInput>)} />
      )}
    </Field>
  );
  const select = <T extends string>(id: string, key: keyof DirectPlanInput, label: string, options: readonly T[]) => (
    <Field id={id} label={label}>
      <select id={id} className={inputCls} value={d[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<DirectPlanInput>)}>
        {options.map((o) => <option key={o} value={o}>{o === "" ? "선택 안 함" : o}</option>)}
      </select>
    </Field>
  );

  return (
    <div>
      <p className="mt-4 text-sm text-text-secondary">
        건설산업기본법 시행규칙 [별지 제22호의6서식] &lt;개정 2024. 10. 16.&gt;입니다. 공사명·발주자·수급인·계약일·착공일·준공예정일은 &apos;1. 일반사항&apos;의 값을 그대로 씁니다.
        세부공종을 하나라도 넣으면 합본의 목차 12번에 이 서식이 들어가고, 넣지 않으면 아래에서 올린 PDF만 들어갑니다.
      </p>

      <section aria-label="서식 입력" className={card}>
        <h2 className="text-[18px]">서식에만 쓰는 입력</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {text("dp-wt", "workType", "① 공사종류", "예: 토목")}
          {text("dp-gt", "groupType", "①-1 공종그룹종류", "예: 교통시설")}
          {text("dp-st", "subType", "①-2 세부공사종류(종합)", "예: 일반도로")}
          {select("dp-ok", "ownerKind", "발주자 구분", OWNER_KINDS)}
          {text("dp-or", "ownerRepresentative", "발주자 대표자")}
          {text("dp-oa", "ownerAddress", "발주자 주소")}
          {select("dp-cm", "contractMethod", "도급방법", METHODS)}
          {select("dp-cn", "contractNature", "계약성질", NATURES)}
          {text("dp-sw", "skilledWorkers", "기능인력 투입예정 인원(명)", undefined, true)}
          {text("dp-tl", "totalLabor", "⑤ 총 노무비(원)", "직접노무비 + 간접노무비", true)}
          {text("dp-dl", "directLabor", "(직접시공 노무비)(원)", undefined, true)}
          {text("dp-sl", "subLabor", "⑧ 하도급(예정) 총 노무비(원)", undefined, true)}
        </div>
      </section>

      <section aria-label="세부공종" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[18px]">⑥ 세부공종과 금액</h2>
          <div className="flex gap-2">
            {work.parsed && <button type="button" className={btnGhostCls} onClick={importNames}>내역서 공종 이름 불러오기</button>}
            <button type="button" className={btnGhostCls} onClick={() => set({ items: [...d.items, { id: newId(), name: "", amount: "", kind: "direct" }] })}>+ 공종 추가</button>
          </div>
        </div>
        {d.items.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">아직 세부공종이 없습니다. 추가하면 서식이 만들어집니다.</p>
        ) : (
          <table className="mt-3 w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt text-left text-[13px]"><th className="p-2">구분</th><th className="p-2">세부공종</th><th className="p-2">금액(원)</th><th className="p-2" /></tr>
            </thead>
            <tbody>
              {d.items.map((x, k) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="p-1">
                    <select aria-label={`${k + 1}번 구분`} className={inputCls} value={x.kind} onChange={(e) => setItem(x.id, { kind: e.target.value as DirectItem["kind"] })}>
                      <option value="direct">직접시공</option>
                      <option value="sub">하도급(예정)</option>
                    </select>
                  </td>
                  <td className="p-1"><input aria-label={`${k + 1}번 세부공종`} className={inputCls} value={x.name} onChange={(e) => setItem(x.id, { name: e.target.value })} /></td>
                  <td className="p-1"><NumInput aria-label={`${k + 1}번 금액`} className={`${inputCls} text-right`} value={x.amount} onValue={(raw) => setItem(x.id, { amount: raw })} /></td>
                  <td className="p-1"><button type="button" className={btnGhostCls} onClick={() => set({ items: d.items.filter((y) => y.id !== x.id) })}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {d.items.length > 0 && (
          <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-4">
            <div><dt className="text-text-secondary">⑦ 직접시공 합계</dt><dd className="font-bold">{won(totals.directAmount)}</dd></div>
            <div><dt className="text-text-secondary">하도급(예정) 합계</dt><dd className="font-bold">{won(totals.subAmount)}</dd></div>
            <div><dt className="text-text-secondary">계약금액</dt><dd className="font-bold">{won(input.contractAmount)}</dd></div>
            <div>
              <dt className="text-text-secondary">직접시공 비율{need !== null ? ` (기준 ${Math.round(need * 100)}%)` : ""}</dt>
              <dd className="font-bold">{totals.ratio === null ? "-" : `${(totals.ratio * 100).toFixed(1)}%`}</dd>
            </div>
          </dl>
        )}
        {issues.length > 0 && (
          <ul className="mt-3 space-y-1 text-[13px]" aria-label="점검 결과">
            {issues.map((x, k) => (
              <li key={k} className={x.level === "error" ? "text-danger" : "text-warn"}>{x.level === "error" ? "✕" : "⚠"} {x.text}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="서식 미리보기" className={card}>
        <h2 className="text-[18px]">서식 미리보기</h2>
        {spec ? (
          <div className="mt-4"><Preview blocks={spec.blocks} /></div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">
            {d.items.length === 0 ? "세부공종을 추가하면 서식이 나타납니다." : "일반사항의 착공일·공사기간을 입력하면 서식이 나타납니다."}
          </p>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { FOLLOW_UP_STAGES, type FollowUpStage } from "@/domain/ai/tasks";
import { btnGhostCls, inputCls } from "@/components/work/types";
import { useAiTask } from "./useAiTask";

const NOTE = "AI 제안입니다. 공사명·공정 이름·금액·일정만 보내고 개인정보는 보내지 않습니다. 확인한 뒤에만 반영됩니다.";

export function AiNote() {
  return <p className="mt-1 text-[12px] text-text-muted">{NOTE}</p>;
}

function AiError({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-2 rounded-sm bg-danger-soft p-2 text-[13px]">
      {text}
    </p>
  );
}

// ── 공정 이름 정리 제안 (SR-AI-03) ───────────────────────────

type NameItem = { id: string; name: string; amountWon: number };

export function AiNameSuggest({ items, onApply }: { items: NameItem[]; onApply: (renames: { id: string; name: string }[]) => void }) {
  const ai = useAiTask("parseAssist");
  const current = new Map(items.map((i) => [i.id, i.name]));
  return (
    <div className="mt-3">
      <button type="button" className={btnGhostCls} disabled={ai.busy || items.length === 0} onClick={() => void ai.run({ items })}>
        {ai.busy ? "제안을 받는 중…" : "공정 이름 정리 제안 (AI)"}
      </button>
      <AiNote />
      {ai.error && <AiError text={ai.error} />}
      {ai.data && (
        <div className="mt-2 rounded-sm border border-border p-3 text-[13px]">
          {ai.data.suggestions.length === 0 ? (
            <p>바꿀 이름이 없습니다.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {ai.data.suggestions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-text-secondary">{current.get(s.id)}</span>
                    <span aria-hidden>→</span>
                    <strong>{s.name}</strong>
                    <span className="text-[12px] text-text-muted">{s.reason}</span>
                    <button type="button" className={btnGhostCls} onClick={() => onApply([{ id: s.id, name: s.name }])}>적용</button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${btnGhostCls} mt-2`}
                onClick={() => {
                  onApply(ai.data!.suggestions.map((s) => ({ id: s.id, name: s.name })));
                  ai.clear();
                }}
              >
                모두 적용
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 공정 내용 문안 초안 (SR-AI-04) ───────────────────────────

type RemarkProcess = { key: string; name: string; startDay: number; endDay: number };

export function AiRemarkDraft({
  durationDays,
  processes,
  remarks,
  onApply,
}: {
  durationDays: number;
  processes: RemarkProcess[];
  remarks: Record<string, string>;
  onApply: (drafts: { key: string; text: string }[]) => void;
}) {
  const ai = useAiTask("remarkDraft");
  const nameOf = new Map(processes.map((p) => [p.key, p.name]));
  return (
    <div className="mt-3">
      <button type="button" className={btnGhostCls} disabled={ai.busy || processes.length === 0} onClick={() => void ai.run({ durationDays, processes })}>
        {ai.busy ? "초안을 받는 중…" : "주요 공정내용 문안 초안 (AI)"}
      </button>
      <AiNote />
      {ai.error && <AiError text={ai.error} />}
      {ai.data && (
        <div className="mt-2 rounded-sm border border-border p-3 text-[13px]">
          {ai.data.drafts.length === 0 ? (
            <p>제안할 문안이 없습니다.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {ai.data.drafts.map((d) => (
                  <li key={d.key} className="flex flex-wrap items-center gap-2">
                    <span className="text-text-secondary">{nameOf.get(d.key)}</span>
                    <strong>{d.text}</strong>
                    {(remarks[d.key] ?? "").trim() !== "" && <span className="text-[12px] text-text-muted">(기존 문안 있음)</span>}
                    <button type="button" className={btnGhostCls} onClick={() => onApply([d])}>이 줄 적용</button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${btnGhostCls} mt-2`}
                onClick={() => {
                  onApply(ai.data!.drafts.filter((d) => (remarks[d.key] ?? "").trim() === ""));
                  ai.clear();
                }}
              >
                빈 칸에만 모두 적용
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 검증 결과 설명 (SR-AI-05) ────────────────────────────────

export function AiValidationExplain({ issues }: { issues: { code: string; message: string }[] }) {
  const ai = useAiTask("validationExplain");
  return (
    <div className="mt-3">
      <button type="button" className={btnGhostCls} disabled={ai.busy || issues.length === 0} onClick={() => void ai.run({ issues })}>
        {ai.busy ? "설명을 받는 중…" : "쉬운 설명 보기 (AI)"}
      </button>
      <AiNote />
      {ai.error && <AiError text={ai.error} />}
      {ai.data && (
        <div className="mt-2 rounded-sm border border-border bg-surface p-3 text-[13px]">
          <p>{ai.data.summary}</p>
          <ol className="mt-2 list-decimal pl-5">
            {ai.data.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-text-muted">설명일 뿐이며 검증 판정은 바뀌지 않습니다. 위 항목을 고쳐서 통과해야 출력됩니다.</p>
        </div>
      )}
    </div>
  );
}

// ── 업체 응대 문안 (SR-AI-06) ────────────────────────────────

const STAGE_LABEL: Record<FollowUpStage, string> = {
  delivered3: "납품 후 3~5일: 제출 결과 확인",
  feedback30: "납품 후 30일: 피드백·소개 문의",
  nextBid60: "납품 후 60~90일: 다음 입찰 확인",
  referral: "소개 요청",
};

export function AiFollowUp() {
  const ai = useAiTask("followUp");
  const [stage, setStage] = useState<FollowUpStage>("delivered3");
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="aiStage" className="mb-1 block text-[13px] font-semibold text-text-secondary">업체 응대 문안 (AI)</label>
          <select id="aiStage" className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as FollowUpStage)}>
            {FOLLOW_UP_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <button type="button" className={btnGhostCls} disabled={ai.busy} onClick={() => { setCopied(false); void ai.run({ stage }); }}>
          {ai.busy ? "문안을 받는 중…" : "문안 초안 만들기"}
        </button>
      </div>
      <p className="mt-1 text-[12px] text-text-muted">단계 정보만 보내며 업체명·연락처는 보내지 않습니다. 초안을 고쳐서 직접 보내세요.</p>
      {ai.error && <AiError text={ai.error} />}
      {ai.data && (
        <div className="mt-2">
          <textarea aria-label="응대 문안 초안" className={inputCls} rows={6} defaultValue={ai.data.body} />
          <button
            type="button"
            className={`${btnGhostCls} mt-2`}
            onClick={(e) => {
              const text = (e.currentTarget.previousElementSibling as HTMLTextAreaElement).value;
              void navigator.clipboard?.writeText(text).then(() => setCopied(true));
            }}
          >
            {copied ? "복사했습니다" : "복사"}
          </button>
        </div>
      )}
    </div>
  );
}

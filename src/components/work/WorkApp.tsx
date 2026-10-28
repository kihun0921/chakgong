"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAPTERS, type Chapter } from "@/lib/chapters";
import type { ReferenceData } from "@/lib/reference/types";
import { BetaPanel } from "@/components/BetaPanel";
import { FeePanel } from "@/components/FeePanel";
import { DirectPlanForm } from "./DirectPlanForm";
import { GeneralChapter } from "./GeneralChapter";
import { LaborAgreementForm } from "./LaborAgreementForm";
import { PackageBar } from "./PackageBar";
import { PlaceholderDoc } from "./PlaceholderDoc";
import { ScheduleChapter } from "./ScheduleChapter";
import { Tabs } from "./Tabs";
import { UploadDoc } from "./UploadDoc";
import { type PatchWork, type WorkState } from "./types";

type SaveState = "saved" | "dirty" | "saving" | "error";
const SAVE_TEXT: Record<SaveState, string> = {
  saved: "저장됨",
  dirty: "저장 대기 중…",
  saving: "저장하는 중…",
  error: "저장하지 못했습니다. 다시 저장해 주세요.",
};

type Props = { projectId: string; projectName: string; initial: WorkState; reference: ReferenceData };

// 착공계 작성 화면: 챕터 4개(탭) 안에 제출서류 목차 15종을 문서별 탭으로 나눈다.
// 입력은 잠시 멈추면 자동 저장하고(SR-DM-06), 합본·출력 직전에도 저장한다.
export function WorkApp({ projectId, projectName, initial, reference }: Props) {
  const [work, setWork] = useState<WorkState>(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const latest = useRef(work);
  const dirty = useRef(false);
  const inflight = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    // 저장 중이면 끝나길 기다린 뒤 최신 입력으로 한 번 더 저장한다
    while (inflight.current) await inflight.current.catch(() => false);
    if (!dirty.current) return true;
    const sent = latest.current;
    dirty.current = false;
    setSaveState("saving");
    const run = (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: sent, name: sent.general.projectName || undefined }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const saved = (await res.json()) as { data: WorkState };
        // 서버가 돌려준 마스킹 주민번호로 바꾼다(그 사이 고쳐 쓴 칸은 건드리지 않는다)
        const sentRrn = new Map(sent.engineers.map((e) => [e.id, e.rrn]));
        const masked = new Map(saved.data.engineers.map((e) => [e.id, e.rrn]));
        setWork((w) => {
          const next = { ...w, engineers: w.engineers.map((e) => (e.rrn === sentRrn.get(e.id) && masked.has(e.id) ? { ...e, rrn: masked.get(e.id)! } : e)) };
          latest.current = next;
          return next;
        });
        setSaveState(dirty.current ? "dirty" : "saved");
        return true;
      } catch {
        dirty.current = true;
        setSaveState("error");
        return false;
      }
    })();
    inflight.current = run;
    const ok = await run;
    inflight.current = null;
    // 저장하는 사이 더 입력했다면 자동 저장이 이어서 처리한다
    return ok;
  }, [projectId]);

  const patch: PatchWork = (p) => {
    setWork((w) => {
      const next = { ...w, ...p };
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setSaveState("dirty");
  };

  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [saveState, work, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const [chapterKey, setChapterKey] = useState<Chapter["key"]>("general");
  const [docKeys, setDocKeys] = useState<Record<string, string>>({});

  const chapter = CHAPTERS.find((c) => c.key === chapterKey) ?? CHAPTERS[0];
  const docKey = docKeys[chapter.key] ?? chapter.docs[0].key;
  const setDoc = (key: string) => setDocKeys((d) => ({ ...d, [chapter.key]: key }));
  const otherDoc = chapter.docs.find((d) => d.key === docKey) ?? chapter.docs[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px]">{work.general.projectName || projectName}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            챕터 4개 안에서 제출서류 목차의 문서를 하나씩 작성합니다. 입력은 잠시 멈추면 자동으로 저장됩니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span role="status" className={`text-[13px] ${saveState === "error" ? "text-danger" : "text-text-secondary"}`}>
            {SAVE_TEXT[saveState]}
          </span>
          <button type="button" className="rounded-sm border border-border px-3 py-2 text-sm font-semibold" onClick={() => void save()}>
            지금 저장
          </button>
        </div>
      </div>

      <FeePanel projectId={projectId} />
      <BetaPanel projectId={projectId} />

      <PackageBar work={work} projectId={projectId} onSave={save} />

      <div className="mt-6">
        <Tabs
          variant="chapter"
          ariaLabel="착공계 챕터"
          active={chapter.key}
          onChange={(k) => setChapterKey(k as Chapter["key"])}
          items={CHAPTERS.map((c) => ({ key: c.key, label: c.label }))}
        />
      </div>

      <div role="tabpanel" aria-label={chapter.label}>
        {chapter.key === "general" && (
          <GeneralChapter work={work} patch={patch} docKey={docKey} onDocChange={setDoc} projectId={projectId} />
        )}
        {chapter.key === "direct" && (
          <>
            <DirectPlanForm work={work} patch={patch} />
            <UploadDoc
              projectId={projectId}
              work={work}
              patch={patch}
              title="직접시공계획서 첨부(PDF)"
              tocChoices={[12]}
              note="서식 외에 따로 작성된 계획서나 첨부 서류가 있으면 PDF로 올립니다. 서식 뒤에 이어서 합본됩니다."
            />
          </>
        )}
        {chapter.key === "schedule" && (
          <ScheduleChapter work={work} patch={patch} docKey={docKey} onDocChange={setDoc} projectId={projectId} onSave={save} reference={reference} />
        )}
        {chapter.key === "other" && (
          <div>
            <Tabs
              variant="doc"
              ariaLabel="기타서류 문서"
              active={otherDoc.key}
              onChange={setDoc}
              items={chapter.docs.map((d) => ({ key: d.key, label: d.label, hint: d.ready ? undefined : "준비 중" }))}
            />
            {!otherDoc.ready && <PlaceholderDoc doc={otherDoc} />}
            {otherDoc.key === "contract" && <UploadDoc projectId={projectId} work={work} patch={patch} title="공사 도급계약서 사본" tocChoices={[5]} />}
            {otherDoc.key === "budget" && <UploadDoc projectId={projectId} work={work} patch={patch} title="공사 도급내역서" tocChoices={[6]} note="내역서를 출력한 PDF를 올립니다. 내역서 연동 출력은 이후에 만듭니다." />}
            {otherDoc.key === "laborAgreement" && (
              <>
                <LaborAgreementForm work={work} patch={patch} />
                <UploadDoc projectId={projectId} work={work} patch={patch} title="노무비 전용 통장사본·국가계약 합의서 등 첨부(PDF)" tocChoices={[7]} note="통장사본은 합의서 뒤에 이어서 합본됩니다. 국가계약처럼 합의서를 만들지 못하는 경우 작성본을 여기에 올리면 합본에 들어갑니다." />
              </>
            )}
            {otherDoc.key === "pledges" && (
              <>
                <section aria-label="확약서 안내" className="mt-6 rounded-md border border-border bg-surface p-6 shadow-sm">
                  <h2 className="text-[18px]">확약서 3종은 자동으로 만들어집니다</h2>
                  <p className="mt-2 text-[13px] text-text-secondary">
                    하도급대금 직불조건부 입찰참가 확약서, 하도급지킴이 이용 확약서, 공공건설 일자리알리미 이용 확약서의 문안은 실제 제출본 그대로입니다. 서약자는 1장에 입력한 시공사와 공동수급체 구성원사 전체이고, 수신처는 1장의 수신처입니다.
                  </p>
                </section>
                <UploadDoc projectId={projectId} work={work} patch={patch} title="추가 확약서·서약서(PDF)" tocChoices={[2, 13]} note="자동으로 만든 확약서 외에 발주기관이 따로 요구한 서약서가 있으면 올립니다." />
              </>
            )}
            {otherDoc.key === "insurance" && <UploadDoc projectId={projectId} work={work} patch={patch} title="고용·산재보험 가입증명원" tocChoices={[11]} />}
            {otherDoc.key === "plans" && (
              <UploadDoc
                projectId={projectId}
                work={work}
                patch={patch}
                title="품질·안전·환경관리계획서"
                tocChoices={[14, 3, 8]}
                note="계획서 본문은 만들지 않습니다. 작성한 PDF를 올리면 간지 뒤에 끼워 넣습니다."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

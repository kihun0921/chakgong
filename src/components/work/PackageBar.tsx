"use client";

import { useMemo, useState } from "react";
import { generateDocs, type Mismatch } from "@/domain/documents/build";
import { toDocInput } from "@/lib/work/docInput";
import { btnCls, type WorkState } from "./types";

const FACT_LABEL: Record<string, string> = {
  projectName: "공사명",
  contractAmount: "계약금액",
  startDate: "착공일",
  completionDate: "준공일",
  contractAgency: "계약기관",
  demandAgency: "수요기관",
  companyName: "시공사 상호",
  representative: "대표자",
};

const label = (fact: string) => FACT_LABEL[fact] ?? (fact.startsWith("engineer:") ? "기술인 이름" : fact);

type ServerIssue =
  | { reason: "missing"; missing: string[] }
  | { reason: "mismatch"; mismatches: Mismatch[] }
  | { reason: "badFiles"; bad: { title: string; reason: string }[] }
  | { reason?: undefined; error?: string };

type Props = { work: WorkState; projectId: string; onSave: () => Promise<boolean> };

// 착공계 합본 만들기 점검 줄. 필수값·서류 간 일치는 브라우저에서 바로 점검하고, PDF는 서버가 저장된 공사로 만든다.
export function PackageBar({ work, projectId, onSave }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string[] } | null>(null);

  const input = useMemo(() => toDocInput(work), [work]);
  const gen = useMemo(() => generateDocs(input), [input]);

  async function make() {
    setBusy(true);
    setMessage(null);
    try {
      // 서버는 저장된 공사로 만들므로 먼저 저장한다
      if (!(await onSave())) {
        setMessage({ kind: "error", text: ["저장하지 못해 합본을 만들 수 없습니다. 잠시 후 다시 시도해 주세요."] });
        return;
      }
      const res = await fetch(`/api/projects/${projectId}/package`, { method: "POST" });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = "착공계_합본.pdf";
        a.click();
        URL.revokeObjectURL(url);
        const notices: string[] = JSON.parse(decodeURIComponent(res.headers.get("X-Notices") ?? "[]"));
        setMessage({
          kind: "ok",
          text: [`합본 PDF를 만들었습니다 (${res.headers.get("X-Total-Pages")}쪽). 납품 이력과 개인정보 출력 이력에 기록했습니다.`, ...notices],
        });
      } else {
        const body = (await res.json()) as ServerIssue;
        if (body.reason === "badFiles") {
          setMessage({ kind: "error", text: body.bad.map((b) => `'${b.title}': ${b.reason} 해당 파일을 지우거나 다시 올려 주세요.`) });
        } else if (body.reason === "missing") {
          setMessage({ kind: "error", text: [`입력을 확인해 주세요: ${body.missing.join(", ")}`] });
        } else if (body.reason === "mismatch") {
          setMessage({ kind: "error", text: body.mismatches.map((m) => `${label(m.fact)}가 서류마다 다릅니다.`) });
        } else {
          setMessage({ kind: "error", text: [body.error ?? "합본을 만들지 못했습니다."] });
        }
      }
    } catch {
      setMessage({ kind: "error", text: ["서버에 연결하지 못했습니다."] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="착공계 합본" className="mt-6 rounded-md border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {!gen.ok ? (
            <p role="status">
              <strong className="text-warn">⚠ 합본 준비 중</strong> — 아직 입력이 필요한 항목: {gen.missing.join(", ")}
            </p>
          ) : gen.mismatches.length > 0 ? (
            <p role="alert">
              <strong className="text-danger">⚠ 서류 간 불일치</strong> —{" "}
              {gen.mismatches.map((m) => `${label(m.fact)}(${m.values.map((v) => v.docTitle).join(" ≠ ")})`).join(", ")}
            </p>
          ) : (
            <p role="status">
              <strong className="text-success">✓ 합본 준비됨</strong> — 필수 입력이 모두 있고 서류 {gen.specs.length}종의 값이 서로 일치합니다.
            </p>
          )}
        </div>
        <button type="button" className={btnCls} disabled={busy || !gen.ok || gen.mismatches.length > 0} onClick={make}>
          {busy ? "만드는 중…" : "합본 PDF 만들기"}
        </button>
      </div>
      {message && (
        <ul
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-3 list-disc rounded-sm p-3 pl-7 text-[13px] ${message.kind === "error" ? "bg-danger-soft text-text" : "bg-success-soft text-text"}`}
        >
          {message.text.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

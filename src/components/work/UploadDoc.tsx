"use client";

import { useState } from "react";
import { TOC_ITEMS } from "@/domain/documents/model";
import { btnGhostCls, inputCls, labelCls, type PatchWork, type WorkState } from "./types";

const MAX_BYTES = 100 * 1024 * 1024;

type Props = {
  work: WorkState;
  patch: PatchWork;
  projectId: string;
  title: string;
  /** 이 탭에서 올릴 수 있는 목차 번호들 */
  tocChoices: number[];
  note?: string;
};

// 업로드 첨부(PDF) 탭 (SRS SR-CM-09): 업체에서 받은 서류를 서버에 암호화해 저장하고, 합본의 목차 위치에 끼워 넣는다.
export function UploadDoc({ work, patch, projectId, title, tocChoices, note }: Props) {
  const [toc, setToc] = useState(tocChoices[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = work.uploads.filter((u) => tocChoices.includes(u.toc));

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    setError("");
    setBusy(true);
    const added = [];
    for (const f of picked) {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        setError(`'${f.name}'은 PDF가 아닙니다. PDF 파일만 올릴 수 있습니다.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`'${f.name}'이 100MB를 넘습니다.`);
        continue;
      }
      const form = new FormData();
      form.set("file", f);
      form.set("kind", "upload");
      form.set("toc", String(toc));
      try {
        const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) setError(body.error ?? "올리지 못했습니다.");
        else added.push(body.upload);
      } catch {
        setError("서버에 연결하지 못했습니다.");
      }
    }
    if (added.length > 0) patch({ uploads: [...work.uploads, ...added] });
    setBusy(false);
  }

  async function remove(id: string) {
    setError("");
    const res = await fetch(`/api/projects/${projectId}/files/${id}`, { method: "DELETE" });
    if (res.ok) patch({ uploads: work.uploads.filter((x) => x.id !== id) });
    else setError("삭제하지 못했습니다.");
  }

  return (
    <section aria-label={title} className="mt-6 rounded-md border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-[18px]">{title}</h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        {note ?? "업체에서 받은 PDF를 올리면 합본의 해당 목차 위치에 간지 뒤로 들어갑니다. 파일은 암호화되어 서버에 저장됩니다."}
      </p>

      <div className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        {tocChoices.length > 1 && (
          <div>
            <label htmlFor={`toc-${title}`} className={labelCls}>끼워 넣을 목차</label>
            <select id={`toc-${title}`} className={inputCls} value={toc} onChange={(e) => setToc(Number(e.target.value))}>
              {tocChoices.map((n) => (
                <option key={n} value={n}>목차 {n} — {TOC_ITEMS[n]}</option>
              ))}
            </select>
          </div>
        )}
        <label className={`${btnGhostCls} cursor-pointer text-center ${busy ? "opacity-50" : ""}`}>
          {busy ? "올리는 중…" : "PDF 선택(여러 개 가능)"}
          <input type="file" accept=".pdf,application/pdf" multiple disabled={busy} className="sr-only" onChange={onFiles} aria-label={`${title} PDF 선택`} />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">⚠ {error}</p>
      )}

      {mine.length === 0 ? (
        <p className="mt-4 text-[13px] text-text-muted">올린 파일이 없습니다. 파일이 없으면 합본에는 간지만 들어갑니다.</p>
      ) : (
        <ul className="mt-4 space-y-1 text-[13px]">
          {mine.map((u) => (
            <li key={u.id} className="flex items-center justify-between rounded-sm bg-surface-alt px-3 py-2">
              <span>
                목차 {u.toc} · {u.name} ({(u.size / 1024 / 1024).toFixed(1)}MB)
              </span>
              <button type="button" className="text-danger underline" onClick={() => remove(u.id)}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectSummary } from "@/lib/ports/projects";
import { btnCls, btnGhostCls, inputCls } from "@/components/work/types";
import { formatKst } from "@/lib/format-time";

const fmt = formatKst;

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function create() {
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return setError("공사를 만들지 못했습니다.");
    router.push(`/work/${((await res.json()) as { id: string }).id}`);
  }

  async function duplicate(id: string) {
    setError("");
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    if (!res.ok) return setError("복제하지 못했습니다.");
    router.push(`/work/${((await res.json()) as { id: string }).id}`);
  }

  return (
    <div>
      <h1 className="text-[26px]">공사 목록</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <label htmlFor="newName" className="text-[13px] font-semibold">새 공사 이름</label>
          <input id="newName" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: ○○초등학교 기계설비공사" />
        </div>
        <button type="button" className={btnCls} onClick={create}>공사 만들기</button>
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">⚠ {error}</p>}

      {projects.length === 0 ? (
        <p className="mt-8 text-sm text-text-muted">아직 만든 공사가 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
              <div>
                <Link href={`/work/${p.id}`} className="text-[15px] font-bold underline">{p.name}</Link>
                <p className="mt-1 text-[12px] text-text-secondary">마지막 저장 {fmt(p.updatedAt)} · {p.updatedBy}</p>
              </div>
              <button type="button" className={btnGhostCls} onClick={() => duplicate(p.id)}>복제</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

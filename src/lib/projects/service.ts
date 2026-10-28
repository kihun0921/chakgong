// 공사 저장·복제·보존 (SRS SR-DM-01·05·06, SR-NF-13·15·17, SR-PL-04)
// 모든 관리자는 모든 공사를 조회·수정한다(소유자 구분 없음, D-12). 화면에는 주민등록번호를 마스킹해서만 내려보낸다.

import { maskRrn } from "@/domain/documents/format";
import type { AuditLog } from "@/lib/ports/audit";
import type { FileStore, ProjectStore, StoredProject } from "@/lib/ports/projects";
import { diffAssumptions } from "./assumptions";
import { INITIAL_WORK, type WorkState } from "./types";

export type ProjectDeps = { projects: ProjectStore; files: FileStore; audit: AuditLog };

const isMasked = (rrn: string) => rrn.includes("*");

/** 화면(클라이언트)으로 보낼 공사: 주민등록번호는 앞 6자리만 보이게 마스킹한다 (SR-NF-15). */
export function toClient(p: StoredProject): StoredProject {
  return {
    ...p,
    data: { ...p.data, engineers: p.data.engineers.map((e) => ({ ...e, rrn: maskRrn(e.rrn) })) },
  };
}

export async function createProject(deps: ProjectDeps, name: string, by: string): Promise<StoredProject> {
  const p = await deps.projects.create(name.trim() || "새 공사", by, INITIAL_WORK);
  await deps.audit.record({ user: by, action: "project.create", target: p.id });
  return toClient(p);
}

export async function saveProject(
  deps: ProjectDeps,
  id: string,
  incoming: WorkState,
  by: string,
  name?: string,
): Promise<StoredProject> {
  const prev = await deps.projects.get(id);
  if (!prev) throw new Error("공사를 찾을 수 없습니다.");

  const prevRrn = new Map(prev.data.engineers.map((e) => [e.id, e.rrn]));
  const next: WorkState = {
    ...INITIAL_WORK,
    ...incoming,
    // 마스킹된 값이 오면 저장된 원래 값을 유지한다. 새로 입력한 전체 값은 그대로 받는다.
    engineers: incoming.engineers.map((e) => ({ ...e, rrn: isMasked(e.rrn) ? (prevRrn.get(e.id) ?? "") : e.rrn })),
    // 업로드 파일 목록과 내역서 원본은 파일 API로만 바뀐다(화면이 남의 파일을 가리키지 못하게)
    uploads: prev.data.uploads,
    budgetOriginal: prev.data.budgetOriginal,
  };

  const changes = diffAssumptions(prev.data, next);
  const saved = await deps.projects.save(id, next, by, name);
  for (const c of changes) {
    await deps.audit.record({ user: by, action: "assumption.change", target: id, detail: { ...c } });
  }
  await deps.audit.record({ user: by, action: "project.save", target: id, detail: { changed: changes.length } });
  return toClient(saved);
}

/** 공사 복제 (SR-DM-01, AC-F8-2): 입력·가정값·결과와 파일을 이어받는 새 공사. 원본은 바뀌지 않는다. */
export async function duplicateProject(deps: ProjectDeps, id: string, by: string): Promise<StoredProject> {
  const src = await deps.projects.get(id);
  if (!src) throw new Error("공사를 찾을 수 없습니다.");
  const created = await deps.projects.create(`${src.name} (복사)`, by, { ...src.data, uploads: [], budgetOriginal: null });

  const uploads = [];
  for (const u of src.data.uploads) {
    const bytes = await deps.files.get(id, u.id);
    if (!bytes) continue;
    const newId = crypto.randomUUID();
    await deps.files.put(created.id, newId, bytes);
    uploads.push({ ...u, id: newId });
  }
  let budgetOriginal = null;
  if (src.data.budgetOriginal) {
    const bytes = await deps.files.get(id, src.data.budgetOriginal.fileId);
    if (bytes) {
      const newId = crypto.randomUUID();
      await deps.files.put(created.id, newId, bytes);
      budgetOriginal = { ...src.data.budgetOriginal, fileId: newId };
    }
  }
  const saved = await deps.projects.save(created.id, { ...created.data, uploads, budgetOriginal }, by);
  await deps.audit.record({ user: by, action: "project.duplicate", target: created.id, detail: { from: id } });
  return toClient(saved);
}

/** 공사 종료 후 보존 기간(기본 5년)이 지난 공사를 파일과 함께 삭제한다 (SR-NF-17). 삭제한 공사 id를 돌려준다. */
export async function purgeExpired(deps: ProjectDeps, now: Date, years = 5, by = "system"): Promise<string[]> {
  const removed: string[] = [];
  for (const s of await deps.projects.list()) {
    if (!s.closedAt) continue;
    const limit = new Date(s.closedAt);
    limit.setUTCFullYear(limit.getUTCFullYear() + years);
    if (limit.getTime() > now.getTime()) continue;
    await deps.files.removeProject(s.id);
    await deps.projects.remove(s.id);
    await deps.audit.record({ user: by, action: "project.purge", target: s.id, detail: { closedAt: s.closedAt } });
    removed.push(s.id);
  }
  return removed;
}

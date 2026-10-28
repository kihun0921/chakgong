// 저장된 공사로 서류를 만들 때 쓰는 입력 모으기 (서버 전용).
// 화면이 보낸 값이 아니라 저장소의 값(복호화된 주민등록번호, 암호화 저장된 첨부)을 쓴다. 출력 때만 전체 값이 나간다 (SR-NF-15).

import type { DocInput } from "@/domain/documents/model";
import type { FileStore, ProjectStore } from "@/lib/ports/projects";
import type { Upload } from "@/lib/pdf/package";
import { toDocInput, toPlanInput } from "@/lib/work/docInput";
import type { BuildPlanInput } from "@/lib/work/buildPlan";

export type GenerationInput =
  | { ok: true; doc: DocInput; plan: BuildPlanInput; uploads: Upload[]; engineerCount: number }
  | { ok: false; reason: "notFound" | "missingFile"; names?: string[] };

export async function loadForGeneration(
  stores: { projects: ProjectStore; files: FileStore },
  projectId: string,
): Promise<GenerationInput> {
  const project = await stores.projects.get(projectId);
  if (!project) return { ok: false, reason: "notFound" };

  const uploads: Upload[] = [];
  const missing: string[] = [];
  for (const u of project.data.uploads) {
    const bytes = await stores.files.get(projectId, u.id);
    if (bytes) uploads.push({ toc: u.toc, name: u.name, bytes });
    else missing.push(u.name);
  }
  if (missing.length > 0) return { ok: false, reason: "missingFile", names: missing };

  return {
    ok: true,
    doc: toDocInput(project.data),
    plan: toPlanInput(project.data),
    uploads,
    engineerCount: project.data.engineers.length,
  };
}

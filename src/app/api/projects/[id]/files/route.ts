// 공사 파일 올리기 (SRS SR-CM-09, SR-DM-05, SR-NF-13·19)
// kind=upload: 업체에서 받은 PDF를 목차 위치(toc)에 첨부 / kind=budget: 내역서 원본(수정 없이 보관).
// 파일은 암호화해서 저장한다. 공사 1건의 파일 합계는 500MB 이하다.

import { markDraftStart } from "@/lib/monitor/kpi";
import { requireAdmin } from "@/lib/auth/guard";
import { getAuditLog, getFileStore, getProjectStore } from "@/lib/ports";
import { ID_PATTERN } from "@/lib/projects/validate";

const MAX_PDF = 100 * 1024 * 1024;
const MAX_XLSX = 20 * 1024 * 1024;
const MAX_PROJECT = 500 * 1024 * 1024;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });

  const projects = getProjectStore();
  const project = await projects.get(id);
  if (!project) return Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File)) return Response.json({ error: "파일이 없습니다." }, { status: 400 });

  const used =
    project.data.uploads.reduce((s, u) => s + u.size, 0) + (project.data.budgetOriginal?.size ?? 0);
  if (used + file.size > MAX_PROJECT) {
    return Response.json({ error: "공사 1건의 파일 합계가 500MB를 넘습니다. 사진은 압축해서 올려 주세요." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = getFileStore();
  const fileId = crypto.randomUUID();

  if (kind === "budget") {
    const lower = file.name.toLowerCase();
    if (!(lower.endsWith(".xlsx") || lower.endsWith(".xls")) || file.size > MAX_XLSX) {
      return Response.json({ error: "내역서는 20MB 이하의 엑셀 파일(.xlsx, .xls)이어야 합니다." }, { status: 400 });
    }
    await files.put(id, fileId, bytes);
    const old = project.data.budgetOriginal;
    const budgetOriginal = { fileId, name: file.name, size: file.size };
    await projects.save(id, { ...project.data, budgetOriginal }, admin.user);
    if (old) await files.remove(id, old.fileId);
    await getAuditLog().record({ user: admin.user, action: "project.save", target: id, detail: { budgetOriginal: file.name } });
    await markDraftStart(getAuditLog(), id, admin.user);
    return Response.json({ budgetOriginal }, { status: 201 });
  }

  const toc = Number(form.get("toc"));
  if (!Number.isInteger(toc) || toc < 1 || toc > 15) {
    return Response.json({ error: "목차 번호(1~15)가 올바르지 않습니다." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf") || file.size > MAX_PDF) {
    return Response.json({ error: "PDF 파일(100MB 이하)만 올릴 수 있습니다." }, { status: 400 });
  }
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!isPdf) return Response.json({ error: `'${file.name}'은 PDF 파일이 아닙니다.` }, { status: 400 });

  await files.put(id, fileId, bytes);
  const upload = { id: fileId, toc, name: file.name, size: file.size };
  await projects.save(id, { ...project.data, uploads: [...project.data.uploads, upload] }, admin.user);
  await getAuditLog().record({ user: admin.user, action: "project.save", target: id, detail: { upload: file.name, toc } });
  return Response.json({ upload }, { status: 201 });
}

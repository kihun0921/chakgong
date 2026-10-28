import { requireAdmin } from "@/lib/auth/guard";
import { getAuditLog, getFileStore, getProjectStore } from "@/lib/ports";
import { ID_PATTERN } from "@/lib/projects/validate";

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id, fileId } = await ctx.params;
  if (!ID_PATTERN.test(id) || !ID_PATTERN.test(fileId)) {
    return Response.json({ error: "식별자가 올바르지 않습니다." }, { status: 400 });
  }
  const projects = getProjectStore();
  const project = await projects.get(id);
  if (!project) return Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 });

  const inUploads = project.data.uploads.some((u) => u.id === fileId);
  const isBudget = project.data.budgetOriginal?.fileId === fileId;
  if (!inUploads && !isBudget) return Response.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });

  await getFileStore().remove(id, fileId);
  await projects.save(
    id,
    {
      ...project.data,
      uploads: project.data.uploads.filter((u) => u.id !== fileId),
      budgetOriginal: isBudget ? null : project.data.budgetOriginal,
    },
    admin.user,
  );
  await getAuditLog().record({ user: admin.user, action: "project.save", target: id, detail: { removedFile: fileId } });
  return Response.json({ ok: true });
}

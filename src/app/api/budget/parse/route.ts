// 내역서(xlsx) 업로드 → 파싱 (SRS SR-IN-03~06, 08)
// 열을 자동 인식하지 못하면 422와 함께 이유·시트 목록을 돌려주고, 클라이언트가 mapping을 지정해 다시 보낸다.

import { requireAdmin } from "@/lib/auth/guard";
import {
  BudgetFileError,
  checkUpload,
  detectLayout,
  loadWorkbook,
  parseBudget,
  type LayoutMapping,
} from "@/lib/budget/parse";
import { getAuditLog } from "@/lib/ports";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  const check = checkUpload({ name: file.name, size: file.size });
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

  let mapping: LayoutMapping | null = null;
  const rawMapping = form.get("mapping");
  if (typeof rawMapping === "string" && rawMapping !== "") {
    try {
      mapping = JSON.parse(rawMapping) as LayoutMapping;
    } catch {
      return Response.json({ error: "열 매핑 형식이 올바르지 않습니다." }, { status: 400 });
    }
  }

  try {
    const wb = await loadWorkbook(new Uint8Array(await file.arrayBuffer()));
    let used = mapping;
    if (!used) {
      const layout = detectLayout(wb);
      if (!layout.ok) {
        await getAuditLog().record({ user: admin.user, action: "budget.parse", detail: { outcome: "needsMapping" } });
        return Response.json(
          { needsMapping: true, reason: layout.reason, sheetNames: layout.sheetNames },
          { status: 422 },
        );
      }
      used = layout.mapping;
    }
    const parsed = parseBudget(wb, used);
    await getAuditLog().record({ user: admin.user, action: "budget.parse", detail: { outcome: mapping ? "mapped" : "auto" } });
    return Response.json({ parsed, mapping: used });
  } catch (e) {
    if (e instanceof BudgetFileError) {
      await getAuditLog().record({ user: admin.user, action: "budget.parse", detail: { outcome: "error" } });
      return Response.json({ error: e.message }, { status: 400 });
    }
    return Response.json({ error: "내역서를 읽는 중 오류가 났습니다." }, { status: 500 });
  }
}

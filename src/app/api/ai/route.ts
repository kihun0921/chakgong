// AI 보조 요청 (SRS SR-AI-01~05): 관리자만. POST { task, input } → 제안(검사한 JSON).
// 제안일 뿐이며 계산·검증 판정·출력에는 쓰이지 않는다. 반영은 관리자가 화면에서 확인한 뒤에 한다.

import { requireAdmin } from "@/lib/auth/guard";
import { runAiTask, type AiFailCode } from "@/lib/ai/service";
import { getAiModel, getAuditLog } from "@/lib/ports";

const STATUS: Record<AiFailCode, number> = { invalid: 400, disabled: 503, failed: 502, "bad-output": 502 };

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  let body: { task?: unknown; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof body.task !== "string") return Response.json({ error: "AI 기능을 지정해 주세요." }, { status: 400 });

  const r = await runAiTask({ model: getAiModel(), audit: getAuditLog() }, body.task, body.input, admin.user);
  if (!r.ok) return Response.json({ error: r.message, code: r.code }, { status: STATUS[r.code] });
  return Response.json({ task: r.task, data: r.data });
}

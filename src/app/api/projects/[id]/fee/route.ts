// 용역비 내역 조회·기록 (SRS SR-FEE-03~07·10): 관리자만.
// POST { action: "payment" | "taxInvoice" | "cancel" | "refund", ... } — 맞지 않으면 상태를 바꾸지 않고 이유를 돌려준다.

import { refundAlert } from "@/domain/fee-ledger";
import { requireAdmin } from "@/lib/auth/guard";
import { cancelFor, getFee, recordPaymentFor, recordTaxInvoiceFor, refundFor, todayKst, type FeeActionResult } from "@/lib/fees/service";
import { getDeliveryLog, getFeeDeps, getProjectStore } from "@/lib/ports";
import { ID_PATTERN } from "@/lib/projects/validate";

type Ctx = { params: Promise<{ id: string }> };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function view(id: string, user: string) {
  const fee = await getFee(getFeeDeps(), id, user);
  return { fee, delivered: await getDeliveryLog().hasDelivered(id), alert: refundAlert(fee, todayKst()) };
}

export async function GET(request: Request, ctx: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });
  if (!(await getProjectStore().get(id))) return Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(await view(id, admin.user));
}

export async function POST(request: Request, ctx: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "공사 식별자가 올바르지 않습니다." }, { status: 400 });
  if (!(await getProjectStore().get(id))) return Response.json({ error: "공사를 찾을 수 없습니다." }, { status: 404 });

  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
  const deps = getFeeDeps();
  let r: FeeActionResult;
  switch (b.action) {
    case "payment": {
      const date = str(b.date);
      if (date !== "" && !DATE.test(date)) return Response.json({ error: "입금일 형식이 올바르지 않습니다." }, { status: 400 });
      const amount = typeof b.amount === "number" ? b.amount : Number.NaN;
      r = await recordPaymentFor(deps, id, { date, payer: str(b.payer), amount: Number.isFinite(amount) ? amount : 0 }, admin.user);
      break;
    }
    case "taxInvoice": {
      const date = str(b.date);
      if (date !== "" && !DATE.test(date)) return Response.json({ error: "발행일 형식이 올바르지 않습니다." }, { status: 400 });
      r = await recordTaxInvoiceFor(deps, id, { issued: b.issued === true, date: date === "" ? null : date }, admin.user);
      break;
    }
    case "cancel":
      r = await cancelFor(deps, id, admin.user);
      break;
    case "refund": {
      const date = str(b.date);
      if (!DATE.test(date)) return Response.json({ error: "환불일을 입력해 주세요." }, { status: 400 });
      r = await refundFor(deps, id, date, admin.user);
      break;
    }
    default:
      return Response.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
  }
  const v = await view(id, admin.user);
  return Response.json({ ok: r.ok, message: r.message, ...v }, { status: r.ok ? 200 : 422 });
}

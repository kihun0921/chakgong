// 이력(감사) 저장소 (SRS SR-NF-16, SR-PL-03, SR-DM-06, SR-FEE-12)
// 로그인, 접근 거부, 가정값 변경, 서류 출력, 개인정보 출력, 용역비 변경을 사용자·시각과 함께 남긴다.
// 이력을 쓰지 못하면 해당 동작도 실패시킨다(D-4): 호출하는 쪽은 await하고 오류를 삼키지 않는다.
// 이력에는 비밀번호·주민등록번호·계좌번호 같은 원문을 넣지 않는다.

export type AuditAction =
  | "login.success"
  | "login.fail"
  | "login.locked"
  | "logout"
  | "access.denied"
  | "assumption.change"
  | "pii.export"
  | "project.create"
  | "project.save"
  | "project.duplicate"
  | "project.purge"
  | "reference.update"
  | "delivery"
  | "fee.create"
  | "fee.payment"
  | "fee.payment.rejected"
  | "fee.taxinvoice"
  | "fee.cancel"
  | "fee.cancel.rejected"
  | "fee.refund"
  | "fee.reprice"
  | "budget.parse"
  | "export.rejected"
  | "draft.start"
  | "draft.ready"
  | "doc.mismatch"
  | "ai.request"
  | "perf";

export type AuditEntry = {
  at: string;
  /** 동작한 관리자(로그인 전 시도는 입력한 아이디 또는 '-') */
  user: string;
  action: AuditAction;
  target?: string;
  detail?: Record<string, unknown>;
};

export interface AuditLog {
  record(e: Omit<AuditEntry, "at"> & { at?: string }): Promise<void>;
  list(filter?: { action?: AuditAction; target?: string }): Promise<AuditEntry[]>;
}

export function createMemoryAuditLog(): AuditLog {
  const rows: AuditEntry[] = [];
  return {
    async record(e) {
      rows.push({ ...e, at: e.at ?? new Date().toISOString() });
    },
    async list(f) {
      return rows.filter((r) => (!f?.action || r.action === f.action) && (!f?.target || r.target === f.target));
    },
  };
}

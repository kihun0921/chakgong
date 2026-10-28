"use client";

import { won } from "@/domain/documents/format";
import type { LaborAgreementInput } from "@/domain/documents/model";
import { NumInput } from "@/components/NumInput";
import { inputCls, labelCls, type PatchWork, type WorkState } from "./types";

// 노무비 구분관리 및 지급확인제 합의서(서식1-1) 입력. 계약금액·상호·사업자번호 등은 앞 화면의 값을 그대로 쓴다.
export function LaborAgreementForm({ work, patch }: { work: WorkState; patch: PatchWork }) {
  const a = work.laborAgreement;
  const set = (p: Partial<LaborAgreementInput>) => patch({ laborAgreement: { ...a, ...p } });
  const fromBudget = work.parsed ? work.parsed.summary.reduce((s, r) => s + r.labor, 0) : null;
  const type = work.general.contractType;

  return (
    <section aria-label="노무비 합의서 입력" className="mt-6 rounded-md border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-[18px]">노무비 구분관리 및 지급확인제 합의서</h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        제1~11조 문안은 실제 제출본(서식1-1)을 그대로 씁니다. 계약금액·상호·사업자등록번호·주소·전화는 앞 화면의 값을 쓰고, 아래 값만 이 서류에 따로 입력합니다.
      </p>
      {type === "국가" && (
        <p role="alert" className="mt-3 rounded-sm bg-warn-soft px-3 py-2 text-[13px] text-warn">
          ⚠ 국가계약용 합의서는 근거 조항 문안 샘플이 아직 없어 만들지 않습니다. 샘플을 받으면 추가합니다. 지금은 작성한 합의서를 PDF로 올려 합본할 수 있습니다.
        </p>
      )}
      {type === "" && <p className="mt-3 text-[13px] text-text-muted">계약 유형(국가·지방)을 1장 공사·계약 정보에서 먼저 고르세요.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="la-direct" className={labelCls}>계약상의 직접노무비(원)</label>
          <NumInput id="la-direct" className={`${inputCls} text-right`} value={a.directLaborCost} onValue={(raw) => set({ directLaborCost: raw })} placeholder={fromBudget ? String(fromBudget) : ""} />
          <p className="mt-1 text-[12px] text-text-muted">
            {a.directLaborCost !== "" ? "직접 입력한 값을 씁니다." : fromBudget !== null ? `비워 두면 내역서 집계표의 노무비 합 ${won(fromBudget)}원을 씁니다.` : "내역서를 올리지 않았으면 직접 입력하세요."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="la-bill" className={labelCls}>청구일(매월 N일)</label>
            <NumInput id="la-bill" className={inputCls} value={a.billingDay} onValue={(raw) => set({ billingDay: raw })} />
          </div>
          <div>
            <label htmlFor="la-pay" className={labelCls}>지급기일(매월 N일)</label>
            <NumInput id="la-pay" className={inputCls} value={a.paymentDay} onValue={(raw) => set({ paymentDay: raw })} />
          </div>
        </div>
        <div>
          <label htmlFor="la-bank" className={labelCls}>은행명</label>
          <input id="la-bank" className={inputCls} value={a.bankName} onChange={(e) => set({ bankName: e.target.value })} />
        </div>
        <div>
          <label htmlFor="la-acct" className={labelCls}>노무비 전용 계좌번호</label>
          <input id="la-acct" className={inputCls} value={a.accountNo} onChange={(e) => set({ accountNo: e.target.value })} />
        </div>
      </div>
    </section>
  );
}

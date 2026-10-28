// 용역비 내역 저장소 (SRS SR-FEE-01~13, SR-NF-13)
// 개발 중에는 로컬 파일 구현을 쓰고, 배포 직전에 같은 인터페이스를 Supabase 구현으로 바꿔 끼운다.
// 저장 대상은 금액·입금일·입금자명·입금액·세금계산서·환불일·메모뿐이다. 금융 인증 정보는 저장하지 않는다(SR-FEE-11).

import type { FeeRecord } from "@/domain/fee-ledger";

export interface FeeStore {
  get(projectId: string): Promise<FeeRecord | null>;
  put(fee: FeeRecord): Promise<void>;
  list(): Promise<FeeRecord[]>;
  remove(projectId: string): Promise<void>;
}

export function createMemoryFeeStore(): FeeStore {
  const map = new Map<string, FeeRecord>();
  return {
    async get(id) {
      return map.get(id) ?? null;
    },
    async put(f) {
      map.set(f.projectId, f);
    },
    async list() {
      return [...map.values()];
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

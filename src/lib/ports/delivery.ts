// 납품(최종 출력) 이력 저장소 (SRS SR-OUT-08, SR-FEE-07, D-1)
// 최종 파일(xlsx·PDF·합본)이 만들어지는 데 성공한 사실을 남긴다. 환불 가능 여부(납품 후 환불 불가)는 이 이력으로 판단한다.
// 개발 중에는 로컬 파일 구현을 쓰고, 배포 직전에 같은 인터페이스를 Supabase 구현으로 바꿔 끼운다(docs/WAVES.md).

export type DeliveryKind = "xlsx" | "pdf" | "package";

export type DeliveryRecord = {
  projectId: string;
  /** ISO 시각 */
  at: string;
  /** 출력한 관리자 */
  by: string;
  kind: DeliveryKind;
  files: string[];
};

export interface DeliveryLog {
  record(r: Omit<DeliveryRecord, "at"> & { at?: string }): Promise<void>;
  list(projectId: string): Promise<DeliveryRecord[]>;
  /** 한 번이라도 납품(출력)한 공사인가 — 납품 후에는 환불할 수 없다 */
  hasDelivered(projectId: string): Promise<boolean>;
}

/** 시험·임시용 메모리 구현 */
export function createMemoryDeliveryLog(): DeliveryLog {
  const rows: DeliveryRecord[] = [];
  return {
    async record(r) {
      rows.push({ ...r, at: r.at ?? new Date().toISOString() });
    },
    async list(projectId) {
      return rows.filter((x) => x.projectId === projectId);
    },
    async hasDelivered(projectId) {
      return rows.some((x) => x.projectId === projectId);
    },
  };
}

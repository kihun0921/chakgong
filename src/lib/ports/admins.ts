// 관리자 계정 저장소 (SRS SR-PL-01~02). 회원가입 없이 운영자가 미리 발급한 계정만 있다.

export type AdminAccount = { id: string; passwordHash: string; createdAt: string };

export interface AdminStore {
  get(id: string): Promise<AdminAccount | null>;
  create(account: AdminAccount): Promise<void>;
  list(): Promise<AdminAccount[]>;
}

export function createMemoryAdminStore(initial: AdminAccount[] = []): AdminStore {
  const map = new Map(initial.map((a) => [a.id, a]));
  return {
    async get(id) {
      return map.get(id) ?? null;
    },
    async create(a) {
      if (map.has(a.id)) throw new Error("이미 있는 관리자 아이디입니다.");
      map.set(a.id, a);
    },
    async list() {
      return [...map.values()];
    },
  };
}

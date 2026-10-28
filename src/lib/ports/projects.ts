// 공사 저장소·파일 저장소 (SRS SR-DM-01·05, SR-NF-13·17)
// 개발 중에는 로컬 파일 구현을 쓰고, 배포 직전에 같은 인터페이스를 Supabase(DB·Storage) 구현으로 바꿔 끼운다.
// 저장할 때 주민등록번호는 필드 단위로, 업로드 파일은 파일 단위로 암호화한다.

import type { WorkState } from "@/lib/projects/types";

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  /** 공사 종료일. 이 날부터 5년이 지나면 삭제한다 (SR-NF-17) */
  closedAt: string | null;
};

/** 저장소 안의 공사. data의 주민등록번호는 복호화된 전체 값이다(서버 안에서만 쓴다). */
export type StoredProject = ProjectSummary & { data: WorkState };

export interface ProjectStore {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<StoredProject | null>;
  create(name: string, by: string, data?: WorkState): Promise<StoredProject>;
  save(id: string, data: WorkState, by: string, name?: string): Promise<StoredProject>;
  setClosed(id: string, closedAt: string | null): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface FileStore {
  put(projectId: string, fileId: string, bytes: Uint8Array): Promise<void>;
  get(projectId: string, fileId: string): Promise<Uint8Array | null>;
  remove(projectId: string, fileId: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  list(projectId: string): Promise<string[]>;
}

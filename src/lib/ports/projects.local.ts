// 공사·파일 저장소의 로컬 파일 구현(개발용). 배포 전에 Supabase 구현으로 교체한다.
//  - 공사: .data/projects/<id>.json (주민등록번호는 암호화된 문자열로 저장)
//  - 파일: .data/files/<공사id>/<파일id> (전체 암호화)

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { decryptBytes, decryptString, encryptBytes, encryptString } from "@/lib/crypto/field";
import type { WorkState } from "@/lib/projects/types";
import type { FileStore, ProjectStore, ProjectSummary, StoredProject } from "./projects";
import { INITIAL_WORK, withDefaults } from "@/lib/projects/types";

const safe = (id: string) => {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error("올바르지 않은 식별자입니다.");
  return id;
};

function encryptData(data: WorkState): WorkState {
  return { ...data, engineers: data.engineers.map((e) => ({ ...e, rrn: encryptString(e.rrn) })) };
}
function decryptData(data: WorkState): WorkState {
  return { ...data, engineers: data.engineers.map((e) => ({ ...e, rrn: decryptString(e.rrn) })) };
}

export function createLocalProjectStore(dir = path.join(process.cwd(), ".data")): ProjectStore {
  const root = path.join(dir, "projects");
  const fileOf = (id: string) => path.join(root, `${safe(id)}.json`);
  const write = async (p: StoredProject) => {
    await mkdir(root, { recursive: true });
    await writeFile(fileOf(p.id), JSON.stringify({ ...p, data: encryptData(p.data) }), "utf8");
  };
  const read = async (id: string): Promise<StoredProject | null> => {
    try {
      const p = JSON.parse(await readFile(fileOf(id), "utf8")) as StoredProject;
      return { ...p, data: decryptData(withDefaults(p.data)) };
    } catch {
      return null;
    }
  };
  return {
    async list() {
      let names: string[] = [];
      try {
        names = (await readdir(root)).filter((n) => n.endsWith(".json"));
      } catch {
        return [];
      }
      const out: ProjectSummary[] = [];
      for (const n of names) {
        const p = await read(n.slice(0, -5));
        if (p) {
          const { data: _data, ...summary } = p;
          void _data;
          out.push(summary);
        }
      }
      return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    get: read,
    async create(name, by, data = INITIAL_WORK) {
      const now = new Date().toISOString();
      const p: StoredProject = {
        id: crypto.randomUUID(),
        name,
        createdAt: now,
        updatedAt: now,
        updatedBy: by,
        closedAt: null,
        data,
      };
      await write(p);
      return p;
    },
    async save(id, data, by, name) {
      const prev = await read(id);
      if (!prev) throw new Error("공사를 찾을 수 없습니다.");
      const next: StoredProject = {
        ...prev,
        name: name ?? prev.name,
        updatedAt: new Date().toISOString(),
        updatedBy: by,
        data,
      };
      await write(next);
      return next;
    },
    async setClosed(id, closedAt) {
      const prev = await read(id);
      if (!prev) throw new Error("공사를 찾을 수 없습니다.");
      await write({ ...prev, closedAt });
    },
    async remove(id) {
      await rm(fileOf(id), { force: true });
    },
  };
}

export function createLocalFileStore(dir = path.join(process.cwd(), ".data")): FileStore {
  const root = path.join(dir, "files");
  const folder = (projectId: string) => path.join(root, safe(projectId));
  return {
    async put(projectId, fileId, bytes) {
      await mkdir(folder(projectId), { recursive: true });
      await writeFile(path.join(folder(projectId), safe(fileId)), encryptBytes(bytes));
    },
    async get(projectId, fileId) {
      try {
        return decryptBytes(await readFile(path.join(folder(projectId), safe(fileId))));
      } catch {
        return null;
      }
    },
    async remove(projectId, fileId) {
      await rm(path.join(folder(projectId), safe(fileId)), { force: true });
    },
    async removeProject(projectId) {
      await rm(folder(projectId), { recursive: true, force: true });
    },
    async list(projectId) {
      try {
        return await readdir(folder(projectId));
      } catch {
        return [];
      }
    },
  };
}

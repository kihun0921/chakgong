import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sampleEngineer } from "@/domain/documents/fixtures";
import { decryptString, encryptString } from "@/lib/crypto/field";
import { createMemoryAuditLog } from "@/lib/ports/audit";
import { createLocalFileStore, createLocalProjectStore } from "@/lib/ports/projects.local";
import { diffAssumptions } from "./assumptions";
import { createProject, duplicateProject, purgeExpired, saveProject, toClient, type ProjectDeps } from "./service";
import { INITIAL_WORK } from "./types";

// SRS SR-DM-01·05·06, SR-NF-13·15·17 / PRD AC-F8-2 (T-23, T-41, 이력, 보존)
async function deps(): Promise<ProjectDeps & { dir: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chakgong-"));
  return {
    dir,
    projects: createLocalProjectStore(dir),
    files: createLocalFileStore(dir),
    audit: createMemoryAuditLog(),
  };
}

describe("암호화", () => {
  it("문자열을 암호화했다가 되돌리고, 변조하면 거부한다", () => {
    const enc = encryptString("800101-1000000");
    expect(enc).not.toContain("800101");
    expect(decryptString(enc)).toBe("800101-1000000");
    const tampered = `${enc.slice(0, -4)}AAAA`;
    expect(() => decryptString(tampered)).toThrow();
  });
  it("같은 값도 암호문이 매번 다르다", () => {
    expect(encryptString("same")).not.toBe(encryptString("same"));
  });
});

describe("공사 저장과 개인정보 보호 (T-41, SR-NF-13·15)", () => {
  it("주민등록번호는 디스크에 암호화되어 저장되고, 서버 안에서는 복호화되며, 화면용은 마스킹된다", async () => {
    const d = await deps();
    const p = await createProject(d, "시험 공사", "admin");
    const withEng = { ...INITIAL_WORK, engineers: [sampleEngineer({ id: "e1", role: "siteManager", name: "홍현장", rrn: "8001011234567" })] };
    const saved = await saveProject(d, p.id, withEng, "admin");

    const raw = await readFile(path.join(d.dir, "projects", `${p.id}.json`), "utf8");
    expect(raw).not.toContain("8001011234567");
    expect(raw).toContain("enc:v1:");

    expect((await d.projects.get(p.id))?.data.engineers[0].rrn).toBe("8001011234567");
    expect(saved.data.engineers[0].rrn).toBe("800101-*******");
    expect(toClient((await d.projects.get(p.id))!).data.engineers[0].rrn).toBe("800101-*******");
  });

  it("마스킹된 값으로 다시 저장해도 원래 주민등록번호가 유지된다", async () => {
    const d = await deps();
    const p = await createProject(d, "공사", "admin");
    const eng = sampleEngineer({ id: "e1", role: "siteManager", name: "홍현장", rrn: "8001011234567" });
    const first = await saveProject(d, p.id, { ...INITIAL_WORK, engineers: [eng] }, "admin");
    await saveProject(d, p.id, first.data, "admin"); // 화면이 받은 마스킹 값을 그대로 다시 보낸다
    expect((await d.projects.get(p.id))?.data.engineers[0].rrn).toBe("8001011234567");
  });

  it("업로드 파일은 암호화되어 저장되고 되돌릴 수 있다", async () => {
    const d = await deps();
    const bytes = new TextEncoder().encode("%PDF-1.4 비밀 내용 SECRET");
    await d.files.put("p1", "f1", bytes);
    const onDisk = await readFile(path.join(d.dir, "files", "p1", "f1"));
    expect(onDisk.includes(Buffer.from("SECRET"))).toBe(false);
    expect(Buffer.from((await d.files.get("p1", "f1"))!).toString()).toContain("SECRET");
    expect(await d.files.get("p1", "none")).toBeNull();
  });

  it("경로를 벗어나는 식별자는 거부한다", async () => {
    const d = await deps();
    await expect(d.files.put("../evil", "f", new Uint8Array([1]))).rejects.toThrow();
  });
});

describe("가정값 변경 이력 (SR-DM-06)", () => {
  it("착공일·일정·직접 지정 인원을 바꾸면 변경자·전후 값이 이력에 남는다", async () => {
    const d = await deps();
    const p = await createProject(d, "공사", "admin1");
    const base = { ...INITIAL_WORK, general: { ...INITIAL_WORK.general, startDate: "2026-11-02", durationDays: "70" } };
    await saveProject(d, p.id, base, "admin1");
    const next = {
      ...base,
      general: { ...base.general, startDate: "2026-11-16" },
      schedule: { A01: { startDay: 1, endDay: 30 } },
      extraLabor: [{ id: 1, processKey: "A01", name: "기술자", perDay: 3, workdays: 20 }],
    };
    await saveProject(d, p.id, next, "admin2");

    const rows = (await d.audit.list({ action: "assumption.change", target: p.id })).filter((r) => r.user === "admin2");
    const fields = rows.map((r) => r.detail?.field);
    expect(fields).toEqual(expect.arrayContaining(["착공일", "공정 A01 일정", "직접 지정 인원 기술자"]));
    const start = rows.find((r) => r.detail?.field === "착공일");
    expect(start?.detail).toMatchObject({ before: "2026-11-02", after: "2026-11-16" });
  });

  it("바뀐 것이 없으면 가정값 이력을 남기지 않는다", async () => {
    expect(diffAssumptions(INITIAL_WORK, INITIAL_WORK)).toEqual([]);
  });

  it("내역서 추출값을 고치면 이력에 남는다", () => {
    const parsed = {
      summary: [{ code: "A", name: "배관", material: 0, labor: 0, expense: 0, total: 100 }],
      summaryTotal: 100,
      grandTotal: 100,
      summaryTotalMatchesGrandTotal: true,
      labor: [{ code: "A", trade: "배관공", quantity: 44, wage: 1 }],
      equipment: [],
      warnings: [],
    };
    const a = { ...INITIAL_WORK, parsed };
    const b = { ...INITIAL_WORK, parsed: { ...parsed, labor: [{ code: "A", trade: "배관공", quantity: 50, wage: 1 }] } };
    expect(diffAssumptions(a, b)).toEqual([{ field: "노무 배관공 수량", before: "44", after: "50" }]);
  });
});

describe("공사 복제 (T-23, AC-F8-2)", () => {
  it("입력·파일을 이어받은 새 공사가 만들어지고 원본은 바뀌지 않는다", async () => {
    const d = await deps();
    const src = await createProject(d, "원본", "admin");
    await d.files.put(src.id, "u1", new TextEncoder().encode("%PDF-copy"));
    const base = {
      ...INITIAL_WORK,
      general: { ...INITIAL_WORK.general, projectName: "원본 공사", startDate: "2026-11-02" },
      uploads: [{ id: "u1", toc: 5, name: "계약서.pdf", size: 9 }],
    };
    // 파일 목록은 저장소 계층에서 직접 반영(화면의 저장은 파일 목록을 바꾸지 못한다)
    const stored = (await d.projects.get(src.id))!;
    await d.projects.save(src.id, { ...stored.data, ...base }, "admin");
    const before = JSON.stringify((await d.projects.get(src.id))!.data);

    const copy = await duplicateProject(d, src.id, "admin");
    expect(copy.id).not.toBe(src.id);
    expect(copy.name).toBe("원본 (복사)");
    expect(copy.data.general.startDate).toBe("2026-11-02");
    expect(copy.data.uploads).toHaveLength(1);
    expect(copy.data.uploads[0].id).not.toBe("u1");
    expect(Buffer.from((await d.files.get(copy.id, copy.data.uploads[0].id))!).toString()).toBe("%PDF-copy");

    expect(JSON.stringify((await d.projects.get(src.id))!.data)).toBe(before);
    expect(copy.closedAt).toBeNull();
    expect((await d.audit.list({ action: "project.duplicate" }))[0].detail).toMatchObject({ from: src.id });
  });
});

describe("보존 5년 (SR-NF-17)", () => {
  it("공사 종료 후 5년이 지난 공사만 파일과 함께 삭제한다", async () => {
    const d = await deps();
    const old = await createProject(d, "오래된 공사", "admin");
    const recent = await createProject(d, "최근 공사", "admin");
    const open = await createProject(d, "진행 중", "admin");
    await d.files.put(old.id, "f", new Uint8Array([1, 2, 3]));
    await d.projects.setClosed(old.id, "2021-10-01T00:00:00.000Z");
    await d.projects.setClosed(recent.id, "2022-10-01T00:00:00.000Z");

    const removed = await purgeExpired(d, new Date("2026-10-17T00:00:00.000Z"));
    expect(removed).toEqual([old.id]);
    expect(await d.projects.get(old.id)).toBeNull();
    expect(await d.files.get(old.id, "f")).toBeNull();
    expect(await d.projects.get(recent.id)).not.toBeNull();
    expect(await d.projects.get(open.id)).not.toBeNull();
    expect((await d.audit.list({ action: "project.purge" }))[0].target).toBe(old.id);
    expect((await readdir(path.join(d.dir, "projects"))).length).toBe(2);
  });
});

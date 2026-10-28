import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sampleEngineer } from "@/domain/documents/fixtures";
import { createLocalFileStore, createLocalProjectStore } from "@/lib/ports/projects.local";
import { createLocalFeeStore } from "@/lib/ports/fees.local";
import { INITIAL_WORK } from "@/lib/projects/types";
import { createFee } from "@/domain/fee-ledger";
// 스크립트(.mjs)를 시험에서 그대로 불러 쓴다
import { backupData, restoreData } from "../../../scripts/backup-lib.mjs";

// SRS SR-NF-11 (백업 일 1회, RPO 24시간) / 복구 시험
const tmp = () => mkdtemp(path.join(os.tmpdir(), "chakgong-bk-"));

describe("백업과 복구", () => {
  it("공사·파일·용역비를 백업했다가 지운 뒤 복구하면 주민번호(복호화)·파일·용역비가 그대로 돌아온다", async () => {
    const data = await tmp();
    const backups = await tmp();
    const projects = createLocalProjectStore(data);
    const files = createLocalFileStore(data);
    const fees = createLocalFeeStore(data);

    const p = await projects.create("복구 시험", "admin", { ...INITIAL_WORK, engineers: [sampleEngineer({ id: "e1", role: "siteManager", name: "홍현장", rrn: "800101-1234567" })] });
    await files.put(p.id, "f1", new Uint8Array([1, 2, 3, 4]));
    await fees.put(createFee(p.id, 500_000, "2026-10-17"));

    const bk: string = await backupData(data, backups, new Date("2026-10-17T03:00:00"));
    await rm(data, { recursive: true, force: true }); // 사고: 데이터 폴더가 사라졌다

    const r = await restoreData(bk, data, new Date("2026-10-17T04:00:00"));
    expect(r.previous).toBeNull();
    const back = await createLocalProjectStore(data).get(p.id);
    expect(back?.name).toBe("복구 시험");
    expect(back?.data.engineers[0].rrn).toBe("800101-1234567");
    expect(Array.from((await createLocalFileStore(data).get(p.id, "f1")) ?? [])).toEqual([1, 2, 3, 4]);
    expect((await createLocalFeeStore(data).get(p.id))?.total).toBe(550_000);
  });

  it("백업은 보관 개수만 남기고 오래된 것부터 지운다", async () => {
    const data = await tmp();
    const backups = await tmp();
    await createLocalProjectStore(data).create("x", "a");
    for (let d = 1; d <= 5; d++) await backupData(data, backups, new Date(`2026-10-0${d}T03:00:00`), 3);
    const left = (await readdir(backups)).sort();
    expect(left).toHaveLength(3);
    expect(left[0].startsWith("20261003")).toBe(true);
  });

  it("복구할 때 기존 데이터는 별도 폴더에 보관한다(되돌릴 수 있게)", async () => {
    const data = await tmp();
    const backups = await tmp();
    await createLocalProjectStore(data).create("옛것", "a");
    const bk: string = await backupData(data, backups);
    await createLocalProjectStore(data).create("새것", "a");
    const r = await restoreData(bk, data);
    expect(r.previous).not.toBeNull();
    expect((await createLocalProjectStore(data).list()).map((x) => x.name)).toEqual(["옛것"]);
    expect((await createLocalProjectStore(r.previous as string).list()).length).toBe(2);
  });
});

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { sampleInput } from "@/domain/documents/fixtures";
import type { ParsedBudget } from "@/lib/budget/parse";
import { buildPackage } from "@/lib/pdf/package";
import { createMemoryDeliveryLog } from "@/lib/ports/delivery";
import type { BuildPlanInput } from "@/lib/work/buildPlan";
import { exportPlan, preparePlan, type ExportRequest } from "./service";

// SRS SR-OUT-01·03·08 / PRD AC-F7-2, AC-F10-1 (T-19, T-20, 납품 이력)
const parsed: ParsedBudget = {
  summary: [
    { code: "A01", name: "냉난방기", material: 5000, labor: 3000, expense: 1000, total: 9000 },
    { code: "A02", name: "배관", material: 2000, labor: 6000, expense: 500, total: 8500 },
    { code: "A03", name: "관급 분리발주", material: 0, labor: 0, expense: 0, total: 0 },
  ],
  summaryTotal: 17_500,
  grandTotal: 17_500,
  summaryTotalMatchesGrandTotal: true,
  labor: [{ code: "A02", trade: "배관공", quantity: 44, wage: 250_000 }],
  equipment: [{ code: "A01", name: "크레인 100ton", hours: 18 }],
  warnings: [],
};
const plan: BuildPlanInput = {
  parsed,
  startDate: "2026-11-02",
  durationDays: "70",
  holidaysText: "2026-12-25 2027-01-01",
  schedule: { A01: { startDay: 1, endDay: 30 }, A02: { startDay: 20, endDay: 70 } },
  extraLabor: [],
  extraEquipment: [],
};
const req = (over: Partial<ExportRequest> = {}): ExportRequest => ({
  projectId: "p1",
  doc: sampleInput(),
  plan,
  ...over,
});

const A3_LANDSCAPE = { w: 1190.55, h: 841.89 };

describe("공정표·투입계획 출력과 납품 이력", () => {
  it("xlsx 출력에 성공하면 납품 이력이 기록된다 (SR-OUT-08)", async () => {
    const log = createMemoryDeliveryLog();
    const r = await exportPlan("xlsx", req(), { log, user: "admin1" });
    expect(r.ok).toBe(true);
    const rows = await log.list("p1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ projectId: "p1", by: "admin1", kind: "xlsx" });
    expect(await log.hasDelivered("p1")).toBe(true);
  });

  it("PDF는 공정표와 투입계획표가 각각 A3 가로 한 페이지다 (T-20)", async () => {
    const log = createMemoryDeliveryLog();
    const r = await exportPlan("pdf", req(), { log, user: "a" });
    if (!r.ok) throw new Error("출력 실패");
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(2);
    for (const p of doc.getPages()) {
      const { width, height } = p.getSize();
      expect(width).toBeCloseTo(A3_LANDSCAPE.w, 0);
      expect(height).toBeCloseTo(A3_LANDSCAPE.h, 0);
    }
  }, 60_000);

  it("공정이 많아도 각 서류가 한 페이지에 들어간다", async () => {
    const many: ParsedBudget = {
      ...parsed,
      summary: Array.from({ length: 60 }, (_, i) => ({
        code: `K${i}`, name: `공종 ${i}`, material: 100, labor: 100, expense: 100, total: 300,
      })),
      summaryTotal: 60 * 300,
      grandTotal: 60 * 300,
      labor: Array.from({ length: 20 }, (_, i) => ({ code: `K${i}`, trade: `직종 ${i}`, quantity: 5, wage: 1 })),
      equipment: [],
    };
    const r = await exportPlan("pdf", req({ plan: { ...plan, parsed: many, schedule: {} } }), {
      log: createMemoryDeliveryLog(),
      user: "a",
    });
    if (!r.ok) throw new Error("출력 실패");
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(2);
  }, 60_000);

  it("검증을 통과하지 못하면 출력하지 않고 이력도 남기지 않는다 (SR-OUT-01, T-06)", async () => {
    const log = createMemoryDeliveryLog();
    const bad = req({ plan: { ...plan, schedule: { A01: { startDay: 1, endDay: 75 } } } });
    const r = await exportPlan("xlsx", bad, { log, user: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "invalid") {
      expect(r.issues.some((i) => i.code === "DURATION")).toBe(true);
    } else {
      throw new Error("invalid여야 합니다");
    }
    expect(await log.list("p1")).toEqual([]);
    expect(await log.hasDelivered("p1")).toBe(false);
  });

  it("집계표 합계 행과 다르면(금액 불일치) 출력하지 않는다 (T-09)", async () => {
    const r = preparePlan(req({ plan: { ...plan, parsed: { ...parsed, grandTotal: 99_999 } } }));
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "invalid") expect(r.issues[0].code).toBe("V-1");
  });

  it("내역서를 확정하지 않았으면 출력하지 않는다", async () => {
    const r = await exportPlan("xlsx", req({ plan: { ...plan, parsed: null } }), {
      log: createMemoryDeliveryLog(),
      user: "a",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("noPlan");
  });
});

describe("합본에 공정표·투입계획표를 넣는다", () => {
  it("계산 결과를 주면 목차 ④·⑨ 위치에 들어간다", async () => {
    const prep = preparePlan(req());
    if (!prep.ok) throw new Error("준비 실패");
    const r = await buildPackage(sampleInput(), [], prep.data);
    if (!r.ok) throw new Error(`실패: ${r.reason}`);
    const tocs = r.outline.map((o) => o.toc);
    expect(tocs).toContain(4);
    expect(tocs).toContain(9);
    expect(r.notices.join(" ")).not.toContain("공정표·인원장비투입계획표는 내역서를 확정");
    const merged = await PDFDocument.load(r.bytes);
    expect(merged.getPageCount()).toBe(r.totalPages);
  }, 120_000);

  it("계산 결과가 없으면 공정표·투입계획표는 빠지고 안내가 나온다", async () => {
    const r = await buildPackage(sampleInput(), []);
    if (!r.ok) throw new Error(`실패: ${r.reason}`);
    expect(r.notices.join(" ")).toContain("공정표·인원장비투입계획표는 내역서를 확정");
  }, 120_000);
});

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { sampleInput } from "@/domain/documents/fixtures";
import { DEFAULT_TOC_ORDER } from "@/domain/documents/model";
import { buildPackage } from "./package";

// SRS SR-CM-10, SR-OUT-04·05 / PRD AC-F5-2, AC-F7-3 (T-14, T-21)
async function pdfWithPages(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([595, 842]);
  return doc.save();
}

describe("착공계 합본", () => {
  it("지정 순서로 합본하고 쪽번호·목차 쪽이 맞는다 (T-14)", async () => {
    const r = await buildPackage(sampleInput(), [
      { toc: 14, name: "품질관리계획서.pdf", bytes: await pdfWithPages(3) },
      { toc: 5, name: "도급계약서.pdf", bytes: await pdfWithPages(2) },
    ]);
    if (!r.ok) throw new Error(`실패: ${r.reason}`);

    // 실제 PDF의 쪽수와 계산한 쪽수가 같다
    const merged = await PDFDocument.load(r.bytes);
    expect(merged.getPageCount()).toBe(r.totalPages);

    // 묶음은 제출서류 목차의 순서(실제 제출본의 순서)이고 시작 쪽이 늘어난다
    const order = r.outline.map((o) => o.toc);
    expect(order).toEqual(DEFAULT_TOC_ORDER.filter((n) => order.includes(n)));
    const starts = r.outline.map((o) => o.startPage);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));

    // 품질관리계획서(14): 간지 1쪽 + 업로드 3쪽 = 4쪽, 다음 묶음의 시작과 4쪽 차이
    const q = r.outline.find((o) => o.toc === 14)!;
    const idx = r.outline.indexOf(q);
    const next = r.outline[idx + 1];
    if (next) expect(next.startPage - q.startPage).toBe(4);
  }, 180_000);

  it("목차 순서를 바꾸면 합본 순서도 바뀐다", async () => {
    const order = [5, ...Array.from({ length: 15 }, (_, i) => i + 1).filter((n) => n !== 5)];
    const r = await buildPackage(sampleInput({ tocOrder: order }), [
      { toc: 5, name: "도급계약서.pdf", bytes: await pdfWithPages(1) },
    ]);
    if (!r.ok) throw new Error(`실패: ${r.reason}`);
    expect(r.outline[0].toc).toBe(5);
  }, 180_000);

  it("손상된 업로드 PDF는 파일을 지목하고 합본하지 않는다 (T-21)", async () => {
    const r = await buildPackage(sampleInput(), [
      { toc: 5, name: "정상.pdf", bytes: await pdfWithPages(1) },
      { toc: 11, name: "손상된보험증명.pdf", bytes: new Uint8Array([1, 2, 3]) },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "badFiles") {
      expect(r.bad.map((b) => b.title)).toEqual(["손상된보험증명.pdf"]);
    } else {
      throw new Error("badFiles여야 합니다");
    }
  }, 60_000);

  it("필수 입력이 비어 있으면 합본하지 않고 누락 항목을 알린다 (T-15)", async () => {
    const r = await buildPackage(sampleInput({ contractType: "" }), []);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "missing") expect(r.missing).toContain("계약 유형");
  });

  it("첨부가 없는 서류는 간지만 들어가고 안내가 나온다", async () => {
    const r = await buildPackage(sampleInput(), []);
    if (!r.ok) throw new Error(`실패: ${r.reason}`);
    expect(r.notices.join(" ")).toContain("간지만");
  }, 180_000);
});

describe("직접시공계획서 서식이 합본에 들어간다", () => {
  it("세부공종을 넣으면 목차 12번에 간지 + 서식이 들어간다", async () => {
    const { EMPTY_DIRECT } = await import("@/domain/documents/model");
    const input = sampleInput({
      contractAmount: 1000,
      direct: {
        ...EMPTY_DIRECT,
        totalLabor: "100",
        directLabor: "60",
        subLabor: "40",
        items: [
          { id: "a", name: "토공", amount: "600", kind: "direct" },
          { id: "b", name: "포장공", amount: "400", kind: "sub" },
        ],
      },
    });
    const r = await buildPackage(input, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const base = await buildPackage(sampleInput({ contractAmount: 1000 }), []);
    expect(base.ok && r.totalPages - base.totalPages).toBe(1); // 서식 1쪽 추가
    expect(r.outline.some((o) => o.toc === 12)).toBe(true);
  });
});

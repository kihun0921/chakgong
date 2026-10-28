import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  checkUpload,
  detectLayout,
  loadWorkbook,
  parseBudget,
  type LayoutMapping,
} from "./parse";
import { strip } from "./test-utils";

// SRS SR-IN-03~06, 08 / PRD AC-F1-2 (T-02)
// 실제 조달청 내역서 양식은 아직 없어서 합성 파일로 시험한다. 실제 파일이 생기면 testdata/에 넣고 이 시험을 보강한다.

type Opts = {
  summaryName?: string;
  detailName?: string;
  headerOffset?: number;
  grandTotal?: number | null;
};

async function makeWorkbook(opts: Opts = {}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("갑지").addRow(["공사명", "시험 공사"]);

  const s = wb.addWorksheet(opts.summaryName ?? "집계표");
  const off = opts.headerOffset ?? 2; // 헤더 앞의 제목·빈 줄 수
  for (let i = 0; i < off; i++) s.addRow([i === 0 ? "집 계 표" : ""]);
  s.addRow(["공종코드", "공종명", "재료비", "노무비", "경비", "합계"]);
  s.addRow(["A01", "냉난방기", 5000, 3000, 1000, 9000]);
  s.addRow(["A02", "배관", "2,000", "6,000", "500", "8,500"]); // 쉼표가 든 문자열 숫자
  s.addRow(["A03", "관급 분리발주", 0, 0, 0, 0]);
  const gt = opts.grandTotal === undefined ? 17500 : opts.grandTotal;
  if (gt !== null) s.addRow(["", "합 계", 7000, 9000, 1500, gt]);

  const d = wb.addWorksheet(opts.detailName ?? "내역서");
  d.addRow(["공종코드", "품명", "규격", "단위", "수량", "노임단가", "금액"]);
  d.addRow(["A02", "배관공(급수급탕)", "", "인", 44, 250_000, 11_000_000]);
  d.addRow(["A02", "배관공(오배수)", "", "인", 53, 250_000, 13_250_000]);
  d.addRow(["A02", "배관공(철거)", "", "인", 4, 250_000, 1_000_000]);
  d.addRow(["A01", "크레인 100ton", "", "HR", 18, 0, 0]);
  d.addRow(["A01", "냉난방기 실외기", "10HP", "EA", 4, 0, 0]);

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

describe("내역서 파싱", () => {
  it("집계표의 공종별 재료비·노무비·경비·합계를 추출한다", async () => {
    const wb = await loadWorkbook(await makeWorkbook());
    const layout = detectLayout(wb);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const r = parseBudget(wb, layout.mapping);

    expect(r.summary).toHaveLength(3);
    expect(r.summary[0]).toEqual({
      code: "A01",
      name: "냉난방기",
      material: 5000,
      labor: 3000,
      expense: 1000,
      total: 9000,
    });
    expect(r.summary[1].material).toBe(2000); // "2,000" → 2000
    expect(r.summary[2].total).toBe(0); // 0원 공종도 유지 (협조 구간)
  });

  it("순공사비 합계와 합계 행을 비교해 일치 여부를 알려 준다", async () => {
    const wb = await loadWorkbook(await makeWorkbook());
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    const r = parseBudget(wb, layout.mapping);
    expect(r.summaryTotal).toBe(17_500);
    expect(r.summaryTotalMatchesGrandTotal).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("공종 합계의 합이 합계 행과 다르면 경고한다", async () => {
    const wb = await loadWorkbook(await makeWorkbook({ grandTotal: 17_000 }));
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    const r = parseBudget(wb, layout.mapping);
    expect(r.summaryTotalMatchesGrandTotal).toBe(false);
    expect(r.warnings.join(" ")).toContain("합계");
  });

  it("노무 행(단위 '인')에서 직종·수량·노임단가를 공종코드별로 추출한다 (T-10 입력)", async () => {
    const wb = await loadWorkbook(await makeWorkbook());
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    const r = parseBudget(wb, layout.mapping);
    expect(strip(r.labor)).toEqual([
      { code: "A02", trade: "배관공(급수급탕)", quantity: 44, wage: 250_000 },
      { code: "A02", trade: "배관공(오배수)", quantity: 53, wage: 250_000 },
      { code: "A02", trade: "배관공(철거)", quantity: 4, wage: 250_000 },
    ]);
  });

  it("장비 행(단위 HR)을 장비 목록으로 분리한다", async () => {
    const wb = await loadWorkbook(await makeWorkbook());
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    const r = parseBudget(wb, layout.mapping);
    expect(strip(r.equipment)).toEqual([{ code: "A01", name: "크레인 100ton", hours: 18 }]);
  });

  it("헤더가 다른 줄에 있어도 찾는다", async () => {
    const wb = await loadWorkbook(await makeWorkbook({ headerOffset: 5 }));
    const layout = detectLayout(wb);
    expect(layout.ok).toBe(true);
    if (layout.ok) expect(layout.mapping.summary.headerRow).toBe(6);
  });
});

describe("시트·머리글을 인식하지 못할 때 열 매핑 (SR-IN-05)", () => {
  it("인식하지 못하면 이유와 시트 목록을 알려 준다", async () => {
    const wb = await loadWorkbook(await makeWorkbook({ summaryName: "Sheet2" }));
    const layout = detectLayout(wb);
    expect(layout.ok).toBe(false);
    if (!layout.ok) {
      expect(layout.sheetNames).toContain("Sheet2");
      expect(layout.reason).toContain("집계표");
    }
  });

  it("관리자가 시트명과 열 위치를 지정하면 파싱된다", async () => {
    const wb = await loadWorkbook(await makeWorkbook({ summaryName: "Sheet2" }));
    const mapping: LayoutMapping = {
      summary: {
        sheet: "Sheet2",
        headerRow: 3,
        columns: { code: 1, name: 2, material: 3, labor: 4, expense: 5, total: 6 },
      },
      detail: {
        sheet: "내역서",
        headerRow: 1,
        columns: { code: 1, name: 2, spec: 3, unit: 4, quantity: 5, wage: 6 },
      },
    };
    const r = parseBudget(wb, mapping);
    expect(r.summaryTotal).toBe(17_500);
    expect(r.labor).toHaveLength(3);
  });
});

describe("업로드 파일 검사 (SR-IN-08)", () => {
  it("20MB 이하의 엑셀 파일(.xlsx·.xls)만 받는다", () => {
    expect(checkUpload({ name: "내역서.xlsx", size: 20 * 1024 * 1024 })).toEqual({ ok: true });
    expect(checkUpload({ name: "내역서.xlsx", size: 20 * 1024 * 1024 + 1 })).toMatchObject({
      ok: false,
    });
    expect(checkUpload({ name: "내역서.xls", size: 1000 })).toEqual({ ok: true });
    expect(checkUpload({ name: "내역서.xls", size: 20 * 1024 * 1024 + 1 })).toMatchObject({ ok: false });
    expect(checkUpload({ name: "내역서.pdf", size: 1000 })).toMatchObject({ ok: false });
  });

  it("열 수 없는 파일(손상·암호)은 원인을 알리는 오류를 낸다", async () => {
    await expect(loadWorkbook(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/열 수 없|암호|손상/);
  });
});

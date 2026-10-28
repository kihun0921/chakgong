import ExcelJS from "exceljs";
import { HyperFormula } from "hyperformula";
import { describe, expect, it } from "vitest";
import { sampleInput } from "@/domain/documents/fixtures";
import type { PlanDocData } from "@/domain/documents/plan-docs";
import { computePlan, type PlanInput } from "@/domain/plan";
import { assemblePlanInput } from "@/lib/budget/assemble";
import { detectLayout, loadWorkbook, parseBudget } from "@/lib/budget/parse";
import { buildPlanWorkbook } from "./xlsx";

// SRS SR-OUT-02·06 / PRD AC-F7-1·2 (T-19, T-20의 xlsx·성능 부분)
// 엑셀을 직접 열 수는 없어서, 저장된 수식을 수식 엔진(HyperFormula, 시험 전용)으로 다시 계산해
// 저장해 둔 값과 같은지, 수식 오류가 0건인지 확인한다. 엑셀(Windows)에서 여는 확인은 G2에서 개발자가 직접 한다.
const planInput: PlanInput = {
  start: "2026-11-02",
  durationDays: 70,
  holidays: new Set(["2026-12-25", "2027-01-01"]),
  processes: [
    { key: "A", name: "냉난방기", amount: 600, startDay: 1, endDay: 15 },
    { key: "B", name: "배관", amount: 300, startDay: 16, endDay: 45 },
    { key: "C", name: "관급 분리발주", amount: 0, startDay: 1, endDay: 70 },
    { key: "D", name: "시험·조정", amount: 100, startDay: 46, endDay: 70 },
  ],
  laborLines: [
    { processKey: "B", name: "배관공", manDays: 20, method: "내역서", basis: "내역서" },
    { processKey: "A", name: "보통인부", manDays: 5, method: "가정", basis: "직접 지정" },
    { processKey: "D", name: "T.A.B 기술자", manDays: 7, method: "가정", basis: "직접 지정" },
  ],
  equipmentLines: [{ processKey: "A", name: "크레인", manDays: 3, method: "내역서", basis: "18HR ÷ 8" }],
  summaryTotalWon: 1000,
};
const toPlan = (i: PlanInput): PlanDocData => ({
  processes: i.processes,
  result: computePlan(i),
  summaryTotalWon: i.summaryTotalWon,
});

const EPOCH = Date.UTC(1899, 11, 30);
const serial = (d: Date) => (d.getTime() - EPOCH) / 86_400_000;

type Cached = { sheet: string; row: number; col: number; formula: string; result: unknown };

async function recalc(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const sheets: Record<string, (string | number | boolean | null)[][]> = {};
  const formulas: Cached[] = [];
  wb.eachSheet((ws) => {
    const grid: (string | number | boolean | null)[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        (grid[r - 1] ??= [])[c - 1] = null;
        const v = cell.value as unknown;
        if (v && typeof v === "object" && "formula" in (v as object)) {
          const f = v as { formula: string; result?: unknown };
          grid[r - 1][c - 1] = `=${f.formula}`;
          formulas.push({ sheet: ws.name, row: r - 1, col: c - 1, formula: f.formula, result: f.result });
        } else if (v instanceof Date) {
          grid[r - 1][c - 1] = serial(v);
        } else if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
          grid[r - 1][c - 1] = v;
        }
      });
    });
    for (let i = 0; i < grid.length; i++) grid[i] = Array.from(grid[i] ?? [], (x) => x ?? null);
    sheets[ws.name] = grid;
  });
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: "gpl-v3" });
  return { wb, hf, formulas };
}

/** 수식 엔진의 시트 값에서 글자가 들어 있는 첫 칸의 위치 */
function findCell(hf: HyperFormula, sheet: string, text: string, col?: number, exact = false) {
  const id = hf.getSheetId(sheet)!;
  const grid = hf.getSheetValues(id);
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < (grid[r]?.length ?? 0); c++)
      if ((exact ? String(grid[r][c] ?? "") === text : String(grid[r][c] ?? "").includes(text)) && (col === undefined || c === col)) return { sheet: id, row: r, col: c };
  throw new Error(`'${text}' 칸을 찾지 못했습니다`);
}

describe("공정표·투입계획 xlsx (기준 공정표 양식)", () => {
  const input = sampleInput();
  const plan = toPlan(planInput);

  it("시트 2개(예정공정표·산정근거), 공정표는 A3 가로·너비 맞춤, 인쇄 영역은 두 표까지다", async () => {
    const bytes = await buildPlanWorkbook(input, plan);
    const { wb } = await recalc(bytes);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["예정공정표", "산정근거"]);
    const ps = wb.getWorksheet("예정공정표")!.pageSetup;
    expect(ps.paperSize).toBe(8);
    expect(ps.orientation).toBe("landscape");
    expect(ps.fitToWidth).toBe(1);
    expect(ps.printArea).toMatch(/^A1:[A-Z]+\d+$/);
  });

  it("한 시트에 공사예정공정표와 인원 및 장비투입계획표가 위아래로 있다", async () => {
    const { hf } = await recalc(await buildPlanWorkbook(input, plan));
    const t1 = findCell(hf, "예정공정표", "예  정  공  정  표");
    const t2 = findCell(hf, "예정공정표", "인원 및 장비투입계획표");
    expect(t2.row).toBeGreaterThan(t1.row);
    expect(findCell(hf, "예정공정표", "일평균 투입인원").row).toBeGreaterThan(t2.row);
    expect(findCell(hf, "예정공정표", "공사기간 : 2026.11.02 ~ 2027.01.10 (70일)").row).toBe(t1.row + 2);
  });

  it("보할·진도율·합계·누계·일평균·검산이 수식으로 들어 있고 조건부 서식이 있다", async () => {
    const { wb, formulas } = await recalc(await buildPlanWorkbook(input, plan));
    expect(formulas.length).toBeGreaterThan(40);
    expect(new Set(formulas.map((f) => f.sheet))).toEqual(new Set(["예정공정표", "산정근거"]));
    expect((wb.getWorksheet("예정공정표") as unknown as { conditionalFormattings: unknown[] }).conditionalFormattings.length).toBeGreaterThan(0);
  });

  it("수식을 다시 계산하면 저장된 값과 같고 수식 오류가 0건이다", async () => {
    const { hf, formulas } = await recalc(await buildPlanWorkbook(input, plan));
    const errors: string[] = [];
    for (const f of formulas) {
      const sheetId = hf.getSheetId(f.sheet)!;
      const got = hf.getCellValue({ sheet: sheetId, row: f.row, col: f.col });
      const want = f.result instanceof Date ? serial(f.result) : f.result === undefined ? 0 : f.result; // 값이 0인 수식은 저장된 값이 비어 있다
      if (typeof got === "object" && got !== null) {
        errors.push(`${f.sheet}!R${f.row + 1}C${f.col + 1} 오류 ${JSON.stringify(got)} (${f.formula})`);
      } else if (typeof want === "number") {
        if (typeof got !== "number" || Math.abs(got - want) > 1e-6)
          errors.push(`${f.sheet}!R${f.row + 1}C${f.col + 1}: ${got} ≠ ${want} (${f.formula})`);
      } else if ((got ?? "") !== (want ?? "")) {
        errors.push(`${f.sheet}!R${f.row + 1}C${f.col + 1}: '${got}' ≠ '${want}' (${f.formula})`);
      }
    }
    expect(errors).toEqual([]);
  });

  it("검산 4개 항목의 판정이 모두 '통과'다", async () => {
    const { hf } = await recalc(await buildPlanWorkbook(input, plan));
    const id = hf.getSheetId("예정공정표")!;
    const grid = hf.getSheetValues(id);
    const verdicts = grid.flat().filter((v) => v === "통과" || v === "불일치");
    expect(verdicts).toEqual(["통과", "통과", "통과", "통과"]);
  });

  it("착공일을 엑셀에서 바꾸면(계산용 값 변경) 준공일·공정 착수일이 다시 계산된다", async () => {
    const { hf } = await recalc(await buildPlanWorkbook(input, plan));
    const sheet = hf.getSheetId("예정공정표")!;
    const startAt = findCell(hf, "예정공정표", "착공일", 1, true); // B열의 '착공일' 라벨(계산용 값)
    const endAt = findCell(hf, "예정공정표", "준공예정일", 1, true);
    const before = hf.getCellValue({ sheet, row: endAt.row, col: 3 }) as number;
    hf.setCellContents({ sheet, row: startAt.row, col: 3 }, serial(new Date(Date.UTC(2026, 10, 16)))); // 착공일 11/16 (+14일)
    expect((hf.getCellValue({ sheet, row: endAt.row, col: 3 }) as number) - before).toBe(14);
  });

  it("주요 공정내용과 위치별 작업 구간이 시트에 들어가고 수식 오류가 없다", async () => {
    const withExtra: PlanDocData = {
      ...plan,
      remarks: { A: "설계도서 검토" },
      locations: [{ id: "1", name: "옥상", startDay: 16, endDay: 30, remark: "실외기 양중" }],
    };
    const { hf, formulas } = await recalc(await buildPlanWorkbook(input, withExtra));
    findCell(hf, "예정공정표", "설계도서 검토");
    findCell(hf, "예정공정표", "16~30일차 · 실외기 양중");
    findCell(hf, "예정공정표", "옥상", 1, true);
    const id = hf.getSheetId("예정공정표")!;
    const errors = formulas.filter((f) => typeof hf.getCellValue({ sheet: id, row: f.row, col: f.col }) === "object" && f.sheet === "예정공정표");
    expect(errors).toHaveLength(0);
  });

  it("협조 구간(0원)은 '(협조)' 표시, 가정 값은 '▲ 가정', 내역서 값은 '● 내역서'로 표시한다", async () => {
    const { hf } = await recalc(await buildPlanWorkbook(input, plan));
    const co = findCell(hf, "예정공정표", "관급 분리발주");
    expect(String(hf.getCellValue(co))).toContain("협조");
    expect(hf.getCellValue({ sheet: co.sheet, row: co.row, col: 3 })).toBe(0); // 금액 0
    findCell(hf, "예정공정표", "▲ 가정");
    findCell(hf, "예정공정표", "● 내역서");
  });

  it("0은 비워 보이는 숫자 서식(정답표와 같음)과 파란 입력 칸(착수·완료 일차)이 있다", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await buildPlanWorkbook(input, plan)) as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet("예정공정표")!;
    expect(ws.getCell("C6").numFmt).toBe("0.00;-0.00;;@");
    expect(ws.getCell("D6").numFmt).toBe("#,##0;-#,##0;;@");
    // 착수일차 칸: 구간 4개(상순·하순) 뒤 첫 칸
    const nStart = ws.getCell(6, 6 + 5); // 구간 5개
    expect(nStart.font?.color?.argb).toBe("FF0000FF");
  });
});

// ── 성능 (SR-OUT-06, T-20): 내역서 800행 파싱·계산·xlsx 출력 30초 이내 ──
async function bigBudget(summaryRows: number, detailRows: number): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("집계표");
  s.addRow(["공종코드", "공종명", "재료비", "노무비", "경비", "합계"]);
  let total = 0;
  for (let i = 1; i <= summaryRows; i++) {
    s.addRow([`C${i}`, `공종 ${i}`, 1000 * i, 500 * i, 100 * i, 1600 * i]);
    total += 1600 * i;
  }
  s.addRow(["", "합계", 0, 0, 0, total]);
  const d = wb.addWorksheet("내역서");
  d.addRow(["공종코드", "품명", "규격", "단위", "수량", "노임단가"]);
  for (let i = 0; i < detailRows; i++) {
    const code = `C${(i % summaryRows) + 1}`;
    if (i % 5 === 0) d.addRow([code, `직종 ${i}`, "", "인", 3 + (i % 7), 200_000]);
    else if (i % 5 === 1) d.addRow([code, `장비 ${i}`, "", "HR", 8 + (i % 20), 0]);
    else d.addRow([code, `자재 ${i}`, "규격", "EA", i, 1000]);
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe("성능", () => {
  it("내역서 800행(집계표 100공종)을 파싱·계산하고 xlsx로 내보내는 데 30초가 안 걸린다", async () => {
    const t0 = performance.now();
    const file = await bigBudget(100, 800);
    const wbk = await loadWorkbook(file);
    const layout = detectLayout(wbk);
    if (!layout.ok) throw new Error(layout.reason);
    const parsed = parseBudget(wbk, layout.mapping);
    const a = assemblePlanInput(parsed, {
      start: "2026-11-02",
      durationDays: 200,
      holidays: new Set(["2026-12-25"]),
    });
    const res = computePlan(a.input);
    const bytes = await buildPlanWorkbook(sampleInput({ durationDays: 200 }), {
      processes: a.input.processes,
      result: res,
      summaryTotalWon: a.input.summaryTotalWon,
    });
    const sec = (performance.now() - t0) / 1000;
    expect(bytes.length).toBeGreaterThan(1000);
    expect(res.validation.passed).toBe(true);
    expect(sec).toBeLessThan(30);
  }, 60_000);
});

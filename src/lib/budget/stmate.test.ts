import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { assemblePlanInput } from "./assemble";
import { detectLayout, loadWorkbook, parseBudget } from "./parse";
import { strip } from "./test-utils";
import { defaultComposition, splitByChildren } from "@/lib/work/composition";

// 실제 계약내역(연천읍지구 풍수해생활권 종합정비사업, STmate 형식)에서 확인한 구조를 합성 파일로 재현한다.
// - 숨겨진 '총괄내역서' 시트가 있다(상세 내역서로 잘못 고르면 안 된다)
// - 집계표 머리글이 두 줄이다(윗줄 공종·수량·단위·총액/노무비/재료비/경비, 아랫줄 단가·금액)
// - 'Ⅰ. 순공사비' 아래에 공종이 있고 'Ⅱ. 관급자재비'가 이어진다
// - 내역서가 (토목)(건축)(설비) 시트로 나뉘고 공종코드 열이 없다
async function stmate(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("총괄내역서", { state: "hidden" }).addRow(["공 종", "명 칭"]);

  const s = wb.addWorksheet("집계표");
  s.addRow(["공사명 : 시험 정비사업"]);
  s.addRow(["공 종", "규 격", "수량", "단위", "총 액", "", "노 무 비", "", "재 료 비", "", "경 비", "", "비고"]);
  s.addRow(["공 종", "규 격", "수량", "단위", "단 가", "금 액", "단 가", "금 액", "단 가", "금 액", "단 가", "금 액", "비고"]);
  s.addRow(["Ⅰ. 순공사비", "", 1, "식", "", 1_000, "", 500, "", 300, "", 200]);
  s.addRow([" 1. 토목공사", "", 1, "식", "", 900, "", 450, "", 270, "", 180]);
  s.addRow([" 2. 건축공사", "", 1, "식", "", 60, "", 30, "", 20, "", 10]);
  s.addRow([" 3. 설비공사", "", 1, "식", "", 40, "", 20, "", 10, "", 10]);
  s.addRow(["Ⅱ. 관급자재비", "", 1, "식", "", 777]);
  s.addRow([" 도급자설치 관급자재비", "", 1, "식", "", 777]);
  s.mergeCells("E2:F2");
  s.mergeCells("G2:H2");

  for (const [sheet, rows] of [
    ["내역서(토목)", [["....콘크리트포장깨기", "T=30cm", 144, "㎥"], ["..물푸기", "", 344, "hr"], ["....보통인부", "", 12, "인"]]],
    ["내역서(건축)", [["....교통신호수", "", 3, "일"]]],
    ["내역서(설비)", [["....양수기", "", 10, "HR"]]],
  ] as const) {
    const d = wb.addWorksheet(sheet);
    d.addRow(["내 역 서"]);
    d.addRow([`공사명 : ${sheet}`]);
    d.addRow(["공 종", "명 칭", "규 격", "수 량", "단위", "합 계", "", "노 무 비", "", "재 료 비", "", "경 비", "", "비 고"]);
    d.addRow(["공 종", "명 칭", "규 격", "수 량", "단위", "단 가", "금 액", "단 가", "금 액", "단 가", "금 액", "단 가", "금 액", "비 고"]);
    for (const [name, spec, qty, unit] of rows) d.addRow(["", name, spec, qty, unit, 0, 0, 150_000, 0, 0, 0, 0, 0, ""]);
    d.mergeCells("F3:G3");
    d.mergeCells("H3:I3");
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe("STmate 형식 내역서 (연천읍지구 계약내역 구조)", () => {
  it("집계표 두 줄 머리글에서 금액 열을 읽고, 순공사비 제목 행은 합계로만 쓴다", async () => {
    const wb = await loadWorkbook(await stmate());
    const layout = detectLayout(wb);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const r = parseBudget(wb, layout.mapping);
    expect(r.summary.map((x) => [x.name, x.total, x.labor, x.material, x.expense])).toEqual([
      ["토목공사", 900, 450, 270, 180],
      ["건축공사", 60, 30, 20, 10],
      ["설비공사", 40, 20, 10, 10],
    ]);
    expect(r.grandTotal).toBe(1_000);
    expect(r.summaryTotal).toBe(1_000); // 관급자재비(777)는 순공사비에 들어가지 않는다
    expect(r.summaryTotalMatchesGrandTotal).toBe(true);
    expect(r.warnings.some((w) => w.includes("다릅니다"))).toBe(false);
  });

  it("숨겨진 총괄내역서를 건너뛰고 (토목)(건축)(설비) 내역서를 모두 읽어 해당 공종에 잇는다", async () => {
    const wb = await loadWorkbook(await stmate());
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    expect(layout.mapping.detail.sheet).toBe("내역서(토목)");
    expect(layout.mapping.extraDetails?.map((m) => m.sheet)).toEqual(["내역서(건축)", "내역서(설비)"]);
    const r = parseBudget(wb, layout.mapping);
    expect(strip(r.labor)).toEqual([{ code: "S1", trade: "보통인부", quantity: 12, wage: 150_000 }]);
    expect(strip(r.equipment)).toEqual([
      { code: "S1", name: "물푸기", hours: 344 },
      { code: "S3", name: "양수기", hours: 10 },
    ]);
  });

  it("노무 행이 없으면 경고하고, 공정·장비 조립은 집계표 공종과 맞아 제외 행이 없다", async () => {
    const wb = await loadWorkbook(await stmate());
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    const r = parseBudget(wb, layout.mapping);
    const a = assemblePlanInput(r, { start: "2026-01-02", durationDays: 100, holidays: new Set() });
    expect(a.unmatched).toEqual([]);
    expect(a.input.processes.map((p) => p.key)).toEqual(["S1", "S2", "S3"]);
    expect(a.input.summaryTotalWon).toBe(1_000);
  });
});

// 실제 파일이 있을 때만 도는 시험: 환경변수 SAMPLE_YEONCHEON에 계약내역 xlsx 경로를 지정한다.
// (고객 자료라 저장소에 넣지 않는다)
describe.skipIf(!process.env.SAMPLE_YEONCHEON)("실제 연천읍지구 계약내역", () => {
  it("순공사비 10,289,250,755원, 토목·건축·설비 합계가 맞고 차이가 0원이다", async () => {
    const wb = await loadWorkbook(new Uint8Array(readFileSync(process.env.SAMPLE_YEONCHEON as string)));
    const layout = detectLayout(wb);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const r = parseBudget(wb, layout.mapping);
    expect(r.summary.map((x) => [x.name, x.total])).toEqual([
      ["토목공사", 10_189_555_063],
      ["건축공사", 11_371_068],
      ["설비공사", 88_324_624],
    ]);
    expect(r.summaryTotal).toBe(10_289_250_755);
    expect(r.grandTotal).toBe(10_289_250_755);
    expect(r.summaryTotalMatchesGrandTotal).toBe(true);
    // 재료비·노무비·경비 합계
    expect(r.summary.reduce((a, x) => a + x.labor, 0)).toBe(5_549_924_648);
    expect(r.summary.reduce((a, x) => a + x.material, 0)).toBe(3_252_024_672);
    expect(r.summary.reduce((a, x) => a + x.expense, 0)).toBe(1_487_301_435);
    expect(r.warnings.filter((w) => w.includes("다릅니다"))).toEqual([]);
  }, 60_000);
  it("내역서 개요 단위: 하천공 아래 차탄천·군자천·읍내천·지골천의 금액이 기준 공정표와 같다", async () => {
    const wb = await loadWorkbook(new Uint8Array(readFileSync(process.env.SAMPLE_YEONCHEON as string)));
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error(layout.reason);
    const r = parseBudget(wb, layout.mapping);
    const secs = r.sections ?? [];
    const find = (name: string) => secs.find((x) => x.name === name && x.code === "S1");
    expect(find("Ⅰ. 하천공")?.total).toBe(3_080_384_068); // 기준 공정표 Ⅰ. 하천공
    expect(find("1. 차탄천")?.total).toBe(236_111_993);
    expect(find("2. 군자천")?.total).toBe(2_497_247_854);
    expect(find("3. 읍내천")?.total).toBe(102_173_365);
    expect(find("4. 지골천")?.total).toBe(244_850_856);
    expect(find("1. 차탄천")?.parentId).toBe(find("Ⅰ. 하천공")?.id);
    // 시트 전체(가상 뿌리)는 집계표 토목공사 금액과 같다
    expect(secs.find((x) => x.depth === -1 && x.code === "S1")?.total).toBe(10_189_555_063);
    // 공통부대공은 기준 공정표 값, 품질관리비·안전관리비는 순공사비 밖 항목으로 따로 둔다
    expect(find("Ⅵ. 공통부대공")?.total).toBe(472_260_986);
    expect(find("품질관리비")).toMatchObject({ outside: true, total: 232_641_948 });
    expect(find("안전관리비")).toMatchObject({ outside: true, total: 882_009_000 });
    // 하천공~공통부대공 6개의 합 = 토목공사 금액
    const top = secs.filter((x) => x.code === "S1" && x.depth === 0 && !x.outside);
    expect(top.map((x) => x.name)).toEqual(["Ⅰ. 하천공", "Ⅱ. 교량공", "Ⅲ. 급경사지공", "Ⅳ. 토석류 유입방지시설", "Ⅴ. 내수배제시설공", "Ⅵ. 공통부대공"]);
    expect(top.reduce((a, x) => a + x.total, 0)).toBe(10_189_555_063);
    // 토목공사를 나누면 기준 공정표의 Ⅰ~Ⅵ 단위가 나온다(기타 없음)
    const comp = defaultComposition(r);
    const split = splitByChildren(r, comp, "S1");
    if (!split.ok) throw new Error(split.error);
    expect(split.value.filter((d) => d.code === "S1").map((d) => [d.name, d.amount])).toEqual([
      ["Ⅰ. 하천공", 3_080_384_068],
      ["Ⅱ. 교량공", 717_024_272],
      ["Ⅲ. 급경사지공", 306_555_317],
      ["Ⅳ. 토석류 유입방지시설", 227_719_370],
      ["Ⅴ. 내수배제시설공", 5_385_611_050],
      ["Ⅵ. 공통부대공", 472_260_986],
    ]);
  }, 60_000);
});

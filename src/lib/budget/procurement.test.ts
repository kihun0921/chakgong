import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { DAAI } from "@/domain/golden/daai-fixture";
import { assemblePlanInput } from "./assemble";
import { detectLayout, loadWorkbook, parseBudget } from "./parse";
import { strip } from "./test-utils";

// 조달청 제출 내역서 형식(중대범죄수사청 사무환경 조성사업(기계) 대아이앤씨 제출본)의 구조를 합성 파일로 재현한다.
// - 집계표 품명에 공종코드가 붙어 있다(0101 장비설치공사). 그리고 01 ⊃ 0101 ⊃ 010301처럼 상위가 하위의 합이다
// - 파일 끝에 End Of File 표시 줄이 있다
// - 내역서의 노무 행은 직종이 규격 칸에 있다(노무비 | 보통인부 | 인, 코튼망사발열체 설치 | 내장공 | 인)
// - 장비 행은 이름과 규격(크레인(타이어) | 100ton | HR)
async function procurement(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("집계표");
  s.addRow(["집 계 표"]);
  s.addRow(["[공사명] 시험 사무환경 조성사업"]);
  s.addRow(["품 명", "규 격", "단위", "수량", "재 료 비", "", "노 무 비", "", "경 비", "", "합 계"]);
  s.addRow(["", "", "", "", "단가", "금액", "단가", "금액", "단가", "금액", "단가", "금액"]);
  const row = (n: string, m: number, l: number, e: number) => s.addRow([n, "", "", 1, m, m, l, l, e, e, m + l + e, m + l + e]);
  row("01 기계설비공사", 150, 70, 30); // 상위: 하위 합
  row("0101 장비설치공사", 100, 10, 0);
  row("0103 위생배관공사", 50, 60, 30); // 상위
  row("010301 위생기구설치공사", 20, 20, 0);
  row("010302 급수급탕배관공사", 30, 40, 30);
  row("02 관급공사", 0, 0, 0);
  row("0201 항온항습기설치공사", 0, 0, 0);
  row("03 기계설비T.A.B공사", 0, 40, 0);
  s.addRow([]);
  s.addRow(["[ 합 계 ]", "", "", "", 150, 150, 110, 110, 30, 30, 290, 290]);
  s.addRow(["End Of File(Ver 6.0)"]);
  s.addRow(["마지막열은 지우지 마시오"]);

  const d = wb.addWorksheet("내역서");
  d.addRow(["", "", "[공사명] 시험"]);
  d.addRow(["공종", "코드", "품 명", "규 격", "단위", "수 량", "재 료 비", "", "노 무 비", "", "경 비"]);
  d.addRow(["", "", "", "", "", "", "단가", "금액", "단가", "금액", "단가", "금액"]);
  const item = (g: string, code: string, name: string, spec: string, unit: string, qty: number, wage = 0) =>
    d.addRow([g, code, name, spec, unit, qty, 0, 0, wage, wage * qty]);
  item("0101", "MM066683724", "전기온수기", "1,000LIT", "대", 1);
  item("0101", "56900017041", "노무비", "보통인부", "인", 1, 136016);
  item("010302", "56900017030", "노무비", "배관공", "인", 44, 196169);
  item("010302", "S9900000039", "크레인(타이어)", "100ton", "HR", 18);
  item("03", "S8190000410", "코튼망사발열체 설치", "내장공", "인", 3, 202321);
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

async function parsed() {
  const wb = await loadWorkbook(await procurement());
  const layout = detectLayout(wb);
  if (!layout.ok) throw new Error(layout.reason);
  return parseBudget(wb, layout.mapping);
}

describe("조달청 제출 내역서 형식", () => {
  it("이름 앞 공종코드를 떼고, 상위(01·0103) 항목은 빼고 말단 공종만 읽는다", async () => {
    const r = await parsed();
    expect(r.summary.map((x) => [x.code, x.name, x.total])).toEqual([
      ["0101", "장비설치공사", 110],
      ["010301", "위생기구설치공사", 40],
      ["010302", "급수급탕배관공사", 100],
      ["0201", "항온항습기설치공사", 0],
      ["03", "기계설비T.A.B공사", 40],
    ]);
    expect(r.summaryTotal).toBe(290);
    expect(r.grandTotal).toBe(290);
    expect(r.summaryTotalMatchesGrandTotal).toBe(true);
  });

  it("파일 끝 표시 줄(End Of File)은 공종으로 읽지 않는다", async () => {
    const r = await parsed();
    expect(r.summary.some((x) => /End Of File|마지막열/.test(x.name))).toBe(false);
  });

  it("노무 행은 규격 칸의 직종으로, 장비 행은 이름+규격으로 읽고 공종 열의 코드로 잇는다", async () => {
    const r = await parsed();
    expect(strip(r.labor)).toEqual([
      { code: "0101", trade: "보통인부", quantity: 1, wage: 136016 },
      { code: "010302", trade: "배관공", quantity: 44, wage: 196169 },
      { code: "03", trade: "내장공", quantity: 3, wage: 202321 },
    ]);
    expect(strip(r.equipment)).toEqual([{ code: "010302", name: "크레인(타이어) 100ton", hours: 18 }]);
    // 집계표 공종코드와 맞아 제외되는 행이 없다
    const a = assemblePlanInput(r, { start: "2026-11-02", durationDays: 70, holidays: new Set() });
    expect(a.unmatched).toEqual([]);
    expect(a.input.equipmentLines[0]).toMatchObject({ processKey: "010302", name: "크레인(타이어) 100ton", manDays: 3 }); // 18HR ÷ 8 올림
  });
});

// 실제 파일이 있을 때만: 환경변수 SAMPLE_DAAI에 대아이앤씨 제출 내역서 xlsx 경로를 지정한다(고객 자료라 저장소에 넣지 않는다)
describe.skipIf(!process.env.SAMPLE_DAAI)("실제 중대범죄수사청 사무환경 조성사업(기계) 내역서", () => {
  async function real() {
    const wb = await loadWorkbook(new Uint8Array(readFileSync(process.env.SAMPLE_DAAI as string)));
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error(layout.reason);
    return parseBudget(wb, layout.mapping);
  }

  it("순공사비 622,764,021원, 말단 공종 16개, 집계표 차이 0원", async () => {
    const t0 = Date.now();
    const r = await real();
    expect(r.summaryTotal).toBe(622_764_021);
    expect(r.grandTotal).toBe(622_764_021);
    expect(r.summaryTotalMatchesGrandTotal).toBe(true);
    expect(r.summary.map((x) => x.code)).toEqual([
      "0101", "0102", "010301", "010302", "010303", "0104", "0105", "0106", "0107", "0201", "0202", "0203", "0204", "03", "04", "05",
    ]);
    expect(r.warnings.filter((w) => w.includes("다릅니다"))).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(10_000);
  }, 60_000);

  it("내역서 소분류 그룹의 금액·노무비 합이 기준 공정표의 공정 금액과 같다", async () => {
    const r = await real();
    const secs = r.sections ?? [];
    const g = (name: string, code: string) => secs.find((x) => x.name === name && x.code === code);
    // 냉난방기설치공사(0105)의 그룹 → 기준 공정 HP1·HP4·HP5·HP6·HP7
    expect(g("히트펌프 냉난방기(물품)", "0105")?.total).toBe(27_308_400);
    expect(g("냉매배관공사", "0105")?.total).toBe(130_885_111);
    expect(g("드레인배관공사", "0105")?.total).toBe(24_869_767);
    expect(g("제어기 및 제어선 설치공사", "0105")?.total).toBe(44_822_799);
    expect(g("배관커버 및 트레이 설치공사", "0105")?.total).toBe(15_323_856);
    // 장비설치 그룹은 기준 공정표에서 실외기(HP2)와 실내기(HP3)로 나뉜다: 금액·노무비 합이 같다
    const eq = g("장비설치공사", "0105")!;
    expect(eq.total).toBe(15_717_191 + 15_573_966);
    expect(eq.labor).toBe(8_464_250 + 13_549_542);
    expect(g("냉매배관공사", "0105")?.labor).toBe(69_719_790);
    // 공종 제목 단위는 집계표 공종 금액과 같다
    expect(secs.find((x) => x.depth === 0 && x.code === "0105")?.total).toBe(274_501_090);
    expect(secs.find((x) => x.depth === 0 && x.code === "0106")?.total).toBe(194_483_000);
    // 바닥공조 2~5층 그룹 합 = 기준 공정 FL1
    const floors = (from: number, to: number) => secs.filter((x) => x.code === "0106" && x.depth === 1 && /^\d+층$/.test(x.name) && Number(x.name.replace("층", "")) >= from && Number(x.name.replace("층", "")) <= to).reduce((a, x) => a + x.total, 0);
    expect(floors(2, 5)).toBe(66_223_500);
    expect(floors(6, 9)).toBe(34_482_000);
    expect(floors(10, 13)).toBe(16_390_500);
    expect(floors(14, 17)).toBe(12_222_000);
    expect(g("공용견적", "0106")?.total).toBe(65_165_000); // 설계검토 5,000,000 + BMS 60,165,000
    // 노무 행은 해당 그룹이 아니라 공종 제목 단위에 연결된다(그룹 안에 있으면 그 그룹)
    expect(r.equipment[0].sectionId).toBe(g("장비설치공사", "0105")!.id);
  }, 60_000);

  it("내역서 노무 수량이 기준 공정표의 내역서 방식 인일과 같다 (T-10 입력)", async () => {
    const r = await real();
    const key = (t: string, q: number) => `${t}:${q}`;
    const parsedKeys = r.labor.map((l) => key(l.trade, l.quantity)).sort();
    const golden = DAAI.laborLines.filter((l) => l.method === "내역서").map((l) => key(l.name, l.manDays)).sort();
    expect(parsedKeys).toEqual(golden);
    expect(r.labor.find((l) => l.code === "010302" && l.trade === "배관공")?.quantity).toBe(44);
    expect(r.labor.find((l) => l.code === "010303" && l.trade === "배관공")?.quantity).toBe(53);
    expect(r.labor.find((l) => l.code === "0104" && l.trade === "배관공")?.quantity).toBe(4);
    expect(strip(r.equipment)).toEqual([{ code: "0105", name: "크레인(타이어) 100ton", hours: 18 }]);
  }, 60_000);
});

// 공정표·인원및장비투입계획 xlsx 출력 (SRS SR-OUT-02, 8.1·8.2)
// 양식은 기준 공정표(중대범죄수사청 사무환경 조성사업 정답표)를 따른다:
//   - 시트 '예정공정표' 한 장에 공사예정공정표와 인원 및 장비투입계획표를 위아래로 둔다(A3 가로)
//   - 인쇄 영역 밖 아래쪽에 검산과 계산용 값(착공일·구간 시작/종료일)을 둔다
//   - 시트 '산정근거'에 직종·장비별 산정 방식과 근거를 적는다
// 보할·진도율·합계·누계·일평균·검산은 값이 아니라 수식이다. 착공일이나 일차를 엑셀에서 고치면 다시 계산된다.
// 수식 옆에 계산해 둔 값(result)을 함께 저장해, 재계산하지 않는 보기 프로그램에서도 값이 보인다.

import ExcelJS from "exceljs";
import type { DocInput } from "@/domain/documents/model";
import type { PlanDocData } from "@/domain/documents/plan-docs";
import { round2 } from "@/domain/progress";

const FONT = "굴림"; // SRS 8.1: 굴림 글꼴
const font = (bold = false, size = 10, color?: string): Partial<ExcelJS.Font> => ({ name: FONT, size, bold, ...(color ? { color: { argb: color } } : {}) });
const thin: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
const hair: Partial<ExcelJS.Borders> = { top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" } };
const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const HEAD_FILL = solid("FFD9D9D9"); // 머리글
const SUM_FILL = solid("FFEDEDED"); // 합계·소계
const INPUT_FILL = solid("FFFFF2CC"); // 고치면 다시 계산되는 입력 칸(파란 글자)
const ASSUME_FILL = solid("FFFFF2CC"); // 가정으로 만든 값

// 0은 비워 보이게(정답표와 같은 서식)
const FMT_PCT = "0.00;-0.00;;@";
const FMT_WON = "#,##0;-#,##0;;@";
const FMT_CNT = "#,##0;-#,##0;;@";

/** 열 번호(1부터) → 엑셀 열 이름 */
export function colName(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

const utcDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

type StyleOpts = { bold?: boolean; fill?: ExcelJS.Fill; align?: "left" | "center" | "right"; numFmt?: string; border?: "thin" | "hair"; color?: string; size?: number };
function style(cell: ExcelJS.Cell, o: StyleOpts = {}) {
  cell.font = font(o.bold, o.size ?? 10, o.color);
  cell.border = o.border === "hair" ? hair : thin;
  if (o.fill) cell.fill = o.fill;
  cell.alignment = { vertical: "middle", horizontal: o.align ?? "left", wrapText: true };
  if (o.numFmt) cell.numFmt = o.numFmt;
}

function addDaysStr(s: string, n: number): string {
  const d = utcDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 'yyyy.mm.dd' */
const dotDate = (s: string) => s.replace(/-/g, ".");

/** 구간 머리글: 월 단위로 묶은 칸 이름('2026년 11월')과 그 구간 번호 범위 */
function monthGroups(periods: { start: string; end: string }[]): { label: string; from: number; to: number }[] {
  const out: { label: string; from: number; to: number }[] = [];
  periods.forEach((p, k) => {
    const label = `${p.start.slice(0, 4)}년 ${Number(p.start.slice(5, 7))}월`;
    const last = out.at(-1);
    if (last && last.label === label) last.to = k;
    else out.push({ label, from: k, to: k });
  });
  return out;
}

export async function buildPlanWorkbook(input: DocInput, plan: PlanDocData): Promise<Uint8Array> {
  const { processes, result } = plan;
  const periods = result.periods;
  const P = periods.length;
  const wb = new ExcelJS.Workbook();
  wb.creator = "착공계 자동화";
  // 열 때 모든 수식을 다시 계산한다(값이 0인 수식은 저장된 값이 비는 경우가 있어서)
  wb.calcProperties = { fullCalcOnLoad: true };

  const ws = wb.addWorksheet("예정공정표", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 8 as ExcelJS.PaperSize,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.8, bottom: 0.8, header: 0.4, footer: 0.4 },
    },
  });

  // 열 배치: A 대분류 표시 | B 이름 | C 보할 | D 금액·투입수 | E 단위 | 구간 P개 | 착수일차 | 완료일차 | 착수일 | 완료일 | 비고
  const firstP = 6;
  const lastP = firstP + P - 1;
  const cStart = lastP + 1;
  const cEnd = lastP + 2;
  const cFrom = lastP + 3;
  const cTo = lastP + 4;
  const cNote = lastP + 5;
  const lastCol = cNote;
  const A = (r: number, c: number) => ws.getCell(r, c);

  const nProc = processes.length;
  const laborNames = Object.keys(result.labor.byName);
  const equipNames = Object.keys(result.equipment.byName);

  // ── 행 배치 ──────────────────────────────────────────────
  const T1 = 1; // 제목
  const H = 3; // 머리글 3줄(3~5)
  const first = 6;
  const last = first + Math.max(nProc, 1) - 1;
  const tot = last + 1; // 합계
  const prog = last + 2; // 진도율(구간)
  const cum = last + 3; // 누계

  const T2 = cum + 3; // 인원·장비 표 제목
  const H2 = T2 + 2; // 머리글 3줄
  const locs = (plan.locations ?? []).filter((l) => l.name.trim() !== "" && l.startDay >= 1 && l.endDay >= l.startDay);
  const locFirst = H2 + 3;
  const eqFirst = locFirst + locs.length;
  const eqLast = eqFirst + Math.max(equipNames.length, 1) - 1;
  const eqSub = eqLast + 1;
  const lbFirst = eqSub + 1;
  const lbLast = lbFirst + Math.max(laborNames.length, 1) - 1;
  const lbSub = lbLast + 1;
  const lbAvg = lbSub + 1;
  const noteRow = lbAvg + 2;
  const printEnd = noteRow + 3;

  // 인쇄 영역 밖: 검산, 계산용 값
  const CK = printEnd + 2; // 검산 제목 행
  const HELP = CK + 9; // 계산용 값 제목 행
  const startCell = `$D$${HELP + 1}`; // 착공일
  const durCell = `$D$${HELP + 2}`; // 공사기간
  const rsRow = HELP + 5; // 구간 시작일
  const reRow = HELP + 6; // 구간 종료일
  const wdRow = HELP + 7; // 공기 내 작업일수

  const putRange = (r1: number, c1: number, r2: number, c2: number, value: ExcelJS.CellValue, o: StyleOpts) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    A(r1, c1).value = value;
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) style(A(r, c), o);
  };
  const headStyle: StyleOpts = { bold: true, fill: HEAD_FILL, align: "center" };

  // ── 위쪽: 공사예정공정표 ──────────────────────────────────
  ws.mergeCells(T1, 1, T1, lastCol);
  A(T1, 1).value = "예  정  공  정  표";
  A(T1, 1).font = font(true, 20);
  A(T1, 1).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(T1).height = 37.5;
  A(2, 1).value = `공사명 : ${input.projectName}`;
  A(2, 1).font = font(true, 10);

  const periodText = `공사기간 : ${dotDate(input.startDate as string)} ~ ${dotDate(result.completion)} (${input.durationDays}일)`;
  const periodHeader = (top: number) => {
    // 구간 머리글 3줄: (1) 공사기간, (2) 월, (3) 구간 끝 날짜
    putRange(top, firstP, top, lastP, periodText, headStyle);
    monthGroups(periods).forEach((g) => putRange(top + 1, firstP + g.from, top + 1, firstP + g.to, g.label, headStyle));
    periods.forEach((p, k) => {
      A(top + 2, firstP + k).value = Number(p.end.slice(8, 10));
      style(A(top + 2, firstP + k), headStyle);
    });
  };

  putRange(H, 1, H + 2, 2, "공    종", headStyle);
  putRange(H, 3, H + 2, 3, "보할 (%)", headStyle);
  putRange(H, 4, H + 2, 4, "순공사비 금 액(원)", headStyle);
  putRange(H, 5, H + 2, 5, "단 위", headStyle);
  periodHeader(H);
  putRange(H, cStart, H + 2, cStart, "착수 (일차)", headStyle);
  putRange(H, cEnd, H + 2, cEnd, "완료 (일차)", headStyle);
  putRange(H, cFrom, H + 2, cFrom, "착수일", headStyle);
  putRange(H, cTo, H + 2, cTo, "완료일", headStyle);
  putRange(H, cNote, H + 2, cNote, "주 요 공 정 내 용", headStyle);

  const sumD = `SUM($D$${first}:$D$${last})`;
  const sc = colName(cFrom);
  const ec = colName(cTo);
  processes.forEach((p, i) => {
    const r = first + i;
    const row = result.progress.rows[i];
    A(r, 2).value = p.amount === 0 ? `${p.name} (협조)` : p.name;
    A(r, 3).value = { formula: `IF(${sumD}=0,0,D${r}/${sumD}*100)`, result: row.weight } as ExcelJS.CellFormulaValue;
    A(r, 4).value = p.amount;
    A(r, 5).value = "식";
    row.byPeriod.forEach((v, k) => {
      const col = colName(firstP + k);
      A(r, firstP + k).value = {
        formula: `IF($C${r}=0,0,$C${r}*MAX(0,MIN($${ec}${r},${col}$${reRow})-MAX($${sc}${r},${col}$${rsRow})+1)/($${ec}${r}-$${sc}${r}+1))`,
        result: v,
      } as ExcelJS.CellFormulaValue;
    });
    A(r, cStart).value = p.startDay;
    A(r, cEnd).value = p.endDay;
    A(r, cFrom).value = { formula: `${startCell}+${colName(cStart)}${r}-1`, result: utcDate(addDaysStr(input.startDate as string, p.startDay - 1)) } as ExcelJS.CellFormulaValue;
    A(r, cTo).value = { formula: `${startCell}+${colName(cEnd)}${r}-1`, result: utcDate(addDaysStr(input.startDate as string, p.endDay - 1)) } as ExcelJS.CellFormulaValue;
    style(A(r, 1), {});
    style(A(r, 2), {});
    style(A(r, 3), { align: "right", numFmt: FMT_PCT });
    style(A(r, 4), { align: "right", numFmt: FMT_WON });
    style(A(r, 5), { align: "center" });
    for (let c = firstP; c <= lastP; c++) style(A(r, c), { align: "right", numFmt: FMT_PCT, border: "hair" });
    // 입력 칸: 착수·완료 일차 (파란 글자)
    style(A(r, cStart), { align: "center", fill: INPUT_FILL, color: "FF0000FF" });
    style(A(r, cEnd), { align: "center", fill: INPUT_FILL, color: "FF0000FF" });
    style(A(r, cFrom), { align: "center", numFmt: "yyyy-mm-dd" });
    style(A(r, cTo), { align: "center", numFmt: "yyyy-mm-dd" });
    A(r, cNote).value = plan.remarks?.[p.key]?.trim() ?? "";
    style(A(r, cNote), { size: 9 });
    ws.getRow(r).height = 21;
  });
  if (nProc > 0) {
    ws.mergeCells(first, 1, last, 1);
    A(first, 1).value = "공\n정";
    A(first, 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    A(first, 1).fill = HEAD_FILL;
    A(first, 1).font = font(true);
  }

  // 합계·진도율·누계
  const totalWeight = result.progress.rows.reduce((s, r) => s + r.weight, 0);
  const totalAmount = processes.reduce((s, p) => s + p.amount, 0);
  putRange(tot, 1, tot, 2, "합   계", { bold: true, fill: SUM_FILL, align: "center" });
  A(tot, 3).value = { formula: `SUM(C${first}:C${last})`, result: totalWeight } as ExcelJS.CellFormulaValue;
  A(tot, 4).value = { formula: `SUM(D${first}:D${last})`, result: totalAmount } as ExcelJS.CellFormulaValue;
  A(tot, 5).value = "식";
  style(A(tot, 3), { bold: true, fill: SUM_FILL, align: "right", numFmt: FMT_PCT });
  style(A(tot, 4), { bold: true, fill: SUM_FILL, align: "right", numFmt: FMT_WON });
  style(A(tot, 5), { bold: true, fill: SUM_FILL, align: "center" });
  putRange(prog, 1, prog, 2, "진 도 율 (%)", { bold: true, fill: SUM_FILL, align: "center" });
  A(prog, 5).value = "계";
  putRange(cum, 1, cum, 2, "", { bold: true, fill: SUM_FILL });
  A(cum, 5).value = "누계";
  for (const r of [prog, cum]) {
    style(A(r, 3), { fill: SUM_FILL });
    style(A(r, 4), { fill: SUM_FILL });
    style(A(r, 5), { bold: true, fill: SUM_FILL, align: "center" });
  }
  periods.forEach((_, k) => {
    const col = colName(firstP + k);
    A(prog, firstP + k).value = { formula: `SUM(${col}${first}:${col}${last})`, result: result.progress.periodTotals[k] } as ExcelJS.CellFormulaValue;
    A(cum, firstP + k).value = {
      formula: k === 0 ? `${col}${prog}` : `${colName(firstP + k - 1)}${cum}+${col}${prog}`,
      result: result.progress.cumulative[k],
    } as ExcelJS.CellFormulaValue;
    style(A(prog, firstP + k), { bold: true, fill: SUM_FILL, align: "right", numFmt: FMT_PCT, border: "hair" });
    style(A(cum, firstP + k), { bold: true, fill: SUM_FILL, align: "right", numFmt: "0.00", border: "hair" });
  });
  for (const r of [tot, prog, cum]) for (let c = cStart; c <= lastCol; c++) style(A(r, c), { fill: SUM_FILL });

  // 진도율이 있는 칸은 연한 색으로 칠한다(조건부 서식: 수정하면 따라 바뀐다)
  if (nProc > 0) {
    ws.addConditionalFormatting({
      ref: `${colName(firstP)}${first}:${colName(lastP)}${last}`,
      rules: [{ type: "expression", formulae: [`${colName(firstP)}${first}<>0`], priority: 1, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFF4B183" } } } }],
    });
  }

  // ── 아래쪽: 인원 및 장비투입계획표 ──────────────────────────
  ws.mergeCells(T2, 1, T2, lastCol);
  A(T2, 1).value = "인원 및 장비투입계획표";
  A(T2, 1).font = font(true, 20);
  A(T2, 1).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(T2).height = 37.5;
  A(T2 + 1, 1).value = `공사명 : ${input.projectName}`;
  A(T2 + 1, 1).font = font(true, 10);
  putRange(H2, 1, H2 + 2, 3, "구    분", headStyle);
  putRange(H2, 4, H2 + 2, 4, "투입수", headStyle);
  putRange(H2, 5, H2 + 2, 5, "단 위", headStyle);
  periodHeader(H2);
  putRange(H2, cStart, H2 + 2, cTo, "", headStyle);
  putRange(H2, cNote, H2 + 2, cNote, "비   고", headStyle);

  const methodNote = (rp: PlanDocData["result"]["labor"], n: string) => {
    const methods = [...new Set(rp.basisList.filter((b) => b.name === n).map((b) => b.method))];
    return methods.map((m) => (m === "내역서" ? "● 내역서" : `▲ ${m}`)).join(" · ");
  };
  const writeResource = (names: string[], rp: PlanDocData["result"]["labor"], firstRow: number, lastRow: number, unit: string, label: string) => {
    names.forEach((n, i) => {
      const r = firstRow + i;
      const assumed = rp.basisList.filter((b) => b.name === n).some((b) => b.method !== "내역서");
      A(r, 2).value = n;
      rp.byName[n].forEach((v, k) => (A(r, firstP + k).value = v));
      A(r, 4).value = { formula: `SUM(${colName(firstP)}${r}:${colName(lastP)}${r})`, result: rp.byName[n].reduce((s, v) => s + v, 0) } as ExcelJS.CellFormulaValue;
      A(r, 5).value = unit;
      A(r, cNote).value = methodNote(rp, n);
      style(A(r, 2), { fill: assumed ? ASSUME_FILL : undefined });
      style(A(r, 3), {});
      style(A(r, 4), { align: "right", numFmt: FMT_CNT });
      style(A(r, 5), { align: "center" });
      for (let c = firstP; c <= lastP; c++) style(A(r, c), { align: "right", numFmt: FMT_CNT, border: "hair" });
      for (let c = cStart; c <= cTo; c++) style(A(r, c), {});
      style(A(r, cNote), { size: 9 });
    });
    if (names.length === 0) {
      A(firstRow, 2).value = "(해당 없음)";
      for (let c = 2; c <= lastCol; c++) style(A(firstRow, c), {});
    }
    if (lastRow > firstRow) ws.mergeCells(firstRow, 1, lastRow, 1);
    A(firstRow, 1).value = label;
    A(firstRow, 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    A(firstRow, 1).fill = HEAD_FILL;
    A(firstRow, 1).font = font(true);
    A(firstRow, 1).border = thin;
  };
  const writeSub = (r: number, f: number, l: number, rp: PlanDocData["result"]["labor"], unit: string, hasNames: boolean) => {
    putRange(r, 1, r, 3, "소    계", { bold: true, fill: SUM_FILL, align: "center" });
    A(r, 4).value = { formula: hasNames ? `SUM(D${f}:D${l})` : "0", result: rp.total } as ExcelJS.CellFormulaValue;
    A(r, 5).value = unit;
    style(A(r, 4), { bold: true, fill: SUM_FILL, align: "right", numFmt: FMT_CNT });
    style(A(r, 5), { bold: true, fill: SUM_FILL, align: "center" });
    periods.forEach((_, k) => {
      const col = colName(firstP + k);
      A(r, firstP + k).value = { formula: hasNames ? `SUM(${col}${f}:${col}${l})` : "0", result: rp.periodTotals[k] } as ExcelJS.CellFormulaValue;
      style(A(r, firstP + k), { bold: true, fill: SUM_FILL, align: "right", numFmt: FMT_CNT, border: "hair" });
    });
    for (let c = cStart; c <= lastCol; c++) style(A(r, c), { fill: SUM_FILL });
  };
  // 위치별 작업 구간: 겹치는 구간 칸을 칠하고 비고에 일차를 적는다
  locs.forEach((l, i) => {
    const r = locFirst + i;
    const from = addDaysStr(input.startDate as string, l.startDay - 1);
    const to = addDaysStr(input.startDate as string, l.endDay - 1);
    A(r, 2).value = l.name.trim();
    style(A(r, 2), {});
    style(A(r, 3), {});
    style(A(r, 4), {});
    style(A(r, 5), {});
    periods.forEach((pd, k) => {
      const hit = pd.start <= to && pd.end >= from;
      style(A(r, firstP + k), { border: "hair", fill: hit ? solid("FFF4B183") : undefined });
    });
    for (let c = cStart; c <= cTo; c++) style(A(r, c), {});
    A(r, cNote).value = `${l.startDay}~${l.endDay}일차${l.remark.trim() ? ` · ${l.remark.trim()}` : ""}`;
    style(A(r, cNote), { size: 9 });
  });
  if (locs.length > 0) {
    if (locs.length > 1) ws.mergeCells(locFirst, 1, locFirst + locs.length - 1, 1);
    A(locFirst, 1).value = "위\n치\n별";
    A(locFirst, 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    A(locFirst, 1).fill = HEAD_FILL;
    A(locFirst, 1).font = font(true);
    A(locFirst, 1).border = thin;
  }
  writeResource(equipNames, result.equipment, eqFirst, eqLast, "대", "장\n비\n투\n입");
  writeSub(eqSub, eqFirst, eqLast, result.equipment, "대", equipNames.length > 0);
  writeResource(laborNames, result.labor, lbFirst, lbLast, "인", "인\n원\n투\n입");
  writeSub(lbSub, lbFirst, lbLast, result.labor, "인", laborNames.length > 0);
  // 일평균 투입인원
  putRange(lbAvg, 1, lbAvg, 3, "일평균 투입인원 (명/일)", { bold: true, fill: SUM_FILL, align: "center" });
  A(lbAvg, 5).value = "명";
  style(A(lbAvg, 4), { fill: SUM_FILL });
  style(A(lbAvg, 5), { bold: true, fill: SUM_FILL, align: "center" });
  periods.forEach((_, k) => {
    const col = colName(firstP + k);
    const v = result.dailyAverage[k];
    A(lbAvg, firstP + k).value = { formula: `IF(${col}$${wdRow}=0,"",${col}${lbSub}/${col}$${wdRow})`, result: v === null ? "" : v } as ExcelJS.CellFormulaValue;
    style(A(lbAvg, firstP + k), { bold: true, fill: SUM_FILL, align: "right", numFmt: "#,##0.0;-#,##0.0;;@", border: "hair" });
  });
  for (let c = cStart; c <= lastCol; c++) style(A(lbAvg, c), { fill: SUM_FILL });

  // 주)
  [
    "주) 1. 보할은 집계표 순공사비(재료비+노무비+경비) 기준이며, 구간 진도율은 공정 기간과 겹치는 달력일 수에 비례해 배분했습니다.",
    "     2. 근무일은 주 5일(월~금)에서 공휴일을 뺀 일수이며, 구간별 인원·장비는 작업일수에 비례해 정수로 배분하고 합이 총량과 같게 했습니다.",
    "     3. ● 내역서 수량은 그대로 사용했고, ▲ 환산·생산성·직접 지정(가정)은 노란 칸으로 표시했습니다. 가정치는 현장 상황에 따라 달라질 수 있으며 산정 근거는 '산정근거' 시트에 있습니다.",
  ].forEach((t, i) => {
    A(noteRow + i, 1).value = t;
    A(noteRow + i, 1).font = font(false, 9);
  });

  // ── 인쇄 영역 밖: 검산 ──────────────────────────────────
  A(CK, 2).value = "검 산 (내역서 집계표 대비)";
  A(CK, 2).font = font(true, 11);
  const amountDiff = totalAmount - plan.summaryTotalWon;
  const cumLast = result.progress.cumulative.at(-1) ?? 0;
  type CK2 = ExcelJS.CellFormulaValue | string | number;
  const BASIS = "'산정근거'";
  const bEnd = result.labor.basisList.length + result.equipment.basisList.length + 1; // 산정근거 시트의 마지막 자료 행
  const ck: [string, CK2, CK2][] = [
    ["공정표 순공사비 합계 (원)", { formula: `D${tot}`, result: totalAmount }, ""],
    ["집계표 순공사비 합계 (원)", plan.summaryTotalWon, ""],
    ["검산 (차이 = 0)", { formula: `D${CK + 1}-D${CK + 2}`, result: amountDiff }, { formula: `IF(D${CK + 3}=0,"통과","불일치")`, result: amountDiff === 0 ? "통과" : "불일치" }],
    ["진도율 누계 최종값 (= 100)", { formula: `ROUND(${colName(lastP)}${cum},2)`, result: round2(cumLast) }, { formula: `IF(D${CK + 4}=100,"통과","불일치")`, result: round2(cumLast) === 100 ? "통과" : "불일치" }],
    ["인원 연인원: 공정표 − 산정근거 (= 0)", { formula: `D${lbSub}-${BASIS}!E${bEnd + 2}`, result: 0 }, { formula: `IF(D${CK + 5}=0,"통과","불일치")`, result: "통과" }],
    ["장비 대·일: 공정표 − 산정근거 (= 0)", { formula: `D${eqSub}-${BASIS}!E${bEnd + 3}`, result: 0 }, { formula: `IF(D${CK + 6}=0,"통과","불일치")`, result: "통과" }],
  ];
  ck.forEach(([label, v, verdict], i) => {
    const r = CK + 1 + i;
    A(r, 2).value = label;
    A(r, 4).value = v as ExcelJS.CellValue;
    if (verdict !== "") A(r, 5).value = verdict as ExcelJS.CellValue;
    style(A(r, 2), { fill: HEAD_FILL });
    style(A(r, 3), { fill: HEAD_FILL });
    style(A(r, 4), { align: "right", numFmt: "#,##0" });
    style(A(r, 5), { align: "center" });
  });

  // ── 인쇄 영역 밖: 계산용 값 (고칠 수 있는 것은 착공일·공사기간뿐) ──
  A(HELP, 2).value = "※ 계산용 값 — 착공일과 공사기간만 고치세요. 구간표는 수정하지 마세요.";
  A(HELP, 2).font = font(true, 10);
  A(HELP + 1, 2).value = "착공일";
  A(HELP + 1, 4).value = utcDate(input.startDate as string);
  A(HELP + 2, 2).value = "공사기간(일)";
  A(HELP + 2, 4).value = input.durationDays;
  A(HELP + 3, 2).value = "준공예정일";
  A(HELP + 3, 4).value = { formula: `${startCell}+${durCell}-1`, result: utcDate(result.completion) } as ExcelJS.CellFormulaValue;
  for (const r of [HELP + 1, HELP + 2, HELP + 3]) {
    style(A(r, 2), { fill: HEAD_FILL });
    style(A(r, 3), { fill: HEAD_FILL });
  }
  style(A(HELP + 1, 4), { align: "right", numFmt: "yyyy-mm-dd", fill: INPUT_FILL, color: "FF0000FF" });
  style(A(HELP + 2, 4), { align: "right", fill: INPUT_FILL, color: "FF0000FF" });
  style(A(HELP + 3, 4), { align: "right", numFmt: "yyyy-mm-dd" });
  A(rsRow, 2).value = "구간 시작일";
  A(reRow, 2).value = "구간 종료일";
  A(wdRow, 2).value = "공기 내 작업일수";
  for (const r of [rsRow, reRow, wdRow]) for (let c = 2; c <= 5; c++) style(A(r, c), { fill: HEAD_FILL });
  periods.forEach((p, k) => {
    A(rsRow, firstP + k).value = utcDate(p.start);
    A(reRow, firstP + k).value = utcDate(p.end);
    A(wdRow, firstP + k).value = result.workdays[k];
    style(A(rsRow, firstP + k), { align: "center", numFmt: "yyyy-mm-dd", border: "hair" });
    style(A(reRow, firstP + k), { align: "center", numFmt: "yyyy-mm-dd", border: "hair" });
    style(A(wdRow, firstP + k), { align: "right", border: "hair" });
  });

  // 열 너비·인쇄 영역
  [4.5, 31, 7.5, 14, 4.5].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = firstP; c <= lastP; c++) ws.getColumn(c).width = 10;
  [cStart, cEnd].forEach((c) => (ws.getColumn(c).width = 7));
  [cFrom, cTo].forEach((c) => (ws.getColumn(c).width = 11));
  ws.getColumn(cNote).width = 40;
  ws.pageSetup.printArea = `A1:${colName(lastCol)}${printEnd}`;

  // ───── 시트 2: 산정근거 ──────────────────────────────────
  const wbasis = wb.addWorksheet("산정근거");
  ["구분", "공정", "직종·장비", "산정 방식", "수량(인일·대·일)", "근거"].forEach((t, i) => {
    wbasis.getCell(1, i + 1).value = t;
    style(wbasis.getCell(1, i + 1), headStyle);
  });
  const nameOf = (key: string) => processes.find((p) => p.key === key)?.name ?? key;
  const basis = [
    ...result.labor.basisList.map((b) => ({ kind: "인원", ...b })),
    ...result.equipment.basisList.map((b) => ({ kind: "장비", ...b })),
  ];
  basis.forEach((b, i) => {
    const r = i + 2;
    const assumed = b.method !== "내역서";
    [b.kind, nameOf(b.processKey), b.name, assumed ? `▲ ${b.method}` : "● 내역서", b.manDays, b.basis].forEach((v, c) => {
      wbasis.getCell(r, c + 1).value = v;
      style(wbasis.getCell(r, c + 1), { align: c === 4 ? "right" : "left", fill: assumed ? ASSUME_FILL : undefined, numFmt: c === 4 ? "#,##0" : undefined });
    });
  });
  const sumif = (kind: string) => `SUMIF($A$2:$A$${Math.max(bEnd, 2)},"${kind}",$E$2:$E$${Math.max(bEnd, 2)})`;
  wbasis.getCell(bEnd + 2, 1).value = "인원 합계(인일)";
  wbasis.getCell(bEnd + 2, 5).value = { formula: sumif("인원"), result: result.labor.total } as ExcelJS.CellFormulaValue;
  wbasis.getCell(bEnd + 3, 1).value = "장비 합계(대·일)";
  wbasis.getCell(bEnd + 3, 5).value = { formula: sumif("장비"), result: result.equipment.total } as ExcelJS.CellFormulaValue;
  [bEnd + 2, bEnd + 3].forEach((r) => {
    style(wbasis.getCell(r, 1), { bold: true, fill: HEAD_FILL });
    style(wbasis.getCell(r, 5), { bold: true, align: "right", numFmt: "#,##0" });
  });
  [10, 30, 26, 12, 16, 70].forEach((w, i) => (wbasis.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

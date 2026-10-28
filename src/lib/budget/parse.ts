// 내역서(xlsx) 파싱 (SRS SR-IN-03~06, 08)
// 실제 조달청 내역서 양식은 공고마다 다르다. 머리글 이름으로 열 위치를 자동 인식하고,
// 인식하지 못하면 시트명·열 위치를 지정(열 매핑)해서 파싱한다.
// 주의: 아래 인식 규칙은 합성 파일로만 시험했다. 실제 내역서가 생기면 testdata/로 보강한다.

import { parseUnitCosts, unitCostKey } from "./unitcost";
import ExcelJS from "exceljs";
import { isOleXls, isZip, xlsToWorkbook } from "./xls";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export class BudgetFileError extends Error {}

export type SheetMapping = {
  sheet: string;
  /** 머리글 행 번호(1부터) */
  headerRow: number;
  /** 필드 → 열 번호(1부터) */
  columns: Partial<Record<string, number>>;
};

export type LayoutMapping = {
  summary: SheetMapping;
  detail: SheetMapping;
  /** 내역서가 공종별로 시트가 나뉜 경우(내역서(토목)·(건축)·(설비) 등)의 나머지 시트 */
  extraDetails?: SheetMapping[];
};

export type SummaryRow = {
  code: string;
  name: string;
  material: number;
  labor: number;
  expense: number;
  total: number;
};
export type LaborRow = {
  code: string;
  trade: string;
  quantity: number;
  wage: number;
  sectionId?: string;
  /** 일위대가(단가산출 시트)로 계산한 행이면 '일위대가' */
  source?: "일위대가";
};
export type EquipmentRow = { code: string; name: string; hours: number; sectionId?: string };

/**
 * 내역서의 구조 단위(공종 제목·소분류 그룹·개요 항목). 공정을 어디까지 나눌지 정하는 재료다.
 * 금액은 그 아래 품목 행의 합이다(하위 단위의 금액이 상위 단위에 모두 들어간다).
 */
export type ParsedSection = {
  id: string;
  /** 소속 공종의 집계표 코드 */
  code: string;
  name: string;
  /** 0이 공종 제목(또는 시트의 맨 위 개요), 1, 2…는 그 아래 단계. 시트의 가상 뿌리는 -1 */
  depth: number;
  parentId: string | null;
  /** 순공사비 밖 항목(품질관리비·안전관리비처럼 내역서 끝에 '■'로 따로 적힌 것). 시트 합계에 들어가지 않는다 */
  outside?: boolean;
  material: number;
  labor: number;
  expense: number;
  total: number;
};

export type ParsedBudget = {
  summary: SummaryRow[];
  /** 공종 합계의 합 = 순공사비 */
  summaryTotal: number;
  /** 집계표의 '합계' 행 값. 없으면 null */
  grandTotal: number | null;
  summaryTotalMatchesGrandTotal: boolean | null;
  labor: LaborRow[];
  equipment: EquipmentRow[];
  /** 내역서 구조 단위. 이전에 저장된 공사에는 없을 수 있다 */
  sections?: ParsedSection[];
  warnings: string[];
};

export type DetectResult =
  | { ok: true; mapping: LayoutMapping }
  | { ok: false; reason: string; sheetNames: string[] };

// ── 업로드·열기 ──────────────────────────────────────────────

export function checkUpload(file: {
  name: string;
  size: number;
}): { ok: true } | { ok: false; reason: string } {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return { ok: false, reason: "엑셀 파일(.xlsx, .xls)만 올릴 수 있습니다." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "파일이 20MB를 넘습니다." };
  }
  return { ok: true };
}

export async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  // 확장자가 아니라 파일 내용으로 구형(.xls)인지 알아본다
  if (isOleXls(bytes)) {
    try {
      return xlsToWorkbook(bytes);
    } catch {
      throw new BudgetFileError(
        "구형 엑셀 파일(.xls)을 열 수 없습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다. 암호를 풀고 다시 저장해서 올려 주세요.",
      );
    }
  }
  // .xlsx는 빠른 SheetJS 경로를 먼저 쓰고, 읽지 못하면 ExcelJS로 다시 시도한다
  if (isZip(bytes)) {
    try {
      const fast = xlsToWorkbook(bytes);
      if (fast.worksheets.length > 0) return fast;
    } catch {
      // 아래 ExcelJS 경로가 같은 파일을 다시 읽고, 안 되면 오류를 낸다
    }
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch {
    throw new BudgetFileError(
      "파일을 열 수 없습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다. 암호를 풀고 다시 저장해서 올려 주세요.",
    );
  }
  return wb;
}

// ── 셀 값 읽기 ──────────────────────────────────────────────

function rawValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value as unknown;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return o.result;
    if ("richText" in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((t) => t.text).join("");
    }
    if ("text" in o) return o.text;
  }
  return v;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.replace(/[,\s]/g, "");
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

const norm = (s: string) => s.replace(/\s+/g, "");

/** 구조 단위 이름: 앞 번호('Ⅰ.', '1.')는 남기고 공백만 정리한다 */
const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** '1. 토      공' → '토 공': 앞 번호를 떼고 글자 사이 공백은 하나로 줄인다 */
const cleanName = (s: string) => s.replace(/^\d+(?:\.\d+)*\s*[.)]\s*/, "").replace(/\s+/g, " ").trim() || s.trim();

// ── 자동 인식 ──────────────────────────────────────────────

const SUMMARY_FIELDS: Record<string, string[]> = {
  code: ["공종코드", "코드", "공종번호"],
  name: ["공종명", "공종", "명칭", "품명"],
  material: ["재료비"],
  labor: ["노무비"],
  expense: ["경비"],
  total: ["합계", "총액", "금액", "계"],
};
const DETAIL_FIELDS: Record<string, string[]> = {
  // '코드' 열은 품목코드(MM066683724 등)일 수 있어 공종코드로 보지 않는다. '공종' 열은 값을 보고 파싱 때 판단한다
  code: ["공종코드", "공종번호"],
  name: ["품명", "명칭", "공종"], // 명칭 열이 없는 양식은 공종 열에 품명이 들어 있다
  spec: ["규격"],
  unit: ["단위"],
  quantity: ["수량"],
  // STmate 형식: 머리글 윗줄이 합계·노무비·재료비·경비로 나뉘고 아랫줄이 단가·금액이라, 노무비 칸의 왼쪽 열이 노임단가
  wage: ["노임단가", "노무비단가", "노임", "노무비", "단가"],
};

/**
 * 머리글이 두 줄인 양식(윗줄: 총액·노무비·재료비·경비, 아랫줄: 단가·금액)을 처리한다.
 * 아랫줄이 있으면 금액 열(단가 오른쪽)을 가리키도록 열을 옮기고 머리글 행을 아랫줄로 바꾼다.
 */
function refineSubHeader(ws: ExcelJS.Worksheet, m: SheetMapping): SheetMapping {
  const sub = ws.getRow(m.headerRow + 1);
  const textAt = (c: number) => norm(toText(rawValue(sub.getCell(c))));
  let hasSub = false;
  sub.eachCell({ includeEmpty: false }, (cell) => {
    const t = norm(toText(rawValue(cell)));
    if (t === "단가" || t === "금액") hasSub = true;
  });
  if (!hasSub) return m;
  const columns = { ...m.columns };
  for (const f of ["material", "labor", "expense", "total"]) {
    const c = columns[f];
    if (c !== undefined && textAt(c) === "단가" && textAt(c + 1) === "금액") columns[f] = c + 1;
  }
  // 내역서용: 윗줄의 재료비·노무비·경비·합계 머리글 아래 '금액' 열을 a_* 로 기록한다(구조 단위 금액 합산에 쓴다)
  const top = new Map<string, number>();
  ws.getRow(m.headerRow).eachCell({ includeEmpty: false }, (cell, col) => {
    const t = norm(toText(rawValue(cell)));
    if (t !== "" && !top.has(t)) top.set(t, col);
  });
  for (const [label, key] of [["재료비", "a_material"], ["노무비", "a_labor"], ["경비", "a_expense"], ["합계", "a_total"]] as const) {
    const c = top.get(label);
    if (c !== undefined && textAt(c) === "단가" && textAt(c + 1) === "금액") columns[key] = c + 1;
  }
  return { ...m, headerRow: m.headerRow + 1, columns };
}

function findHeader(
  ws: ExcelJS.Worksheet,
  fields: Record<string, string[]>,
  required: string[],
): SheetMapping | null {
  const maxRow = Math.min(ws.rowCount, 40);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const texts = new Map<string, number>(); // 머리글 글자 → 가장 왼쪽 열
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = norm(toText(rawValue(cell)));
      if (text !== "" && !texts.has(text)) texts.set(text, col);
    });
    // 이름 목록의 앞쪽일수록 우선한다(예: '명칭'이 있으면 '공종'보다 먼저 쓴다)
    const columns: Record<string, number> = {};
    for (const [field, names] of Object.entries(fields)) {
      for (const n of names) {
        const col = texts.get(n);
        if (col !== undefined) {
          columns[field] = col;
          break;
        }
      }
    }
    if (required.every((f) => columns[f] !== undefined)) {
      return refineSubHeader(ws, { sheet: ws.name, headerRow: r, columns });
    }
  }
  return null;
}

export function detectLayout(wb: ExcelJS.Workbook): DetectResult {
  const sheetNames = wb.worksheets.map((w) => w.name);
  const visible = (w: ExcelJS.Worksheet) => w.state === "visible";
  const summarySheet =
    wb.worksheets.find((w) => visible(w) && norm(w.name).includes("집계표")) ??
    wb.worksheets.find((w) => norm(w.name).includes("집계표"));
  if (!summarySheet) {
    return { ok: false, sheetNames, reason: "시트 '집계표'를 찾지 못했습니다. 시트명과 열 위치를 지정해 주세요." };
  }
  // 숨겨진 시트와 '총괄내역서'(집계용)는 상세 내역서가 아니다
  const detailSheets = wb.worksheets.filter(
    (w) => visible(w) && norm(w.name).includes("내역서") && !norm(w.name).includes("집계") && !norm(w.name).includes("총괄"),
  );
  const detailSheet = detailSheets[0];
  if (!detailSheet) {
    return { ok: false, sheetNames, reason: "시트 '내역서'를 찾지 못했습니다. 시트명과 열 위치를 지정해 주세요." };
  }
  const summary = findHeader(summarySheet, SUMMARY_FIELDS, ["name", "total"]);
  if (!summary || summary.columns.labor === undefined) {
    return {
      ok: false,
      sheetNames,
      reason: "집계표에서 머리글(공종·재료비·노무비·경비·합계)을 찾지 못했습니다. 열 위치를 지정해 주세요.",
    };
  }
  const detail = findHeader(detailSheet, DETAIL_FIELDS, ["name", "unit", "quantity"]);
  if (!detail) {
    return {
      ok: false,
      sheetNames,
      reason: "내역서에서 머리글(품명·단위·수량)을 찾지 못했습니다. 열 위치를 지정해 주세요.",
    };
  }
  // 공종별로 나뉜 나머지 내역서 시트도 같은 방식으로 읽는다(머리글을 못 찾는 시트는 건너뛴다)
  const extraDetails = detailSheets
    .slice(1)
    .map((w) => findHeader(w, DETAIL_FIELDS, ["name", "unit", "quantity"]))
    .filter((m): m is SheetMapping => m !== null);
  return { ok: true, mapping: { summary, detail, ...(extraDetails.length > 0 ? { extraDetails } : {}) } };
}

// ── 파싱 ────────────────────────────────────────────────────

// 'Ⅰ. 순공사비', 'Ⅱ. 관급자재비'처럼 로마 숫자로 시작하는 제목
const ROMAN = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+|(?:I{1,3}|IV|VI{0,3}|IX|X)\s*(?=[.．]))\s*[.．]?/;
const GRAND_TOTAL_NAMES = ["합계", "총계", "계"];
/** '[ 합 계 ]' → '합계' */
const normTotalName = (n: string) => norm(n).replace(/[[\]()]/g, "");
// 이름 앞에 공종코드가 붙은 집계표('0101 장비설치공사', '010301 위생기구설치공사')
const CODE_IN_NAME = /^(\d{2,})\s+(\S.*)$/;
const LABOR_UNITS = ["인", "인일", "인/일"];
const EQUIPMENT_UNITS = ["HR", "H", "시간"];

function sheetOf(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new BudgetFileError(`시트 '${name}'가 없습니다.`);
  return ws;
}

function readCol(ws: ExcelJS.Worksheet, r: number, col: number | undefined): unknown {
  return col === undefined ? undefined : rawValue(ws.getRow(r).getCell(col));
}

export function parseBudget(wb: ExcelJS.Workbook, mapping: LayoutMapping): ParsedBudget {
  const warnings: string[] = [];

  // 집계표
  const sws = sheetOf(wb, mapping.summary.sheet);
  const sc = mapping.summary.columns;
  const summary: SummaryRow[] = [];
  let grandTotal: number | null = null;
  // 'Ⅰ. 순공사비', 'Ⅱ. 관급자재비'처럼 로마 숫자로 나뉜 집계표는 '순공사비' 구역의 공종만 쓰고
  // 그 구역 제목 행의 값을 합계로 본다(제목 행은 아래 공종의 합이라 같이 더하면 두 번 계산된다).
  const isSection = (n: string) => ROMAN.test(n.trim());
  let sectionMode = false;
  for (let r = mapping.summary.headerRow + 1; r <= sws.rowCount; r++) {
    if (isSection(toText(readCol(sws, r, sc.name)))) {
      sectionMode = true;
      break;
    }
  }
  let inNetSection = !sectionMode;
  let codeFromName = false;
  for (let r = mapping.summary.headerRow + 1; r <= sws.rowCount; r++) {
    const name = toText(readCol(sws, r, sc.name));
    const total = toNumber(readCol(sws, r, sc.total));
    if (name === "" && total === null) continue;
    // 파일 끝 표시(End Of File, 마지막열은 지우지 마시오)처럼 금액이 하나도 없는 줄은 공종이 아니다
    if (
      total === null &&
      toNumber(readCol(sws, r, sc.material)) === null &&
      toNumber(readCol(sws, r, sc.labor)) === null &&
      toNumber(readCol(sws, r, sc.expense)) === null &&
      !isSection(name)
    ) {
      continue;
    }
    if (sectionMode && isSection(name)) {
      inNetSection = name.includes("순공사비");
      if (inNetSection) grandTotal = total;
      continue;
    }
    if (!inNetSection) continue;
    // '순공사비' 소계 행이 나오면 거기까지가 공종이고, 아래는 간접노무비·경비·부가세 같은 원가 항목이다
    if (!sectionMode && norm(name) === "순공사비") {
      grandTotal = total;
      break;
    }
    if (GRAND_TOTAL_NAMES.includes(normTotalName(name))) {
      grandTotal = total;
      continue;
    }
    if (name === "") continue;
    const inName = sc.code === undefined ? CODE_IN_NAME.exec(name) : null;
    if (inName) codeFromName = true;
    const row: SummaryRow = {
      // 공종코드 열이 없는 양식은 이름 앞의 코드를, 그것도 없으면 순서대로 S1, S2…를 쓴다(공정·노무·장비를 잇는 열쇠)
      code: sc.code !== undefined ? toText(readCol(sws, r, sc.code)) : inName ? inName[1] : `S${summary.length + 1}`,
      name: cleanName(inName ? inName[2] : name),
      material: toNumber(readCol(sws, r, sc.material)) ?? 0,
      labor: toNumber(readCol(sws, r, sc.labor)) ?? 0,
      expense: toNumber(readCol(sws, r, sc.expense)) ?? 0,
      total: total ?? 0,
    };
    const parts = row.material + row.labor + row.expense;
    if (sc.material !== undefined && sc.labor !== undefined && sc.expense !== undefined && parts !== row.total) {
      warnings.push(
        `공종 '${row.name}': 재료비+노무비+경비(${parts.toLocaleString("ko-KR")})와 합계(${row.total.toLocaleString("ko-KR")})가 다릅니다.`,
      );
    }
    summary.push(row);
  }
  // 코드가 이름에 붙은 집계표('01 기계설비공사' ⊃ '0101' ⊃ '010301')는 상위 항목이 하위 합이라 같이 더하면 두 번 계산된다
  if (codeFromName) {
    const codes = summary.map((r) => r.code);
    const isParent = (c: string) => /^\d+$/.test(c) && codes.some((o) => o !== c && /^\d+$/.test(o) && o.startsWith(c));
    for (let i = summary.length - 1; i >= 0; i--) if (isParent(summary[i].code)) summary.splice(i, 1);
  }
  const summaryTotal = summary.reduce((s, r) => s + r.total, 0);
  const matches = grandTotal === null ? null : grandTotal === summaryTotal;
  if (matches === false) {
    warnings.push(
      `공종 합계의 합(${summaryTotal.toLocaleString("ko-KR")})이 집계표의 합계 행(${(grandTotal ?? 0).toLocaleString("ko-KR")})과 다릅니다.`,
    );
  }

  // 내역서: 노무 행(단위 인)과 장비 행(단위 HR). 공종별로 시트가 나뉜 경우 모두 읽는다.
  const labor: LaborRow[] = [];
  const equipment: EquipmentRow[] = [];
  const sections: ParsedSection[] = [];
  const items: { code: string; name: string; spec: string; qty: number; sectionId?: string }[] = [];
  const detailSheets = [mapping.detail, ...(mapping.extraDetails ?? [])];
  for (const [sheetNo, dm] of detailSheets.entries()) {
    const dws = sheetOf(wb, dm.sheet);
    const dc = dm.columns;
    // 공종코드 열이 없으면 시트명의 괄호 안 공종(예: 내역서(토목))로 집계표 공종을 찾는다
    const hint = /[(（]([^)）]+)[)）]/.exec(dm.sheet)?.[1]?.trim();
    const sheetCode = hint ? (summary.find((x) => norm(x.name).includes(norm(hint)))?.code ?? "") : "";
    // 공종코드 열: 머리글로 지정됐으면 그 열, 아니면 '공종' 열의 값이 집계표 공종코드와 대부분 맞을 때만 쓴다
    let codeCol = dc.code;
    if (codeCol === undefined) {
      const known = new Set(summary.map((x) => x.code));
      const head = dws.getRow(dm.headerRow);
      for (let c = 1; c <= (dc.name ?? 1) + 2 && codeCol === undefined; c++) {
        if (c === dc.name) continue;
        const t = norm(toText(rawValue(head.getCell(c))));
        const above = norm(toText(rawValue(dws.getRow(Math.max(1, dm.headerRow - 1)).getCell(c))));
        if (t !== "공종" && above !== "공종") continue;
        let hit = 0;
        let seen = 0;
        for (let r = dm.headerRow + 1; r <= Math.min(dws.rowCount, dm.headerRow + 400); r++) {
          const v = toText(rawValue(dws.getRow(r).getCell(c)));
          if (v === "") continue;
          seen++;
          if (known.has(v)) hit++;
        }
        if (seen > 0 && hit / seen >= 0.6) codeCol = c;
      }
    }
    let currentCode = sheetCode;

    // 공종 제목 행('0105 냉난방기설치공사')이 있는 시트는 제목이 맨 위 단위이고, 없는 시트는 시트 전체가 하나의 뿌리 단위다
    const isBlankQty = (q: number | null) => q === null || q === 0;
    let hasTitles = false;
    for (let r = dm.headerRow + 1; r <= dws.rowCount && !hasTitles; r++) {
      const n = toText(readCol(dws, r, dc.name)).replace(/^[.\s]+/, "");
      if (n === "" || !CODE_IN_NAME.test(n)) continue;
      if (isBlankQty(toNumber(readCol(dws, r, dc.quantity))) && toText(readCol(dws, r, dc.unit)) === "") hasTitles = true;
    }
    const stack: ParsedSection[] = [];
    const newSection = (id: string, code: string, name: string, depth: number, outside = false): ParsedSection => {
      const sec: ParsedSection = { id, code, name, depth, parentId: stack.at(-1)?.id ?? null, ...(outside ? { outside } : {}), material: 0, labor: 0, expense: 0, total: 0 };
      sections.push(sec);
      stack.push(sec);
      return sec;
    };
    let rootSec: ParsedSection | null = null;
    if (!hasTitles) {
      const rootName = summary.find((x) => x.code === sheetCode)?.name ?? dm.sheet;
      rootSec = newSection(`${sheetNo}:root`, sheetCode, rootName, -1);
    }
    // 개요 시트의 첫 열 구분 표시: □ = 맨 위 합계, 로마 숫자 = 공종, ■ = 순공사비 밖 항목
    const markerCol = (dc.name ?? 1) > 1 ? (dc.name as number) - 1 : undefined;
    const amountOf = (r: number, key: string) => toNumber(readCol(dws, r, dc[key])) ?? 0;

    for (let r = dm.headerRow + 1; r <= dws.rowCount; r++) {
      const rawName = toText(readCol(dws, r, dc.name));
      const name = rawName.replace(/^[.\s]+/, "");
      if (name === "") continue;

      // 구조 단위(제목·그룹·개요) 행: 수량이 없거나 0이고 단위가 없다(개요 행은 Y). 품목이 아니다.
      const unit0 = toText(readCol(dws, r, dc.unit));
      const qty0 = toNumber(readCol(dws, r, dc.quantity));
      if (isBlankQty(qty0) && (unit0 === "" || unit0.toUpperCase() === "Y")) {
        if (norm(name).includes("합계") && unit0 === "") {
          if (hasTitles) stack.length = 0; // 공종 끝의 [ 합 계 ] 줄
          continue;
        }
        const marker = !hasTitles && markerCol !== undefined ? toText(readCol(dws, r, markerCol)) : "";
        if (name.startsWith("□") || marker === "□") continue; // '□ 순공사비' 같은 맨 위 합계 표시
        const outside = marker === "■";
        // 집계표 공종과 이름이 같은 구분 행 아래는 그 공종에 속한다(한 시트에 공종이 이어진 내역서)
        if (codeCol === undefined) {
          const sec = summary.find((x) => norm(x.name) === norm(cleanName(name)));
          if (sec) currentCode = sec.code;
        }
        const titleM = hasTitles && unit0 === "" ? CODE_IN_NAME.exec(name) : null;
        const dots = /^\.+/.exec(rawName)?.[0].length ?? 0;
        const depth = titleM ? 0 : hasTitles ? 1 + dots : outside || ROMAN.test(marker) || ROMAN.test(name) ? 0 : 1 + dots;
        if (outside) stack.length = 0; // 순공사비 밖 항목은 시트 뿌리에 속하지 않는다
        while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
        if (!outside && stack.length === 0 && rootSec) stack.push(rootSec);
        if (titleM) {
          newSection(`${sheetNo}:${r}`, titleM[1], tidy(titleM[2]), 0);
        } else if (stack.length > 0 || !hasTitles) {
          newSection(`${sheetNo}:${r}`, hasTitles ? (stack[0]?.code ?? sheetCode) : currentCode, tidy(name), depth, outside);
        }
        continue;
      }
      // 한 시트에 공종이 이어진 내역서: 집계표 공종과 이름이 같은 구분 행(예: '1. 토 공') 아래는 그 공종에 속한다
      if (codeCol === undefined) {
        const sec = summary.find((x) => norm(x.name) === norm(cleanName(name)));
        if (sec) currentCode = sec.code;
      }
      const unit = unit0;
      const qty = qty0;
      if (qty === null) continue;
      // 품목 금액을 이 행이 속한 모든 구조 단위에 더한다
      if (stack.length > 0) {
        const mat = amountOf(r, "a_material");
        const lab = amountOf(r, "a_labor");
        const exp = amountOf(r, "a_expense");
        const hasParts = dc.a_material !== undefined && dc.a_labor !== undefined && dc.a_expense !== undefined;
        const tot = hasParts ? mat + lab + exp : amountOf(r, "a_total");
        for (const sec of stack) {
          sec.material += mat;
          sec.labor += lab;
          sec.expense += exp;
          sec.total += tot;
        }
      }
      const sectionId = stack.at(-1)?.id;
      const code = codeCol === undefined ? currentCode : toText(readCol(dws, r, codeCol)) || currentCode;
      const spec = toText(readCol(dws, r, dc.spec));
      if (LABOR_UNITS.includes(unit)) {
        // 조달청 내역서의 노무 행은 직종이 규격 칸에 들어 있다(노무비 | 보통인부 | 인 | 14, 코튼망사발열체 설치 | 내선전공 | 인 | 1).
        // 규격이 비어 있으면 품명이 직종이다.
        const trade = spec !== "" ? spec : name;
        labor.push({ code, trade, quantity: qty, wage: toNumber(readCol(dws, r, dc.wage)) ?? 0, ...(sectionId ? { sectionId } : {}) });
      } else if (!EQUIPMENT_UNITS.includes(unit.toUpperCase())) {
        if (qty > 0) items.push({ code, name, spec, qty, ...(sectionId ? { sectionId } : {}) });
      } else {
        // 장비 행은 이름과 규격을 함께 쓴다(크레인(타이어) 100ton)
        equipment.push({ code, name: spec !== "" ? `${name} ${spec}` : name, hours: qty, ...(sectionId ? { sectionId } : {}) });
      }
    }
  }
  // 노무 행이 없는 내역서(단가 한 줄짜리)는 단가산출 시트의 일위대가로 품목별 노무 인일을 계산한다
  if (labor.length === 0) {
    const costs = parseUnitCosts(wb);
    if (costs.size > 0) {
      const sum = new Map<string, LaborRow>();
      let matched = 0;
      for (const it of items) {
        const lines = costs.get(unitCostKey(it.name, it.spec));
        if (!lines) continue;
        matched++;
        for (const l of lines) {
          const k = `${it.code}|${it.sectionId ?? ""}|${l.trade}`;
          const prev = sum.get(k);
          const q = it.qty * l.perUnit;
          if (prev) prev.quantity += q;
          else sum.set(k, { code: it.code, trade: l.trade, quantity: q, wage: l.wage, source: "일위대가", ...(it.sectionId ? { sectionId: it.sectionId } : {}) });
        }
      }
      labor.push(...sum.values());
      if (labor.length > 0) {
        warnings.push(`일위대가(단가산출)에서 노무 인일을 계산했습니다 (품목 ${matched}/${items.length}개 일치, 직종 ${new Set(labor.map((l) => l.trade)).size}개). 장비 동반 노무는 장비 가동시간÷8을 건설기계운전사 인일로 환산해 넣었으며, 보조 인력은 일위대가에 직종이 적힌 경우만 포함됩니다.`);
      }
    }
  }
  if (labor.length === 0) {
    warnings.push("내역서에 단위가 '인'인 노무 행이 없습니다. 노무 상세(일위대가)가 빠진 내역서라 인원 계획은 따로 정해야 합니다.");
  }

  return { summary, summaryTotal, grandTotal, summaryTotalMatchesGrandTotal: matches, labor, equipment, sections, warnings };
}

// 일위대가(단가산출 시트)에서 단위당 직종별 노무 인일을 읽는다.
// 단가산출 시트는 호표마다 '산근 1 호표 ：흙 쌓 기 (노상) ㎥ 당' 머리줄 아래에
// '보통인부 : 171,037 * 0.08 인 / 10 ㎡ = 1,368.2' 같은 글 줄을 둔다.
// 줄의 금액(= 단위당 노무비)을 줄 안의 노임단가로 나누면 단위당 인일이 된다.

import type ExcelJS from "exceljs";

export type UnitLabor = { trade: string; wage: number; perUnit: number };

/** 호표 제목(공백 없앤 '품명(규격)') → 단위당 직종별 노무 */
export type UnitCosts = Map<string, UnitLabor[]>;

const MIN_WAGE = 50_000; // 공구손료 같은 줄(659.1 * 3%)을 노임단가 줄로 오인하지 않기 위한 하한
const NOT_TRADES = /재료비|노무비|경비|손료|잡재료|소계|합계|공구/;

const norm = (s: string) => s.replace(/\s+/g, "").replace(/：/g, ":").replace(/×/g, "x").replace(/[Xx]/g, "x");
const EQUIPMENT_LIKE = /[0-9]|㎥|㎡|ℓ|\//; // 규격이 붙은 장비명(굴착기(0.2㎡))은 직종이 아니다

function text(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return String(o.result ?? "").trim();
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("").trim();
    if ("text" in o) return String(o.text ?? "").trim();
  }
  return String(v).trim();
}

function num(cell: ExcelJS.Cell): number | null {
  const v = cell.value as unknown;
  const x = v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

export function findUnitCostSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return wb.worksheets.find((w) => /단가산출|일위대가/.test(w.name));
}

const HEADER = /^산근\s*\d+\s*호표\s*[：:]\s*(.+?)\s*\S+\s*당\s*$/;
// 장비 동반 노무: '노무비 : 58,296 / Q1 = 898.7' (장비 1시간당 운전 노무비 ÷ 시간당 작업량).
// 금액 ÷ 시간당 노무비 = 단위당 장비 가동 시간, 8시간 = 운전원 1인일
const MACHINE_LINE = /^\s*노\s*무\s*비\s*[:：]\s*([\d,]+(?:\.\d+)?)\s*\//;
export const OPERATOR = "건설기계운전사";
const HOURS_PER_DAY = 8;
// '직종 : 노임단가 * ...' (앞에 '1)' 같은 번호가 붙기도 한다)
const LINE = /^\s*(?:\d+\)\s*)?([^:：]+?)\s*[:：]\s*([\d,]+(?:\.\d+)?)\s*[*×]/;

/** 노임단가 시트의 직종명 → 적용단가(단위가 '인'인 줄). 시트가 없으면 null */
function wageTrades(wb: ExcelJS.Workbook): Map<string, number> | null {
  const ws = wb.worksheets.find((w) => /노임/.test(w.name));
  if (!ws) return null;
  const map = new Map<string, number>();
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (text(row.getCell(3)) === "인" && text(row.getCell(2)) !== "") map.set(norm(text(row.getCell(2))), num(row.getCell(11)) ?? num(row.getCell(9)) ?? 0);
  }
  return map.size > 0 ? map : null;
}

export function parseUnitCosts(wb: ExcelJS.Workbook): UnitCosts {
  const out: UnitCosts = new Map();
  const ws = findUnitCostSheet(wb);
  if (!ws) return out;
  const known = wageTrades(wb);

  let current: Map<string, UnitLabor> | null = null;
  let key = "";
  const flush = () => {
    if (current && key !== "" && current.size > 0) out.set(key, [...current.values()]);
  };
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const head = HEADER.exec(text(row.getCell(1)));
    if (head) {
      flush();
      key = norm(head[1]);
      current = new Map();
      continue;
    }
    if (!current) continue;
    const machine = MACHINE_LINE.exec(text(row.getCell(2)));
    if (machine) {
      const hourly = Number(machine[1].replace(/,/g, ""));
      const amount = num(row.getCell(5));
      const opWage = known?.get(OPERATOR);
      if (opWage && hourly > 0 && amount !== null && amount > 0) {
        const prev = current.get(OPERATOR);
        current.set(OPERATOR, { trade: OPERATOR, wage: opWage, perUnit: (prev?.perUnit ?? 0) + amount / hourly / HOURS_PER_DAY });
      }
      continue;
    }
    const line = LINE.exec(text(row.getCell(2)));
    if (!line) continue;
    const trade = norm(line[1]);
    const wage = Number(line[2].replace(/,/g, ""));
    const amount = num(row.getCell(5)); // 노무비 열
    if (NOT_TRADES.test(trade) || EQUIPMENT_LIKE.test(trade) || (known && !known.has(trade)) || wage < MIN_WAGE || amount === null || amount <= 0) continue;
    const prev = current.get(trade);
    const perUnit = amount / wage;
    current.set(trade, { trade, wage, perUnit: (prev?.perUnit ?? 0) + perUnit });
  }
  flush();
  return out;
}

/** 내역서 품목('품명', '규격') → 호표 제목 키 */
export function unitCostKey(name: string, spec: string): string {
  return norm(spec === "" ? name : `${name}(${spec})`);
}

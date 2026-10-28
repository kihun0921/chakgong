// 엑셀 내역서 읽기(.xls 구형 + .xlsx). 파서(parse.ts)는 ExcelJS 통합문서를 쓰므로,
// SheetJS로 읽은 값(수식은 마지막으로 계산된 값)·병합·숨김 상태를 ExcelJS 통합문서로 옮겨 같은 파서를 쓴다.
// .xlsx도 SheetJS로 읽는 이유: ExcelJS의 읽기는 서식이 많은 실제 내역서(318KB)에서 5.5초, SheetJS는 0.7초다.
// 서버 전용 코드다(SheetJS는 CDN 배포본 0.20.x — npm의 0.18.5는 알려진 취약점이 있어 쓰지 않는다).

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

/** 파일 앞머리(OLE2 복합 문서 서명)로 .xls를 알아본다. 확장자는 믿지 않는다. */
export function isOleXls(bytes: Uint8Array): boolean {
  const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return bytes.length > 8 && magic.every((b, i) => bytes[i] === b);
}

/** .xlsx(zip) 서명 */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function xlsToWorkbook(bytes: Uint8Array): ExcelJS.Workbook {
  // cellDates는 끄고 숫자·문자 값만 쓴다. 암호가 걸렸거나 깨진 파일은 여기서 오류가 난다.
  const src = XLSX.read(bytes, { type: "array", cellFormula: false, cellHTML: false, cellStyles: false, sheetStubs: false });
  const out = new ExcelJS.Workbook();

  src.SheetNames.forEach((name, i) => {
    const sheet = src.Sheets[name];
    const ws = out.addWorksheet(name);
    const hidden = src.Workbook?.Sheets?.[i]?.Hidden ?? 0;
    ws.state = hidden === 0 ? "visible" : hidden === 1 ? "hidden" : "veryHidden";
    if (!sheet) return;

    for (const addr of Object.keys(sheet)) {
      if (addr.startsWith("!")) continue;
      const cell = sheet[addr] as XLSX.CellObject;
      if (cell.v === undefined || cell.v === null || cell.t === "e" || cell.t === "z") continue;
      const { r, c } = XLSX.utils.decode_cell(addr);
      const value = cell.t === "d" && cell.v instanceof Date ? cell.v : (cell.v as ExcelJS.CellValue);
      ws.getCell(r + 1, c + 1).value = value;
    }

    for (const m of sheet["!merges"] ?? []) {
      try {
        ws.mergeCells(m.s.r + 1, m.s.c + 1, m.e.r + 1, m.e.c + 1);
      } catch {
        // 겹치는 병합은 건너뛴다
      }
    }
  });
  return out;
}

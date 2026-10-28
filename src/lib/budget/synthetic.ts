// 성능 시험용 합성 내역서(실제 내역서가 아니다). 집계표·내역서 두 시트를 가진 xlsx를 만든다.
import ExcelJS from "exceljs";

export async function bigBudget(summaryRows: number, detailRows: number): Promise<Uint8Array> {
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

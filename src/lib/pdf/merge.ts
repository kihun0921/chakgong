// PDF 합본 (SRS SR-CM-10, SR-OUT-04·05)
// 서류(생성·업로드)를 지정한 순서로 한 파일로 합치고 쪽번호를 넣는다.
// 손상된 업로드 PDF가 있으면 파일을 지목하고 합본하지 않는다(나머지 입력은 호출한 쪽이 그대로 보존한다).

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfPart = { title: string; bytes: Uint8Array };

export type PartInfo = { title: string; pages: number };
export type BadPart = { title: string; reason: string };

/** 각 PDF가 열리는지 확인하고 쪽수를 센다. */
export async function inspectParts(
  parts: readonly PdfPart[],
): Promise<{ ok: PartInfo[]; bad: BadPart[] }> {
  const ok: PartInfo[] = [];
  const bad: BadPart[] = [];
  for (const p of parts) {
    try {
      const doc = await PDFDocument.load(p.bytes);
      if (doc.getPageCount() === 0) throw new Error("쪽이 없습니다");
      ok.push({ title: p.title, pages: doc.getPageCount() });
    } catch (e) {
      bad.push({
        title: p.title,
        reason: e instanceof Error && e.message ? "손상되었거나 열 수 없는 PDF입니다." : "열 수 없는 PDF입니다.",
      });
    }
  }
  return { ok, bad };
}

/** 부분 PDF를 순서대로 합치고 모든 쪽 아래에 쪽번호(- n -)를 넣는다. */
export async function mergeParts(parts: readonly PdfPart[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const p of parts) {
    const src = await PDFDocument.load(p.bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((pg) => out.addPage(pg));
  }
  const font = await out.embedFont(StandardFonts.Helvetica);
  const total = out.getPageCount();
  out.getPages().forEach((page, k) => {
    const label = `- ${k + 1} / ${total} -`;
    const { width } = page.getSize();
    const size = 9;
    page.drawText(label, {
      x: (width - font.widthOfTextAtSize(label, size)) / 2,
      y: 24,
      size,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  });
  return out.save();
}

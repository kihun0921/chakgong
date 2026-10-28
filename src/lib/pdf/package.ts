// 착공계 합본 만들기 (SRS SR-CM-10, SR-VR-06, SR-OUT-04·05, T-14·T-21)
// 순서: 공문 → 착공신고서 → 제출서류 목차 → 목차 순서대로(간지 → 생성 서류 → 업로드 첨부).
// 검증(필수값·서류 간 일치)을 통과해야 만들고, 손상된 업로드 PDF는 파일을 지목해 알린다.

import { buildToc, generateDocs, type Mismatch } from "@/domain/documents/build";
import { TOC_ITEMS, type DocInput, type DocSpec } from "@/domain/documents/model";
import type { PlanDocData } from "@/domain/documents/plan-docs";
import { inspectParts, mergeParts, type BadPart, type PdfPart } from "./merge";
import { renderDocPdf } from "./render";

export type Upload = { toc: number; name: string; bytes: Uint8Array };

export type PackageResult =
  | { ok: false; reason: "missing"; missing: string[] }
  | { ok: false; reason: "mismatch"; mismatches: Mismatch[] }
  | { ok: false; reason: "badFiles"; bad: BadPart[] }
  | {
      ok: true;
      bytes: Uint8Array;
      totalPages: number;
      outline: { toc: number; title: string; startPage: number }[];
      notices: string[];
    };

// 앞부분: 공문 → 착공신고서 표지 → 착공계 → 제출서류 목차 (실제 제출본의 순서)
const FRONT_IDS = ["cover", "coverStart", "startNotice"];

export async function buildPackage(
  input: DocInput,
  uploads: readonly Upload[],
  plan?: PlanDocData,
): Promise<PackageResult> {
  const gen = generateDocs(input, undefined, plan);
  if (!gen.ok) return { ok: false, reason: "missing", missing: gen.missing };
  if (gen.mismatches.length > 0) return { ok: false, reason: "mismatch", mismatches: gen.mismatches };

  // 업로드 PDF 확인: 열리지 않는 파일은 파일명을 지목한다
  const upInfo = await inspectParts(uploads.map((u) => ({ title: u.name, bytes: u.bytes })));
  if (upInfo.bad.length > 0) return { ok: false, reason: "badFiles", bad: upInfo.bad };

  const render = async (spec: DocSpec): Promise<PdfPart> => ({ title: spec.title, bytes: await renderDocPdf(spec) });
  const byId = (id: string) => gen.specs.find((s) => s.id === id)!;
  const front = [await render(byId("cover")), await render(byId("coverStart")), await render(byId("startNotice"))];

  // 목차 번호별 묶음: 간지 → 생성 서류 → 업로드 첨부
  const notices: string[] = [];
  if (!plan) notices.push("공정표·인원장비투입계획표는 내역서를 확정하고 검증을 통과하면 합본에 들어갑니다.");
  const groups: { toc: number; parts: PdfPart[] }[] = [];
  for (const n of input.tocOrder) {
    const specs = gen.specs.filter((s) => s.toc.includes(n) && !FRONT_IDS.includes(s.id) && s.id !== "toc");
    const dividers = specs.filter((s) => s.id.startsWith("divider:"));
    const docs = specs.filter((s) => !s.id.startsWith("divider:"));
    const ups = uploads.filter((u) => u.toc === n);
    if (docs.length === 0 && ups.length === 0) {
      notices.push(
        dividers.length > 0
          ? `목차 ${n} '${TOC_ITEMS[n]}': 첨부 파일이 없어 간지만 들어갑니다.`
          : `목차 ${n} '${TOC_ITEMS[n]}': 아직 만들 수 없는 서류라 합본에서 제외했습니다.`,
      );
      if (dividers.length === 0) continue;
    }
    const parts: PdfPart[] = [];
    for (const s of [...dividers, ...docs]) parts.push(await render(s));
    for (const u of ups) parts.push({ title: u.name, bytes: u.bytes });
    groups.push({ toc: n, parts });
  }

  const pagesOf = async (parts: PdfPart[]) => (await inspectParts(parts)).ok.reduce((a, p) => a + p.pages, 0);

  // 제출서류 목차는 쪽수 없이 목록만 쓴다(실제 제출본). 각 묶음의 시작 쪽은 합본 쪽 안내(outline)에만 쓴다.
  const frontPages = await pagesOf(front);
  const groupPages = await Promise.all(groups.map((g) => pagesOf(g.parts)));
  const tocPart: PdfPart = { title: "제출서류 목차", bytes: await renderDocPdf(buildToc(input)) };
  const tocPages = await pagesOf([tocPart]);
  const starts: Record<number, number> = {};
  let cursor = frontPages + tocPages + 1;
  groups.forEach((g, k) => {
    starts[g.toc] = cursor;
    cursor += groupPages[k];
  });

  const all = [...front, tocPart, ...groups.flatMap((g) => g.parts)];
  const bytes = await mergeParts(all);
  const totalPages = frontPages + tocPages + groupPages.reduce((a, b) => a + b, 0);
  const outline = groups.map((g) => ({ toc: g.toc, title: TOC_ITEMS[g.toc], startPage: starts[g.toc] }));
  return { ok: true, bytes, totalPages, outline, notices };
}

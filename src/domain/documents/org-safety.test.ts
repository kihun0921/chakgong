import { describe, expect, it } from "vitest";
import { generateDocs } from "./build";
import { sampleEngineer, sampleInput } from "./fixtures";
import type { DocInput, DocSpec, GridCell } from "./model";

function spec(input: DocInput, id: string): DocSpec {
  const g = generateDocs(input);
  if (!g.ok) throw new Error(g.missing.join());
  return g.specs.find((s) => s.id === id)!;
}
type OrgBlock = Extract<DocSpec["blocks"][number], { type: "orgchart" }>;
const org = (input: DocInput) => spec(input, "org").blocks.find((b): b is OrgBlock => b.type === "orgchart")!;
const grid = (s: DocSpec) => s.blocks.find((b) => b.type === "grid") as Extract<DocSpec["blocks"][number], { type: "grid" }>;
const cellText = (cells: GridCell[]) => cells.map((c) => c.text).join(" | ");

describe("현장관리조직도 (실제 제출본 양식)", () => {
  const input = sampleInput({
    engineers: [
      sampleEngineer({ id: "e1", role: "siteManager", name: "홍현장", position: "현장대리인", phone: "010-1111-1111" }),
      sampleEngineer({ id: "e2", role: "qualityMain", name: "김품질", position: "부장", grade: "특급", phone: "010-2222-2222" }),
      sampleEngineer({ id: "e3", role: "qualitySub", name: "이보조", position: "과장", grade: "초급", phone: "010-3333-3333" }),
      sampleEngineer({ id: "e4", role: "safetyManager", name: "박안전", position: "부장", grade: "기술사", phone: "010-4444-4444" }),
    ],
  });

  it("본사(회사명·전화), 현장대리인(이름·연락처), 아래에 안전·품질 담당자 상자를 그린다", () => {
    const o = org(input);
    expect(o.head).toEqual({ label: "본사", lines: ["시험건설", "02-000-0000"] });
    expect(o.manager).toEqual({ label: "현장대리인", lines: ["홍현장", "010-1111-1111"] });
    // 표본 순서: 안전 → 품질특급 → 품질초급
    expect(o.staff).toEqual([
      { label: "안전", position: "부장", name: "박안전", phone: "010-4444-4444" },
      { label: "품질특급", position: "부장", name: "김품질", phone: "010-2222-2222" },
      { label: "품질초급", position: "과장", name: "이보조", phone: "010-3333-3333" },
    ]);
  });

  it("선임된 안전·품질 담당이 없으면 아래 상자를 그리지 않는다", () => {
    const only = sampleInput({ engineers: [sampleEngineer({ id: "e1", role: "siteManager", name: "홍현장" })] });
    expect(org(only).staff).toEqual([]);
  });
});

describe("안전보건관리책임자 선임서 (공식 표 양식)", () => {
  it("표에 사업장·현장·공사기간·금액과 책임자 정보가 들어가고 법 조문 문안이 있다", () => {
    const g = grid(spec(sampleInput(), "safetyChief"));
    const t = cellText(g.cells);
    expect(t).toContain("안전보건관리책임자 선임서");
    expect(t).toContain("시험건설"); // ① 사업장명
    expect(t).toContain("시험 사무환경 조성사업(기계)"); // ④ 현장명
    expect(t).toContain("26.11.2   ~   27.1.10"); // ⑦ 공사기간
    expect(t).toContain("₩622,764,021"); // ⑧ 공사금액
    expect(t).toContain("홍현장");
    expect(t).toContain("「산업안전보건법 시행규칙」 제14조 1항의 규정에 의하여\n위와 같이 선임합니다.");
  });

  it("책임자로 지정한 기술인의 직위·전담겸임이 표에 들어간다", () => {
    const input = sampleInput({
      safetyChiefId: "e3",
      engineers: sampleInput().engineers.map((e) => (e.id === "e3" ? { ...e, dedicated: "겸임" as const, position: "안전팀장" } : e)),
    });
    const g = grid(spec(input, "safetyChief"));
    const row = g.cells.filter((c) => c.r === 10).map((c) => c.text);
    expect(row).toEqual(["안전보건관리책임자", "박안전", "기계설비 특급", "2026.11.2", "안전팀장", "겸임"]);
  });

  it("칸이 서로 겹치지 않고 격자 안에 들어 있다", () => {
    const g = grid(spec(sampleInput(), "safetyChief"));
    const used = new Set<string>();
    for (const c of g.cells) {
      for (let r = c.r; r < c.r + (c.rs ?? 1); r++)
        for (let k = c.c; k < c.c + (c.cs ?? 1); k++) {
          const key = `${r},${k}`;
          expect(used.has(key), `칸 ${key} 중복 (${c.text})`).toBe(false);
          used.add(key);
        }
      expect(c.r + (c.rs ?? 1)).toBeLessThanOrEqual(g.rowHeights.length);
      expect(c.c + (c.cs ?? 1)).toBeLessThanOrEqual(g.cols.length);
    }
  });
});

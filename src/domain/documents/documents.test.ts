import { describe, expect, it } from "vitest";
import { sampleEngineer, sampleInput } from "./fixtures";
import { crossCheck, generateDocs } from "./build";
import { maskRrn, normalizeFact } from "./format";
import type { DocSpec } from "./model";

const text = (s: DocSpec) => JSON.stringify(s.blocks);

describe("준공일은 모든 서류에서 같은 계산값이다 (T-13, SR-CM-03)", () => {
  it("착공신고서·안전보건관리책임자 선임서·공정표 머리부의 준공일이 착공일 + 공기 − 1로 같다", () => {
    const r = generateDocs(sampleInput());
    if (!r.ok) throw new Error("생성 실패");
    const completion = (id: string) => r.checkSpecs.find((s) => s.id === id)?.facts.completionDate;
    expect(completion("startNotice")).toBe("2027-01-10");
    expect(completion("safetyChief")).toBe("2027-01-10");
    expect(completion("scheduleHeader")).toBe("2027-01-10");
    expect(r.mismatches).toEqual([]);
  });

  it("착공일을 바꿔 다시 생성하면 모든 서류의 준공일이 새 값으로 같다", () => {
    const r = generateDocs(sampleInput({ startDate: "2026-11-16" }));
    if (!r.ok) throw new Error("생성 실패");
    const all = r.checkSpecs.map((s) => s.facts.completionDate).filter(Boolean);
    expect(new Set(all)).toEqual(new Set(["2027-01-24"]));
  });
});

describe("기술인 정보를 한 번 입력해 여러 서류에 쓴다 (T-14, SR-CM-04)", () => {
  const r = generateDocs(sampleInput());
  if (!r.ok) throw new Error("생성 실패");

  it("기술인마다 선임계와 재직증명서가 만들어지고 이름이 들어간다", () => {
    for (const name of ["홍현장", "김품질", "박안전"]) {
      const id = { 홍현장: "e1", 김품질: "e2", 박안전: "e3" }[name];
      const appt = r.specs.find((s) => s.id === `appointment:${id}`);
      const emp = r.specs.find((s) => s.id === `employment:${id}`);
      expect(appt && text(appt)).toContain(name);
      expect(emp && text(emp)).toContain(name);
    }
  });

  it("선임계에는 고정 문안과 공사명이 들어간다", () => {
    const appt = r.specs.find((s) => s.id === "appointment:e1")!;
    expect(text(appt)).toContain("상기 공사에 대하여 위 사람을 현장대리인으로 선임하여 선임계를 제출합니다");
    expect(text(appt)).toContain("시험 사무환경 조성사업(기계)");
  });

  it("안전보건관리책임자 선임서는 기술인 목록에서 고른 사람을 쓰고 법 조문 문안이 들어간다", () => {
    const chief = r.specs.find((s) => s.id === "safetyChief")!;
    expect(text(chief)).toContain("홍현장");
    expect(text(chief)).toContain("제14조 1항의 규정에 의하여");
    expect(text(chief)).toContain("위와 같이 선임합니다.");
  });

  it("조직도에 현장대리인과 안전·품질 담당 이름이 들어간다", () => {
    const org = r.specs.find((s) => s.id === "org")!;
    for (const n of ["홍현장", "김품질", "박안전"]) expect(text(org)).toContain(n);
  });

  it("출력 서류에는 주민등록번호 전체 값이, 화면용 마스킹은 뒤를 가린다 (SR-NF-15)", () => {
    const appt = r.specs.find((s) => s.id === "appointment:e1")!;
    expect(text(appt)).toContain("800101-1000000");
    expect(maskRrn("800101-1000000")).toBe("800101-*******");
  });
});

describe("착공신고서·공문·목차", () => {
  const r = generateDocs(sampleInput());
  if (!r.ok) throw new Error("생성 실패");

  it("착공신고서에 고정 문안과 계약금액·착공·준공일이 들어가고, 제출일이 비어도 생성된다 (SR-CM-07)", () => {
    const s = r.specs.find((x) => x.id === "startNotice")!;
    expect(text(s)).toContain("위와 같이 착공하기에 소정의 서류를 첨부하여 착공신고서를 제출합니다");
    expect(text(s)).toContain("₩622,764,021원"); // 계약금액 (한글 금액과 함께)
    expect(text(s)).toContain("금육억이천이백칠십육만사천이십일원정");
    expect(text(s)).toContain("2027년 1월 10일");
  });

  it("공문 제목은 '착공서류제출'이다", () => {
    const s = r.specs.find((x) => x.id === "cover")!;
    expect(text(s)).toContain("착공서류제출");
  });

  it("제출서류 목차는 15종을 지정한 순서로 보여 준다", () => {
    const s = r.specs.find((x) => x.id === "toc")!;
    expect(text(s)).toContain("현장기술자 지정신고서");
    expect(text(s)).toContain("조직도");
    const custom = generateDocs(sampleInput({ tocOrder: [15, ...Array.from({ length: 14 }, (_, i) => i + 1)] }));
    if (!custom.ok) throw new Error("생성 실패");
    const t = JSON.parse(text(custom.specs.find((x) => x.id === "toc")!)) as { type: string; text?: string }[];
    const items = t.filter((b) => b.type === "paragraph").map((b) => b.text);
    expect(items[0]).toBe("-. 조직도");
  });
});

describe("필수 입력값 검사 (T-15, SR-CM-06·07)", () => {
  it("계약 유형이 비어 있으면 생성을 막고 누락 항목을 알려 준다", () => {
    const r = generateDocs(sampleInput({ contractType: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("계약 유형");
  });

  it("여러 항목이 비면 모두 알려 준다", () => {
    const r = generateDocs(sampleInput({ projectName: "", startDate: "", contractAmount: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(expect.arrayContaining(["공사명", "착공일", "계약금액"]));
  });

  it("현장대리인이 없으면 알려 준다", () => {
    const r = generateDocs(sampleInput({ engineers: [sampleEngineer({ id: "e2", role: "qualityMain", name: "김품질" })] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("현장대리인");
  });

  it("제출일이 비어 있어도 생성된다", () => {
    expect(generateDocs(sampleInput({ submitDate: "" })).ok).toBe(true);
  });
});

describe("서류 간 교차 검사 (T-18, SR-VR-04)", () => {
  const spec = (id: string, title: string, facts: DocSpec["facts"]): DocSpec => ({ id, title, toc: [], blocks: [], facts });

  it("준공일이 2029.3.9와 2029.03.10으로 다르면 어떤 서류의 어떤 항목이 다른지 알려 준다", () => {
    const m = crossCheck([
      spec("a", "착공신고서", { completionDate: "2029.3.9" }),
      spec("b", "안전보건관리책임자 선임서", { completionDate: "2029.03.10" }),
    ]);
    expect(m).toHaveLength(1);
    expect(m[0].fact).toBe("completionDate");
    expect(m[0].values.map((v) => v.docTitle).sort()).toEqual(["안전보건관리책임자 선임서", "착공신고서"]);
  });

  it("표기만 다르고 같은 날짜(2029.3.9 / 2029-03-09)는 일치로 본다", () => {
    expect(
      crossCheck([
        spec("a", "A", { completionDate: "2029.3.9" }),
        spec("b", "B", { completionDate: "2029-03-09" }),
      ]),
    ).toEqual([]);
  });

  it("발주처가 군청과 조달청으로 갈리면 불일치다", () => {
    const m = crossCheck([
      spec("a", "착공계", { contractAgency: "연천군청" }),
      spec("b", "계획서", { contractAgency: "조달청" }),
    ]);
    expect(m[0].fact).toBe("contractAgency");
  });

  it("값이 없는 서류는 비교에서 빠진다", () => {
    expect(crossCheck([spec("a", "A", { projectName: "X" }), spec("b", "B", {})])).toEqual([]);
  });
});

describe("표기 정규화", () => {
  it("날짜·금액 표기를 맞춘다", () => {
    expect(normalizeFact("2026년 11월 2일")).toBe("2026-11-02");
    expect(normalizeFact("622,764,021원")).toBe("622764021");
  });
});

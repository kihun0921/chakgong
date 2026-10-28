import { describe, expect, it } from "vitest";
import type { ParsedBudget, ParsedSection } from "@/lib/budget/parse";
import { assemblePlanInput } from "@/lib/budget/assemble";
import {
  addProcess,
  checkComposition,
  defaultComposition,
  mergeProcesses,
  moveProcess,
  removeProcess,
  renameProcess,
  routeLine,
  splitByChildren,
  splitManual,
  type Composition,
} from "./composition";
import { buildPlan } from "./buildPlan";

// 공정 구성 (나누기·합치기·직접 나누기·추가): 금액·노무비는 어떤 편집을 해도 합이 보존된다.
const sec = (id: string, name: string, depth: number, parentId: string | null, code: string, total: number, labor = 0): ParsedSection => ({
  id, name, depth, parentId, code, material: total - labor, labor, expense: 0, total,
});

const parsed: ParsedBudget = {
  summary: [
    { code: "0105", name: "냉난방기설치공사", material: 0, labor: 300, expense: 0, total: 1000 },
    { code: "0106", name: "바닥공조설치공사", material: 0, labor: 0, expense: 0, total: 500 },
    { code: "03", name: "T.A.B공사", material: 0, labor: 50, expense: 0, total: 50 },
  ],
  summaryTotal: 1550,
  grandTotal: 1550,
  summaryTotalMatchesGrandTotal: true,
  sections: [
    sec("0:1", "냉난방기설치공사", 0, null, "0105", 1000, 300),
    sec("0:2", "물품", 1, "0:1", "0105", 400, 0),
    sec("0:3", "장비설치", 1, "0:1", "0105", 500, 200),
    sec("0:4", "냉매배관", 1, "0:1", "0105", 90, 90), // 합 990: 공종 바로 아래 품목 10원이 남는다
    sec("0:5", "바닥공조설치공사", 0, null, "0106", 500, 0),
    sec("0:6", "2층", 1, "0:5", "0106", 100),
    sec("0:7", "3층", 1, "0:5", "0106", 150),
    sec("0:8", "공용", 1, "0:5", "0106", 250),
    sec("0:9", "T.A.B공사", 0, null, "03", 50, 50),
  ],
  labor: [
    { code: "0105", trade: "보통인부", quantity: 5, wage: 100, sectionId: "0:3" }, // 장비설치 그룹 안
    { code: "0105", trade: "배관공", quantity: 2, wage: 100, sectionId: "0:1" }, // 공종 바로 아래
    { code: "03", trade: "TAB기술자", quantity: 3, wage: 0, sectionId: "0:9" },
  ],
  equipment: [{ code: "0105", name: "크레인", hours: 16, sectionId: "0:3" }],
  warnings: [],
};

const total = (c: Composition) => c.reduce((a, d) => a + d.amount, 0);
const labor = (c: Composition) => c.reduce((a, d) => a + d.laborCost, 0);

describe("기본 공정 구성", () => {
  it("집계표 공종마다 공정 하나, 키는 공종코드, 공종 제목 구조 단위에 연결", () => {
    const c = defaultComposition(parsed);
    expect(c.map((d) => [d.id, d.name, d.amount, d.laborCost, d.sectionIds])).toEqual([
      ["0105", "냉난방기설치공사", 1000, 300, ["0:1"]],
      ["0106", "바닥공조설치공사", 500, 0, ["0:5"]],
      ["03", "T.A.B공사", 50, 50, ["0:9"]],
    ]);
  });
  it("구조 단위가 없는 이전 저장본도 기본 구성이 만들어진다 (sections 없음)", () => {
    const old = { ...parsed, sections: undefined };
    const c = defaultComposition(old);
    expect(c.map((d) => d.id)).toEqual(["0105", "0106", "03"]);
    expect(c.every((d) => d.sectionIds.length === 0)).toBe(true);
  });
});

describe("시트 전체가 하나의 공종인 내역서(연천읍지구 형식)", () => {
  // 개요 단위(Ⅰ. 하천공 …)는 시트 뿌리 아래에 있다. 공종을 나누면 개요 단위가 나와야 한다(그 아래 하천들이 아니라)
  const outline: ParsedBudget = {
    summary: [{ code: "S1", name: "토목공사", material: 0, labor: 0, expense: 0, total: 1000 }],
    summaryTotal: 1000,
    grandTotal: 1000,
    summaryTotalMatchesGrandTotal: true,
    sections: [
      sec("0:root", "토목공사", -1, null, "S1", 1000),
      sec("0:6", "Ⅰ. 하천공", 0, "0:root", "S1", 600),
      sec("0:7", "1. 차탄천", 1, "0:6", "S1", 200),
      sec("0:8", "2. 군자천", 1, "0:6", "S1", 400),
      sec("0:20", "Ⅱ. 교량공", 0, "0:root", "S1", 400),
      { ...sec("0:30", "품질관리비", 0, null, "S1", 99), outside: true },
    ],
    labor: [],
    equipment: [],
    warnings: [],
  };
  it("기본 공정은 시트 전체에 연결되고, 나누면 Ⅰ·Ⅱ 개요 단위가 나온다 (순공사비 밖 항목은 제외)", () => {
    const c = defaultComposition(outline);
    expect(c[0].sectionIds).toEqual(["0:root"]);
    const r = splitByChildren(outline, c, "S1");
    if (!r.ok) throw new Error(r.error);
    expect(r.value.map((d) => [d.name, d.amount])).toEqual([["Ⅰ. 하천공", 600], ["Ⅱ. 교량공", 400]]);
    // 한 번 더: 하천공을 나누면 차탄천·군자천
    const r2 = splitByChildren(outline, r.value, "S1/0:6");
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.value.map((d) => [d.name, d.amount])).toEqual([["1. 차탄천", 200], ["2. 군자천", 400], ["Ⅱ. 교량공", 400]]);
    expect(total(r2.value)).toBe(1000);
  });
});

describe("소분류로 나누기", () => {
  it("아래 단위로 나누고, 남는 금액은 '기타' 공정으로 보존한다", () => {
    const r = splitByChildren(parsed, defaultComposition(parsed), "0105");
    if (!r.ok) throw new Error(r.error);
    expect(r.value.map((d) => [d.name, d.amount, d.laborCost])).toEqual([
      ["물품", 400, 0],
      ["장비설치", 500, 200],
      ["냉매배관", 90, 90],
      ["냉난방기설치공사 기타", 10, 10], // 1000 − 990, 300 − 290
      ["바닥공조설치공사", 500, 0],
      ["T.A.B공사", 50, 50],
    ]);
    expect(total(r.value)).toBe(1550);
    expect(labor(r.value)).toBe(350);
  });
  it("다른 공정과 이름이 겹치는 그룹은 상위 공정 이름을 붙여 구분한다", () => {
    const dup: ParsedBudget = {
      ...parsed,
      summary: [...parsed.summary, { code: "0101", name: "장비설치", material: 0, labor: 0, expense: 0, total: 0 }],
    };
    const r = splitByChildren(dup, defaultComposition(dup), "0105");
    if (!r.ok) throw new Error(r.error);
    const names = r.value.map((d) => d.name);
    expect(names).toContain("냉난방기설치공사 장비설치"); // 겹치므로 상위 이름이 붙는다
    expect(names).toContain("장비설치"); // 원래 공종은 그대로
    expect(new Set(names).size).toBe(names.length);
    expect(checkComposition(dup, r.value).messages.some((m) => m.includes("겹치는"))).toBe(false);
  });
  it("나눌 아래 단위가 없으면 이유를 알린다", () => {
    const r = splitByChildren(parsed, defaultComposition(parsed), "03");
    expect(r.ok).toBe(false);
  });
  it("남는 금액이 없으면 '기타'를 만들지 않는다", () => {
    const exact: ParsedBudget = { ...parsed, sections: parsed.sections!.map((s) => (s.id === "0:4" ? { ...s, total: 100, labor: 100 } : s)) };
    const r = splitByChildren(exact, defaultComposition(exact), "0105");
    if (!r.ok) throw new Error(r.error);
    expect(r.value.some((d) => d.name.endsWith("기타"))).toBe(false);
    expect(total(r.value)).toBe(1550);
  });
});

describe("합치기", () => {
  it("고른 공정을 하나로 합치고 첫 공정 자리에 둔다 (금액·노무비·구조 단위 합)", () => {
    const split = splitByChildren(parsed, defaultComposition(parsed), "0106");
    if (!split.ok) throw new Error(split.error);
    const ids = split.value.filter((d) => d.name === "2층" || d.name === "3층").map((d) => d.id);
    const r = mergeProcesses(split.value, ids, "2~3층");
    if (!r.ok) throw new Error(r.error);
    const merged = r.value.find((d) => d.name === "2~3층")!;
    expect(merged.amount).toBe(250);
    expect(merged.sectionIds).toEqual(["0:6", "0:7"]);
    expect(r.value.map((d) => d.name)).toEqual(["냉난방기설치공사", "2~3층", "공용", "T.A.B공사"]);
    expect(total(r.value)).toBe(1550);
  });
  it("둘 미만이면 거절한다", () => {
    expect(mergeProcesses(defaultComposition(parsed), ["0105"]).ok).toBe(false);
  });
});

describe("직접 나누기", () => {
  it("금액·노무비의 합이 같으면 나눈다. 구조 단위는 첫 부분이 이어받는다", () => {
    const base = defaultComposition(parsed);
    const r = splitManual(base, "0105", [
      { name: "실외기", amount: 600, laborCost: 100 },
      { name: "실내기", amount: 400, laborCost: 200 },
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.slice(0, 2).map((d) => [d.name, d.amount, d.sectionIds, d.manual])).toEqual([
      ["실외기", 600, ["0:1"], true],
      ["실내기", 400, [], true],
    ]);
    expect(total(r.value)).toBe(1550);
  });
  it("금액이 맞지 않으면 차이를 알려 거절한다", () => {
    const r = splitManual(defaultComposition(parsed), "0105", [
      { name: "a", amount: 600, laborCost: 100 },
      { name: "b", amount: 300, laborCost: 200 },
    ]);
    expect(r).toEqual({ ok: false, error: "금액의 합이 원래 공정 금액과 100원 적습니다." });
  });
  it("노무비 합이 맞지 않으면 거절한다", () => {
    const r = splitManual(defaultComposition(parsed), "0105", [
      { name: "a", amount: 600, laborCost: 100 },
      { name: "b", amount: 400, laborCost: 100 },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("추가·이름·순서·삭제", () => {
  it("금액 없는 협조 공정을 추가하고, 0원 공정만 지울 수 있다", () => {
    const added = addProcess(defaultComposition(parsed), "시운전·준공검사 및 정리");
    if (!added.ok) throw new Error(added.error);
    expect(added.value.at(-1)).toMatchObject({ name: "시운전·준공검사 및 정리", amount: 0, manual: true });
    expect(total(added.value)).toBe(1550);
    expect(removeProcess(added.value, added.value.at(-1)!.id).ok).toBe(true);
    expect(removeProcess(added.value, "0105").ok).toBe(false); // 금액이 있는 공정
  });
  it("이름 바꾸기·순서 바꾸기", () => {
    const c = renameProcess(defaultComposition(parsed), "03", "T.A.B");
    expect(c.find((d) => d.id === "03")?.name).toBe("T.A.B");
    expect(moveProcess(c, "03", -1).map((d) => d.id)).toEqual(["0105", "03", "0106"]);
    expect(moveProcess(c, "0105", -1)).toBe(c); // 맨 앞은 그대로
  });
});

describe("노무·장비 행을 공정에 잇기", () => {
  it("행이 속한 그룹이 공정이면 그 공정, 그룹이 나뉘기 전의 위쪽 단위면 남은 공정으로 간다", () => {
    const split = splitByChildren(parsed, defaultComposition(parsed), "0105");
    if (!split.ok) throw new Error(split.error);
    const c = split.value;
    expect(routeLine(parsed, c, parsed.labor[0])).toBe("0105/0:3"); // 장비설치 그룹
    expect(routeLine(parsed, c, parsed.labor[1])).toBe("0105/rest"); // 공종 바로 아래
    expect(routeLine(parsed, c, parsed.equipment[0])).toBe("0105/0:3");
  });
  it("직접 나눈 공정이면 첫 부분이 받는다", () => {
    const r = splitManual(defaultComposition(parsed), "0105", [
      { name: "실외기", amount: 600, laborCost: 100 },
      { name: "실내기", amount: 400, laborCost: 200 },
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(routeLine(parsed, r.value, parsed.labor[0])).toBe("0105#1");
  });
  it("구조 단위가 없는 이전 저장본은 공종코드로 잇는다", () => {
    const old: ParsedBudget = { ...parsed, sections: undefined, labor: parsed.labor.map(({ sectionId: _s, ...r }) => (void _s, r)) };
    expect(routeLine(old, defaultComposition(old), old.labor[2])).toBe("03");
  });
  it("집계표에 없는 공종코드의 행은 이어지지 않는다(제외 알림)", () => {
    const a = assemblePlanInput({ ...parsed, labor: [{ code: "99", trade: "X", quantity: 1, wage: 0 }] }, { start: "2026-11-02", durationDays: 70, holidays: new Set() });
    expect(a.unmatched).toEqual([{ code: "99", name: "X" }]);
  });
});

describe("공정 구성을 반영한 계산", () => {
  const base = {
    parsed,
    startDate: "2026-11-02",
    durationDays: "70",
    holidaysText: "",
    schedule: {},
    extraLabor: [],
    extraEquipment: [],
  };
  it("나눈 구성으로 계산해도 금액 합이 집계표와 같아 검증을 통과하고, 노무·장비는 나뉜 공정으로 간다", () => {
    const split = splitByChildren(parsed, defaultComposition(parsed), "0105");
    if (!split.ok) throw new Error(split.error);
    const out = buildPlan({ ...base, composition: split.value });
    expect(out.error).toBeUndefined();
    expect(out.result?.validation.passed).toBe(true);
    expect(out.processes.map((p) => p.key)).toContain("0105/0:3");
    const crane = out.result!.equipment.basisList.find((b) => b.name === "크레인")!;
    expect(crane).toMatchObject({ processKey: "0105/0:3", manDays: 2 }); // 16HR ÷ 8
    expect(checkComposition(parsed, split.value).ok).toBe(true);
  });
  it("구성 금액의 합이 집계표와 다르면 알린다 (검증 V-1과 같은 기준)", () => {
    const c = defaultComposition(parsed).map((d) => (d.id === "03" ? { ...d, amount: 40 } : d));
    expect(checkComposition(parsed, c).messages[0]).toContain("10원");
    expect(buildPlan({ ...base, composition: c }).result?.validation.passed).toBe(false);
  });
  it("노무비 환산·생산성·인일 직접 입력 라인이 방식 표시와 함께 들어간다", () => {
    const out = buildPlan({
      ...base,
      extraLabor: [
        { id: 1, processKey: "0105", name: "기계설비공", perDay: 0, workdays: 0, mode: "cost", share: 0.6, wage: 100 }, // 노무비 300 × 0.6 ÷ 100 = 2
        { id: 2, processKey: "0106", name: "내선전공", perDay: 0, workdays: 0, mode: "qty", quantity: 10, productivity: 0.25, share: 0.5 }, // 1.25 → 1
        { id: 3, processKey: "03", name: "TAB기술자", perDay: 0, workdays: 0, mode: "days", manDays: 48 },
        { id: 4, processKey: "03", name: "보통인부", perDay: 2, workdays: 5 },
      ],
    });
    const find = (name: string) => out.result!.labor.basisList.find((b) => b.name === name && b.method !== "내역서")!;
    expect(find("기계설비공")).toMatchObject({ manDays: 2, method: "환산" });
    expect(find("내선전공")).toMatchObject({ manDays: 1, method: "생산성" });
    expect(out.result!.labor.basisList.find((b) => b.name === "TAB기술자" && b.method === "가정")?.manDays).toBe(48);
    expect(find("보통인부")).toMatchObject({ manDays: 10, method: "가정" });
  });
  it("노임단가가 없거나 배분율이 범위 밖인 환산 라인은 제외하고 알린다", () => {
    const out = buildPlan({ ...base, extraLabor: [{ id: 1, processKey: "0105", name: "기계설비공", perDay: 0, workdays: 0, mode: "cost", share: 0.6, wage: 0 }] });
    expect(out.warnings.some((w) => w.includes("기계설비공") && w.includes("제외"))).toBe(true);
  });
});

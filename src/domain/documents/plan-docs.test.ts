import { describe, expect, it } from "vitest";
import { computePlan, type PlanInput } from "../plan";
import { sampleInput } from "./fixtures";
import { generateDocs } from "./build";
import { buildLaborDoc, buildScheduleDoc, fontSizeForRows, type PlanDocData } from "./plan-docs";

// SRS SR-OUT-03, 8.1·8.2 / PRD AC-F7-2 (T-20의 내용 부분)
const planInput: PlanInput = {
  start: "2026-11-02",
  durationDays: 70,
  holidays: new Set(["2026-12-25", "2027-01-01"]),
  processes: [
    { key: "A", name: "냉난방기", amount: 600, startDay: 1, endDay: 15 },
    { key: "B", name: "배관", amount: 300, startDay: 16, endDay: 45 },
    { key: "C", name: "관급 분리발주", amount: 0, startDay: 1, endDay: 70 },
  ],
  laborLines: [
    { processKey: "B", name: "배관공", manDays: 20, method: "내역서", basis: "내역서" },
    { processKey: "A", name: "보통인부", manDays: 5, method: "가정", basis: "직접 지정" },
  ],
  equipmentLines: [{ processKey: "A", name: "크레인", manDays: 3, method: "내역서", basis: "" }],
  summaryTotalWon: 900,
};
const plan: PlanDocData = { processes: planInput.processes, result: computePlan(planInput), summaryTotalWon: 900 };

describe("공정표·투입계획표 서류 명세", () => {
  const input = sampleInput();

  it("A3 가로 용지이고 목차 ④·⑨에 대응한다", () => {
    const s = buildScheduleDoc(input, plan);
    const l = buildLaborDoc(input, plan);
    expect(s.page).toEqual({ size: "A3", landscape: true });
    expect(l.page).toEqual({ size: "A3", landscape: true });
    expect(s.toc).toEqual([4]);
    expect(l.toc).toEqual([9]);
  });

  it("공정표는 막대 그래프 격자: 공정별 일정 막대·구간 값, 연·월·구간 끝 날짜 머리글, 합계·구간 진도율·누계", () => {
    const s = buildScheduleDoc(input, plan);
    const g = s.blocks[0];
    if (g.type !== "gantt") throw new Error("gantt");
    expect(g.rows.map((r) => r.name)).toEqual(["냉난방기", "배관", "관급 분리발주 (협조)"]);
    expect(g.rows[2]).toMatchObject({ amount: 0, weight: 0 }); // 협조 구간은 금액 없이 막대만
    // 머리글: 2026년(11~12월), 2027년(1월), 구간 끝 날짜 15·30·15·31·15
    expect(g.periods.years.map((y) => y.label)).toEqual(["2026년", "2027년"]);
    expect(g.periods.months.map((m) => m.label)).toEqual(["11월", "12월", "1월"]);
    expect(g.periods.days).toEqual([15, 30, 15, 31, 15]);
    // 합계·누계는 계산 결과와 같다
    expect(g.totals.amount).toBe(900);
    expect(g.totals.cumulative.at(-1)).toBeCloseTo(100, 6);
    // 막대 위치: 1~15일차는 첫 구간 안(11/2~11/16)에서 끝난다
    const [from, to] = g.rows[0].bar!;
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
    expect(to).toBeLessThanOrEqual(2);
    expect(g.rightNote).toBe("2026.11.02 ~ 2027.01.10 (70日)");
    expect(s.facts.completionDate).toBe("2027-01-10");
  });

  it("투입계획표는 장비투입·인원투입 직종별 구간 값, 소계, 일평균 투입인원이 있고 가정 항목에 ▲가 붙는다", () => {
    const l = buildLaborDoc(input, plan);
    const r = l.blocks[0];
    if (r.type !== "resource") throw new Error("resource");
    expect(r.groups.map((g) => g.label.replace(/\n/g, ""))).toEqual(["장비투입", "인원투입"]);
    const labor = r.groups[1].rows;
    expect(labor.map((x) => x.name)).toEqual(["배관공", "보통인부 ▲", "소    계", "일평균 투입인원 (명/일)"]);
    expect(labor.find((x) => x.name === "소    계")).toMatchObject({ total: 25, unit: "인", bold: true });
    expect(labor.at(-1)?.decimals).toBe(1);
    expect(r.groups[0].rows.map((x) => x.name)).toEqual(["크레인", "소    계"]);
    expect(r.notes.join(" ")).toContain("▲ 표시는 환산·생산성·직접 지정(가정)으로 만든 값이 포함된 항목입니다");
  });

  it("주요 공정내용(비고)과 위치별 작업 구간이 서류에 들어간다", () => {
    const withExtra: PlanDocData = {
      ...plan,
      remarks: { A: " 설계도서 검토 ", B: "" },
      locations: [
        { id: "1", name: "옥상", startDay: 16, endDay: 30, remark: "실외기 양중" },
        { id: "2", name: "  ", startDay: 1, endDay: 5, remark: "" }, // 이름 없는 줄은 뺀다
        { id: "3", name: "역전", startDay: 9, endDay: 3, remark: "" }, // 일차가 거꾸로면 뺀다
      ],
    };
    const g = buildScheduleDoc(input, withExtra).blocks[0];
    if (g.type !== "gantt") throw new Error("gantt");
    expect(g.rows.map((r) => r.remark)).toEqual(["설계도서 검토", "", ""]);
    const r = buildLaborDoc(input, withExtra).blocks[0];
    if (r.type !== "resource") throw new Error("resource");
    expect(r.groups.map((x) => x.label.replace(/\n/g, ""))).toEqual(["위치별", "장비투입", "인원투입"]);
    expect(r.groups[0].rows).toHaveLength(1);
    expect(r.groups[0].rows[0]).toMatchObject({ name: "옥상", remark: "실외기 양중" });
    const [from, to] = r.groups[0].rows[0].bar!;
    expect(to).toBeGreaterThan(from);
    // 위치별을 안 쓰면 그룹이 생기지 않는다
    const none = buildLaborDoc(input, plan).blocks[0];
    if (none.type !== "resource") throw new Error("resource");
    expect(none.groups).toHaveLength(2);
  });

  it("줄이 많을수록 글자가 작아진다", () => {
    expect(fontSizeForRows(10)).toBeGreaterThan(fontSizeForRows(30));
    expect(fontSizeForRows(30)).toBeGreaterThan(fontSizeForRows(70));
  });
});

describe("계산 결과를 서류 묶음에 넣는다", () => {
  it("plan을 주면 공정표·투입계획표가 서류 명세에 들어가고 준공일이 모든 서류에서 같다 (T-13)", () => {
    const r = generateDocs(sampleInput(), undefined, plan);
    if (!r.ok) throw new Error("생성 실패");
    expect(r.specs.map((s) => s.id)).toEqual(expect.arrayContaining(["schedule", "labor"]));
    expect(r.mismatches).toEqual([]);
  });

  it("공정표 준공일이 서류 입력과 다르면 교차 검사에서 잡힌다", () => {
    const wrong: PlanDocData = { ...plan, result: { ...plan.result, completion: "2027-01-11" } };
    const r = generateDocs(sampleInput(), undefined, wrong);
    if (!r.ok) throw new Error("생성 실패");
    expect(r.mismatches.map((m) => m.fact)).toContain("completionDate");
  });
});

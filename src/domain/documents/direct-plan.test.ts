import { describe, expect, it } from "vitest";
import { generateDocs } from "./build";
import { buildDirectPlanDoc, checkDirectPlan, directTotals, requiredDirectRatio } from "./direct-plan";
import { EMPTY_DIRECT, type DirectPlanInput, type DocInput } from "./model";
import { sampleInput } from "./fixtures";

// 실제 서식 샘플(옥렬도로(군도 10호선) 선형개량 공사, 별지 제22호의6서식)의 값으로 맞춘다.
// 샘플은 시험용으로 가져온 것이며 회사·대표자 이름은 쓰지 않는다.
const oklyeolDirect: DirectPlanInput = {
  ...EMPTY_DIRECT,
  workType: "토목",
  groupType: "교통시설",
  subType: "일반도로",
  ownerKind: "공공기관",
  contractMethod: "단독도급",
  contractNature: "기타공사",
  totalLabor: "65368779",
  skilledWorkers: "180",
  directLabor: "37454570",
  subLabor: "27914209",
  items: [
    { id: "a", name: "토공", amount: "143691675", kind: "direct" },
    { id: "b", name: "배수공", amount: "16619178", kind: "sub" },
    { id: "c", name: "포장공", amount: "41723673", kind: "sub" },
    { id: "d", name: "부대공", amount: "45547174", kind: "sub" },
  ],
};

function oklyeol(over: Partial<DocInput> = {}): DocInput {
  return sampleInput({
    projectName: "옥렬도로(군도 10호선)선형개량 공사",
    contractAgency: "함안군",
    demandAgency: "",
    siteAddress: "경남 함안군 대산면 옥렬리 일원",
    contractDate: "2025-12-05",
    startDate: "2025-12-09",
    durationDays: 180,
    contractAmount: 247_581_700,
    submitDate: "2025-12-26",
    direct: oklyeolDirect,
    ...over,
  });
}

describe("직접시공계획서 (별지 제22호의6서식)", () => {
  it("샘플 금액: 직접시공 + 하도급 = 도급금액 247,581,700원이고 오차는 1원 이내", () => {
    const t = directTotals(oklyeolDirect, 247_581_700);
    expect(t.directAmount).toBe(143_691_675);
    expect(t.subAmount).toBe(103_890_025);
    expect(Math.abs(t.total - 247_581_700)).toBeLessThanOrEqual(1);
    expect(t.ratio).toBeCloseTo(0.5804, 3);
  });

  it("샘플 노무비: 직접시공 노무비 + 하도급 총 노무비 = 총 노무비 65,368,779원", () => {
    expect(37_454_570 + 27_914_209).toBe(65_368_779);
    expect(checkDirectPlan(oklyeol())).toEqual([]);
  });

  it("직접시공 비율 기준: 3억 미만 50%, 10억 미만 30%, 30억 미만 20%, 70억 미만 10%, 그 이상은 검사 없음", () => {
    expect([299_999_999, 300_000_000, 999_999_999, 1_000_000_000, 2_999_999_999, 3_000_000_000, 6_999_999_999, 7_000_000_000].map(requiredDirectRatio)).toEqual([
      0.5, 0.3, 0.3, 0.2, 0.2, 0.1, 0.1, null,
    ]);
    expect(requiredDirectRatio(0)).toBeNull();
  });

  it("비율이 기준에 못 미치면 경고(차단 아님)한다", () => {
    const low: DirectPlanInput = {
      ...oklyeolDirect,
      items: [
        { id: "a", name: "토공", amount: "50000000", kind: "direct" },
        { id: "b", name: "나머지", amount: "197581700", kind: "sub" },
      ],
    };
    const issues = checkDirectPlan(oklyeol({ direct: low }));
    expect(issues.some((x) => x.level === "warn" && x.text.includes("20.2%"))).toBe(true);
    expect(issues.some((x) => x.level === "error")).toBe(false);
  });

  it("금액 합이 계약금액과 다르면 서류 간 불일치로 합본을 막는다", () => {
    const bad = oklyeol({ direct: { ...oklyeolDirect, items: oklyeolDirect.items.slice(0, 3) } });
    const gen = generateDocs(bad);
    expect(gen.ok).toBe(true);
    if (gen.ok) expect(gen.mismatches.some((m) => m.fact === "contractAmount")).toBe(true);
  });

  it("노무비 합이 다르면 입력 오류로 보고 서류를 만들지 않는다", () => {
    const gen = generateDocs(oklyeol({ direct: { ...oklyeolDirect, subLabor: "1" } }));
    expect(gen.ok).toBe(false);
    if (!gen.ok) expect(gen.missing.some((m) => m.startsWith("직접시공계획서"))).toBe(true);
  });

  it("서식 문구와 값: 법정 서식 머리말·근거 문구·구비서류, 날짜는 일반사항의 값으로", () => {
    const spec = buildDirectPlanDoc(oklyeol())!;
    const all = JSON.stringify(spec.blocks);
    expect(all).toContain("별지 제22호의6서식");
    expect(all).toContain("<개정 2024. 10. 16.>");
    expect(all).toContain("건설산업기본법 제28조의 2 제2항, 같은 법 시행령 제30조의2 제4항 및 같은 법 시행규칙 제25조의5 제1항에 따라 건설공사의 직접시공계획을 통보합니다.");
    expect(all).toContain("2. 예정공정표");
    expect(all).toContain("2025년 12월 9일"); // 착공일
    expect(all).toContain("2026년 6월 6일"); // 준공예정일: 샘플 서식의 ④와 같다
    expect(all).toContain("143,691,675");
    expect(all).toContain("[ V ] 공공기관");
    expect(all).toContain("180명");
    expect(spec.toc).toEqual([12]);
  });

  it("세부공종이 없으면 서류를 만들지 않는다(업로드 첨부만 사용)", () => {
    expect(buildDirectPlanDoc(sampleInput())).toBeNull();
    expect(buildDirectPlanDoc(sampleInput({ direct: EMPTY_DIRECT }))).toBeNull();
    expect(checkDirectPlan(sampleInput({ direct: EMPTY_DIRECT }))).toEqual([]);
  });

  it("합본 생성 명세에 목차 12번 서류로 들어가고 다른 서류와 같은 준공일을 쓴다", () => {
    const gen = generateDocs(oklyeol());
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    expect(gen.specs.find((s) => s.id === "directPlan")).toBeTruthy();
    expect(gen.mismatches).toEqual([]);
  });
});

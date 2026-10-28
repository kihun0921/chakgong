import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { assemblePlanInput } from "./assemble";
import { detectLayout, loadWorkbook, parseBudget } from "./parse";
import { parseUnitCosts, unitCostKey } from "./unitcost";

// 노무 행이 없는 내역서는 단가산출(일위대가)의 '직종 : 노임단가 * 인 / Q = 금액' 줄로 품목별 인일을 계산한다.
function makeXls(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["총 공 사 비  집 계 표"],
    ["공사명 : 시험 도로공사"],
    ["공    종", "규 격", "수량", "단위", "합    계", "", "재 료 비", "", "노 무 비", "", "경    비", "", "비  고"],
    ["", "", "", "", "단 가", "금  액", "단 가", "금  액", "단 가", "금  액", "단 가", "금  액"],
    ["1. 토          공", "", "", "", 0, 85, 0, 9, 0, 32, 0, 44],
    ["순  공  사  비", "", "", "", 0, 85, 0, 9, 0, 32, 0, 44],
    ["도   급   액", "", 1, "식", 0, 300],
  ]);
  summary["!merges"] = [{ s: { r: 2, c: 4 }, e: { r: 2, c: 5 } }];
  XLSX.utils.book_append_sheet(wb, summary, "총공사비집계표");
  const detail = XLSX.utils.aoa_to_sheet([
    ["착 공 내 역 서"],
    ["공사명 : 시험 도로공사"],
    ["공    종", "규  격", "수 량", "단위", "합    계", "", "재 료 비", "", "노 무 비", "", "경    비"],
    ["", "", "", "", "단  가", "금  액", "단  가", "금  액", "단  가", "금  액", "단  가", "금  액"],
    ["1. 토         공", "", 0, ""],
    ["유    로    폼", "벽체,0~7m", 100, "㎡", 32257, 3225700, 3053, 305300, 28353, 2835300, 850, 85000],
    ["수  축  줄  눈", "", 10, "M", 2646, 26460, 570, 5700, 2034, 20340, 41, 410],
  ]);
  XLSX.utils.book_append_sheet(wb, detail, "내역서");
  const unit = XLSX.utils.aoa_to_sheet([
    ["단 가 산 출 근 거"],
    ["공  종", "산      출      근      거", "합    계", "재 료 비", "노 무 비", "경    비"],
    ["산근   1 호표 ：유  로  폼 (벽체,0~7m) ㎡ 당"],
    ["", "   형틀목공 : 273,074 * 0.1인 = 27,307.4", 27307.4, "", 27307.4, ""],
    ["", "   보통인부 : 171,037 * 0.05인 = 8,551.9", 8551.9, "", 8551.9, ""],
    ["", "   공구손료 : 659.1 * 3% = 19.7", 19.7, "", "", 19.7],
    ["산근   3 호표 ：터 파 기 ㎥ 당"],
    ["", "    노 무 비 : 58,296 / Q1 = 898.7", 898.7, "", 898.7, ""],
    ["", "    노 무 비 : 50,142 / Q = 551.0", 551, "", 551, ""],
    ["산근   2 호표 ：수 축 줄 눈 M 당"],
    ["", "   1) 보통인부 : 171,037 * 1인 / 500 = 342.0 원/M", 342, "", 342, ""],
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["노 임 단 가"], ["번호", "직종명", "단위", "", "", "", "", "", "", "", "적용단가"], [1, "형틀목공", "인", 0, 0, 0, 0, 0, 0, 0, 273074], [2, "보통인부", "인", 0, 0, 0, 0, 0, 0, 0, 171037], [3, "건설기계운전사", "인", 0, 0, 0, 0, 0, 0, 0, 279824]]), "노임단가");
  XLSX.utils.book_append_sheet(wb, unit, "단가산출");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "biff8" }) as ArrayBuffer);
}

describe("일위대가(단가산출)로 노무 인일 산정", () => {
  it("호표별 직종과 단위당 인일을 읽고, 노임단가가 아닌 줄(공구손료)은 뺀다", async () => {
    const wb = await loadWorkbook(makeXls());
    const costs = parseUnitCosts(wb);
    const form = costs.get(unitCostKey("유 로 폼", "벽체,0~7m"));
    expect(form?.map((l) => [l.trade, Math.round(l.perUnit * 1000) / 1000])).toEqual([
      ["형틀목공", 0.1],
      ["보통인부", 0.05],
    ]);
    expect(costs.get(unitCostKey("수 축 줄 눈", ""))?.[0].perUnit).toBeCloseTo(0.002, 3);
    // 장비 동반 노무: (898.7/58,296 + 551/50,142) 가동시간 ÷ 8 = 건설기계운전사 인일
    const op = costs.get(unitCostKey("터 파 기", ""))?.[0];
    expect(op?.trade).toBe("건설기계운전사");
    expect(op?.perUnit).toBeCloseTo((898.7 / 58296 + 551 / 50142) / 8, 6);
  });

  it("내역서 수량을 곱해 직종별 인일을 만들고, 조립할 때 반올림 경고 없이 '일위대가'로 표시한다", async () => {
    const wb = await loadWorkbook(makeXls());
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    const parsed = parseBudget(wb, layout.mapping);
    expect(parsed.labor.map((l) => [l.trade, Math.round(l.quantity * 100) / 100, l.source])).toEqual([
      ["형틀목공", 10, "일위대가"],
      ["보통인부", 5.02, "일위대가"],
    ]);
    expect(parsed.warnings.some((w) => w.includes("일위대가(단가산출)에서 노무 인일을 계산"))).toBe(true);
    const a = assemblePlanInput(parsed, { start: "2026-11-02", durationDays: 30, holidays: new Set() });
    expect(a.input.laborLines.map((l) => [l.name, l.manDays, l.basis])).toEqual([
      ["형틀목공", 10, "일위대가 노임÷단가 × 내역 수량"],
      ["보통인부", 5, "일위대가 노임÷단가 × 내역 수량"],
    ]);
    expect(a.warnings.filter((w) => w.includes("반올림"))).toEqual([]);
  });
});

// 실제 파일이 있을 때만: SAMPLE_OKRYEOL (옥렬도로 .xls)
describe.skipIf(!process.env.SAMPLE_OKRYEOL)("실제 옥렬도로 일위대가", () => {
  it("품목 대부분이 호표와 맞고 직종별 인일이 나온다", async () => {
    const wb = await loadWorkbook(new Uint8Array(readFileSync(process.env.SAMPLE_OKRYEOL as string)));
    const layout = detectLayout(wb);
    if (!layout.ok) throw new Error("layout");
    const r = parseBudget(wb, layout.mapping);
    const byTrade = new Map<string, number>();
    for (const l of r.labor) byTrade.set(l.trade, (byTrade.get(l.trade) ?? 0) + l.quantity);
    const { writeFileSync } = await import("node:fs");
    const lines = [[...byTrade].map(([t, q]) => `${t} ${Math.round(q)}`).join(", "), ...r.warnings];
    if (process.env.OUT_FILE) writeFileSync(process.env.OUT_FILE, lines.join("\n"));
    expect(r.labor.length).toBeGreaterThan(0);
  }, 60_000);
});

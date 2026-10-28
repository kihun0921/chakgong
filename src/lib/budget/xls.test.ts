import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { checkUpload, detectLayout, loadWorkbook, parseBudget } from "./parse";
import { isOleXls } from "./xls";
import { strip } from "./test-utils";

// 구형 .xls(BIFF8) 내역서 읽기. 실제 착공내역서(옥렬도로)에서 확인한 구조를 합성 .xls로 재현한다.
// - 집계표 이름이 '총공사비집계표', 내역서에 '명칭' 열이 없고 '공종' 열에 품명이 들어 있다
// - 집계표에 '순공사비' 소계 행이 있고 그 아래에 간접노무비·경비·부가세가 이어진다
function makeXls(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["총 공 사 비  집 계 표"],
    ["공사명 : 시험 도로공사"],
    ["공    종", "규 격", "수량", "단위", "합    계", "", "재 료 비", "", "노 무 비", "", "경    비", "", "비  고"],
    ["", "", "", "", "단 가", "금  액", "단 가", "금  액", "단 가", "금  액", "단 가", "금  액"],
    ["1. 토          공", "", "", "", 0, 85, 0, 9, 0, 32, 0, 44],
    ["2. 배    수    공", "", "", "", 0, 7, 0, 1, 0, 6, 0, 0],
    ["순  공  사  비", "", "", "", 0, 92, 0, 10, 0, 38, 0, 44],
    ["5. 간 접 노 무 비", "", 1, "식", 0, 9],
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
    ["흙    쌓    기", "노상", 867, "㎥", 3055, 2648724, 568, 492695, 1850, 1604179],
    ["보통인부", "", 20, "인", 171037, 3420740, 0, 0, 171037, 3420740],
    ["2. 배    수    공", "", 0, ""],
    ["양수기", "", 24, "HR", 0, 0],
  ]);
  XLSX.utils.book_append_sheet(wb, detail, "내역서");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "biff8" }) as ArrayBuffer);
}

describe(".xls 업로드", () => {
  it("확장자가 .xls여도 .xlsx여도 받고, 엑셀이 아니면 거절한다", () => {
    expect(checkUpload({ name: "내역서.xls", size: 1000 })).toEqual({ ok: true });
    expect(checkUpload({ name: "내역서.XLS", size: 1000 })).toEqual({ ok: true });
    expect(checkUpload({ name: "내역서.xlsx", size: 1000 })).toEqual({ ok: true });
    expect(checkUpload({ name: "내역서.pdf", size: 1000 })).toMatchObject({ ok: false });
  });

  it("파일 내용으로 구형 엑셀을 알아본다", () => {
    expect(isOleXls(makeXls())).toBe(true);
    expect(isOleXls(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0]))).toBe(false); // xlsx(zip)
  });

  it("집계표·내역서를 읽는다: 소계 행에서 끝내고 합계로 쓰며, 노무·장비는 구분 행의 공종에 잇는다", async () => {
    const wb = await loadWorkbook(makeXls());
    const layout = detectLayout(wb);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const r = parseBudget(wb, layout.mapping);
    expect(r.summary.map((x) => [x.code, x.name, x.total, x.material, x.labor, x.expense])).toEqual([
      ["S1", "토 공", 85, 9, 32, 44],
      ["S2", "배 수 공", 7, 1, 6, 0],
    ]);
    expect(r.grandTotal).toBe(92);
    expect(r.summaryTotal).toBe(92);
    expect(r.summaryTotalMatchesGrandTotal).toBe(true);
    expect(strip(r.labor)).toEqual([{ code: "S1", trade: "보통인부", quantity: 20, wage: 171037 }]);
    expect(strip(r.equipment)).toEqual([{ code: "S2", name: "양수기", hours: 24 }]);
  });

  it("깨진 .xls는 원인을 알리는 오류를 낸다", async () => {
    const bad = makeXls().slice(0, 600);
    await expect(loadWorkbook(bad)).rejects.toThrow(/\.xls|열 수 없/);
  });
});

// 실제 파일이 있을 때만: 환경변수 SAMPLE_OKRYEOL에 옥렬도로 착공내역서 .xls 경로를 지정한다(고객 자료라 저장소에 넣지 않는다)
describe.skipIf(!process.env.SAMPLE_OKRYEOL)("실제 옥렬도로 착공내역서(.xls)", () => {
  it("순공사비 142,729,831원과 공종 4개, 재료비·노무비·경비 합계가 원가계산서와 같다", async () => {
    const wb = await loadWorkbook(new Uint8Array(readFileSync(process.env.SAMPLE_OKRYEOL as string)));
    const layout = detectLayout(wb);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const r = parseBudget(wb, layout.mapping);
    expect(r.summary.map((x) => [x.name, x.total])).toEqual([
      ["토 공", 85_165_166],
      ["배 수 공", 6_904_137],
      ["포 장 공", 20_803_737],
      ["부 대 공", 29_856_791],
    ]);
    expect(r.summaryTotal).toBe(142_729_831);
    expect(r.grandTotal).toBe(142_729_831);
    expect(r.summaryTotalMatchesGrandTotal).toBe(true);
    expect(r.summary.reduce((a, x) => a + x.material, 0)).toBe(30_245_219);
    expect(r.summary.reduce((a, x) => a + x.labor, 0)).toBe(56_110_540);
    expect(r.summary.reduce((a, x) => a + x.expense, 0)).toBe(56_374_072);
    expect(r.warnings.filter((w) => w.includes("다릅니다"))).toEqual([]);
  }, 60_000);
});

import { describe, expect, it } from "vitest";
import { layoutGantt3D } from "./ganttBars";

// T-65: 공정 진행 3D 시각화는 계산된 일정·보할만 배치한다. 값을 새로 계산하거나 바꾸지 않는다.
const procs = [
  { key: "a", name: "가설", startDay: 1, endDay: 10, weight: 10 },
  { key: "b", name: "토공", startDay: 5, endDay: 30, weight: 40 },
  { key: "c", name: "고재처리", startDay: 20, endDay: 70, weight: -5 },
  { key: "d", name: "협조", startDay: 1, endDay: 70, weight: 0 },
];

describe("공정 3D 배치 (T-65)", () => {
  const l = layoutGantt3D(procs, 70);

  it("공정마다 막대 하나, 공정 순서대로 줄을 준다", () => {
    expect(l.bars.map((b) => [b.key, b.row])).toEqual([["a", 0], ["b", 1], ["c", 2], ["d", 3]]);
    expect(l.rows).toBe(4);
  });

  it("착수·완료 일차를 가로 구간으로 옮긴다(착수일차 1 → 0, 완료일차 10 → 10)", () => {
    expect([l.bars[0].x0, l.bars[0].x1]).toEqual([0, 10]);
    expect([l.bars[1].x0, l.bars[1].x1]).toEqual([4, 30]);
  });

  it("높이는 보할 크기에 비례하고 가장 큰 보할이 최대 높이다", () => {
    expect(l.bars[1].height).toBe(l.maxHeight);
    expect(l.bars[0].height).toBeCloseTo(l.maxHeight / 4, 10);
  });

  it("음수 보할(고재처리)은 크기로 그리고 표시를 붙인다", () => {
    expect(l.bars[2].negative).toBe(true);
    expect(l.bars[2].height).toBeCloseTo(l.maxHeight / 8, 10);
  });

  it("보할이 0인 협조 공정은 얇게 그리고 표시를 붙인다", () => {
    expect(l.bars[3].coop).toBe(true);
    expect(l.bars[3].height).toBeGreaterThan(0);
    expect(l.bars[3].height).toBeLessThan(l.maxHeight / 10);
  });

  it("총 일수는 공기와 가장 늦은 완료일차 중 큰 값이다. 공기 밖 막대에 표시를 붙인다", () => {
    expect(l.totalDays).toBe(70);
    const over = layoutGantt3D([{ key: "x", name: "초과", startDay: 60, endDay: 80, weight: 100 }], 70);
    expect(over.totalDays).toBe(80);
    expect(over.bars[0].outside).toBe(true);
    expect(l.bars.every((b) => !b.outside)).toBe(true);
  });

  it("공정이 없으면 빈 배치다", () => {
    expect(layoutGantt3D([], 70)).toMatchObject({ bars: [], rows: 0, totalDays: 70 });
  });

  it("보할이 전부 0이어도 오류 없이 얇은 막대로 그린다", () => {
    const z = layoutGantt3D([{ key: "z", name: "협조", startDay: 1, endDay: 5, weight: 0 }], 10);
    expect(z.bars[0].height).toBeGreaterThan(0);
  });

  it("입력을 바꾸지 않고 같은 입력이면 같은 결과다(SR-NF-08)", () => {
    const copy = JSON.parse(JSON.stringify(procs));
    expect(layoutGantt3D(procs, 70)).toEqual(layoutGantt3D(copy, 70));
    expect(procs).toEqual(copy);
  });
});

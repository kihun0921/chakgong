// 공사예정공정표·인원 및 장비투입계획표 서류 명세 (SRS 8.1·8.2, SR-OUT-03)
// 계산 결과(PlanResult)를 실제 제출본처럼 막대 그래프 격자(A3 가로)로 옮긴다.
//   - 공정표: 공정마다 일정 막대와 구간별 진도율, 아래에 합계·구간 진도율·누계
//   - 투입계획표: 장비투입·인원투입 직종별 구간 값과 소계, 일평균 투입인원

import { diffDays, addDays, type Period } from "../calendar";
import type { ResourcePlan } from "../labor";
import type { PlanResult } from "../plan";
import { type Process } from "../progress";
import type { Block, DocInput, DocSpec, GanttRow, LocationSpan, PeriodHeader, ResourceRow } from "./model";

/** 서류로 옮길 계산 결과와 그 계산에 쓴 입력 */
export type PlanDocData = {
  processes: Process[];
  result: PlanResult;
  /** 집계표 순공사비 합계(원) */
  summaryTotalWon: number;
  /** 공정표 '주요 공정내용' (공정 키 → 글) */
  remarks?: Record<string, string>;
  /** 투입계획표 '위치별' 작업 구간 */
  locations?: LocationSpan[];
};

/** 줄 수가 많을수록 글자를 줄여 한 페이지에 맞춘다 */
export function fontSizeForRows(rows: number): number {
  if (rows <= 15) return 9;
  if (rows <= 25) return 8;
  if (rows <= 40) return 7;
  if (rows <= 60) return 6;
  return 5;
}

const A3: DocSpec["page"] = { size: "A3", landscape: true };

/** 연·월·구간 끝 날짜 머리글 */
export function periodHeader(periods: readonly Period[]): PeriodHeader {
  const group = (key: (p: Period) => string, label: (p: Period) => string) => {
    const out: { label: string; from: number; to: number; key: string }[] = [];
    periods.forEach((p, k) => {
      const kk = key(p);
      const last = out.at(-1);
      if (last && last.key === kk) last.to = k;
      else out.push({ key: kk, label: label(p), from: k, to: k });
    });
    return out.map(({ label, from, to }) => ({ label, from, to }));
  };
  return {
    years: group((p) => p.start.slice(0, 4), (p) => `${p.start.slice(0, 4)}년`),
    months: group((p) => p.start.slice(0, 7), (p) => `${Number(p.start.slice(5, 7))}월`),
    days: periods.map((p) => Number(p.end.slice(8, 10))),
  };
}

/** 날짜의 구간 단위 위치: 구간 번호 + 구간 안에서 지난 비율 (끝 날짜는 그날의 끝까지) */
function position(periods: readonly Period[], date: string, atEnd: boolean): number {
  const k = periods.findIndex((p) => p.start <= date && date <= p.end);
  if (k < 0) return date < periods[0].start ? 0 : periods.length;
  const p = periods[k];
  const len = diffDays(p.start, p.end) + 1;
  return k + (diffDays(p.start, date) + (atEnd ? 1 : 0)) / len;
}

const periodText = (input: DocInput, completion: string) => `${input.startDate.replace(/-/g, ".")} ~ ${completion.replace(/-/g, ".")} (${input.durationDays.toLocaleString("ko-KR")}日)`;

export function buildScheduleDoc(input: DocInput, plan: PlanDocData): DocSpec {
  const { processes, result } = plan;
  const start = input.startDate as string;
  const periods = result.periods;
  const totalWeight = result.progress.rows.reduce((s, r) => s + r.weight, 0);
  const totalAmount = processes.reduce((s, p) => s + p.amount, 0);

  const rows: GanttRow[] = processes.map((p, i) => ({
    name: p.amount === 0 ? `${p.name} (협조)` : p.name,
    weight: result.progress.rows[i].weight,
    amount: p.amount,
    values: result.progress.rows[i].byPeriod,
    bar: [position(periods, addDays(start, p.startDay - 1), false), position(periods, addDays(start, p.endDay - 1), true)],
    remark: plan.remarks?.[p.key]?.trim() ?? "",
  }));

  const blocks: Block[] = [
    {
      type: "gantt",
      title: "예 정 공 정 표",
      projectName: input.projectName,
      rightNote: periodText(input, result.completion),
      periods: periodHeader(periods),
      rows,
      totals: { weight: totalWeight, amount: totalAmount, byPeriod: result.progress.periodTotals, cumulative: result.progress.cumulative },
    },
  ];

  return {
    id: "schedule",
    title: "공사예정공정표",
    toc: [4],
    page: A3,
    facts: { projectName: input.projectName, startDate: start, completionDate: result.completion },
    blocks,
  };
}

function resourceRows(plan: ResourcePlan, unit: string): ResourceRow[] {
  const rows: ResourceRow[] = Object.entries(plan.byName).map(([name, values]) => {
    const assumed = plan.basisList.filter((b) => b.name === name).some((b) => b.method !== "내역서");
    return { name: assumed ? `${name} ▲` : name, total: values.reduce((s, v) => s + v, 0), unit, values };
  });
  rows.push({ name: "소    계", total: plan.total, unit, values: plan.periodTotals, bold: true });
  return rows;
}

/** '위치별' 줄: 일차 범위를 구간 단위 막대로 */
function locationGroup(input: DocInput, plan: PlanDocData): { label: string; rows: ResourceRow[] }[] {
  const locs = (plan.locations ?? []).filter((l) => l.name.trim() !== "" && l.startDay >= 1 && l.endDay >= l.startDay);
  if (locs.length === 0) return [];
  const periods = plan.result.periods;
  const start = input.startDate as string;
  return [
    {
      label: "위\n치\n별",
      rows: locs.map((l) => ({
        name: l.name.trim(),
        total: 0,
        unit: "",
        values: periods.map(() => 0),
        bar: [position(periods, addDays(start, l.startDay - 1), false), position(periods, addDays(start, l.endDay - 1), true)] as [number, number],
        remark: l.remark.trim(),
      })),
    },
  ];
}

export function buildLaborDoc(input: DocInput, plan: PlanDocData): DocSpec {
  const { result } = plan;
  const periods = result.periods;
  const equipment = resourceRows(result.equipment, "대");
  const labor = resourceRows(result.labor, "인");
  labor.push({
    name: "일평균 투입인원 (명/일)",
    total: 0,
    unit: "명",
    values: result.dailyAverage.map((v) => (v === null ? 0 : v)),
    bold: true,
    decimals: 1,
  });

  const notes = [
    "근무일은 주 5일(월~금)에서 공휴일을 뺀 일수이며, 구간별 값은 작업일수에 비례해 정수로 나누었고 합이 총량과 같습니다.",
    "보할·진도율은 집계표의 순공사비 기준입니다.",
  ];
  const assumed = result.labor.assumedTotal + result.equipment.assumedTotal;
  if (assumed > 0) {
    notes.unshift(
      `▲ 표시는 환산·생산성·직접 지정(가정)으로 만든 값이 포함된 항목입니다 (인원 ${result.labor.assumedTotal.toLocaleString("ko-KR")}인일, 장비 ${result.equipment.assumedTotal.toLocaleString("ko-KR")}대·일). 가정치는 현장 상황에 따라 달라질 수 있습니다.`,
    );
  }

  return {
    id: "labor",
    title: "인원 및 장비투입계획표",
    toc: [9],
    page: A3,
    facts: { projectName: input.projectName, startDate: input.startDate as string, completionDate: result.completion },
    blocks: [
      {
        type: "resource",
        title: "인원 및 장비투입계획표",
        projectName: input.projectName,
        rightNote: periodText(input, result.completion),
        periods: periodHeader(periods),
        groups: [
          ...locationGroup(input, plan),
          { label: "장\n비\n투\n입", rows: equipment },
          { label: "인\n원\n투\n입", rows: labor },
        ],
        notes,
      },
    ],
  };
}

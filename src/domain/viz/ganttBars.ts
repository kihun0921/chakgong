// 공정 진행 3D 시각화 배치 (SRS SR-VZ-01)
// 이미 계산된 일정(착수·완료 일차)과 보할만 막대 위치·높이로 옮긴다. 값을 새로 계산하거나 바꾸지 않는다.
// 순수 함수: 같은 입력이면 같은 결과다(SR-NF-08). 화면(Three.js)은 이 결과를 그리기만 한다.

export type BarInput = { key: string; name: string; startDay: number; endDay: number; /** 보할(%) */ weight: number };

export type Bar = {
  key: string;
  name: string;
  /** 가로 구간(일). 착수일차 1 → 0, 완료일차 N → N */
  x0: number;
  x1: number;
  /** 공정 순서(앞쪽부터 0) */
  row: number;
  height: number;
  weight: number;
  /** 음수 보할(고재처리 등) */
  negative: boolean;
  /** 보할 0(협조 공정) */
  coop: boolean;
  /** 공기를 넘는 막대 */
  outside: boolean;
};

export type GanttLayout = { bars: Bar[]; rows: number; totalDays: number; maxHeight: number };

export const DEFAULT_MAX_HEIGHT = 10;
/** 보할 0이어도 보이도록 주는 최소 높이(최대 높이의 2%) */
const MIN_RATIO = 0.02;

export function layoutGantt3D(processes: BarInput[], durationDays: number, maxHeight: number = DEFAULT_MAX_HEIGHT): GanttLayout {
  const maxAbs = processes.reduce((m, p) => Math.max(m, Math.abs(p.weight)), 0);
  const minHeight = maxHeight * MIN_RATIO;
  const bars: Bar[] = processes.map((p, row) => ({
    key: p.key,
    name: p.name,
    x0: p.startDay - 1,
    x1: p.endDay,
    row,
    height: maxAbs === 0 ? minHeight : Math.max((Math.abs(p.weight) / maxAbs) * maxHeight, minHeight),
    weight: p.weight,
    negative: p.weight < 0,
    coop: p.weight === 0,
    outside: p.endDay > durationDays,
  }));
  const lastEnd = processes.reduce((m, p) => Math.max(m, p.endDay), 0);
  return { bars, rows: bars.length, totalDays: Math.max(durationDays, lastEnd), maxHeight };
}

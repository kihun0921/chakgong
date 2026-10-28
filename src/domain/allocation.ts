// 누적 반올림 배분 (SRS SR-RS-04, 6.5)
// 구간 값 = round(총량 × 누적비율_k) − round(총량 × 누적비율_{k−1}). 모든 값이 정수이고 합이 총량과 같다.

import { addDays, countWorkdays, diffDays, type DateStr, type Period } from "./calendar";

/**
 * 가중치 비율로 총량(정수)을 구간에 나눈다. 반올림은 .5를 올림(엑셀 ROUND)한다.
 * 부동소수 오차를 피하려고 정수 연산만 쓴다.
 */
export function allocateByCumulativeRounding(total: number, weights: readonly number[]): number[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError("배분할 총량은 0 이상의 정수여야 합니다.");
  }
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) {
    throw new RangeError("가중치는 0 이상의 정수여야 합니다.");
  }
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total === 0) return weights.map(() => 0);
  if (sum === 0) throw new RangeError("가중치 합이 0이라 배분할 수 없습니다.");

  const out: number[] = [];
  let cum = 0;
  let prevRounded = 0;
  for (const w of weights) {
    cum += w;
    // round(total × cum / sum) = floor((2·total·cum + sum) / (2·sum))
    const rounded = Math.floor((2 * total * cum + sum) / (2 * sum));
    out.push(rounded - prevRounded);
    prevRounded = rounded;
  }
  return out;
}

/**
 * 한 공정의 총량을 구간에 배분한다. 가중치는 공정 일정(from~to)과 겹치는 작업일수다.
 * 공정 기간이 전부 휴일이라 작업일수가 0이면 달력일수로 배분한다.
 */
export function distributeOverPeriods(
  total: number,
  from: DateStr,
  to: DateStr,
  periods: readonly Period[],
  holidays: ReadonlySet<DateStr>,
): number[] {
  const overlap = (per: Period): [DateStr, DateStr] => [
    per.start > from ? per.start : from,
    per.end < to ? per.end : to,
  ];
  let weights = periods.map((per) => {
    const [a, b] = overlap(per);
    return countWorkdays(a, b, holidays);
  });
  if (weights.every((w) => w === 0)) {
    weights = periods.map((per) => {
      const [a, b] = overlap(per);
      return Math.max(0, diffDays(a, b) + 1);
    });
  }
  return allocateByCumulativeRounding(total, weights);
}

/** 일차 → 날짜 (착공일 = 1일차) */
export function dayToDate(projectStart: DateStr, day: number): DateStr {
  return addDays(projectStart, day - 1);
}

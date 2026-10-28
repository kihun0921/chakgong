// 일정 계산 (SRS SR-SC-05, SR-RS-03, SR-PG-02, 6.2~6.3)
// 날짜는 'yyyy-mm-dd' 문자열로 다루고, 계산은 UTC로 해서 시간대 영향을 받지 않게 한다.

export type DateStr = string;

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(s: DateStr): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`날짜 형식이 올바르지 않습니다: ${s}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (formatDate(d) !== s) throw new RangeError(`존재하지 않는 날짜입니다: ${s}`);
  return d;
}

export function formatDate(d: Date): DateStr {
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(s: DateStr, n: number): DateStr {
  return formatDate(new Date(parseDate(s).getTime() + n * DAY_MS));
}

/** 달력일 차이(to − from). */
export function diffDays(from: DateStr, to: DateStr): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS);
}

/** 준공예정일 = 착공일 + 공사기간 − 1 (SR-SC-05) */
export function completionDate(start: DateStr, durationDays: number): DateStr {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new RangeError("공사기간은 1 이상의 정수(일)여야 합니다.");
  }
  return addDays(start, durationDays - 1);
}

/** 월~금이고 공휴일이 아니면 작업일이다 (SR-RS-03). */
export function isWorkday(s: DateStr, holidays: ReadonlySet<DateStr>): boolean {
  const dow = parseDate(s).getUTCDay(); // 0=일, 6=토
  return dow !== 0 && dow !== 6 && !holidays.has(s);
}

/** from~to(양끝 포함)의 작업일수. to가 from보다 앞서면 0. */
export function countWorkdays(
  from: DateStr,
  to: DateStr,
  holidays: ReadonlySet<DateStr>,
): number {
  const span = diffDays(from, to);
  if (span < 0) return 0;
  let count = 0;
  for (let i = 0; i <= span; i++) {
    if (isWorkday(addDays(from, i), holidays)) count++;
  }
  return count;
}

export type Period = { index: number; start: DateStr; end: DateStr };

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * 반월 구간 만들기 (6.2): 착공일이 속한 달의 상순(1~15일)부터 상순·하순(16일~말일)을 번갈아,
 * 준공일을 덮을 때까지 만든다.
 */
export function buildPeriods(start: DateStr, durationDays: number): Period[] {
  const end = completionDate(start, durationDays);
  const s = parseDate(start);
  let year = s.getUTCFullYear();
  let month = s.getUTCMonth() + 1;
  let upper = true; // true: 상순
  const periods: Period[] = [];
  for (;;) {
    const last = lastDayOfMonth(year, month);
    const ps = formatDate(new Date(Date.UTC(year, month - 1, upper ? 1 : 16)));
    const pe = formatDate(new Date(Date.UTC(year, month - 1, upper ? 15 : last)));
    periods.push({ index: periods.length, start: ps, end: pe });
    if (pe >= end) break;
    if (upper) {
      upper = false;
    } else {
      upper = true;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return periods;
}

/** 구간 중 공기(착공일~준공일) 안에 드는 작업일수. 일평균 계산용 (SR-RS-06). */
export function periodWorkdays(
  period: Period,
  start: DateStr,
  durationDays: number,
  holidays: ReadonlySet<DateStr>,
): number {
  const from = period.start > start ? period.start : start;
  const completion = completionDate(start, durationDays);
  const to = period.end < completion ? period.end : completion;
  return countWorkdays(from, to, holidays);
}

/** 구간 이름: '11월 상순' / '11월 하순' (공정표·투입계획표 머리글) */
export function periodLabel(p: Period): string {
  const month = Number(p.start.slice(5, 7));
  return `${month}월 ${p.start.endsWith("-01") ? "상순" : "하순"}`;
}

// 핵심 검증 (SRS SR-VR-01~03·05·06·07, 6.8)
// V-1 금액, V-2 진도율, V-3 연인원·장비, 공기 초과. 서류 간 일치(V-4)는 서류 생성 단계(Wave 2)에서 다룬다.

import { round2 } from "./progress";

export type CoreCheckInput = {
  /** 공정표 순공사비 합계(원) */
  processTotalWon: number;
  /** 집계표 순공사비 합계(원) */
  summaryTotalWon: number;
  /** 구간 진도율 누계 최종값(%) */
  cumulativeLast: number;
  /** 연인원(인일) 합계: 공정표·투입계획표·산정근거 */
  laborTotals: { schedule: number; plan: number; basis: number };
  /** 장비(대·일) 합계 */
  equipmentTotals: { schedule: number; plan: number; basis: number };
  processes: { key: string; endDay: number }[];
  durationDays: number;
};

export type Issue =
  | { code: "V-1"; message: string; diffWon: number }
  | { code: "V-2"; message: string; cumulativeLast: number }
  | { code: "V-3"; message: string }
  | { code: "DURATION"; message: string; processKey: string };

export type ValidationResult = { passed: boolean; issues: Issue[] };

const same = (t: { schedule: number; plan: number; basis: number }) =>
  t.schedule === t.plan && t.plan === t.basis;

export function validateCore(input: CoreCheckInput): ValidationResult {
  const issues: Issue[] = [];

  const diffWon = input.processTotalWon - input.summaryTotalWon;
  if (diffWon !== 0) {
    issues.push({
      code: "V-1",
      diffWon,
      message: `공정표 순공사비 합계가 집계표와 ${diffWon.toLocaleString("ko-KR")}원 다릅니다.`,
    });
  }

  if (round2(input.cumulativeLast) !== 100) {
    issues.push({
      code: "V-2",
      cumulativeLast: input.cumulativeLast,
      message: `진도율 누계 최종값이 100.00%가 아닙니다(${round2(input.cumulativeLast)}%).`,
    });
  }

  if (!same(input.laborTotals)) {
    const t = input.laborTotals;
    issues.push({
      code: "V-3",
      message: `연인원 합계가 서로 다릅니다 (공정표 ${t.schedule}, 투입계획표 ${t.plan}, 산정근거 ${t.basis}).`,
    });
  }
  if (!same(input.equipmentTotals)) {
    const t = input.equipmentTotals;
    issues.push({
      code: "V-3",
      message: `장비 대·일 합계가 서로 다릅니다 (공정표 ${t.schedule}, 투입계획표 ${t.plan}, 산정근거 ${t.basis}).`,
    });
  }

  for (const p of input.processes) {
    if (p.endDay > input.durationDays) {
      issues.push({
        code: "DURATION",
        processKey: p.key,
        message: `공정 ${p.key}의 완료일차(${p.endDay})가 공사기간(${input.durationDays}일)을 넘습니다.`,
      });
    }
  }

  return { passed: issues.length === 0, issues };
}

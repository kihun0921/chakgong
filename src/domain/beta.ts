// 베타 기록과 KPI 판정 (SRS SR-NF-22·23, D-11, 13.3 / PRD 1장)
// 보완 요구 횟수는 발주기관 회신을 사람이 알려 줘야 알 수 있어, 시스템이 재지 않고 관리자가 베타 공사별로 직접 기록한다.

export type BetaNote = {
  projectId: string;
  /** 발주기관이 첫 제출에서 요구한 보완 횟수. 모르면 null */
  supplementRequests: number | null;
  /** 그중 수치·표기 불일치가 원인인 횟수 */
  supplementDueToMismatch: number | null;
  /** 같은 공사를 수작업으로 만들 때 걸리는(걸린) 시간, 분 */
  manualMinutes: number | null;
  /** 수작업 결과와 비교한 메모 */
  comparison: string;
  /** 관리자가 '이대로 제출 가능한 수준'이라고 확인했는가. 아직 안 봤으면 null */
  submittable: boolean | null;
  updatedAt: string;
  updatedBy: string;
};

export const KPI_TARGET = 0.9;
export const KPI_PIVOT = 0.5;
export const MIN_SAMPLE = 3;

export type KpiVerdict = "pass" | "improve" | "pivot" | "none";
export type KpiJudgement = { verdict: KpiVerdict; label: string; caution: string | null };

/** 북극성 KPI 판정: 90% 이상 달성, 50% 미만 피봇, 그 사이는 개선 필요 (PRD 1장). */
export function judgeKpi(rate: number | null, started: number): KpiJudgement {
  if (rate === null || started === 0) return { verdict: "none", label: "판정할 공사가 아직 없습니다", caution: null };
  const caution = started < MIN_SAMPLE ? `시작한 공사가 ${started}건뿐이라 참고용입니다(${MIN_SAMPLE}건 이상에서 판정).` : null;
  if (rate >= KPI_TARGET) return { verdict: "pass", label: "목표 달성(90% 이상)", caution };
  if (rate < KPI_PIVOT) return { verdict: "pivot", label: "피봇 검토(50% 미만)", caution };
  return { verdict: "improve", label: "개선 필요(50% 이상 90% 미만)", caution };
}

const asCount = (v: unknown): number | null | "bad" => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 100_000 ? n : "bad";
};

export type BetaInput = Omit<BetaNote, "projectId" | "updatedAt" | "updatedBy">;

/** 화면에서 온 값을 검사해 정리한다. 빈 값은 '아직 모름(null)'. */
export function validateBetaNote(input: Record<string, unknown>): { ok: true; value: BetaInput } | { ok: false; error: string } {
  const sr = asCount(input.supplementRequests);
  const sm = asCount(input.supplementDueToMismatch);
  const mm = asCount(input.manualMinutes);
  if (sr === "bad" || sm === "bad" || mm === "bad") return { ok: false, error: "횟수와 시간은 0 이상의 정수로 입력해 주세요." };
  if (sr !== null && sm !== null && sm > sr) return { ok: false, error: "불일치 원인 횟수는 전체 보완 요구 횟수보다 클 수 없습니다." };
  const submittable = input.submittable === true ? true : input.submittable === false ? false : null;
  return {
    ok: true,
    value: {
      supplementRequests: sr,
      supplementDueToMismatch: sm,
      manualMinutes: mm,
      comparison: typeof input.comparison === "string" ? input.comparison.trim().slice(0, 1000) : "",
      submittable,
    },
  };
}

export type BetaSummary = {
  notes: number;
  supplementRequests: number;
  supplementDueToMismatch: number;
  submittable: { yes: number; no: number; unknown: number };
  /** 수작업 시간과 도구 시간을 둘 다 아는 공사 수와 그 합계(분) */
  measured: number;
  manualMinutes: number;
  toolMinutes: number;
};

/** toolMinutesByProject: 공사별 도구로 걸린 시간(분). 이력의 시작→첫 납품에서 가져온다. */
export function summarizeBeta(notes: BetaNote[], toolMinutesByProject: Map<string, number>): BetaSummary {
  const s: BetaSummary = {
    notes: notes.length,
    supplementRequests: 0,
    supplementDueToMismatch: 0,
    submittable: { yes: 0, no: 0, unknown: 0 },
    measured: 0,
    manualMinutes: 0,
    toolMinutes: 0,
  };
  for (const n of notes) {
    s.supplementRequests += n.supplementRequests ?? 0;
    s.supplementDueToMismatch += n.supplementDueToMismatch ?? 0;
    if (n.submittable === true) s.submittable.yes++;
    else if (n.submittable === false) s.submittable.no++;
    else s.submittable.unknown++;
    const tool = toolMinutesByProject.get(n.projectId);
    if (n.manualMinutes !== null && tool !== undefined) {
      s.measured++;
      s.manualMinutes += n.manualMinutes;
      s.toolMinutes += tool;
    }
  }
  return s;
}

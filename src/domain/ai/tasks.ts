// Gemini 보조 기능 4종의 입력 검사·프롬프트·응답 검사 (SRS SR-AI-01~05)
// 순수 함수. AI는 이름·문안·설명만 제안하고, 금액·일정 계산과 검증 판정은 바꾸지 않는다.
// 제안은 관리자가 확인한 뒤에만 반영한다. 허용한 항목만 골라 담고, 개인정보로 보이는 값이 있으면 보내지 않는다.

import { detectPii } from "./guard";

export type AiTaskName = "parseAssist" | "remarkDraft" | "validationExplain" | "followUp";
export const AI_TASKS: readonly AiTaskName[] = ["parseAssist", "remarkDraft", "validationExplain", "followUp"];

export const FOLLOW_UP_STAGES = ["delivered3", "feedback30", "nextBid60", "referral"] as const;
export type FollowUpStage = (typeof FOLLOW_UP_STAGES)[number];

export type AiInputs = {
  parseAssist: { items: { id: string; name: string; amountWon: number }[] };
  remarkDraft: { durationDays: number; processes: { key: string; name: string; startDay: number; endDay: number }[] };
  validationExplain: { issues: { code: string; message: string }[] };
  followUp: { stage: FollowUpStage };
};

export type AiOutputs = {
  parseAssist: { suggestions: { id: string; name: string; reason: string }[] };
  remarkDraft: { drafts: { key: string; text: string }[] };
  validationExplain: { summary: string; steps: string[] };
  followUp: { body: string };
};

export const LIMITS = {
  items: 80,
  idChars: 100,
  nameChars: 80,
  issueMessageChars: 300,
  issues: 20,
  suggestedNameChars: 60,
  reasonChars: 120,
  remarkChars: 60,
  summaryChars: 300,
  stepChars: 200,
  steps: 6,
  bodyMin: 20,
  bodyMax: 700,
} as const;

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = <T,>(error: string): Check<T> => ({ ok: false, error });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" && v.length <= max ? v : null);
const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

function piiError(texts: string[]): string | null {
  const kinds = new Set(texts.flatMap((t) => detectPii(t)));
  return kinds.size === 0 ? null : `개인정보로 보이는 값(${[...kinds].join(", ")})이 있어 AI로 보내지 않았습니다.`;
}

// ── 입력 ──────────────────────────────────────────────

function parseAssistInput(raw: unknown): Check<AiInputs["parseAssist"]> {
  if (!isObj(raw) || !Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > LIMITS.items) {
    return fail(`항목은 1~${LIMITS.items}개여야 합니다.`);
  }
  const items: AiInputs["parseAssist"]["items"] = [];
  for (const it of raw.items) {
    if (!isObj(it)) return fail("항목 형식이 올바르지 않습니다.");
    const id = str(it.id, LIMITS.idChars);
    const name = str(it.name, LIMITS.nameChars);
    const amountWon = typeof it.amountWon === "number" && Number.isFinite(it.amountWon) ? it.amountWon : null;
    if (id === null || name === null || amountWon === null) return fail("항목의 id·이름·금액이 올바르지 않습니다.");
    items.push({ id, name, amountWon });
  }
  return { ok: true, value: { items } };
}

function remarkDraftInput(raw: unknown): Check<AiInputs["remarkDraft"]> {
  if (!isObj(raw) || !Array.isArray(raw.processes) || raw.processes.length === 0 || raw.processes.length > LIMITS.items) {
    return fail(`공정은 1~${LIMITS.items}개여야 합니다.`);
  }
  const durationDays = int(raw.durationDays, 1, 3650);
  if (durationDays === null) return fail("공사기간이 올바르지 않습니다.");
  const processes: AiInputs["remarkDraft"]["processes"] = [];
  for (const p of raw.processes) {
    if (!isObj(p)) return fail("공정 형식이 올바르지 않습니다.");
    const key = str(p.key, LIMITS.idChars);
    const name = str(p.name, LIMITS.nameChars);
    const startDay = int(p.startDay, 1, 3650);
    const endDay = int(p.endDay, 1, 3650);
    if (key === null || name === null || startDay === null || endDay === null) return fail("공정의 키·이름·일차가 올바르지 않습니다.");
    processes.push({ key, name, startDay, endDay });
  }
  return { ok: true, value: { durationDays, processes } };
}

function validationExplainInput(raw: unknown): Check<AiInputs["validationExplain"]> {
  if (!isObj(raw) || !Array.isArray(raw.issues) || raw.issues.length === 0 || raw.issues.length > LIMITS.issues) {
    return fail(`검증 항목은 1~${LIMITS.issues}개여야 합니다.`);
  }
  const issues: AiInputs["validationExplain"]["issues"] = [];
  for (const i of raw.issues) {
    if (!isObj(i)) return fail("검증 항목 형식이 올바르지 않습니다.");
    const code = str(i.code, 20);
    const message = str(i.message, LIMITS.issueMessageChars);
    if (code === null || message === null) return fail("검증 항목의 코드·메시지가 올바르지 않습니다.");
    issues.push({ code, message });
  }
  return { ok: true, value: { issues } };
}

function followUpInput(raw: unknown): Check<AiInputs["followUp"]> {
  if (!isObj(raw) || typeof raw.stage !== "string" || !(FOLLOW_UP_STAGES as readonly string[]).includes(raw.stage)) {
    return fail("응대 단계가 올바르지 않습니다.");
  }
  return { ok: true, value: { stage: raw.stage as FollowUpStage } };
}

/** 허용한 항목만 골라 담고 개인정보를 검사한다. 그 밖의 항목은 버린다. */
export function validateInput<T extends AiTaskName>(task: T, raw: unknown): Check<AiInputs[T]> {
  let r: Check<unknown>;
  switch (task) {
    case "parseAssist":
      r = parseAssistInput(raw);
      break;
    case "remarkDraft":
      r = remarkDraftInput(raw);
      break;
    case "validationExplain":
      r = validationExplainInput(raw);
      break;
    case "followUp":
      r = followUpInput(raw);
      break;
    default:
      return fail("알 수 없는 AI 기능입니다.");
  }
  if (!r.ok) return r as Check<AiInputs[T]>;
  const error = piiError(collectStrings(r.value));
  return error ? fail(error) : (r as Check<AiInputs[T]>);
}

function collectStrings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(collectStrings);
  if (isObj(v)) return Object.values(v).flatMap(collectStrings);
  return [];
}

// ── 프롬프트 ──────────────────────────────────────────

const COMMON_RULES = [
  "당신은 한국 건설 착공 서류 작성을 돕는 보조자입니다. 한국어로 짧고 정확하게 씁니다.",
  "응답은 지정한 JSON 한 개만 출력합니다. 설명 문장이나 코드 블록을 붙이지 않습니다.",
  "금액·일정·수량 같은 숫자를 새로 만들거나 바꾸지 않습니다. 입력에 없는 사실을 지어내지 않습니다.",
  "개인정보(주민등록번호·전화번호·주소·계좌번호·사업자등록번호)는 쓰지 않습니다.",
];

export function buildPrompt<T extends AiTaskName>(task: T, input: AiInputs[T]): { system: string; prompt: string } {
  const data = JSON.stringify(input);
  switch (task) {
    case "parseAssist":
      return {
        system: [
          ...COMMON_RULES,
          "내역서에서 읽은 공정(공종) 이름을 서류에 쓰기 좋게 정리하는 이름을 제안합니다.",
          "번호·기호 접두어와 군더더기를 지우고 뜻이 바뀌지 않게 합니다. 바꿀 필요가 없으면 제안하지 않습니다.",
          '출력 형식: {"suggestions":[{"id":"입력의 id","name":"정리한 이름","reason":"한 줄 이유"}]}',
        ].join("\n"),
        prompt: `공정 목록(JSON): ${data}`,
      };
    case "remarkDraft":
      return {
        system: [
          ...COMMON_RULES,
          `공사예정공정표의 '주요 공정내용' 칸에 들어갈 짧은 문안(${LIMITS.remarkChars}자 이내)을 공정마다 제안합니다.`,
          "공정 이름에서 흔히 하는 작업을 명사형으로 씁니다. 확실하지 않은 공정은 건너뜁니다.",
          '출력 형식: {"drafts":[{"key":"입력의 key","text":"문안"}]}',
        ].join("\n"),
        prompt: `공정과 일정(JSON): ${data}`,
      };
    case "validationExplain":
      return {
        system: [
          ...COMMON_RULES,
          "서류 검증이 통과하지 못한 이유를 비전문가도 알 수 있게 풀어 쓰고, 고치는 순서를 제안합니다.",
          "검증 판정을 바꾸거나 통과로 단정하지 않습니다. 입력의 메시지 안 숫자만 인용합니다.",
          `출력 형식: {"summary":"요약","steps":["조치 1","조치 2"]} (조치는 ${LIMITS.steps}개 이내)`,
        ].join("\n"),
        prompt: `검증 결과(JSON): ${data}`,
      };
    case "followUp":
      return {
        system: [
          ...COMMON_RULES,
          "착공 서류를 납품한 시공사에 관리자가 보낼 정중한 안내 문안 초안을 씁니다. 링크·연락처는 넣지 않습니다.",
          "단계: delivered3=납품 3~5일 뒤 제출 결과·보완 요구 확인, feedback30=30일 뒤 만족도·불편한 점·소개 가능 업체 문의, nextBid60=60~90일 뒤 다음 낙찰·착공 예정 문의, referral=소개 요청.",
          `출력 형식: {"body":"본문"} (${LIMITS.bodyMin}~${LIMITS.bodyMax}자)`,
        ].join("\n"),
        prompt: `단계(JSON): ${data}`,
      };
    default:
      throw new Error("알 수 없는 AI 기능입니다.");
  }
}

// ── 응답 ──────────────────────────────────────────────

function readJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

function parseAssistOutput(v: unknown, input: AiInputs["parseAssist"]): Check<AiOutputs["parseAssist"]> {
  if (!isObj(v) || !Array.isArray(v.suggestions)) return fail("제안 형식이 올바르지 않습니다.");
  const names = new Map(input.items.map((i) => [i.id, i.name]));
  const seen = new Set<string>();
  const suggestions: AiOutputs["parseAssist"]["suggestions"] = [];
  for (const s of v.suggestions) {
    if (!isObj(s)) return fail("제안 형식이 올바르지 않습니다.");
    const id = typeof s.id === "string" ? s.id : "";
    if (!names.has(id)) return fail("입력에 없는 항목에 대한 제안입니다.");
    if (seen.has(id)) return fail("같은 항목의 제안이 두 번 왔습니다.");
    seen.add(id);
    const name = typeof s.name === "string" ? s.name.trim() : "";
    if (name === "" || name.length > LIMITS.suggestedNameChars) return fail("제안한 이름이 올바르지 않습니다.");
    const reason = typeof s.reason === "string" ? s.reason.trim().slice(0, LIMITS.reasonChars) : "";
    if (name === names.get(id)?.trim()) continue;
    suggestions.push({ id, name, reason });
  }
  return { ok: true, value: { suggestions } };
}

function remarkDraftOutput(v: unknown, input: AiInputs["remarkDraft"]): Check<AiOutputs["remarkDraft"]> {
  if (!isObj(v) || !Array.isArray(v.drafts)) return fail("문안 형식이 올바르지 않습니다.");
  const keys = new Set(input.processes.map((p) => p.key));
  const seen = new Set<string>();
  const drafts: AiOutputs["remarkDraft"]["drafts"] = [];
  for (const d of v.drafts) {
    if (!isObj(d)) return fail("문안 형식이 올바르지 않습니다.");
    const key = typeof d.key === "string" ? d.key : "";
    if (!keys.has(key)) return fail("입력에 없는 공정에 대한 문안입니다.");
    if (seen.has(key)) return fail("같은 공정의 문안이 두 번 왔습니다.");
    seen.add(key);
    const text = typeof d.text === "string" ? d.text.trim() : "";
    if (text === "" || text.length > LIMITS.remarkChars) return fail("문안 길이가 올바르지 않습니다.");
    drafts.push({ key, text });
  }
  const error = piiError(drafts.map((d) => d.text));
  return error ? fail(error) : { ok: true, value: { drafts } };
}

function validationExplainOutput(v: unknown): Check<AiOutputs["validationExplain"]> {
  if (!isObj(v)) return fail("설명 형식이 올바르지 않습니다.");
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  if (summary === "" || summary.length > LIMITS.summaryChars) return fail("요약 길이가 올바르지 않습니다.");
  if (!Array.isArray(v.steps) || v.steps.length === 0 || v.steps.length > LIMITS.steps) return fail("조치 단계 수가 올바르지 않습니다.");
  const steps: string[] = [];
  for (const s of v.steps) {
    const t = typeof s === "string" ? s.trim() : "";
    if (t === "" || t.length > LIMITS.stepChars) return fail("조치 단계 길이가 올바르지 않습니다.");
    steps.push(t);
  }
  const error = piiError([summary, ...steps]);
  return error ? fail(error) : { ok: true, value: { summary, steps } };
}

function followUpOutput(v: unknown): Check<AiOutputs["followUp"]> {
  if (!isObj(v)) return fail("문안 형식이 올바르지 않습니다.");
  const body = typeof v.body === "string" ? v.body.trim() : "";
  if (body.length < LIMITS.bodyMin || body.length > LIMITS.bodyMax) return fail("문안 길이가 올바르지 않습니다.");
  if (/https?:\/\/|www\./i.test(body)) return fail("문안에 링크가 들어 있어 받지 않았습니다.");
  const error = piiError([body]);
  return error ? fail(error) : { ok: true, value: { body } };
}

/** 모델 응답을 읽고 검사한다. 형식이 틀리거나 입력에 없는 항목을 가리키면 거부한다. */
export function parseOutput<T extends AiTaskName>(task: T, raw: string, input: AiInputs[T]): Check<AiOutputs[T]> {
  const v = readJson(raw);
  if (v === undefined) return fail("응답이 JSON 형식이 아닙니다.");
  switch (task) {
    case "parseAssist":
      return parseAssistOutput(v, input as AiInputs["parseAssist"]) as Check<AiOutputs[T]>;
    case "remarkDraft":
      return remarkDraftOutput(v, input as AiInputs["remarkDraft"]) as Check<AiOutputs[T]>;
    case "validationExplain":
      return validationExplainOutput(v) as Check<AiOutputs[T]>;
    case "followUp":
      return followUpOutput(v) as Check<AiOutputs[T]>;
    default:
      return fail("알 수 없는 AI 기능입니다.");
  }
}

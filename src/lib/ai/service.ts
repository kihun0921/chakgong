// Gemini 보조 실행 (SRS SR-AI-01~05)
// 관리자가 요청한 제안 기능이다. 실패해도 서류 작성·계산·출력은 막지 않는다.
// 이력(ai.request)에는 기능 종류·성공 여부·입력 글자 수만 남기고 보낸 글·받은 글은 남기지 않는다.

import { AI_TASKS, buildPrompt, parseOutput, validateInput, type AiOutputs, type AiTaskName } from "@/domain/ai/tasks";
import type { AiModel } from "@/lib/ports/ai";
import type { AuditLog } from "@/lib/ports/audit";

export type AiDeps = { model: AiModel | null; audit: AuditLog };
export type AiFailCode = "disabled" | "invalid" | "failed" | "bad-output";
export type AiResult =
  | { ok: true; task: AiTaskName; data: AiOutputs[AiTaskName] }
  | { ok: false; code: AiFailCode; message: string };

export const AI_TIMEOUT_MS = 20_000;

const isTask = (t: string): t is AiTaskName => (AI_TASKS as readonly string[]).includes(t);

export async function runAiTask(
  deps: AiDeps,
  task: string,
  rawInput: unknown,
  by: string,
  opts: { timeoutMs?: number } = {},
): Promise<AiResult> {
  const record = (name: string, ok: boolean, inputChars: number, code?: AiFailCode) =>
    deps.audit.record({ user: by, action: "ai.request", detail: { task: name, ok, inputChars, ...(code ? { code } : {}) } });
  const reject = async (name: string, code: AiFailCode, message: string, inputChars = 0): Promise<AiResult> => {
    await record(name, false, inputChars, code);
    return { ok: false, code, message };
  };

  if (!isTask(task)) return reject("unknown", "invalid", "알 수 없는 AI 기능입니다.");
  const input = validateInput(task, rawInput);
  if (!input.ok) return reject(task, "invalid", input.error);
  const inputChars = JSON.stringify(input.value).length;

  if (!deps.model) {
    return reject(task, "disabled", "AI 보조가 꺼져 있습니다. 서버 환경변수 GEMINI_API_KEY를 설정한 뒤 다시 시작하세요.", inputChars);
  }

  const { system, prompt } = buildPrompt(task, input.value);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let raw: string;
  try {
    raw = await Promise.race([
      deps.model.generate({ system, prompt, signal: controller.signal }),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => {
          controller.abort();
          rej(new Error("timeout"));
        }, opts.timeoutMs ?? AI_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // 오류 내용(키·요청 세부)은 화면에 내보내지 않는다
    return reject(task, "failed", "AI 응답을 받지 못했습니다. 잠시 뒤 다시 시도하세요. 서류 작성에는 영향이 없습니다.", inputChars);
  } finally {
    clearTimeout(timer);
  }

  const out = parseOutput(task, raw, input.value);
  if (!out.ok) return reject(task, "bad-output", `AI 응답을 받지 않았습니다. ${out.error}`, inputChars);
  await record(task, true, inputChars);
  return { ok: true, task, data: out.value };
}

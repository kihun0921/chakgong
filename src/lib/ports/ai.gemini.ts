// Gemini API 구현 (SRS SR-AI-01·03). 서버에서만 쓴다.
// 키(GEMINI_API_KEY)는 .env.local/서버 환경변수에만 둔다. 없으면 null을 돌려주고 AI 보조는 꺼진 상태가 된다.

import { GoogleGenAI } from "@google/genai";
import type { AiModel } from "./ai";

/** GEMINI_MODEL로 바꿀 수 있다 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function createGeminiModel(env: Record<string, string | undefined> = process.env): AiModel | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const client = new GoogleGenAI({ apiKey });
  return {
    async generate({ system, prompt, signal }) {
      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction: system, responseMimeType: "application/json", temperature: 0.2, abortSignal: signal },
      });
      if (!res.text) throw new Error("빈 응답");
      return res.text;
    },
  };
}

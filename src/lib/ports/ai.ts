// 생성형 AI 모델 연결 (SRS SR-AI-01·03)
// 서비스 코드는 이 인터페이스만 쓰고, 실제 Gemini 연결은 ai.gemini.ts에 둔다(모델·공급자를 바꿔 끼울 수 있게).
// 보내는 글은 domain/ai가 개인정보를 검사한 뒤의 것만 들어온다.

export type AiRequest = {
  system: string;
  prompt: string;
  /** 시간 초과 때 호출을 끊는 신호 */
  signal?: AbortSignal;
};

export interface AiModel {
  /** JSON 한 개를 담은 글을 돌려준다. 실패하면 던진다. */
  generate(req: AiRequest): Promise<string>;
}

/** 시험용: 받은 요청을 calls에 쌓고 handler가 정한 글을 돌려준다 */
export function createFakeAiModel(handler: (req: AiRequest) => Promise<string> | string): AiModel & { calls: AiRequest[] } {
  const calls: AiRequest[] = [];
  return {
    calls,
    async generate(req) {
      calls.push(req);
      return handler(req);
    },
  };
}

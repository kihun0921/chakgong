"use client";

import { useCallback, useState } from "react";
import type { AiInputs, AiOutputs, AiTaskName } from "@/domain/ai/tasks";

type State<T extends AiTaskName> = { busy: boolean; error: string | null; data: AiOutputs[T] | null };

/** AI 보조 요청 (SR-AI-01). 실패해도 화면의 다른 입력·계산에는 영향이 없고 안내 문구만 남는다. */
export function useAiTask<T extends AiTaskName>(task: T) {
  const [state, setState] = useState<State<T>>({ busy: false, error: null, data: null });

  const run = useCallback(
    async (input: AiInputs[T]) => {
      setState({ busy: true, error: null, data: null });
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, input }),
        });
        const j = (await res.json()) as { data?: AiOutputs[T]; error?: string };
        if (!res.ok || !j.data) setState({ busy: false, error: j.error ?? "AI 제안을 받지 못했습니다.", data: null });
        else setState({ busy: false, error: null, data: j.data });
      } catch {
        setState({ busy: false, error: "서버에 연결하지 못했습니다.", data: null });
      }
    },
    [task],
  );

  const clear = useCallback(() => setState({ busy: false, error: null, data: null }), []);
  return { ...state, run, clear };
}

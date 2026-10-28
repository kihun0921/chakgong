// 화면 공용 스타일 상수. 데이터 타입은 src/lib/projects/types.ts에 있다(서버 저장소도 같이 쓴다).
export * from "@/lib/projects/types";

export const inputCls =
  "w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted";
export const labelCls = "mb-1 block text-[13px] font-semibold text-text-secondary";
export const btnCls =
  "rounded-sm bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhostCls =
  "rounded-sm border border-border bg-surface px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-alt";

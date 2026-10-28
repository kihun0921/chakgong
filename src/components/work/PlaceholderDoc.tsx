import type { DocTab } from "@/lib/chapters";

// 아직 작성 기능이 없는 문서 탭. 왜 준비 중인지와 관련 요구사항을 보여 준다.
export function PlaceholderDoc({ doc }: { doc: DocTab }) {
  return (
    <section
      aria-label={`${doc.label} 준비 중`}
      className="mt-6 rounded-md border border-dashed border-border bg-surface-alt p-8 text-center"
    >
      <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn">⚠ 준비 중</span>
      <h2 className="mt-3 text-[18px] text-text">{doc.label}</h2>
      <p className="mt-2 text-sm text-text-secondary">{doc.note ?? "작성 기능을 준비하고 있습니다."}</p>
      <p className="mt-1 text-[13px] text-text-muted">
        관련 요구사항: {doc.sr}
        {doc.toc.length > 0 && ` · 제출서류 목차 ${doc.toc.join("·")}`}
      </p>
    </section>
  );
}

"use client";

import { useId } from "react";

export type TabItem = { key: string; label: string; hint?: string };

type Props = {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  /** chapter: 큰 탭(챕터), doc: 작은 탭(문서) */
  variant: "chapter" | "doc";
  ariaLabel: string;
};

export function Tabs({ items, active, onChange, variant, ariaLabel }: Props) {
  const id = useId();
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length;
    onChange(items[next].key);
    document.getElementById(`${id}-${items[next].key}`)?.focus();
  };

  const big = variant === "chapter";
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex flex-wrap gap-1 ${big ? "border-b border-border" : "mt-4"}`}>
      {items.map((item, i) => {
        const selected = item.key === active;
        const base = big
          ? "px-5 py-3 text-[15px] font-bold border-b-2 -mb-px"
          : "px-3 py-1.5 text-[13px] font-semibold rounded-full border";
        const state = big
          ? selected
            ? "border-accent text-primary"
            : "border-transparent text-text-secondary hover:text-text"
          : selected
            ? "border-primary bg-primary text-white"
            : "border-border bg-surface text-text-secondary hover:bg-surface-alt";
        return (
          <button
            key={item.key}
            id={`${id}-${item.key}`}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`${base} ${state} transition-colors`}
          >
            {item.label}
            {item.hint && <span className="ml-1.5 text-[11px] font-medium opacity-80">{item.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

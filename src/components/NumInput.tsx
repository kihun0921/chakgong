"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { groupDigits, stripNumber } from "@/lib/number-format";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  /** 쉼표 없는 숫자 문자열 (예: "1234567.5") */
  value: string;
  onValue: (raw: string) => void;
  allowDecimal?: boolean;
};

// 숫자 입력칸: 입력하는 동안에도 3자리마다 쉼표를 보여 준다. 저장 값은 쉼표 없는 숫자 문자열이다.
// 중간에 글자를 고쳐도 커서가 튀지 않도록, 커서 앞의 숫자 개수를 기억했다가 다시 놓는다.
export function NumInput({ value, onValue, allowDecimal = false, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null); // 커서 앞의 숫자(소수점 포함) 글자 수
  // 입력 중인 글자(예: 소수점만 찍은 "12.")는 숫자로 바꾸면 사라지므로, 값이 같은 동안은 입력 중인 글자를 보여 준다
  const [draft, setDraft] = useState<string | null>(null);
  const sameNumber = (a: string, b: string) => a === b || (a !== "" && b !== "" && Number(a) === Number(b));
  const shown = groupDigits(draft !== null && sameNumber(draft, value) ? draft : value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null || document.activeElement !== el) return;
    let seen = 0;
    let pos = shown.length;
    if (caret.current === 0) pos = 0;
    else {
      for (let i = 0; i < shown.length; i++) {
        if (shown[i] !== ",") seen++;
        if (seen === caret.current) {
          pos = i + 1;
          break;
        }
      }
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  });

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={shown}
      onChange={(e) => {
        const el = e.target;
        const before = el.value.slice(0, el.selectionStart ?? el.value.length);
        caret.current = stripNumber(before, allowDecimal).length;
        const raw = stripNumber(el.value, allowDecimal);
        setDraft(raw);
        onValue(raw);
      }}
      onBlur={(e) => {
        setDraft(null);
        rest.onBlur?.(e);
      }}
    />
  );
}

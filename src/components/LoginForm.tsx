"use client";

import { useState } from "react";
import { btnCls, inputCls, labelCls } from "@/components/work/types";

export function LoginForm() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      if (res.ok) {
        window.location.href = "/projects";
        return;
      }
      setError(((await res.json()) as { error?: string }).error ?? "로그인하지 못했습니다.");
    } catch {
      setError("서버에 연결하지 못했습니다.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="id" className={labelCls}>아이디</label>
        <input id="id" autoComplete="username" className={inputCls} value={id} onChange={(e) => setId(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pw" className={labelCls}>비밀번호</label>
        <input id="pw" type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-[13px] text-danger">⚠ {error}</p>}
      <button type="submit" className={`${btnCls} w-full`} disabled={busy || !id || !password}>
        {busy ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}

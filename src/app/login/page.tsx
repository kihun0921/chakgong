import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "로그인 — 착공계 자동화" };

export default function LoginPage() {
  return (
    <main className="mx-auto mt-24 w-full max-w-[400px] rounded-md border border-border bg-surface p-8 shadow-sm">
      <h1 className="text-[22px]">착공계 자동화</h1>
      <p className="mt-1 text-sm text-text-secondary">관리자 전용입니다. 발급받은 계정으로 로그인해 주세요.</p>
      <LoginForm />
    </main>
  );
}

"use client";

export function LogoutButton() {
  async function out() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button type="button" onClick={out} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25">
      로그아웃
    </button>
  );
}

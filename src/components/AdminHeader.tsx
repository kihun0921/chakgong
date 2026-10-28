import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

// design.md 7장: 관리자 헤더 — 프라이머리 배경, 흰색 텍스트, 높이 64px, "관리자" 배지
export function AdminHeader() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center bg-primary py-2 text-white"
      style={{ minHeight: "var(--header-h-admin)" }}
    >
      <div
        className="mx-auto flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 sm:px-10"
        style={{ maxWidth: "var(--content-max)" }}
      >
        <Link href="/projects" className="font-bold" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
          착공계 자동화
        </Link>
        <nav aria-label="관리자 메뉴" className="flex flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap text-sm font-semibold sm:gap-x-6">
          <Link href="/projects" className="hover:underline">
            공사 목록
          </Link>
          <Link href="/dashboard" className="hover:underline">
            대시보드
          </Link>
          <Link href="/beta" className="hover:underline">
            베타
          </Link>
          <Link href="/reference" className="hover:underline">
            기준정보
          </Link>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">관리자</span>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { DashboardView } from "@/components/DashboardView";
import { requirePageAdmin } from "@/lib/auth/guard";
import { todayKst } from "@/lib/fees/service";

export const metadata: Metadata = { title: "대시보드 — 착공계 자동화" };

async function Dashboard() {
  await requirePageAdmin("/dashboard");
  const today = todayKst();
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-10 sm:py-10" style={{ maxWidth: "var(--content-max)" }}>
        <DashboardView initialFrom={`${today.slice(0, 7)}-01`} initialTo={today} />
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

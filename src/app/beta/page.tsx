import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { BetaReportView } from "@/components/BetaReportView";
import { requirePageAdmin } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "베타 종합 — 착공계 자동화" };

async function Beta() {
  await requirePageAdmin("/beta");
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-10 sm:py-10" style={{ maxWidth: "var(--content-max)" }}>
        <BetaReportView />
      </main>
    </>
  );
}

export default function BetaPage() {
  return (
    <Suspense fallback={null}>
      <Beta />
    </Suspense>
  );
}

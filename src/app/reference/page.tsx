import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { requirePageAdmin } from "@/lib/auth/guard";
import { getReferenceStore } from "@/lib/ports";

export const metadata: Metadata = { title: "기준정보 — 착공계 자동화" };

async function Reference() {
  await requirePageAdmin("/reference");
  const data = await getReferenceStore().get();
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-10 sm:py-10" style={{ maxWidth: "var(--content-max)" }}>
        <ReferenceEditor initial={data} />
      </main>
    </>
  );
}

export default function ReferencePage() {
  return (
    <Suspense fallback={null}>
      <Reference />
    </Suspense>
  );
}

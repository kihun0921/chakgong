import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { WorkApp } from "@/components/work/WorkApp";
import { requirePageAdmin } from "@/lib/auth/guard";
import { getProjectStore, getReferenceStore } from "@/lib/ports";
import { toClient } from "@/lib/projects/service";
import { ID_PATTERN } from "@/lib/projects/validate";

export const metadata: Metadata = { title: "착공계 작성 — 착공계 자동화" };

async function Work({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageAdmin(`/work/${id}`);
  if (!ID_PATTERN.test(id)) notFound();
  const project = await getProjectStore().get(id);
  if (!project) notFound();
  const client = toClient(project);
  const reference = await getReferenceStore().get();
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-10 sm:py-10" style={{ maxWidth: "var(--content-max)" }}>
        <WorkApp projectId={id} projectName={client.name} initial={client.data} reference={reference} />
      </main>
    </>
  );
}

export default function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Work params={params} />
    </Suspense>
  );
}

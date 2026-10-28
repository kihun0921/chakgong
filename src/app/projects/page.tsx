import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { ProjectList } from "@/components/ProjectList";
import { requirePageAdmin } from "@/lib/auth/guard";
import { getProjectStore } from "@/lib/ports";

export const metadata: Metadata = { title: "공사 목록 — 착공계 자동화" };

async function Projects() {
  await requirePageAdmin("/projects");
  const projects = (await getProjectStore().list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-10 sm:py-10" style={{ maxWidth: "var(--content-max)" }}>
        <ProjectList projects={projects} />
      </main>
    </>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <Projects />
    </Suspense>
  );
}

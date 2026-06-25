"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ProjectWizard,
  type ProjectWizardProps,
} from "@/features/projects/presentation/components/ProjectWizard";
import { fetchJson } from "@/shared/lib/api";

export default function NewProjectPage() {
  const router = useRouter();

  const handleAfterCreate: NonNullable<ProjectWizardProps["onAfterCreate"]> = async (
    workspaceId
  ) => {
    try {
      await fetchJson("/api/workspaces/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
    } catch {
      toast.error("Cambiamos al nuevo proyecto igualmente.");
    } finally {
      router.replace("/home");
      router.refresh();
    }
  };

  return <ProjectWizard onAfterCreate={handleAfterCreate} />;
}

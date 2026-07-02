"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { Modal } from "@/features/project-settings/presentation/components/primitives";
import { useProjectSettings } from "@/features/project-settings/presentation/hooks";
import { useCreateProjectTask } from "@/features/project-tasks/presentation/hooks";
import type { ArtifactView } from "../../domain/repositories";
import { useSaveArtifactContent, useSetArtifactStatus } from "../hooks";

/**
 * Modal para llenar un artefacto. Los campos se generan dinámicamente desde
 * los `prompts` de la metodología. Al guardar, el contenido se materializa
 * como un KnowledgeResource (base de conocimiento) y el artefacto se marca done.
 */
export function ArtifactModal({
  workspaceId,
  methodologyKey,
  artifact,
  phaseKey,
  open,
  onClose,
}: {
  workspaceId: string;
  methodologyKey: string | undefined;
  artifact: ArtifactView | null;
  phaseKey: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={artifact?.name ?? ""}>
      {artifact && (
        <ArtifactForm
          key={artifact.artifactKey}
          workspaceId={workspaceId}
          methodologyKey={methodologyKey}
          artifact={artifact}
          phaseKey={phaseKey}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ArtifactForm({
  workspaceId,
  methodologyKey,
  artifact,
  phaseKey,
  onClose,
}: {
  workspaceId: string;
  methodologyKey: string | undefined;
  artifact: ArtifactView;
  phaseKey: string | null;
  onClose: () => void;
}) {
  const prompts =
    artifact.prompts.length > 0 ? artifact.prompts : ["Contenido del artefacto"];
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    parseFilledContent(artifact)
  );

  const save = useSaveArtifactContent(workspaceId, methodologyKey);
  const setStatus = useSetArtifactStatus(workspaceId, methodologyKey);

  const handleSave = () => {
    save.mutate(
      { artifactKey: artifact.artifactKey, answers },
      { onSuccess: () => onClose() }
    );
  };

  const handleQuickStatus = (status: "done" | "skipped" | "pending") => {
    setStatus.mutate(
      { artifactKey: artifact.artifactKey, status },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {artifact.description && (
        <p className="text-[13px] text-ink-2">{artifact.description}</p>
      )}

      <div className="flex flex-col gap-3">
        {prompts.map((prompt) => (
          <label key={prompt} className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">
              {prompt}
            </span>
            <textarea
              value={answers[prompt] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [prompt]: e.target.value }))}
              rows={3}
              placeholder="Escribe aquí…"
              className="resize-y rounded-xl border border-line-2 bg-surface-2 px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
            />
          </label>
        ))}
      </div>

      {artifact.knowledgeResourceId && (
        <p className="text-[11.5px] text-ink-3">
          ✓ Guardado en la base de conocimiento ·{" "}
          <a
            href={`/knowledge?resource=${artifact.knowledgeResourceId}`}
            className="font-semibold text-accent underline"
          >
            Ver en Knowledge Hub
          </a>
        </p>
      )}

      {(save.isError || setStatus.isError) && (
        <p className="rounded-lg bg-glow-soft/30 px-3 py-1.5 text-[12px] text-glow">
          No pudimos guardar. Inténtalo de nuevo.
        </p>
      )}

      <ConvertToTask
        workspaceId={workspaceId}
        artifact={artifact}
        phaseKey={phaseKey}
        prompts={prompts}
        answers={answers}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickStatus("skipped")}
            disabled={setStatus.isPending}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-ink-3 hover:bg-surface-2"
          >
            Omitir
          </button>
          {artifact.status === "done" && (
            <button
              type="button"
              onClick={() => handleQuickStatus("pending")}
              disabled={setStatus.isPending}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-ink-3 hover:bg-surface-2"
            >
              Reabrir
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          className={cn(
            "rounded-xl bg-accent px-4 py-2 text-[14px] font-bold text-bg transition-opacity",
            save.isPending && "opacity-60"
          )}
        >
          {save.isPending ? "Guardando…" : "Guardar artefacto"}
        </button>
      </div>
    </div>
  );
}

/**
 * Sección opcional para convertir el artefacto (documento de la fase) en una
 * tarea asignable a un colaborador. La tarea queda vinculada a la fase y al
 * artefacto mediante `phaseKey`/`artifactKey`, así aparece en el tablero de
 * tareas con trazabilidad hacia el documento de Design Thinking.
 */
function ConvertToTask({
  workspaceId,
  artifact,
  phaseKey,
  prompts,
  answers,
}: {
  workspaceId: string;
  artifact: ArtifactView;
  phaseKey: string | null;
  prompts: string[];
  answers: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const settings = useProjectSettings(workspaceId);
  const createTask = useCreateProjectTask(workspaceId);

  const members = (settings.data?.members ?? [])
    .filter((m) => m.status === "active" && m.userId)
    .map((m) => ({
      id: m.userId as string,
      name: m.name ?? "Someone",
      role: m.projectRole,
    }));

  const buildDescription = () => {
    const parts: string[] = [];
    if (artifact.description) parts.push(artifact.description);
    for (const prompt of prompts) {
      const a = (answers[prompt] ?? "").trim();
      if (a) parts.push(`${prompt}\n${a}`);
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
  };

  const submit = () => {
    createTask.mutate(
      {
        title: artifact.name,
        description: buildDescription() ?? undefined,
        phaseKey,
        artifactKey: artifact.artifactKey,
        assigneeId,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setAssigneeId(null);
        },
        onError: (err: unknown) => {
          toast.error(
            err instanceof Error ? err.message : "No se pudo crear la tarea."
          );
        },
      }
    );
  };

  return (
    <div className="rounded-xl border border-line-2 bg-surface-2/60 p-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-ink">
              Convertir en tarea
            </span>
            <span className="text-[11.5px] text-ink-3">
              Crea una tarea para un colaborador a partir de este documento.
            </span>
          </span>
          <span className="text-[14px] font-bold text-accent">＋</span>
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">
              Convertir en tarea
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] font-semibold text-ink-3 hover:text-ink-2"
            >
              Cancelar
            </button>
          </div>

          {settings.isLoading ? (
            <p className="text-[12px] text-ink-3">Cargando equipo…</p>
          ) : settings.isError || members.length === 0 ? (
            <p className="text-[12px] text-ink-3">
              No hay colaboradores disponibles para asignar.
            </p>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                Asignar a
              </span>
              <select
                value={assigneeId ?? ""}
                onChange={(e) => setAssigneeId(e.target.value || null)}
                className="rounded-xl border border-line-2 bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(createTask.isError) && (
            <p className="rounded-lg bg-glow-soft/30 px-3 py-1.5 text-[12px] text-glow">
              No pudimos crear la tarea. Inténtalo de nuevo.
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={createTask.isPending || members.length === 0}
            className={cn(
              "self-start rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-bg transition-opacity",
              (createTask.isPending || members.length === 0) && "opacity-60"
            )}
          >
            {createTask.isPending ? "Creando…" : "Crear tarea"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Intenta reconstruir las respuestas a partir del `filledContent` guardado
 * (que tiene formato Markdown con `## {prompt}`).
 */
function parseFilledContent(artifact: ArtifactView): Record<string, string> {
  if (!artifact.filledContent) return {};
  const out: Record<string, string> = {};
  const blocks = artifact.filledContent.split(/^## /m).slice(1);
  for (const block of blocks) {
    const nl = block.indexOf("\n");
    if (nl === -1) continue;
    const prompt = block.slice(0, nl).trim();
    const value = block.slice(nl + 1).trim().replace(/^_\(sin responder\)_$/, "");
    if (prompt) out[prompt] = value;
  }
  return out;
}

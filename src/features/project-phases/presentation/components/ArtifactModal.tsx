"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Modal } from "@/features/project-settings/presentation/components/primitives";
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
  open,
  onClose,
}: {
  workspaceId: string;
  methodologyKey: string | undefined;
  artifact: ArtifactView | null;
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
  onClose,
}: {
  workspaceId: string;
  methodologyKey: string | undefined;
  artifact: ArtifactView;
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

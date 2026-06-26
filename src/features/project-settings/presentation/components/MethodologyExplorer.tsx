"use client";

import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  methodologyFacade,
  hasMethodologyContent,
} from "@/features/project-settings/domain/methodology-content";
import type { ProjectMethodologySelection } from "@/features/project-settings/domain/entities";

const KIND_LABEL: Record<string, string> = {
  phase: "Fase",
  roles: "Roles",
  artifacts: "Artefactos",
  steps: "Paso",
  metrics: "Métricas",
};

export function MethodologyExplorer({
  methodologies,
}: {
  methodologies: ProjectMethodologySelection[];
}) {
  const primary = methodologies.find((m) => m.tier === "primary") ?? methodologies[0];
  const [openItem, setOpenItem] = useState<string | null>(null);

  const facade = useMemo(() => {
    if (!primary || !hasMethodologyContent(primary.methodologyKey)) return null;
    return methodologyFacade(primary.methodologyKey);
  }, [primary]);

  if (!primary) {
    return (
      <div className="rounded-2xl border border-line-2 bg-surface-2 p-6 text-center">
        <p className="text-2xl">🧭</p>
        <p className="mt-2 text-[14.5px] text-ink-2">
          Este proyecto aún no tiene una metodología asignada.
        </p>
      </div>
    );
  }

  if (!facade || !facade.content()) {
    return (
      <div className="rounded-2xl border border-line-2 bg-surface-2 p-6 text-center">
        <p className="text-2xl">{primary.methodologyKey}</p>
        <p className="mt-2 text-[14.5px] text-ink-2">
          La metodología <strong>{primary.methodologyKey}</strong> no tiene contenido
          detallado todavía.
        </p>
      </div>
    );
  }

  const content = facade.content()!;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-accent/40 bg-accent-soft p-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{content.emoji}</span>
          <div>
            <h2 className="font-display text-xl text-ink">{content.name}</h2>
            <p className="text-[13px] text-ink-2">{content.tagline}</p>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] uppercase tracking-[0.12em] text-ink-3">
          🔒 Metodología inmutable · {content.source}
        </p>
      </div>

      {content.sections.map((section) => (
        <div key={section.title} className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-display text-[16px] text-ink">{section.title}</h3>
          <div className="mt-3 flex flex-col gap-2">
            {section.items.map((item) => {
              const isOpen = openItem === `${section.title}-${item.key}`;
              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-line-2 bg-surface-2"
                >
                  <button
                    type="button"
                    onClick={() => setOpenItem(isOpen ? null : `${section.title}-${item.key}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                  >
                    <div className="flex flex-col">
                      <span className="text-[14px] font-semibold text-ink">{item.name}</span>
                      {item.description && (
                        <span className="text-[12.5px] text-ink-2">{item.description}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-ink-3 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    >
                      ▾
                    </span>
                  </button>
                  {isOpen && item.prompts && item.prompts.length > 0 && (
                    <div className="border-t border-line-2 px-4 py-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
                        Plantilla
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {item.prompts.map((p) => (
                          <li
                            key={p}
                            className="rounded-lg bg-surface px-3 py-1.5 text-[13px] text-ink-2"
                          >
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {KIND_LABEL[section.kind] ?? section.kind}
          </p>
        </div>
      ))}
    </div>
  );
}

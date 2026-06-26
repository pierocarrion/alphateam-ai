import type { MethodologyContent, MethodologyItem, SectionKind } from "./types";
import { DESIGN_THINKING_CONTENT } from "./design-thinking.content";
import { SCRUM_CONTENT } from "./scrum.content";

/**
 * Registro central del contenido de metodologías.
 * Para añadir una nueva metodología, regístrala aquí — los consumidores
 * no necesitan cambios (patrón Factory + Facade).
 */
export const METHODOLOGY_CONTENT_REGISTRY: Record<string, MethodologyContent> = {
  design_thinking: DESIGN_THINKING_CONTENT,
  scrum: SCRUM_CONTENT,
};

/**
 * Factory: devuelve el contenido inmutable de una metodología por su key.
 * Retorna `null` si la key no está registrada.
 */
export function getMethodologyContent(key: string): MethodologyContent | null {
  return METHODOLOGY_CONTENT_REGISTRY[key] ?? null;
}

/** Keys de metodologías con contenido disponible. */
export const AVAILABLE_METHODOLOGY_KEYS = Object.keys(METHODOLOGY_CONTENT_REGISTRY);

/** Devuelve true si la metodología tiene contenido registrado. */
export function hasMethodologyContent(key: string): boolean {
  return key in METHODOLOGY_CONTENT_REGISTRY;
}

/**
 * Facade de acceso a una metodología concreta.
 * Ofrece vistas convenientes (fases, pasos, herramientas) sin exponer la
 * estructura interna a la UI.
 */
export class MethodologyFacade {
  constructor(private readonly key: string) {}

  /** Contenido completo, o null si no existe. */
  content(): MethodologyContent | null {
    return getMethodologyContent(this.key);
  }

  get name(): string {
    return this.content()?.name ?? this.key;
  }

  get emoji(): string {
    return this.content()?.emoji ?? "🧭";
  }

  /** Secciones filtradas por tipo (phase, roles, artifacts, steps, metrics). */
  sectionsByKind(kind: SectionKind) {
    return this.content()?.sections.filter((s) => s.kind === kind) ?? [];
  }

  /** Fases (Design Thinking) o vacío. */
  phases() {
    return this.sectionsByKind("phase");
  }

  /** Pasos (Scrum) o vacío. */
  steps() {
    return this.sectionsByKind("steps");
  }

  /** Todos los ítems/herramientas de la metodología, aplanados. */
  tools(): MethodologyItem[] {
    return this.content()?.sections.flatMap((s) => s.items) ?? [];
  }
}

/** Helper para construir un facade de forma segura. */
export function methodologyFacade(key: string): MethodologyFacade {
  return new MethodologyFacade(key);
}

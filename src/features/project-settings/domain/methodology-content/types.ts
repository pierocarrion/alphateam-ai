/**
 * Modelo de contenido detallado de una metodología de trabajo.
 *
 * Cada metodología expone secciones (fases, roles, artefactos, pasos, métricas)
 * compuestas por ítems que el equipo puede usar como plantillas/herramientas
 * durante el ciclo de vida del proyecto.
 *
 * El contenido es estático e inmutable: se obtiene a través de un factory
 * (ver `methodologyContentFactory`) para poder añadir nuevas metodologías sin
 * tocar a los consumidores.
 */

export type SectionKind =
  | "phase"
  | "roles"
  | "artifacts"
  | "steps"
  | "metrics";

export interface MethodologyItem {
  key: string;
  name: string;
  description?: string;
  /** Preguntas guía / campos de la plantilla. */
  prompts?: string[];
}

export interface MethodologySection {
  kind: SectionKind;
  title: string;
  /** Orden de aparición dentro de la metodología. */
  order: number;
  items: MethodologyItem[];
}

export interface MethodologyContent {
  key: string;
  name: string;
  emoji: string;
  tagline: string;
  /** Atribución / origen (autor, escuela, año). */
  source: string;
  sections: MethodologySection[];
}

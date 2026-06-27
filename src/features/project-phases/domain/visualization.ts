import { METHODOLOGY_CONTENT_REGISTRY } from "@/features/project-settings/domain/methodology-content";

/**
 * Catálogo de visualización recomendada por metodología.
 * Define cómo debe renderizar la UI el avance de la metodología:
 *  - "linear": procesos secuenciales (Design Thinking: 5 fases en cascada).
 *  - "cyclic": procesos iterativos (Scrum: roles → artefactos → pasos → métricas en anillo).
 */
export const METHODOLOGY_VISUALIZATION: Record<string, "linear" | "cyclic"> = {
  design_thinking: "linear",
  scrum: "cyclic",
};

export function getMethodologyVisualization(key: string): "linear" | "cyclic" {
  return METHODOLOGY_VISUALIZATION[key] ?? "linear";
}

/**
 * Devuelve las "fases/estaciones" de una metodología en orden de aparición.
 * Para Design Thinking son las 5 fases; para Scrum son las secciones
 * (roles, artefactos, pasos, métricas).
 */
export function getMethodologyPhases(methodologyKey: string) {
  const content = METHODOLOGY_CONTENT_REGISTRY[methodologyKey];
  if (!content) return [];
  return content.sections.map((s) => ({
    phaseKey: phaseKeyFromSection(s.title, s.order),
    title: s.title,
    order: s.order,
    kind: s.kind,
    items: s.items,
  }));
}

/**
 * Genera una clave estable para una sección a partir de su título y orden,
 * normalizando acentos y espacios. Ej: "Fase 1 — Empatizar" → "fase_1_empatizar".
 */
export function phaseKeyFromSection(title: string, order: number): string {
  const normalized = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `section_${order}`;
}

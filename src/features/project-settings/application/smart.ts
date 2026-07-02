import type { SmartGoal } from "../domain/entities";

export const SMART_DIMENSIONS = [
  "specific",
  "measurable",
  "achievable",
  "relevant",
  "timeBound",
] as const;

export type SmartDimension = (typeof SMART_DIMENSIONS)[number];

export const SMART_LABELS: Record<SmartDimension, { label: string; short: string; hint: string }> = {
  specific: { label: "Specific", short: "S", hint: "¿Qué exactamente se logrará? Sin ambigüedad." },
  measurable: { label: "Measurable", short: "M", hint: "¿Cómo se medirá el éxito? Métrica y valor." },
  achievable: { label: "Achievable", short: "A", hint: "¿Es realista con los recursos y el tiempo?" },
  relevant: { label: "Relevant", short: "R", hint: "¿Por qué importa para el negocio o estrategia?" },
  timeBound: { label: "Time-bound", short: "T", hint: "Selecciona la fecha límite del objetivo." },
};

/**
 * Heuristic SMART completeness score (0-100). Each of the five dimensions
 * contributes equally (20 points) once it has a minimum length. Time-bound is
 * the single "T" dimension: there is no separate deadline field, so the score
 * no longer needs a deadline bonus.
 * This is the deterministic baseline the AI score builds on.
 */
export function computeSmartScore(goal: {
  specific?: string | null;
  measurable?: string | null;
  achievable?: string | null;
  relevant?: string | null;
  timeBound?: string | null;
}): number {
  let filled = 0;
  for (const dim of SMART_DIMENSIONS) {
    if ((goal[dim]?.trim().length ?? 0) >= 8) filled += 1;
  }
  return Math.round((filled / SMART_DIMENSIONS.length) * 100);
}

export interface SmartCheck {
  dimension: SmartDimension;
  ok: boolean;
  message: string;
}

export function validateSmart(goal: Pick<SmartGoal, SmartDimension>): SmartCheck[] {
  return SMART_DIMENSIONS.map((dim) => {
    const value = goal[dim]?.trim() ?? "";
    const ok = value.length >= 8;
    return {
      dimension: dim,
      ok,
      message: ok
        ? `${SMART_LABELS[dim].label} está definido.`
        : `${SMART_LABELS[dim].label} necesita más detalle.`,
    };
  });
}

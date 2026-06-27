import { z } from "zod";
import {
  ARTIFACT_STATUS_VALUES,
  PHASE_STATUS_VALUES,
} from "../domain/entities";

export const phaseStatusSchema = z.enum(PHASE_STATUS_VALUES as [string, ...string[]]);
export const artifactStatusSchema = z.enum(ARTIFACT_STATUS_VALUES as [string, ...string[]]);

export const advancePhaseSchema = z.object({
  status: phaseStatusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type AdvancePhaseInput = z.infer<typeof advancePhaseSchema>;

export const saveArtifactContentSchema = z.object({
  /** Respuestas del usuario a los prompts del artefacto: { prompt -> value }. */
  answers: z.record(z.string(), z.string().max(10000)).default({}),
});
export type SaveArtifactContentInput = z.infer<typeof saveArtifactContentSchema>;

export const setArtifactStatusSchema = z.object({
  status: artifactStatusSchema.optional(),
});
export type SetArtifactStatusInput = z.infer<typeof setArtifactStatusSchema>;

export const toggleArtifactSchema = z.object({
  mandatory: z.boolean().optional(),
  visible: z.boolean().optional(),
});
export type ToggleArtifactInput = z.infer<typeof toggleArtifactSchema>;

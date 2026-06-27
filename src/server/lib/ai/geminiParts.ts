/**
 * Extracts the full visible text from a Vertex AI GenerateContentResponse
 * candidate.
 *
 * Gemini 2.5 ("thinking") models return several parts in a single candidate:
 *   - one or more parts flagged `thought: true` (the model's private reasoning)
 *   - one or more parts with the actual answer the user should see
 *
 * The thinking flag is not declared by the SDK types shipped with this
 * @google-cloud/vertexai version, so we read it defensively. Older code only
 * read `parts[0].text`, which returned either the truncated reasoning or just
 * the first fragment of the answer — producing replies cut off mid-sentence.
 *
 * We also fall back to every text part (thought included) when no non-thought
 * part is present, so we never return an empty string when the model did emit
 * text.
 */
export function extractCandidateText(
  candidate: { content?: { parts?: Array<{ text?: string; thought?: boolean }> } } | null | undefined
): string {
  if (!candidate?.content?.parts) return "";
  const parts = candidate.content.parts.filter((p): p is { text: string } => Boolean(p.text));

  const answerParts = parts.filter((p) => (p as { thought?: boolean }).thought !== true);
  const chosen = answerParts.length > 0 ? answerParts : parts;

  return chosen.map((p) => p.text).join("").trim();
}
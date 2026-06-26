import { generateJSON } from "./gemini";
import { UserFacingError } from "./errors";
import { getBusyIntervals, type BusyInterval } from "@/server/services/googleCalendar";

export interface MeetingProposal {
  start: string; // ISO 8601
  end: string; // ISO 8601
  durationMinutes: number;
  rationale: string;
  draftMessage: string;
  model: string;
}

interface SchedulerOptions {
  startHour?: number;
  endHour?: number;
  durationMinutes?: number;
  lookaheadDays?: number;
  slotStepMinutes?: number;
}

function resolveOptions(opts: SchedulerOptions | undefined) {
  return {
    startHour: opts?.startHour ?? Number(process.env.SCHEDULER_WORK_HOUR_START ?? 9),
    endHour: opts?.endHour ?? Number(process.env.SCHEDULER_WORK_HOUR_END ?? 18),
    durationMinutes: opts?.durationMinutes ?? 30,
    lookaheadDays: opts?.lookaheadDays ?? Number(process.env.SCHEDULER_LOOKAHEAD_DAYS ?? 7),
    slotStepMinutes: opts?.slotStepMinutes ?? 30,
  };
}

/**
 * Merges busy intervals from both people, clipping to the working window,
 * and returns the free gaps where both are available.
 */
function freeGapsWithinWindow(
  a: BusyInterval[],
  b: BusyInterval[],
  windowStart: Date,
  windowEnd: Date
): Array<{ start: Date; end: Date }> {
  const all = [...a, ...b]
    .map(({ start, end }) => ({
      start: new Date(start),
      end: new Date(end),
    }))
    .filter((i) => i.end > windowStart && i.start < windowEnd)
    .sort((x, y) => x.start.getTime() - y.start.getTime());

  const merged: Array<{ start: Date; end: Date }> = [];
  for (const iv of all) {
    const s = iv.start < windowStart ? windowStart : iv.start;
    const e = iv.end > windowEnd ? windowEnd : iv.end;
    const last = merged[merged.length - 1];
    if (last && s <= last.end) {
      last.end = e > last.end ? e : last.end;
    } else {
      merged.push({ start: s, end: e });
    }
  }

  const gaps: Array<{ start: Date; end: Date }> = [];
  let cursor = windowStart;
  for (const busy of merged) {
    if (busy.start > cursor) gaps.push({ start: cursor, end: busy.start });
    cursor = busy.end > cursor ? busy.end : cursor;
  }
  if (cursor < windowEnd) gaps.push({ start: cursor, end: windowEnd });
  return gaps;
}

/**
 * Deterministically computes candidate meeting slots (local working hours)
 * where both people are free over the next N days.
 */
export function computeCommonSlots(
  requesterBusy: BusyInterval[],
  expertBusy: BusyInterval[],
  options?: SchedulerOptions
): Array<{ start: Date; end: Date }> {
  const { startHour, endHour, durationMinutes, lookaheadDays, slotStepMinutes } =
    resolveOptions(options);

  const candidates: Array<{ start: Date; end: Date }> = [];
  const durationMs = durationMinutes * 60 * 1000;
  const stepMs = slotStepMinutes * 60 * 1000;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= lookaheadDays; d++) {
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    const y = day.getFullYear();
    const m = day.getMonth();
    const dom = day.getDate();
    // Skip weekends (Sat=6, Sun=0).
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue;

    const windowStart = new Date(y, m, dom, startHour, 0, 0);
    const windowEnd = new Date(y, m, dom, endHour, 0, 0);

    const gaps = freeGapsWithinWindow(requesterBusy, expertBusy, windowStart, windowEnd);
    for (const gap of gaps) {
      let t = gap.start.getTime();
      while (t + durationMs <= gap.end.getTime()) {
        candidates.push({
          start: new Date(t),
          end: new Date(t + durationMs),
        });
        t += stepMs;
      }
    }
  }

  return candidates.slice(0, 16);
}

function localLabel(d: Date): string {
  return d.toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface GeminiSlotPick {
  startIso?: string;
  rationale?: string;
  draftMessage?: string;
}

function defaultMessage(
  requesterName: string,
  expertName: string,
  reason: string,
  slot: { start: Date; end: Date }
): string {
  return `Hola ${expertName}, ¿tienes 30 min el ${localLabel(
    slot.start
  )} para conversar sobre ${reason}? Lo coordino desde mi calendario. — ${requesterName}`;
}

function earliestFromCandidates(
  candidates: Array<{ start: Date; end: Date }>,
  requesterName: string,
  expertName: string,
  reason: string
): MeetingProposal {
  const slot = candidates[0];
  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    durationMinutes: Math.round(
      (slot.end.getTime() - slot.start.getTime()) / 60000
    ),
    rationale: "Earliest slot where both calendars are free.",
    draftMessage: defaultMessage(requesterName, expertName, reason, slot),
    model: "deterministic-fallback",
  };
}

/**
 * Builds a meeting proposal for `requesterId` to sync with `expertId`.
 *
 * Reads only free/busy from each person's Google Calendar (never event
 * details), intersects their availability within local working hours, then
 * asks Gemini to pick the best slot and draft a warm request message.
 *
 * If Gemini is unavailable, falls back to the earliest shared slot with a
 * sensible default message.
 */
export async function proposeMeetingSlot(input: {
  requesterId: string;
  expertId: string;
  requesterName: string;
  expertName: string;
  reason: string;
  options?: SchedulerOptions;
}): Promise<MeetingProposal> {
  const { lookaheadDays } = resolveOptions(input.options);

  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + lookaheadDays);

  const [requesterBusy, expertBusy] = await Promise.all([
    getBusyIntervals(input.requesterId, from, to),
    getBusyIntervals(input.expertId, from, to),
  ]);

  const candidates = computeCommonSlots(requesterBusy, expertBusy, input.options);
  if (candidates.length === 0) {
    throw new NoSharedSlotError();
  }

  const candidateMap = new Map(
    candidates.map((c) => [c.start.toISOString(), c])
  );

  const slotsText = candidates
    .map((c, i) => `${i + 1}. ${localLabel(c.start)} → ${localLabel(c.end)}`)
    .join("\n");

  const prompt = `Eres Alpha, un asistente de productividad cálido. Dos personas de un equipo necesitan una sesión corta de contexto.

Quien pide: ${input.requesterName}
Experto/a: ${input.expertName}
Motivo: "${input.reason}"

Slots candidatos (30 min, hora local) donde ambos tienen el calendario libre:
${slotsText}

Elige el mejor slot (prioriza el más pronto posible, evitando la hora de almuerzo 13:00–14:00 cuando puedas) y redacta un mensaje corto y amable de ${input.requesterName} hacia ${input.expertName} pidiendo la sesión, mencionando el motivo.

Responde SOLO con JSON:
{
  "startIso": "<ISO exacto del start del slot elegido>",
  "rationale": "una frase corta",
  "draftMessage": "mensaje de máximo 2 frases"
}`;

  const result = await generateJSON<GeminiSlotPick>(prompt, {
    maxTokens: 300,
    temperature: 0.3,
  });

  if (!result.ok || !result.data) {
    return earliestFromCandidates(
      candidates,
      input.requesterName,
      input.expertName,
      input.reason
    );
  }

  const picked = result.data.startIso ? candidateMap.get(result.data.startIso) : undefined;
  const slot = picked ?? candidates[0];

  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    durationMinutes: Math.round(
      (slot.end.getTime() - slot.start.getTime()) / 60000
    ),
    rationale:
      result.data.rationale ||
      "Slot libre en común seleccionado por el calendario.",
    draftMessage:
      result.data.draftMessage ||
      defaultMessage(input.requesterName, input.expertName, input.reason, slot),
    model: result.model,
  };
}

export class NoSharedSlotError extends UserFacingError {
  constructor() {
    super(
      "No encontramos un horario libre en común en los próximos días. Intenta de nuevo más tarde.",
      409
    );
    this.name = "NoSharedSlotError";
  }
}

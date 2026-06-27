import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createLogger } from "@/shared/lib/logger";
import { UserFacingError } from "./errors";
import { toSemanticDbError } from "./dbErrors";

const log = createLogger("api");

interface PrismaKnownError {
  code: string;
  meta?: unknown;
  clientVersion?: string;
}

const FRIENDLY_DEFAULT =
  "Something went wrong on our end. Please try again in a moment.";
const FRIENDLY_UNAVAILABLE =
  "We're having trouble reaching our service. Please try again in a moment.";
const FRIENDLY_WARMING_UP =
  "We're warming up on our end. Please try again in a moment.";
const FRIENDLY_BAD_JSON = "Please send a valid request.";

const FIELD_HINTS: Record<string, string> = {
  email: "Please enter a valid email address.",
  password: "Password must be at least 6 characters.",
  name: "Please tell us your name.",
  role: "Please choose your role.",
  hardMoment: "Tell us about a hard moment — even a few words helps.",
  profileId: "Please pick what sounds most like you.",
  tone: "Please choose a tone.",
  content: "Please add a little more to your message.",
  teamSize: "Please choose your team size.",
  type: "Please choose a type.",
  workspaceId: "Please choose a workspace.",
  days: "Please choose a time range.",
  message: "Please write a short message.",
  text: "Please add some text.",
  taskId: "Please pick a task.",
  title: "Please add a title.",
  mood: "Please tell us how you're feeling.",
  draft: "Please provide the task details.",
  load: "Please choose a task load.",
  category: "Please choose a category.",
  completedAt: "Please provide a valid completion date.",
  status: "Please choose a valid status.",
  plan: "Please choose a plan.",
  returnUrl: "Please provide a valid return URL.",
  completed: "Please tell us if this is complete.",
  feeling: "Please tell us how you're feeling.",
  durationSec: "Please choose a valid duration.",
  messageId: "Please provide a valid message.",
  deadline: "Please provide a valid deadline.",
  fromQuote: "Please provide the original quote.",
  micro: "Please provide a micro step.",
  action: "Please provide a first action.",
  resource: "Please provide a resource name.",
  app: "Please provide an app name.",
  due: "Please provide a due date.",
  selfMade: "Please tell us if this is self-assigned.",
  confidence: "Please provide a confidence level.",
  hashtag: "El hashtag debe empezar con #, usar minúsculas y guiones (ej: #q3-launch).",
  emoji: "Elige un emoji para tu proyecto.",
  description: "Cuéntanos brevemente de qué trata tu proyecto.",
  industry: "Elige la industria del proyecto.",
  decision: "Elige si aprobar o rechazar la solicitud.",
  goal: "Escribe el objetivo del proyecto.",
  goalId: "Elige un objetivo.",
  question: "Escribe una pregunta para el copiloto.",
  relevant: "Conecta el objetivo con el propósito.",
  ownerId: "Elige un responsable.",
  weight: "Elige un peso válido para el objetivo.",
  primary: "Elige la metodología principal.",
  secondary: "Elige metodologías secundarias válidas.",
  entries: "Revisa la configuración de KPIs.",
  projectRole: "Elige un rol de proyecto.",
  permissionRole: "Elige un nivel de permiso.",
  target: "Define una meta numérica válida.",
  alertThreshold: "Define un umbral de alerta válido.",
  specific: "Describe el objetivo de forma específica.",
  measurable: "Define cómo se medirá el objetivo.",
  achievable: "Explica por qué el objetivo es alcanzable.",
  timeBound: "Define el plazo del objetivo.",
};

function isPrismaKnown(error: unknown): error is PrismaKnownError {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    /^P\d{3,4}$/.test((error as { code: string }).code)
  );
}

/**
 * Normalize a thrown value: pg/Drizzle errors are mapped to the semantic
 * Prisma-style code shape so the rest of the mapping logic is shared between
 * the legacy Prisma client and the new Drizzle client during the migration.
 */
function normalizeError(error: unknown): unknown {
  const semantic = toSemanticDbError(error);
  return semantic ?? error;
}

function friendlyZodMessage(error: ZodError): string {
  const issues = error.issues ?? [];
  const seen = new Set<string>();
  const messages: string[] = [];
  for (const issue of issues) {
    const path = issue.path ?? [];
    const lastField = typeof path[path.length - 1] === "string" ? String(path[path.length - 1]) : "";
    const firstField = typeof path[0] === "string" ? String(path[0]) : "";
    const hint = (lastField && FIELD_HINTS[lastField]) || (firstField && FIELD_HINTS[firstField]);
    const msg = hint ?? "Please check your details and try again.";
    if (!seen.has(msg)) {
      seen.add(msg);
      messages.push(msg);
    }
  }
  return messages[0] ?? "Please check your details and try again.";
}

function friendlyPrismaMessage(error: PrismaKnownError): string {
  switch (error.code) {
    case "P2002":
      return "That's already taken — try a different one.";
    case "P2025":
      return "We couldn't find that. It may have been removed.";
    case "P2003":
      return "Something's a little off with the details. Please try again.";
    case "P2021":
      return FRIENDLY_WARMING_UP;
    case "P2024":
    case "P1001":
    case "P1002":
    case "P1008":
      return FRIENDLY_UNAVAILABLE;
    default:
      return FRIENDLY_DEFAULT;
  }
}

export function toFriendlyMessage(error: unknown): string {
  const err = normalizeError(error);
  if (err instanceof UserFacingError) return err.message;
  if (err instanceof ZodError) return friendlyZodMessage(err);
  if (isPrismaKnown(err)) return friendlyPrismaMessage(err);
  if (err instanceof SyntaxError) return FRIENDLY_BAD_JSON;
  return FRIENDLY_DEFAULT;
}

export function errorStatus(error: unknown): number {
  const err = normalizeError(error);
  if (err instanceof UserFacingError) return err.status;
  if (err instanceof ZodError) return 400;
  if (isPrismaKnown(err)) {
    switch (err.code) {
      case "P2002":
        return 409;
      case "P2025":
        return 404;
      case "P2003":
        return 400;
      case "P2024":
      case "P1001":
      case "P1002":
      case "P1008":
        return 503;
      default:
        return 500;
    }
  }
  if (err instanceof SyntaxError) return 400;
  return 500;
}

export function jsonError(error: unknown, fallbackStatus?: number): NextResponse {
  log.error("handler error", { error, status: fallbackStatus ?? errorStatus(error) });
  const status = fallbackStatus ?? errorStatus(error);
  return NextResponse.json({ error: toFriendlyMessage(error) }, { status });
}

export async function parseRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new UserFacingError(FRIENDLY_BAD_JSON, 400);
  }
}

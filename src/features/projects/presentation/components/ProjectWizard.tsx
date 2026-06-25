"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mira, Button, Card } from "@/shared/ui";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";
import {
  isValidHashtag,
  normalizeHashtag,
} from "@/features/projects/domain/hashtag";

const EMOJIS = ["🚀", "🌱", "🎨", "🛠️", "📊", "🔬", "📚", "💡", "🎯", "⚡", "🌍", "❤️"];

const INDUSTRIES = [
  "Tecnología",
  "Educación",
  "Salud",
  "Marketing",
  "Diseño",
  "Finanzas",
  "Construcción",
  "Retail",
  "Otro",
];

const CATEGORIES = [
  "Lanzamiento",
  "Producto",
  "Investigación",
  "Campaña",
  "Operaciones",
  "Evento",
  "Otro",
];

const TEAM_SIZES = [
  { id: "solo", label: "Solo yo (por ahora)" },
  { id: "2-5", label: "2 a 5 personas" },
  { id: "6-15", label: "6 a 15 personas" },
  { id: "16-50", label: "16 a 50 personas" },
  { id: "50+", label: "Más de 50" },
];

const TONES = [
  { id: "warm", label: "Cálido y motivador", emoji: "🤗" },
  { id: "balanced", label: "Equilibrado y directo", emoji: "🧭" },
];

export interface KnowledgeDoc {
  title: string;
  sourceUrl: string;
}

export interface ProjectWizardProps {
  /** If provided, runs after the project is created successfully. */
  onAfterCreate?: (workspaceId: string) => void | Promise<void>;
}

export function ProjectWizard({ onAfterCreate }: ProjectWizardProps = {}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [hashtag, setHashtag] = useState("");
  const [hashtagChecked, setHashtagChecked] = useState<{
    hashtag: string;
    available: boolean;
    valid: boolean;
    reason?: string;
  } | null>(null);
  const [checkingHashtag, setCheckingHashtag] = useState(false);

  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [tone, setTone] = useState<"warm" | "balanced">("warm");

  const [docs, setDocs] = useState<KnowledgeDoc[]>([
    { title: "", sourceUrl: "" },
  ]);
  const [goalTitle, setGoalTitle] = useState("");
  const [milestone, setMilestone] = useState("");

  const [saving, setSaving] = useState(false);
  const hashtagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalized = normalizeHashtag(hashtag);
  const hashtagValid = isValidHashtag(normalized);

  useEffect(() => {
    if (!hashtagValid) return;
    if (hashtagTimer.current) clearTimeout(hashtagTimer.current);
    hashtagTimer.current = setTimeout(async () => {
      setCheckingHashtag(true);
      try {
        const res = await fetchJson<{
          available: boolean;
          valid: boolean;
          hashtag: string;
          reason?: string;
        }>(`/api/projects/hashtag-available?h=${encodeURIComponent(normalized)}`);
        setHashtagChecked(res);
      } catch {
        setHashtagChecked(null);
      } finally {
        setCheckingHashtag(false);
      }
    }, 450);
    return () => {
      if (hashtagTimer.current) clearTimeout(hashtagTimer.current);
    };
  }, [normalized, hashtagValid]);

  const hashtagAvailable = hashtagChecked?.available === true;
  const hashtagOk = hashtagValid && hashtagAvailable && !checkingHashtag;

  const canContinue =
    (step === 0 && name.trim().length >= 2) ||
    (step === 1 && hashtagOk) ||
    (step === 2 && description.trim().length > 0 && industry && category) ||
    (step === 3 && !!teamSize) ||
    step === 4;

  const submit = async () => {
    if (!name.trim() || !hashtagOk) return;
    setSaving(true);
    try {
      const cleanDocs = docs
        .filter((d) => d.title.trim().length > 0)
        .map((d) => ({
          title: d.title.trim(),
          content: d.title.trim(),
          sourceUrl: d.sourceUrl.trim() || undefined,
        }));

      const created = await fetchJson<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          emoji,
          hashtag: normalized,
          description: description.trim() || undefined,
          industry: industry ?? undefined,
          category: category ?? undefined,
          teamSize: teamSize ?? undefined,
          tone,
          knowledgeBase: cleanDocs,
          goal:
            goalTitle.trim().length > 0
              ? { title: goalTitle.trim(), milestone: milestone.trim() || undefined }
              : null,
        }),
      });
      toast.success("¡Proyecto creado!");

      if (onAfterCreate) {
        await onAfterCreate(created.project.id);
      } else {
        router.push("/home");
        router.refresh();
      }
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "No pudimos crear el proyecto. Inténtalo de nuevo.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="hidden w-[360px] flex-none border-r border-line lg:flex">
        <div className="relative flex h-full flex-col justify-between overflow-hidden px-8 py-12">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_60%_at_50%_-10%,#221c2c,var(--color-bg)_60%)]" />
          <div className="flex flex-col items-start gap-5">
            <div className="flex items-center gap-3">
              <Mira size={72} mood="happy" ring />
              <div className="flex flex-col">
                <span className="font-display text-2xl tracking-tight text-ink">
                  Nuevo proyecto
                </span>
                <span className="text-xs text-ink-3">
                  Tu espacio, tu conocimiento
                </span>
              </div>
            </div>
            <p className="max-w-[260px] text-[15px] leading-relaxed text-ink-2">
              {name.trim()
                ? `${emoji} ${name.trim()}`
                : "Pongamos nombre a lo que estás construyendo."}
            </p>
          </div>
          <ol className="flex flex-col gap-3">
            {[
              "Identidad",
              "Hashtag",
              "De qué trata",
              "Equipo y tono",
              "Base de conocimiento",
            ].map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 transition-colors ${
                    active
                      ? "border-accent bg-accent-soft"
                      : done
                        ? "border-line-2 bg-white/[0.02]"
                        : "border-transparent"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      done
                        ? "bg-accent text-accent-ink"
                        : active
                          ? "bg-accent-soft text-accent"
                          : "bg-surface-2 text-ink-3"
                    }`}
                    aria-hidden
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    className={`text-[13px] font-semibold ${
                      active || done ? "text-ink" : "text-ink-3"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-ink-3">
            Podrás editar todo esto después. Sin datos falsos, todo es tuyo.
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col px-5 py-6 lg:items-center lg:justify-center lg:px-10 lg:py-12">
        <div className="flex flex-1 flex-col w-full lg:max-w-2xl lg:flex-none">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-white/[0.04]"
              >
                <span className="text-ink-2">←</span>
              </button>
            ) : (
              <div className="w-10" />
            )}
            <div className="flex flex-1 gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-accent" : "bg-line-2"
                  }`}
                />
              ))}
            </div>
            <span className="w-10 text-right text-xs text-ink-3">
              {step + 1}/5
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide py-2 lg:overflow-visible lg:rounded-[28px] lg:border lg:border-line lg:bg-surface lg:px-10 lg:py-12 lg:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
            {step === 0 && (
              <div className="flex flex-col">
                <Mira size={56} mood="happy" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  ¿Cómo se llama tu proyecto?
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  Elige un nombre y un emoji que lo represente. Lo verás cada
                  día.
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Lanzamiento Q3"
                  maxLength={60}
                  className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Emoji
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border-[1.5px] text-xl transition-all ${
                        emoji === e
                          ? "border-accent bg-accent-soft"
                          : "border-line hover:bg-surface-2"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col">
                <Mira size={56} mood="thinking" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  Define su hashtag
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  Es el identificador único de tu proyecto. Tu equipo lo usará
                  para unirse.
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Hashtag
                </label>
                <input
                  type="text"
                  value={hashtag}
                  onChange={(e) => setHashtag(e.target.value)}
                  placeholder="#mi-proyecto"
                  className={`mt-2 w-full rounded-2xl border-[1.5px] bg-surface px-4 py-3 font-mono text-ink placeholder:text-ink-3 outline-none ${
                    hashtag && !hashtagValid
                      ? "border-glow"
                      : hashtagOk
                        ? "border-sage"
                        : "border-line-2 focus:border-accent"
                  }`}
                />

                {hashtag && !hashtagValid && (
                  <p className="mt-2 text-sm text-glow">
                    Usa minúsculas, números y guiones. Mínimo 2 caracteres tras
                    el #. Lo verás como: <span className="font-mono">{normalized}</span>
                  </p>
                )}
                {checkingHashtag && (
                  <p className="mt-2 text-sm text-ink-3">Comprobando…</p>
                )}
                {hashtagValid && hashtagChecked && !checkingHashtag && (
                  <p
                    className={`mt-2 text-sm ${
                      hashtagAvailable ? "text-sage" : "text-glow"
                    }`}
                  >
                    {hashtagAvailable
                      ? `✓ ${normalized} está disponible`
                      : `${normalized} ya está en uso. Prueba con otro.`}
                  </p>
                )}

                <Card className="mt-6 flex items-center gap-3">
                  <span className="text-xl">💡</span>
                  <p className="text-sm text-ink-2">
                    Sugerencia: algo corto y memorable, como{" "}
                    <span className="font-mono">#landing-v2</span> o{" "}
                    <span className="font-mono">#expo-2026</span>.
                  </p>
                </Card>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col">
                <Mira size={56} mood="calm" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  ¿De qué trata?
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  Esta es la base de conocimiento inicial. Ayuda a tu equipo (y
                  a Mira) a entender el contexto.
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Descripción
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="En una o dos frases, ¿qué buscan lograr?"
                  maxLength={600}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                      Industria
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {INDUSTRIES.map((ind) => (
                        <Chip
                          key={ind}
                          selected={industry === ind}
                          onClick={() => setIndustry(ind)}
                        >
                          {ind}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                      Categoría
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <Chip
                          key={cat}
                          selected={category === cat}
                          onClick={() => setCategory(cat)}
                        >
                          {cat}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col">
                <Mira size={56} mood="happy" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  Tu equipo y el tono
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  ¿Cuántas personas? ¿Cómo quieres que hable Mira con todos?
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Tamaño del equipo
                </label>
                <div className="mt-2 space-y-2.5">
                  {TEAM_SIZES.map((t) => (
                    <OptionTile
                      key={t.id}
                      selected={teamSize === t.id}
                      onClick={() => setTeamSize(t.id)}
                    >
                      {t.label}
                    </OptionTile>
                  ))}
                </div>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Tono
                </label>
                <div className="mt-2 space-y-2.5">
                  {TONES.map((t) => (
                    <OptionTile
                      key={t.id}
                      selected={tone === t.id}
                      onClick={() => setTone(t.id as "warm" | "balanced")}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-xl">{t.emoji}</span>
                        <span className="font-bold">{t.label}</span>
                      </span>
                    </OptionTile>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col">
                <Mira size={56} mood="happy" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  Base de conocimiento
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  Documentos y links clave. Opcional, pero ayuda a empezar
                  alineados.
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Documentos y links
                </label>
                <div className="mt-2 space-y-2">
                  {docs.map((d, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center"
                    >
                      <input
                        type="text"
                        value={d.title}
                        onChange={(e) =>
                          setDocs((prev) =>
                            prev.map((p, idx) =>
                              idx === i ? { ...p, title: e.target.value } : p
                            )
                          )
                        }
                        placeholder="Título (ej. Brief, Notion, Figma)"
                        className="flex-1 rounded-xl border border-line-2 bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                      />
                      <input
                        type="url"
                        value={d.sourceUrl}
                        onChange={(e) =>
                          setDocs((prev) =>
                            prev.map((p, idx) =>
                              idx === i ? { ...p, sourceUrl: e.target.value } : p
                            )
                          )
                        }
                        placeholder="https://…"
                        className="flex-1 rounded-xl border border-line-2 bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                      />
                      {docs.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDocs((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="rounded-xl px-2 py-2 text-ink-3 hover:text-glow"
                          aria-label="Quitar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setDocs((prev) => [...prev, { title: "", sourceUrl: "" }])
                    }
                    className="mt-1 w-full rounded-2xl border border-dashed border-line-2 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2"
                  >
                    + Añadir otro
                  </button>
                </div>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Primer objetivo (opcional)
                </label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="Ej. Publicar MVP en 8 semanas"
                  className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <label className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  Primer hito (opcional)
                </label>
                <input
                  type="text"
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  placeholder="Ej. Plan y diseño listos"
                  className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <div className="mt-7 rounded-2xl border border-line-2 bg-surface-2 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                    Resumen
                  </p>
                  <p className="mt-2 text-[15px] text-ink">
                    {emoji} <b>{name.trim() || "Tu proyecto"}</b>{" "}
                    <span className="font-mono text-ink-3">{normalized}</span>
                  </p>
                  {description.trim() && (
                    <p className="mt-1 text-sm text-ink-2">{description.trim()}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-none pt-4 lg:pt-6">
            {step < 4 ? (
              <Button
                full
                size="lg"
                icon="arrow"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
              >
                Continuar
              </Button>
            ) : (
              <Button full size="lg" loading={saving} disabled={saving} onClick={submit}>
                {saving ? "Creando…" : "Crear proyecto"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionTile({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[20px] border-[1.5px] bg-surface p-4 text-left text-ink transition-all active:scale-[0.98] ${
        selected ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"
      } flex items-center gap-3.5`}
    >
      {children}
    </button>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold transition-all ${
        selected
          ? "border-accent bg-accent-soft text-ink"
          : "border-line text-ink-2 hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

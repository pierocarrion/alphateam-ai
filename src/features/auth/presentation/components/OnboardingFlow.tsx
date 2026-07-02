"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alpha, Button, Card } from "@/shared/ui";
import { toast } from "sonner";
import { DesktopOnboardingRail } from "./DesktopOnboardingRail";
import { fetchJson, ApiError } from "@/shared/lib/api";

type CvDraft = {
  role: string;
  roleConfidence: number;
  jobTitle: string;
  seniority: string;
  skills: string[];
  headline: string;
  yearsExperience: number | null;
  storageKey: string;
};

type CvParseResponse = {
  storageKey: string;
  fileName?: string;
  parsed: {
    role: string;
    roleConfidence: number;
    jobTitle: string;
    seniority: string;
    skills: string[];
    headline: string;
    yearsExperience: number | null;
  } | null;
  message?: string;
};

const ROLES = [
  "I build / make",
  "I lead a team",
  "I design",
  "I write",
  "A bit of everything",
];

const HARD = [
  { id: "morning", emoji: "🌅", label: "Mornings — facing the day" },
  { id: "afternoon", emoji: "🌤️", label: "Afternoons — the slump" },
  { id: "night", emoji: "🌙", label: "Late at night" },
];

const PROFILES = [
  {
    id: "rbp",
    emoji: "📱",
    label: "I scroll late and lose sleep",
    name: "Bedtime revenge scroll",
    plan: "A calm night wind‑down to help you set the phone down and reclaim sleep.",
    when: "Evenings, ~10:30pm",
  },
  {
    id: "multi",
    emoji: "🌀",
    label: "Too many things — I freeze",
    name: "Multitask overload",
    plan: "A daytime nudge that hides the pile and points you at one single thing.",
    when: "Daytime, your first slump",
  },
];

export function OnboardingFlow() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [hard, setHard] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [tone] = useState<"warm" | "balanced">("warm");
  const [saving, setSaving] = useState(false);

  // CV upload: when the user uploads a résumé, Gemini reads it and we pre-fill
  // the role + capture professional context (jobTitle, seniority, skills...) so
  // they don't have to type it later. Everything stays optional.
  const [parsing, setParsing] = useState(false);
  const [cvDraft, setCvDraft] = useState<CvDraft | null>(null);

  const prof = PROFILES.find((p) => p.id === profile);

  const onUploadCv = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "txt", "md"].includes(ext)) {
      toast.error(
        "Formato no soportado. Sube tu CV en PDF, TXT o MD (si tienes .docx, expórtalo a PDF)."
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El CV supera los 5 MB.");
      return;
    }

    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetchJson<CvParseResponse>("/api/onboarding/parse-cv", {
        method: "POST",
        body: fd,
      });

      if (!res.parsed) {
        toast.info(
          res.message ??
            "No pudimos leer tu CV. Puedes continuar eligiendo manualmente."
        );
        return;
      }

      setCvDraft({ ...res.parsed, storageKey: res.storageKey });
      if (res.parsed.role) setRole(res.parsed.role);
      toast.success("Listo, leímos tu CV y precargamos tus datos.");
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "No pudimos leer tu CV. Intenta de nuevo o elige manualmente.";
      toast.error(message);
    } finally {
      setParsing(false);
    }
  };

  const complete = async () => {
    if (!role || !hard || !profile) return;
    setSaving(true);
    try {
      await fetchJson("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          hardMoment: hard,
          profileId: profile,
          tone,
          jobTitle: cvDraft?.jobTitle,
          seniority: cvDraft?.seniority,
          headline: cvDraft?.headline,
          skills: cvDraft?.skills,
          cvStorageKey: cvDraft?.storageKey,
        }),
      });
      // Route to project setup. Leaders create a project; everyone else joins one.
      const isLeader =
        role.toLowerCase().includes("lead") || role.toLowerCase().includes("lider");
      router.push(isLeader ? "/setup/project" : "/setup/join");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "We couldn't save your onboarding. Please try again.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const canContinue =
    (step === 0 && role) ||
    (step === 1 && hard) ||
    (step === 2 && profile) ||
    step === 3;

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <DesktopOnboardingRail
        step={step}
        role={role}
        hard={HARD.find((h) => h.id === hard)?.label ?? null}
        profile={prof ? { id: prof.id, name: prof.name } : null}
        className="hidden w-[360px] flex-none border-r border-line lg:flex"
      />

      <div className="flex flex-1 flex-col px-5 py-6 lg:items-center lg:justify-center lg:px-10 lg:py-12">
        <div className="flex flex-1 flex-col w-full lg:max-w-2xl lg:flex-none">
          <div className="flex flex-none items-center gap-3 pb-4 lg:hidden">
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
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-accent" : "bg-line-2"
                  }`}
                />
              ))}
            </div>
            <span className="w-10 text-right text-xs text-ink-3">
              {step + 1}/4
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide py-2 lg:overflow-visible lg:rounded-[28px] lg:border lg:border-line lg:bg-surface lg:px-10 lg:py-12 lg:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
            {step === 0 && (
              <Step>
                <Alpha
                  size={56}
                  mood="happy"
                  className="mb-5 lg:size-[72px]"
                />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  Nice to meet you.
                </h1>
                <p className="mt-3 text-ink-2 lg:mt-4 lg:text-[17px]">
                  What kind of work fills your days? This helps me speak your
                  language.
                </p>
                <div className="mt-6 space-y-2.5 lg:mt-8 lg:space-y-3">
                  {ROLES.map((r) => (
                    <OptionTile
                      key={r}
                      selected={role === r}
                      onClick={() => setRole(r)}
                    >
                      {r}
                    </OptionTile>
                  ))}
                </div>

                <CvUpload
                  parsing={parsing}
                  hasCv={!!cvDraft}
                  onPick={() => fileInputRef.current?.click()}
                  draft={cvDraft}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadCv(f);
                    e.target.value = "";
                  }}
                />
              </Step>
            )}

            {step === 1 && (
              <Step>
                <Alpha
                  size={56}
                  mood="calm"
                  className="mb-5 lg:size-[72px]"
                />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  When is starting hardest?
                </h1>
                <p className="mt-3 text-ink-2 lg:mt-4 lg:text-[17px]">
                  I&apos;ll show up at the moment you need a hand — and stay
                  quiet the rest of the time.
                </p>
                <div className="mt-6 space-y-2.5 lg:mt-8 lg:space-y-3">
                  {HARD.map((h) => (
                    <OptionTile
                      key={h.id}
                      selected={hard === h.id}
                      onClick={() => setHard(h.id)}
                    >
                      <span className="text-xl">{h.emoji}</span>
                      {h.label}
                    </OptionTile>
                  ))}
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step>
                <Alpha
                  size={56}
                  mood="thinking"
                  className="mb-5 lg:size-[72px]"
                />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  What pulls you off the most?
                </h1>
                <p className="mt-3 text-ink-2 lg:mt-4 lg:text-[17px]">
                  Be honest — I&apos;m the only one who sees this.
                </p>
                <div className="mt-6 space-y-3 lg:mt-8">
                  {PROFILES.map((p) => (
                    <OptionTile
                      key={p.id}
                      selected={profile === p.id}
                      onClick={() => setProfile(p.id)}
                      stacked
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-xl">{p.emoji}</span>
                        <span className="font-bold">{p.label}</span>
                      </span>
                    </OptionTile>
                  ))}
                </div>
              </Step>
            )}

            {step === 3 && prof && (
              <Step center>
                <Alpha
                  size={80}
                  mood="happy"
                  ring
                  className="mb-5 lg:size-[104px]"
                />
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                  Here&apos;s how I&apos;ll show up
                </p>
                <h1 className="mt-3 font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  {prof.name}
                </h1>
                <p className="mt-4 max-w-[280px] text-ink-2 lg:max-w-[320px] lg:text-[17px]">
                  {prof.plan}
                </p>
                <Card className="mt-6 flex w-full max-w-[300px] items-center gap-3 lg:max-w-[340px]">
                  <span className="text-xl">🕙</span>
                  <div>
                    <div className="text-xs text-ink-3">
                      I&apos;ll gently check in
                    </div>
                    <div className="text-[15px] font-bold text-ink">
                      {prof.when}
                    </div>
                  </div>
                </Card>
                <p className="mt-4 text-xs text-ink-3">
                  You can change this anytime in Settings. No alarms, ever.
                </p>
              </Step>
            )}
          </div>

          <div className="flex-none pt-4 lg:pt-6">
            {step < 3 ? (
              <Button
                full
                size="lg"
                icon="arrow"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                full
                size="lg"
                disabled={saving}
                onClick={complete}
              >
                {saving ? "Saving..." : "Take me in"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div
      className={`flex min-h-full flex-col ${
        center ? "items-center text-center" : ""
      }`}
    >
      {children}
    </div>
  );
}

function OptionTile({
  selected,
  onClick,
  children,
  stacked,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[20px] border-[1.5px] bg-surface p-4 text-left text-ink transition-all active:scale-[0.98] ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-line hover:bg-surface-2"
      } ${stacked ? "flex flex-col gap-1" : "flex items-center gap-3.5"}`}
    >
      {children}
    </button>
  );
}

function CvUpload({
  parsing,
  hasCv,
  draft,
  onPick,
}: {
  parsing: boolean;
  hasCv: boolean;
  draft: CvDraft | null;
  onPick: () => void;
}) {
  if (hasCv && draft && !parsing) {
    return (
      <div className="mt-3 rounded-[20px] border-[1.5px] border-accent bg-accent-soft p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <span>📄</span>
          <span>Leímos tu CV</span>
        </div>
        {draft.jobTitle && (
          <p className="mt-1 text-sm text-ink-2">{draft.jobTitle}</p>
        )}
        {draft.headline && (
          <p className="mt-0.5 text-xs text-ink-3">{draft.headline}</p>
        )}
        <button
          onClick={onPick}
          className="mt-2 text-xs font-semibold text-accent underline-offset-2 hover:underline"
        >
          Subir otro CV
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" />
        <span>o</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        onClick={onPick}
        disabled={parsing}
        className="flex w-full items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-4 text-sm font-semibold text-ink-2 transition-all hover:bg-surface-2 active:scale-[0.98] disabled:opacity-60"
      >
        {parsing ? (
          <>
            <span className="animate-pulse">Leyendo tu CV…</span>
          </>
        ) : (
          <>
            <span>📄</span>
            <span>Sube tu CV y lo deducimos por ti</span>
          </>
        )}
      </button>
      <p className="mt-1.5 text-center text-[11px] text-ink-3">
        PDF, TXT o MD · máx. 5 MB · solo tú lo ves
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alpha, Button, Card } from "@/shared/ui";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";
import {
  isValidHashtag,
  normalizeHashtag,
} from "@/features/projects/domain/hashtag";
import { METHODOLOGIES } from "@/features/project-settings/domain/catalog";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

const EMOJIS = ["🚀", "🌱", "🎨", "🛠️", "📊", "🔬", "📚", "💡", "🎯", "⚡", "🌍", "❤️"];

const INDUSTRIES = [
  { key: "tech", labelKey: "wizard.ind.tech" },
  { key: "edu", labelKey: "wizard.ind.edu" },
  { key: "health", labelKey: "wizard.ind.health" },
  { key: "marketing", labelKey: "wizard.ind.marketing" },
  { key: "design", labelKey: "wizard.ind.design" },
  { key: "finance", labelKey: "wizard.ind.finance" },
  { key: "construction", labelKey: "wizard.ind.construction" },
  { key: "retail", labelKey: "wizard.ind.retail" },
  { key: "other", labelKey: "wizard.ind.other" },
];

const CATEGORIES = [
  { key: "launch", labelKey: "wizard.cat.launch" },
  { key: "product", labelKey: "wizard.cat.product" },
  { key: "research", labelKey: "wizard.cat.research" },
  { key: "campaign", labelKey: "wizard.cat.campaign" },
  { key: "operations", labelKey: "wizard.cat.operations" },
  { key: "event", labelKey: "wizard.cat.event" },
  { key: "other", labelKey: "wizard.cat.other" },
];

const TEAM_SIZES = [
  { id: "solo", labelKey: "wizard.team.solo" },
  { id: "2-5", labelKey: "wizard.team.2-5" },
  { id: "6-15", labelKey: "wizard.team.6-15" },
  { id: "16-50", labelKey: "wizard.team.16-50" },
  { id: "50+", labelKey: "wizard.team.50+" },
];

const TONES = [
  { id: "warm", labelKey: "wizard.tone.warm", emoji: "🤗" },
  { id: "balanced", labelKey: "wizard.tone.balanced", emoji: "🧭" },
];

const DESIGN_THINKING_HINTS = [
  "usuario",
  "user",
  "ux",
  "research",
  "investigaci",
  "prototip",
  "empat",
  "landing",
  "web",
  "app",
  "dise",
  "design",
  "marca",
  "brand",
];

function ruleBasedMethodology(
  industry: string | null,
  category: string | null,
  description: string
): string | null {
  const text = `${industry ?? ""} ${category ?? ""} ${description}`.toLowerCase();
  if (DESIGN_THINKING_HINTS.some((h) => text.includes(h))) return "design_thinking";
  if (category === "launch" || category === "operations" || category === "event") {
    return "scrum";
  }
  return null;
}

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
  const [locale] = useLocale();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [hashtag, setHashtag] = useState("");
  const [hashtagTouched, setHashtagTouched] = useState(false);
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

  const [methodologyHint, setMethodologyHint] = useState<{
    loading: boolean;
    data: { key: string; rationale: string; confidence: number } | null;
    error: string | null;
  }>({ loading: false, data: null, error: null });
  const methodologyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedMethodology, setSelectedMethodology] = useState<string | null>(null);
  const userPickedMethodology = useRef(false);

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

  useEffect(() => {
    if (step !== 1) return;
    const desc = description.trim();
    if (desc.length < 12) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMethodologyHint({ loading: false, data: null, error: null });
      return;
    }
    if (methodologyTimer.current) clearTimeout(methodologyTimer.current);
    methodologyTimer.current = setTimeout(async () => {
      setMethodologyHint({ loading: true, data: null, error: null });
      const indLabel = INDUSTRIES.find((i) => i.key === industry)?.labelKey;
      const catLabel = CATEGORIES.find((c) => c.key === category)?.labelKey;
      try {
        const res = await fetchJson<{ suggestion: { key: string; rationale: string; confidence: number } }>(
          "/api/projects/suggest-methodology",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: desc,
              industry: indLabel ? t(locale, indLabel) : industry ?? undefined,
              category: catLabel ? t(locale, catLabel) : category ?? undefined,
            }),
          }
        );
        setMethodologyHint({ loading: false, data: res.suggestion, error: null });
        if (!userPickedMethodology.current) {
          setSelectedMethodology(res.suggestion.key);
        }
      } catch (err) {
        const message =
          err instanceof ApiError || err instanceof Error ? err.message : null;
        setMethodologyHint({ loading: false, data: null, error: message });
      }
    }, 650);
    return () => {
      if (methodologyTimer.current) clearTimeout(methodologyTimer.current);
    };
  }, [step, description, industry, category, locale]);

  const canContinue =
    (step === 0 && name.trim().length >= 2 && hashtagOk) ||
    (step === 1 && description.trim().length > 0 && industry && category && !!selectedMethodology) ||
    (step === 2 && !!teamSize) ||
    step === 3;

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

      const industryLabel = INDUSTRIES.find((i) => i.key === industry);
      const categoryLabel = CATEGORIES.find((c) => c.key === category);
      const created = await fetchJson<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          emoji,
          hashtag: normalized,
          description: description.trim() || undefined,
          industry: industryLabel ? t(locale, industryLabel.labelKey) : undefined,
          category: categoryLabel ? t(locale, categoryLabel.labelKey) : undefined,
          teamSize: teamSize ?? undefined,
          tone,
          methodology: selectedMethodology,
          knowledgeBase: cleanDocs,
          goal:
            goalTitle.trim().length > 0
              ? { title: goalTitle.trim(), milestone: milestone.trim() || undefined }
              : null,
        }),
      });
      toast.success(t(locale, "wizard.created"));

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
          : t(locale, "wizard.createError");
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
              <Alpha size={72} mood="happy" ring />
              <div className="flex flex-col">
                <span className="font-display text-2xl tracking-tight text-ink">
                  {t(locale, "wizard.newProject")}
                </span>
                <span className="text-xs text-ink-3">
                  {t(locale, "wizard.subtitle")}
                </span>
              </div>
            </div>
            <p className="max-w-[260px] text-[15px] leading-relaxed text-ink-2">
              {name.trim()
                ? `${emoji} ${name.trim()}`
                : t(locale, "wizard.introName")}
            </p>
          </div>
          <ol className="flex flex-col gap-3">
            {[
              "wizard.step.identity",
              "wizard.step.about",
              "wizard.step.team",
              "wizard.step.knowledge",
            ].map((labelKey, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li
                  key={labelKey}
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
                    {t(locale, labelKey)}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-ink-3">
            {t(locale, "wizard.footnote")}
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
              <div className="flex flex-col">
                <Alpha size={56} mood="happy" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  {t(locale, "wizard.s0.title")}
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  {t(locale, "wizard.s0.desc")}
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s0.name")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setName(v);
                    if (!hashtagTouched) {
                      setHashtag(v.trim() ? normalizeHashtag(v) : "");
                    }
                  }}
                  placeholder={t(locale, "wizard.s0.namePlaceholder")}
                  maxLength={60}
                  className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s0.emoji")}
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

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s0.hashtag")}
                </label>
                <input
                  type="text"
                  value={hashtag}
                  onChange={(e) => {
                    setHashtagTouched(true);
                    setHashtag(e.target.value);
                  }}
                  placeholder="#mi-proyecto"
                  className={`mt-2 w-full rounded-2xl border-[1.5px] bg-surface px-4 py-3 font-mono text-ink placeholder:text-ink-3 outline-none ${
                    hashtag && !hashtagValid
                      ? "border-glow"
                      : hashtagOk
                        ? "border-sage"
                        : "border-line-2 focus:border-accent"
                  }`}
                />

                {!hashtagTouched && name.trim().length >= 2 && (
                  <p className="mt-2 text-xs text-ink-3">
                    {t(locale, "wizard.s0.suggested")}
                  </p>
                )}

                {hashtag && !hashtagValid && (
                  <p className="mt-2 text-sm text-glow">
                    {t(locale, "wizard.s0.invalid")} <span className="font-mono">{normalized}</span>
                  </p>
                )}
                {checkingHashtag && (
                  <p className="mt-2 text-sm text-ink-3">{t(locale, "wizard.s0.checking")}</p>
                )}
                {hashtagValid && hashtagChecked && !checkingHashtag && (
                  <p
                    className={`mt-2 text-sm ${
                      hashtagAvailable ? "text-sage" : "text-glow"
                    }`}
                  >
                    {hashtagAvailable
                      ? t(locale, "wizard.s0.available", { tag: normalized })
                      : t(locale, "wizard.s0.taken", { tag: normalized })}
                  </p>
                )}

                <Card className="mt-6 flex items-center gap-3">
                  <span className="text-xl">💡</span>
                  <p className="text-sm text-ink-2">
                    {t(locale, "wizard.s0.tip")}{" "}
                    <span className="font-mono">#landing-v2</span>.
                  </p>
                </Card>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col">
                <Alpha size={56} mood="calm" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  {t(locale, "wizard.s1.title")}
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  {t(locale, "wizard.s1.desc")}
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s1.description")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(locale, "wizard.s1.descPlaceholder")}
                  maxLength={600}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                      {t(locale, "wizard.s1.industry")}
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {INDUSTRIES.map((ind) => (
                        <Chip
                          key={ind.key}
                          selected={industry === ind.key}
                          onClick={() => setIndustry(ind.key)}
                        >
                          {t(locale, ind.labelKey)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                      {t(locale, "wizard.s1.category")}
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <Chip
                          key={cat.key}
                          selected={category === cat.key}
                          onClick={() => setCategory(cat.key)}
                        >
                          {t(locale, cat.labelKey)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <MethodologySuggestionCard
                hint={methodologyHint}
                locale={locale}
                selectedKey={selectedMethodology}
                fallbackSuggestedKey={ruleBasedMethodology(industry, category, description)}
                onSelect={(key) => {
                  userPickedMethodology.current = true;
                  setSelectedMethodology(key);
                }}
              />
            )}

            {step === 2 && (
              <div className="flex flex-col">
                <Alpha size={56} mood="happy" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  {t(locale, "wizard.s2.title")}
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  {t(locale, "wizard.s2.desc")}
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s2.teamSize")}
                </label>
                <div className="mt-2 space-y-2.5">
                  {TEAM_SIZES.map((tm) => (
                    <OptionTile
                      key={tm.id}
                      selected={teamSize === tm.id}
                      onClick={() => setTeamSize(tm.id)}
                    >
                      {t(locale, tm.labelKey)}
                    </OptionTile>
                  ))}
                </div>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s2.tone")}
                </label>
                <div className="mt-2 space-y-2.5">
                  {TONES.map((tn) => (
                    <OptionTile
                      key={tn.id}
                      selected={tone === tn.id}
                      onClick={() => setTone(tn.id as "warm" | "balanced")}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-xl">{tn.emoji}</span>
                        <span className="font-bold">{t(locale, tn.labelKey)}</span>
                      </span>
                    </OptionTile>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col">
                <Alpha size={56} mood="happy" className="mb-5 lg:size-[72px]" />
                <h1 className="font-display text-[28px] leading-tight text-ink lg:text-[34px]">
                  {t(locale, "wizard.s3.title")}
                </h1>
                <p className="mt-3 text-ink-2 lg:text-[17px]">
                  {t(locale, "wizard.s3.desc")}
                </p>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s3.docs")}
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
                        placeholder={t(locale, "wizard.s3.docTitlePlaceholder")}
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
                          aria-label={t(locale, "wizard.s3.remove")}
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
                    {t(locale, "wizard.s3.addAnother")}
                  </button>
                </div>

                <label className="mt-6 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s3.firstGoal")}
                </label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder={t(locale, "wizard.s3.firstGoalPlaceholder")}
                  className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <label className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "wizard.s3.firstMilestone")}
                </label>
                <input
                  type="text"
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  placeholder={t(locale, "wizard.s3.firstMilestonePlaceholder")}
                  className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                />

                <div className="mt-7 rounded-2xl border border-line-2 bg-surface-2 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                    {t(locale, "wizard.s3.summary")}
                  </p>
                  <p className="mt-2 text-[15px] text-ink">
                    {emoji} <b>{name.trim() || t(locale, "wizard.s3.yourProject")}</b>{" "}
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
            {step < 3 ? (
              <Button
                full
                size="lg"
                icon="arrow"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
              >
                {t(locale, "wizard.continue")}
              </Button>
            ) : (
              <Button full size="lg" loading={saving} disabled={saving} onClick={submit}>
                {saving ? t(locale, "wizard.creating") : t(locale, "wizard.create")}
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

interface MethodologyHintState {
  loading: boolean;
  data: { key: string; rationale: string; confidence: number } | null;
  error: string | null;
}

function MethodologySuggestionCard({
  hint,
  locale,
  selectedKey,
  fallbackSuggestedKey,
  onSelect,
}: {
  hint: MethodologyHintState;
  locale: import("@/i18n/messages").Locale;
  selectedKey: string | null;
  fallbackSuggestedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const OPTIONS = METHODOLOGIES.filter(
    (m) => m.key === "scrum" || m.key === "design_thinking"
  );

  const suggestedKey = hint.data?.key ?? fallbackSuggestedKey;
  const confidenceLabel = hint.data
    ? hint.data.confidence >= 75
      ? t(locale, "wizard.method.confHigh")
      : hint.data.confidence >= 50
        ? t(locale, "wizard.method.confMid")
        : t(locale, "wizard.method.confLow")
    : null;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <span className="text-base">🧭</span>
        <label className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
          {t(locale, "wizard.method.choose")}
        </label>
      </div>

      {hint.loading && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line-2 bg-surface-2 px-4 py-3">
          <span className="text-sm">✨</span>
          <span className="text-[13px] text-ink-3">{t(locale, "wizard.method.loading")}</span>
        </div>
      )}

      {!hint.loading && hint.data && (
        <div className="mt-2 rounded-2xl border border-line-2 bg-surface-2 p-4">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              {t(locale, "wizard.method.suggests")}
            </span>
            {confidenceLabel && (
              <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">
                {confidenceLabel}
              </span>
            )}
          </div>
          {hint.data.rationale && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
              {hint.data.rationale}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((m) => {
          const isSelected = m.key === selectedKey;
          const isSuggested = m.key === suggestedKey;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                isSelected
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface-2 hover:bg-surface-3"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{m.emoji}</span>
                {isSelected ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">
                    {isSuggested
                      ? t(locale, "wizard.method.recommended")
                      : t(locale, "wizard.method.selected")}
                  </span>
                ) : isSuggested ? (
                  <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] font-bold text-accent">
                    {t(locale, "wizard.method.recommended")}
                  </span>
                ) : null}
              </div>
              <span className="font-display text-base text-ink">{m.name}</span>
              <span className="text-[12.5px] text-ink-2">{m.description}</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {m.benefits.slice(0, 2).map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-3"
                  >
                    {b}
                  </span>
                ))}
              </div>
              <p className="pt-1 text-[11.5px] text-glow">✨ {m.aiHint}</p>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11.5px] text-ink-3">
        {t(locale, "wizard.method.note")}
      </p>
    </div>
  );
}

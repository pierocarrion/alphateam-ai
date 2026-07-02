"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Icon, TopBar } from "@/shared/ui";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";
import { cn } from "@/shared/lib/cn";
import { useLocale } from "@/i18n/useLocale";
import { t, type Locale } from "@/i18n/messages";

interface Category {
  id: string;
  key: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface Resource {
  id: string;
  title: string;
  summary: string | null;
  contentText: string;
  fileType: string;
  sourceUrl: string | null;
  isPremium: boolean;
  tags: string[];
  categoryId: string | null;
  viewCount: number;
  useCount: number;
  updatedAt: string;
}

interface SearchHit {
  resource: {
    id: string;
    title: string;
    summary: string | null;
    tags: string[];
    isPremium: boolean;
    fileType: string;
  };
  score: number;
  snippet: string;
  source: "semantic" | "keyword" | "hybrid";
}

interface KnowledgeHubClientProps {
  workspaceId: string;
}

const FILE_KEYS: Record<string, string> = {
  text: "knowledge.file.text",
  pdf: "knowledge.file.pdf",
  docx: "knowledge.file.docx",
  xlsx: "knowledge.file.xlsx",
  pptx: "knowledge.file.pptx",
  image: "knowledge.file.image",
  video: "knowledge.file.video",
  link: "knowledge.file.link",
};

export function KnowledgeHubClient({ workspaceId }: KnowledgeHubClientProps) {
  const baseUrl = `/api/workspaces/${workspaceId}/knowledge-hub`;
  const [locale] = useLocale();
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [semanticMode, setSemanticMode] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [onlyMethodology, setOnlyMethodology] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim() && !semanticMode) params.set("search", search.trim());
        if (activeCategory) params.set("categoryId", activeCategory);
        const res = await fetchJson<{ items: Resource[]; categories: Category[]; total: number }>(
          `${baseUrl}?${params.toString()}`
        );
        if (!active) return;
        setResources(res.items);
        setCategories(res.categories);
      } catch (err) {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : t(locale, "knowledge.loadError"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [baseUrl, search, activeCategory, semanticMode, locale]);

  const reload = useCallback(async () => {
    try {
      const res = await fetchJson<{ items: Resource[]; categories: Category[]; total: number }>(
        `${baseUrl}?`
      );
      setResources(res.items);
      setCategories(res.categories);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "knowledge.reloadError"));
    }
  }, [baseUrl, locale]);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      setSearchHits(null);
      void reload();
      return;
    }
    setSearching(true);
    try {
      if (semanticMode) {
        const res = await fetchJson<{ results: SearchHit[] }>(`${baseUrl}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: search.trim(), mode: "hybrid" }),
        });
        setSearchHits(res.results);
      } else {
        await reload();
        setSearchHits(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "knowledge.searchError"));
    } finally {
      setSearching(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    // Images go through the intelligent multimodal ingest flow (Gemini Vision)
    // instead of being stored as a generic file titled by its file name.
    if (file.type.startsWith("image/")) {
      setImageFile(file);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (activeCategory) form.append("categoryId", activeCategory);
      const res = await fetchJson<{ resource: Resource }>(`${baseUrl}/upload`, {
        method: "POST",
        body: form,
      });
      toast.success(t(locale, "knowledge.uploaded", { title: res.resource.title }));
      void reload();
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : t(locale, "knowledge.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetchJson(`${baseUrl}/${id}`, { method: "DELETE" });
      setResources((prev) => prev.filter((r) => r.id !== id));
      toast.success(t(locale, "knowledge.removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "knowledge.removeError"));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar className="lg:hidden" kicker={t(locale, "knowledge.kicker")} title={t(locale, "knowledge.title")} />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-6 pb-10 lg:mx-auto lg:w-full lg:max-w-3xl lg:pt-8">
        <header className="mb-6">
          <div className="flex items-center gap-2.5">
            <Icon name="doc" size={22} color="var(--color-accent)" />
            <h1 className="font-display text-2xl text-ink">{t(locale, "knowledge.title")}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
            {t(locale, "knowledge.desc")}
          </p>
        </header>

        {/* Search */}
        <form onSubmit={runSearch} className="mb-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <Icon name="search" size={16} color="var(--color-ink-3)" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(locale, "knowledge.searchPlaceholder")}
                className="w-full rounded-2xl border border-line-2 bg-surface py-3 pl-9 pr-3 text-[14.5px] text-ink placeholder:text-ink-3 outline-none focus:border-accent"
              />
            </div>
            <Button type="submit" size="sm" disabled={searching}>
              {searching ? t(locale, "knowledge.searching") : t(locale, "knowledge.search")}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-3">
            <input
              type="checkbox"
              checked={semanticMode}
              onChange={(e) => setSemanticMode(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            {t(locale, "knowledge.semantic")}
          </label>
        </form>

        {/* Category filter */}
        <div className="mb-3 flex flex-wrap gap-2">
          <CategoryChip
            active={activeCategory === null}
            onClick={() => {
              setActiveCategory(null);
              setSearchHits(null);
            }}
            label={t(locale, "knowledge.all")}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              active={activeCategory === c.id}
              onClick={() => {
                setActiveCategory(c.id);
                setSearchHits(null);
              }}
              label={c.name}
              color={c.color ?? undefined}
            />
          ))}
        </div>

        {/* Origin filter: methodology artifacts */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyMethodology((v) => !v)}
            className={cn(
              "rounded-full border-[1.5px] px-3 py-1 text-[12px] font-semibold transition-colors",
              onlyMethodology
                ? "border-accent bg-accent-soft text-ink"
                : "border-line text-ink-3 hover:bg-surface-2"
            )}
          >
            🧭 Origen: Metodología
          </button>
          {onlyMethodology && (
            <span className="text-[11.5px] text-ink-3">
              Artefactos generados al seguir la metodología del proyecto.
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowCreate((v) => !v)}>
            <Icon name="plus" size={14} color="currentColor" /> {t(locale, "knowledge.newEntry")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Icon name="doc" size={14} color="currentColor" />
            {uploading ? t(locale, "knowledge.uploading") : t(locale, "knowledge.uploadFile")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onUpload}
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx,image/*"
          />
        </div>

        {showCreate && (
          <CreateResourceForm
            baseUrl={baseUrl}
            categories={categories}
            defaultCategoryId={activeCategory}
            onCreated={() => {
              setShowCreate(false);
              void reload();
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {editingId && (
          <EditResourceModal
            baseUrl={baseUrl}
            resourceId={editingId}
            categories={categories}
            onSaved={() => {
              setEditingId(null);
              void reload();
            }}
            onCancel={() => setEditingId(null)}
          />
        )}

        {imageFile && (
          <IngestImageModal
            baseUrl={baseUrl}
            categories={categories}
            defaultCategoryId={activeCategory}
            initialFile={imageFile}
            onSaved={() => {
              setImageFile(null);
              void reload();
            }}
            onCancel={() => setImageFile(null)}
          />
        )}

        {/* Semantic results */}
        {searchHits && (
          <section className="mb-6">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              {t(locale, "knowledge.resultsByRelevance")}
            </div>
            {searchHits.length === 0 ? (
              <EmptyState text={t(locale, "knowledge.noSemanticResults")} />
            ) : (
              <div className="flex flex-col gap-3">
                {searchHits.map((hit) => (
                  <Card key={hit.resource.id} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-bold text-ink">{hit.resource.title}</p>
                      <SourceBadge source={hit.source} locale={locale} />
                    </div>
                    {hit.snippet && (
                      <p className="text-sm text-ink-2">{hit.snippet}</p>
                    )}
                    {hit.resource.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {hit.resource.tags.slice(0, 5).map((t) => (
                          <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Resource list */}
        {!searchHits && (
          <section>
            {loading ? (
              <p className="text-sm text-ink-3">{t(locale, "common.loading")}</p>
            ) : (onlyMethodology ? resources.filter((r) => r.tags.includes("methodology")) : resources).length === 0 ? (
              <EmptyState text={onlyMethodology ? "Aún no hay artefactos de metodología. Completa uno desde /project/phases." : t(locale, "knowledge.noResources")} />
            ) : (
              <div className="flex flex-col gap-3">
                {(onlyMethodology ? resources.filter((r) => r.tags.includes("methodology")) : resources).map((r) => (
                  <Card key={r.id} className="flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-surface-2">
                        <Icon name="doc" size={18} color="var(--color-ink-2)" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="break-words text-[15px] font-bold text-ink">{r.title}</p>
                          {r.isPremium && <PremiumBadge />}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
                          <span>{FILE_KEYS[r.fileType] ? t(locale, FILE_KEYS[r.fileType]) : r.fileType}</span>
                          <span>·</span>
                          <span>{t(locale, "knowledge.views", { count: r.viewCount })}</span>
                          {r.sourceUrl && (
                            <>
                              <span>·</span>
                              <a
                                href={r.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:text-accent"
                              >
                                <Icon name="link" size={11} color="currentColor" /> {t(locale, "knowledge.origin")}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {r.summary && <p className="text-sm text-ink-2">{r.summary}</p>}
                    {r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.tags.slice(0, 6).map((t) => (
                          <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(r.id)}>
                        {t(locale, "common.edit")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                        {t(locale, "common.delete")}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-accent bg-accent-soft text-ink"
          : "border-line-2 bg-surface text-ink-2 hover:bg-white/[0.04]"
      )}
      style={active && color ? { borderColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function SourceBadge({ source, locale }: { source: SearchHit["source"]; locale: Locale }) {
  const map: Record<SearchHit["source"], string> = {
    semantic: t(locale, "knowledge.source.semantic"),
    keyword: t(locale, "knowledge.source.keyword"),
    hybrid: t(locale, "knowledge.source.hybrid"),
  };
  return (
    <span className="flex-none rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
      {map[source]}
    </span>
  );
}

function PremiumBadge() {
  return (
    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
      PRO
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="text-[15px] text-ink-2">{text}</p>
    </div>
  );
}

function CreateResourceForm({
  baseUrl,
  categories,
  defaultCategoryId,
  onCreated,
  onCancel,
}: {
  baseUrl: string;
  categories: Category[];
  defaultCategoryId: string | null;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [locale] = useLocale();

  const canSave = title.trim().length > 0 && content.trim().length > 0 && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await fetchJson(`${baseUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contentText: content.trim(),
          categoryId: categoryId ?? undefined,
          tags: tags.split(",").map((tg) => tg.trim()).filter(Boolean),
          ingest: true,
        }),
      });
      toast.success(t(locale, "knowledge.created"));
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "knowledge.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-6 flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">{t(locale, "knowledge.newEntry")}</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder={t(locale, "knowledge.resourceTitlePlaceholder")}
        className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        placeholder={t(locale, "knowledge.contentPlaceholder")}
        className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className="rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink outline-none focus:border-accent"
        >
          <option value="">{t(locale, "knowledge.noCategory")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t(locale, "knowledge.tagsPlaceholder")}
          className="rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          {t(locale, "common.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={!canSave}>
          {saving ? t(locale, "common.saving") : t(locale, "knowledge.createIndex")}
        </Button>
      </div>
    </form>
  );
}

function EditResourceModal({
  baseUrl,
  resourceId,
  categories,
  onSaved,
  onCancel,
}: {
  baseUrl: string;
  resourceId: string;
  categories: Category[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [reingest, setReingest] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locale] = useLocale();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchJson<{ resource: Resource }>(`${baseUrl}/${resourceId}`);
        if (!active) return;
        const r = res.resource;
        setTitle(r.title);
        setContent(r.contentText);
        setSummary(r.summary ?? "");
        setCategoryId(r.categoryId);
        setTags(r.tags.join(", "));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t(locale, "knowledge.loadResourceError"));
        onCancel();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await fetchJson(`${baseUrl}/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          contentText: content.trim(),
          categoryId: categoryId ?? null,
          tags: tags.split(",").map((tg) => tg.trim()).filter(Boolean),
          reingest,
        }),
      });
      toast.success(reingest ? t(locale, "knowledge.updatedReindex") : t(locale, "knowledge.updated"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "knowledge.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-3xl border border-line-2 bg-bg-2 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[20px] text-ink">{t(locale, "knowledge.editTitle")}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-3 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-ink-3">{t(locale, "common.loading")}</p>
        ) : (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t(locale, "knowledge.resourceTitlePlaceholder")}
              className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={t(locale, "knowledge.summaryPlaceholder")}
              className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder={t(locale, "knowledge.contentResourcePlaceholder")}
              className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink outline-none focus:border-accent"
              >
                <option value="">{t(locale, "knowledge.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t(locale, "knowledge.tagsPlaceholder")}
                className="rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-3">
              <input
                type="checkbox"
                checked={reingest}
                onChange={(e) => setReingest(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              {t(locale, "knowledge.reindexLabel")}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
                {t(locale, "common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t(locale, "common.saving") : t(locale, "knowledge.saveChanges")}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

interface AnalyzeImageResponse {
  storageKey: string;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  fileType: string;
  metadata: {
    title: string;
    description: string;
    summary: string;
    category: string;
    tags: string[];
    altText: string;
    objects: string[];
    ocrText: string;
  } | null;
  categoryId: string | null;
  warning: string | null;
}

/**
 * Multimodal ingest modal. Opens with the image the user just picked, uploads
 * it to Cloud Storage, runs Gemini Vision to auto-fill the form (title,
 * summary, description, category, tags, alt text) and lets the leader review or
 * edit before the resource is saved. If the AI analysis fails the form stays
 * fully editable so the process is never blocked. Replacing the image re-runs
 * the whole analysis.
 */
function IngestImageModal({
  baseUrl,
  categories,
  defaultCategoryId,
  initialFile,
  onSaved,
  onCancel,
}: {
  baseUrl: string;
  categories: Category[];
  defaultCategoryId: string | null;
  initialFile: File;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File>(initialFile);
  const [previewUrl, setPreviewUrl] = useState<string>(
    URL.createObjectURL(initialFile)
  );
  const [analyzing, setAnalyzing] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [tags, setTags] = useState("");
  const [altText, setAltText] = useState("");
  const [objects, setObjects] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState("");

  const [saving, setSaving] = useState(false);
  const [locale] = useLocale();
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    // Inline async IIFE so setState only runs after the first await (matches
    // the pattern in EditResourceModal and keeps react-hooks happy).
    (async () => {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetchJson<AnalyzeImageResponse>(`${baseUrl}/analyze-image`, {
          method: "POST",
          body: form,
        });
        if (!active) return;
        setStorageKey(res.storageKey);
        setPreviewUrl(res.previewUrl);
        const meta = res.metadata;
        if (meta) {
          setTitle(meta.title || "");
          setSummary(meta.summary || "");
          setDescription(meta.description || "");
          setTags(meta.tags.join(", "));
          setAltText(meta.altText || "");
          setObjects(meta.objects);
          setOcrText(meta.ocrText);
          if (res.categoryId) setCategoryId(res.categoryId);
        }
        if (res.warning) setWarning(res.warning);
      } catch (err) {
        if (!active) return;
        setWarning(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : t(locale, "knowledge.image.analyzeError")
        );
      } finally {
        if (active) setAnalyzing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [file, baseUrl, locale]);

  // Revoke object URLs to avoid leaking blob memory on every replacement.
  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0];
    if (replaceInputRef.current) replaceInputRef.current.value = "";
    if (!next) return;
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    // Reset derived fields so stale data from the previous image never lingers,
    // and flip the loading flag back on so the spinner shows during re-analysis.
    setAnalyzing(true);
    setWarning(null);
    setTitle("");
    setSummary("");
    setDescription("");
    setTags("");
    setAltText("");
    setObjects([]);
    setOcrText("");
    setStorageKey(null);
  };

  const canSave = title.trim().length > 0 && !saving && !analyzing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      // Compose a searchable text representation of the image so the RAG
      // pipeline (chunks + embeddings) has something semantic to index even
      // though the binary itself isn't embeddable.
      const contentParts = [
        description.trim(),
        summary.trim(),
        altText.trim(),
        ocrText.trim(),
        objects.length > 0 ? `Objetos: ${objects.join(", ")}` : "",
      ].filter(Boolean);
      const contentText =
        contentParts.join("\n\n") || `Imagen: ${title.trim()}`;

      await fetchJson(`${baseUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || undefined,
          contentText,
          categoryId: categoryId ?? undefined,
          fileType: "image",
          storageKey: storageKey ?? undefined,
          sourceType: "upload",
          sourceApp: "upload",
          tags: tags
            .split(",")
            .map((tg) => tg.trim())
            .filter(Boolean),
          aiMetadata: {
            description: description.trim(),
            altText: altText.trim(),
            objects,
            ocrText: ocrText.trim(),
            category: "",
            visionModel: "gemini",
          },
          ingest: true,
        }),
      });
      toast.success(t(locale, "knowledge.image.saved"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "knowledge.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-3xl border border-line-2 bg-bg-2 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[20px] text-ink">
            {t(locale, "knowledge.image.ingestTitle")}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-3 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-2">
          <div className="relative overflow-hidden rounded-2xl border border-line-2 bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={altText || title || file.name}
              className="max-h-64 w-full object-contain"
            />
            {analyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-2/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-xs font-semibold text-ink-2">
                    {t(locale, "knowledge.image.analyzing")}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-3">{t(locale, "knowledge.image.dragHint")}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => replaceInputRef.current?.click()}
              disabled={analyzing || saving}
            >
              <Icon name="plus" size={14} color="currentColor" />
              {t(locale, "knowledge.image.replace")}
            </Button>
            <input
              ref={replaceInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={onReplace}
            />
          </div>
        </div>

        {warning && (
          <div className="rounded-2xl border border-glow-soft bg-glow-soft/30 px-4 py-2.5 text-[13px] text-ink-2">
            ⚠ {warning}
          </div>
        )}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder={t(locale, "knowledge.resourceTitlePlaceholder")}
          className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={t(locale, "knowledge.image.descriptionPlaceholder")}
          className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder={t(locale, "knowledge.summaryPlaceholder")}
          className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
        <input
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          maxLength={300}
          placeholder={t(locale, "knowledge.image.altPlaceholder")}
          className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink outline-none focus:border-accent"
          >
            <option value="">{t(locale, "knowledge.noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t(locale, "knowledge.tagsPlaceholder")}
            className="rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
          />
        </div>

        {/* Read-only AI signals */}
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/40 p-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
              {t(locale, "knowledge.image.detectedObjects")}
            </p>
            {objects.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {objects.map((o) => (
                  <span
                    key={o}
                    className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3"
                  >
                    {o}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-0.5 text-[12px] text-ink-3">
                {t(locale, "knowledge.image.noObjects")}
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
              {t(locale, "knowledge.image.ocr")}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-ink-2">
              {ocrText.trim() || t(locale, "knowledge.image.noOcr")}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {t(locale, "common.cancel")}
          </Button>
          <Button type="submit" disabled={!canSave}>
            {saving ? t(locale, "common.saving") : t(locale, "knowledge.createIndex")}
          </Button>
        </div>
      </form>
    </div>
  );
}

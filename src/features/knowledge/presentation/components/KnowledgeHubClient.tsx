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
  }, [baseUrl, search, activeCategory, semanticMode]);

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
  }, [baseUrl]);

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
    if (!file) return;
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
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        <div className="mb-5 flex flex-wrap gap-2">
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

        {/* Semantic results */}
        {searchHits && (
          <section className="mb-6">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              {t(locale, "knowledge.resultsByRelevance")}
            </div>
            {searchHits.length === 0 ? (
              <EmptyState text={t(locale, "knowledge.noSemanticResults")} locale={locale} />
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
            ) : resources.length === 0 ? (
              <EmptyState text={t(locale, "knowledge.noResources")} locale={locale} />
            ) : (
              <div className="flex flex-col gap-3">
                {resources.map((r) => (
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

function EmptyState({ text, locale: _locale }: { text: string; locale?: Locale }) {
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
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          reingest,
        }),
      });
      toast.success(reingest ? "Recurso actualizado y reindexado con IA." : "Recurso actualizado.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar los cambios.");
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
          <h3 className="font-display text-[20px] text-ink">Editar recurso</h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-3 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-ink-3">Cargando…</p>
        ) : (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Título del recurso"
              className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Resumen breve (opcional)"
              className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Contenido del recurso"
              className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink outline-none focus:border-accent"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Etiquetas separadas por coma"
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
              Volver a trocear e indexar con IA tras guardar (recomendado si cambió el contenido)
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

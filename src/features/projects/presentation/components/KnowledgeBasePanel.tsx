"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon, TopBar } from "@/shared/ui";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";

interface KnowledgeItem {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  sourceApp: string | null;
  sourceUrl: string | null;
  createdAt: string;
}

interface KnowledgeBasePanelProps {
  workspaceId: string;
}

interface FormState {
  title: string;
  content: string;
  sourceUrl: string;
}

const EMPTY_FORM: FormState = { title: "", content: "", sourceUrl: "" };

export function KnowledgeBasePanel({ workspaceId }: KnowledgeBasePanelProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const baseUrl = `/api/workspaces/${workspaceId}/knowledge`;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchJson<{ items: KnowledgeItem[] }>(baseUrl);
        if (active) setItems(res.items);
      } catch (err) {
        if (!active) return;
        const msg =
          err instanceof Error
            ? err.message
            : "No pudimos cargar la base de conocimiento.";
        toast.error(msg);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [baseUrl]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      sourceUrl: item.sourceUrl ?? "",
    });
  };

  const canSave = form.title.trim().length >= 1 && form.content.trim().length >= 1 && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        title: form.title.trim(),
        content: form.content.trim(),
        sourceUrl: form.sourceUrl.trim() || undefined,
      });
      if (editingId) {
        const res = await fetchJson<{ item: KnowledgeItem }>(
          `${baseUrl}/${editingId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
          }
        );
        setItems((prev) =>
          prev.map((it) => (it.id === editingId ? res.item : it))
        );
        toast.success("Entrada actualizada.");
      } else {
        const res = await fetchJson<{ item: KnowledgeItem }>(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        setItems((prev) => [...prev, res.item]);
        toast.success("Entrada añadida.");
      }
      resetForm();
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "No pudimos guardar la entrada.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (removingId) return;
    setRemovingId(id);
    try {
      await fetchJson(`${baseUrl}/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (editingId === id) resetForm();
      toast.success("Entrada eliminada.");
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "No pudimos eliminar la entrada.";
      toast.error(msg);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        className="lg:hidden"
        kicker="Coordinación"
        title="Base de conocimiento"
      />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-6 pb-6 lg:mx-auto lg:w-full lg:max-w-2xl lg:pt-8 lg:pb-8">
        <div className="mb-6">
          <div className="flex items-center gap-2.5">
            <Icon name="doc" size={22} color="var(--color-accent)" />
            <h1 className="font-display text-2xl text-ink">
              Base de conocimiento
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
            Aquí vive el contexto que Alpha usa para ayudarte a reducir y
            organizar el trabajo del equipo. Añade briefs, documentos,
            objetivos o cualquier note que dé sentido a las tareas.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="mb-6 flex flex-col gap-3 rounded-card border border-line bg-surface p-5"
        >
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
            {editingId ? "Editar entrada" : "Nueva entrada"}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              Título
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={120}
              placeholder="Ej. Brief del lanzamiento Q3"
              className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              Contenido
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              maxLength={8000}
              rows={5}
              placeholder="Pega aquí el texto, el resumen o las notas que Alpha debe conocer."
              className="mt-2 w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              URL de origen (opcional)
            </label>
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              maxLength={500}
              placeholder="https://…"
              className="mt-2 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                disabled={saving}
              >
                Cancelar
              </Button>
            )}
            <Button type="submit" size="sm" disabled={!canSave}>
              {saving
                ? "Guardando…"
                : editingId
                ? "Guardar cambios"
                : "Añadir entrada"}
            </Button>
          </div>
        </form>

        {/* List */}
        {loading && <p className="text-sm text-ink-3">Cargando…</p>}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[15px] text-ink-2">
              Aún no hay entradas en la base de conocimiento.
            </p>
            <p className="mt-1 text-xs text-ink-3">
              Empieza añadiendo un brief o un objetivo de arriba.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <Card key={item.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-surface-2">
                    <Icon name="doc" size={18} color="var(--color-ink-2)" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[15px] font-bold text-ink">
                      {item.title}
                    </p>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-3 transition-colors hover:text-accent"
                      >
                        <Icon name="link" size={12} color="currentColor" />
                        <span className="truncate">{item.sourceUrl}</span>
                      </a>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-ink-2">
                  {item.content}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isEditing || !!removingId}
                    onClick={() => startEdit(item)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!removingId}
                    onClick={() => remove(item.id)}
                  >
                    {removingId === item.id ? "Eliminando…" : "Eliminar"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
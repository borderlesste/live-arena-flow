import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, X, RefreshCw, Newspaper, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useAuth } from "@/hooks/useAuth";
import { getSessionToken } from "@/services/auth.service";
import { listAdminNews, saveNewsArticle, deleteNewsArticle } from "@/services/news-admin.service";
import { NewsThumb } from "@/components/content/NewsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { ErrorState, EmptyState } from "@/components/feedback/States";
import { cn } from "@/lib/utils";
import { imageFileToDataUrl } from "@/lib/image-file";
import type { NewsArticle } from "@/types";

const CATEGORIES = [
  "Crónica", "Análisis", "Entrevista", "Previa", "Resultado",
  "Transferencias", "Selección", "Internacional", "Otro",
];

const DEFAULT_FORM: Omit<NewsArticle, "id"> = {
  title: "",
  category: "Crónica",
  excerpt: "",
  body: "",
  image: undefined,
  coverImageUrl: "",
  publishedAt: new Date().toISOString().slice(0, 16),
  imageHue: Math.floor(Math.random() * 360),
};

function randomHue() { return Math.floor(Math.random() * 360); }

const AdminNewsPage = () => {
  useDocumentMeta({ title: "Administrar Noticias", description: "Publica y gestiona artículos de noticias." });
  const auth = useAuth();
  const token = getSessionToken() ?? "";
  const canAdmin = auth.profile?.role === "super_admin" || auth.profile?.role === "admin";

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null); // null = creating new
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Omit<NewsArticle, "id">>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NewsArticle, string>>>({});

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<NewsArticle | null>(null);

  const load = useCallback(async () => {
    if (!token || !canAdmin) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listAdminNews(token);
      setArticles(data.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar noticias");
    } finally {
      setIsLoading(false);
    }
  }, [token, canAdmin]);

  useEffect(() => { void load(); }, [load]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  function openNew() {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, imageHue: randomHue(), publishedAt: new Date().toISOString().slice(0, 16) });
    setErrors({});
    setShowForm(true);
    setTimeout(() => document.getElementById("news-title")?.focus(), 50);
  }

  function openEdit(article: NewsArticle) {
    setEditingId(article.id);
    setForm({
      title: article.title,
      category: article.category,
      excerpt: article.excerpt,
      body: article.body ?? "",
      image: article.image,
      coverImageUrl: article.coverImageUrl ?? "",
      publishedAt: article.publishedAt.slice(0, 16),
      imageHue: article.imageHue,
    });
    setErrors({});
    setShowForm(true);
    setTimeout(() => document.getElementById("news-title")?.focus(), 50);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = "El título es obligatorio.";
    if (form.title.length > 200) e.title = "Máximo 200 caracteres.";
    if (!form.excerpt.trim()) e.excerpt = "El resumen es obligatorio.";
    if (form.excerpt.length > 400) e.excerpt = "Máximo 400 caracteres.";
    if (!form.category.trim()) e.category = "Selecciona una categoría.";
    if (!form.publishedAt) e.publishedAt = "Indica la fecha de publicación.";
    if (form.coverImageUrl && form.coverImageUrl.trim()) {
      try { new URL(form.coverImageUrl.trim()); }
      catch { e.coverImageUrl = "Introduce una URL válida (https://...)."; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setIsSaving(true);
    const article: NewsArticle = {
      id: editingId ?? crypto.randomUUID(),
      ...form,
      coverImageUrl: form.coverImageUrl?.trim() || undefined,
      publishedAt: new Date(form.publishedAt).toISOString(),
    };
    try {
      const updated = await saveNewsArticle(article, token);
      setArticles(updated.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
      toast.success(editingId ? "Noticia actualizada" : "Noticia publicada");
      cancelForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImageFile(file?: File) {
    if (!file) return;
    try {
      const image = await imageFileToDataUrl(file);
      setForm((current) => ({ ...current, image }));
      setErrors((current) => ({ ...current, image: undefined }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la imagen.";
      setErrors((current) => ({ ...current, image: message }));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const updated = await deleteNewsArticle(deleteTarget.id, token);
      setArticles(updated.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
      toast.success("Noticia eliminada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (auth.isLoading) {
    return (
      <section className="space-y-4 py-8">
        <SkeletonLoader className="h-10 w-64" />
        <SkeletonLoader className="h-64 w-full" />
      </section>
    );
  }
  if (!auth.authenticated || !canAdmin) {
    return (
      <section className="py-12">
        <ErrorState
          title={!auth.authenticated ? "Inicia sesión" : "Acceso restringido"}
          description="Tu cuenta no tiene privilegios para gestionar noticias."
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary font-semibold">Panel de control</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Noticias</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Publica y gestiona artículos para la sección de noticias de la plataforma.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button onClick={openNew} className="bg-primary gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva noticia
          </Button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {/* ── Form ── */}
      {showForm && (
        <Card className="border border-primary/30 bg-surface-1 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Newspaper className="h-5 w-5 text-primary" />
              {editingId ? "Editar noticia" : "Nueva noticia"}
            </CardTitle>
            <CardDescription>
              Completa los campos y pulsa Guardar para publicar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Título */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="news-title">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="news-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Título del artículo"
                  maxLength={200}
                  className={cn("bg-surface-2 border-border/60", errors.title && "border-destructive")}
                  aria-describedby={errors.title ? "news-title-err" : undefined}
                />
                {errors.title && <p id="news-title-err" className="text-xs text-destructive" role="alert">{errors.title}</p>}
              </div>

              {/* Categoría */}
              <div className="space-y-1.5">
                <Label htmlFor="news-category">
                  Categoría <span className="text-destructive">*</span>
                </Label>
                <select
                  id="news-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-border/60 bg-surface-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-destructive" role="alert">{errors.category}</p>}
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <Label htmlFor="news-date">
                  Fecha de publicación <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="news-date"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                  className={cn("bg-surface-2 border-border/60", errors.publishedAt && "border-destructive")}
                />
                {errors.publishedAt && <p className="text-xs text-destructive" role="alert">{errors.publishedAt}</p>}
              </div>

              {/* Resumen */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="news-excerpt">
                  Resumen (extracto) <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="news-excerpt"
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  placeholder="Describe brevemente la noticia (máx. 400 caracteres)"
                  maxLength={400}
                  rows={3}
                  className={cn("bg-surface-2 border-border/60 resize-none", errors.excerpt && "border-destructive")}
                  aria-describedby={errors.excerpt ? "news-excerpt-err" : undefined}
                />
                <div className="flex justify-between">
                  {errors.excerpt
                    ? <p id="news-excerpt-err" className="text-xs text-destructive" role="alert">{errors.excerpt}</p>
                    : <span />}
                  <span className={cn("text-xs text-muted-foreground", form.excerpt.length > 380 && "text-warning")}>
                    {form.excerpt.length}/400
                  </span>
                </div>
              </div>

              {/* Cuerpo */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="news-body">
                  Contenido completo{" "}
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="news-body"
                  value={form.body ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Escribe el artículo completo aquí…"
                  maxLength={20000}
                  rows={8}
                  className="bg-surface-2 border-border/60 resize-y font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Puedes usar texto plano. El resumen se muestra en las tarjetas; el contenido completo se mostrará en la vista detalle.
                </p>
              </div>

              {/* Imagen de portada */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="news-image">Imagen guardada en la base de datos</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="news-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void handleImageFile(event.target.files?.[0])}
                    className="max-w-md bg-surface-2 border-border/60"
                  />
                  {form.image ? (
                    <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, image: undefined }))}>
                      Quitar imagen
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG o WebP. Máximo 512 KB.</p>
                {errors.image ? <p className="text-xs text-destructive" role="alert">{errors.image}</p> : null}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="news-cover">
                  Imagen de portada{" "}
                  <span className="text-xs text-muted-foreground font-normal">(opcional — URL pública)</span>
                </Label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      id="news-cover"
                      type="url"
                      value={form.coverImageUrl ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))}
                      placeholder="https://ejemplo.com/imagen.jpg"
                      className={cn("bg-surface-2 border-border/60", errors.coverImageUrl && "border-destructive")}
                      aria-describedby={errors.coverImageUrl ? "news-cover-err" : "news-cover-hint"}
                    />
                    {errors.coverImageUrl
                      ? <p id="news-cover-err" className="text-xs text-destructive" role="alert">{errors.coverImageUrl}</p>
                      : <p id="news-cover-hint" className="text-xs text-muted-foreground">
                          Pega la URL directa de una imagen (JPG, PNG, WebP). Si no hay imagen se usará el gradiente de color.
                        </p>}
                  </div>
                  {/* Preview thumbnail */}
                  <div className="shrink-0 h-16 w-24 rounded-lg overflow-hidden border border-border/60 bg-surface-2">
                    {form.image || form.coverImageUrl?.trim() ? (
                      <img
                        src={form.image ?? form.coverImageUrl?.trim()}
                        alt="Vista previa"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="h-full w-full flex items-center justify-center"
                        style={{ background: `radial-gradient(circle at 40% 40%, hsl(${form.imageHue} 80% 55% / 0.5), hsl(${form.imageHue} 60% 25% / 0.3) 60%, hsl(215 30% 8%) 100%)` }}
                      >
                        <ImageOff className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Color de portada — solo cuando no hay imagen URL */}
              {!form.coverImageUrl?.trim() && (
                <div className="space-y-1.5">
                  <Label>Color de portada (sin imagen)</Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-24 rounded-md border border-border/60 shrink-0"
                      style={{ background: `hsl(${form.imageHue} 70% 45%)` }}
                      aria-label={`Tono HSL ${form.imageHue}`}
                    />
                    <input
                      type="range"
                      min={0}
                      max={359}
                      value={form.imageHue}
                      onChange={(e) => setForm((f) => ({ ...f, imageHue: Number(e.target.value) }))}
                      className="flex-1 accent-primary"
                      aria-label="Tono de color de portada"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, imageHue: randomHue() }))}
                      aria-label="Color aleatorio"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary text-primary-foreground gap-1.5"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Guardando…" : editingId ? "Guardar cambios" : "Publicar noticia"}
              </Button>
              <Button variant="ghost" onClick={cancelForm} disabled={isSaving} className="border border-border/60 gap-1.5">
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Article list ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Artículos publicados</h2>
          <Badge variant="secondary" className="tabular-nums">{articles.length}</Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-20 w-full" />)}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState
            title="Sin noticias publicadas"
            description="Pulsa «Nueva noticia» para crear el primer artículo."
            className="py-12 border border-border/40 bg-surface-1 rounded-lg"
          />
        ) : (
          <ul className="space-y-3" aria-label="Lista de artículos">
            {articles.map((article) => (
              <li key={article.id}>
                <Card className="border border-border/40 bg-surface-1 hover:border-border/70 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail — imagen real o gradiente */}
                      <div className="hidden sm:block h-14 w-20 shrink-0 rounded-lg overflow-hidden border border-border/40">
                        <NewsThumb article={article} className="h-14 w-20" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                            {article.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(article.publishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="font-semibold text-sm leading-snug truncate">{article.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{article.excerpt}</p>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(article)}
                          aria-label={`Editar: ${article.title}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(article)}
                          aria-label={`Eliminar: ${article.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar noticia?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar <strong>{deleteTarget?.title}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default AdminNewsPage;

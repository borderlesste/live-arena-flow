import { useState, type FormEvent } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localMatchInputSchema, type LocalMatchInput } from "@/schemas/local-match.schema";
import { createLocalMatch } from "@/services/local-matches.service";
import type { NormalizedSportsEvent } from "@/schemas/sports-event.schema";

interface LocalMatchDialogProps {
  token: string;
  onCreated: (event: NormalizedSportsEvent) => void | Promise<void>;
}

interface LocalMatchFormState {
  competitionName: string;
  region: string;
  homeTeamName: string;
  awayTeamName: string;
  startsAtLocal: string;
  venue: string;
}

function defaultStartsAt() {
  const date = new Date(Date.now() + 60 * 60_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function initialForm(): LocalMatchFormState {
  return {
    competitionName: "",
    region: "República Dominicana",
    homeTeamName: "",
    awayTeamName: "",
    startsAtLocal: defaultStartsAt(),
    venue: "",
  };
}

export function LocalMatchDialog({ token, onCreated }: LocalMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LocalMatchFormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update(field: keyof LocalMatchFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    const errorField = field === "startsAtLocal" ? "startsAt" : field;
    setErrors((current) => ({ ...current, [errorField]: "" }));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSaving) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialForm());
      setErrors({});
      setSubmitError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const startsAt = new Date(form.startsAtLocal);
    const candidate: LocalMatchInput = {
      competitionName: form.competitionName,
      region: form.region,
      homeTeamName: form.homeTeamName,
      awayTeamName: form.awayTeamName,
      startsAt: Number.isNaN(startsAt.getTime()) ? "" : startsAt.toISOString(),
      venue: form.venue || undefined,
    };
    const parsed = localMatchInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])));
      return;
    }
    setIsSaving(true);
    try {
      const created = await createLocalMatch(parsed.data, token);
      await onCreated(created);
      setOpen(false);
      setForm(initialForm());
      setErrors({});
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo crear el partido local");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-1.5">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Crear partido local
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-background sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Nuevo partido local</DialogTitle>
          <DialogDescription>Este partido será independiente de SportSRC y podrá recibir una señal OBS igual que cualquier otro evento.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="local-competition">Competición</Label>
              <Input id="local-competition" value={form.competitionName} onChange={(event) => update("competitionName", event.target.value)} maxLength={120} placeholder="Liga comunitaria" aria-invalid={Boolean(errors.competitionName)} />
              {errors.competitionName ? <p className="text-xs text-destructive">{errors.competitionName}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="local-region">Región</Label>
              <Input id="local-region" value={form.region} onChange={(event) => update("region", event.target.value)} maxLength={100} aria-invalid={Boolean(errors.region)} />
              {errors.region ? <p className="text-xs text-destructive">{errors.region}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="local-home-team">Equipo local</Label>
              <Input id="local-home-team" value={form.homeTeamName} onChange={(event) => update("homeTeamName", event.target.value)} maxLength={120} placeholder="Club local" aria-invalid={Boolean(errors.homeTeamName)} />
              {errors.homeTeamName ? <p className="text-xs text-destructive">{errors.homeTeamName}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="local-away-team">Equipo visitante</Label>
              <Input id="local-away-team" value={form.awayTeamName} onChange={(event) => update("awayTeamName", event.target.value)} maxLength={120} placeholder="Club visitante" aria-invalid={Boolean(errors.awayTeamName)} />
              {errors.awayTeamName ? <p className="text-xs text-destructive">{errors.awayTeamName}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="local-starts-at">Fecha y hora</Label>
              <Input id="local-starts-at" type="datetime-local" value={form.startsAtLocal} onChange={(event) => update("startsAtLocal", event.target.value)} aria-invalid={Boolean(errors.startsAt)} />
              {errors.startsAt ? <p className="text-xs text-destructive">{errors.startsAt}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="local-venue">Estadio o ubicación</Label>
              <Input id="local-venue" value={form.venue} onChange={(event) => update("venue", event.target.value)} maxLength={160} placeholder="Cancha municipal" />
            </div>
          </div>
          {submitError ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSaving}>Cancelar</Button>
            <Button type="submit" disabled={isSaving || !token}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />}
              {isSaving ? "Creando partido…" : "Crear partido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

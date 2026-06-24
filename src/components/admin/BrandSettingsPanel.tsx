import { useEffect, useState } from "react";
import { Palette, Save } from "lucide-react";
import { toast } from "sonner";
import { BRAND_DEFAULTS, type BrandSettings } from "@/components/brand/brand-config";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrandSettings, saveBrandSettings } from "@/services/brand.service";

const assetFields: Array<[keyof BrandSettings, string]> = [
  ["logoPrimary", "Logo principal"],
  ["logoDarkBackground", "Logo para fondos oscuros"],
  ["logoLightBackground", "Logo para fondos claros"],
  ["symbol", "Isotipo"],
  ["favicon", "Favicon"],
];

const colorFields: Array<[keyof BrandSettings, string]> = [
  ["primaryColor", "Color principal"],
  ["hoverColor", "Color hover"],
  ["darkColor", "Color oscuro"],
  ["deepBackground", "Fondo profundo"],
];

export function BrandSettingsPanel({ token }: { token: string }) {
  const [settings, setSettings] = useState<BrandSettings>({ ...BRAND_DEFAULTS });
  const [saving, setSaving] = useState(false);

  useEffect(() => { void getBrandSettings().then(setSettings).catch(() => setSettings({ ...BRAND_DEFAULTS })); }, []);

  function update(key: keyof BrandSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await saveBrandSettings(settings, token);
      setSettings(saved);
      window.dispatchEvent(new CustomEvent("brand-settings-updated", { detail: saved }));
      toast.success("Identidad de marca actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la marca");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="brand" className="surface-card scroll-mt-28">
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-display"><Palette className="h-5 w-5 text-primary" />Marca</CardTitle>
          <CardDescription>Assets oficiales locales como fallback. Las rutas admiten futuras URLs de Supabase Storage.</CardDescription>
        </div>
        <div className="rounded-lg bg-white p-3"><BrandLogo variant="primary" size="md" decorative /></div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field label="Nombre de la plataforma"><Input value={settings.platformName} onChange={(event) => update("platformName", event.target.value)} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          {assetFields.map(([key, label]) => <Field key={key} label={label}><Input value={settings[key]} onChange={(event) => update(key, event.target.value)} /></Field>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {colorFields.map(([key, label]) => (
            <Field key={key} label={label}>
              <div className="flex gap-2"><Input type="color" value={settings[key]} onChange={(event) => update(key, event.target.value.toUpperCase())} className="w-14 p-1" /><Input value={settings[key]} onChange={(event) => update(key, event.target.value.toUpperCase())} /></div>
            </Field>
          ))}
        </div>
        <Button onClick={() => void save()} disabled={saving || !token}><Save className="mr-2 h-4 w-4" />{saving ? "Guardando…" : "Guardar marca"}</Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

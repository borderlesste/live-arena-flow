import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Search, Globe, LogIn, Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SPORT_OPTIONS } from "@/lib/sports";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Inicio", end: true },
  { to: "/live", label: "En vivo" },
  { to: "/matches", label: "Partidos" },
  { to: "/competitions", label: "Competiciones" },
  { to: "/calendar", label: "Calendario" },
  { to: "/results", label: "Resultados" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("es");
  const [sport, setSport] = useState("all");
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 glass-strong">
      <div className="container mx-auto flex h-16 items-center gap-2 px-4 md:gap-4 md:px-6">
        <Link to="/" className="group flex items-center gap-2 no-tap-highlight" aria-label="Arena Live Sports — inicio">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-gradient-primary shadow-glow">
            <Radio className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </span>
          <span className="hidden font-display text-base font-bold leading-none sm:block">
            Arena<span className="text-primary">.</span>Live
          </span>
        </Link>

        <nav aria-label="Principal" className="ml-2 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
                  isActive && "bg-surface-2 text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden xl:block">
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger className="h-9 w-[140px] bg-surface/60" aria-label="Seleccionar deporte">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPORT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Buscar equipo, competición…"
              className="h-9 w-[200px] bg-surface/60 pl-8"
              aria-label="Buscar"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  toast.info("Búsqueda demo", { description: "Conecta un backend para resultados reales." });
                }
              }}
            />
          </div>

          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="hidden h-9 w-[78px] bg-surface/60 md:flex" aria-label="Idioma">
              <Globe className="mr-1 h-4 w-4" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">ES</SelectItem>
              <SelectItem value="en">EN</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => toast.info("Iniciar sesión (demo)", { description: "Requiere backend de autenticación." })}>
            <LogIn className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Iniciar sesión
          </Button>

          <Button asChild size="sm" className="hidden bg-gradient-primary text-primary-foreground hover:opacity-90 md:inline-flex">
            <Link to="/live">
              <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Ver en vivo
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[88vw] max-w-sm bg-card p-0">
              <SheetHeader className="border-b border-border px-5 py-4 text-left">
                <SheetTitle className="font-display">Arena Live Sports</SheetTitle>
              </SheetHeader>
              <nav aria-label="Menú móvil" className="flex flex-col p-2">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "rounded-md px-3 py-3 text-base font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                        isActive && "bg-surface-2 text-foreground",
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <div className="my-2 border-t border-border" />
                <Button variant="ghost" className="justify-start" onClick={() => { setOpen(false); toast.info("Iniciar sesión (demo)"); }}>
                  <LogIn className="mr-2 h-4 w-4" /> Iniciar sesión
                </Button>
                <Button asChild className="mt-2 bg-gradient-primary text-primary-foreground">
                  <Link to="/live" onClick={() => setOpen(false)}>
                    <Play className="mr-2 h-4 w-4" /> Ver en vivo
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {/* Page-level focus ring helper so route changes are perceivable */}
      <div className="sr-only" aria-live="polite">{loc.pathname}</div>
    </header>
  );
}

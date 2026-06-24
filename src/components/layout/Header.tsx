import { useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, Globe, LogIn, Play } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SPORT_OPTIONS } from "@/lib/sports";

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
  const [search, setSearch] = useState("");
  const loc = useLocation();
  const navigate = useNavigate();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (sport !== "all") params.set("sport", sport);
    navigate(`/matches${params.size ? `?${params.toString()}` : ""}`);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 glass-strong">
      <div className="container mx-auto flex h-20 items-center gap-2 px-4 md:gap-4 md:px-6">
        <Link to="/" className="flex shrink-0 items-center no-tap-highlight" aria-label="Luis Romero Fútbol — inicio">
          <BrandLogo variant="white" size="md" priority decorative className="hidden sm:block" />
          <BrandLogo variant="white" size="md" withWordmark={false} priority decorative className="sm:hidden" />
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
          <div className="hidden 2xl:block">
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

          <form className="relative hidden md:block" role="search" onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Buscar equipo, competición…"
              className="h-9 w-[200px] bg-surface/60 pl-8"
              aria-label="Buscar"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>

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

          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex"><Link to="/profile"><LogIn className="mr-1.5 h-4 w-4" aria-hidden="true" />Mi perfil</Link></Button>

          <Button asChild size="sm" className="hidden md:inline-flex">
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
                <SheetTitle><BrandLogo variant="white" size="md" decorative /></SheetTitle>
              </SheetHeader>
              <nav aria-label="Menú móvil" className="flex flex-col p-2">
                <form role="search" onSubmit={submitSearch} className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar equipo o competición" className="pl-9" aria-label="Buscar partidos" />
                </form>
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
                <Button asChild variant="ghost" className="justify-start"><Link to="/profile" onClick={() => setOpen(false)}><LogIn className="mr-2 h-4 w-4" /> Mi perfil</Link></Button>
                <Button asChild className="mt-2">
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

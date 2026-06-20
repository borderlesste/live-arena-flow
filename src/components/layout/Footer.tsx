import { Link } from "react-router-dom";
import { Radio, Github, Twitter, Youtube } from "lucide-react";

const SECTIONS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: "Producto",
    links: [
      { to: "/live", label: "En vivo" },
      { to: "/matches", label: "Partidos" },
      { to: "/competitions", label: "Competiciones" },
      { to: "/calendar", label: "Calendario" },
      { to: "/results", label: "Resultados" },
    ],
  },
  {
    title: "Comunidad",
    links: [
      { to: "/community-rules", label: "Normas de la comunidad" },
      { to: "/contact", label: "Contacto" },
      { to: "/sponsors", label: "Patrocinadores" },
      { to: "/broadcast-rights", label: "Derechos de transmisión" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/terms", label: "Términos" },
      { to: "/privacy", label: "Privacidad" },
      { to: "/cookies", label: "Cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface/40">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2" aria-label="Inicio">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-gradient-primary shadow-glow">
                <Radio className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </span>
              <span className="font-display text-base font-bold">Arena<span className="text-primary">.</span>Live</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Deporte en directo, marcadores, comunidad y todo lo que necesitas para no perderte un solo segundo.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <a className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground" href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter (abre en nueva pestaña)">
                <Twitter className="h-4 w-4" />
              </a>
              <a className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground" href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube (abre en nueva pestaña)">
                <Youtube className="h-4 w-4" />
              </a>
              <a className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground" href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub (abre en nueva pestaña)">
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec.title}</h3>
              <ul className="space-y-2 text-sm">
                {sec.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-foreground/80 hover:text-foreground">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Arena Live Sports. Todos los nombres y equipos son ficticios.</p>
          <p>Hecho con pasión por el deporte.</p>
        </div>
      </div>
    </footer>
  );
}

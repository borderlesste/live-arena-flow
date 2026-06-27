import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Activity, BarChart3, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Megaphone, MessageSquareWarning, Newspaper, RadioTower, Settings, Users } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Dashboard", icon: Activity, end: true },
  { to: "/admin/streams", label: "Transmisiones", icon: RadioTower },
  { to: "/admin/news", label: "Noticias", icon: Newspaper },
  { to: "/admin/matches", label: "Partidos", icon: CalendarDays },
  { to: "/admin/sponsors", label: "Patrocinadores", icon: Megaphone },
  { to: "/admin/users", label: "Usuarios", icon: Users },
  { to: "/admin/chat", label: "Chat", icon: MessageSquareWarning },
  { to: "/admin/analytics", label: "Analítica", icon: BarChart3 },
  { to: "/admin/settings", label: "Ajustes", icon: Settings },
  { to: "/admin/audit", label: "Auditoría", icon: ClipboardList },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const auth = useAuth();
  const canAdmin = auth.profile?.role === "super_admin" || auth.profile?.role === "admin";

  if (!canAdmin) return <>{children}</>;

  return (
    <div className={cn("container mx-auto grid gap-6 px-4 py-6 md:px-6 lg:grid-cols-[240px_minmax(0,1fr)]", collapsed && "lg:grid-cols-[80px_minmax(0,1fr)]")}>
      <aside className="hidden h-fit rounded-xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-elegant lg:sticky lg:top-24 lg:block">
        <div className="flex min-h-16 items-center justify-center border-b border-sidebar-border pb-3">
          <BrandLogo variant="white" size={collapsed ? "md" : "sm"} withWordmark={!collapsed} decorative />
        </div>
        <nav className="mt-3 space-y-1" aria-label="Administración">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                  collapsed && "justify-center px-2",
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-3 w-full text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight /> : <><ChevronLeft /><span>Colapsar</span></>}
        </Button>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

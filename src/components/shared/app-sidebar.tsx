"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/actions/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  LayoutDashboard,
  BedDouble,
  Coffee,
  ClipboardList,
  Users,
  History,
  LogOut,
  ClipboardCheck,
  Menu,
  CalendarClock,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const adminNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planejamento", label: "Planejamento diário", icon: ClipboardCheck },
  { href: "/chegadas-saidas/gerenciar", label: "Chegadas & saídas", icon: CalendarClock },
  { href: "/quartos", label: "Quartos", icon: BedDouble },
  { href: "/mesas/gerenciar", label: "Mesas do café", icon: Coffee },
  { href: "/checklists", label: "Checklists & ocorrências manutenção", icon: ClipboardList },
  { href: "/camareiras", label: "Camareiras", icon: Users },
  { href: "/historico", label: "Histórico", icon: History },
];

const camareiraNav: NavItem[] = [
  { href: "/tarefas", label: "Meus quartos", icon: ClipboardList },
  { href: "/mesas", label: "Mesas do café", icon: Coffee },
  { href: "/chegadas-saidas", label: "Chegadas & saídas", icon: CalendarClock },
];

function SidebarContent({
  role,
  userName,
  onNavigate,
}: {
  role: "admin" | "camareira";
  userName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = role === "admin" ? adminNav : camareiraNav;

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-6">
        <BrandLogo size={32} />
        <div>
          <p className="font-heading text-base leading-none text-primary">Vila Corada</p>
          <p className="text-[11px] text-muted-foreground tracking-wide mt-1">CAMAREIRAS</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon size={18} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5 pt-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between px-3 mb-2">
          <p className="text-xs text-muted-foreground truncate">{userName}</p>
          <ThemeToggle className="size-7 -mr-1" />
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppSidebar({
  role,
  userName,
}: {
  role: "admin" | "camareira";
  userName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3">
        <div className="flex items-center gap-2">
          <BrandLogo size={26} />
          <span className="font-heading text-base text-primary">Vila Corada</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon"><Menu size={20} /></Button>} />
            <SheetContent side="left" className="p-0 w-64">
              <SidebarContent role={role} userName={userName} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border h-screen sticky top-0">
        <SidebarContent role={role} userName={userName} />
      </aside>
    </>
  );
}

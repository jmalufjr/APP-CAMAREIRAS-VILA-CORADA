import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { Sparkles, RefreshCw, DoorOpen, LogOut, LogIn, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/checklists/arrumacao", label: TASK_TYPE_LABELS.arrumacao, icon: Sparkles },
  { href: "/checklists/troca", label: TASK_TYPE_LABELS.troca, icon: RefreshCw },
  { href: "/checklists/preparacao", label: TASK_TYPE_LABELS.preparacao, icon: DoorOpen },
  { href: "/checklists/somente_saida", label: TASK_TYPE_LABELS.somente_saida, icon: LogOut },
  { href: "/checklists/somente_chegada", label: TASK_TYPE_LABELS.somente_chegada, icon: LogIn },
];

export default function ChecklistsServicosSuitesPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader title="Check lists de serviços nas suítes" subtitle="Os itens que a camareira confere em cada tipo de serviço." />
      <nav className="max-w-md space-y-1.5">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <item.icon size={18} strokeWidth={1.75} className="text-muted-foreground" />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>
        ))}
      </nav>
    </div>
  );
}

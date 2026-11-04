import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { MessageSquareText, BarChart3, ListChecks, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/dashboard/avaliacoes", label: "Avaliações: conteúdo e resposta", icon: MessageSquareText },
  { href: "/dashboard/avaliacoes-medias", label: "Médias das avaliações por suíte, canal e item", icon: BarChart3 },
  { href: "/dashboard/avaliacoes-temas", label: "Assuntos citados pelos hóspedes (leitura pela IA)", icon: ListChecks },
];

export default function AvaliacoesHospedesMenuPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader title="Avaliações dos hóspedes" subtitle="Escolha o que deseja ver." />
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

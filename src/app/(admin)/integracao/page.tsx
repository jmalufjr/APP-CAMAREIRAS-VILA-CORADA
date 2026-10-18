import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Mail, KeyRound, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/integracao/email-envio", label: "Cadastrar e-mail de envio", icon: Mail },
  { href: "/integracao/api-tokens", label: "Chaves de acesso — API de consumos", icon: KeyRound },
];

export default function IntegracaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Integração" subtitle="Ligações do app com sistemas externos: e-mail de envio de recibos e demonstrativos, e as chaves de acesso da API de consumos." />
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

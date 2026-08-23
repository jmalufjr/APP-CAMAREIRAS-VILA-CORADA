import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ClipboardCheck, Coffee, LayoutDashboard, Users } from "lucide-react";

const features = [
  {
    icon: ClipboardCheck,
    title: "Checklists diários",
    text: "Arrumação, preparação chegada e troca de roupa de cama, com itens específicos por suíte e registro de ocorrências manutenção.",
  },
  {
    icon: Coffee,
    title: "Café da manhã",
    text: "Layout editável das mesas, quantidade de hóspedes por mesa e cálculo automático da comissão.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    text: "Resumo do dia, totais mensais e histórico completo de quartos, mesas e comissões.",
  },
  {
    icon: Users,
    title: "Equipe organizada",
    text: "Cadastro de camareiras, login simplificado e trabalho registrado por dia e por pessoa.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <BrandLogo size={40} priority />
          <div>
            <p className="font-heading text-lg leading-none text-primary">Vila Corada</p>
            <p className="text-[11px] text-muted-foreground tracking-wide mt-1">CAMAREIRAS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button render={<Link href="/login">Entrar</Link>} nativeButton={false} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        <section className="py-20 text-center flex flex-col items-center gap-6">
          <h1 className="font-heading text-4xl sm:text-5xl text-primary max-w-2xl">
            Gestão do serviço de camareiras
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg">
            Organize a arrumação e preparação das suítes, o café da manhã e a
            comissão da equipe em um só lugar — feito sob medida para a Vila
            Corada.
          </p>
          <Button
            render={<Link href="/login">Acessar o sistema</Link>}
            nativeButton={false}
            size="lg"
            className="mt-2"
          />
        </section>

        <section className="grid sm:grid-cols-2 gap-6 pb-24">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3"
            >
              <f.icon className="text-secondary" size={28} strokeWidth={1.5} />
              <h3 className="font-heading text-xl">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="text-center text-xs text-muted-foreground pb-10">
        Vila Corada · Suítes Beira Mar
      </footer>
    </div>
  );
}

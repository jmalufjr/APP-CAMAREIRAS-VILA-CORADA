import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getActiveComandas } from "@/lib/actions/comandas";
import { ComandasList } from "./comandas-list";
import { getCurrentProfile } from "@/lib/actions/session";

export default async function ComandaPage() {
  const [comandas, profile] = await Promise.all([getActiveComandas(), getCurrentProfile()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comandas de Bar da Piscina"
        subtitle="Registre e acompanhe os pedidos do bar da piscina por suíte."
      />
      {profile.role !== "gerente_operacional" && (
        <Button
          size="lg"
          className="h-12 px-8 text-base font-semibold shadow-md"
          render={<Link href="/comanda/novo">+ Novo pedido</Link>}
          nativeButton={false}
        />
      )}
      <div className="space-y-3">
        <p className="text-sm font-medium">Lista de comandas</p>
        <ComandasList comandas={comandas} meId={profile.id} canEditAll={profile.role === "admin" || profile.role === "gerente_operacional"} />
      </div>
    </div>
  );
}

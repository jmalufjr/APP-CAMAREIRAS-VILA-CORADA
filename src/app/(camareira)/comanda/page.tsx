import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getActiveComandas } from "@/lib/actions/comandas";
import { ComandasList } from "./comandas-list";

export default async function ComandaPage() {
  const comandas = await getActiveComandas();

  return (
    <div className="space-y-6">
      <PageHeader title="Comanda" subtitle="Registre e acompanhe os pedidos do bar da piscina por quarto." />
      <Button render={<Link href="/comanda/novo">Novo pedido</Link>} nativeButton={false} />
      <div className="space-y-3">
        <p className="text-sm font-medium">Lista de comandas</p>
        <ComandasList comandas={comandas} />
      </div>
    </div>
  );
}

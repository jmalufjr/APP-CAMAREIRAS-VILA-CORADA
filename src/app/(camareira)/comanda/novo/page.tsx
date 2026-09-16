import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { createClient } from "@/lib/supabase/server";
import { getRoomsForComandaSelector } from "@/lib/actions/comandas";
import type { PoolbarItem } from "@/lib/types";
import { ComandaForm } from "../comanda-form";

export default async function NovoPedidoPage() {
  const supabase = await createClient();
  const [{ data: poolbarItems }, rooms] = await Promise.all([
    supabase.from("poolbar_items").select("*").eq("active", true).order("position"),
    getRoomsForComandaSelector(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/comanda" />
      <PageHeader title="Novo pedido" subtitle="Selecione a suíte e as quantidades de cada item." />
      <ComandaForm mode="create" poolbarItems={(poolbarItems ?? []) as PoolbarItem[]} rooms={rooms} />
    </div>
  );
}

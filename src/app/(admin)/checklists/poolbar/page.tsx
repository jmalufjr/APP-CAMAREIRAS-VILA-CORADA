import { createClient } from "@/lib/supabase/server";
import type { PoolbarItem } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { PoolbarItemsPanel } from "../poolbar-items-panel";

export default async function PoolbarItemsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("poolbar_items").select("*").order("position");

  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title="Bar da Piscina"
        subtitle="Gerencie os itens, categorias e preços do bar da piscina disponíveis para a camareira registrar."
      />
      <PoolbarItemsPanel items={(items ?? []) as PoolbarItem[]} />
    </div>
  );
}

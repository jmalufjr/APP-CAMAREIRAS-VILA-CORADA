import { createClient } from "@/lib/supabase/server";
import type { MinibarItem } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { FrigobarItemsPanel } from "../frigobar-items-panel";

export default async function FrigobarItemsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("minibar_items").select("*").order("position");

  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title="Consumo de Frigobar"
        subtitle="Gerencie os itens e preços do frigobar disponíveis para a camareira registrar."
      />
      <FrigobarItemsPanel items={(items ?? []) as MinibarItem[]} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import type { MinibarItem } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { getRoomBillsOverview } from "@/lib/actions/room-bills";
import { ConsumoQuartosPanel } from "./consumo-quartos-panel";

export default async function ConsumoQuartosPage() {
  const supabase = await createClient();
  const [overview, { data: minibarItems }] = await Promise.all([
    getRoomBillsOverview(),
    supabase.from("minibar_items").select("*").eq("active", true).order("position"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumo por suítes"
        subtitle="Consumo de frigobar e do bar da piscina por suíte, com taxa de serviço de 10% sobre o bar."
      />
      <ConsumoQuartosPanel overview={overview} minibarItems={(minibarItems ?? []) as MinibarItem[]} />
    </div>
  );
}

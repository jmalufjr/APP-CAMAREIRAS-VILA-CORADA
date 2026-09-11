import { createClient } from "@/lib/supabase/server";
import type { MinibarItem, PoolbarItem } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { getRoomBillsOverview } from "@/lib/actions/room-bills";
import { FrigobarRoomsPanel } from "./frigobar-rooms-panel";

export default async function FrigobarPage() {
  const supabase = await createClient();
  const [overview, { data: minibarItems }, { data: poolbarItems }] = await Promise.all([
    getRoomBillsOverview(),
    supabase.from("minibar_items").select("*").eq("active", true).order("position"),
    supabase.from("poolbar_items").select("*").eq("active", true).order("position"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumo de Bar e Frigobar"
        subtitle="Consumo de frigobar e do bar da piscina por quarto, com taxa de serviço de 10% sobre o bar."
      />
      <FrigobarRoomsPanel
        overview={overview}
        minibarItems={(minibarItems ?? []) as MinibarItem[]}
        poolbarItems={(poolbarItems ?? []) as PoolbarItem[]}
      />
    </div>
  );
}

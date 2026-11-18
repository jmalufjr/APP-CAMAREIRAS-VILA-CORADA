import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getRoomBillsOverview, getRecentlyPaidRoomBills } from "@/lib/actions/room-bills";
import { getActiveComandas, getInactiveComandas } from "@/lib/actions/comandas";
import { PaidBillsCard } from "./frigobar-rooms-panel";
import { ConsumoQuartosPanel } from "@/app/(camareira)/bar-piscina/consumo-quartos-panel";
import { createClient } from "@/lib/supabase/server";
import type { MinibarItem } from "@/lib/types";
import { ComandasListPanel } from "./comandas-list-panel";

export default async function FrigobarPage() {
  const supabase = await createClient();
  const [overview, recentlyPaid, activeComandas, inactiveComandas, { data: minibarItems }] = await Promise.all([
    getRoomBillsOverview(),
    getRecentlyPaidRoomBills(),
    getActiveComandas(),
    getInactiveComandas(),
    supabase.from("minibar_items").select("*").eq("active", true).order("position"),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/operacional" />
      <PageHeader
        title="Consumo de Bar e Frigobar"
        subtitle="Consumo de frigobar e do bar da piscina por suíte. O administrador pode fechar, reabrir e registrar o pagamento de qualquer conta. Administrador e gerente operacional corrigem comandas e frigobar."
      />
      <Tabs defaultValue="comandas">
        <TabsList>
          <TabsTrigger value="comandas">Lista de comandas do bar</TabsTrigger>
          <TabsTrigger value="quartos">Consumo total por suíte</TabsTrigger>
        </TabsList>
        <TabsContent value="comandas" className="pt-4">
          <ComandasListPanel activeComandas={activeComandas} inactiveComandas={inactiveComandas} />
        </TabsContent>
        <TabsContent value="quartos" className="pt-4">
          <ConsumoQuartosPanel
            overview={overview}
            minibarItems={(minibarItems ?? []) as MinibarItem[]}
            recentlyPaid={recentlyPaid}
            isAdmin
            paidCard={<PaidBillsCard bills={recentlyPaid} title="Contas pagas nos últimos 30 dias" emptyText="Nenhuma conta paga nos últimos 30 dias." />}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getRoomBillsOverview, getRecentlyPaidRoomBills, getReceiptSettings } from "@/lib/actions/room-bills";
import { getActiveComandas, getInactiveComandas } from "@/lib/actions/comandas";
import { FrigobarRoomsPanel } from "./frigobar-rooms-panel";
import { ComandasListPanel } from "./comandas-list-panel";

export default async function FrigobarPage() {
  const [overview, recentlyPaid, activeComandas, inactiveComandas, receiptSettings] = await Promise.all([
    getRoomBillsOverview(),
    getRecentlyPaidRoomBills(),
    getActiveComandas(),
    getInactiveComandas(),
    getReceiptSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumo de Bar e Frigobar"
        subtitle="Consulta de consumo de frigobar e do bar da piscina por quarto — fechar conta, reabrir e registrar pagamento agora são ações da camareira."
      />
      <Tabs defaultValue="comandas">
        <TabsList>
          <TabsTrigger value="comandas">Lista de comandas do bar</TabsTrigger>
          <TabsTrigger value="quartos">Consumo por quartos</TabsTrigger>
        </TabsList>
        <TabsContent value="comandas" className="pt-4">
          <ComandasListPanel activeComandas={activeComandas} inactiveComandas={inactiveComandas} />
        </TabsContent>
        <TabsContent value="quartos" className="pt-4">
          <FrigobarRoomsPanel overview={overview} recentlyPaid={recentlyPaid} receiptSettings={receiptSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

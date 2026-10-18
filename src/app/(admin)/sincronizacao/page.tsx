import { PageHeader } from "@/components/shared/page-header";
import { SyncStaysAllButton } from "./sync-stays-all-button";

export default function SincronizacaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sincronização"
        subtitle="Traz as reservas da Stays para o Planejamento Diário, Chegadas & Saídas e Mesas do café. Roda sozinha uma vez por dia; aqui você pode rodar na hora."
      />
      <SyncStaysAllButton />
    </div>
  );
}

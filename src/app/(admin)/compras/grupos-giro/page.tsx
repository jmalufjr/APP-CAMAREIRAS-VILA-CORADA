import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getInventoryTurnoverGroups } from "@/lib/actions/inventory-turnover-groups";
import { TurnoverGroupsPanel } from "./turnover-groups-panel";

export default async function GruposGiroPage() {
  const groups = await getInventoryTurnoverGroups();

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Grupos de giro (dias de folga)"
        subtitle="Cada grupo representa um ciclo de compra diferente (ex.: bebidas alcoólicas compram a cada 60 dias, limpeza toda semana) — é o que o sistema usa pra calcular sozinho quanto comprar de cada item. Edite os dias a qualquer momento."
      />
      <TurnoverGroupsPanel groups={groups} />
    </div>
  );
}

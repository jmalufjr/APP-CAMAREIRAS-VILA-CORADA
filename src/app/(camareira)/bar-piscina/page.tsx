import { PageHeader } from "@/components/shared/page-header";
import { getPoolbarRoomsForCamareira } from "@/lib/actions/poolbar";
import { BarPiscinaPanel } from "./bar-piscina-panel";

export default async function BarPiscinaPage() {
  const rooms = await getPoolbarRoomsForCamareira();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumo de Bar da Piscina"
        subtitle="Registre o consumo do bar da piscina de cada quarto."
      />
      <BarPiscinaPanel rooms={rooms} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import type { MaintenanceCategory, MaintenanceItem } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { MaintenancePreventivaPanel } from "../maintenance-preventiva-panel";

export default async function ManutencaoPreventivaItensPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("maintenance_categories").select("*").order("position"),
    supabase.from("maintenance_items").select("*").order("position"),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Gerencie categorias e itens da manutenção preventiva, e a ordem em que aparecem para o funcionário de manutenção."
      />
      <MaintenancePreventivaPanel
        categories={(categories ?? []) as MaintenanceCategory[]}
        items={(items ?? []) as MaintenanceItem[]}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TableLayoutPanel } from "./table-layout-panel";

export default async function MesasLayoutPage() {
  const supabase = await createClient();
  const { data: tables } = await supabase
    .from("breakfast_tables")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title="Layout & mesas"
        subtitle="Gerencie o layout arrastável e a lista de mesas do café da manhã."
      />
      <TableLayoutPanel tables={(tables ?? []) as BreakfastTable[]} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import type { OccurrenceCategory } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { OccurrenceCategoriesPanel } from "../occurrence-categories-panel";

export default async function OcorrenciasCategoriasPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("occurrence_categories").select("*").order("position");

  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title="Ocorrências Manutenção"
        subtitle="Gerencie as categorias de ocorrências de manutenção registradas pelas camareiras."
      />
      <OccurrenceCategoriesPanel categories={(categories ?? []) as OccurrenceCategory[]} />
    </div>
  );
}

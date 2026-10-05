import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";
import { AssetCatalogPanel } from "./asset-catalog-panel";

export default async function PlanoDeItensDeAtivoPermanentePage() {
  const [categories, catalogItems] = await Promise.all([getAssetCategories(), getFixedAssetCatalogItems()]);

  return (
    <div className="space-y-6">
      <BackLink href="/checklists/plano-de-contas" />
      <PageHeader
        title="Plano de itens de ativo permanente"
        subtitle="Categorias (ex.: Máquinas) e o catálogo de tipos de bem dentro de cada uma (ex.: Liquidificador) — usado ao lançar a compra de um bem novo."
      />
      <AssetCatalogPanel categories={categories} catalogItems={catalogItems} />
    </div>
  );
}

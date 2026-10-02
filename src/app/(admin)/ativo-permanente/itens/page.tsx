import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getAssetCategories, getFixedAssets } from "@/lib/actions/fixed-assets";
import { AssetCategoriesPanel } from "./asset-categories-panel";
import { FixedAssetsPanel } from "./fixed-assets-panel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function ItensAtivoPermanentePage() {
  const [categories, assets] = await Promise.all([getAssetCategories(), getFixedAssets()]);

  return (
    <div className="space-y-6">
      <BackLink href="/ativo-permanente" />
      <PageHeader
        title="Itens de ativo permanente"
        subtitle="Cadastre categorias e registre os itens — TVs, móveis, equipamentos, veículos etc."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetCategoriesPanel categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <FixedAssetsPanel assets={assets} categories={categories.filter((c) => c.active)} />
        </CardContent>
      </Card>
    </div>
  );
}

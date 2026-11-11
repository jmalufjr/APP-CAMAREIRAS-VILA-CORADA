import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getBarProductRecipes } from "@/lib/actions/product-cost";
import { getIngredients } from "@/lib/actions/expense-model";
import { RecipesPanel } from "./recipes-panel";

export default async function FichaTecnicaPage() {
  const [products, ingredients] = await Promise.all([getBarProductRecipes(), getIngredients()]);
  return (
    <div className="space-y-6">
      <BackLink href="/contabil/listas" />
      <PageHeader
        title="Ficha técnica de petiscos e drinks"
        subtitle="Quais ingredientes entram em cada produto do bar e quanto em uma unidade vendida (use a mesma medida para um ingrediente em todos os produtos). Serve para estimar, mês a mês, o custo e a rentabilidade de cada produto. Não controla estoque."
      />
      <RecipesPanel products={products} ingredients={ingredients.filter((i) => i.active)} />
    </div>
  );
}

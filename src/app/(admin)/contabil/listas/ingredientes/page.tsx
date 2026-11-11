import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getIngredients } from "@/lib/actions/expense-model";
import { IngredientsPanel } from "./ingredients-panel";

export default async function IngredientesPage() {
  const ingredients = await getIngredients();
  return (
    <div className="space-y-6">
      <BackLink href="/contabil/listas" />
      <PageHeader
        title="Ingredientes de produtos de bar"
        subtitle="Alimentos que entram nos petiscos e drinks do bar. Ao ler uma nota, o sistema reconhece estes nomes e reparte o gasto entre Bar e Café da manhã pelo percentual de cada um. Alimentos que não estão nesta lista vão 100% para o Café."
      />
      <IngredientsPanel ingredients={ingredients} />
    </div>
  );
}

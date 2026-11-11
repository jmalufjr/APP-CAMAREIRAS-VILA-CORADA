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
        subtitle="Alimentos e bebidas que entram nos petiscos e drinks do bar (o nome traz a unidade de medida da ficha técnica, ex.: “Cachaça (ml)”). Ao ler uma nota, o sistema reconhece estes nomes. Nos alimentos, o gasto se reparte entre Bar e Café da manhã pelo percentual de cada um (alimento que não está na lista vai 100% para o Café). Nas bebidas, a divisão é entre Bar e Frigobar pelas quantidades vendidas no mês."
      />
      <IngredientsPanel ingredients={ingredients} />
    </div>
  );
}

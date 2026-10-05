import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getDishesWithIngredients, getFichaTecnicaIngredientOptions } from "@/lib/actions/inventory-items";
import { DishesPanel } from "./dishes-panel";

export default async function PratosPage() {
  const [dishes, ingredients] = await Promise.all([getDishesWithIngredients(), getFichaTecnicaIngredientOptions()]);

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Ficha técnica de petiscos e drinks"
        subtitle="Receita de cada petisco/drink do bar da piscina — quais ingredientes ele consome, e em que quantidade. Pedir o item de verdade (via comanda) já desconta o estoque desses ingredientes."
      />
      <DishesPanel dishes={dishes} ingredients={ingredients} />
    </div>
  );
}

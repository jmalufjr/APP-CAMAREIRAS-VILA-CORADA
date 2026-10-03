import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getDishesWithIngredients, getInventoryItems } from "@/lib/actions/inventory-items";
import { DishesPanel } from "./dishes-panel";

export default async function PratosPage() {
  const [dishes, ingredients] = await Promise.all([getDishesWithIngredients(), getInventoryItems(true)]);

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Lista de pratos: natureza do consumo"
        subtitle="Receita de cada prato/produto do bar da piscina e do frigobar — quais ingredientes (itens de estoque) ele consome, e em que quantidade. Pedir o prato de verdade já desconta o estoque desses ingredientes ao pagar a conta."
      />
      <DishesPanel dishes={dishes} ingredients={ingredients} />
    </div>
  );
}

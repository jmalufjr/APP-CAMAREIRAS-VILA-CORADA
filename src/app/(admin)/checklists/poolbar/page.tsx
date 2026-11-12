import { createClient } from "@/lib/supabase/server";
import type { PoolbarItem } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { PoolbarItemsPanel } from "../poolbar-items-panel";
import { getBarProductRecipes } from "@/lib/actions/product-cost";
import { getIngredients } from "@/lib/actions/expense-model";

export default async function PoolbarItemsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("poolbar_items").select("*").order("position");
  const [recipeList, ingredients] = await Promise.all([getBarProductRecipes(), getIngredients()]);
  const recipes: Record<string, { ingredient_id: string; quantity: number }[]> = {};
  recipeList.forEach((r) => (recipes[r.id] = r.ingredients.map((i) => ({ ingredient_id: i.ingredient_id, quantity: i.quantity }))));

  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title="Cardápio de bar da piscina"
        subtitle="Gerencie os itens, categorias e preços do bar da piscina disponíveis para a camareira registrar. Cada item tem sua ficha técnica (ingredientes e quantidades): ao criar um item novo, a ficha é pedida em seguida."
      />
      <PoolbarItemsPanel items={(items ?? []) as PoolbarItem[]} recipes={recipes} ingredients={ingredients.filter((i) => i.active)} />
    </div>
  );
}

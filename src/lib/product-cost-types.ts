export interface ProductCostRow {
  id: string;
  name: string;
  category: string | null;
  sold: number;
  revenue: number;
  cost: number;
  avgCost: number | null; // custo médio por unidade
  profit: number;
  marginPct: number | null;
  hasRecipe: boolean;
}

export interface ProductCostReport {
  month: string;
  rows: ProductCostRow[];
  unassignedCost: number; // custo de ingredientes do bar sem nenhum produto vendido que os use
  totalIngredientBarCost: number;
}

export interface RecipeItem {
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
}

export interface BarProductRecipe {
  id: string;
  name: string;
  category: string | null;
  ingredients: RecipeItem[];
}

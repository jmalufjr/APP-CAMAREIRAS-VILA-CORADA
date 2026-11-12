// Tipos do modelo contábil simplificado (PRD_modelo_simplificado.md).

export type CenterCode = "hospedagem" | "bar" | "cafe" | "frigobar";
export type CategoryRule = "fixo" | "alimentos" | "bebidas" | "nao_alocavel";

export const CENTER_LABELS: Record<CenterCode, string> = {
  hospedagem: "Hospedagem",
  bar: "Bar",
  cafe: "Café da manhã",
  frigobar: "Frigobar",
};

export const RULE_LABELS: Record<CategoryRule, string> = {
  fixo: "Percentuais fixos entre os centros",
  alimentos: "Ingrediente de bar segue o rateio dele; o resto vai 100% ao Café",
  bebidas: "Bar × Frigobar calculado no mês, pelas quantidades vendidas",
  nao_alocavel: "Não entra nos centros (aparece só no final)",
};

export interface ExpenseCategory {
  id: string;
  name: string;
  consumption_days: number;
  rule: CategoryRule;
  allows_ingredient: boolean;
  active: boolean;
  position: number;
  centers: { center_code: CenterCode; pct: number }[];
}

export interface Ingredient {
  id: string;
  name: string;
  bar_pct: number;
  split_mode: "bar_cafe" | "bar_frigobar";
  active: boolean;
}

export interface ExpenseSettings {
  asset_threshold: number;
  asset_min_life_months: number;
  late_window_days: number;
  start_date: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  category_id: string;
  amount: number;
  day_of_month: number;
  active: boolean;
}

export interface PurchaseLineRecord {
  id: string;
  description: string;
  quantity: number;
  amount: number;
  is_asset: boolean;
  useful_life_months: number | null;
  category_id: string | null;
  category_name: string | null;
  ingredient_name: string | null;
}

export interface PurchaseRecord {
  id: string;
  date: string;
  supplier_name: string | null;
  document_number: string | null;
  total_amount: number;
  payment_method: string | null;
  notes: string | null;
  source: "manual" | "whatsapp" | "recorrente";
  status: "registrada" | "pendente_aprovacao" | "cancelada";
  posted_after_close: boolean;
  created_at: string;
  lines: PurchaseLineRecord[];
}

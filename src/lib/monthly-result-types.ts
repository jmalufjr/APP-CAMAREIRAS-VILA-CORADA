import type { CenterCode } from "@/lib/expense-model-types";

export interface CategoryLine {
  name: string;
  amount: number;
}

export interface PendingRevenue {
  bill_id: string;
  kind: "bar" | "frigobar";
  amount: number;
  guest: string | null;
  closed_day: string | null;
}

export interface MonthlyResult {
  month: string;
  monthClosed: boolean;
  windowEnd: string;
  windowClosed: boolean;
  lodging: { gross: number; commission: number; net: number; pendingDiff: { gross: number; commission: number } | null };
  bar: { items: number; service: number; total: number; toClose: number };
  frigobar: { total: number; toClose: number };
  byCenter: { center: CenterCode; revenue: number; expenses: number; result: number; categories: CategoryLine[] }[];
  taxes: number;
  totalRevenue: number;
  totalExpenses: number;
  totalBeforeTaxes: number;
  operatingResult: number;
  pendingRevenue: PendingRevenue[];
  lateExpensesCount: number;
  barShare: number;
}

import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpenseCategories, getIngredients, getExpenseSettings } from "@/lib/actions/expense-model";
import { todayKey } from "@/lib/date";
import { getCurrentProfile } from "@/lib/actions/session";
import { PurchaseForm } from "./purchase-form";

export default async function NovaCompraPage() {
  const profile = await getCurrentProfile();
  const [categories, ingredients, settings] = await Promise.all([
    getExpenseCategories(),
    getIngredients(),
    getExpenseSettings(),
  ]);
  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Lançar compra ou despesa"
        subtitle="Cada item da nota recebe uma categoria. O sistema divide o gasto entre os meses (conforme o prazo de consumo da categoria) e entre os centros de custo. A data da compra é também a data do pagamento."
      />
      <PurchaseForm
        categories={categories.filter((c) => c.active)}
        ingredients={ingredients.filter((i) => i.active)}
        settings={settings}
        today={todayKey()}
        canRegisterRecurring={profile.role === "admin"}
      />
    </div>
  );
}

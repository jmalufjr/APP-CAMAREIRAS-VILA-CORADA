import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpenseCategories, getExpenseSettings, getIngredients } from "@/lib/actions/expense-model";
import { CategoriesPanel } from "./categories-panel";
import { SettingsCard } from "./settings-card";

export default async function CategoriasDespesaPage() {
  const [categories, settings, ingredients] = await Promise.all([getExpenseCategories(), getExpenseSettings(), getIngredients()]);
  return (
    <div className="space-y-6">
      <BackLink href="/contabil/listas" />
      <PageHeader
        title="Categorias de despesa e centros de custo"
        subtitle="Cada compra é classificada numa categoria. A categoria diz em quantos dias o gasto é consumido (para dividir entre os meses) e como ele se reparte entre Hospedagem, Bar, Café da manhã e Frigobar."
      />
      <CategoriesPanel categories={categories} ingredients={ingredients} />
      <SettingsCard settings={settings} />
    </div>
  );
}

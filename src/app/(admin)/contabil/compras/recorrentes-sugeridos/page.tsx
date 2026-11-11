import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getCurrentProfile } from "@/lib/actions/session";
import { getExpenseCategories } from "@/lib/actions/expense-model";
import { getRecurringSuggestions } from "@/lib/actions/recurring-suggestions";
import { SuggestionsPanel } from "./suggestions-panel";

export default async function RecorrentesSugeridosPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile.role === "admin";
  const [suggestions, categories] = isAdmin
    ? await Promise.all([getRecurringSuggestions(), getExpenseCategories()])
    : [[], []];

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/compras/caixa" />
      <PageHeader
        title="Itens recorrentes sugeridos (cadastro inicial)"
        subtitle="Na primeira importação, a IA apontou as despesas que parecem se repetir todo mês. Marque as que são de fato recorrentes, ajuste nome, categoria, valor e dia, e cadastre de uma vez. Depois disso o cadastro de itens recorrentes é manual, em Listas contábeis → Itens recorrentes."
      />
      {!isAdmin ? (
        <p className="text-sm text-muted-foreground">Só o administrador cadastra itens recorrentes.</p>
      ) : (
        <SuggestionsPanel suggestions={suggestions} categories={categories.filter((c) => c.active)} />
      )}
    </div>
  );
}

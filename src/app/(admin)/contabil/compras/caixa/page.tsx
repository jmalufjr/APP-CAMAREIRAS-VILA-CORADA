import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { listInbox } from "@/lib/actions/purchase-inbox";
import { getCurrentProfile } from "@/lib/actions/session";
import { getExpenseCategories } from "@/lib/actions/expense-model";
import { classifyInboxLines } from "@/lib/purchase-routing";
import { InboxActions } from "./inbox-actions";
import { BatchConfirm, type BatchItem } from "./batch-confirm";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dmy = (d: string) => d.split("-").reverse().join("/");

export default async function CaixaConferenciaPage() {
  const items = await listInbox();
  const profile = await getCurrentProfile();
  const categories = await getExpenseCategories();
  const ruleOf = new Map(categories.map((c) => [c.id, c.rule as string]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const kindOf = (it: (typeof items)[number]) =>
    !it.ai_data
      ? "abrir"
      : classifyInboxLines(
          it.ai_data.lines.map((l) => ({ categoryId: l.category_id, rule: l.category_id ? (ruleOf.get(l.category_id) ?? null) : null, ingredientId: l.ingredient_id }))
        );
  const batch: BatchItem[] = items
    .filter((it) => kindOf(it) === "lote")
    .map((it) => ({
      id: it.id,
      title: `${dmy(it.ai_data?.date ?? it.message_date)} · ${it.ai_data?.supplier_name || it.sender || "Sem fornecedor"}`,
      total: it.ai_data?.total_amount ?? it.ai_data?.lines.reduce((sum, l) => sum + l.amount, 0) ?? null,
      lines: (it.ai_data?.lines ?? []).map((l) => ({ description: l.description, amount: l.amount, category: l.category_id ? (catName.get(l.category_id) ?? "—") : "—" })),
    }));
  const rest = items.filter((it) => kindOf(it) !== "lote");
  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Caixa de conferência de compras"
        subtitle="Notas que chegaram do WhatsApp e ainda não foram lançadas. Confira os dados lidos pela IA, corrija o que for preciso e lance — ou descarte o que não for compra."
      />
      <div className="flex gap-2">
        <Link href="/contabil/compras/importar">
          <Button size="sm">Importar conversa do WhatsApp</Button>
        </Link>
        <Link href="/contabil/compras/relatorio">
          <Button size="sm" variant="outline">Relatório de despesas</Button>
        </Link>
      </div>

      <BatchConfirm items={batch} />

      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Nada aguardando conferência.</p>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {rest.map((it) => {
            const total = it.ai_data?.total_amount ?? it.ai_data?.lines.reduce((s, l) => s + l.amount, 0) ?? null;
            return (
              <div key={it.id} className="rounded-lg border border-border bg-card p-3 text-sm space-y-2">
              <Link href={`/contabil/compras/caixa/${it.id}`} className="block hover:opacity-80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {dmy(it.ai_data?.date ?? it.message_date)} · {it.ai_data?.supplier_name || it.sender || "Sem fornecedor"}
                  </p>
                  <p className="font-medium">{total ? brl(total) : "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {it.image_url ? "📷 " : ""}
                  {it.note_text ?? "(sem texto)"}
                </p>
                {it.ai_status === "erro" && <p className="text-xs text-red-600 mt-1">A IA não conseguiu ler: preencha manualmente.</p>}
              </Link>
              <InboxActions
                id={it.id}
                canRecurring={profile.role === "admin"}
                needsReview={kindOf(it) !== "ok"}
              />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

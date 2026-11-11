import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getInboxItem } from "@/lib/actions/purchase-inbox";
import { getExpenseCategories, getIngredients, getExpenseSettings } from "@/lib/actions/expense-model";
import { todayKey } from "@/lib/date";
import { getCurrentProfile } from "@/lib/actions/session";
import { PurchaseForm } from "../../nova/purchase-form";
import { DiscardButton } from "./discard-button";

export default async function ConferirNotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getInboxItem(id);
  if (!item || item.status !== "aguardando") notFound();

  const profile = await getCurrentProfile();
  const [categories, ingredients, settings] = await Promise.all([getExpenseCategories(), getIngredients(), getExpenseSettings()]);
  const ai = item.ai_data;

  const lines = (ai?.lines ?? []).map((l) => ({
    description: l.description,
    categoryId: l.category_id ?? "",
    ingredientId: l.ingredient_id ?? "",
    quantity: String(l.quantity),
    amount: l.amount ? String(l.amount) : "",
    usefulLife: l.useful_life_months ? String(l.useful_life_months) : "",
  }));
  // Sem itens lidos mas com total: uma linha só com o total.
  if (lines.length === 0 && ai?.total_amount) {
    lines.push({ description: ai.supplier_name ?? "Compra", categoryId: "", ingredientId: "", quantity: "1", amount: String(ai.total_amount), usefulLife: "" });
  }

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/compras/caixa" />
      <PageHeader
        title="Conferir nota"
        subtitle={`Mensagem de ${item.sender ?? "—"} em ${item.message_date.split("-").reverse().join("/")}. Os campos foram preenchidos pela IA: confira com a foto, corrija e lance.`}
      />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-3">
          {item.image_url ? (
            item.is_pdf ? (
              <iframe src={item.image_url} className="w-full h-[70vh] rounded-lg border border-border" title="Nota" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="Foto da nota" className="w-full rounded-lg border border-border" />
            )
          ) : (
            <p className="text-sm text-muted-foreground">Esta mensagem não tem foto.</p>
          )}
          {item.note_text && (
            <div className="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap">
              <p className="text-xs text-muted-foreground mb-1">Mensagem que acompanhou a nota</p>
              {item.note_text}
            </div>
          )}
          {item.ai_status === "erro" && <p className="text-sm text-red-600">A IA não conseguiu ler esta nota: {item.ai_error}</p>}
          <DiscardButton id={item.id} />
        </div>
        <PurchaseForm
          categories={categories.filter((c) => c.active)}
          ingredients={ingredients.filter((i) => i.active)}
          settings={settings}
          today={todayKey()}
          inboxId={item.id}
          canRegisterRecurring={profile.role === "admin"}
          initial={{
            recurring: ai?.recurring ?? false,
            date: ai?.date ?? item.message_date,
            supplier: ai?.supplier_name ?? "",
            docNumber: ai?.document_number ?? "",
            payment: ai?.payment_method ?? "pix",
            notes: item.note_text ?? "",
            lines,
          }}
        />
      </div>
    </div>
  );
}

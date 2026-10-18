import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { getPendingExpenses } from "@/lib/actions/expenses";
import { PagamentosPanel } from "./pagamentos-panel";

// "Pagamentos e recebimentos" (Módulo Contábil Leva 2) — por ora só o
// lado "pagamentos": despesas/compras lançadas como "a prazo" (ainda não
// pagas), com a ação de registrar o pagamento de verdade (forma +
// lançamento contábil de liquidação). O lado "recebimentos" não existe
// ainda neste app — todo recebimento de hóspede já é à vista (ver
// room_bills), sem nenhum conceito de "a receber" hoje.
export default async function PagamentosPage() {
  const rows = await getPendingExpenses();

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Pagamentos e recebimentos"
        subtitle="Despesas/compras lançadas como 'a prazo', ainda não pagas. Registrar o pagamento gera o lançamento contábil de liquidação."
      />
      <PagamentosPanel rows={rows} />
    </div>
  );
}

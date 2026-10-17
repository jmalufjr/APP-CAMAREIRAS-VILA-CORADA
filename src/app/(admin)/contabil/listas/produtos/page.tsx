import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getProducts, getProductCategories, getNonProductCostItems } from "@/lib/actions/products";
import { getCostCenters } from "@/lib/actions/cost-plan";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { ProductsPanel } from "./products-panel";

export default async function CadastroDeProdutosPage() {
  const [products, categories, centers, ledgerAccounts, candidates] = await Promise.all([
    getProducts(),
    getProductCategories(),
    getCostCenters(),
    getLedgerAccounts(),
    getNonProductCostItems(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/listas" />
      <PageHeader
        title="Cadastro de produtos"
        subtitle="Um só lugar para tudo sobre o que a pousada compra e usa: nome, categoria, centros de custo, conta contábil, unidades, estoque (saldo, custo médio, dias de folga), validade e perecibilidade."
      />
      <ProductsPanel
        products={products}
        categories={categories}
        centers={centers}
        ledgerAccounts={ledgerAccounts}
        candidates={candidates}
      />
    </div>
  );
}

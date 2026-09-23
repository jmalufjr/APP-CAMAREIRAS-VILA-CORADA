import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { getApiTokens } from "@/lib/actions/api-tokens";
import { ApiTokensPanel } from "./api-tokens-panel";

export default async function ApiTokensPage() {
  const tokens = await getApiTokens();

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Chaves de acesso — API de consumos"
        subtitle="Tokens de leitura usados pelo sistema financeiro para consultar contas de bar/frigobar. Cada token só é mostrado uma vez, no momento em que é gerado."
      />
      <ApiTokensPanel tokens={tokens} />
    </div>
  );
}

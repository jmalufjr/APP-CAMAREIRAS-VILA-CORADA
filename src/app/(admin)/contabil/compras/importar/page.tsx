import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ImportPanel } from "./import-panel";

export default function ImportarWhatsAppPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/contabil/compras/caixa" />
      <PageHeader
        title="Importar conversa do WhatsApp"
        subtitle="No grupo de compras, toque em ⋮ → Mais → Exportar conversa → Incluir mídia, e envie aqui o arquivo .zip gerado. Cada foto de nota, junto com as mensagens do mesmo remetente logo depois dela, vira um item da caixa de conferência. Nada é lançado sem a sua conferência."
      />
      <ImportPanel />
    </div>
  );
}

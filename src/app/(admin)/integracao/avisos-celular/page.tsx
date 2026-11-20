import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { PushSettings } from "@/components/shared/push-settings";

// Onde o administrador liga os avisos de nova ocorrência de manutenção neste aparelho (celular ou computador).
export default function AvisosCelularPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/integracao" />
      <PageHeader
        title="Avisos no celular"
        subtitle="Receba uma notificação neste aparelho sempre que uma camareira registrar uma ocorrência de manutenção. Ligue em cada aparelho que quiser (celular e computador)."
      />
      <PushSettings />
    </div>
  );
}

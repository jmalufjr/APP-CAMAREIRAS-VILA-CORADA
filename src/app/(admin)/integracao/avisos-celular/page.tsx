import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TelegramSettings } from "@/components/shared/telegram-settings";

// Onde o administrador liga os avisos de nova ocorrência de manutenção neste aparelho (celular ou computador).
export default function AvisosCelularPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/integracao" />
      <PageHeader
        title="Avisos no celular"
        subtitle="Receba uma mensagem no Telegram sempre que uma camareira registrar uma ocorrência de manutenção, com lembretes até você tocar em “Estou ciente”."
      />
      <TelegramSettings />
    </div>
  );
}

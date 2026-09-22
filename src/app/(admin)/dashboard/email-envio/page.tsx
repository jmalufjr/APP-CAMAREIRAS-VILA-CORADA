import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { getReceiptSettings } from "@/lib/actions/room-bills";
import { EmailEnvioSettings } from "./email-envio-settings";

export default async function EmailEnvioPage() {
  const receiptSettings = await getReceiptSettings();

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Cadastrar e-mail de envio"
        subtitle="E-mail usado para o recibo de conta paga e o demonstrativo de comissões das camareiras."
      />
      <EmailEnvioSettings receiptSettings={receiptSettings} />
    </div>
  );
}

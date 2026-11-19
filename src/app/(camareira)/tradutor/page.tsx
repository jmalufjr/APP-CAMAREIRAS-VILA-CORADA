import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/session";
import { PageHeader } from "@/components/shared/page-header";
import { TranslatorClient } from "./translator-client";

// Tradutor de voz para atender hóspedes estrangeiros (inglês, espanhol, francês, italiano e alemão).
export default async function TradutorPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "manutencao") redirect("/manutencao/ocorrencias");
  const canSeeText = profile.role === "admin" || profile.role === "gerente_operacional";

  return (
    <div className="space-y-4">
      <PageHeader title="Tradutor" subtitle="Atendimento a hóspedes estrangeiros." />
      <TranslatorClient canSeeText={canSeeText} />
    </div>
  );
}

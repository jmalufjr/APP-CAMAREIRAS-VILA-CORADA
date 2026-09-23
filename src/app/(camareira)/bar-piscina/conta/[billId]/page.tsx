import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { getClosedBillRoomNumber } from "@/lib/actions/room-bills";

// PDF da conta fechada, ainda não paga — a camareira mostra/salva pro
// hóspede conferir antes de pagar. O PDF em si vem de
// /api/room-bills/[billId]/conta (gerado na hora, embutido aqui num
// iframe); o visualizador de PDF do navegador já dá os ícones de
// salvar/baixar e imprimir, sem precisar de nenhum botão extra pra isso.
export default async function ContaFechadaPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const roomNumber = await getClosedBillRoomNumber(billId);
  if (!roomNumber) notFound();

  return (
    <div className="space-y-4">
      <BackLink href="/bar-piscina" />
      <PageHeader
        title={`Conta fechada — Suíte ${roomNumber}`}
        subtitle="Use os ícones do visualizador de PDF abaixo para salvar ou imprimir."
      />
      <iframe
        src={`/api/room-bills/${billId}/conta`}
        title={`PDF da conta da Suíte ${roomNumber}`}
        className="h-[75vh] w-full rounded-xl border border-border"
      />
    </div>
  );
}

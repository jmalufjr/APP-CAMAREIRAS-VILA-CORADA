import { notFound } from "next/navigation";
import { PdfViewerPanel } from "@/components/shared/pdf-viewer-panel";
import { getPaidBillRoomNumber } from "@/lib/actions/room-bills";

// PDF do recibo de uma conta já paga (botão "Ver PDF" em "Consumo por
// quartos" > "Contas pagas"). Antes abria /api/room-bills/[billId]/receipt
// direto numa aba nova (PDF cru, sem página própria — sem botão de voltar).
// Agora abre dentro do app, com PdfViewerPanel dando voltar/baixar/
// imprimir/enviar por e-mail. Rota admin-only — a rota da API por trás
// (/receipt) também confere isso, em defesa dupla.
export default async function ContaPagaPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const roomNumber = await getPaidBillRoomNumber(billId);
  if (!roomNumber) notFound();

  return (
    <PdfViewerPanel
      billId={billId}
      pdfUrl={`/api/room-bills/${billId}/receipt`}
      downloadFilename={`conta-suite-${roomNumber}.pdf`}
      backHref="/frigobar"
      title={`Conta paga — Suíte ${roomNumber}`}
      subtitle="Use os botões abaixo para baixar, imprimir ou enviar por e-mail."
    />
  );
}

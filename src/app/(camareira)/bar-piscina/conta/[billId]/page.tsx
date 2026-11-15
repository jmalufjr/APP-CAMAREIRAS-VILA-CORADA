import { notFound } from "next/navigation";
import { PdfViewerPanel } from "@/components/shared/pdf-viewer-panel";
import { getClosedBillRoomNumber } from "@/lib/actions/room-bills";

// PDF da conta fechada, ainda não paga — a camareira mostra/salva pro
// hóspede conferir antes de pagar. O PDF em si vem de
// /api/room-bills/[billId]/conta (gerado na hora); PdfViewerPanel dá os
// botões de baixar/imprimir/enviar por e-mail, sem depender só do
// visualizador nativo do navegador dentro do iframe.
export default async function ContaFechadaPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const names = await getClosedBillRoomNumber(billId);
  if (!names) notFound();

  return (
    <PdfViewerPanel
      billId={billId}
      pdfUrl={`/api/room-bills/${billId}/conta`}
      downloadFilename={names.fileName}
      backHref="/bar-piscina"
      title={`Conta fechada — ${names.label}`}
      subtitle="Use os botões abaixo para baixar, imprimir ou enviar por e-mail."
    />
  );
}

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { sendRoomBillPdfEmail } from "@/lib/actions/room-bills";

// Visualizador de PDF compartilhado pelas duas telas que emitem PDF de conta
// (camareira: conta fechada, ainda não paga; admin: recibo de conta já
// paga) — nunca depender só do visualizador nativo do navegador dentro do
// iframe pra salvar/imprimir (não é confiável no celular, especialmente
// iOS): "Baixar PDF" força o download via atributo `download`, e
// "Imprimir" aciona a impressão do próprio iframe. "Enviar por e-mail"
// manda o mesmo PDF pro e-mail cadastrado em "E-mail de envio".
export function PdfViewerPanel({
  billId,
  pdfUrl,
  downloadFilename,
  backHref,
  title,
  subtitle,
}: {
  billId: string;
  pdfUrl: string;
  downloadFilename: string;
  backHref: string;
  title: string;
  subtitle?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isSending, setIsSending] = useState(false);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  async function handleSendEmail() {
    setIsSending(true);
    const result = await sendRoomBillPdfEmail(billId);
    setIsSending(false);
    if (result?.error) toast.error(result.error);
    else toast.success("PDF enviado por e-mail.");
  }

  return (
    <div className="space-y-4">
      <BackLink href={backHref} />
      <PageHeader title={title} subtitle={subtitle} />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          render={<a href={pdfUrl} download={downloadFilename} />}
          nativeButton={false}
        >
          Baixar PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint}>
          Imprimir
        </Button>
        <Button size="sm" variant="outline" disabled={isSending} onClick={handleSendEmail}>
          {isSending ? "Enviando..." : "Enviar por e-mail"}
        </Button>
      </div>

      <iframe
        ref={iframeRef}
        src={pdfUrl}
        title={title}
        className="h-[75vh] w-full rounded-xl border border-border"
      />
    </div>
  );
}

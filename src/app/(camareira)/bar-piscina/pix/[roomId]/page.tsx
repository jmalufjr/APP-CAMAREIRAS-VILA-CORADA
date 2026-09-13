import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { getRoomBillsOverview } from "@/lib/actions/room-bills";

export default async function PixPaymentPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const overview = await getRoomBillsOverview();
  const room = overview.find((r) => r.room_id === roomId);
  if (!room) notFound();

  return (
    <div className="space-y-6">
      <BackLink href="/bar-piscina" />
      <PageHeader
        title={`Pagamento por PIX — Quarto ${room.room_number}`}
        subtitle="Peça para o hóspede escanear o QR code abaixo no aplicativo do banco."
      />
      <div className="flex flex-col items-center gap-4 py-4">
        {/* Fundo branco fixo (não segue o tema escuro) e <img> sem otimização
            do Next.js: um QR code precisa dos pixels exatamente como estão
            no arquivo original, sem reprocessamento, para continuar nítido
            o suficiente pra ser lido pela câmera do hóspede. */}
        <div className="rounded-xl border border-border bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pix-qrcode.png" alt="QR code para pagamento PIX" width={320} height={320} />
        </div>
        <p className="text-lg font-medium">Valor a pagar: R$ {room.grandTotal.toFixed(2)}</p>
      </div>
    </div>
  );
}

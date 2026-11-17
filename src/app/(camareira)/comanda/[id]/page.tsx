import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComandaDetailBody } from "@/components/shared/comanda-detail-dialog";
import { getComandaDetail } from "@/lib/actions/comandas";
import { roomSlotLabel } from "@/lib/room-bill-label";

// Página de uma comanda (aberta ao clicar numa coluna de comanda em "Consumo por suítes"):
// itens, total, histórico de edições e assinatura do hóspede.
export default async function ComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getComandaDetail(id);
  if (!detail) notFound();
  const { comanda, canModify } = detail;
  const editable = canModify && comanda.status !== "cancelada" && !comanda.bill_paid_at;

  return (
    <div className="space-y-6">
      <BackLink href="/comanda" />
      <PageHeader
        title={`Comanda #${comanda.monthly_number ?? comanda.sequence_number}`}
        subtitle={roomSlotLabel({ room_number: comanda.room_number, guestNameHint: comanda.guestNameHint, isWalkin: comanda.isWalkin })}
        action={
          editable ? <Button render={<Link href={`/comanda/${comanda.id}/editar`}>Editar comanda</Link>} nativeButton={false} variant="outline" /> : undefined
        }
      />
      <Card>
        <CardContent className="max-w-xl">
          <ComandaDetailBody comanda={comanda} />
        </CardContent>
      </Card>
    </div>
  );
}

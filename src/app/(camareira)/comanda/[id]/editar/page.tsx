import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { createClient } from "@/lib/supabase/server";
import { getRoomsForComandaSelector, getComandaForEdit } from "@/lib/actions/comandas";
import type { PoolbarItem } from "@/lib/types";
import { ComandaForm } from "../../comanda-form";

export default async function EditarComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [formData, { data: poolbarItems }, rooms] = await Promise.all([
    getComandaForEdit(id),
    supabase.from("poolbar_items").select("*").eq("active", true).order("position"),
    getRoomsForComandaSelector(),
  ]);
  if (!formData) notFound();

  return (
    <div className="space-y-6">
      <BackLink href="/comanda" />
      <PageHeader title="Editar comanda" subtitle="Altere as quantidades, a suíte ou cancele o pedido." />
      <ComandaForm
        mode="edit"
        comandaId={id}
        poolbarItems={(poolbarItems ?? []) as PoolbarItem[]}
        rooms={rooms}
        initialRoomId={formData.room_id}
        initialGuestSlot={formData.guest_slot}
        initialQuantities={formData.quantities}
        initialComandaStatus={formData.comanda_status}
        initialBillStatus={formData.bill_status}
      />
    </div>
  );
}

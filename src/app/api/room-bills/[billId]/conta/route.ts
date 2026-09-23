import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoomBillReceiptData } from "@/lib/actions/room-bills";
import { renderReceiptPdf } from "@/lib/receipt-pdf";

// PDF da conta FECHADA, ainda não paga — diferente do recibo de pagamento
// em /api/room-bills/[billId]/receipt (admin-only): este é o PDF que a
// camareira mostra pro hóspede antes do pagamento, então camareira e admin
// têm acesso. Só gera se a conta estiver 'fechada' agora, mesmo que o
// botão que leva aqui já esteja desabilitado fora desse status na UI.
export async function GET(_request: Request, { params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado.", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "camareira" && profile?.role !== "admin") {
    return new NextResponse("Acesso restrito.", { status: 403 });
  }

  const { data: bill } = await supabase.from("room_bills").select("status").eq("id", billId).single();
  if (bill?.status !== "fechada") {
    return new NextResponse("Esta conta não está fechada.", { status: 404 });
  }

  const data = await getRoomBillReceiptData(billId);
  if (!data) return new NextResponse("Conta não encontrada.", { status: 404 });

  const pdf = await renderReceiptPdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="conta-suite-${data.room_number}.pdf"`,
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoomBillReceiptData } from "@/lib/actions/room-bills";
import { renderReceiptPdf } from "@/lib/receipt-pdf";

// Rota de API não passa pelo middleware de proteção por papel (que só olha
// caminhos de página) — checa admin aqui mesmo, já que a camareira nunca
// deve ver o PDF do recibo.
export async function GET(_request: Request, { params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado.", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new NextResponse("Acesso restrito ao admin.", { status: 403 });

  const data = await getRoomBillReceiptData(billId);
  if (!data) return new NextResponse("Conta não encontrada.", { status: 404 });

  const pdf = await renderReceiptPdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="conta-quarto-${data.room_number}.pdf"`,
    },
  });
}

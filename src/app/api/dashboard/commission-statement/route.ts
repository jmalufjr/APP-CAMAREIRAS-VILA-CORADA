import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClosedPeriodDemonstrativo } from "@/lib/actions/commission";
import { renderCommissionStatementPdf } from "@/lib/commission-statement-pdf";

// Rota de API não passa pelo middleware de proteção por papel (que só olha
// caminhos de página) — checa admin aqui mesmo, mesmo padrão já usado pelo
// PDF do recibo de conta (/api/room-bills/[billId]/receipt). Sempre serve
// o demonstrativo do último período fechado relativo a hoje (fecha no dia
// 25, não no fim do mês — ver closedPeriodRange) — não existe tela de
// navegar por períodos anteriores, só o botão "Calcular comissão do
// último período" em /dashboard/comissoes.
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado.", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new NextResponse("Acesso restrito ao admin.", { status: 403 });

  const demonstrativo = await getClosedPeriodDemonstrativo();
  if (!demonstrativo) {
    return new NextResponse("Calcule a comissão do último período antes de baixar o PDF.", { status: 404 });
  }

  const pdf = await renderCommissionStatementPdf(demonstrativo);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="comissoes-${demonstrativo.periodEnd}.pdf"`,
    },
  });
}

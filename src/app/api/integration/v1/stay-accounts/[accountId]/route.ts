import { createAdminClient } from "@/lib/supabase/admin";
import { validateServiceToken, integrationErrorResponse } from "@/lib/integration/auth";
import { getStayAccount } from "@/lib/integration/stay-accounts";

// GET /api/integration/v1/stay-accounts/{account_id} — retrato completo e
// atual de uma conta, sem envelope (PRD_consumos-api-joao-v1.md seção 5).
export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const auth = await validateServiceToken(request);
  if (!auth.ok) return integrationErrorResponse("UNAUTHORIZED", auth.message, auth.status);

  const { accountId } = await params;
  const supabase = createAdminClient();
  const account = await getStayAccount(supabase, accountId);

  if (!account) return integrationErrorResponse("NOT_FOUND", "Conta não encontrada.", 404);

  return new Response(JSON.stringify(account), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

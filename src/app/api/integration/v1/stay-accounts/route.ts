import { createAdminClient } from "@/lib/supabase/admin";
import { validateServiceToken, integrationErrorResponse } from "@/lib/integration/auth";
import { listStayAccounts } from "@/lib/integration/stay-accounts";

// GET /api/integration/v1/stay-accounts?limit&cursor — carga inicial
// paginada de contas completas, inclusive fechadas/pagas (nunca filtra só
// as abertas — ver PRD_consumos-api-joao-v1.md seção 5).
export async function GET(request: Request) {
  const auth = await validateServiceToken(request);
  if (!auth.ok) return integrationErrorResponse("UNAUTHORIZED", auth.message, auth.status);

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "25");
  if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 100) {
    return integrationErrorResponse("INVALID_PARAMETER", "limit deve ser um inteiro entre 1 e 100.", 400);
  }
  const cursor = url.searchParams.get("cursor");

  const supabase = createAdminClient();
  const page = await listStayAccounts(supabase, { cursor, limit: limitParam });

  return new Response(JSON.stringify(page), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

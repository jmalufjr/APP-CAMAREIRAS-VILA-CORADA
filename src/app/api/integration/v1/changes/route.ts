import { createAdminClient } from "@/lib/supabase/admin";
import { validateServiceToken, integrationErrorResponse } from "@/lib/integration/auth";
import { listChanges } from "@/lib/integration/stay-accounts";

// GET /api/integration/v1/changes?cursor&limit — mudanças posteriores ao
// checkpoint, inclusive cancelamentos e reaberturas (PRD_consumos-api-joao-v1.md
// seção 5) — alimentado pelos triggers de room_bill_change_events (item 4).
export async function GET(request: Request) {
  const auth = await validateServiceToken(request);
  if (!auth.ok) return integrationErrorResponse("UNAUTHORIZED", auth.message, auth.status);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? "0";
  const limitParam = Number(url.searchParams.get("limit") ?? "25");
  if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 100) {
    return integrationErrorResponse("INVALID_PARAMETER", "limit deve ser um inteiro entre 1 e 100.", 400);
  }

  const supabase = createAdminClient();
  const result = await listChanges(supabase, { cursor, limit: limitParam });

  if ("expired" in result) {
    return integrationErrorResponse("CURSOR_EXPIRED", "Cursor expirado. Reinicie a carga completa.", 410);
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

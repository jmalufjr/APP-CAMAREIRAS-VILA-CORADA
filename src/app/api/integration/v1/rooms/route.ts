import { createAdminClient } from "@/lib/supabase/admin";
import { validateServiceToken, integrationErrorResponse } from "@/lib/integration/auth";

// GET /api/integration/v1/rooms — IDs e números das suítes, situação ativa
// e ID Stays se disponível (PRD_consumos-api-joao-v1.md seção 5).
export async function GET(request: Request) {
  const auth = await validateServiceToken(request);
  if (!auth.ok) return integrationErrorResponse("UNAUTHORIZED", auth.message, auth.status);

  const supabase = createAdminClient();
  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("id, number, name, active, stays_listing_id")
    .order("position");

  if (error) return integrationErrorResponse("INTERNAL_ERROR", "Erro ao consultar suítes.", 503);

  const data = (rooms ?? []).map((r) => ({
    id: r.id,
    property_id: "vila-corada",
    number: r.number,
    label: r.name ?? r.number,
    active: r.active,
    stays_listing_id: r.stays_listing_id,
  }));

  return new Response(JSON.stringify({ data, next_cursor: null, has_more: false }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

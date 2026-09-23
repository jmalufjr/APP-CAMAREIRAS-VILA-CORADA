import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Autenticação das rotas de /api/integration/v1/* (API de consumos,
// PRD_consumos-api-joao-v1.md item 5) — não usa sessão do Supabase nem
// RLS: valida o header Authorization contra api_service_tokens via o
// client admin/service-role, mesmo padrão já usado pela integração com a
// Stays. Nunca compara o token em texto puro — só o hash SHA-256.
export type ServiceAuthResult = { ok: true } | { ok: false; status: 401; message: string };

export async function validateServiceToken(request: Request): Promise<ServiceAuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Credencial ausente ou inválida." };
  }

  const tokenHash = createHash("sha256").update(match[1]).digest("hex");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("api_service_tokens")
    .select("id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!data) {
    return { ok: false, status: 401, message: "Credencial ausente ou inválida." };
  }
  return { ok: true };
}

// Formato de erro padronizado pelo contrato (seção 8 do PRD) — sem stack
// trace nem dado privado, só código/mensagem/request_id.
export function integrationErrorResponse(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: { code, message, request_id: crypto.randomUUID() } }),
    { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  );
}

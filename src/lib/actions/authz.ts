"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

// Confere o papel de quem chama uma Server Action — as telas já são
// protegidas pelo proxy, mas uma Server Action pode ser chamada de fora da
// tela, então as sensíveis conferem também aqui.
export async function requireRole(roles: UserRole[]): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active || !roles.includes(profile.role as UserRole)) return { error: "Sem permissão para esta ação." };
  return null;
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/authz";
import { CHANNELS } from "@/lib/stays/channel-stats";

// Percentual de "correção de preço" de um canal (o mesmo número de Dashboard de Channel
// Managers > Configurações > Financeiro na Stays). Vazio = ainda não informado.
export async function updateChannelCorrection(channel: string, pct: number | null) {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  if (!CHANNELS.some((c) => c.key === channel)) return { error: "Canal inválido." };
  if (pct !== null && (!Number.isFinite(pct) || pct < -100 || pct > 1000)) {
    return { error: "Percentual inválido — use um número entre -100 e 1000 (ex.: 38 ou 7.5)." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("channel_price_settings")
    .update({ correction_pct: pct, updated_at: new Date().toISOString() })
    .eq("channel", channel);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/ticket-medio-canais");
  return { success: true as const };
}

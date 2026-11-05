"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/actions/authz";
import { syncStaysIndicators } from "@/lib/actions/stays-sync";
import { todayKey } from "@/lib/date";
import { computeIndicators, IND_CHANNELS, type IndChannel, type MonthBase, type MonthIndicators } from "@/lib/stays/indicators";

export interface CommissionRow {
  channel: IndChannel;
  label: string;
  percent: number;
}

export interface IndicatorsData {
  commissions: CommissionRow[];
  // Meses já encerrados (do mais recente para o mais antigo).
  closed: MonthIndicators[];
  // Mês corrente e os seguintes (em ordem): ainda se formando, com o que já está reservado.
  open: MonthIndicators[];
  syncedAt: string | null;
}

// Indicadores mensais, calculados na hora a partir da base guardada (rápido) e das comissões atuais.
// Na primeira vez (nada guardado) faz a importação completa do histórico na Stays.
export async function getIndicators(): Promise<{ error: string } | IndicatorsData> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;

  const supabase = await createClient();
  const countRes = await supabase.from("indicator_months").select("month", { count: "exact", head: true });
  if (countRes.error) return { error: countRes.error.message };
  if ((countRes.count ?? 0) === 0) {
    const first = await syncStaysIndicators({ full: true });
    if ("error" in first && first.error) return { error: first.error };
  }

  const [{ data: months, error }, { data: chans }, { data: coms }] = await Promise.all([
    supabase.from("indicator_months").select("month, rooms, blocked_nights, maintenance_nights, synced_at").order("month"),
    supabase.from("indicator_month_channels").select("month, channel, paid_nights, free_nights, revenue"),
    supabase.from("channel_commissions").select("channel, percent"),
  ]);
  if (error) return { error: error.message };

  const pct: Partial<Record<IndChannel, number>> = {};
  (coms ?? []).forEach((c) => (pct[c.channel as IndChannel] = Number(c.percent)));

  const bases = new Map<string, MonthBase>();
  (months ?? []).forEach((m) =>
    bases.set(m.month as string, {
      month: m.month as string,
      blocked: m.blocked_nights as number,
      maintenance: m.maintenance_nights as number,
      channels: {
        booking: { paid: 0, free: 0, revenue: 0 },
        airbnb: { paid: 0, free: 0, revenue: 0 },
        expedia: { paid: 0, free: 0, revenue: 0 },
        decolar: { paid: 0, free: 0, revenue: 0 },
        direta: { paid: 0, free: 0, revenue: 0 },
        outros: { paid: 0, free: 0, revenue: 0 },
      },
    })
  );
  (chans ?? []).forEach((c) => {
    const b = bases.get(c.month as string);
    if (!b) return;
    b.channels[c.channel as IndChannel] = { paid: c.paid_nights as number, free: c.free_nights as number, revenue: Number(c.revenue) };
  });

  const currentMonth = `${todayKey().slice(0, 7)}-01`;
  const all = (months ?? []).map((m) => computeIndicators(bases.get(m.month as string)!, m.rooms as number, pct));
  const syncedAt = (months ?? []).reduce<string | null>((acc, m) => (acc === null || (m.synced_at as string) > acc ? (m.synced_at as string) : acc), null);

  return {
    commissions: IND_CHANNELS.map((c) => ({ channel: c.key, label: c.label, percent: pct[c.key] ?? 0 })),
    closed: all.filter((m) => m.month < currentMonth).reverse(),
    // Meses futuros sem nenhuma reserva, bloqueio ou manutenção ainda não têm dados: ficam de fora (o mês
    // corrente sempre aparece).
    open: all.filter((m) => m.month === currentMonth || (m.month > currentMonth && m.paid + m.free + m.blocked + m.maintenance > 0)),
    syncedAt,
  };
}

export async function saveChannelCommission(channel: IndChannel, percent: number) {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  if (!IND_CHANNELS.some((c) => c.key === channel)) return { error: "Canal inválido." };
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { error: "Informe um percentual entre 0 e 100." };

  const { error } = await createAdminClient()
    .from("channel_commissions")
    .update({ percent: Math.round(percent * 100) / 100, updated_at: new Date().toISOString() })
    .eq("channel", channel);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/indicadores");
  return { success: true as const };
}

// Botão "Atualizar histórico completo".
export async function refreshIndicatorsFull() {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  const result = await syncStaysIndicators({ full: true });
  if ("error" in result && result.error) return { error: result.error };
  return { success: true as const };
}

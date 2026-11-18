import type { SupabaseClient } from "@supabase/supabase-js";
import { todayKey } from "@/lib/date";
import { computeIndicators, suitesInMonth, type IndChannel, type MonthBase, type MonthIndicators } from "@/lib/stays/indicators";

export interface IndicatorsData {
  // Meses já encerrados (do mais recente para o mais antigo).
  closed: MonthIndicators[];
  // Mês corrente e os seguintes (em ordem): ainda se formando, com o que já está reservado.
  open: MonthIndicators[];
  syncedAt: string | null;
}

// Lê a base guardada e calcula os indicadores de cada mês. Sem checagem de papel nem importação: quem
// chama é que confere o acesso (e escolhe o cliente do banco).
export async function loadIndicators(supabase: SupabaseClient): Promise<{ error: string } | IndicatorsData> {
  const [{ data: months, error }, { data: chans }] = await Promise.all([
    supabase.from("indicator_months").select("month, blocked_nights, maintenance_nights, synced_at").order("month"),
    supabase
      .from("indicator_month_channels")
      .select("month, channel, paid_nights, paid_guest_nights, free_nights, revenue, commission_actual, revenue_with_commission"),
  ]);
  if (error) return { error: error.message };

  const emptyChannel = () => ({ paid: 0, paidGuests: 0, free: 0, revenue: 0, commissionActual: 0, revenueWithCommission: 0 });
  const bases = new Map<string, MonthBase>();
  (months ?? []).forEach((m) =>
    bases.set(m.month as string, {
      month: m.month as string,
      blocked: m.blocked_nights as number,
      maintenance: m.maintenance_nights as number,
      channels: {
        booking: emptyChannel(),
        airbnb: emptyChannel(),
        expedia: emptyChannel(),
        decolar: emptyChannel(),
        direta: emptyChannel(),
        outros: emptyChannel(),
      },
    })
  );
  (chans ?? []).forEach((c) => {
    const b = bases.get(c.month as string);
    if (!b) return;
    b.channels[c.channel as IndChannel] = {
      paid: c.paid_nights as number,
      paidGuests: Number(c.paid_guest_nights ?? 0),
      free: c.free_nights as number,
      revenue: Number(c.revenue),
      commissionActual: Number(c.commission_actual),
      revenueWithCommission: Number(c.revenue_with_commission),
    };
  });

  const currentMonth = `${todayKey().slice(0, 7)}-01`;
  const all = (months ?? []).map((m) => computeIndicators(bases.get(m.month as string)!, suitesInMonth(m.month as string)));
  const syncedAt = (months ?? []).reduce<string | null>((acc, m) => (acc === null || (m.synced_at as string) > acc ? (m.synced_at as string) : acc), null);

  return {
    closed: all.filter((m) => m.month < currentMonth).reverse(),
    // Meses futuros sem nenhuma reserva, bloqueio ou manutenção ainda não têm dados: ficam de fora (o mês
    // corrente sempre aparece).
    open: all.filter((m) => m.month === currentMonth || (m.month > currentMonth && m.paid + m.free + m.blocked + m.maintenance > 0)),
    syncedAt,
  };
}

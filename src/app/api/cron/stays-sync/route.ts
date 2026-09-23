import { NextRequest, NextResponse } from "next/server";
import { syncStaysPlanning, syncStaysArrivalsDepartures, syncStaysBreakfastTables } from "@/lib/actions/stays-sync";
import { createAdminClient } from "@/lib/supabase/admin";

// Sincronização automática (Vercel Cron, ver vercel.json) do Planejamento
// Diário, Chegadas & Saídas e Mesas do Café — as três, hoje+amanhã, na
// mesma execução. Roda sem `force`: respeita a regra de preferência do
// admin (`stays_locked`) como qualquer sincronização normal — só o botão
// manual de cada tela força a sobrescrita (ver CLAUDE.md Parte 14).
// Protegido por CRON_SECRET (padrão recomendado pela própria Vercel:
// https://vercel.com/docs/cron-jobs/manage-cron-jobs) — sem essa variável
// configurada, o endpoint sempre responde 401, nunca roda "aberto".
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const planning = await syncStaysPlanning();
  const arrivalsDepartures = await syncStaysArrivalsDepartures();
  const breakfastTables = await syncStaysBreakfastTables();

  // Retenção de 90 dias do histórico de mudanças da API de consumos
  // (PRD_consumos-api-joao-v1.md item 4) — soma de graça na mesma execução
  // diária que já existia, sem precisar de um cron próprio só pra isso.
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("room_bill_change_events").delete().lt("occurred_at", cutoff);

  return NextResponse.json({ planning, arrivalsDepartures, breakfastTables });
}

import { NextRequest, NextResponse } from "next/server";
import { syncStaysPlanning, syncStaysArrivalsDepartures, syncStaysBreakfastTables } from "@/lib/actions/stays-sync";

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

  return NextResponse.json({ planning, arrivalsDepartures, breakfastTables });
}

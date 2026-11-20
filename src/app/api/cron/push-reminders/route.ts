import { NextRequest, NextResponse } from "next/server";
import { notifyNewOccurrences, sendReminders } from "@/lib/occurrence-alerts";

export const maxDuration = 30;

// Chamado a cada 5 minutos pelo banco (pg_cron, ver supabase/producao/55): envia o aviso de qualquer ocorrência nova
// que tenha escapado e os lembretes das ocorrências pendentes cuja notificação ainda não foi dispensada.
// Protegido por PUSH_CRON_SECRET (ou, na falta dela, CRON_SECRET).
export async function GET(request: NextRequest) {
  const cronSecret = process.env.PUSH_CRON_SECRET || process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const fresh = await notifyNewOccurrences();
  const reminders = await sendReminders();
  return NextResponse.json({ ok: true, fresh, reminders });
}

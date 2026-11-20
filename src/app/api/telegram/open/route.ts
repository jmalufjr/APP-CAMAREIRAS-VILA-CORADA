import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tgCall, appBaseUrl } from "@/lib/telegram";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Botão "Abrir no app" da mensagem do Telegram: registra o "ciente" (encerra os lembretes daquela ocorrência
// naquela conversa) e leva a pessoa à tela de ocorrências. Só marca ciente; não dá acesso a nenhum dado
// (a tela de destino continua exigindo login). O link traz a ocorrência e a conversa, ambos códigos longos e aleatórios.
export async function GET(request: NextRequest) {
  const o = request.nextUrl.searchParams.get("o") ?? "";
  const l = request.nextUrl.searchParams.get("l") ?? "";
  let path = "/manutencao/ocorrencias";
  if (UUID.test(o) && UUID.test(l)) {
    const admin = createAdminClient();
    const { data: link } = await admin.from("telegram_links").select("id, chat_id, profiles(role)").eq("id", l).maybeSingle();
    if (link) {
      const role = (link.profiles as unknown as { role: string } | null)?.role;
      if (role === "admin") path = "/ocorrencias";
      const { data: alert } = await admin
        .from("telegram_alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("occurrence_id", o)
        .eq("link_id", l)
        .select("last_message_id")
        .maybeSingle();
      // Tira o botão da mensagem, para ficar claro que já foi visto.
      if (alert?.last_message_id) {
        await tgCall("editMessageReplyMarkup", {
          chat_id: Number(link.chat_id),
          message_id: Number(alert.last_message_id),
          reply_markup: { inline_keyboard: [] },
        });
      }
    }
  }
  return NextResponse.redirect(new URL(path, appBaseUrl()), 302);
}

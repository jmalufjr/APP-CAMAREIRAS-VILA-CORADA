import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tgCall, sendTelegramText, escapeHtml } from "@/lib/telegram";

export const maxDuration = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

function secretOk(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Update = {
  message?: { text?: string; chat: { id: number; type: string } };
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number } } };
};

// Telegram chama esta rota a cada mensagem enviada ao bot. Só aceita chamadas com o segredo combinado
// ao registrar o endereço (cabeçalho X-Telegram-Bot-Api-Secret-Token).
export async function POST(request: NextRequest) {
  if (!secretOk(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const admin = createAdminClient();

  // 1) Pessoa abriu o link "Ativar no Telegram": /start <código>.
  const msg = update.message;
  if (msg?.text && msg.chat.type === "private") {
    const chatId = msg.chat.id;
    const match = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(msg.text);
    if (match) {
      const token = match[1];
      if (!token || !TOKEN.test(token)) {
        await sendTelegramText(chatId, "Olá! Para ativar os avisos, abra o app da pousada, vá em <b>Avisos no celular</b> e toque em <b>Ativar no Telegram</b>.");
        return NextResponse.json({ ok: true });
      }
      const { data: row } = await admin.from("telegram_link_tokens").select("user_id, expires_at").eq("token", token).maybeSingle();
      // Código de uso único: apagado já na leitura.
      await admin.from("telegram_link_tokens").delete().eq("token", token);
      if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
        await sendTelegramText(chatId, "Este link expirou. Volte ao app e toque em <b>Ativar no Telegram</b> de novo.");
        return NextResponse.json({ ok: true });
      }
      const { error } = await admin.from("telegram_links").upsert({ user_id: row.user_id, chat_id: chatId }, { onConflict: "chat_id" });
      if (error) {
        await sendTelegramText(chatId, "Não consegui ativar agora. Tente de novo em instantes.");
        return NextResponse.json({ ok: true });
      }
      const { data: profile } = await admin.from("profiles").select("name").eq("id", row.user_id).maybeSingle();
      await sendTelegramText(
        chatId,
        `✅ Pronto${profile?.name ? `, <b>${escapeHtml(String(profile.name))}</b>` : ""}! Você vai receber aqui um aviso a cada nova ocorrência de manutenção, com lembretes até tocar em <b>Estou ciente</b>.`
      );
    }
    return NextResponse.json({ ok: true });
  }

  // 2) Botão "Estou ciente": encerra os lembretes daquela ocorrência para esta conversa.
  const cb = update.callback_query;
  if (cb?.data?.startsWith("ack:") && cb.message) {
    const occurrenceId = cb.data.slice(4);
    const chatId = cb.message.chat.id;
    if (UUID.test(occurrenceId)) {
      const { data: link } = await admin.from("telegram_links").select("id").eq("chat_id", chatId).maybeSingle();
      if (link) {
        await admin
          .from("telegram_alerts")
          .update({ acknowledged_at: new Date().toISOString() })
          .eq("occurrence_id", occurrenceId)
          .eq("link_id", link.id);
      }
    }
    await tgCall("answerCallbackQuery", { callback_query_id: cb.id, text: "Ciente. Lembretes encerrados." });
    await tgCall("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
  }
  return NextResponse.json({ ok: true });
}

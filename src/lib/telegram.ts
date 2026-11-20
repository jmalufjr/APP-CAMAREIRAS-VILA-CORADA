// Envio de mensagens pelo Telegram (bot de avisos da pousada). Só o servidor usa o token do bot.

const API = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function botUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME || "VilaCoradaAvisosBot";
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://app-camareiras-vila-corada.vercel.app").replace(/\/$/, "");
}

type TgResult<T> = { ok: true; result: T } | { ok: false; code?: number; description?: string };

export async function tgCall<T = unknown>(method: string, body: Record<string, unknown>): Promise<TgResult<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "bot não configurado" };
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; error_code?: number; description?: string };
    if (json.ok) return { ok: true, result: json.result as T };
    return { ok: false, code: json.error_code, description: json.description };
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "falha de rede" };
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface TelegramAlert {
  occurrenceId: string;
  suite?: string;
  category: string;
  description?: string | null;
  reminder: boolean;
  // Caminho da tela de ocorrências para o botão "Abrir".
  path: string;
}

// Envia o aviso com o botão "Estou ciente". Devolve o id da mensagem, ou "blocked" se a pessoa
// bloqueou o bot / apagou a conversa (quem chama remove a ligação).
export async function sendOccurrenceAlert(chatId: number, a: TelegramAlert): Promise<{ messageId: number } | "blocked" | "error"> {
  const head = a.reminder ? "🔔 <b>LEMBRETE — ocorrência de manutenção</b>" : "🚨 <b>Nova ocorrência de manutenção</b>";
  const lines = [head, `${a.suite ? `Suíte ${escapeHtml(a.suite)} · ` : ""}${escapeHtml(a.category)}`];
  if (a.description) lines.push(escapeHtml(a.description.slice(0, 300)));
  const res = await tgCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: lines.join("\n"),
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Estou ciente", callback_data: `ack:${a.occurrenceId}` }],
        [{ text: "Abrir no app", url: `${appBaseUrl()}${a.path}` }],
      ],
    },
  });
  if (res.ok) return { messageId: res.result.message_id };
  // Só apaga a ligação quando a conversa realmente não existe mais (bot bloqueado, usuário desativado, chat não encontrado).
  const gone = res.code === 403 || (res.code === 400 && /chat not found|user is deactivated|bot was blocked/i.test(res.description ?? ""));
  if (gone) return "blocked";
  console.error("[telegram]", res.code, res.description);
  return "error";
}

export async function deleteTelegramMessage(chatId: number, messageId: number) {
  await tgCall("deleteMessage", { chat_id: chatId, message_id: messageId });
}

export async function sendTelegramText(chatId: number, text: string) {
  return tgCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

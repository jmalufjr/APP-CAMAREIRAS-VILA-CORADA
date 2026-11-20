"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramConfigured, botUsername, tgCall, appBaseUrl } from "@/lib/telegram";

const ALLOWED_ROLES = ["manutencao", "admin"];

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return user;
}

// Quantas conversas do Telegram esta pessoa já ligou.
export async function getTelegramStatus() {
  const user = await currentUser();
  if (!user) return { configured: false, linked: 0 };
  const admin = createAdminClient();
  const { count } = await admin.from("telegram_links").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return { configured: telegramConfigured(), linked: count ?? 0 };
}

// Gera o link que abre o bot já com o código de ligação (vale 15 minutos, uso único).
export async function createTelegramLink() {
  const user = await currentUser();
  if (!user) return { error: "Sem permissão." };
  if (!telegramConfigured()) return { error: "Avisos pelo Telegram ainda não configurados no servidor." };
  const admin = createAdminClient();
  await admin.from("telegram_link_tokens").delete().eq("user_id", user.id);
  const token = randomBytes(24).toString("base64url");
  const { error } = await admin
    .from("telegram_link_tokens")
    .insert({ token, user_id: user.id, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
  if (error) return { error: error.message };
  return { url: `https://t.me/${botUsername()}?start=${token}` };
}

export async function unlinkTelegram() {
  const user = await currentUser();
  if (!user) return { error: "Sem permissão." };
  const admin = createAdminClient();
  const { error } = await admin.from("telegram_links").delete().eq("user_id", user.id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function sendTelegramTest() {
  const user = await currentUser();
  if (!user) return { error: "Sem permissão." };
  if (!telegramConfigured()) return { error: "Avisos pelo Telegram ainda não configurados no servidor." };
  const admin = createAdminClient();
  const { data: links } = await admin.from("telegram_links").select("chat_id").eq("user_id", user.id);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const path = profile?.role === "admin" ? "/ocorrencias" : "/manutencao/ocorrencias";
  if (!links || links.length === 0) return { error: "Nenhuma conversa ligada." };
  let sent = 0;
  for (const l of links) {
    const res = await tgCall("sendMessage", {
      chat_id: Number(l.chat_id),
      text: "🔔 <b>Teste de aviso</b>\nSe você está vendo isto, os avisos de ocorrência estão funcionando.",
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "Abrir no app (ciente)", url: `${appBaseUrl()}${path}` }]] },
    });
    if (res.ok) sent++;
  }
  return sent > 0 ? { success: true } : { error: "Não foi possível enviar o teste." };
}

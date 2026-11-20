"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendToSubscription } from "@/lib/push";

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

// Chave pública usada pelo navegador para se inscrever (não é segredo).
export async function getVapidPublicKey(): Promise<string | null> {
  return pushConfigured() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const user = await currentUser();
  if (!user) return { error: "Sem permissão para ativar avisos." };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Aparelho inválido." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 300) },
      { onConflict: "endpoint" }
    );
  if (error) return { error: error.message };
  return { success: true };
}

export async function removePushSubscription(endpoint: string) {
  const user = await currentUser();
  if (!user) return { error: "Sem permissão." };
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return { error: error.message };
  return { success: true };
}

// Aviso de teste para os aparelhos da própria pessoa.
export async function sendTestPush() {
  const user = await currentUser();
  if (!user) return { error: "Sem permissão." };
  if (!pushConfigured()) return { error: "Avisos não configurados no servidor." };
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  if (!subs || subs.length === 0) return { error: "Nenhum aparelho ativado." };
  let sent = 0;
  for (const sub of subs) {
    const result = await sendToSubscription(sub, {
      title: "Teste de aviso",
      body: "Se você está vendo isto, os avisos de ocorrência estão funcionando neste aparelho.",
      tag: "teste-aviso",
      url: "/",
    });
    if (result === "ok") sent++;
    if (result === "gone") await admin.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return sent > 0 ? { success: true, sent } : { error: "Não foi possível enviar o aviso de teste." };
}

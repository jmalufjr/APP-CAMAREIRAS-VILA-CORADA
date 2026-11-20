"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendDetailed } from "@/lib/push";

const ALLOWED_ROLES = ["manutencao", "admin"];

// O servidor envia o aviso para o endereço (endpoint) que o aparelho informou; por segurança, só aceita endereços
// dos serviços de push dos navegadores (evita fazer o servidor chamar um endereço qualquer).
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge e Samsung Internet no Android e no computador
  "android.googleapis.com",
  "updates.push.services.mozilla.com", // Firefox
  "push.services.mozilla.com",
  "notify.windows.com", // Edge no Windows (e subdomínios)
  "push.apple.com", // Safari (e subdomínios, como web.push.apple.com)
];

function validPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

function validBase64Url(value: string, bytes: number): boolean {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return false;
  return Buffer.from(value, "base64url").length === bytes;
}

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
  if (
    !sub?.endpoint ||
    !validPushEndpoint(sub.endpoint) ||
    !validBase64Url(sub.keys?.p256dh, 65) ||
    !validBase64Url(sub.keys?.auth, 16)
  ) {
    return { error: "Aparelho inválido." };
  }
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
  const details: { host: string; result: string; code?: number; reason?: string }[] = [];
  for (const sub of subs) {
    const detail = await sendDetailed(sub, {
      title: "Teste de aviso",
      body: "Se você está vendo isto, os avisos de ocorrência estão funcionando neste aparelho.",
      tag: "teste-aviso",
      url: "/",
    });
    let host = "";
    try {
      host = new URL(sub.endpoint).hostname;
    } catch {
      /* endereço ilegível */
    }
    details.push({ host, result: detail.result, code: detail.code, reason: detail.reason });
    if (detail.result === "gone") await admin.from("push_subscriptions").delete().eq("id", sub.id);
  }
  const sent = details.filter((d) => d.result === "ok").length;
  return sent > 0 ? { success: true, sent, details } : { error: "Não foi possível enviar o aviso de teste.", details };
}

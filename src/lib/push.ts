import { setVapidDetails, sendNotification } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Quem recebe os avisos de ocorrência: funcionários de manutenção e administrador.
const RECIPIENT_ROLES = ["manutencao", "admin"];
const MANUTENCAO_URL = "/manutencao/ocorrencias";
const ADMIN_URL = "/ocorrencias";
// Lembrete: a cada 5 minutos (o agendador chama a cada 5; 4 min de folga) e no máximo 36 vezes (3 horas).
const REMINDER_AFTER_MS = 4 * 60 * 1000;
const MAX_SENDS = 36;

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  occurrenceId?: string;
}

let configured = false;
export function pushConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  setVapidDetails(process.env.VAPID_SUBJECT || "https://app-camareiras-vila-corada.vercel.app", pub, priv);
  configured = true;
  return true;
}

export interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// "ok", "gone" (aparelho não existe mais: apagar) ou "error".
export async function sendToSubscription(sub: SubscriptionRow, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      TTL: 6 * 60 * 60,
      urgency: "high",
    });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push]", status, (e as Error)?.message);
    return "error";
  }
}

type OccurrenceInfo = {
  id: string;
  description: string | null;
  status: string;
  occurrence_categories: { name: string } | null;
  daily_room_tasks: { rooms: { number: string } | null } | null;
};

function payloadFor(o: OccurrenceInfo, role: string, reminder: boolean): PushPayload {
  const suite = o.daily_room_tasks?.rooms?.number;
  const category = o.occurrence_categories?.name ?? "Ocorrência";
  const detail = o.description ? ` — ${o.description}` : "";
  return {
    title: reminder ? "Lembrete: ocorrência de manutenção" : "Nova ocorrência de manutenção",
    body: `${suite ? `Suíte ${suite} · ` : ""}${category}${detail}`.slice(0, 160),
    tag: `occ-${o.id}`,
    url: role === "admin" ? ADMIN_URL : MANUTENCAO_URL,
    occurrenceId: o.id,
  };
}

const OCCURRENCE_SELECT =
  "id, description, status, occurrence_categories(name), daily_room_tasks(rooms(number))";

type SubWithRole = SubscriptionRow & { profiles: { role: string; active: boolean } | null };

async function recipientSubscriptions(): Promise<SubWithRole[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, profiles!inner(role, active)")
    .in("profiles.role", RECIPIENT_ROLES)
    .eq("profiles.active", true);
  return (data ?? []) as unknown as SubWithRole[];
}

// Primeiro aviso de cada ocorrência nova (ainda sem aviso enviado), para todos os aparelhos de quem recebe.
export async function notifyNewOccurrences(): Promise<{ occurrences: number; sent: number }> {
  if (!pushConfigured()) return { occurrences: 0, sent: 0 };
  const admin = createAdminClient();

  const { data: candidates } = await admin
    .from("daily_room_task_occurrences")
    .select("id")
    .is("push_notified_at", null)
    .eq("status", "pendente")
    .limit(50);
  const ids = (candidates ?? []).map((c) => c.id as string);
  if (ids.length === 0) return { occurrences: 0, sent: 0 };

  // "Reserva" as ocorrências antes de enviar: se dois processos rodarem juntos, cada ocorrência avisa uma vez só.
  const { data: claimed } = await admin
    .from("daily_room_task_occurrences")
    .update({ push_notified_at: new Date().toISOString() })
    .in("id", ids)
    .is("push_notified_at", null)
    .select(OCCURRENCE_SELECT);
  const occurrences = (claimed ?? []) as unknown as OccurrenceInfo[];
  if (occurrences.length === 0) return { occurrences: 0, sent: 0 };

  const subs = await recipientSubscriptions();
  let sent = 0;
  for (const occ of occurrences) {
    for (const sub of subs) {
      const result = await sendToSubscription(sub, payloadFor(occ, sub.profiles?.role ?? "manutencao", false));
      if (result === "gone") {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        continue;
      }
      await admin.from("push_alerts").upsert(
        { occurrence_id: occ.id, subscription_id: sub.id, last_sent_at: new Date().toISOString(), send_count: 1, acknowledged_at: null },
        { onConflict: "occurrence_id,subscription_id" }
      );
      if (result === "ok") sent++;
    }
  }
  return { occurrences: occurrences.length, sent };
}

// Lembretes: reenvia o aviso de toda ocorrência ainda pendente cuja notificação não foi dispensada naquele aparelho.
export async function sendReminders(): Promise<{ reminded: number }> {
  if (!pushConfigured()) return { reminded: 0 };
  const admin = createAdminClient();
  const before = new Date(Date.now() - REMINDER_AFTER_MS).toISOString();

  const { data } = await admin
    .from("push_alerts")
    .select(
      `id, send_count, push_subscriptions(id, endpoint, p256dh, auth, profiles(role)), daily_room_task_occurrences!inner(${OCCURRENCE_SELECT})`
    )
    .is("acknowledged_at", null)
    .lt("send_count", MAX_SENDS)
    .lt("last_sent_at", before)
    .eq("daily_room_task_occurrences.status", "pendente")
    .limit(100);

  type Row = {
    id: string;
    send_count: number;
    push_subscriptions: (SubscriptionRow & { profiles: { role: string } | null }) | null;
    daily_room_task_occurrences: OccurrenceInfo | null;
  };
  let reminded = 0;
  for (const row of (data ?? []) as unknown as Row[]) {
    const sub = row.push_subscriptions;
    const occ = row.daily_room_task_occurrences;
    if (!sub || !occ) continue;
    const result = await sendToSubscription(sub, payloadFor(occ, sub.profiles?.role ?? "manutencao", true));
    if (result === "gone") {
      await admin.from("push_subscriptions").delete().eq("id", sub.id);
      continue;
    }
    if (result === "ok") {
      reminded++;
      await admin
        .from("push_alerts")
        .update({ last_sent_at: new Date().toISOString(), send_count: row.send_count + 1 })
        .eq("id", row.id);
    }
  }
  return { reminded };
}

import { createAdminClient } from "@/lib/supabase/admin";
import { telegramConfigured, sendOccurrenceAlert, deleteTelegramMessage } from "@/lib/telegram";

// Avisos de nova ocorrência de manutenção pelo Telegram, para funcionários de manutenção e administrador.
const RECIPIENT_ROLES = ["manutencao", "admin"];
const MANUTENCAO_URL = "/manutencao/ocorrencias";
const ADMIN_URL = "/ocorrencias";
// Lembrete: a cada 5 minutos (o agendador chama a cada 5; 4 min de folga) e no máximo 36 vezes (3 horas).
const REMINDER_AFTER_MS = 4 * 60 * 1000;
const MAX_SENDS = 36;

type OccurrenceInfo = {
  id: string;
  description: string | null;
  status: string;
  occurrence_categories: { name: string } | null;
  daily_room_tasks: { rooms: { number: string } | null } | null;
};

const OCCURRENCE_SELECT = "id, description, status, occurrence_categories(name), daily_room_tasks(rooms(number))";

type LinkWithRole = { id: string; chat_id: number; profiles: { role: string; active: boolean } | null };

function alertFor(o: OccurrenceInfo, linkId: string, role: string, reminder: boolean) {
  return {
    occurrenceId: o.id,
    linkId,
    suite: o.daily_room_tasks?.rooms?.number,
    category: o.occurrence_categories?.name ?? "Ocorrência",
    description: o.description,
    reminder,
    path: role === "admin" ? ADMIN_URL : MANUTENCAO_URL,
  };
}

// Primeiro aviso de cada ocorrência nova (ainda sem aviso enviado), para todas as conversas ligadas.
export async function notifyNewOccurrences(): Promise<{ occurrences: number; sent: number }> {
  if (!telegramConfigured()) return { occurrences: 0, sent: 0 };
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

  const { data: links } = await admin
    .from("telegram_links")
    .select("id, chat_id, profiles!inner(role, active)")
    .in("profiles.role", RECIPIENT_ROLES)
    .eq("profiles.active", true);

  let sent = 0;
  for (const occ of occurrences) {
    for (const link of (links ?? []) as unknown as LinkWithRole[]) {
      const res = await sendOccurrenceAlert(Number(link.chat_id), alertFor(occ, link.id, link.profiles?.role ?? "manutencao", false));
      if (res === "blocked") {
        await admin.from("telegram_links").delete().eq("id", link.id);
        continue;
      }
      await admin.from("telegram_alerts").upsert(
        {
          occurrence_id: occ.id,
          link_id: link.id,
          last_sent_at: new Date().toISOString(),
          send_count: 1,
          last_message_id: res === "error" ? null : res.messageId,
          acknowledged_at: null,
        },
        { onConflict: "occurrence_id,link_id" }
      );
      if (res !== "error") sent++;
    }
  }
  return { occurrences: occurrences.length, sent };
}

// Lembretes: repete o aviso (nova mensagem, com som) até a pessoa tocar em "Abrir no app".
export async function sendReminders(): Promise<{ reminded: number }> {
  if (!telegramConfigured()) return { reminded: 0 };
  const admin = createAdminClient();
  const before = new Date(Date.now() - REMINDER_AFTER_MS).toISOString();
  const { data } = await admin
    .from("telegram_alerts")
    .select(
      `id, send_count, last_message_id, telegram_links!inner(id, chat_id, profiles!inner(role, active)), daily_room_task_occurrences!inner(${OCCURRENCE_SELECT})`
    )
    .is("acknowledged_at", null)
    .lt("send_count", MAX_SENDS)
    .lt("last_sent_at", before)
    .eq("daily_room_task_occurrences.status", "pendente")
    .in("telegram_links.profiles.role", RECIPIENT_ROLES)
    .eq("telegram_links.profiles.active", true)
    .limit(100);

  type Row = {
    id: string;
    send_count: number;
    last_message_id: number | null;
    telegram_links: { id: string; chat_id: number; profiles: { role: string } | null } | null;
    daily_room_task_occurrences: OccurrenceInfo | null;
  };
  let reminded = 0;
  for (const row of (data ?? []) as unknown as Row[]) {
    const link = row.telegram_links;
    const occ = row.daily_room_task_occurrences;
    if (!link || !occ) continue;
    const res = await sendOccurrenceAlert(Number(link.chat_id), alertFor(occ, link.id, link.profiles?.role ?? "manutencao", true));
    if (res === "blocked") {
      await admin.from("telegram_links").delete().eq("id", link.id);
      continue;
    }
    if (res === "error") continue;
    // Apaga o aviso anterior para a conversa não encher de repetições.
    if (row.last_message_id) await deleteTelegramMessage(Number(link.chat_id), Number(row.last_message_id));
    reminded++;
    await admin
      .from("telegram_alerts")
      .update({ last_sent_at: new Date().toISOString(), send_count: row.send_count + 1, last_message_id: res.messageId })
      .eq("id", row.id);
  }
  return { reminded };
}

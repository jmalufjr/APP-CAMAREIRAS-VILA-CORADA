import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { todayKey, tomorrowKey, daysAgoKey } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceLogTable, type ServiceLogRow } from "../service-log-table";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import type { ChecklistType } from "@/lib/types";

export default async function ServicosSuitesPage() {
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const sevenDaysAgo = daysAgoKey(6);

  const [{ data: todayTasks }, { data: tomorrowTasks }, { data: serviceLog }] = await Promise.all([
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", today),
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", tomorrow),
    // Serviço concluído pelas camareiras nos últimos 7 dias, para a tabela
    // "Serviços dos últimos 7 dias" abaixo dos cards de hoje/amanhã.
    supabase
      .from("daily_room_tasks")
      .select(
        "id, date, task_type, claimed_at, started_at, finished_at, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name)"
      )
      .gte("date", sevenDaysAgo)
      .lte("date", today)
      .eq("status", "concluido"),
  ]);

  const serviceLogRows: ServiceLogRow[] = (
    (serviceLog ?? []) as unknown as {
      id: string;
      date: string;
      task_type: ChecklistType;
      claimed_at: string | null;
      started_at: string | null;
      finished_at: string | null;
      rooms: { number: string };
      profiles: { name: string } | null;
    }[]
  )
    .map((r) => ({
      id: r.id,
      date: r.date,
      room_number: r.rooms.number,
      task_type: r.task_type,
      claimed_at: r.claimed_at,
      started_at: r.started_at,
      finished_at: r.finished_at,
      camareira_name: r.profiles?.name ?? null,
    }))
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : Number(a.room_number) - Number(b.room_number)));

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader title="Serviços nas suítes" subtitle="Suítes de hoje e amanhã, e os serviços dos últimos 7 dias." />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Suítes de hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(todayTasks ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>
                  Suíte {(t as unknown as { rooms: { number: string } }).rooms.number} ·{" "}
                  {TASK_TYPE_LABELS[t.task_type as ChecklistType]}
                </span>
                <Badge variant={t.status === "concluido" ? "default" : "secondary"}>
                  {t.status === "concluido" ? "Concluído" : t.status === "em_andamento" ? "Em andamento" : "Pendente"}
                </Badge>
              </div>
            ))}
            {(todayTasks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhuma suíte planejada para hoje.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Suítes de amanhã</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(tomorrowTasks ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>Suíte {(t as unknown as { rooms: { number: string } }).rooms.number}</span>
                <Badge variant="outline">{TASK_TYPE_LABELS[t.task_type as ChecklistType]}</Badge>
              </div>
            ))}
            {(tomorrowTasks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Planejamento de amanhã ainda não definido.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Serviços dos últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ServiceLogTable rows={serviceLogRows} />
        </CardContent>
      </Card>
    </div>
  );
}

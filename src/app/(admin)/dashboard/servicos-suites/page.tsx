import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { todayKey, tomorrowKey, daysAgoKey } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceLogTable } from "../service-log-table";
import { getServiceLogRows } from "@/lib/service-log";
import { WaiveReviewButton } from "@/components/shared/waive-review-button";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";
import { formatDateShortPt } from "@/lib/date";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import type { ChecklistType } from "@/lib/types";

export default async function ServicosSuitesPage() {
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const sevenDaysAgo = daysAgoKey(6);

  const [{ data: todayTasks }, { data: tomorrowTasks }, serviceLogRows, { data: pendingReview }] = await Promise.all([
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", today),
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", tomorrow),
    // Serviço concluído pelas camareiras nos últimos 7 dias, para a tabela
    // "Serviços dos últimos 7 dias" abaixo dos cards de hoje/amanhã.
    getServiceLogRows(supabase, sevenDaysAgo, today),
    // Serviços que ainda não fecharam o ciclo (revisão / correção), de qualquer dia.
    supabase
      .from("daily_room_tasks")
      .select(
        "id, date, task_type, status, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name), reviewer:profiles!daily_room_tasks_reviewed_by_fkey(name)"
      )
      .in("status", ["aguardando_revisao", "em_revisao", "aguardando_correcao", "em_correcao"])
      .order("date", { ascending: true }),
  ]);

  const pendingRows = (pendingReview ?? []) as unknown as {
    id: string;
    date: string;
    task_type: ChecklistType;
    status: TaskStatus;
    rooms: { number: string };
    profiles: { name: string } | null;
    reviewer: { name: string } | null;
  }[];

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
                  {TASK_STATUS_LABELS[t.status as TaskStatus]}
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
          <CardTitle className="font-heading text-lg">Serviços aguardando revisão ou correção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingRows.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1.5 border-b border-border last:border-0">
              <span>
                {formatDateShortPt(t.date)} · Suíte {t.rooms.number} · {TASK_TYPE_LABELS[t.task_type]} ·{" "}
                {t.profiles?.name ?? "—"}
                {t.reviewer ? ` (revisão: ${t.reviewer.name})` : ""}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{TASK_STATUS_LABELS[t.status]}</Badge>
                {t.status === "aguardando_revisao" && <WaiveReviewButton taskId={t.id} />}
              </span>
            </div>
          ))}
          {pendingRows.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Nenhum serviço aguardando revisão ou correção.</p>
          )}
        </CardContent>
      </Card>

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

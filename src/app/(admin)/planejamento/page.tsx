import { BackLink } from "@/components/shared/back-link";
import { createClient } from "@/lib/supabase/server";
import type { Room, Profile, DailyRoomTask } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { PlanningBoard } from "./planning-board";
import { DateSwitcher } from "@/components/shared/date-switcher";
import { WaiveReviewButton } from "@/components/shared/waive-review-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShortPt } from "@/lib/date";
import { taskTypeLabel } from "@/lib/task-type";
import type { ChecklistType } from "@/lib/types";

export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  // Padrão é sempre "Hoje" — só mostra "Amanhã" quando explicitamente
  // selecionado via query string (nunca lembrado entre visitas).
  const date = sp.date === "amanha" ? tomorrowKey() : todayKey();
  const supabase = await createClient();
  const [{ data: rooms }, { data: camareiras }, { data: tasks }, { data: awaitingReview }] = await Promise.all([
    supabase.from("rooms").select("*").eq("active", true).order("position"),
    supabase.from("profiles").select("*").eq("role", "camareira").eq("active", true).order("name"),
    supabase.from("daily_room_tasks").select("*").eq("date", date),
    // Serviços já feitos que aguardam a revisora, de qualquer dia: só aqui o admin/gerente pode dispensar a revisão.
    supabase
      .from("daily_room_tasks")
      .select("id, date, task_type, extra_cleaning, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name)")
      .eq("status", "aguardando_revisao")
      .order("date", { ascending: true }),
  ]);
  const reviewRows = (awaitingReview ?? []) as unknown as {
    id: string;
    date: string;
    task_type: ChecklistType;
    extra_cleaning: boolean;
    rooms: { number: string };
    profiles: { name: string } | null;
  }[];

  return (
    <div className="space-y-6">
      <BackLink href="/operacional" />
      <PageHeader
        title="Planejamento diário"
        subtitle={`Defina o tipo de trabalho de cada suíte para ${formatDatePt(date)}. As camareiras escolhem, no próprio app, qual suíte vão realizar.`}
        action={<DateSwitcher basePath="/planejamento" current={sp.date === "amanha" ? "amanha" : "hoje"} />}
      />
      <PlanningBoard
        date={date}
        rooms={(rooms ?? []) as Room[]}
        camareiras={(camareiras ?? []) as Profile[]}
        tasks={(tasks ?? []) as DailyRoomTask[]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Serviços pendentes de revisão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reviewRows.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
              <span>
                {formatDateShortPt(t.date)} · Suíte {t.rooms.number} · {taskTypeLabel(t.task_type, t.extra_cleaning)} ·{" "}
                {t.profiles?.name ?? "—"}
              </span>
              <WaiveReviewButton taskId={t.id} />
            </div>
          ))}
          {reviewRows.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nenhum serviço aguardando revisão.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

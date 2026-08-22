import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/actions/session";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, formatDatePt } from "@/lib/date";
import { TasksBoard, type TaskWithRoom } from "./tasks-board";

export default async function TarefasPage() {
  const profile = await getCurrentProfile();
  const date = todayKey();
  const supabase = await createClient();

  // RLS já escopa o retorno: camareira vê as tarefas dela + as ainda sem
  // responsável (disponíveis para escolher); admin vê todas.
  const { data: tasks } = await supabase
    .from("daily_room_tasks")
    .select("*, rooms(number, name)")
    .eq("date", date)
    .order("created_at");

  return (
    <div className="space-y-6">
      <PageHeader title="Meus quartos" subtitle={`Trabalhos de hoje, ${formatDatePt(date)}`} />
      <TasksBoard profile={profile} tasks={(tasks ?? []) as unknown as TaskWithRoom[]} />
    </div>
  );
}

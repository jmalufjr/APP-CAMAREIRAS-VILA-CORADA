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
  const [{ data: todayTasks }, { data: pastAvailable }, { data: pastMine }] = await Promise.all([
    supabase.from("daily_room_tasks").select("*, rooms(number, name)").eq("date", date).order("created_at"),
    // Serviços de dias anteriores nunca escolhidos por ninguém: não somem
    // mais da tela, ficam em "Serviços anteriores" até serem escolhidos ou
    // cancelados.
    supabase
      .from("daily_room_tasks")
      .select("*, rooms(number, name)")
      .lt("date", date)
      .eq("status", "pendente")
      .is("assigned_to", null)
      .order("date", { ascending: true }),
    // Serviços de dias anteriores que esta camareira escolheu mas ainda não
    // concluiu — continuam em "Meus quartos", referenciando a data original.
    supabase
      .from("daily_room_tasks")
      .select("*, rooms(number, name)")
      .lt("date", date)
      .eq("assigned_to", profile.id)
      .in("status", ["pendente", "em_andamento"])
      .order("date", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Meus quartos" subtitle={`Trabalhos de hoje, ${formatDatePt(date)}`} />
      <TasksBoard
        profile={profile}
        today={date}
        todayTasks={(todayTasks ?? []) as unknown as TaskWithRoom[]}
        pastAvailableTasks={(pastAvailable ?? []) as unknown as TaskWithRoom[]}
        pastMineTasks={(pastMine ?? []) as unknown as TaskWithRoom[]}
      />
    </div>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayKey } from "@/lib/date";
import type { ChecklistType, TaskStatus } from "@/lib/types";

// Tipos de trabalho de hoje que pressupõem hóspede na suíte essa noite — suíte ocupada,
// fora das duas listas ("Suítes vagas e limpas, disponíveis para alugar").
const OCCUPIED_TODAY: ReadonlySet<ChecklistType> = new Set(["arrumacao", "troca", "preparacao", "somente_chegada"]);

interface RoomTaskRow {
  room_id: string;
  task_type: ChecklistType;
  status: TaskStatus;
}

// Suítes sem hóspede previsto para hoje à noite, separadas entre limpas e sujas.
// - Serviço de hoje de Troca/Arrumação/Saída com Chegada/Somente Chegada: ocupada, fora das listas.
// - Somente Saída: disponível; limpa se o serviço já estiver concluído, suja caso contrário.
// - Suíte já vaga (sem serviço hoje): olha a ÚLTIMA tarefa registrada, de qualquer tipo; só é limpa se
//   for uma Somente Saída concluída (um sinal antigo nunca garante limpeza atual).
export async function getAvailableSuites(supabase: SupabaseClient): Promise<{ limpas: string[]; sujas: string[] }> {
  const today = todayKey();
  const [{ data: rooms }, { data: todayTasks }] = await Promise.all([
    supabase.from("rooms").select("id, number").eq("active", true).order("position"),
    supabase.from("daily_room_tasks").select("room_id, task_type, status").eq("date", today),
  ]);

  const roomList = (rooms ?? []) as { id: string; number: string }[];
  const todayByRoom = new Map<string, RoomTaskRow>(((todayTasks ?? []) as RoomTaskRow[]).map((t) => [t.room_id, t]));

  const lastTaskByRoom = new Map<string, RoomTaskRow | null>();
  await Promise.all(
    roomList
      .filter((r) => !todayByRoom.has(r.id))
      .map(async (r) => {
        const { data } = await supabase
          .from("daily_room_tasks")
          .select("room_id, task_type, status")
          .eq("room_id", r.id)
          .lt("date", today)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        lastTaskByRoom.set(r.id, (data as RoomTaskRow | null) ?? null);
      })
  );

  const limpas: string[] = [];
  const sujas: string[] = [];
  roomList.forEach((r) => {
    const todayTask = todayByRoom.get(r.id);
    if (todayTask && OCCUPIED_TODAY.has(todayTask.task_type)) return;
    if (todayTask && todayTask.task_type === "somente_saida") {
      (todayTask.status === "concluido" ? limpas : sujas).push(r.number);
      return;
    }
    const last = lastTaskByRoom.get(r.id);
    const clean = last?.task_type === "somente_saida" && last.status === "concluido";
    (clean ? limpas : sujas).push(r.number);
  });
  return { limpas, sujas };
}

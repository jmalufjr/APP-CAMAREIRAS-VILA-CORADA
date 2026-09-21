import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { todayKey } from "@/lib/date";
import type { ChecklistType, TaskStatus } from "@/lib/types";

// Tipos de trabalho de hoje que pressupõem hóspede na suíte essa noite —
// suíte ocupada, fora das duas listas desta tela (ver regra de negócio
// discutida com o proprietário antes de implementar).
const OCCUPIED_TODAY: ReadonlySet<ChecklistType> = new Set([
  "arrumacao",
  "troca",
  "preparacao",
  "somente_chegada",
]);

interface RoomTaskRow {
  room_id: string;
  task_type: ChecklistType;
  status: TaskStatus;
}

function RoomBadgeList({ rooms }: { rooms: string[] }) {
  if (rooms.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma suíte nesta condição.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {rooms.map((number) => (
        <Badge key={number} variant="outline" className="text-sm">
          Suíte {number}
        </Badge>
      ))}
    </div>
  );
}

export default async function SuitesDisponiveisPage() {
  const supabase = await createClient();
  const today = todayKey();

  const [{ data: rooms }, { data: todayTasks }] = await Promise.all([
    supabase.from("rooms").select("id, number").eq("active", true).order("position"),
    supabase.from("daily_room_tasks").select("room_id, task_type, status").eq("date", today),
  ]);

  const roomList = rooms ?? [];
  const todayByRoom = new Map<string, RoomTaskRow>(((todayTasks ?? []) as RoomTaskRow[]).map((t) => [t.room_id, t]));

  // Suítes sem nenhum serviço previsto hoje (já vagas) — pra saber se
  // estão limpas ou sujas, cada uma precisa da sua própria última tarefa
  // registrada (a mais recente de qualquer tipo, não só de saída): se
  // essa última tarefa não for uma Somente Saída concluída, a suíte é
  // tratada como suja por padrão — um sinal antigo (ex.: uma Saída com
  // Chegada) nunca garante limpeza atual, porque a suíte certamente foi
  // ocupada depois disso até ficar vaga de novo, e não temos como saber
  // se foi limpa quando esse hóspede saiu.
  const roomsWithoutTodayTask = roomList.filter((r) => !todayByRoom.has(r.id));
  const lastTaskByRoom = new Map<string, RoomTaskRow | null>();
  await Promise.all(
    roomsWithoutTodayTask.map(async (r) => {
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

    if (todayTask && OCCUPIED_TODAY.has(todayTask.task_type)) {
      return; // ocupada hoje à noite — fora das duas listas
    }

    if (todayTask && todayTask.task_type === "somente_saida") {
      (todayTask.status === "concluido" ? limpas : sujas).push(r.number);
      return;
    }

    // Sem tarefa hoje: cai na última tarefa registrada (ver comentário acima).
    const last = lastTaskByRoom.get(r.id);
    const clean = last?.task_type === "somente_saida" && last.status === "concluido";
    (clean ? limpas : sujas).push(r.number);
  });

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Suítes vagas e limpas, disponíveis para alugar"
        subtitle="Suítes sem hóspede previsto para hoje à noite, separadas entre limpas e sujas."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Suítes limpas</CardTitle>
          </CardHeader>
          <CardContent>
            <RoomBadgeList rooms={limpas} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Suítes sujas</CardTitle>
          </CardHeader>
          <CardContent>
            <RoomBadgeList rooms={sujas} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

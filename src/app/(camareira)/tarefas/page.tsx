import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/actions/session";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, formatDatePt } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { BedDouble, ChevronRight } from "lucide-react";

export default async function TarefasPage() {
  const profile = await getCurrentProfile();
  const date = todayKey();
  const supabase = await createClient();

  let query = supabase
    .from("daily_room_tasks")
    .select("*, rooms(number, name)")
    .eq("date", date)
    .order("created_at");

  if (profile.role === "camareira") {
    query = query.eq("assigned_to", profile.id);
  }

  const { data: tasks } = await query;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus quartos"
        subtitle={`Trabalhos de hoje, ${formatDatePt(date)}`}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        {(tasks ?? []).map((task) => (
          <Link key={task.id} href={`/tarefas/${task.id}`}>
            <Card className="hover:border-primary transition-colors">
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                    <BedDouble size={18} />
                  </div>
                  <div>
                    <p className="font-medium">Quarto {(task as unknown as { rooms: { number: string } }).rooms.number}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {task.task_type === "arrumacao" ? "Arrumação" : "Preparação"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={task.status === "concluido" ? "default" : "secondary"}>
                    {task.status === "concluido"
                      ? "Concluído"
                      : task.status === "em_andamento"
                      ? "Em andamento"
                      : "Pendente"}
                  </Badge>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(tasks ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm py-8 col-span-2 text-center">
            Nenhum quarto atribuído para hoje.
          </p>
        )}
      </div>
    </div>
  );
}

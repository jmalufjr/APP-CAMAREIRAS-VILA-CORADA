import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ChecklistDetail } from "./checklist-detail";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("daily_room_tasks")
    .select("*, rooms(number, name)")
    .eq("id", taskId)
    .single();

  if (!task) notFound();

  const [{ data: checks }, { data: occurrences }, { data: categories }] = await Promise.all([
    supabase
      .from("daily_room_task_checks")
      .select("*, checklist_items(label, description, position)")
      .eq("daily_room_task_id", taskId)
      .order("checklist_items(position)"),
    supabase
      .from("daily_room_task_occurrences")
      .select("*, occurrence_categories(name)")
      .eq("daily_room_task_id", taskId),
    supabase.from("occurrence_categories").select("*").eq("active", true).order("position"),
  ]);

  const room = (task as unknown as { rooms: { number: string; name: string | null } }).rooms;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Quarto ${room.number}`}
        subtitle={task.task_type === "arrumacao" ? "Checklist de arrumação" : "Checklist de preparação"}
      />
      <ChecklistDetail
        task={task}
        checks={checks ?? []}
        occurrences={occurrences ?? []}
        categories={categories ?? []}
      />
    </div>
  );
}

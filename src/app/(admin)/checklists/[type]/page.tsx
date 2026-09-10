import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ChecklistItem, ChecklistType, Room } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { ChecklistItemsPanel } from "../checklist-items-panel";

const VALID_TYPES: ChecklistType[] = ["arrumacao", "preparacao", "troca"];

export default async function ChecklistTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!VALID_TYPES.includes(type as ChecklistType)) notFound();
  const checklistType = type as ChecklistType;

  const supabase = await createClient();
  const [{ data: items }, { data: rooms }, { data: assignments }] = await Promise.all([
    supabase.from("checklist_items").select("*").eq("type", checklistType).order("position"),
    supabase.from("rooms").select("*").order("position"),
    supabase.from("room_checklist_items").select("room_id, checklist_item_id"),
  ]);

  const assignmentMap = new Map<string, string[]>();
  (assignments ?? []).forEach((a) => {
    const list = assignmentMap.get(a.checklist_item_id) ?? [];
    list.push(a.room_id);
    assignmentMap.set(a.checklist_item_id, list);
  });

  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title={TASK_TYPE_LABELS[checklistType]}
        subtitle="Gerencie os itens deste checklist e a ordem em que aparecem para a camareira."
      />
      <ChecklistItemsPanel
        type={checklistType}
        items={(items ?? []) as ChecklistItem[]}
        rooms={(rooms ?? []) as Room[]}
        assignmentMap={Object.fromEntries(assignmentMap)}
      />
    </div>
  );
}

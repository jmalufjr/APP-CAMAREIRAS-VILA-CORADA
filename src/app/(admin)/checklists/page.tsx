import { createClient } from "@/lib/supabase/server";
import type { ChecklistItem, OccurrenceCategory, Room } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { ChecklistItemsPanel } from "./checklist-items-panel";
import { OccurrenceCategoriesPanel } from "./occurrence-categories-panel";

export default async function ChecklistsPage() {
  const supabase = await createClient();
  const [{ data: items }, { data: categories }, { data: rooms }, { data: assignments }] =
    await Promise.all([
      supabase.from("checklist_items").select("*").order("position"),
      supabase.from("occurrence_categories").select("*").order("position"),
      supabase.from("rooms").select("*").order("position"),
      supabase.from("room_checklist_items").select("room_id, checklist_item_id"),
    ]);

  const assignmentMap = new Map<string, string[]>();
  (assignments ?? []).forEach((a) => {
    const list = assignmentMap.get(a.checklist_item_id) ?? [];
    list.push(a.room_id);
    assignmentMap.set(a.checklist_item_id, list);
  });

  const arrumacao = (items ?? []).filter((i) => i.type === "arrumacao") as ChecklistItem[];
  const preparacao = (items ?? []).filter((i) => i.type === "preparacao") as ChecklistItem[];
  const troca = (items ?? []).filter((i) => i.type === "troca") as ChecklistItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists & ocorrências"
        subtitle="Gerencie os itens de arrumação, preparação chegada, troca e as categorias de ocorrências."
      />
      <Tabs defaultValue="arrumacao">
        <TabsList>
          <TabsTrigger value="arrumacao">{TASK_TYPE_LABELS.arrumacao}</TabsTrigger>
          <TabsTrigger value="preparacao">{TASK_TYPE_LABELS.preparacao}</TabsTrigger>
          <TabsTrigger value="troca">{TASK_TYPE_LABELS.troca}</TabsTrigger>
          <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
        </TabsList>
        <TabsContent value="arrumacao" className="pt-4">
          <ChecklistItemsPanel
            type="arrumacao"
            items={arrumacao}
            rooms={(rooms ?? []) as Room[]}
            assignmentMap={Object.fromEntries(assignmentMap)}
          />
        </TabsContent>
        <TabsContent value="preparacao" className="pt-4">
          <ChecklistItemsPanel
            type="preparacao"
            items={preparacao}
            rooms={(rooms ?? []) as Room[]}
            assignmentMap={Object.fromEntries(assignmentMap)}
          />
        </TabsContent>
        <TabsContent value="troca" className="pt-4">
          <ChecklistItemsPanel
            type="troca"
            items={troca}
            rooms={(rooms ?? []) as Room[]}
            assignmentMap={Object.fromEntries(assignmentMap)}
          />
        </TabsContent>
        <TabsContent value="ocorrencias" className="pt-4">
          <OccurrenceCategoriesPanel categories={(categories ?? []) as OccurrenceCategory[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

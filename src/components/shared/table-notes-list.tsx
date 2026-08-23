import { Card, CardContent } from "@/components/ui/card";

export function TableNotesList({
  rows,
  labelById,
}: {
  rows: { table_id: string; notes: string | null }[];
  labelById: Map<string, string>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base text-primary">Observações</h3>
      {rows.map((r) => (
        <Card key={r.table_id}>
          <CardContent>
            <p className="text-sm font-medium">{labelById.get(r.table_id) ?? "Mesa"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{r.notes}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

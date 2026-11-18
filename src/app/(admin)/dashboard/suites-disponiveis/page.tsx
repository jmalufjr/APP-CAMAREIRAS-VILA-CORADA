import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAvailableSuites } from "@/lib/available-suites";

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

// A regra de "limpa/suja/ocupada" fica em src/lib/available-suites.ts (a mesma do Resumo executivo).
export default async function SuitesDisponiveisPage() {
  const { limpas, sujas } = await getAvailableSuites(await createClient());

  return (
    <div className="space-y-6">
      <BackLink href="/operacional" />
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

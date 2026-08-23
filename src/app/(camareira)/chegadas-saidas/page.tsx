import { createClient } from "@/lib/supabase/server";
import type { Room, DailyArrival, DailyDeparture } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, LogOut } from "lucide-react";

export default async function ChegadasSaidasViewPage() {
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = tomorrowKey();

  const [{ data: rooms }, { data: arrivalsToday }, { data: departuresToday }, { data: arrivalsTomorrow }, { data: departuresTomorrow }] =
    await Promise.all([
      supabase.from("rooms").select("*").order("position"),
      supabase.from("daily_arrivals").select("*").eq("date", today),
      supabase.from("daily_departures").select("*").eq("date", today),
      supabase.from("daily_arrivals").select("*").eq("date", tomorrow),
      supabase.from("daily_departures").select("*").eq("date", tomorrow),
    ]);

  const roomMap = new Map(((rooms ?? []) as Room[]).map((r) => [r.id, r.number]));

  return (
    <div className="space-y-6">
      <PageHeader title="Chegadas & saídas" subtitle="Hóspedes previstos para hoje e amanhã." />
      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="amanha">Amanhã</TabsTrigger>
        </TabsList>
        <TabsContent value="hoje" className="pt-4">
          <DayLists
            label={formatDatePt(today)}
            arrivals={(arrivalsToday ?? []) as DailyArrival[]}
            departures={(departuresToday ?? []) as DailyDeparture[]}
            roomMap={roomMap}
          />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4">
          <DayLists
            label={formatDatePt(tomorrow)}
            arrivals={(arrivalsTomorrow ?? []) as DailyArrival[]}
            departures={(departuresTomorrow ?? []) as DailyDeparture[]}
            roomMap={roomMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DayLists({
  label,
  arrivals,
  departures,
  roomMap,
}: {
  label: string;
  arrivals: DailyArrival[];
  departures: DailyDeparture[];
  roomMap: Map<string, string>;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm capitalize text-muted-foreground">{label}</p>
      <div className="grid sm:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="font-heading text-lg text-primary flex items-center gap-2">
            <LogIn size={18} className="text-secondary" /> Chegadas
          </h2>
          {arrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma chegada prevista.</p>
          ) : (
            <div className="space-y-2">
              {arrivals.map((a) => (
                <Card key={a.id}>
                  <CardContent>
                    <p className="font-medium text-sm">
                      Quarto {roomMap.get(a.room_id) ?? "—"} · {a.guest_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.expected_time ? `Previsto para ${a.expected_time.slice(0, 5)}` : "Horário não informado"}
                    </p>
                    {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg text-primary flex items-center gap-2">
            <LogOut size={18} className="text-secondary" /> Saídas
          </h2>
          {departures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma saída prevista.</p>
          ) : (
            <div className="space-y-2">
              {departures.map((d) => (
                <Card key={d.id}>
                  <CardContent>
                    <p className="font-medium text-sm">Quarto {roomMap.get(d.room_id) ?? "—"}</p>
                    {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

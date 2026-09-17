import { createClient } from "@/lib/supabase/server";
import type { Room, DailyArrival, DailyDeparture } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, formatDatePt } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, LogOut } from "lucide-react";

export default async function ChegadasSaidasViewPage() {
  const supabase = await createClient();
  const today = todayKey();

  const [{ data: rooms }, { data: arrivals }, { data: departures }] = await Promise.all([
    supabase.from("rooms").select("*").order("position"),
    supabase.from("daily_arrivals").select("*").eq("date", today),
    supabase.from("daily_departures").select("*").eq("date", today),
  ]);

  const roomMap = new Map(((rooms ?? []) as Room[]).map((r) => [r.id, r.number]));

  return (
    <div className="space-y-6">
      <PageHeader title="Chegadas & saídas" subtitle="Hóspedes previstos para hoje." />
      <DayLists
        label={formatDatePt(today)}
        arrivals={(arrivals ?? []) as DailyArrival[]}
        departures={(departures ?? []) as DailyDeparture[]}
        roomMap={roomMap}
      />
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
                      Suíte {roomMap.get(a.room_id) ?? "—"} · {a.guest_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.expected_time ? `Previsto para ${a.expected_time.slice(0, 5)}` : "Horário não informado"}
                      {(a.nights || a.guest_count) && " · "}
                      {a.nights ? `${a.nights} noite${a.nights === 1 ? "" : "s"}` : null}
                      {a.nights && a.guest_count ? " · " : null}
                      {a.guest_count ? `${a.guest_count} hóspede${a.guest_count === 1 ? "" : "s"}` : null}
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
                    <p className="font-medium text-sm">Suíte {roomMap.get(d.room_id) ?? "—"}</p>
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

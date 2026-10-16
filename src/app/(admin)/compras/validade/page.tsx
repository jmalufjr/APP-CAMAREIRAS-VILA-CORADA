import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpiringLots } from "@/lib/actions/expiry";

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default async function ValidadePage() {
  const lots = await getExpiringLots();

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Validade dos produtos"
        subtitle="Compras com data de validade que ainda têm saldo e já venceram ou estão perto de vencer. O estoque considera que sai primeiro o que vence primeiro."
      />
      <div className="space-y-2">
        {lots.map((l, i) => (
          <div
            key={`${l.inventory_item_id}-${l.expiry_date}-${i}`}
            className={`rounded-lg border p-3 ${l.days_left < 0 ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}
          >
            <p className="text-sm font-medium">{l.item_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sobram {l.remaining} {l.unit} · vence em {fmtDate(l.expiry_date)} ·{" "}
              {l.days_left < 0
                ? `venceu há ${-l.days_left} dia(s)`
                : l.days_left === 0
                  ? "vence hoje"
                  : `faltam ${l.days_left} dia(s)`}
              {l.purchase_date && ` · comprado em ${fmtDate(l.purchase_date)}`}
            </p>
          </div>
        ))}
        {lots.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum produto vencido ou perto de vencer.</p>}
      </div>
    </div>
  );
}

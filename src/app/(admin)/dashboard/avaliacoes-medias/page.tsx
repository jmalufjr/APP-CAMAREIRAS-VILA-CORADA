import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { getGuestReviews } from "@/lib/actions/stays-reviews";
import {
  channelAverage,
  channelsPresent,
  overallAverage,
  type ChannelAverage,
  type NormalizedReview,
} from "@/lib/stays/reviews";

const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));
const plural = (n: number) => `${n} ${n === 1 ? "avaliação" : "avaliações"}`;

function ItemsTable({ data }: { data: ChannelAverage }) {
  if (data.items.length === 0) {
    return <p className="text-sm text-muted-foreground">Este canal não traz notas por item.</p>;
  }
  return (
    <table className="w-full max-w-md text-sm">
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          <th className="py-1 font-medium">Item avaliado</th>
          <th className="py-1 text-right font-medium">Média</th>
          <th className="py-1 text-right font-medium">Notas</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((i) => (
          <tr key={i.label} className="border-t border-border">
            <td className="py-1.5">{i.label}</td>
            <td className="py-1.5 text-right tabular-nums">{fmt(i.average)}</td>
            <td className="py-1.5 text-right tabular-nums text-muted-foreground">{i.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SuiteBlock({
  suite,
  reviews,
  all,
  isFirst,
}: {
  suite: string;
  reviews: NormalizedReview[];
  all: NormalizedReview[];
  isFirst: boolean;
}) {
  const channels = channelsPresent(reviews);
  const allChannels = channelsPresent(all);

  return (
    <AccordionItem value={`suite-${suite}`}>
      <AccordionTrigger>
        <span>Suíte {suite}</span>
        <span className="text-xs font-normal text-muted-foreground">
          média geral {fmt(overallAverage(reviews))} · {plural(reviews.length)}
        </span>
      </AccordionTrigger>
      <AccordionPanel className="space-y-3">
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">Esta suíte ainda não tem avaliações.</p>}

        {channels.length > 0 && (
          <Accordion className="space-y-2">
            {channels.map((c) => {
              const mine = channelAverage(reviews, c);
              const hotel = isFirst ? channelAverage(all, c) : null;
              return (
                <AccordionItem key={c} value={`suite-${suite}-${c}`}>
                  <AccordionTrigger>
                    <span>{mine.channelLabel}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      média {fmt(mine.average)} · {plural(mine.count)}
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel className="space-y-4">
                    <ItemsTable data={mine} />
                    {hotel && (
                      <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
                        <p className="text-sm font-medium">
                          Média geral da pousada neste canal · {fmt(hotel.average)} · {plural(hotel.count)}
                        </p>
                        <ItemsTable data={hotel} />
                      </div>
                    )}
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {isFirst && (
          <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
            <p className="text-sm font-medium">
              Média geral da pousada · {fmt(overallAverage(all))} · {plural(all.length)}
            </p>
            <table className="w-full max-w-md text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Canal</th>
                  <th className="py-1 text-right font-medium">Média</th>
                  <th className="py-1 text-right font-medium">Avaliações</th>
                </tr>
              </thead>
              <tbody>
                {allChannels.map((c) => {
                  const a = channelAverage(all, c);
                  return (
                    <tr key={c} className="border-t border-border">
                      <td className="py-1.5">{a.channelLabel}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(a.average)}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{a.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AccordionPanel>
    </AccordionItem>
  );
}

export default async function AvaliacoesMediasPage() {
  const result = await getGuestReviews();

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard" />
        <PageHeader title="Médias das avaliações" subtitle="Por suíte, por canal e por item avaliado." />
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  const { reviews, suites } = result;
  const knownNumbers = new Set(suites.map((s) => s.number));
  // Avaliações de uma suíte que não está no cadastro (ou sem suíte) entram na média da pousada, mas
  // não ganham bloco próprio.
  const numbers = [...suites.map((s) => s.number)];
  const orphan = reviews.filter((r) => !r.suite || !knownNumbers.has(r.suite)).length;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Médias das avaliações"
        subtitle="Uma seção por suíte; dentro dela, um canal por vez; dentro de cada canal, a média de cada item avaliado. Notas de 0 a 5. Itens não avaliados pelo hóspede ficam fora da média."
      />
      <Accordion className="space-y-3 max-w-3xl">
        {numbers.map((n, idx) => (
          <SuiteBlock key={n} suite={n} reviews={reviews.filter((r) => r.suite === n)} all={reviews} isFirst={idx === 0} />
        ))}
      </Accordion>
      {orphan > 0 && (
        <p className="text-xs text-muted-foreground">
          {plural(orphan)} sem suíte identificada entram só na média geral da pousada.
        </p>
      )}
    </div>
  );
}

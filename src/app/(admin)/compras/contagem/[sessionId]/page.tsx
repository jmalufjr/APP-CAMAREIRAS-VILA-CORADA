import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getCountSessionLines } from "@/lib/actions/inventory-counts";
import { CountSessionPanel } from "./count-session-panel";

export default async function CountSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const lines = await getCountSessionLines(sessionId);

  return (
    <div className="space-y-6">
      <BackLink href="/compras/contagem" />
      <PageHeader title="Contagem de estoque" subtitle="Informe a quantidade física encontrada de cada item." />
      <CountSessionPanel sessionId={sessionId} lines={lines} />
    </div>
  );
}

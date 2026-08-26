import { PageHeader } from "@/components/shared/page-header";

export default function ManutencaoPreventivaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Trabalhos de manutenção preventiva de hoje, amanhã e dos próximos 30 dias."
      />
      <p className="text-sm text-muted-foreground">
        Em desenvolvimento — esta tela fará parte da próxima etapa do módulo de manutenção
        (categorias, itens e agenda de manutenção preventiva).
      </p>
    </div>
  );
}

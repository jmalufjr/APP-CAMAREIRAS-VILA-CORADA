import { PageHeader } from "@/components/shared/page-header";

export default function AdminManutencaoPreventivaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Hoje, amanhã e os próximos dois meses de manutenção preventiva, por categoria e item."
      />
      <p className="text-sm text-muted-foreground">
        Em desenvolvimento — esta tela fará parte da próxima etapa do módulo de manutenção
        (categorias, itens e agenda de manutenção preventiva).
      </p>
    </div>
  );
}

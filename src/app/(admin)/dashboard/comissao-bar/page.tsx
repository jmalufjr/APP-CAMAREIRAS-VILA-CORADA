import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CamareiraBarCommissionTable } from "../camareira-bar-commission-table";
import { getBarCommissionByCamareira } from "@/lib/actions/comandas";

export default async function ComissaoBarPage() {
  const barCommission = await getBarCommissionByCamareira();

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Comissão de 10% do bar por camareira"
        subtitle="Mês atual e mês anterior, por camareira."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Comissão de 10% do bar por camareira</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            10% do valor de cada comanda, atribuído a quem a lançou originalmente — mesmo quando outra
            camareira editou a comanda depois. Somado pelo mês em que a comanda foi lançada; contas cuja
            taxa de serviço foi isentada pelo hóspede não entram no cálculo.
          </p>
          <CamareiraBarCommissionTable
            currentMonth={barCommission.currentMonth}
            previousMonth={barCommission.previousMonth}
          />
        </CardContent>
      </Card>
    </div>
  );
}

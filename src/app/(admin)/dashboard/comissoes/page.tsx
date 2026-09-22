import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CamareiraBarCommissionTable } from "../camareira-bar-commission-table";
import { getBarCommissionScreenSummary } from "@/lib/actions/comandas";
import { getSuitesCafeCurrentMonthEstimate, getClosedPeriodDemonstrativo } from "@/lib/actions/commission";
import { toDateKey, nowInBrazil, monthYearLabelPt } from "@/lib/date";
import type { CommissionSettings } from "@/lib/types";
import { SuitesCafeCommissionPanel } from "./suites-cafe-commission-panel";

export default async function ComissoesPage() {
  const supabase = await createClient();
  const [barCommission, estimate, demonstrativo, { data: commissionSettings }] = await Promise.all([
    getBarCommissionScreenSummary(),
    getSuitesCafeCurrentMonthEstimate(),
    getClosedPeriodDemonstrativo(),
    supabase.from("commission_settings").select("*").single(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Comissões das camareiras"
        subtitle="Comissão de serviços nas suítes e no café, e comissão de 10% do bar."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Comissão de 10% do bar por camareira</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            10% do valor de cada comanda, atribuído a quem a lançou originalmente — mesmo quando outra
            camareira editou a comanda depois. Contas cuja taxa de serviço foi isentada pelo hóspede não
            entram no cálculo. Assim como a comissão de serviços nas suítes e no café abaixo, o valor
            definitivo é sempre o do último período fechado — não do mês calendário.
          </p>
          <CamareiraBarCommissionTable
            currentMonthEstimate={barCommission.currentMonthEstimate}
            closedPeriod={barCommission.closedPeriod}
          />
        </CardContent>
      </Card>

      <SuitesCafeCommissionPanel
        commission={commissionSettings as CommissionSettings}
        estimate={estimate}
        demonstrativo={demonstrativo}
        currentMonthLabel={monthYearLabelPt(toDateKey(nowInBrazil()))}
      />
    </div>
  );
}

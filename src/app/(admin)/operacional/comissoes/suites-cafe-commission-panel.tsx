"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  setClosedPeriodScore,
  sendCommissionStatementEmail,
  type SuitesCafeEstimateRow,
  type CommissionStatement,
} from "@/lib/actions/commission";
import { updateCommissionValue } from "@/lib/actions/tables";
import type { CommissionSettings } from "@/lib/types";
import { monthYearLabelPt } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Download, Mail } from "lucide-react";

export function SuitesCafeCommissionPanel({
  commission,
  estimate,
  demonstrativo,
  currentMonthLabel,
}: {
  commission: CommissionSettings;
  estimate: { rows: SuitesCafeEstimateRow[]; totalPot: number };
  demonstrativo: CommissionStatement;
  currentMonthLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [commissionValue, setCommissionValue] = useState(String(commission?.value_per_table ?? 10));

  function saveCommissionValue() {
    startTransition(async () => {
      const result = await updateCommissionValue(Number(commissionValue));
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Valor atualizado.");
        router.refresh();
      }
    });
  }

  function updateClosedScore(camareiraId: string, camareiraName: string, score: number) {
    startTransition(async () => {
      const result = await setClosedPeriodScore(camareiraId, camareiraName, score);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function sendEmail() {
    startTransition(async () => {
      const result = await sendCommissionStatementEmail();
      if (result?.error) toast.error(result.error);
      else toast.success("Demonstrativo enviado por e-mail.");
    });
  }

  const totalEstimate = estimate.rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Comissão de serviços nas suítes e no café</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Valor da comissão por café servido</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">R$</span>
            <Input
              className="w-32"
              type="number"
              step="0.01"
              min="0"
              value={commissionValue}
              onChange={(e) => setCommissionValue(e.target.value)}
            />
            <Button disabled={isPending} onClick={saveCommissionValue}>
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Esse valor é multiplicado pelo número de suítes elegíveis pro café da manhã (in house + com saída no
            dia) para se obter o pote de comissão do dia, acumulado dia a dia ao longo do mês.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Mês corrente (estimativa) · {currentMonthLabel}</p>
          <p className="text-sm">
            Bolo de comissão estimado (considera todas as camareiras com nota 10): <strong>R$ {estimate.totalPot.toFixed(2)}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            O bolo do mês é repartido pelo percentual de serviços que cada camareira concluiu (troca, arrumação,
            somente saída, somente chegada, saída com chegada), como se todas tivessem nota 10. O bolo ainda está se
            formando dia a dia. É só uma estimativa informativa; as notas de cada camareira entram no cálculo do mês
            anterior, abaixo.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camareira</TableHead>
                  <TableHead className="text-right">% de serviços (mês)</TableHead>
                  <TableHead className="text-right">Comissão estimada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimate.rows.map((r) => (
                  <TableRow key={r.camareira_id}>
                    <TableCell>{r.camareira_name}</TableCell>
                    <TableCell className="text-right">{r.service_percentage.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">R$ {r.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {estimate.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhuma camareira ativa cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {estimate.rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-medium">
                      Total do bolo (mês até hoje)
                    </TableCell>
                    <TableCell className="text-right font-medium">R$ {totalEstimate.toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-sm font-medium">Mês anterior ({monthYearLabelPt(demonstrativo.periodEnd)})</p>
          <p className="text-xs text-muted-foreground">
            O mês anterior é o mês calendário completo (do dia 1º ao último dia). A nota de cada camareira é editada aqui mesmo e é a usada no cálculo deste período (começa em
            10); mudar a nota de uma não altera a comissão das outras. Não há mais botão de calcular: os valores são
            atualizados na hora.
          </p>
          <p className="text-sm">
            Bolo de comissão do mês anterior (se todas tivessem nota 10): <strong>R$ {demonstrativo.pot.toFixed(2)}</strong>
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camareira</TableHead>
                  <TableHead className="text-right">% serviços</TableHead>
                  <TableHead>Nota usada</TableHead>
                  <TableHead className="text-right">Suítes e Café</TableHead>
                  <TableHead className="text-right">Bar</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demonstrativo.rows.map((r) => (
                  <TableRow key={r.camareira_id}>
                    <TableCell>{r.camareira_name}</TableCell>
                    <TableCell className="text-right">{r.service_percentage.toFixed(1)}%</TableCell>
                    <TableCell>
                      <QuantityStepper
                        value={r.score}
                        min={0}
                        max={10}
                        disabled={isPending}
                        onChange={(v) => updateClosedScore(r.camareira_id, r.camareira_name, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">R$ {r.suites_cafe_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {r.bar_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {r.total_amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {demonstrativo.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhuma camareira com serviço neste período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Total geral
                  </TableCell>
                  <TableCell className="text-right font-medium">R$ {demonstrativo.totalSuitesCafe.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">R$ {demonstrativo.totalBar.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">R$ {demonstrativo.grandTotal.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href="/api/dashboard/commission-statement" target="_blank" rel="noreferrer">
                  <Download size={14} /> Baixar PDF
                </a>
              }
            />
            <Button variant="outline" disabled={isPending} onClick={sendEmail}>
              <Mail size={14} /> Enviar por e-mail
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

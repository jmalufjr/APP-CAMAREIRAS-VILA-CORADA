"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateCamareiraServiceScore,
  calculatePreviousMonthCommissionStatement,
  sendCommissionStatementEmail,
  type SuitesCafeEstimateRow,
  type CommissionStatement,
} from "@/lib/actions/commission";
import { updateCommissionValue } from "@/lib/actions/tables";
import type { CommissionSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Download, Mail } from "lucide-react";

function monthLabelPt(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function SuitesCafeCommissionPanel({
  commission,
  estimate,
  demonstrativo,
  currentMonthLabel,
}: {
  commission: CommissionSettings;
  estimate: { rows: SuitesCafeEstimateRow[]; totalPot: number };
  demonstrativo: CommissionStatement | null;
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

  function updateScore(camareiraId: string, score: number) {
    startTransition(async () => {
      const result = await updateCamareiraServiceScore(camareiraId, score);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function calculatePreviousMonth() {
    startTransition(async () => {
      const result = await calculatePreviousMonthCommissionStatement();
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Comissão do mês passado calculada.");
        router.refresh();
      }
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
          <p className="text-xs text-muted-foreground">
            O peso de cada camareira é a média entre o percentual de serviços que ela concluiu no mês (troca,
            arrumação, somente saída, somente chegada, saída com chegada) e o percentual de sua nota em relação à
            soma de todas as notas — aplicado sobre o pote do mês, que ainda está se formando dia a dia. Só vira
            valor oficial e recebível quando o mês vira e o botão &ldquo;Calcular comissão do mês passado&rdquo; é
            clicado.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camareira</TableHead>
                  <TableHead className="text-right">% de serviços (mês)</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Comissão estimada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimate.rows.map((r) => (
                  <TableRow key={r.camareira_id}>
                    <TableCell>{r.camareira_name}</TableCell>
                    <TableCell className="text-right">{r.service_percentage.toFixed(1)}%</TableCell>
                    <TableCell>
                      <QuantityStepper
                        value={r.score}
                        min={0}
                        max={10}
                        disabled={isPending}
                        onChange={(v) => updateScore(r.camareira_id, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">R$ {r.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {estimate.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma camareira ativa cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {estimate.rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-medium">
                      Total do pote (mês até hoje)
                    </TableCell>
                    <TableCell className="text-right font-medium">R$ {totalEstimate.toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-sm font-medium">Fechamento do mês passado</p>
          <p className="text-xs text-muted-foreground">
            Ao clicar, a nota de cada camareira é capturada exatamente como está neste momento, e combinada com o
            percentual de serviços e o pote já fechados do mês passado — o resultado fica salvo até você clicar de
            novo (por exemplo, depois de corrigir alguma nota).
          </p>
          <Button variant="outline" disabled={isPending} onClick={calculatePreviousMonth}>
            Calcular comissão do mês passado
          </Button>

          {demonstrativo ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">{monthLabelPt(demonstrativo.month)}</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Camareira</TableHead>
                      <TableHead className="text-right">% serviços</TableHead>
                      <TableHead className="text-right">Nota usada</TableHead>
                      <TableHead className="text-right">Suítes e Café</TableHead>
                      <TableHead className="text-right">Bar</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demonstrativo.rows.map((r) => (
                      <TableRow key={r.camareira_name}>
                        <TableCell>{r.camareira_name}</TableCell>
                        <TableCell className="text-right">{r.service_percentage.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{r.score}</TableCell>
                        <TableCell className="text-right">R$ {r.suites_cafe_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {r.bar_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {r.total_amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
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
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não calculado para o mês passado. Clique no botão acima para gerar o demonstrativo.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

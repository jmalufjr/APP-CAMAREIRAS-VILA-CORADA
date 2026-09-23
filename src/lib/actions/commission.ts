"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { nowInBrazil, toDateKey, todayKey, monthYearLabelPt, nextDayBrasiliaUtcBoundary } from "@/lib/date";
import { getBreakfastCommissionPotForRange } from "@/lib/actions/breakfast-commission";
import { getBarCommissionByCamareiraForPeriod } from "@/lib/actions/comandas";
import { getReceiptSettings } from "@/lib/actions/room-bills";
import { renderCommissionStatementPdf } from "@/lib/commission-statement-pdf";
import {
  computeWeightedSuitesCafeCommission,
  closedPeriodRange,
  EXCLUDED_CAMAREIRA_NAME,
  type CamareiraWeightInput,
} from "@/lib/commission-math";

// ---------- Leitura: camareiras do período + serviços concluídos ----------

type CamareiraRosterRow = { id: string; name: string; service_quality_score: number };

// Todas as camareiras ATIVAS hoje que já existiam até o fim do período
// pedido, mais qualquer camareira que já desligou mas tem algum serviço
// concluído no período pedido — uma camareira que saiu da equipe não
// pode sumir do histórico só porque não é mais usuária do sistema (ela
// continua "existindo" nas tabelas, demonstrativos e relatórios de
// comissão referentes a quando trabalhou). Na direção contrária, uma
// camareira cadastrada DEPOIS do fim do período consultado não pode
// aparecer num período em que ela nem existia ainda — na comissão de
// suítes e café, isso diluiria indevidamente a nota dela na fatia de
// quem realmente trabalhou naquele período (a comissão de bar não sofre
// desse problema, por nunca repartir um pote comum entre todas — é
// sempre 10% direto do que a própria camareira vendeu). "admin-camareira"
// é a única exceção: é conta de teste/ajuste do admin, nunca uma
// camareira de verdade, e nunca entra em nada disso (ver
// EXCLUDED_CAMAREIRA_NAME).
async function getCamareiraRoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string
): Promise<CamareiraRosterRow[]> {
  const [{ data: active }, { data: taskRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, service_quality_score")
      .eq("role", "camareira")
      .eq("active", true)
      .neq("name", EXCLUDED_CAMAREIRA_NAME)
      // created_at é um instante real (timestamptz) — comparar contra
      // `${to}T23:59:59` ingenuamente erraria por até 3h, já que Brasília
      // é UTC-3 (ver nextDayBrasiliaUtcBoundary).
      .lt("created_at", nextDayBrasiliaUtcBoundary(to)),
    supabase
      .from("daily_room_tasks")
      .select("assigned_to, profiles!daily_room_tasks_assigned_to_fkey(name, service_quality_score)")
      .eq("status", "concluido")
      .gte("date", from)
      .lte("date", to)
      .not("assigned_to", "is", null),
  ]);

  const map = new Map<string, CamareiraRosterRow>();
  (active ?? []).forEach((c) => map.set(c.id, c));
  (
    (taskRows ?? []) as unknown as {
      assigned_to: string | null;
      profiles: { name: string; service_quality_score: number } | null;
    }[]
  ).forEach((t) => {
    if (!t.assigned_to || map.has(t.assigned_to)) return;
    const name = t.profiles?.name;
    if (!name || name === EXCLUDED_CAMAREIRA_NAME) return;
    map.set(t.assigned_to, {
      id: t.assigned_to,
      name,
      service_quality_score: t.profiles?.service_quality_score ?? 5,
    });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function getServiceCountsByCamareira(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("daily_room_tasks")
    .select("assigned_to")
    .eq("status", "concluido")
    .gte("date", from)
    .lte("date", to)
    .not("assigned_to", "is", null);

  const map = new Map<string, number>();
  (data ?? []).forEach((t) => {
    if (!t.assigned_to) return;
    map.set(t.assigned_to, (map.get(t.assigned_to) ?? 0) + 1);
  });
  return map;
}

// ---------- Nota de qualidade do serviço (editável pelo admin) ----------

export async function updateCamareiraServiceScore(camareiraId: string, score: number) {
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return { error: "Nota inválida — precisa ser um número inteiro entre 0 e 10." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ service_quality_score: score })
    .eq("id", camareiraId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/comissoes");
  return { success: true };
}

// ---------- Estimativa ao vivo do mês corrente ----------

export interface SuitesCafeEstimateRow {
  camareira_id: string;
  camareira_name: string;
  service_percentage: number;
  score: number;
  amount: number;
}

// Estimativa do mês corrente: percentual de serviços acumulado até hoje ×
// pote do mês corrente (também ainda se formando) — os dois sempre do
// mesmo período, então não há descompasso entre "quanto ela fez" e "sobre
// que valor". Muda dia a dia; é só informativa — o valor oficialmente
// pago é sempre o do "último período fechado" (ver
// calculateClosedPeriodCommissionStatement), que fecha no dia 25, não no
// fim do mês.
export async function getSuitesCafeCurrentMonthEstimate(): Promise<{
  rows: SuitesCafeEstimateRow[];
  totalPot: number;
}> {
  const supabase = await createClient();
  const now = nowInBrazil();
  const monthStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const today = todayKey();

  const [camareiras, serviceCounts, totalPot] = await Promise.all([
    getCamareiraRoster(supabase, monthStart, today),
    getServiceCountsByCamareira(supabase, monthStart, today),
    getBreakfastCommissionPotForRange(monthStart, today),
  ]);

  const inputs: CamareiraWeightInput[] = camareiras.map((c) => ({
    camareiraId: c.id,
    camareiraName: c.name,
    serviceCount: serviceCounts.get(c.id) ?? 0,
    score: c.service_quality_score,
  }));
  const results = computeWeightedSuitesCafeCommission(inputs, totalPot);

  return {
    rows: results.map((r) => ({
      camareira_id: r.camareiraId,
      camareira_name: r.camareiraName,
      service_percentage: r.servicePercent,
      score: r.score,
      amount: r.amount,
    })),
    totalPot,
  };
}

// ---------- Fechamento do último período (botão "Calcular") ----------

// Calcula e grava (substituindo qualquer cálculo anterior do mesmo
// período) o demonstrativo de comissão de serviços nas suítes e no café
// do último período fechado — fecha sempre no dia 25 (não no fim do mês
// calendário), pra dar tempo de conferir e pagar antes do mês virar (ver
// closedPeriodRange). Captura a nota de cada camareira NO MOMENTO deste
// clique, aplicada sobre o percentual de serviços e o pote do período já
// fechado — os dois já naturalmente estáveis, não precisam de
// congelamento próprio.
export async function calculateClosedPeriodCommissionStatement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { periodEnd, start, end } = closedPeriodRange(nowInBrazil());

  const [camareiras, serviceCounts, totalPot] = await Promise.all([
    getCamareiraRoster(supabase, start, end),
    getServiceCountsByCamareira(supabase, start, end),
    getBreakfastCommissionPotForRange(start, end),
  ]);

  const inputs: CamareiraWeightInput[] = camareiras.map((c) => ({
    camareiraId: c.id,
    camareiraName: c.name,
    serviceCount: serviceCounts.get(c.id) ?? 0,
    score: c.service_quality_score,
  }));
  const results = computeWeightedSuitesCafeCommission(inputs, totalPot);

  const { error: deleteError } = await supabase
    .from("commission_statements")
    .delete()
    .eq("period_end", periodEnd);
  if (deleteError) return { error: deleteError.message };

  if (results.length > 0) {
    const { error: insertError } = await supabase.from("commission_statements").insert(
      results.map((r) => ({
        period_end: periodEnd,
        camareira_id: r.camareiraId,
        camareira_name: r.camareiraName,
        service_percentage: r.servicePercent,
        score: r.score,
        suites_cafe_amount: r.amount,
        generated_by: user?.id ?? null,
      }))
    );
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/dashboard/comissoes");
  return { success: true, periodEnd };
}

export interface CommissionStatementRow {
  camareira_id: string | null;
  camareira_name: string;
  service_percentage: number;
  score: number;
  suites_cafe_amount: number;
  bar_amount: number;
  total_amount: number;
}

export interface CommissionStatement {
  periodEnd: string;
  generatedAt: string;
  rows: CommissionStatementRow[];
  totalSuitesCafe: number;
  totalBar: number;
  grandTotal: number;
}

// Demonstrativo já calculado do último período fechado (relativo a hoje)
// — combina as linhas congeladas de commission_statements (comissão de
// suítes e café, com a nota capturada no momento do cálculo) com a
// comissão de bar do mesmo período, recalculada ao vivo (também estável
// pra um período fechado, não precisa de congelamento próprio). Retorna
// null se o botão "Calcular comissão do último período" ainda não foi
// clicado depois do fechamento desse período.
export async function getClosedPeriodDemonstrativo(): Promise<CommissionStatement | null> {
  const supabase = await createClient();
  const { periodEnd, start, end } = closedPeriodRange(nowInBrazil());

  const { data: statementRows } = await supabase
    .from("commission_statements")
    .select("*")
    .eq("period_end", periodEnd)
    .order("camareira_name");
  if (!statementRows || statementRows.length === 0) return null;

  const barRows = await getBarCommissionByCamareiraForPeriod(start, end);
  const barByName = new Map(barRows.map((r) => [r.camareira_name, r.commission]));

  const rows: CommissionStatementRow[] = statementRows.map((r) => {
    const barAmount = barByName.get(r.camareira_name) ?? 0;
    const suitesCafeAmount = Number(r.suites_cafe_amount);
    return {
      camareira_id: r.camareira_id,
      camareira_name: r.camareira_name,
      service_percentage: Number(r.service_percentage),
      score: r.score,
      suites_cafe_amount: suitesCafeAmount,
      bar_amount: barAmount,
      total_amount: suitesCafeAmount + barAmount,
    };
  });

  return {
    periodEnd,
    generatedAt: statementRows[0].generated_at,
    rows,
    totalSuitesCafe: rows.reduce((sum, r) => sum + r.suites_cafe_amount, 0),
    totalBar: rows.reduce((sum, r) => sum + r.bar_amount, 0),
    grandTotal: rows.reduce((sum, r) => sum + r.total_amount, 0),
  };
}

// ---------- Histórico: comissão de suítes e café por período arbitrário ----------

export interface SuitesCafeCommissionByCamareiraRow {
  camareira_name: string;
  amount: number;
}

// Mesma fórmula de peso (% serviços + % notas, em média) aplicada a um
// período arbitrário escolhido no filtro do Histórico — sempre ao vivo,
// com a nota atual de cada camareira (diferente do demonstrativo do botão
// "Calcular", que é um retrato pontual de um período inteiro fechado).
export async function getSuitesCafeCommissionForPeriod(
  from: string,
  to: string
): Promise<SuitesCafeCommissionByCamareiraRow[]> {
  const supabase = await createClient();
  const [camareiras, serviceCounts, totalPot] = await Promise.all([
    getCamareiraRoster(supabase, from, to),
    getServiceCountsByCamareira(supabase, from, to),
    getBreakfastCommissionPotForRange(from, to),
  ]);

  const inputs: CamareiraWeightInput[] = camareiras.map((c) => ({
    camareiraId: c.id,
    camareiraName: c.name,
    serviceCount: serviceCounts.get(c.id) ?? 0,
    score: c.service_quality_score,
  }));
  const results = computeWeightedSuitesCafeCommission(inputs, totalPot);
  return results.map((r) => ({ camareira_name: r.camareiraName, amount: r.amount }));
}

// ---------- Envio do demonstrativo por e-mail ----------

// Reaproveita o mesmo "e-mail de envio" cadastrado pra receber o recibo em
// PDF de conta paga (ver room-bills.ts) — mesmo padrão de envio (Resend),
// mas aqui não é "melhor esforço" silencioso: o admin clica um botão
// explícito e recebe o resultado na hora via toast.
export async function sendCommissionStatementEmail() {
  const demonstrativo = await getClosedPeriodDemonstrativo();
  if (!demonstrativo) return { error: "Calcule a comissão do último período antes de enviar." };

  const { accounting_email: accountingEmail } = await getReceiptSettings();
  if (!accountingEmail) return { error: "Cadastre o e-mail de envio antes (menu \"Cadastrar e-mail de envio\")." };

  try {
    const pdfBuffer = await renderCommissionStatementPdf(demonstrativo);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const label = monthYearLabelPt(demonstrativo.periodEnd);
    const { error } = await resend.emails.send({
      from: process.env.RECEIPT_FROM_EMAIL ?? "Vila Corada <recibos@consumos.vilacorada.com.br>",
      to: accountingEmail,
      subject: `Comissões das camareiras — Último período (${label})`,
      text: `Segue em anexo o demonstrativo de comissões das camareiras do último período fechado (${label}).`,
      attachments: [
        { filename: `comissoes-${demonstrativo.periodEnd}.pdf`, content: pdfBuffer },
      ],
    });
    if (error) return { error: "Falha ao enviar o e-mail. Verifique o endereço cadastrado e tente novamente." };
    return { success: true };
  } catch {
    return { error: "Falha ao enviar o e-mail. Verifique o endereço cadastrado e tente novamente." };
  }
}

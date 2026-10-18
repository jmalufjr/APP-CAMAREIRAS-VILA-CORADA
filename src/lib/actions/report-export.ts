"use server";

import { createClient } from "@/lib/supabase/server";
import { buildCsv, buildPdf, buildRtf, buildXlsx, REPORT_MIME } from "@/lib/report-export";
import type { ReportFormat, ReportPayload } from "@/lib/report-export";

// Gera o arquivo de um relatório no formato pedido e devolve em base64
// pro navegador baixar. Só admin (os relatórios contábeis são dele).
export async function exportReport(
  format: ReportFormat,
  payload: ReportPayload
): Promise<{ error: string } | { filename: string; mime: string; base64: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Sem permissão." };

  try {
    const buffer =
      format === "csv" ? buildCsv(payload) : format === "xlsx" ? await buildXlsx(payload) : format === "rtf" ? buildRtf(payload) : await buildPdf(payload);
    return { filename: `${payload.filenameBase}.${format}`, mime: REPORT_MIME[format], base64: buffer.toString("base64") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao gerar o arquivo." };
  }
}

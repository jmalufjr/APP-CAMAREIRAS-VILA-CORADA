import { createAdminClient } from "@/lib/supabase/admin";

export const EXPENSE_RECEIPTS_BUCKET = "expense-receipts";

// Mesmo espírito do bucket de fotos de ocorrência (Parte 48): privado,
// leitura sempre por URL assinada gerada na hora, nunca um link
// permanente. Válida por 1h, suficiente pra abrir o comprovante na tela.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Extensão derivada do tipo real do arquivo — antes era sempre ".jpg"
// mesmo pra um PDF, o que confundia quem baixasse o arquivo (o
// Content-Type servido já saía certo, só o nome do arquivo salvo ficava
// errado).
function extensionForMimeType(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadExpenseReceipt(expenseId: string, file: File): Promise<string> {
  const admin = createAdminClient();
  const contentType = file.type || "image/jpeg";
  const path = `${expenseId}.${extensionForMimeType(contentType)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(EXPENSE_RECEIPTS_BUCKET).upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export async function signExpenseReceiptUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(EXPENSE_RECEIPTS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

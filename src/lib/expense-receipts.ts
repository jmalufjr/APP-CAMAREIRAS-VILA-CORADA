import { createAdminClient } from "@/lib/supabase/admin";

export const EXPENSE_RECEIPTS_BUCKET = "expense-receipts";

// Mesmo espírito do bucket de fotos de ocorrência (Parte 48): privado,
// leitura sempre por URL assinada gerada na hora, nunca um link
// permanente. Válida por 1h, suficiente pra abrir o comprovante na tela.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadExpenseReceipt(expenseId: string, file: File): Promise<string> {
  const admin = createAdminClient();
  const path = `${expenseId}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(EXPENSE_RECEIPTS_BUCKET)
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export async function signExpenseReceiptUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(EXPENSE_RECEIPTS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

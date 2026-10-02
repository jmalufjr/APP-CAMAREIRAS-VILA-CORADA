"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export interface ParsedReceiptItem {
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export interface ParsedReceipt {
  supplier_name: string | null;
  payment_method: string | null; // um de PAYMENT_METHOD_OPTIONS, ou null se não identificado
  date: string | null; // "YYYY-MM-DD", se legível na nota
  total_amount: number | null;
  items: ParsedReceiptItem[];
}

const SYSTEM_PROMPT = `Você lê fotos de notas fiscais, cupons fiscais e comprovantes de pagamento
de uma pousada brasileira e devolve SOMENTE um JSON (sem texto antes ou
depois, sem bloco de código markdown) no formato:

{
  "supplier_name": string ou null,
  "payment_method": um destes valores ou null: "pix", "cartao_credito", "cartao_debito", "transferencia_bancaria", "dinheiro", "boleto",
  "date": "YYYY-MM-DD" ou null,
  "total_amount": número ou null,
  "items": [
    { "description": string, "quantity": número, "unit_cost": número, "subtotal": número }
  ]
}

Regras:
- Se a imagem tiver vários itens (cupom de mercado, por exemplo), liste
  cada um separadamente em "items".
- Se não der pra separar itens (ex.: um comprovante de maquininha de
  cartão só com o valor total, ou uma conta de luz/água), devolva
  "items" como lista vazia e preencha "total_amount".
- "payment_method": procure por palavras como PIX, DÉBITO, CRÉDITO,
  DINHEIRO, BOLETO no documento. Se não houver nenhuma indicação clara,
  devolva null — nunca invente.
- Nunca invente valores que não conseguir ler com confiança — prefira
  null a um palpite errado.`;

// Lê a foto de uma nota/recibo e devolve os campos sugeridos pra revisão
// humana — nunca salva nada sozinho (ver createExpense em expenses.ts,
// chamada só depois que a pessoa confirma/corrige o que foi lido aqui).
// "Melhor esforço": se a chave da API não estiver configurada ou a
// chamada falhar, devolve um erro claro em vez de travar o lançamento —
// a pessoa sempre pode preencher tudo manualmente.
export async function parseReceiptWithAI(formData: FormData): Promise<{ error: string } | { success: true; data: ParsedReceipt }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error:
        "Leitura automática de nota não está configurada neste ambiente (falta ANTHROPIC_API_KEY). Preencha os campos manualmente.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma foto da nota/recibo." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Leia esta nota/recibo/comprovante e devolva o JSON pedido." },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: "A IA não devolveu nenhum texto legível." };

    // Remove um eventual bloco de código markdown, caso o modelo insista
    // em envolver o JSON com ```json apesar da instrução de não fazer isso.
    const cleaned = textBlock.text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedReceipt;

    return {
      success: true,
      data: {
        supplier_name: parsed.supplier_name ?? null,
        payment_method: parsed.payment_method ?? null,
        date: parsed.date ?? null,
        total_amount: parsed.total_amount ?? null,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      },
    };
  } catch (e) {
    return {
      error: `Não foi possível ler a imagem automaticamente (${(e as Error).message}). Preencha os campos manualmente.`,
    };
  }
}

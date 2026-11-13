// Leitura de nota/recibo + texto explicativo do WhatsApp, no modelo simplificado.
// Não é "use server": chamado só por Server Actions. Nunca grava nada.

import Anthropic from "@anthropic-ai/sdk";
import { ingredientKindForCategory } from "@/lib/expense-model-types";

export interface AiCategory {
  id: string;
  name: string;
  rule: string;
  allows_ingredient?: boolean;
}
export interface AiIngredient {
  id: string;
  name: string;
  kind?: string;
}

export interface AiPurchaseLine {
  description: string;
  quantity: number;
  amount: number;
  category_id: string | null;
  ingredient_id: string | null;
  useful_life_months: number | null;
}

export interface AiPurchase {
  supplier_name: string | null;
  payment_method: string | null;
  date: string | null;
  document_number: string | null;
  total_amount: number | null;
  // Só preenchido na primeira importação (sugestão inicial de itens recorrentes).
  recurring?: boolean;
  lines: AiPurchaseLine[];
}

const PAYMENT_METHODS = ["pix", "dinheiro", "cartao_debito", "cartao_credito", "transferencia", "boleto"];

const SYSTEM = `Você lê notas fiscais, cupons e comprovantes de uma pousada brasileira e devolve SOMENTE um JSON
(sem texto antes ou depois, sem bloco markdown) neste formato:

{
  "supplier_name": string ou null,
  "payment_method": "pix" | "dinheiro" | "cartao_debito" | "cartao_credito" | "transferencia" | "boleto" | null,
  "date": "YYYY-MM-DD" ou null,
  "document_number": string ou null,
  "total_amount": número ou null,
  "lines": [
    { "description": string, "quantity": número, "amount": número,
      "category_index": número ou null, "ingredient_index": número ou null,
      "useful_life_months": número ou null }
  ]
}

Regras:
- Cada item da nota vira uma linha; "amount" é o VALOR TOTAL da linha (quantidade × preço).
- Se não der para separar itens (conta de luz, água, gás, comprovante só com valor), devolva UMA linha com o total.
- "category_index": o número da categoria de despesa mais adequada, SEMPRE entre as listadas. Use o TEXTO que acompanha a nota como pista principal (ex.: "material de limpeza", "para o bar").
- "ingredient_index": SOMENTE para itens de alimento ou bebida que sejam um dos ingredientes de produtos de bar listados (mesmo produto, mesmo com marca/abreviação diferente; ex.: cachaça, vodka, gim, água tônica, limão); se não houver correspondência na lista, null (o item segue só pela categoria de despesa).
- "useful_life_months": só para bem durável (eletrodoméstico, equipamento, móvel): sua melhor estimativa da vida útil em meses; senão null.
- "payment_method" é como A POUSADA pagou. Sem indicação clara, null.
- "date": a data da compra impressa na nota; se não houver, null. Nunca invente valores: prefira null.`;

const numbered = (list: string[]) => list.map((n, i) => `${i + 1}. ${n}`).join("\n") || "(nenhum)";

export async function readPurchaseWithAI(opts: {
  image: { base64: string; mediaType: string } | null;
  text: string;
  categories: AiCategory[];
  ingredients: AiIngredient[];
  detectRecurring?: boolean;
}): Promise<{ error: string } | { data: AiPurchase }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Leitura automática não configurada (falta ANTHROPIC_API_KEY)." };

  const recurringRule = opts.detectRecurring
    ? `

EXTRA: acrescente ao JSON o campo "recurring": true SOMENTE se for uma despesa que normalmente se repete todo mês (energia, água, gás, internet, telefone, aluguel, mensalidades e assinaturas, salários, honorários de contador ou de serviços, tráfego pago, impostos mensais); compra de mercadoria ou material é false.`
    : "";

  const system = `${SYSTEM}${recurringRule}

CATEGORIAS DE DESPESA (para "category_index"):
${numbered(opts.categories.map((c) => c.name))}

INGREDIENTES de produtos de bar (para "ingredient_index"):
${numbered(opts.ingredients.map((i) => i.name))}`;

  type Block =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };
  const content: Block[] = [];
  if (opts.image) {
    if (opts.image.mediaType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.image.base64 } });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: opts.image.mediaType as "image/jpeg" | "image/png" | "image/webp", data: opts.image.base64 },
      });
    }
  }
  content.push({
    type: "text",
    text: opts.text.trim()
      ? `Mensagem de quem comprou, enviada junto com a nota:\n"""${opts.text.trim()}"""\n\nLeia e devolva o JSON pedido.`
      : "Leia a nota e devolva o JSON pedido.",
  });

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content }],
    });
    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { error: "A IA não devolveu texto legível." };
    const cleaned = block.text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();

    type Raw = {
      supplier_name?: string | null;
      payment_method?: string | null;
      date?: string | null;
      document_number?: string | null;
      total_amount?: number | null;
      lines?: {
        description?: string;
        quantity?: number;
        amount?: number;
        category_index?: number | null;
        ingredient_index?: number | null;
        useful_life_months?: number | null;
      }[];
    };
    const parsed = JSON.parse(cleaned) as Raw;
    const pick = <T,>(list: T[], idx: number | null | undefined): T | null =>
      typeof idx === "number" && Number.isInteger(idx) ? (list[idx - 1] ?? null) : null;

    const lines: AiPurchaseLine[] = (Array.isArray(parsed.lines) ? parsed.lines : []).map((l) => {
      let cat = pick(opts.categories, l.category_index);
      const ing = pick(opts.ingredients, l.ingredient_index);
      // O ingrediente é uma identificação precisa; a categoria é uma estimativa.
      // Se divergirem, a categoria passa a ser a do tipo do ingrediente.
      if (ing?.kind) {
        const needKind = ingredientKindForCategory(cat);
        if (needKind !== ing.kind) {
          const fix = opts.categories.find((c) =>
            ing.kind === "alimento" ? c.rule === "alimentos" : ing.kind === "demais_bebidas" ? c.rule === "bebidas" : c.name.trim().toLowerCase() === "bebidas quentes"
          );
          if (fix) cat = fix;
        }
      }
      return {
        description: String(l.description ?? "").trim(),
        quantity: Number(l.quantity) > 0 ? Number(l.quantity) : 1,
        amount: Number(l.amount) || 0,
        category_id: cat?.id ?? null,
        ingredient_id: ing?.id ?? null,
        useful_life_months: Number.isInteger(l.useful_life_months) && Number(l.useful_life_months) > 0 ? Number(l.useful_life_months) : null,
      };
    });

    return {
      data: {
        supplier_name: parsed.supplier_name?.toString().trim() || null,
        payment_method: parsed.payment_method && PAYMENT_METHODS.includes(parsed.payment_method) ? parsed.payment_method : null,
        date: parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
        document_number: parsed.document_number?.toString().trim() || null,
        total_amount: typeof parsed.total_amount === "number" ? parsed.total_amount : null,
        recurring: opts.detectRecurring ? (parsed as { recurring?: unknown }).recurring === true : undefined,
        lines,
      },
    };
  } catch (e) {
    return { error: `Não foi possível ler automaticamente (${(e as Error).message}).` };
  }
}

"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export interface ParsedReceiptItem {
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  // "produto" = material de consumo/estoque; "ativo" = bem durável do ativo permanente
  // (eletrodoméstico, equipamento, ferramenta, móvel...).
  kind: "produto" | "ativo";
  // Produto JÁ cadastrado que a IA julgou ser o mesmo item (null = nenhum com confiança).
  matched_cost_item_id: string | null;
  // Bem do catálogo de ativo permanente já cadastrado (só quando kind = "ativo").
  matched_asset_catalog_item_id: string | null;
  // Para um item SEM correspondência: categoria sugerida (de produto se kind = "produto",
  // de ativo permanente se kind = "ativo") e um nome limpo para o cadastro novo.
  suggested_category_id: string | null;
  suggested_name: string | null;
}

export interface ParsedReceipt {
  supplier_name: string | null;
  // banco_pix | dinheiro | cartao_debito | cartao_credito | a_prazo, ou null se não identificado.
  payment_method: string | null;
  date: string | null; // "YYYY-MM-DD", se legível na nota
  document_number: string | null; // número da nota/cupom fiscal, se impresso
  total_amount: number | null;
  items: ParsedReceiptItem[];
}

const BASE_SYSTEM_PROMPT = `Você lê fotos ou PDFs de notas fiscais, cupons fiscais e comprovantes de
pagamento de uma pousada brasileira e devolve SOMENTE um JSON (sem texto antes ou
depois, sem bloco de código markdown) no formato:

{
  "supplier_name": string ou null,
  "payment_method": um destes valores ou null: "banco_pix", "dinheiro", "cartao_debito", "cartao_credito", "a_prazo",
  "date": "YYYY-MM-DD" ou null,
  "document_number": string ou null,
  "total_amount": número ou null,
  "items": [
    {
      "description": string, "quantity": número, "unit_cost": número, "subtotal": número,
      "kind": "produto" ou "ativo",
      "matched_catalog_index": número ou null,
      "matched_asset_index": número ou null,
      "category_index": número ou null,
      "suggested_name": string ou null
    }
  ]
}

Regras:
- Se a imagem tiver vários itens (cupom de mercado, por exemplo), liste cada um separadamente em "items".
- Se não der pra separar itens (ex.: comprovante de maquininha só com o valor total, ou conta de
  luz/água), devolva "items" como lista vazia e preencha "total_amount".
- "payment_method": é a forma como A POUSADA pagou o fornecedor (nunca a forma de pagamento de hóspede).
  "banco_pix" cobre PIX, transferência bancária e boleto já pago; "dinheiro" é dinheiro em espécie;
  "cartao_debito" e "cartao_credito" são o cartão da empresa; "a_prazo" só quando o documento deixa
  claro que ainda NÃO foi pago (ex.: boleto com vencimento futuro). Sem indicação clara, null.
- "document_number": o número da nota/cupom/NFC-e impresso (não o link). null se não houver.
- "kind": "ativo" SOMENTE para bens duráveis que ficam no patrimônio da pousada (eletrodoméstico,
  máquina, equipamento, ferramenta durável, móvel...). Material de consumo, alimento, bebida, limpeza,
  descartável, peça de reposição barata etc. é "produto".
- "matched_catalog_index" (só kind "produto"): número do PRODUTO já cadastrado (lista abaixo) que seja o
  MESMO produto do item, mesmo que a descrição na nota seja diferente (marca, abreviação, variação de
  escrita; ex.: "água mineral s/gás Indaiá 500ml" = "Água mineral sem gás"). Só devolva um número com
  confiança real de que é o MESMO produto; na dúvida, null.
- "matched_asset_index" (só kind "ativo"): número do BEM já cadastrado no catálogo de ativo permanente
  (lista abaixo) que seja o mesmo bem. Na dúvida, null.
- "category_index": use SOMENTE quando o item NÃO tiver correspondência (os dois "matched" null): o
  número da categoria mais adequada — da lista de CATEGORIAS DE PRODUTO se kind "produto", ou da lista de
  CATEGORIAS DE ATIVO PERMANENTE se kind "ativo". Nunca invente categoria: escolha entre as listadas;
  se nenhuma servir, null.
- "suggested_name": só quando não houver correspondência: um nome curto e limpo para cadastrar o item
  (ex.: "ÁGUA MIN SG 500ML IND" -> "Água mineral sem gás"), sem marca/volume desnecessários, com
  inicial maiúscula e sem abreviações. null se não houver correspondência... ou se a descrição já for boa.
- Nunca invente valores que não conseguir ler com confiança — prefira null a um palpite errado.`;

function numbered(list: string[]): string {
  return list.map((name, idx) => `${idx + 1}. ${name}`).join("\n") || "(nenhum)";
}

// Lê a foto de uma nota/recibo e devolve os dados e as sugestões de enquadramento de cada
// item (produto/bem já cadastrado, ou categoria para um cadastro novo). Nunca grava nada —
// a gravação é feita depois, ao confirmar (ver createReceiptPurchase). "Melhor esforço": sem
// chave da API ou com falha na chamada, devolve um erro claro; a pessoa sempre pode inserir
// manualmente.
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
        "Leitura automática de nota não está configurada neste ambiente (falta ANTHROPIC_API_KEY). Use “Inserir manualmente”.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma foto ou um PDF da nota/recibo." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = file.type || "image/jpeg";
  const isPdf = mediaType === "application/pdf";

  // Listas numeradas: o modelo devolve só o número (menos sujeito a erro que ecoar um UUID).
  const [{ data: productData }, { data: assetCatalogData }, { data: productCatData }, { data: assetCatData }] =
    await Promise.all([
      supabase.from("cost_items").select("id, name").eq("is_product", true).eq("active", true).order("name"),
      supabase.from("fixed_asset_catalog_items").select("id, name, category_id").eq("active", true).order("name"),
      supabase.from("product_categories").select("id, name").eq("active", true).order("position").order("name"),
      supabase.from("asset_categories").select("id, name").eq("active", true).order("name"),
    ]);
  const products = (productData ?? []) as { id: string; name: string }[];
  const assetCatalog = (assetCatalogData ?? []) as { id: string; name: string; category_id: string }[];
  const productCategories = (productCatData ?? []) as { id: string; name: string }[];
  const assetCategories = (assetCatData ?? []) as { id: string; name: string }[];

  const systemPrompt = `${BASE_SYSTEM_PROMPT}

PRODUTOS cadastrados (para "matched_catalog_index"):
${numbered(products.map((p) => p.name))}

BENS do catálogo de ativo permanente (para "matched_asset_index"):
${numbered(assetCatalog.map((a) => a.name))}

CATEGORIAS DE PRODUTO (para "category_index" quando kind "produto"):
${numbered(productCategories.map((c) => c.name))}

CATEGORIAS DE ATIVO PERMANENTE (para "category_index" quando kind "ativo"):
${numbered(assetCategories.map((c) => c.name))}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
              : {
                  type: "image",
                  source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp", data: base64 },
                },
            { type: "text", text: "Leia esta nota/recibo/comprovante e devolva o JSON pedido." },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: "A IA não devolveu nenhum texto legível." };

    const cleaned = textBlock.text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    type RawItem = {
      description: string;
      quantity: number;
      unit_cost: number;
      subtotal: number;
      kind?: string;
      matched_catalog_index?: number | null;
      matched_asset_index?: number | null;
      category_index?: number | null;
      suggested_name?: string | null;
    };
    const parsed = JSON.parse(cleaned) as {
      supplier_name?: string | null;
      payment_method?: string | null;
      date?: string | null;
      document_number?: string | null;
      total_amount?: number | null;
      items?: RawItem[];
    };

    const allowedPayment = ["banco_pix", "dinheiro", "cartao_debito", "cartao_credito", "a_prazo"];
    const pick = <T,>(list: T[], idx: number | null | undefined): T | undefined =>
      typeof idx === "number" && Number.isInteger(idx) ? list[idx - 1] : undefined;

    const items: ParsedReceiptItem[] = (Array.isArray(parsed.items) ? parsed.items : []).map((i) => {
      const kind: "produto" | "ativo" = i.kind === "ativo" ? "ativo" : "produto";
      const matchedProduct = kind === "produto" ? pick(products, i.matched_catalog_index) : undefined;
      const matchedAsset = kind === "ativo" ? pick(assetCatalog, i.matched_asset_index) : undefined;
      const matched = !!matchedProduct || !!matchedAsset;
      const category = matched ? undefined : pick(kind === "produto" ? productCategories : assetCategories, i.category_index);
      return {
        description: String(i.description ?? "").trim(),
        quantity: Number(i.quantity) || 0,
        unit_cost: Number(i.unit_cost) || 0,
        subtotal: Number(i.subtotal) || (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0),
        kind,
        matched_cost_item_id: matchedProduct?.id ?? null,
        matched_asset_catalog_item_id: matchedAsset?.id ?? null,
        suggested_category_id: category?.id ?? null,
        suggested_name: matched ? null : (i.suggested_name?.toString().trim() || null),
      };
    });

    return {
      success: true,
      data: {
        supplier_name: parsed.supplier_name?.toString().trim() || null,
        payment_method: parsed.payment_method && allowedPayment.includes(parsed.payment_method) ? parsed.payment_method : null,
        date: parsed.date ?? null,
        document_number: parsed.document_number?.toString().trim() || null,
        total_amount: typeof parsed.total_amount === "number" ? parsed.total_amount : null,
        items,
      },
    };
  } catch (e) {
    return {
      error: `Não foi possível ler a imagem automaticamente (${(e as Error).message}). Use “Inserir manualmente”.`,
    };
  }
}

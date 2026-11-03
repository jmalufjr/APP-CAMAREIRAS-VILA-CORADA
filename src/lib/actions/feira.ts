"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export interface FeiraItemPreview {
  // Produto já cadastrado com esse nome (null = nome novo).
  matched_cost_item_id: string | null;
  // Para um nome novo: categoria em que a IA alocou e a unidade dessa categoria.
  suggested_category_id: string | null;
  category_name: string | null;
  unit: string;
}

// Compra na feira: a pessoa digita o nome do item. Se já existir um produto com esse nome, devolve
// o produto e a unidade dele; se for um nome novo, pede à IA a categoria entre as existentes e
// devolve a unidade padrão dessa categoria. Nunca grava nada (o cadastro acontece ao salvar a compra).
export async function previewFeiraItem(name: string): Promise<FeiraItemPreview | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return { error: "Informe o nome do item." };

  const { data: same } = await supabase
    .from("cost_items")
    .select("id, inventory_items(unit)")
    .eq("is_product", true)
    .eq("active", true)
    .ilike("name", clean)
    .limit(1);
  if (same && same.length > 0) {
    const inv = (same[0] as unknown as { inventory_items: { unit: string } | null }).inventory_items;
    return { matched_cost_item_id: same[0].id as string, suggested_category_id: null, category_name: null, unit: inv?.unit ?? "un" };
  }

  const { data: cats } = await supabase
    .from("product_categories")
    .select("id, name, default_unit")
    .eq("active", true)
    .order("position")
    .order("name");
  const categories = (cats ?? []) as { id: string; name: string; default_unit: string }[];
  const fallback = categories.find((c) => c.name === "Utensílios e descartáveis") ?? categories[0];

  let chosen = fallback;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && categories.length > 0) {
    try {
      const client = new Anthropic({ apiKey });
      const list = categories.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      const message = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 20,
        system:
          "Você classifica itens comprados por uma pousada brasileira (ex.: compra em feira). Responda SOMENTE com o número da categoria mais adequada da lista, sem texto.",
        messages: [{ role: "user", content: `Item: ${clean}\n\nCategorias:\n${list}` }],
      });
      const block = message.content.find((b) => b.type === "text");
      const n = block && block.type === "text" ? parseInt(block.text.trim(), 10) : NaN;
      if (Number.isInteger(n) && categories[n - 1]) chosen = categories[n - 1];
    } catch {
      // melhor esforço: cai na categoria padrão
    }
  }

  return {
    matched_cost_item_id: null,
    suggested_category_id: chosen?.id ?? null,
    category_name: chosen?.name ?? null,
    unit: chosen?.default_unit ?? "un",
  };
}

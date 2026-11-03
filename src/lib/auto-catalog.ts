// Cadastro AUTOMÁTICO de produto novo / bem novo, usado só quando uma nota lida pela IA traz um
// item que não existe nos cadastros. Roda com o client admin (service role) porque quem lança a
// compra pode ser o gerente ou o funcionário de manutenção, que não têm permissão de cadastro.
// Nunca importar de componente "use client" nem expor como Server Action — só é chamado por
// createReceiptPurchase, depois de checar o papel de quem lançou.

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const FALLBACK_PRODUCT_CATEGORY = "Utensílios e descartáveis";
const FALLBACK_ASSET_CATEGORY = "Ferramentas e utensílios duráveis";

// "ÁGUA MIN  SG" -> "ÁGUA MIN SG" (espaços) e primeira letra maiúscula, resto como veio.
function cleanName(name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : n;
}

// Produto novo: a categoria vem da IA (ou cai em "Utensílios e descartáveis"); a conta contábil
// e o rateio por centro de custo são COPIADOS dos produtos já cadastrados na mesma categoria
// (conta mais usada; rateio do produto mais recente que tenha centros). Controla estoque, unidade
// "un", e os mesmos padrões do cadastro manual (ponto de pedido 0, 7 dias de folga).
export async function ensureProduct(
  admin: Admin,
  input: { name: string; categoryId: string | null }
): Promise<{ id?: string; created?: boolean; error?: string }> {
  const name = cleanName(input.name);
  if (!name) return { error: "Item sem descrição — não dá para cadastrar um produto." };

  // Já existe um produto com esse nome? Usa o existente (não duplica).
  const { data: sameName } = await admin.from("cost_items").select("id, active, is_product").ilike("name", name).limit(1);
  if (sameName && sameName.length > 0) {
    if (sameName[0].is_product && sameName[0].active) return { id: sameName[0].id as string, created: false };
    return { error: `Já existe um item de custo chamado "${name}" que não é um produto ativo — cadastre/ative-o manualmente.` };
  }

  let categoryId = input.categoryId;
  if (!categoryId) {
    const { data: fb } = await admin.from("product_categories").select("id").eq("name", FALLBACK_PRODUCT_CATEGORY).maybeSingle();
    categoryId = (fb?.id as string | undefined) ?? null;
  }

  let ledgerAccount = "estoque-outros";
  let links: { center_id: string; alloc_pct: number }[] = [];
  if (categoryId) {
    const { data: siblings } = await admin
      .from("cost_items")
      .select("id, ledger_account_code, created_at")
      .eq("is_product", true)
      .eq("category_id", categoryId)
      .order("created_at", { ascending: false });
    const list = (siblings ?? []) as { id: string; ledger_account_code: string | null; created_at: string }[];
    const tally = new Map<string, number>();
    list.forEach((s) => s.ledger_account_code && tally.set(s.ledger_account_code, (tally.get(s.ledger_account_code) ?? 0) + 1));
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) ledgerAccount = top[0];
    for (const s of list) {
      const { data: centers } = await admin.from("cost_item_centers").select("center_id, alloc_pct").eq("cost_item_id", s.id);
      if (centers && centers.length > 0) {
        links = centers.map((c) => ({ center_id: c.center_id as string, alloc_pct: Number(c.alloc_pct) }));
        break;
      }
    }
  }
  if (links.length === 0) {
    const { data: common } = await admin.from("cost_centers").select("id").eq("name", "Administração e áreas comuns").maybeSingle();
    if (!common) return { error: "Não foi possível definir o centro de custo do produto novo." };
    links = [{ center_id: common.id as string, alloc_pct: 100 }];
  }

  const { data: item, error: itemError } = await admin
    .from("cost_items")
    .insert({
      name,
      category_id: categoryId,
      ledger_account_code: ledgerAccount,
      is_product: true,
      is_inventory: false,
      active: true,
    })
    .select("id")
    .single();
  if (itemError || !item) return { error: itemError?.message ?? "Erro ao cadastrar o produto novo." };
  const costItemId = item.id as string;

  const rollback = async (message: string) => {
    await admin.from("cost_items").delete().eq("id", costItemId);
    return { error: message };
  };

  const { data: inv, error: invError } = await admin
    .from("inventory_items")
    .insert({
      name,
      unit: "un",
      reorder_point: 0,
      coverage_days: 7,
      shelf_life_days: null,
      expiry_alert_days: 7,
      is_perishable: false,
      active: true,
    })
    .select("id")
    .single();
  if (invError || !inv) return rollback(invError?.message ?? "Erro ao criar o item de estoque do produto novo.");

  const { error: linkError } = await admin
    .from("cost_items")
    .update({ is_inventory: true, inventory_item_id: inv.id })
    .eq("id", costItemId);
  if (linkError) {
    await admin.from("inventory_items").delete().eq("id", inv.id);
    return rollback(linkError.message);
  }

  const { error: centersError } = await admin
    .from("cost_item_centers")
    .insert(links.map((l) => ({ cost_item_id: costItemId, center_id: l.center_id, alloc_pct: l.alloc_pct })));
  if (centersError) {
    await admin.from("cost_items").update({ inventory_item_id: null, is_inventory: false }).eq("id", costItemId);
    await admin.from("inventory_items").delete().eq("id", inv.id);
    return rollback(centersError.message);
  }

  return { id: costItemId, created: true };
}

// Bem novo do ativo permanente: cria o item no catálogo (na categoria sugerida pela IA, ou
// "Ferramentas e utensílios duráveis") para as próximas compras do mesmo bem já o encontrarem.
// Devolve a categoria e o item de catálogo, que a compra usa para registrar o bem.
export async function ensureAssetCatalogItem(
  admin: Admin,
  input: { name: string; categoryId: string | null }
): Promise<{ categoryId?: string; catalogItemId?: string; created?: boolean; error?: string }> {
  const name = cleanName(input.name);
  if (!name) return { error: "Item sem descrição — não dá para cadastrar um bem." };

  let categoryId = input.categoryId;
  if (!categoryId) {
    const { data: fb } = await admin.from("asset_categories").select("id").eq("name", FALLBACK_ASSET_CATEGORY).maybeSingle();
    categoryId = (fb?.id as string | undefined) ?? null;
  }
  if (!categoryId) {
    const { data: any1 } = await admin.from("asset_categories").select("id").eq("active", true).order("name").limit(1);
    categoryId = (any1?.[0]?.id as string | undefined) ?? null;
  }
  if (!categoryId) return { error: "Não há categoria de ativo permanente cadastrada para o bem novo." };

  const { data: existing } = await admin
    .from("fixed_asset_catalog_items")
    .select("id")
    .eq("category_id", categoryId)
    .ilike("name", name)
    .limit(1);
  if (existing && existing.length > 0) return { categoryId, catalogItemId: existing[0].id as string, created: false };

  const { data, error } = await admin
    .from("fixed_asset_catalog_items")
    .insert({ name, category_id: categoryId })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Erro ao cadastrar o bem novo." };
  return { categoryId, catalogItemId: data.id as string, created: true };
}

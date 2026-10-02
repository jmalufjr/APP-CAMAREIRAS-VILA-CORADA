"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { PurchaseRequestStatus } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/pedidos-compra", "layout");
  revalidatePath("/manutencao/pedidos-compra", "layout");
  revalidatePath("/compras", "layout");
  revalidatePath("/dashboard");
}

// Pedidos de compra: sinal visual de "isto está acabando", registrado
// pela camareira ou pelo funcionário de manutenção — cada pedido é uma
// linha própria, nunca mesclada com outra (ver PRD_compras.md). Qualquer
// compra do item resolve todos os pedidos pendentes dele automaticamente
// (trigger no banco, ver migration 055) — nunca é preciso "atender"
// manualmente um pedido por aqui.
export async function createPurchaseRequest(inventoryItemId: string, quantity: number, notes?: string) {
  if (quantity <= 0) return { error: "Informe uma quantidade maior que zero." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("purchase_requests").insert({
    inventory_item_id: inventoryItemId,
    requested_qty: quantity,
    notes: notes || null,
    requested_by: user.id,
  });

  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function updatePurchaseRequest(id: string, quantity: number, notes?: string) {
  if (quantity <= 0) return { error: "Informe uma quantidade maior que zero." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_requests")
    .update({ requested_qty: quantity, notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// A própria pessoa cancela o próprio pedido individual (RLS: só enquanto
// 'pendente' e só o autor) — diferente do cancelamento em massa do admin
// (cancelPurchaseRequestsForItem), que apaga todos os pedidos pendentes
// de um item de uma vez, de qualquer pessoa.
export async function cancelPurchaseRequest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_requests")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export interface MyPurchaseRequestRow {
  id: string;
  inventory_item_id: string;
  item_name: string;
  unit: string;
  requested_qty: number;
  notes: string | null;
  status: PurchaseRequestStatus;
  created_at: string;
}

// Só os próprios pedidos de quem está logado (camareira/manutenção) —
// usado na tela "Pedidos de compra" de cada papel.
export async function getMyPurchaseRequests(): Promise<MyPurchaseRequestRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("purchase_requests")
    .select("id, inventory_item_id, requested_qty, notes, status, created_at, inventory_items(name, unit)")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  type Raw = {
    id: string;
    inventory_item_id: string;
    requested_qty: number;
    notes: string | null;
    status: PurchaseRequestStatus;
    created_at: string;
    inventory_items: { name: string; unit: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    inventory_item_id: r.inventory_item_id,
    item_name: r.inventory_items?.name ?? "—",
    unit: r.inventory_items?.unit ?? "un",
    requested_qty: Number(r.requested_qty),
    notes: r.notes,
    status: r.status,
    created_at: r.created_at,
  }));
}

export interface AggregatedPurchaseRequest {
  inventory_item_id: string;
  item_name: string;
  unit: string;
  total_qty: number;
  requester_names: string[];
}

// Visão do admin: um item só, com a soma de todos os pedidos pendentes
// (de qualquer pessoa) — "mostra-se apenas o total", conforme pedido.
export async function getAggregatedPurchaseRequests(): Promise<AggregatedPurchaseRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_requests")
    .select("inventory_item_id, requested_qty, inventory_items(name, unit), profiles(name)")
    .eq("status", "pendente");

  type Raw = {
    inventory_item_id: string;
    requested_qty: number;
    inventory_items: { name: string; unit: string } | null;
    profiles: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];

  const byItem = new Map<string, AggregatedPurchaseRequest>();
  rows.forEach((r) => {
    const entry = byItem.get(r.inventory_item_id) ?? {
      inventory_item_id: r.inventory_item_id,
      item_name: r.inventory_items?.name ?? "—",
      unit: r.inventory_items?.unit ?? "un",
      total_qty: 0,
      requester_names: [],
    };
    entry.total_qty += Number(r.requested_qty);
    if (r.profiles?.name && !entry.requester_names.includes(r.profiles.name)) {
      entry.requester_names.push(r.profiles.name);
    }
    byItem.set(r.inventory_item_id, entry);
  });

  return Array.from(byItem.values()).sort((a, b) => a.item_name.localeCompare(b.item_name));
}

// Cancelamento em massa pelo admin — via RPC security definer, já que
// mexe em pedidos de outras pessoas (fora do alcance da policy "própria
// e pendente").
export async function cancelPurchaseRequestsForItem(inventoryItemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_purchase_requests_for_item", {
    p_inventory_item_id: inventoryItemId,
  });
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

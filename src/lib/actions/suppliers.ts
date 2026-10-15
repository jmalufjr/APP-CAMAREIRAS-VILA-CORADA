"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Supplier } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/ativo-permanente", "layout");
  revalidatePath("/contabil", "layout");
  revalidatePath("/historico", "layout");
}

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("*").order("name");
  return (data ?? []) as Supplier[];
}

// Lista enxuta pra seletores — só os ativos.
export interface SupplierOption {
  id: string;
  name: string;
}

export async function getSupplierOptions(): Promise<SupplierOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, name").eq("active", true).order("name");
  return (data ?? []) as SupplierOption[];
}

// Cria um fornecedor novo — admin ou funcionário de manutenção podem,
// na hora de lançar uma compra (mesmo padrão já usado pra criar item de
// custo/item de estoque novo inline). Confere nome duplicado (ignorando
// maiúscula/minúscula) antes de criar, pra nunca duplicar um fornecedor
// que já existe só por causa de capitalização diferente.
export async function createSupplier(
  name: string,
  cpfCnpj: string | null,
  email: string | null,
  phone: string | null,
  address: string | null
) {
  if (!name.trim()) return { error: "Informe o nome do fornecedor." };
  const supabase = await createClient();

  const { data: existing } = await supabase.from("suppliers").select("id").ilike("name", name.trim()).maybeSingle();
  if (existing) return { error: "Já existe um fornecedor com esse nome." };

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: name.trim(),
      cpf_cnpj: cpfCnpj?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { error: "Já existe um fornecedor com esse nome." };
    return { error: error?.message ?? "Erro ao criar fornecedor." };
  }
  revalidateAll();
  return { success: true, id: data.id as string };
}

export async function updateSupplier(
  id: string,
  name: string,
  active: boolean,
  cpfCnpj: string | null,
  email: string | null,
  phone: string | null,
  address: string | null
) {
  if (!name.trim()) return { error: "Informe o nome do fornecedor." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: name.trim(),
      active,
      cpf_cnpj: cpfCnpj?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Já existe um fornecedor com esse nome." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";

// Gestão dos tokens de acesso de serviço pra API externa de consumos
// (PRD_consumos-api-joao-v1.md, item 5) — só admin, via RLS de
// api_service_tokens (`admin_all`). O token em texto puro nunca é
// guardado: só o hash SHA-256, comparado depois em
// src/lib/integration/auth.ts. O valor gerado aqui só existe nesta
// resposta — se a tela for fechada sem copiar, não tem como recuperar
// (mesmo padrão de qualquer chave de API), só gerar um novo.

export interface ApiTokenRow {
  id: string;
  label: string;
  created_at: string;
  created_by_name: string | null;
  revoked_at: string | null;
}

export async function getApiTokens(): Promise<ApiTokenRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_service_tokens")
    .select("id, label, created_at, revoked_at, created_by_profile:profiles!api_service_tokens_created_by_fkey(name)")
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    label: string;
    created_at: string;
    revoked_at: string | null;
    created_by_profile: { name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    label: r.label,
    created_at: r.created_at,
    created_by_name: r.created_by_profile?.name ?? null,
    revoked_at: r.revoked_at,
  }));
}

export async function createApiToken(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "Informe um nome pra identificar este token." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { error } = await supabase
    .from("api_service_tokens")
    .insert({ label: trimmed, token_hash: tokenHash, created_by: user?.id ?? null });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/api-tokens");
  // Único momento em que o valor em texto puro existe — devolvido pra tela
  // mostrar uma vez só, nunca persistido em lugar nenhum.
  return { success: true, token };
}

export async function revokeApiToken(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_service_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/api-tokens");
  return { success: true };
}

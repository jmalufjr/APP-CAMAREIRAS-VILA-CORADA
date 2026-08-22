"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export interface LoginOption {
  id: string;
  name: string;
  email: string;
  role: "admin" | "camareira";
}

// Lista pública (login ainda não realizado) de usuários ativos para preencher
// o campo "usuário" da tela de login com nomes pré-cadastrados.
export async function getLoginOptions(): Promise<LoginOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, login_email, role")
    .eq("active", true)
    .order("role", { ascending: false })
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data.map((d) => ({ id: d.id, name: d.name, email: d.login_email, role: d.role })) as LoginOption[];
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Selecione o usuário e informe a senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Senha incorreta. Tente novamente." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  redirect(profile?.role === "admin" ? "/dashboard" : "/tarefas");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/types";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
}

export async function createUser(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "").trim();
  const role = String(formData.get("role") ?? "camareira") as UserRole;

  if (!name || !password) return { error: "Nome e senha são obrigatórios." };
  if (password.length < 6) return { error: "A senha deve ter ao menos 6 caracteres." };
  if (role !== "camareira" && role !== "manutencao") return { error: "Papel inválido." };

  const admin = createAdminClient();
  const loginEmail = `${slugify(name)}@camareiras.vilacorada.app`;

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return { error: authError?.message ?? "Erro ao criar usuário." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    role,
    name,
    phone,
    email,
    login_email: loginEmail,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/usuarios");
  return { success: true };
}

export async function updateUser(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, phone, email, active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/usuarios");
  return { success: true };
}

export async function resetUserPassword(id: string, newPassword: string) {
  if (newPassword.length < 6) return { error: "A senha deve ter ao menos 6 caracteres." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: newPassword });
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteUser(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  revalidatePath("/usuarios");
  return { success: true };
}

"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OCCURRENCE_PHOTOS_BUCKET } from "@/lib/occurrence-photos";
import { revalidatePath } from "next/cache";

// Envia uma ou mais fotos (já comprimidas no navegador) pra uma ocorrência
// já existente. O upload dos arquivos em si sempre usa o client
// admin/service-role (bucket privado, sem policy de storage.objects) — só
// depois de confirmar, via o client da sessão (RLS), que o usuário logado
// realmente enxerga essa ocorrência (o mesmo critério que já vale pra
// editar/apagar a ocorrência em si).
export async function uploadOccurrencePhotos(occurrenceId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: occurrence } = await supabase
    .from("daily_room_task_occurrences")
    .select("id")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (!occurrence) return { error: "Ocorrência não encontrada." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { success: true };

  const admin = createAdminClient();
  const uploadedPaths: string[] = [];

  for (const file of files) {
    const path = `${occurrenceId}/${randomUUID()}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(OCCURRENCE_PHOTOS_BUCKET)
      .upload(path, buffer, { contentType: file.type || "image/jpeg" });
    if (uploadError) {
      // Desfaz o que já tinha subido nesta chamada antes de devolver o erro.
      if (uploadedPaths.length > 0) await admin.storage.from(OCCURRENCE_PHOTOS_BUCKET).remove(uploadedPaths);
      return { error: uploadError.message };
    }
    uploadedPaths.push(path);
  }

  const { error: insertError } = await supabase.from("daily_room_task_occurrence_photos").insert(
    uploadedPaths.map((storage_path) => ({
      occurrence_id: occurrenceId,
      storage_path,
      uploaded_by: user.id,
    }))
  );
  if (insertError) {
    await admin.storage.from(OCCURRENCE_PHOTOS_BUCKET).remove(uploadedPaths);
    return { error: insertError.message };
  }

  revalidatePath("/tarefas", "layout");
  return { success: true };
}

// Apaga uma foto específica (antes de a suíte ser liberada) — some tanto do
// registro no banco quanto do arquivo guardado.
export async function deleteOccurrencePhoto(photoId: string) {
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("daily_room_task_occurrence_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { error: "Foto não encontrada." };

  const { error } = await supabase.from("daily_room_task_occurrence_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };

  const admin = createAdminClient();
  await admin.storage.from(OCCURRENCE_PHOTOS_BUCKET).remove([photo.storage_path]);

  revalidatePath("/tarefas", "layout");
  return { success: true };
}

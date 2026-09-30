import { createAdminClient } from "@/lib/supabase/admin";

export const OCCURRENCE_PHOTOS_BUCKET = "occurrence-photos";

// URLs assinadas pra leitura: válidas por 1h, geradas de novo a cada
// carregamento de página — nunca persistidas. Mesmo espírito já usado pro
// PDF de recibo (gerado sob demanda, nunca guardado em lugar nenhum).
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Gera, em 1 chamada só, as URLs assinadas de uma lista de caminhos de foto
// já guardados em daily_room_task_occurrence_photos.storage_path — usa o
// client admin/service-role, já que o bucket é privado e não tem nenhuma
// policy de storage.objects (ver CLAUDE.md/schema.sql).
export async function signOccurrencePhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(paths));
  const map = new Map<string, string>();
  if (uniquePaths.length === 0) return map;

  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(OCCURRENCE_PHOTOS_BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);

  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  });
  return map;
}

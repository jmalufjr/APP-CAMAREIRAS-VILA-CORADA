import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OCCURRENCE_PHOTOS_BUCKET, signOccurrencePhotoUrls } from "@/lib/occurrence-photos";

export interface OccurrenceAssessment {
  problem: string; // até 30 palavras
  steps: string[];
  materials: string[];
  tools: string[];
  safety: string | null;
  videoSearch: string; // termo de busca (o link do YouTube é uma busca, nunca um vídeo inventado)
}

export interface OccurrenceAssessmentView {
  occurrence: {
    id: string;
    roomNumber: string | null;
    category: string;
    description: string | null;
    photos: { id: string; url: string | null }[];
  };
  assessment: OccurrenceAssessment | null;
  assessedAt: string | null;
  error?: string;
}

const MAX_PHOTOS = 4;
// Quem pede "gerar de novo" só é atendido se a última avaliação tiver mais que isto (evita gasto repetido da IA).
const REGENERATE_COOLDOWN_MS = 2 * 60 * 1000;
const SYSTEM = `Você é um técnico experiente em manutenção predial de pousadas e hotéis no Brasil.
Receberá a categoria, a descrição escrita pela camareira e, às vezes, fotos de um problema numa suíte.
Responda SOMENTE com um JSON, sem texto fora dele, neste formato:
{
 "problem": "possível problema identificado, em UM parágrafo de no máximo 30 palavras",
 "steps": ["passo 1 do procedimento", "passo 2", "..."],
 "materials": ["material 1", "..."],
 "tools": ["ferramenta 1", "..."],
 "safety": "cuidado de segurança importante, ou null se não houver",
 "video_search": "termo curto de busca em português para achar no YouTube um vídeo que ensine a solução"
}
Regras: seja prático e direto, em português do Brasil; descreva o procedimento em passos curtos; liste só materiais e ferramentas realmente necessários; se faltar informação, diga o problema mais provável e cite a dúvida no passo 1 (ex.: "confirme se..."). Nunca invente endereços de vídeo.`;

function words(text: string, max: number): string {
  const parts = text.trim().split(/\s+/);
  return parts.length <= max ? text.trim() : parts.slice(0, max).join(" ").replace(/[,;:]$/, "") + "…";
}

function strings(value: unknown, max: number): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").slice(0, max).map((v) => v.trim().slice(0, 400)) : [];
}

function parseAssessment(text: string): OccurrenceAssessment | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof j.problem !== "string" || !j.problem.trim()) return null;
    return {
      problem: words(j.problem, 30),
      steps: strings(j.steps, 12),
      materials: strings(j.materials, 15),
      tools: strings(j.tools, 15),
      safety: typeof j.safety === "string" && j.safety.trim() && j.safety.trim().toLowerCase() !== "null" ? j.safety.trim().slice(0, 400) : null,
      videoSearch: typeof j.video_search === "string" && j.video_search.trim() ? j.video_search.trim().slice(0, 120) : "",
    };
  } catch {
    return null;
  }
}

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

type Row = {
  id: string;
  description: string | null;
  ai_assessment: (OccurrenceAssessment & { inputHash?: string }) | null;
  ai_assessed_at: string | null;
  occurrence_categories: { name: string } | null;
  daily_room_tasks: { rooms: { number: string } | null } | null;
  daily_room_task_occurrence_photos: { id: string; storage_path: string }[];
};

// Lê a ocorrência (só quem a enxerga pela segurança do banco) e devolve a avaliação da IA, gerando-a quando ainda
// não existe, quando o conteúdo mudou (descrição, categoria ou fotos) ou quando `force` é verdadeiro.
export async function getOccurrenceAssessment(occurrenceId: string, force = false): Promise<OccurrenceAssessmentView | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_room_task_occurrences")
    .select(
      "id, description, ai_assessment, ai_assessed_at, occurrence_categories(name), daily_room_tasks(rooms(number)), daily_room_task_occurrence_photos(id, storage_path)"
    )
    .eq("id", occurrenceId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row;

  const photoPaths = row.daily_room_task_occurrence_photos.map((p) => p.storage_path).sort();
  const urls = await signOccurrencePhotoUrls(photoPaths);
  const category = row.occurrence_categories?.name ?? "Ocorrência";
  const view: OccurrenceAssessmentView = {
    occurrence: {
      id: row.id,
      roomNumber: row.daily_room_tasks?.rooms?.number ?? null,
      category,
      description: row.description,
      photos: row.daily_room_task_occurrence_photos.map((p) => ({ id: p.id, url: urls.get(p.storage_path) ?? null })),
    },
    assessment: null,
    assessedAt: null,
  };

  const inputHash = createHash("sha256").update(JSON.stringify([category, row.description ?? "", photoPaths])).digest("hex").slice(0, 16);
  const recent = row.ai_assessed_at ? Date.now() - new Date(row.ai_assessed_at).getTime() < REGENERATE_COOLDOWN_MS : false;
  if (row.ai_assessment && row.ai_assessment.inputHash === inputHash && (!force || recent)) {
    view.assessment = row.ai_assessment;
    view.assessedAt = row.ai_assessed_at;
    return view;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ...view, error: "A avaliação pela IA não está configurada no servidor." };

  // Baixa até 4 fotos (já vêm reduzidas do celular) para a IA ver.
  const admin = createAdminClient();
  const images: Anthropic.ImageBlockParam[] = [];
  for (const path of photoPaths.slice(0, MAX_PHOTOS)) {
    const { data: file } = await admin.storage.from(OCCURRENCE_PHOTOS_BUCKET).download(path);
    if (!file) continue;
    images.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(await file.arrayBuffer()).toString("base64") },
    });
  }

  const text = `Categoria: ${category}\nSuíte: ${view.occurrence.roomNumber ?? "?"}\nDescrição da camareira: ${row.description?.trim() || "(sem descrição escrita)"}\nFotos anexadas: ${images.length}`;
  let parsed: OccurrenceAssessment | null = null;
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: process.env.OCCURRENCE_AI_MODEL || "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text }] }],
    });
    const block = message.content.find((b) => b.type === "text");
    parsed = block && block.type === "text" ? parseAssessment(block.text) : null;
  } catch (e) {
    console.error("[occurrence-ai]", e instanceof Error ? e.message : e);
  }
  if (!parsed) return { ...view, error: "Não foi possível gerar a avaliação agora. Tente novamente em instantes." };

  const now = new Date().toISOString();
  await admin
    .from("daily_room_task_occurrences")
    .update({ ai_assessment: { ...parsed, inputHash }, ai_assessed_at: now })
    .eq("id", occurrenceId);
  view.assessment = parsed;
  view.assessedAt = now;
  return view;
}

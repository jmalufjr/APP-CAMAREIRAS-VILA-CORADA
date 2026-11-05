// Leitura dos comentários dos hóspedes pela IA: extrai os assuntos citados (positivos e negativos),
// cada um numa descrição curta, e guarda em guest_review_topics. Roda com o client de serviço
// (chamado pela sincronização e por uma Server Action que confere o papel) — nunca importar de
// componente "use client".
import Anthropic from "@anthropic-ai/sdk";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const BATCH = 10;

const SYSTEM = `Você lê comentários que hóspedes deixaram sobre uma pousada brasileira e extrai os ASSUNTOS citados.

Para cada avaliação, devolva os assuntos mencionados, cada um com:
- "label": descrição CURTA do assunto (2 a 5 palavras, português, inicial maiúscula, sem pontuação final),
  como "Café da manhã", "Limpeza", "Atendimento da anfitriã", "Localização", "Silêncio e tranquilidade",
  "Conforto da cama", "Estacionamento", "Barulho", "Custo-benefício". Nunca copie a frase do hóspede.
- "polarity": "positivo" se o hóspede elogia/aprova o assunto, "negativo" se critica/reclama/sugere melhora.

Regras:
- Reaproveite EXATAMENTE os rótulos da lista "ASSUNTOS JÁ USADOS" sempre que o assunto for o mesmo, para a
  contagem ficar consistente. Só crie um rótulo novo se nenhum servir.
- Um assunto por ideia; não repita o mesmo assunto com a mesma polaridade na mesma avaliação.
- Ignore agradecimentos genéricos ("Obrigado!") e assuntos neutros, sem elogio nem crítica.
- Se o texto não citar nenhum assunto, devolva a lista vazia.

Responda SOMENTE com JSON, sem texto antes ou depois e sem bloco de código:
[{"id": "<id da avaliação>", "topics": [{"label": "...", "polarity": "positivo"|"negativo"}]}]`;

export interface TopicRunResult {
  processed: number;
  remaining: number;
  error?: string;
}

export async function extractTopicsForPending(admin: Admin, limit: number): Promise<TopicRunResult> {
  const { data: pending } = await admin
    .from("guest_reviews")
    .select("id, comments")
    .is("topics_read_at", null)
    .order("day", { ascending: false })
    .limit(limit);
  const rows = (pending ?? []) as { id: string; comments: { label: string; text: string }[] }[];

  // Sem comentário não há o que ler: só marca como lida.
  const empty = rows.filter((r) => !r.comments || r.comments.length === 0).map((r) => r.id);
  if (empty.length > 0) await admin.from("guest_reviews").update({ topics_read_at: new Date().toISOString() }).in("id", empty);
  const toRead = rows.filter((r) => r.comments && r.comments.length > 0);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (toRead.length > 0 && !apiKey) {
    return { processed: empty.length, remaining: toRead.length, error: "Leitura pela IA não configurada neste ambiente (falta ANTHROPIC_API_KEY)." };
  }

  // Rótulos já usados (mais frequentes primeiro) para a IA reaproveitar.
  const { data: used } = await admin.from("guest_review_topics").select("label");
  const counts = new Map<string, number>();
  (used ?? []).forEach((u) => counts.set(u.label as string, (counts.get(u.label as string) ?? 0) + 1));
  const knownLabels = () =>
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 120)
      .map(([l]) => l);

  let processed = empty.length;
  let lastError: string | undefined;

  // Lê um lote. Se a resposta da IA vier cortada ou inválida (acontece com lotes grandes), divide o lote
  // ao meio e tenta de novo; só desiste de uma avaliação isolada, sem derrubar o resto.
  async function readBatch(batch: typeof toRead): Promise<void> {
    try {
        const client = new Anthropic({ apiKey });
        const content =
          `ASSUNTOS JÁ USADOS:\n${knownLabels().join("\n") || "(nenhum ainda)"}\n\nAVALIAÇÕES:\n` +
          batch.map((r) => `ID ${r.id}\n${r.comments.map((c) => `${c.label}: ${c.text}`).join("\n")}`).join("\n\n---\n\n");
        const message = await client.messages.create({
          model: "claude-sonnet-5",
          max_tokens: 8192,
          system: SYSTEM,
          messages: [{ role: "user", content }],
        });
        const block = message.content.find((b) => b.type === "text");
        if (message.stop_reason === "max_tokens") throw new Error("Resposta da IA cortada (limite de tamanho).");
      if (!block || block.type !== "text") throw new Error("A IA não devolveu texto.");
        const cleaned = block.text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleaned) as { id: string; topics?: { label?: string; polarity?: string }[] }[];
  
        const valid = new Set(batch.map((b) => b.id));
        const inserts: { review_id: string; label: string; polarity: string }[] = [];
        const done: string[] = [];
        parsed.forEach((p) => {
          if (!valid.has(p.id)) return;
          const seen = new Set<string>();
          (p.topics ?? []).forEach((t) => {
            const label = (t.label ?? "").replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
            const polarity = t.polarity === "negativo" ? "negativo" : t.polarity === "positivo" ? "positivo" : null;
            if (!label || !polarity) return;
            const key = `${label.toLowerCase()}|${polarity}`;
            if (seen.has(key)) return;
            seen.add(key);
            inserts.push({ review_id: p.id, label: label.charAt(0).toUpperCase() + label.slice(1), polarity });
          });
          done.push(p.id);
        });
        if (done.length === 0) throw new Error("A IA não devolveu nenhuma avaliação reconhecida.");
  
        // Reprocessar uma avaliação nunca duplica: apaga os assuntos antigos dela antes.
        await admin.from("guest_review_topics").delete().in("review_id", done);
        if (inserts.length > 0) {
          const { error } = await admin.from("guest_review_topics").insert(inserts);
          if (error) throw new Error(error.message);
          inserts.forEach((t) => counts.set(t.label, (counts.get(t.label) ?? 0) + 1));
        }
        const { error: markError } = await admin
          .from("guest_reviews")
          .update({ topics_read_at: new Date().toISOString() })
          .in("id", done);
        if (markError) throw new Error(markError.message);
        processed += done.length;
      } catch (e) {
      // Só divide quando o problema é a resposta (cortada/inválida); chave errada, limite de uso etc. não adiantam.
      const status = (e as { status?: number }).status;
      const splittable = !status || status === 400 || status >= 500;
      if (batch.length > 1 && splittable) {
        const mid = Math.ceil(batch.length / 2);
        await readBatch(batch.slice(0, mid));
        await readBatch(batch.slice(mid));
        return;
      }
      lastError = e instanceof Error ? e.message : "Erro na leitura pela IA.";
    }
  }

  for (let i = 0; i < toRead.length; i += BATCH) {
    await readBatch(toRead.slice(i, i + BATCH));
  }

  const { count } = await admin.from("guest_reviews").select("id", { count: "exact", head: true }).is("topics_read_at", null);
  return { processed, remaining: count ?? 0, ...(lastError ? { error: lastError } : {}) };
}

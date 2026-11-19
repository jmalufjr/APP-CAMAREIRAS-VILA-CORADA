import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startOfDayBrasiliaUtc, todayKey } from "@/lib/date";
import { synthesize, transcribe } from "@/lib/google/speech";
import { translateText, isGuestLanguage, UNDERSTOOD_NOTHING } from "@/lib/translator";

export const runtime = "nodejs";
export const maxDuration = 30;

// Limites de gasto: tamanho do áudio e quantidade de falas por pessoa por dia.
const MAX_AUDIO_BYTES = 2_000_000;
const MAX_CALLS_PER_DAY = 150;

// Frases fixas faladas pelo próprio app (guardadas em memória depois da primeira vez).
const PHRASES = {
  invite: { lang: "en", text: "Please speak in English or in your own language.", rate: 0.95 },
  not_understood: { lang: "pt", text: "Não entendi. Pode repetir, por favor?", rate: 1 },
  unsupported: { lang: "pt", text: "Desculpe, não consegui entender o idioma do hóspede.", rate: 1 },
} as const;
const phraseCache = new Map<string, string>();

async function phraseAudio(key: keyof typeof PHRASES): Promise<string> {
  const hit = phraseCache.get(key);
  if (hit) return hit;
  const p = PHRASES[key];
  const audio = await synthesize(p.text, p.lang, p.rate);
  phraseCache.set(key, audio);
  return audio;
}

type Reason = "nao_entendi" | "idioma" | "sem_idioma" | "limite" | "erro";

export async function POST(req: Request) {
  // Só camareira, gerente operacional e administrador (rotas de API não passam pela checagem de papel do proxy).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active || !["camareira", "gerente_operacional", "admin"].includes(profile.role as string)) {
    return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 400 });
  }
  const mode = String(form.get("mode") ?? "");

  try {
    if (mode === "convite") {
      return NextResponse.json({ ok: true, audio: await phraseAudio("invite") });
    }
    if (mode !== "camareira" && mode !== "hospede") {
      return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 400 });
    }

    const file = form.get("audio");
    if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
    }
    const guestLangIn = String(form.get("lang") ?? "");
    const audioMs = Math.round(Number(form.get("ms") ?? 0)) || null;

    // Limite diário por pessoa: a vaga é reservada ANTES de chamar qualquer serviço pago (assim chamadas
    // simultâneas e chamadas que falham também contam); o resultado é anotado no fim.
    const admin = createAdminClient();
    const { data: slot } = await admin
      .from("translator_calls")
      .insert({ user_id: user.id, direction: mode, lang: null, audio_ms: audioMs, ok: false })
      .select("id")
      .single();
    if (!slot) return NextResponse.json({ ok: false, reason: "erro" satisfies Reason });
    const { count } = await admin
      .from("translator_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfDayBrasiliaUtc(todayKey()));
    if ((count ?? 0) > MAX_CALLS_PER_DAY) {
      await admin.from("translator_calls").delete().eq("id", slot.id);
      return NextResponse.json({ ok: false, reason: "limite" satisfies Reason });
    }

    const log = async (ok: boolean, lang: string | null) => {
      await admin.from("translator_calls").update({ ok, lang }).eq("id", slot.id);
    };

    const buffer = Buffer.from(await file.arrayBuffer());

    if (mode === "camareira") {
      if (!isGuestLanguage(guestLangIn)) {
        await log(false, null);
        return NextResponse.json({ ok: false, reason: "sem_idioma" satisfies Reason });
      }
      const heard = await transcribe(buffer, ["pt-BR"], true);
      if (!heard.text) {
        await log(false, guestLangIn);
        return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
      }
      const translated = await translateText(heard.text, "to_guest", guestLangIn);
      if (!translated || translated === UNDERSTOOD_NOTHING) {
        await log(false, guestLangIn);
        return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
      }
      const audio = await synthesize(translated, guestLangIn, 0.92);
      await log(true, guestLangIn);
      return NextResponse.json({ ok: true, lang: guestLangIn, audio, heard: heard.text, said: translated });
    }

    // Hóspede: o Google descobre o idioma sozinho.
    const heard = await transcribe(buffer, ["auto"], false);
    if (!heard.text) {
      await log(false, null);
      return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
    }
    const lang = heard.languageCode.split("-")[0];
    if (!isGuestLanguage(lang)) {
      await log(false, lang || null);
      return NextResponse.json({ ok: false, reason: "idioma" satisfies Reason, audio: await phraseAudio("unsupported") });
    }
    const translated = await translateText(heard.text, "to_camareira", lang);
    if (!translated || translated === UNDERSTOOD_NOTHING) {
      await log(false, lang);
      return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
    }
    const audio = await synthesize(translated, "pt", 0.95);
    await log(true, lang);
    return NextResponse.json({ ok: true, lang, audio, heard: heard.text, said: translated });
  } catch (error) {
    console.error("[tradutor]", error);
    // Gerente e administrador veem o motivo técnico na tela, para facilitar o diagnóstico.
    const detail = profile.role === "camareira" ? undefined : String((error as Error)?.message ?? error).slice(0, 400);
    return NextResponse.json({ ok: false, reason: "erro" satisfies Reason, detail });
  }
}

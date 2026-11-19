import { NextResponse, after } from "next/server";
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
  const t0 = Date.now();
  const timing: Record<string, number | string> = {};
  const mark = (name: string, since: number) => {
    timing[name] = Date.now() - since;
  };

  // Só camareira, gerente operacional e administrador (rotas de API não passam pela checagem de papel do proxy).
  const supabase = await createClient();
  const [{ data: userData }, formResult] = await Promise.all([
    supabase.auth.getUser(),
    req.formData().then(
      (f) => f,
      () => null
    ),
  ]);
  const user = userData.user;
  if (!user) return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 401 });
  if (!formResult) return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 400 });
  const form = formResult;
  const mode = String(form.get("mode") ?? "");
  const audioMs = Math.round(Number(form.get("ms") ?? 0)) || null;
  const admin = createAdminClient();

  // O papel é conferido junto com a reserva da vaga do limite diário (uma ida ao banco em paralelo).
  const profilePromise = supabase.from("profiles").select("role, active").eq("id", user.id).single();
  const slotPromise =
    mode === "camareira" || mode === "hospede"
      ? (async () => {
          const { data: slot } = await admin
            .from("translator_calls")
            .insert({ user_id: user.id, direction: mode, lang: null, audio_ms: audioMs, ok: false })
            .select("id")
            .single();
          if (!slot) return { slotId: null as string | null, count: 0 };
          const { count } = await admin
            .from("translator_calls")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", startOfDayBrasiliaUtc(todayKey()));
          return { slotId: slot.id as string, count: count ?? 0 };
        })()
      : Promise.resolve({ slotId: null as string | null, count: 0 });

  const [{ data: profile }, slotInfo] = await Promise.all([profilePromise, slotPromise]);
  mark("banco_ms", t0);
  const dropSlot = async () => {
    if (slotInfo.slotId) await admin.from("translator_calls").delete().eq("id", slotInfo.slotId);
  };
  if (!profile?.active || !["camareira", "gerente_operacional", "admin"].includes(profile.role as string)) {
    await dropSlot();
    return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 403 });
  }
  const showDetail = profile.role !== "camareira";
  const withTiming = <T extends Record<string, unknown>>(body: T) => {
    timing.total_ms = Date.now() - t0;
    return showDetail ? { ...body, timing } : body;
  };

  try {
    if (mode === "convite") {
      return NextResponse.json({ ok: true, audio: await phraseAudio("invite") });
    }
    if (mode !== "camareira" && mode !== "hospede") {
      return NextResponse.json({ ok: false, reason: "erro" satisfies Reason }, { status: 400 });
    }

    const file = form.get("audio");
    if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      await dropSlot();
      return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
    }
    const guestLangIn = String(form.get("lang") ?? "");

    // Limite diário por pessoa: a vaga já foi reservada ANTES de chamar qualquer serviço pago (assim chamadas
    // simultâneas e chamadas que falham também contam); o resultado é anotado depois de responder.
    if (!slotInfo.slotId) return NextResponse.json({ ok: false, reason: "erro" satisfies Reason });
    if (slotInfo.count > MAX_CALLS_PER_DAY) {
      await dropSlot();
      return NextResponse.json({ ok: false, reason: "limite" satisfies Reason });
    }
    const slotId = slotInfo.slotId;
    const log = (ok: boolean, lang: string | null) => {
      after(async () => {
        await admin.from("translator_calls").update({ ok, lang }).eq("id", slotId);
      });
    };

    const buffer = Buffer.from(await file.arrayBuffer());

    if (mode === "camareira") {
      if (!isGuestLanguage(guestLangIn)) {
        log(false, null);
        return NextResponse.json({ ok: false, reason: "sem_idioma" satisfies Reason });
      }
      let t = Date.now();
      const heard = await transcribe(buffer, ["pt-BR"], true);
      mark("voz_para_texto_ms", t);
      if (!heard.text) {
        log(false, guestLangIn);
        return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
      }
      t = Date.now();
      const tr = await translateText(heard.text, "to_guest", guestLangIn);
      mark("traducao_ms", t);
      timing.modelo = tr.model;
      if (!tr.text || tr.text === UNDERSTOOD_NOTHING) {
        log(false, guestLangIn);
        return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
      }
      t = Date.now();
      const audio = await synthesize(tr.text, guestLangIn, 0.92);
      mark("texto_para_voz_ms", t);
      log(true, guestLangIn);
      return NextResponse.json(withTiming({ ok: true, lang: guestLangIn, audio, heard: heard.text, said: tr.text }));
    }

    // Hóspede: o Google descobre o idioma sozinho.
    let t = Date.now();
    const heard = await transcribe(buffer, ["auto"], false);
    mark("voz_para_texto_ms", t);
    if (!heard.text) {
      log(false, null);
      return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
    }
    const lang = heard.languageCode.split("-")[0];
    if (!isGuestLanguage(lang)) {
      log(false, lang || null);
      return NextResponse.json({ ok: false, reason: "idioma" satisfies Reason, audio: await phraseAudio("unsupported") });
    }
    t = Date.now();
    const tr = await translateText(heard.text, "to_camareira", lang);
    mark("traducao_ms", t);
    timing.modelo = tr.model;
    if (!tr.text || tr.text === UNDERSTOOD_NOTHING) {
      log(false, lang);
      return NextResponse.json({ ok: false, reason: "nao_entendi" satisfies Reason, audio: await phraseAudio("not_understood") });
    }
    t = Date.now();
    const audio = await synthesize(tr.text, "pt", 0.95);
    mark("texto_para_voz_ms", t);
    log(true, lang);
    return NextResponse.json(withTiming({ ok: true, lang, audio, heard: heard.text, said: tr.text }));
  } catch (error) {
    console.error("[tradutor]", error);
    // Gerente e administrador veem o motivo técnico na tela, para facilitar o diagnóstico.
    const detail = showDetail ? String((error as Error)?.message ?? error).slice(0, 400) : undefined;
    return NextResponse.json({ ok: false, reason: "erro" satisfies Reason, detail });
  }
}

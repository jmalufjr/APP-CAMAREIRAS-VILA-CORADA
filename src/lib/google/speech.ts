import { getGoogleAccessToken, getServiceAccount } from "@/lib/google/auth";

// Chirp 2 (reconhecimento de voz de última geração do Google) está disponível nesta região.
const STT_LOCATION = "us-central1";

// Palavras da pousada: ajudam o reconhecimento do português falado.
const PT_HINTS = [
  "suíte",
  "toalha",
  "toalhas",
  "lençol",
  "café da manhã",
  "frigobar",
  "check-out",
  "check-in",
  "chave",
  "piscina",
  "travesseiro",
  "banheiro",
  "arrumação",
  "camareira",
  "ar-condicionado",
  "controle remoto",
];

export interface TranscribeResult {
  text: string;
  // Código do idioma detectado (ex.: "en-us", "es-es"); vazio se o Google não informou.
  languageCode: string;
}

export async function transcribe(audio: Buffer, languageCodes: string[], withHints: boolean): Promise<TranscribeResult> {
  const sa = getServiceAccount();
  if (!sa) throw new Error("Chave do Google não configurada.");
  const token = await getGoogleAccessToken();

  const config: Record<string, unknown> = {
    autoDecodingConfig: {},
    languageCodes,
    model: "chirp_2",
    features: { enableAutomaticPunctuation: true },
  };
  if (withHints) {
    config.adaptation = { phraseSets: [{ inlinePhraseSet: { phrases: PT_HINTS.map((value) => ({ value, boost: 10 })) } }] };
  }

  const url = `https://${STT_LOCATION}-speech.googleapis.com/v2/projects/${sa.project_id}/locations/${STT_LOCATION}/recognizers/_:recognize`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ config, content: audio.toString("base64") }),
  });
  if (!res.ok) {
    const body = await res.text();
    // A lista de palavras é só um reforço: se o Google recusar, tenta de novo sem ela.
    if (withHints && res.status === 400) return transcribe(audio, languageCodes, false);
    throw new Error(`Voz para texto falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    results?: { alternatives?: { transcript?: string }[]; languageCode?: string }[];
  };
  const results = json.results ?? [];
  const text = results
    .map((r) => r.alternatives?.[0]?.transcript?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  const languageCode = (results.find((r) => r.languageCode)?.languageCode ?? "").toLowerCase();
  return { text, languageCode };
}

// Vozes neurais do Google (iguais em qualquer celular).
const VOICES: Record<string, { languageCode: string; name: string }> = {
  pt: { languageCode: "pt-BR", name: "pt-BR-Neural2-A" },
  en: { languageCode: "en-US", name: "en-US-Neural2-F" },
  es: { languageCode: "es-US", name: "es-US-Neural2-A" },
  fr: { languageCode: "fr-FR", name: "fr-FR-Neural2-A" },
  it: { languageCode: "it-IT", name: "it-IT-Neural2-A" },
  de: { languageCode: "de-DE", name: "de-DE-Neural2-F" },
};

// Devolve o áudio (MP3) em base64.
export async function synthesize(text: string, lang: string, speakingRate = 1): Promise<string> {
  const voice = VOICES[lang];
  if (!voice) throw new Error(`Idioma sem voz: ${lang}`);
  const token = await getGoogleAccessToken();

  async function call(voiceBody: Record<string, unknown>) {
    return fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: voiceBody, audioConfig: { audioEncoding: "MP3", speakingRate } }),
    });
  }

  let res = await call({ languageCode: voice.languageCode, name: voice.name });
  // Se o nome da voz não existir, deixa o Google escolher uma voz do idioma.
  if (res.status === 400) res = await call({ languageCode: voice.languageCode, ssmlGender: "FEMALE" });
  if (!res.ok) throw new Error(`Texto para voz falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { audioContent: string };
  return json.audioContent;
}

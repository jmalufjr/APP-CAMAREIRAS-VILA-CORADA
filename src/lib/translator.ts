import Anthropic from "@anthropic-ai/sdk";

// Idiomas atendidos pelo tradutor (hóspedes estrangeiros).
export const GUEST_LANGUAGES: Record<string, string> = {
  en: "inglês",
  es: "espanhol",
  fr: "francês",
  it: "italiano",
  de: "alemão",
};

export function isGuestLanguage(code: string): boolean {
  return Object.hasOwn(GUEST_LANGUAGES, code);
}

export const UNDERSTOOD_NOTHING = "NAO_ENTENDI";

const BASE_RULES = `Você é o intérprete de uma pousada brasileira (Pousada Vila Corada), traduzindo a conversa entre uma camareira e um hóspede estrangeiro.
O texto chegou por reconhecimento de voz e pode ter erros de reconhecimento.
Responda SOMENTE com a tradução, sem aspas, sem explicações, sem comentários.
Se o texto não fizer sentido nem for possível entender a intenção, responda exatamente ${UNDERSTOOD_NOTHING}.`;

// Português do Brasil falado pela camareira -> idioma do hóspede.
function systemToGuest(languageName: string) {
  return `${BASE_RULES}

DIREÇÃO: da camareira (português do Brasil) para o hóspede, em ${languageName}.
A camareira fala de modo simples e regional: pode usar gírias e regionalismos, errar concordância, flexão de verbos, usar palavras erradas ou incompletas e fazer pausas. Entenda a intenção e traduza para ${languageName} de forma educada, clara e simples, como um bom atendimento de hotel (cordial, sem gírias, sem frases longas). Mantenha números, horários e nomes. "Suíte" é o quarto do hóspede.`;
}

// Idioma do hóspede -> português do Brasil para a camareira.
const SYSTEM_TO_CAMAREIRA = `${BASE_RULES}

DIREÇÃO: do hóspede (qualquer idioma) para a camareira, em português do Brasil.
Traduza para um português do Brasil muito simples, curto e natural, fácil de entender por quem tem pouca escolaridade (palavras do dia a dia, frases curtas). Mantenha números, horários e nomes. Se o hóspede fizer um pedido, deixe claro o que ele quer.`;

// Se o modelo rápido não existir nesta conta, deixa de tentá-lo (evita uma chamada perdida a cada fala).
let fastModelMissing = false;

export async function translateText(
  text: string,
  direction: "to_guest" | "to_camareira",
  guestLang: string
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Tradução não configurada (falta ANTHROPIC_API_KEY).");
  const client = new Anthropic({ apiKey });
  const params = {
    max_tokens: 400,
    system: direction === "to_guest" ? systemToGuest(GUEST_LANGUAGES[guestLang] ?? guestLang) : SYSTEM_TO_CAMAREIRA,
    messages: [{ role: "user" as const, content: text }],
  };
  // Modelo rápido e barato; se ele não estiver disponível, usa o mesmo modelo do resto do app.
  const fast = process.env.TRANSLATOR_MODEL || "claude-haiku-5-5";
  const fallback = "claude-sonnet-5";
  let model = fastModelMissing ? fallback : fast;
  let message;
  try {
    message = await client.messages.create({ ...params, model });
  } catch (e) {
    if (!fastModelMissing && (e as { status?: number })?.status === 404) {
      fastModelMissing = true;
      model = fallback;
      message = await client.messages.create({ ...params, model });
    } else throw e;
  }
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("A tradução não voltou.");
  return { text: block.text.trim().replace(/^["“]|["”]$/g, "").trim(), model };
}

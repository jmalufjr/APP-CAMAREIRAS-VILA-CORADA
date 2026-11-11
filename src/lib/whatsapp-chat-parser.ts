// Leitura da conversa exportada do WhatsApp ("Exportar conversa", com mídia).
// Funções puras, sem acesso a banco. Aceita os formatos mais comuns:
//   Android: "10/11/2026 14:32 - Nome: texto"  (ano com 2 ou 4 dígitos)
//   iPhone:  "[10/11/2026 14:32:05] Nome: texto"
// Anexos aparecem como "IMG-20261110-WA0001.jpg (arquivo anexado)",
// "<anexado: 00000012-PHOTO-....jpg>" ou "<attached: ...>".

export interface ChatMessage {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  sender: string;
  text: string;
  attachment: string | null; // nome do arquivo anexado
}

export interface ChatGroup {
  // Chave estável para não importar o mesmo grupo duas vezes.
  key: string;
  sender: string;
  date: string;
  time: string;
  image: string | null; // nome do arquivo da foto/PDF da nota
  texts: string[]; // mensagens do mesmo remetente logo após a foto
}

const LRM = /[‎‏‪-‮]/g;

const LINE_RE = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\]?\s*(?:-\s*)?([^:]+?):\s?(.*)$/;
const ATTACH_PATTERNS = [
  /<(?:anexado|attached):\s*([^>]+)>/i,
  /^(.+?\.(?:jpe?g|png|webp|pdf))\s*\((?:arquivo anexado|file attached)\)\s*$/im,
];
const MEDIA_FILE_RE = /\.(jpe?g|png|webp|pdf)$/i;

function normalizeYear(y: string): string {
  return y.length === 2 ? `20${y}` : y;
}

export function parseChat(raw: string): ChatMessage[] {
  const lines = raw.replace(LRM, "").replace(/\r/g, "").split("\n");
  const out: ChatMessage[] = [];
  let current: ChatMessage | null = null;

  for (const line of lines) {
    const m = LINE_RE.exec(line);
    if (m) {
      const [, d, mo, y, h, mi, sender, body] = m;
      current = {
        date: `${normalizeYear(y)}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
        time: `${h.padStart(2, "0")}:${mi}`,
        sender: sender.trim(),
        text: body.trim(),
        attachment: null,
      };
      out.push(current);
    } else if (current && line.trim()) {
      // Continuação de uma mensagem de várias linhas.
      current.text += (current.text ? "\n" : "") + line.trim();
    }
  }

  for (const msg of out) {
    for (const re of ATTACH_PATTERNS) {
      const a = re.exec(msg.text);
      if (a) {
        const name = a[1].trim();
        if (MEDIA_FILE_RE.test(name)) {
          msg.attachment = name;
          msg.text = msg.text.replace(a[0], "").trim();
        }
        break;
      }
    }
  }
  return out;
}

const SYSTEM_HINTS = /mensagens e ligações são protegidas|criptografia de ponta a ponta|<mídia oculta>|<media omitted>|você foi adicionado|mensagem apagada|apagou esta mensagem|^null$/i;

// Cada foto abre um grupo; as mensagens de texto do MESMO remetente que vêm
// logo depois (até a próxima foto ou a fala de outra pessoa) explicam a compra.
// Texto solto, sem foto antes, vira um grupo só de texto.
export function groupMessages(messages: ChatMessage[]): ChatGroup[] {
  const groups: ChatGroup[] = [];
  let open: ChatGroup | null = null;

  for (const msg of messages) {
    if (msg.attachment) {
      open = {
        key: `${msg.date}T${msg.time}|${msg.sender}|${msg.attachment}`,
        sender: msg.sender,
        date: msg.date,
        time: msg.time,
        image: msg.attachment,
        texts: msg.text && !SYSTEM_HINTS.test(msg.text) ? [msg.text] : [],
      };
      groups.push(open);
      continue;
    }
    if (!msg.text || SYSTEM_HINTS.test(msg.text)) continue;

    if (open && open.sender === msg.sender) {
      open.texts.push(msg.text);
    } else {
      // Texto sem foto antes (ou de outra pessoa): grupo só de texto.
      open = null;
      groups.push({
        key: `${msg.date}T${msg.time}|${msg.sender}|texto|${msg.text.slice(0, 40)}`,
        sender: msg.sender,
        date: msg.date,
        time: msg.time,
        image: null,
        texts: [msg.text],
      });
    }
  }
  return groups;
}

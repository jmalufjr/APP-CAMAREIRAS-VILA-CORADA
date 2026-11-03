// Regras de alocação da "Limpeza adicional" (PRD_limpeza_adicional.md). Funções puras, sem I/O.
// A limpeza adicional é um acréscimo a uma tarefa de troca / saída com chegada / somente saída,
// no máximo uma vez por semana (segunda a domingo) por suíte.

export type ExtraBaseType = "troca" | "preparacao" | "somente_saida";

// Preferência de tipo (menor = escolhido antes): troca, saída com chegada, somente saída.
const TYPE_PREFERENCE: Record<ExtraBaseType, number> = { troca: 0, preparacao: 1, somente_saida: 2 };

export const EXTRA_BASE_TYPES: ExtraBaseType[] = ["troca", "preparacao", "somente_saida"];

export type ExtraCandidate = {
  taskId: string;
  date: string; // YYYY-MM-DD
  roomId: string;
  roomNumber: number;
  type: ExtraBaseType;
};

export type ExtraFlagged = { date: string; roomId: string };

// 0 = domingo ... 6 = sábado, a partir de "YYYY-MM-DD" (sem fuso: é só calendário).
function weekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Segunda = 0 ... domingo = 6.
export function weekIndex(dateKey: string): number {
  return (weekday(dateKey) + 6) % 7;
}

function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function weekStartKey(dateKey: string): string {
  return addDays(dateKey, -weekIndex(dateKey));
}

// Teto base por dia: segunda a quarta 3, quinta 2, sexta a domingo 3.
export function baseCap(dateKey: string): number {
  return weekIndex(dateKey) === 3 ? 2 : 3;
}

// Escolhe quais tarefas recebem a limpeza adicional nos `days` (em ordem). `flagged` traz tudo que
// já está marcado na semana (inclusive dias passados e tarefas já escolhidas, que nunca mudam).
// `priorityRooms` são as suítes que ficaram sem limpeza adicional na semana anterior.
export function planExtraCleaning(input: {
  days: string[];
  flagged: ExtraFlagged[];
  candidates: ExtraCandidate[];
  priorityRooms?: Set<string>;
}): string[] {
  const priority = input.priorityRooms ?? new Set<string>();
  const flaggedCountByDate = new Map<string, number>();
  const flaggedRooms = new Set<string>(); // por semana: "weekStart:roomId"
  const bump = (date: string) => flaggedCountByDate.set(date, (flaggedCountByDate.get(date) ?? 0) + 1);
  input.flagged.forEach((f) => {
    bump(f.date);
    flaggedRooms.add(`${weekStartKey(f.date)}:${f.roomId}`);
  });

  const chosen: string[] = [];
  for (const day of input.days) {
    const wk = weekStartKey(day);
    const idx = weekIndex(day);
    const base = baseCap(day);

    // Folga acumulada de segunda a quinta anteriores a este dia: permite +1 acima do teto.
    let cap = base;
    if (idx <= 3) {
      let deficit = 0;
      for (let i = 0; i < idx; i++) {
        const prev = addDays(wk, i);
        deficit += Math.max(0, baseCap(prev) - (flaggedCountByDate.get(prev) ?? 0));
      }
      if (deficit > 0) cap = base + 1;
    }

    const free = cap - (flaggedCountByDate.get(day) ?? 0);
    if (free <= 0) continue;

    const eligible = input.candidates
      .filter((c) => c.date === day && !flaggedRooms.has(`${wk}:${c.roomId}`))
      .sort((a, b) => {
        const pa = priority.has(a.roomId) ? 0 : 1;
        const pb = priority.has(b.roomId) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        if (TYPE_PREFERENCE[a.type] !== TYPE_PREFERENCE[b.type]) return TYPE_PREFERENCE[a.type] - TYPE_PREFERENCE[b.type];
        return a.roomNumber - b.roomNumber;
      });

    for (const c of eligible.slice(0, free)) {
      chosen.push(c.taskId);
      bump(day);
      flaggedRooms.add(`${wk}:${c.roomId}`);
    }
  }
  return chosen;
}

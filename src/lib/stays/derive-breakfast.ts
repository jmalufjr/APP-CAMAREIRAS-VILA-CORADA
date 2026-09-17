// Distribuição automática de suítes ocupadas entre as mesas do café, por
// proximidade da vista do mar — ver PRD_regrasdenegocio.md seção 4 ("Regra
// de preenchimento das mesas"). Função pura (sem I/O) para poder ser testada
// isoladamente; quem chama (Server Action de sync) decide o que fazer com o
// resultado (upsert, respeitar stays_locked etc.).

export interface RoomGuestCount {
  roomId: string;
  guestCount: number;
}

export interface TableCapacity {
  id: string;
  label: string;
  seats: number;
}

// Ordem de preenchimento das mesas "normais" (suítes de 1 ou 2 hóspedes),
// da mais próxima da vista do mar (Mesas 5 e 9, na parte inferior do
// layout) até a mais distante — Mesa 1 e Mesa 7 são especiais (ver abaixo)
// e não entram nesta lista.
const FILL_ORDER = [5, 9, 3, 4, 8, 2, 6];
const MESA_1 = 1;
const MESA_7 = 7;

export function tableNumber(label: string): number {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : -1;
}

export interface TableSizeCounts {
  totalOccupiedTables: number;
  tables1Guest: number;
  tables2Guest: number;
  tables3Guest: number;
  guestsTable07: number;
}

// Deriva "Total de mesas" (quantidade de mesas ocupadas, que devem ser
// postas para o café) e os 4 campos de contagem por tamanho de mesa
// (PRD_regrasdenegocio.md seção 4: "Mesas de 1/2/3 hóspede(s)" e
// "Hóspedes na Mesa 07") diretamente da
// alocação suíte↔mesa já existente — nenhum desses é um valor
// sincronizado/editável à parte, são sempre um cálculo em cima do que já
// está na tela (ver CLAUDE.md Parte 16/17). Função pura, usada tanto pela
// tela do admin quanto pela da camareira.
export function computeTableSizeCounts(
  assignments: { table_id: string; guest_count: number }[],
  tables: { id: string; label: string }[]
): TableSizeCounts {
  const totalsByTable = new Map<string, number>();
  assignments.forEach((a) => {
    totalsByTable.set(a.table_id, (totalsByTable.get(a.table_id) ?? 0) + a.guest_count);
  });

  let totalOccupiedTables = 0;
  let tables1Guest = 0;
  let tables2Guest = 0;
  let tables3Guest = 0;
  let guestsTable07 = 0;

  tables.forEach((t) => {
    const total = totalsByTable.get(t.id) ?? 0;
    if (total > 0) totalOccupiedTables++;
    if (total === 1) tables1Guest++;
    else if (total === 2) tables2Guest++;
    else if (total === 3) tables3Guest++;
    if (tableNumber(t.label) === 7) guestsTable07 = total;
  });

  return { totalOccupiedTables, tables1Guest, tables2Guest, tables3Guest, guestsTable07 };
}

// Recebe as suítes ocupadas num dia (com sua quantidade de hóspedes) e as
// mesas ativas, devolve o mapeamento mesa -> suítes alocadas ali (a Mesa 7
// pode receber mais de uma suíte). Suítes que não couberem em nenhuma mesa
// (superlotação) ficam de fora do resultado — quem chama trata como "não
// alocada" e o admin resolve manualmente.
export function assignRoomsToTables(
  rooms: RoomGuestCount[],
  tables: TableCapacity[]
): Map<string, RoomGuestCount[]> {
  const byNumber = new Map<number, TableCapacity>();
  tables.forEach((t) => byNumber.set(tableNumber(t.label), t));

  const result = new Map<string, RoomGuestCount[]>();
  const remainingSeats = new Map<string, number>();
  tables.forEach((t) => remainingSeats.set(t.id, t.seats));

  function fits(tableId: string, guestCount: number): boolean {
    return (remainingSeats.get(tableId) ?? 0) >= guestCount;
  }

  function place(tableId: string, room: RoomGuestCount) {
    const list = result.get(tableId) ?? [];
    list.push(room);
    result.set(tableId, list);
    remainingSeats.set(tableId, (remainingSeats.get(tableId) ?? 0) - room.guestCount);
  }

  // Ordem estável por id de quarto, pra resultado determinístico (a API da
  // Stays não garante nenhuma ordem específica de reservas).
  const sorted = [...rooms].sort((a, b) => a.roomId.localeCompare(b.roomId));
  const threeGuestRooms = sorted.filter((r) => r.guestCount === 3);
  const otherRooms = sorted.filter((r) => r.guestCount !== 3);

  const mesa1 = byNumber.get(MESA_1);
  const mesa7 = byNumber.get(MESA_7);
  const leftover: RoomGuestCount[] = [];

  // Suítes de 3 hóspedes: a primeira vai pra Mesa 1, as demais pra Mesa 7.
  threeGuestRooms.forEach((room, i) => {
    if (i === 0 && mesa1 && fits(mesa1.id, room.guestCount)) {
      place(mesa1.id, room);
    } else if (mesa7 && fits(mesa7.id, room.guestCount)) {
      place(mesa7.id, room);
    } else {
      leftover.push(room);
    }
  });

  // Suítes de 1 ou 2 hóspedes: mesas "normais", na ordem de proximidade da
  // vista do mar.
  const fillTables = FILL_ORDER.map((n) => byNumber.get(n)).filter((t): t is TableCapacity => !!t);
  otherRooms.forEach((room) => {
    const target = fillTables.find((t) => fits(t.id, room.guestCount));
    if (target) {
      place(target.id, room);
    } else {
      leftover.push(room);
    }
  });

  // Sobra (não coube em nenhuma mesa normal nem nas de 3 hóspedes): Mesa 7
  // como última alternativa, depois Mesa 1 — ver PRD seção 4 ("quando todas
  // as demais regras já tiverem sido aplicadas... vão para a Mesa 7").
  leftover.forEach((room) => {
    if (mesa7 && fits(mesa7.id, room.guestCount)) {
      place(mesa7.id, room);
    } else if (mesa1 && fits(mesa1.id, room.guestCount)) {
      place(mesa1.id, room);
    }
    // Se nem a Mesa 7 comportar, a suíte fica sem mesa — superlotação real,
    // o admin resolve manualmente.
  });

  return result;
}

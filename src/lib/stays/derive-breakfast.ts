// Distribuição automática de suítes ocupadas entre as mesas do café, por
// proximidade da vista do mar — ver PRD_regrasdenegocio.md seção 4 ("Regra
// de preenchimento das mesas"). Função pura (sem I/O) para poder ser testada
// isoladamente; quem chama (Server Action de sync) decide o que fazer com o
// resultado (upsert, respeitar stays_locked etc.).

export interface RoomGuestCount {
  roomId: string;
  roomNumber: string;
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
const MESA_5 = 5;
const MESA_7 = 7;
const MESA_9 = 9;

// Suítes 10 e 11 têm preferência pelas Mesas 5 e 9 respectivamente (mais
// perto da vista do mar) quando ocupadas; na ausência delas, a preferência
// dessas duas mesas passa a ser de uma suíte de 1 hóspede qualquer.
const SUITE_PRIORITY_MESA_5 = "10";
const SUITE_PRIORITY_MESA_9 = "11";

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
//
// Duas regras de preferência, além da ordem de preenchimento já
// estabelecida (FILL_ORDER):
//
// 1) Suítes 10 e 11 têm preferência pelas Mesas 5 e 9 (mais perto da vista
//    do mar) quando ocupadas. Se uma delas não estiver ocupada, a
//    preferência daquela mesa passa a ser de uma suíte de 1 hóspede
//    qualquer. Se não houver nem a suíte prioritária nem nenhuma suíte de 1
//    hóspede, a mesa volta pro fluxo geral (FILL_ORDER), sem tratamento
//    especial. Isso só se aplica quando a suíte 10/11 de fato NÃO está
//    ocupada — se estiver ocupada mas não couber fisicamente na mesa (caso
//    raro), a mesa some pro fluxo geral em vez de cair no fallback de 1
//    hóspede, já que a regra fala em suíte "não ocupada", não "ocupada mas
//    grande demais".
//
// 2) A Mesa 7 é a ÚNICA mesa que pode reunir mais de uma suíte. Todas as
//    outras ficam reservadas inteiras pra uma única suíte assim que
//    recebem alguém — mesmo que sobre capacidade (ex.: suíte de 1 hóspede
//    numa mesa de 2 lugares) — pra nunca juntar duas suítes de 1 hóspede
//    numa mesma mesa normal. Só em caso de superlotação real (mais
//    suítes/hóspedes do que mesas disponíveis, depois de aplicadas todas
//    as regras acima) uma suíte de 1 hóspede pode dividir mesa com outra —
//    e só na Mesa 7, nunca numa mesa de 2 ou 3 lugares.
export function assignRoomsToTables(
  rooms: RoomGuestCount[],
  tables: TableCapacity[]
): Map<string, RoomGuestCount[]> {
  const byNumber = new Map<number, TableCapacity>();
  tables.forEach((t) => byNumber.set(tableNumber(t.label), t));

  const mesa1 = byNumber.get(MESA_1);
  const mesa5 = byNumber.get(MESA_5);
  const mesa7 = byNumber.get(MESA_7);
  const mesa9 = byNumber.get(MESA_9);

  const result = new Map<string, RoomGuestCount[]>();
  const remainingSeats = new Map<string, number>();
  tables.forEach((t) => remainingSeats.set(t.id, t.seats));

  function isSharedTable(table: TableCapacity): boolean {
    return !!mesa7 && table.id === mesa7.id;
  }

  // Mesa 7: aceita mais gente enquanto houver assento real sobrando.
  // Qualquer outra mesa: só aceita se estiver completamente vazia (mesa
  // "exclusiva" de uma única suíte) e a suíte couber nela.
  function canPlace(table: TableCapacity, room: RoomGuestCount): boolean {
    if (isSharedTable(table)) {
      return (remainingSeats.get(table.id) ?? 0) >= room.guestCount;
    }
    return remainingSeats.get(table.id) === table.seats && room.guestCount <= table.seats;
  }

  function place(table: TableCapacity, room: RoomGuestCount) {
    const list = result.get(table.id) ?? [];
    list.push(room);
    result.set(table.id, list);
    remainingSeats.set(
      table.id,
      isSharedTable(table) ? (remainingSeats.get(table.id) ?? 0) - room.guestCount : 0
    );
  }

  // Pool mutável de suítes ainda não alocadas, em ordem estável por id de
  // quarto (resultado determinístico — a API da Stays não garante ordem).
  const pending = [...rooms].sort((a, b) => a.roomId.localeCompare(b.roomId));

  function takeFirst(predicate: (r: RoomGuestCount) => boolean): RoomGuestCount | undefined {
    const idx = pending.findIndex(predicate);
    if (idx === -1) return undefined;
    return pending.splice(idx, 1)[0];
  }

  function applyPriorityTable(table: TableCapacity | undefined, priorityRoomNumber: string) {
    if (!table) return;
    const priorityRoom = pending.find((r) => r.roomNumber === priorityRoomNumber);
    if (priorityRoom) {
      // Ocupada: só entra se couber; se não couber, a mesa segue pro fluxo
      // geral (sem cair no fallback de 1 hóspede).
      if (canPlace(table, priorityRoom)) {
        takeFirst((r) => r === priorityRoom);
        place(table, priorityRoom);
      }
      return;
    }
    // Não ocupada: preferência vira de uma suíte de 1 hóspede, se houver.
    const singleGuestRoom = takeFirst((r) => r.guestCount === 1);
    if (singleGuestRoom) place(table, singleGuestRoom);
  }

  applyPriorityTable(mesa5, SUITE_PRIORITY_MESA_5);
  applyPriorityTable(mesa9, SUITE_PRIORITY_MESA_9);

  // A partir daqui, o resto das suítes segue as regras já estabelecidas.
  const threeGuestRooms = pending.filter((r) => r.guestCount === 3);
  const otherRooms = pending.filter((r) => r.guestCount !== 3);
  const leftover: RoomGuestCount[] = [];

  // Suítes de 3 hóspedes: a primeira vai pra Mesa 1, as demais pra Mesa 7.
  threeGuestRooms.forEach((room, i) => {
    if (i === 0 && mesa1 && canPlace(mesa1, room)) {
      place(mesa1, room);
    } else if (mesa7 && canPlace(mesa7, room)) {
      place(mesa7, room);
    } else {
      leftover.push(room);
    }
  });

  // Suítes de 1 ou 2 hóspedes: mesas "normais", na ordem de proximidade da
  // vista do mar (Mesa 5/Mesa 9 já podem estar ocupadas pela regra de
  // prioridade acima — nesse caso `canPlace` já retorna false pra elas).
  const fillTables = FILL_ORDER.map((n) => byNumber.get(n)).filter((t): t is TableCapacity => !!t);
  otherRooms.forEach((room) => {
    const target = fillTables.find((t) => canPlace(t, room));
    if (target) {
      place(target, room);
    } else {
      leftover.push(room);
    }
  });

  // Sobra (não coube em nenhuma mesa normal nem nas de 3 hóspedes): Mesa 7
  // como última alternativa (única mesa que aceita dividir com outra
  // suíte, inclusive de 1 hóspede), depois Mesa 1 — ver PRD seção 4.
  leftover.forEach((room) => {
    if (mesa7 && canPlace(mesa7, room)) {
      place(mesa7, room);
    } else if (mesa1 && canPlace(mesa1, room)) {
      place(mesa1, room);
    }
    // Se nem a Mesa 7 comportar, a suíte fica sem mesa — superlotação real,
    // o admin resolve manualmente.
  });

  return result;
}

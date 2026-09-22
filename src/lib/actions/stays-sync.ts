"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaysReservationsIncluding, getStaysClientName, type StaysReservationRaw } from "@/lib/stays/client";
import { deriveWorkType, daysBetween } from "@/lib/stays/derive-planning";
import { assignRoomsToTables, tableNumber, type RoomGuestCount } from "@/lib/stays/derive-breakfast";
import { todayKey, tomorrowKey, yesterdayKey } from "@/lib/date";
import { revalidatePath } from "next/cache";

export interface SyncOptions {
  // Sincronização forçada (botão manual): ignora a trava `stays_locked`
  // (regra de preferência do admin, PRD_regrasdenegocio.md seção 1) e
  // sobrescreve com os dados da Stays mesmo assim. Nunca ignora, porém, um
  // serviço já reivindicado/em andamento/concluído/cancelado por uma
  // camareira — isso não é "preferência de edição", é trabalho em curso.
  force?: boolean;
}

// Sincroniza o Planejamento Diário (hoje + amanhã) com as reservas da
// Stays — ver PRD_regrasdenegocio.md seções 1 e 2. Usa o client
// admin/service-role de propósito: precisa gravar em daily_room_tasks
// independente de sessão de usuário (essencial pro cron, que roda sem
// ninguém logado — ver src/app/api/cron/stays-sync/route.ts). O cron
// chama sem `force` (respeita a regra de preferência); o botão manual de
// cada tela chama com `force: true`.
export async function syncStaysPlanning(options?: SyncOptions) {
  const force = options?.force ?? false;
  const supabase = createAdminClient();
  const dates = [todayKey(), tomorrowKey()];

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id, stays_listing_id")
    .eq("active", true)
    .not("stays_listing_id", "is", null);

  if (roomsError) return { error: roomsError.message };
  if (!rooms || rooms.length === 0) {
    return { error: "Nenhuma suíte com stays_listing_id configurado (ver README.md seção 6.3)." };
  }

  // Busca a partir de ontem, não de hoje: a Stays só considera uma reserva
  // "incluída" no intervalo se pelo menos uma noite dela começa dentro
  // dele. Uma reserva cujo check-out é hoje não tem nenhuma noite
  // começando hoje (a última começou ontem) — sem esse dia extra pra trás,
  // a Stays nunca devolve essa reserva e a saída de hoje passa
  // despercebida. Verificado direto contra a API real antes desta mudança.
  // Não é preciso alargar `to` pro lado de amanhã: um check-in em amanhã
  // já tem a primeira noite dele começando em amanhã, então já cai dentro
  // do intervalo sem ajuste nenhum.
  let reservations: StaysReservationRaw[];
  try {
    reservations = await getStaysReservationsIncluding(yesterdayKey(), dates[dates.length - 1]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao consultar a API da Stays." };
  }

  const byListing = new Map<string, StaysReservationRaw[]>();
  reservations.forEach((r) => {
    const list = byListing.get(r._idlisting) ?? [];
    list.push(r);
    byListing.set(r._idlisting, list);
  });

  // Lápides de "Sem trabalho" explícito (ver `setRoomTask`/CLAUDE.md Parte
  // 15) — ignoradas com `force`, igual a `stays_locked`.
  let exclusions: { date: string; room_id: string }[] = [];
  if (!force) {
    const { data } = await supabase
      .from("daily_room_task_exclusions")
      .select("date, room_id")
      .in("date", dates);
    exclusions = data ?? [];
  }
  const excludedKeys = new Set(exclusions.map((e) => `${e.date}:${e.room_id}`));

  let updated = 0;
  let skipped = 0;

  for (const date of dates) {
    for (const room of rooms as { id: string; stays_listing_id: string }[]) {
      const roomReservations = byListing.get(room.stays_listing_id) ?? [];
      const desiredType = deriveWorkType(roomReservations, date);

      const { data: existing } = await supabase
        .from("daily_room_tasks")
        .select("id, task_type, status, assigned_to, stays_locked")
        .eq("date", date)
        .eq("room_id", room.id)
        .maybeSingle();

      // Preferência do admin (stays_locked, ignorada se `force`), ou
      // quarto já escolhido/em andamento/concluído/cancelado por uma
      // camareira (nunca ignorado, nem com `force`): não mexe.
      const lockedByAdmin = Boolean(existing?.stays_locked) && !force;
      if (existing && (lockedByAdmin || existing.assigned_to || existing.status !== "pendente")) {
        skipped++;
        continue;
      }

      // "Sem trabalho" explícito do admin (lápide, ignorada se `force`):
      // não recria a tarefa, mesmo sem linha nenhuma de daily_room_tasks
      // pra carregar o lock.
      if (excludedKeys.has(`${date}:${room.id}`)) {
        skipped++;
        continue;
      }

      if (!desiredType) {
        if (existing) {
          await supabase.from("daily_room_tasks").delete().eq("id", existing.id);
          updated++;
        }
        continue;
      }

      if (existing && existing.task_type === desiredType) continue; // já está certo, não mexe

      // Vai criar uma tarefa de verdade agora: qualquer lápide "sem
      // trabalho" pra esta suíte/dia ficou obsoleta (só chega aqui com
      // `force`, já que sem `force` o `continue` acima já teria pulado).
      await supabase.from("daily_room_task_exclusions").delete().eq("date", date).eq("room_id", room.id);

      if (existing) {
        await supabase.from("daily_room_tasks").delete().eq("id", existing.id);
      }

      const { data: task, error: insertError } = await supabase
        .from("daily_room_tasks")
        .insert({ date, room_id: room.id, task_type: desiredType, stays_locked: false })
        .select()
        .single();
      if (insertError || !task) continue;

      const { data: items } = await supabase
        .from("room_checklist_items")
        .select("checklist_item_id, checklist_items!inner(type, active)")
        .eq("room_id", room.id)
        .eq("checklist_items.type", desiredType)
        .eq("checklist_items.active", true);

      if (items && items.length > 0) {
        await supabase
          .from("daily_room_task_checks")
          .insert(items.map((i) => ({ daily_room_task_id: task.id, checklist_item_id: i.checklist_item_id })));
      }
      updated++;
    }
  }

  revalidatePath("/planejamento");
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  return { success: true, updated, skipped };
}

// Sincroniza Chegadas & Saídas (hoje + amanhã) com as reservas da Stays —
// ver PRD_regrasdenegocio.md seção 3. O nome do hóspede não vem no payload
// da reserva, precisa de uma chamada extra por cliente (com cache local
// pra não repetir a mesma chamada quando o mesmo hóspede aparece em mais de
// um quarto/dia, o que não deveria acontecer mas é barato de evitar).
// `force` (ver `SyncOptions`) ignora `stays_locked` em ambas as tabelas.
export async function syncStaysArrivalsDepartures(options?: SyncOptions) {
  const force = options?.force ?? false;
  const supabase = createAdminClient();
  const dates = [todayKey(), tomorrowKey()];

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id, stays_listing_id")
    .eq("active", true)
    .not("stays_listing_id", "is", null);

  if (roomsError) return { error: roomsError.message };
  if (!rooms || rooms.length === 0) {
    return { error: "Nenhuma suíte com stays_listing_id configurado (ver README.md seção 6.3)." };
  }

  // Busca a partir de ontem, não de hoje: a Stays só considera uma reserva
  // "incluída" no intervalo se pelo menos uma noite dela começa dentro
  // dele. Uma reserva cujo check-out é hoje não tem nenhuma noite
  // começando hoje (a última começou ontem) — sem esse dia extra pra trás,
  // a Stays nunca devolve essa reserva e a saída de hoje passa
  // despercebida. Verificado direto contra a API real antes desta mudança.
  // Não é preciso alargar `to` pro lado de amanhã: um check-in em amanhã
  // já tem a primeira noite dele começando em amanhã, então já cai dentro
  // do intervalo sem ajuste nenhum.
  let reservations: StaysReservationRaw[];
  try {
    reservations = await getStaysReservationsIncluding(yesterdayKey(), dates[dates.length - 1]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao consultar a API da Stays." };
  }

  const byListing = new Map<string, StaysReservationRaw[]>();
  reservations.forEach((r) => {
    const list = byListing.get(r._idlisting) ?? [];
    list.push(r);
    byListing.set(r._idlisting, list);
  });

  const clientNameCache = new Map<string, string>();
  async function resolveGuestName(clientId: string): Promise<string> {
    const cached = clientNameCache.get(clientId);
    if (cached) return cached;
    const name = (await getStaysClientName(clientId).catch(() => null)) ?? "Hóspede";
    clientNameCache.set(clientId, name);
    return name;
  }

  let updated = 0;
  let skipped = 0;

  for (const date of dates) {
    for (const room of rooms as { id: string; stays_listing_id: string }[]) {
      const roomReservations = byListing.get(room.stays_listing_id) ?? [];
      const checkingIn = roomReservations.find((r) => r.checkInDate === date);
      const checkingOut = roomReservations.find((r) => r.checkOutDate === date);

      // Chegadas: nome, noites e hóspedes vêm da Stays; horário
      // previsto/observações nunca são tocados (upsert não os inclui).
      const { data: existingArrival } = await supabase
        .from("daily_arrivals")
        .select("id, stays_locked")
        .eq("date", date)
        .eq("room_id", room.id)
        .maybeSingle();

      if (existingArrival?.stays_locked && !force) {
        skipped++;
      } else if (checkingIn) {
        const guestName = await resolveGuestName(checkingIn._idclient);
        const nights = daysBetween(checkingIn.checkInDate, checkingIn.checkOutDate);
        const { error } = await supabase.from("daily_arrivals").upsert(
          {
            date,
            room_id: room.id,
            guest_name: guestName,
            nights,
            guest_count: checkingIn.guests,
            stays_locked: false,
          },
          { onConflict: "date,room_id" }
        );
        if (!error) updated++;
      } else if (existingArrival) {
        await supabase.from("daily_arrivals").delete().eq("id", existingArrival.id);
        updated++;
      }

      // Saídas: só a existência da linha (a "suíte" com saída) é
      // sincronizada — observações nunca são tocadas.
      const { data: existingDeparture } = await supabase
        .from("daily_departures")
        .select("id, stays_locked")
        .eq("date", date)
        .eq("room_id", room.id)
        .maybeSingle();

      if (existingDeparture?.stays_locked && !force) {
        skipped++;
      } else if (checkingOut) {
        if (!existingDeparture) {
          const { error } = await supabase
            .from("daily_departures")
            .insert({ date, room_id: room.id, stays_locked: false });
          if (!error) updated++;
        }
      } else if (existingDeparture) {
        await supabase.from("daily_departures").delete().eq("id", existingDeparture.id);
        updated++;
      }
    }
  }

  revalidatePath("/chegadas-saidas/gerenciar");
  revalidatePath("/chegadas-saidas");
  return { success: true, updated, skipped };
}

// Mesas já ocupadas por suítes travadas (stays_locked) ficam de fora do
// algoritmo de distribuição, ou com a capacidade reduzida — sem isso,
// assignRoomsToTables (que não sabe nada sobre travas) poderia tentar
// colocar uma suíte nova numa mesa que já tem uma suíte travada,
// resultando em duas suítes na mesma mesa fora da Mesa 7 (que é a única
// que pode dividir, ver CLAUDE.md Parte 22/derive-breakfast.ts).
function tablesAvailableForAlgorithm(
  tables: { id: string; label: string; seats: number }[],
  lockedAssignments: { table_id: string; guest_count: number }[]
): { id: string; label: string; seats: number }[] {
  const lockedGuestsByTable = new Map<string, number>();
  lockedAssignments.forEach((a) => {
    lockedGuestsByTable.set(a.table_id, (lockedGuestsByTable.get(a.table_id) ?? 0) + a.guest_count);
  });

  return tables
    .filter((t) => {
      const lockedGuests = lockedGuestsByTable.get(t.id) ?? 0;
      if (lockedGuests === 0) return true;
      // Mesa 7 é a única que pode dividir com outra suíte — as demais,
      // com qualquer suíte travada, já não têm mais vaga pra nenhuma outra.
      return tableNumber(t.label) === 7;
    })
    .map((t) => {
      const lockedGuests = lockedGuestsByTable.get(t.id) ?? 0;
      return lockedGuests > 0 ? { ...t, seats: Math.max(0, t.seats - lockedGuests) } : t;
    });
}

// Sincroniza a alocação suíte<->mesa, o total de hóspedes por mesa e os 4
// campos de contagem por tamanho de mesa (hoje + amanhã) com as reservas da
// Stays — ver PRD_regrasdenegocio.md seção 4 (regra de preenchimento por
// proximidade da vista do mar, implementada em
// src/lib/stays/derive-breakfast.ts). Suíte ocupada num dia = reserva cujo
// check-in é antes desse dia e cujo check-out é nesse dia ou depois (inclui
// quem sai naquele dia, já que ainda toma café antes de ir embora; exclui
// quem chega naquele dia, que só terá café no dia seguinte). `force` (ver
// `SyncOptions`) ignora `stays_locked` nas três tabelas envolvidas.
export async function syncStaysBreakfastTables(options?: SyncOptions) {
  const force = options?.force ?? false;
  const supabase = createAdminClient();
  const dates = [todayKey(), tomorrowKey()];

  const [
    { data: rooms, error: roomsError },
    { data: tables, error: tablesError },
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, number, stays_listing_id")
      .eq("active", true)
      .not("stays_listing_id", "is", null),
    supabase.from("breakfast_tables").select("id, label, seats").eq("active", true),
  ]);

  if (roomsError) return { error: roomsError.message };
  if (tablesError) return { error: tablesError.message };
  if (!rooms || rooms.length === 0) {
    return { error: "Nenhuma suíte com stays_listing_id configurado (ver README.md seção 6.3)." };
  }
  if (!tables || tables.length === 0) {
    return { error: "Nenhuma mesa ativa cadastrada." };
  }

  // Valor de comissão vigente agora, gravado (congelado) em cada linha de
  // alocação criada/atualizada nesta sincronização — é o que o Histórico
  // vai mostrar pra esse dia depois que o mês fechar (ver migration 037).
  const { data: commissionSettings } = await supabase.from("commission_settings").select("value_per_table").single();
  const commissionValueSnapshot = commissionSettings?.value_per_table ?? 10;

  // Busca a partir de ontem, não de hoje: a Stays só considera uma reserva
  // "incluída" no intervalo se pelo menos uma noite dela começa dentro
  // dele. Uma reserva cujo check-out é hoje não tem nenhuma noite
  // começando hoje (a última começou ontem) — sem esse dia extra pra trás,
  // a Stays nunca devolve essa reserva e a saída de hoje passa
  // despercebida. Verificado direto contra a API real antes desta mudança.
  // Não é preciso alargar `to` pro lado de amanhã: um check-in em amanhã
  // já tem a primeira noite dele começando em amanhã, então já cai dentro
  // do intervalo sem ajuste nenhum.
  let reservations: StaysReservationRaw[];
  try {
    reservations = await getStaysReservationsIncluding(yesterdayKey(), dates[dates.length - 1]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao consultar a API da Stays." };
  }

  const byListing = new Map<string, StaysReservationRaw[]>();
  reservations.forEach((r) => {
    const list = byListing.get(r._idlisting) ?? [];
    list.push(r);
    byListing.set(r._idlisting, list);
  });

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const date of dates) {
    const occupied: RoomGuestCount[] = [];
    for (const room of rooms as { id: string; number: string; stays_listing_id: string }[]) {
      const roomReservations = byListing.get(room.stays_listing_id) ?? [];
      const staying = roomReservations.find((r) => r.checkInDate < date && date <= r.checkOutDate);
      if (staying) occupied.push({ roomId: room.id, roomNumber: room.number, guestCount: staying.guests });
    }

    // Comissão do dia = quantidade de suítes elegíveis pro café da manhã
    // (a regra de ocupação acima), independente de terem sido de fato
    // alocadas a alguma mesa — grava sempre, mesmo com lápide de exclusão
    // ou superlotação real, e mesmo sem `force` (não é um campo editável
    // pelo admin, só reflete a regra objetiva de ocupação). Um erro aqui
    // não interrompe o resto da sincronização (alocação de mesas segue
    // normalmente abaixo) — só não conta como "atualizado".
    const { error: settingsError } = await supabase.from("daily_breakfast_settings").upsert(
      {
        date,
        eligible_suites_count: occupied.length,
        commission_value_snapshot: commissionValueSnapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "date" }
    );
    if (settingsError) errors++;
    else updated++;

    // Suítes já travadas manualmente (admin reatribuiu) nesse dia: preserva
    // a alocação delas e não as considera disponíveis pro algoritmo — a
    // menos que `force`, que trata como se nada estivesse travado.
    let lockedAssignments: { room_id: string; table_id: string; guest_count: number }[] = [];
    if (!force) {
      const { data } = await supabase
        .from("daily_breakfast_room_assignments")
        .select("room_id, table_id, guest_count")
        .eq("date", date)
        .eq("stays_locked", true);
      lockedAssignments = data ?? [];
    }

    // Suítes removidas de propósito de qualquer mesa (lápide, ver
    // `removeTableRoomAssignment`/CLAUDE.md Parte 15) — buscadas sempre
    // (mesmo com `force`, pra poder limpar as obsoletas mais abaixo), mas
    // só usadas pra filtrar o algoritmo quando não é `force`.
    const { data: exclusionRows } = await supabase
      .from("daily_breakfast_room_exclusions")
      .select("room_id")
      .eq("date", date);
    const excludedRoomIds = new Set((exclusionRows ?? []).map((e) => e.room_id));

    const lockedRoomIds = new Set(lockedAssignments.map((a) => a.room_id));
    const roomsToAssign = occupied.filter(
      (o) => !lockedRoomIds.has(o.roomId) && !(!force && excludedRoomIds.has(o.roomId))
    );
    const excludedCount = force
      ? 0
      : occupied.filter((o) => excludedRoomIds.has(o.roomId) && !lockedRoomIds.has(o.roomId)).length;
    skipped += lockedRoomIds.size + excludedCount;

    const assignment = assignRoomsToTables(
      roomsToAssign,
      tablesAvailableForAlgorithm(tables as { id: string; label: string; seats: number }[], lockedAssignments)
    );

    // Remove alocações antigas que não fazem mais sentido hoje (suíte não
    // está mais ocupada, ou o algoritmo mudou a mesa dela) — só entre as
    // não travadas, exceto com `force`, que reconsidera todas.
    const existingQuery = supabase
      .from("daily_breakfast_room_assignments")
      .select("id, room_id, table_id")
      .eq("date", date);
    if (!force) existingQuery.eq("stays_locked", false);
    const { data: existingRows } = await existingQuery;

    const desired = new Map<string, string>(); // room_id -> table_id
    assignment.forEach((roomsAtTable, tableId) => {
      roomsAtTable.forEach((r) => desired.set(r.roomId, tableId));
    });

    // Toda suíte que vai ganhar uma mesa de verdade agora não pode ter
    // sobrado nenhuma lápide de exclusão (só acontece com `force`, já que
    // sem `force` essas suítes nem entraram em `roomsToAssign`).
    for (const roomId of desired.keys()) {
      if (excludedRoomIds.has(roomId)) {
        await supabase.from("daily_breakfast_room_exclusions").delete().eq("date", date).eq("room_id", roomId);
      }
    }

    for (const row of existingRows ?? []) {
      if (desired.get(row.room_id) !== row.table_id) {
        await supabase.from("daily_breakfast_room_assignments").delete().eq("id", row.id);
      }
    }

    for (const [tableId, roomsAtTable] of assignment) {
      for (const r of roomsAtTable) {
        // Comissão não depende mais desta linha (ver
        // daily_breakfast_settings.eligible_suites_count acima) — não
        // gravar commission_value_snapshot aqui, a coluna nem existe mais
        // nesta tabela (migration 038).
        const { error } = await supabase.from("daily_breakfast_room_assignments").upsert(
          {
            date,
            table_id: tableId,
            room_id: r.roomId,
            guest_count: r.guestCount,
            stays_locked: false,
          },
          { onConflict: "date,room_id" }
        );
        if (error) errors++;
        else updated++;
      }
    }

    // Total de hóspedes por mesa (soma das suítes ali, incluindo as
    // travadas) -> daily_breakfast.guest_count, respeitando seu próprio
    // stays_locked (edição manual direta do campo, sem passar pela
    // alocação por suíte). Os 4 campos de contagem por tamanho de mesa
    // (PRD seção 4) não são mais sincronizados/persistidos aqui — são
    // calculados na hora, direto da alocação suíte↔mesa, tanto na tela do
    // admin quanto na da camareira (`computeTableSizeCounts`, ver CLAUDE.md
    // Parte 16).
    const totalsByTable = new Map<string, number>();
    assignment.forEach((roomsAtTable, tableId) => {
      totalsByTable.set(tableId, roomsAtTable.reduce((s, r) => s + r.guestCount, 0));
    });
    lockedAssignments.forEach((a) => {
      totalsByTable.set(a.table_id, (totalsByTable.get(a.table_id) ?? 0) + a.guest_count);
    });

    for (const table of tables as { id: string; label: string }[]) {
      const total = totalsByTable.get(table.id) ?? 0;

      const { data: existingBreakfast } = await supabase
        .from("daily_breakfast")
        .select("id, stays_locked")
        .eq("date", date)
        .eq("table_id", table.id)
        .maybeSingle();

      if (existingBreakfast?.stays_locked && !force) continue;

      const { error } = await supabase.from("daily_breakfast").upsert(
        { date, table_id: table.id, guest_count: total, stays_locked: false },
        { onConflict: "date,table_id" }
      );
      if (error) errors++;
      else updated++;
    }
  }

  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
  return { success: true, updated, skipped, errors };
}

// Roda as três sincronizações (Planejamento Diário, Chegadas & Saídas e
// Mesas do Café) numa única chamada, com o mesmo `force` pras três — o
// gatilho manual único do Resumo Executivo usa esta função (cada tela
// tinha seu próprio botão antes disso; ver CLAUDE.md). Mesmo padrão já
// usado pelo cron (`src/app/api/cron/stays-sync/route.ts`), que sempre
// chamou as três em sequência sem `force`; aqui elas rodam com o `force`
// escolhido no botão. Cada sync já revalida seus próprios caminhos, então
// esta função não precisa de nenhum `revalidatePath` próprio. As três
// rodam mesmo que uma delas falhe — são domínios independentes (suítes,
// hóspedes, mesas), uma falha na Stays num deles não deve impedir as
// outras duas de completarem.
export async function syncStaysAll(options?: SyncOptions) {
  const planning = await syncStaysPlanning(options);
  const arrivalsDepartures = await syncStaysArrivalsDepartures(options);
  const breakfastTables = await syncStaysBreakfastTables(options);
  return { planning, arrivalsDepartures, breakfastTables };
}

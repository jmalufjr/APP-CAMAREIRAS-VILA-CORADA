"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/actions/authz";
import {
  getStaysReservationsIncluding,
  getStaysClientName,
  getStaysListingCalendar,
  getStaysReservationsForStats,
  getStaysGuestReviews,
  getStaysIndicatorData,
  type StaysReservationRaw,
} from "@/lib/stays/client";
import {
  ROOM_GROUPS,
  CHANNELS,
  groupOfRoom,
  monthKeys,
  monthStart,
  monthEnd,
  aggregateReservations,
  baseAverages,
  basePricesByDate,
  type GroupKey,
  type CalendarDayRaw,
  type ReservationForStats,
} from "@/lib/stays/channel-stats";
import { dayNumber, keyFromDayNumber } from "@/lib/stays/calendar";
import { deriveWorkType, daysBetween, type StayTaskHistoryEntry } from "@/lib/stays/derive-planning";
import { assignRoomsToTables, tableNumber, type RoomGuestCount } from "@/lib/stays/derive-breakfast";
import { todayKey, tomorrowKey, yesterdayKey, addDaysKey } from "@/lib/date";
import { normalizeReview } from "@/lib/stays/reviews";
import { computeMonthBases, monthsBetween, IND_CHANNELS, type BlockEntry } from "@/lib/stays/indicators";
import { extractTopicsForPending } from "@/lib/review-topics";
import {
  planExtraCleaning,
  planExtraCleaningV2,
  EXTRA_RULES_V2_START,
  weekStartKey,
  EXTRA_BASE_TYPES,
  type ExtraBaseType,
} from "@/lib/extra-cleaning";
import { revalidatePath } from "next/cache";

// Existe algum lançamento de verdade (frigobar ou bar) numa conta? Usado
// só pra decidir se uma conta órfã (ver abaixo) pode ser apagada sozinha
// (zerada, sem risco nenhum) ou se precisa ficar visível pra alguém
// fechar manualmente (já tem dinheiro de verdade, nunca apagar sem
// decisão humana). Consulta enxuta (limit 1 nas duas), sem calcular total.
async function billHasAnyConsumption(
  supabase: ReturnType<typeof createAdminClient>,
  billId: string
): Promise<boolean> {
  const [{ data: mb }, { data: pb }] = await Promise.all([
    supabase.from("room_bill_minibar_items").select("id").eq("bill_id", billId).gt("quantity", 0).limit(1),
    supabase
      .from("bar_comanda_items")
      .select("id, bar_comandas!inner(bill_id, status)")
      .eq("bar_comandas.bill_id", billId)
      .neq("bar_comandas.status", "cancelada")
      .gt("quantity", 0)
      .limit(1),
  ]);
  return (mb?.length ?? 0) > 0 || (pb?.length ?? 0) > 0;
}

// Apaga sozinha qualquer conta não-paga da suíte cujo número de reserva
// não seja o da reserva ativa de hoje (ou não haja reserva ativa nenhuma)
// — desde que ela esteja zerada (sem nenhum consumo lançado) E não seja a
// conta de quem fez check-out justamente HOJE. Cobre suítes que ficaram
// vagas depois de um "Somente Saída" sem chegada no mesmo dia (a conta
// 'única' antiga nunca era revisitada nesse caso) — exemplo real: reserva
// de uma hóspede que já tinha feito checkout **em dias anteriores**, sem
// nenhum consumo, ficava pendurada como se precisasse ser fechada
// manualmente, sem necessidade nenhuma.
//
// **Nunca apaga no mesmo dia do check-out** (mesmo zerada): o hóspede pode
// ainda estar na pousada consumindo (ex.: bar da piscina) depois do
// check-out da suíte — vale tanto pra quem está saindo de vez quanto pra
// quem troca de suíte no mesmo dia (a conta antiga só passa a ser
// candidata à limpeza automática a partir de amanhã, quando deixar de ser
// "o checkout de hoje" desta suíte — ver `checkingOutReservationId`).
//
// Contas com alguma reserva ainda não carimbada (`stays_reservation_id`
// nulo) nunca são tocadas aqui — não temos como saber se "acabaram" sem
// esse número. Nunca apaga uma conta com consumo real lançado, mesmo que a
// reserva dela não seja mais a ativa — fica visível em "Consumo por
// quartos" até alguém fechar manualmente (integridade de cobrança em
// primeiro lugar).
async function cleanupStaleBills(
  supabase: ReturnType<typeof createAdminClient>,
  roomId: string,
  activeReservationId: string | null,
  checkingOutReservationId: string | null
): Promise<void> {
  const { data: bills } = await supabase
    .from("room_bills")
    .select("id, stays_reservation_id")
    .eq("room_id", roomId)
    .neq("status", "paga");

  for (const bill of bills ?? []) {
    if (!bill.stays_reservation_id) continue; // nunca foi carimbada — a lógica normal decide o que fazer com ela
    if (bill.stays_reservation_id === activeReservationId) continue; // é a conta do ocupante atual, nunca mexe
    if (bill.stays_reservation_id === checkingOutReservationId) continue; // check-out de hoje — nunca no mesmo dia, ver comentário acima

    const hasConsumption = await billHasAnyConsumption(supabase, bill.id);
    if (!hasConsumption) {
      await supabase.from("room_bills").delete().eq("id", bill.id);
    }
  }
}

// Garante que a conta que representa quem está na suíte hoje (chegando,
// ficando, ou saindo, nessa ordem de prioridade — ver "reserva ativa" no
// loop de syncStaysPlanning) está ligada à reserva certa da Stays, com o
// nome do hóspede sempre preenchido assim que soubermos quem é — e, se a
// suíte trocou de ocupante desde a última conta que existia ali (seja um
// "Saída com Chegada" no mesmo dia, seja um hóspede novo chegando dias
// depois de outro sem pagar), abre uma conta nova pro ocupante atual em
// vez de misturar consumo.
//
// Antes de tudo, roda cleanupStaleBills (acima) — por isso qualquer conta
// zerada e desatualizada já não existe mais neste ponto; o que sobra e
// não bate com a reserva ativa de hoje sempre tem consumo real, e por
// isso nunca é mexido além de ficar visível pra fechamento manual.
//
// Idempotente (não faz nada além do necessário se já está tudo certo).
// Roda sempre, com ou sem `force`, e mesmo quando não há reserva ativa
// nenhuma pra suíte hoje (`activeReservation` pode ser `null`, só pra
// permitir a limpeza) — diferente de stays_locked/lápides, isso não é
// uma preferência do admin, é integridade de cobrança.
async function syncRoomBillForActiveReservation(
  supabase: ReturnType<typeof createAdminClient>,
  roomId: string,
  activeReservation: StaysReservationRaw | null,
  checkingOutReservation: StaysReservationRaw | null,
  arrivingClientToRoomToday: Map<string, string>,
  nameCache: Map<string, string>
) {
  async function resolveName(clientId: string): Promise<string | null> {
    const cached = nameCache.get(clientId);
    if (cached) return cached;
    const name = await getStaysClientName(clientId).catch(() => null);
    if (name) nameCache.set(clientId, name);
    return name;
  }

  await cleanupStaleBills(supabase, roomId, activeReservation?._id ?? null, checkingOutReservation?._id ?? null);

  // Troca de suíte: se quem faz check-out hoje já tem uma reserva ativa em
  // OUTRA suíte hoje (ex.: Hudson Lima saindo da Suíte 10 pra entrar na
  // Suíte 3), a conta desta suíte não deve mais poder receber comandas
  // novas — só a conta da suíte nova, que o hóspede já ocupa. A conta em
  // si continua existindo e visível normalmente (fechar/pagar) até a
  // camareira encerrar; só sai do seletor de "novo pedido" de comanda.
  if (checkingOutReservation) {
    const newRoomId = arrivingClientToRoomToday.get(checkingOutReservation._idclient);
    if (newRoomId && newRoomId !== roomId) {
      await supabase
        .from("room_bills")
        .update({ available_for_new_orders: false })
        .eq("room_id", roomId)
        .eq("stays_reservation_id", checkingOutReservation._id)
        .neq("status", "paga");
    }
  }

  if (!activeReservation) return; // nada mais a fazer sem reserva ativa hoje

  const { data: chegada } = await supabase
    .from("room_bills")
    .select("id, stays_reservation_id, guest_name_hint")
    .eq("room_id", roomId)
    .eq("guest_slot", "chegada_hoje")
    .neq("status", "paga")
    .maybeSingle();

  const currentSlot: "chegada_hoje" | "unica" = chegada ? "chegada_hoje" : "unica";
  const current =
    chegada ??
    (
      await supabase
        .from("room_bills")
        .select("id, stays_reservation_id, guest_name_hint")
        .eq("room_id", roomId)
        .eq("guest_slot", "unica")
        .neq("status", "paga")
        .maybeSingle()
    ).data;

  if (!current) return; // nenhuma conta aberta ainda — carimbada quando nascer, no próximo ciclo

  if (current.stays_reservation_id === activeReservation._id) {
    // Já certo — mas garante que o nome também está preenchido (pode ter
    // sido carimbado antes desse campo passar a ser usado de verdade).
    if (!current.guest_name_hint) {
      const name = await resolveName(activeReservation._idclient);
      if (name) await supabase.from("room_bills").update({ guest_name_hint: name }).eq("id", current.id);
    }
    return;
  }

  if (!current.stays_reservation_id) {
    // Primeira vez vendo essa conta: preenche reserva e nome, sem mexer
    // em mais nada.
    const name = await resolveName(activeReservation._idclient);
    await supabase
      .from("room_bills")
      .update({ stays_reservation_id: activeReservation._id, guest_name_hint: name })
      .eq("id", current.id);
    return;
  }

  // Referência já preenchida, mas pra uma reserva diferente da ativa hoje
  // — a suíte trocou de ocupante. Só sabemos "recomeçar do zero" a partir
  // do slot 'unica' (o par saida_hoje/chegada_hoje já foi usado); se essa
  // 'chegada_hoje' chegou até aqui apesar de não bater com a reserva ativa,
  // é porque cleanupStaleBills já confirmou que ela tem consumo real —
  // fica como está, precisa de fechamento manual.
  if (currentSlot !== "unica") return;

  // Tenta preencher também o nome de quem está saindo, se ainda não
  // soubermos — só quando a reserva de saída de hoje bate exatamente com
  // a que essa conta já tinha (evita atribuir nome errado por engano).
  const departingName =
    checkingOutReservation && checkingOutReservation._id === current.stays_reservation_id && !current.guest_name_hint
      ? await resolveName(checkingOutReservation._idclient)
      : null;

  await supabase
    .from("room_bills")
    .update({ guest_slot: "saida_hoje", ...(departingName ? { guest_name_hint: departingName } : {}) })
    .eq("id", current.id);

  const inName = await resolveName(activeReservation._idclient);
  await supabase.from("room_bills").insert({
    room_id: roomId,
    status: "aberta",
    guest_slot: "chegada_hoje",
    guest_name_hint: inName,
    stays_reservation_id: activeReservation._id,
  });
}

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
// Limpeza adicional (PRD_limpeza_adicional.md): marca, entre as tarefas de troca / saída com chegada /
// somente saída ainda pendentes e sem camareira, as que recebem o acréscimo nesta semana, e copia os
// itens extras para o checklist delas. Complementa as vagas que faltam; nunca mexe em tarefa já
// escolhida, iniciada ou já marcada. Roda a cada sincronização (hoje e amanhã).
async function allocateExtraCleaning(supabase: ReturnType<typeof createAdminClient>, days: string[], force = false) {
  const addDays = (key: string, n: number) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };
  const weeks = Array.from(new Set(days.map((d) => weekStartKey(d))));
  let marked = 0;

  for (const wk of weeks) {
    const weekDays = days.filter((d) => weekStartKey(d) === wk);
    const weekEnd = addDays(wk, 6);

    const { data: flaggedRows } = await supabase
      .from("daily_room_tasks")
      .select("date, room_id")
      .eq("extra_cleaning", true)
      .neq("status", "cancelado")
      .gte("date", wk)
      .lte("date", weekEnd);
    const flagged = (flaggedRows ?? []).map((r) => ({ date: r.date as string, roomId: r.room_id as string }));

    // Suítes que ficaram sem a limpeza adicional na semana anterior vêm primeiro (só se houve
    // alguma limpeza adicional lá — na primeira semana de uso ninguém tem prioridade).
    const { data: prevRows } = await supabase
      .from("daily_room_tasks")
      .select("room_id")
      .eq("extra_cleaning", true)
      .neq("status", "cancelado")
      .gte("date", addDays(wk, -7))
      .lte("date", addDays(wk, -1));
    let priorityRooms = new Set<string>();
    if ((prevRows ?? []).length > 0) {
      const done = new Set((prevRows ?? []).map((r) => r.room_id as string));
      const { data: allRooms } = await supabase.from("rooms").select("id").eq("active", true);
      priorityRooms = new Set((allRooms ?? []).map((r) => r.id as string).filter((id) => !done.has(id)));
    }

    const { data: taskRows } = await supabase
      .from("daily_room_tasks")
      .select("id, date, room_id, task_type, extra_cleaning_locked, rooms(number)")
      .in("date", weekDays)
      .in("task_type", EXTRA_BASE_TYPES)
      .eq("status", "pendente")
      .is("assigned_to", null)
      .eq("extra_cleaning", false);
    // Tarefas que o admin/gerente editou (incluiu ou excluiu a limpeza adicional) ficam de fora da escolha
    // automática; só a sincronização total (force) as devolve ao sorteio.
    const taskRowsFiltered = force ? (taskRows ?? []) : (taskRows ?? []).filter((t) => !(t as { extra_cleaning_locked?: boolean }).extra_cleaning_locked);

    const candidates = taskRowsFiltered.map((t) => {
      const room = t.rooms as unknown as { number: string } | { number: string }[] | null;
      const number = Array.isArray(room) ? room[0]?.number : room?.number;
      return {
        taskId: t.id as string,
        date: t.date as string,
        roomId: t.room_id as string,
        roomNumber: Number(number) || 0,
        type: t.task_type as ExtraBaseType,
      };
    });

    // Dias anteriores a EXTRA_RULES_V2_START seguem a regra antiga; a partir dele vale a nova (teto do dia
    // conforme quantas suítes têm serviço, máximo 3, e ordem de prioridade dos dias da semana).
    const legacyDays = weekDays.filter((d) => d < EXTRA_RULES_V2_START);
    const v2Days = weekDays.filter((d) => d >= EXTRA_RULES_V2_START);
    const chosen: string[] = [];
    if (legacyDays.length > 0) {
      chosen.push(...planExtraCleaning({ days: legacyDays, flagged, candidates, priorityRooms }));
    }
    if (v2Days.length > 0) {
      const { data: serviceRows } = await supabase
        .from("daily_room_tasks")
        .select("date, room_id")
        .in("date", v2Days)
        .neq("status", "cancelado");
      const roomsByDate = new Map<string, Set<string>>();
      (serviceRows ?? []).forEach((r) => {
        const set = roomsByDate.get(r.date as string) ?? new Set<string>();
        set.add(r.room_id as string);
        roomsByDate.set(r.date as string, set);
      });
      const suitesWithServiceByDate = new Map(Array.from(roomsByDate.entries()).map(([d, s]) => [d, s.size]));
      // O que a regra antiga acabou de escolher já conta como marcado (uma por suíte por semana).
      const legacyChosenFlags = chosen.map((id) => {
        const c = candidates.find((x) => x.taskId === id)!;
        return { date: c.date, roomId: c.roomId };
      });
      chosen.push(
        ...planExtraCleaningV2({
          days: v2Days,
          flagged: [...flagged, ...legacyChosenFlags],
          candidates: candidates.filter((c) => !chosen.includes(c.taskId)),
          priorityRooms,
          suitesWithServiceByDate,
        })
      );
    }
    for (const taskId of chosen) {
      const cand = candidates.find((c) => c.taskId === taskId)!;
      const { error } = await supabase
        .from("daily_room_tasks")
        .update({ extra_cleaning: true, extra_cleaning_locked: false })
        .eq("id", taskId)
        .eq("status", "pendente")
        .is("assigned_to", null);
      if (error) continue;

      const { data: items } = await supabase
        .from("room_checklist_items")
        .select("checklist_item_id, checklist_items!inner(type, active)")
        .eq("room_id", cand.roomId)
        .eq("checklist_items.type", "limpeza_adicional")
        .eq("checklist_items.active", true);
      if (items && items.length > 0) {
        await supabase.from("daily_room_task_checks").insert(
          items.map((i) => ({ daily_room_task_id: taskId, checklist_item_id: i.checklist_item_id }))
        );
      }
      marked++;
    }
  }
  return marked;
}

export async function syncStaysPlanning(options?: SyncOptions) {
  if (options?.force) {
    // Sincronização Total (sobrescreve edições do admin): só o administrador.
    const deniedForce = await requireRole(["admin"]);
    if (deniedForce) return { error: deniedForce.error };
  }
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

  // Quem chega em qual suíte HOJE, por cliente — usado só pra detectar
  // troca de suíte (o mesmo hóspede saindo de uma suíte e entrando em
  // outra no mesmo dia): a conta da suíte antiga não pode mais receber
  // comandas novas depois disso (ver syncRoomBillForActiveReservation).
  const today = todayKey();
  const arrivingClientToRoomToday = new Map<string, string>();
  (rooms as { id: string; stays_listing_id: string }[]).forEach((room) => {
    const roomReservations = byListing.get(room.stays_listing_id) ?? [];
    const checkingIn = roomReservations.find((r) => r.checkInDate === today);
    if (checkingIn) arrivingClientToRoomToday.set(checkingIn._idclient, room.id);
  });

  // Histórico dos serviços da estadia de cada suíte, para a regra de troca saber o que de fato
  // aconteceu (troca feita, antecipada a pedido do hóspede, cancelada, recusada ou não feita).
  // Serviço de dias passados só conta como troca se foi realmente executado; o de hoje (usado ao
  // calcular amanhã) conta enquanto não for cancelado/recusado.
  const doneStatuses = new Set(["concluido", "aguardando_revisao", "em_revisao", "aguardando_correcao", "em_correcao"]);
  const historyByRoom = new Map<string, StayTaskHistoryEntry[]>();
  const stayStarts = reservations.map((r) => r.checkInDate).filter((d) => d < today);
  if (stayStarts.length > 0) {
    const earliest = stayStarts.reduce((a, b) => (a < b ? a : b));
    const { data: pastTasks } = await supabase
      .from("daily_room_tasks")
      .select("room_id, date, task_type, status, bedlinen_changed")
      .gte("date", earliest)
      .lte("date", today);
    (pastTasks ?? []).forEach((t) => {
      const executed = t.date < today ? doneStatuses.has(t.status as string) : t.status !== "cancelado";
      const isTroca = t.task_type === "troca" || (t.task_type === "arrumacao" && t.bedlinen_changed === true);
      const list = historyByRoom.get(t.room_id as string) ?? [];
      list.push({ date: t.date as string, trocaDone: executed && isTroca });
      historyByRoom.set(t.room_id as string, list);
    });
  }

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
  const planningClientNameCache = new Map<string, string>();

  for (const date of dates) {
    for (const room of rooms as { id: string; stays_listing_id: string }[]) {
      const roomReservations = byListing.get(room.stays_listing_id) ?? [];
      const desiredType = deriveWorkType(roomReservations, date, historyByRoom.get(room.id) ?? []);

      // O carimbo/divisão de conta só importa pro dia corrente (é sobre
      // cobrança acontecendo agora, não sobre planejamento de amanhã) —
      // roda pra qualquer suíte, mesmo sem nenhuma reserva tocando hoje
      // (pra poder limpar uma conta órfã deixada por uma troca de suíte —
      // ver syncRoomBillForActiveReservation): prioridade chegando >
      // ficando > saindo pra decidir qual é "a reserva ativa" da suíte.
      if (date === todayKey()) {
        const checkingIn = roomReservations.find((r) => r.checkInDate === date);
        const staying = roomReservations.find((r) => r.checkInDate < date && date < r.checkOutDate);
        const checkingOut = roomReservations.find((r) => r.checkOutDate === date);
        const activeReservation = checkingIn ?? staying ?? checkingOut ?? null;
        await syncRoomBillForActiveReservation(
          supabase,
          room.id,
          activeReservation,
          checkingOut ?? null,
          arrivingClientToRoomToday,
          planningClientNameCache
        );
      }

      const { data: existing } = await supabase
        .from("daily_room_tasks")
        .select("id, task_type, status, assigned_to, stays_locked, review_required")
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
        .insert({
          date,
          room_id: room.id,
          task_type: desiredType,
          stays_locked: false,
          // Se o admin habilitou a revisão e a tarefa é recriada por mudança de tipo, a escolha é mantida.
          review_required: existing?.review_required ?? false,
        })
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

  const extraMarked = await allocateExtraCleaning(supabase, dates, force);

  revalidatePath("/planejamento");
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  return { success: true, updated, skipped, extraMarked };
}

// Sincroniza Chegadas & Saídas (hoje + amanhã) com as reservas da Stays —
// ver PRD_regrasdenegocio.md seção 3. O nome do hóspede não vem no payload
// da reserva, precisa de uma chamada extra por cliente (com cache local
// pra não repetir a mesma chamada quando o mesmo hóspede aparece em mais de
// um quarto/dia, o que não deveria acontecer mas é barato de evitar).
// `force` (ver `SyncOptions`) ignora `stays_locked` em ambas as tabelas.
export async function syncStaysArrivalsDepartures(options?: SyncOptions) {
  if (options?.force) {
    // Sincronização Total (sobrescreve edições do admin): só o administrador.
    const deniedForce = await requireRole(["admin"]);
    if (deniedForce) return { error: deniedForce.error };
  }
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

      // Saídas: existência da linha e nome do hóspede são sincronizados
      // (mesmo padrão de daily_arrivals.guest_name) — observações nunca
      // são tocadas.
      const { data: existingDeparture } = await supabase
        .from("daily_departures")
        .select("id, guest_name, stays_locked")
        .eq("date", date)
        .eq("room_id", room.id)
        .maybeSingle();

      if (existingDeparture?.stays_locked && !force) {
        skipped++;
      } else if (checkingOut) {
        const departureGuestName = await resolveGuestName(checkingOut._idclient);
        if (!existingDeparture) {
          const { error } = await supabase
            .from("daily_departures")
            .insert({ date, room_id: room.id, guest_name: departureGuestName, stays_locked: false });
          if (!error) updated++;
        } else if (existingDeparture.guest_name !== departureGuestName) {
          // Backfill do nome em linhas antigas (de antes desta coluna
          // existir) ou correção se o nome resolvido mudou.
          const { error } = await supabase
            .from("daily_departures")
            .update({ guest_name: departureGuestName, updated_at: new Date().toISOString() })
            .eq("id", existingDeparture.id);
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
  if (options?.force) {
    // Sincronização Total (sobrescreve edições do admin): só o administrador.
    const deniedForce = await requireRole(["admin"]);
    if (deniedForce) return { error: deniedForce.error };
  }
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
  // O gerente operacional só pode a sincronização Parcial (sem force); a Total é só do admin.
  const denied = await requireRole(options?.force ? ["admin"] : ["admin", "gerente_operacional"]);
  if (denied) {
    const e = { error: denied.error };
    return { planning: e, arrivalsDepartures: e, breakfastTables: e, channelStats: e, guestReviews: e, indicators: e };
  }
  const planning = await syncStaysPlanning(options);
  const arrivalsDepartures = await syncStaysArrivalsDepartures(options);
  const breakfastTables = await syncStaysBreakfastTables(options);
  const channelStats = await syncStaysChannelStats();
  const guestReviews = await syncStaysGuestReviews();
  const indicators = await syncStaysIndicators();
  return { planning, arrivalsDepartures, breakfastTables, channelStats, guestReviews, indicators };
}

// Ticket médio de canais de venda (tela "Ticket médio de canais de venda"): busca na
// Stays o preço base de cada dia (calendário de cada suíte) e as reservas dos próximos
// 6 meses, e grava, por grupo de suítes × canal × mês, as diárias reservadas, o valor
// cobrado nelas e o preço base médio cadastrado. A correção de preço de cada canal NÃO é
// gravada aqui (o admin a digita na tela) — a tela aplica em cima do preço base. Roda no
// cron diário e junto dos botões de sincronização.
export async function syncStaysChannelStats() {
  const supabase = createAdminClient();
  const today = todayKey();
  const months = monthKeys(today, 6);
  const rangeFrom = months[0];
  const rangeTo = monthEnd(months[months.length - 1]);

  const { data: rooms, error: roomsError } = await supabase.from("rooms").select("number, stays_listing_id");
  if (roomsError) return { error: roomsError.message };

  const listingToGroup = new Map<string, GroupKey>();
  for (const r of rooms ?? []) {
    const group = groupOfRoom(r.number);
    if (group && r.stays_listing_id) listingToGroup.set(r.stays_listing_id, group);
  }

  let errors = 0;
  const calendars = new Map<string, CalendarDayRaw[]>();
  for (const listing of listingToGroup.keys()) {
    try {
      calendars.set(listing, await getStaysListingCalendar(listing, rangeFrom, rangeTo));
    } catch {
      errors += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 300)); // respeita o limite de chamadas da Stays
  }
  // Sem nenhum calendário não há como calcular o preço cadastrado: melhor falhar do que gravar vazio.
  if (calendars.size === 0 && listingToGroup.size > 0) {
    return { error: "Não foi possível ler os preços cadastrados na Stays." };
  }

  let reservations;
  try {
    // começa um dia antes: mesmo cuidado das outras sincronizações (ver Parte 23)
    reservations = await getStaysReservationsForStats(keyFromDayNumber(dayNumber(rangeFrom) - 1), rangeTo);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao consultar as reservas na Stays." };
  }

  const agg = aggregateReservations(reservations, listingToGroup, months, basePricesByDate(calendars));
  const base = baseAverages(calendars, listingToGroup, months);

  const rowsToSave = [];
  for (const g of ROOM_GROUPS) {
    for (const c of CHANNELS) {
      for (const m of months) {
        const cell = agg.get(`${g.key}|${c.key}|${m}`);
        const b = base.get(`${g.key}|${m}`);
        rowsToSave.push({
          group_key: g.key,
          channel: c.key,
          month: m,
          nights: cell?.nights ?? 0,
          charged_total: cell?.charged ?? 0,
          base_avg: b?.avg ?? null,
          base_days: b?.days ?? 0,
          registered_total: cell?.registered ?? 0,
          matched_nights: cell?.matchedNights ?? 0,
          matched_charged: cell?.matchedCharged ?? 0,
          synced_at: new Date().toISOString(),
        });
      }
    }
  }
  const { error: upsertError } = await supabase.from("channel_ticket_stats").upsert(rowsToSave);
  if (upsertError) return { error: upsertError.message };
  // meses que já saíram da janela de 6 meses não são mais mostrados
  await supabase.from("channel_ticket_stats").delete().lt("month", months[0]);

  revalidatePath("/dashboard/ticket-medio-canais");
  return { success: true as const, updated: rowsToSave.length, skipped: 0, errors };
}

// Avaliações de hóspedes (tela "Avaliações dos hóspedes"): traz da Stays todas as avaliações
// disponíveis e guarda/atualiza a cópia em guest_reviews. As novas recebem first_seen_at = agora
// (é isso que a tela mostra como "novas"); na PRIMEIRA importação o first_seen_at é a data da própria
// avaliação, para o histórico antigo não aparecer todo como novo. Nunca apaga nada, nem mexe na
// resposta registrada. Depois, a IA lê os comentários ainda não lidos (melhor esforço).
// Texto estável de um valor (chaves em ordem alfabética): o banco guarda jsonb com as chaves
// reordenadas, então comparar JSON.stringify direto acusaria mudança que não existe.
function canon(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ":" + canon((v as Record<string, unknown>)[k])).join(",") + "}";
  }
  return JSON.stringify(v ?? null);
}

export async function syncStaysGuestReviews() {
  const supabase = createAdminClient();
  try {
    const { data: rooms } = await supabase.from("rooms").select("number, stays_listing_id");
    const suiteByListing = new Map<string, string>();
    (rooms ?? []).forEach((r) => {
      if (r.stays_listing_id) suiteByListing.set(r.stays_listing_id as string, String(Number(r.number) || r.number));
    });

    const raw = await getStaysGuestReviews(todayKey(), true);
    const reviews = raw.map((r) => normalizeReview(r, suiteByListing));

    const { data: existing } = await supabase.from("guest_reviews").select("id, rating, items, comments, suite_number");
    const known = new Map(
      (existing ?? []).map((e) => [e.id as string, canon([e.rating === null ? null : Number(e.rating), e.items, e.comments, e.suite_number])])
    );
    const firstImport = known.size === 0;
    const nowIso = new Date().toISOString();

    const toInsert: Record<string, unknown>[] = [];
    let updated = 0;
    for (const r of reviews) {
      const base = {
        day: r.day,
        channel: r.channel,
        suite_number: r.suite,
        guest_name: r.guestName,
        reservation_code: r.reservationCode,
        stays_status: r.status,
        rating: r.rating,
        items: r.items,
        comments: r.comments,
        synced_at: nowIso,
      };
      const prev = known.get(r.id);
      if (prev === undefined) {
        toInsert.push({ id: r.id, ...base, first_seen_at: firstImport ? `${r.day}T12:00:00Z` : nowIso });
      } else if (prev !== canon([r.rating, r.items, r.comments, r.suite])) {
        // Conteúdo mudou na Stays: atualiza e manda a IA reler os comentários.
        const { error } = await supabase.from("guest_reviews").update({ ...base, topics_read_at: null }).eq("id", r.id);
        if (!error) updated++;
      }
    }
    for (let i = 0; i < toInsert.length; i += 200) {
      const { error } = await supabase.from("guest_reviews").insert(toInsert.slice(i, i + 200));
      if (error) return { error: error.message };
    }

    const topics = await extractTopicsForPending(supabase, 40);
    revalidatePath("/dashboard/avaliacoes");
    revalidatePath("/dashboard/avaliacoes-medias");
    revalidatePath("/dashboard/avaliacoes-temas");
    return { success: true, inserted: toInsert.length, updated, total: reviews.length, topics };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao sincronizar as avaliações." };
  }
}

// Indicadores (tela "Indicadores"): traz da Stays as reservas com preço e os bloqueios/manutenção e
// guarda a base de cada mês (diárias pagas/gratuitas e receita por canal, noites bloqueadas e em
// manutenção). A tela lê só dessas tabelas. Sem nada guardado ainda (ou com `full`), importa todo o
// histórico; nas demais vezes refaz de 3 meses atrás até 6 meses à frente (o passado distante não muda).
export async function syncStaysIndicators(options?: { full?: boolean }) {
  const supabase = createAdminClient();
  try {
    const { data: rooms } = await supabase.from("rooms").select("stays_listing_id").eq("active", true).not("stays_listing_id", "is", null);
    const listingIds = new Set((rooms ?? []).map((r) => r.stays_listing_id as string));
    if (listingIds.size === 0) return { error: "Nenhuma suíte com stays_listing_id configurado." };

    const { count } = await supabase.from("indicator_months").select("month", { count: "exact", head: true });
    const full = options?.full === true || (count ?? 0) === 0;

    const today = todayKey();
    const lastMonth = monthKeys(today, 7)[6];
    const toKey = monthEnd(lastMonth);
    const fromKey = full ? null : monthStart(addDaysKey(today, -90));

    const data = await getStaysIndicatorData(fromKey, toKey);
    const starts = [...data.reservations.map((r) => r.checkInDate), ...data.blocks.map((b) => b.checkInDate)].sort();
    const firstMonth = fromKey ? monthStart(fromKey) : starts.length > 0 ? monthStart(starts[0]) : monthStart(today);
    const months = monthsBetween(firstMonth, lastMonth);

    const bases = computeMonthBases(
      data.reservations as ReservationForStats[],
      data.blocks.filter((b) => b.type === "blocked" || b.type === "maintenance") as BlockEntry[],
      listingIds,
      months
    );

    const nowIso = new Date().toISOString();
    const monthRows = months.map((m) => ({
      month: m,
      rooms: listingIds.size,
      blocked_nights: bases.get(m)!.blocked,
      maintenance_nights: bases.get(m)!.maintenance,
      synced_at: nowIso,
    }));
    const channelRows = months.flatMap((m) =>
      IND_CHANNELS.map(({ key }) => {
        const c = bases.get(m)!.channels[key];
        return {
          month: m,
          channel: key,
          paid_nights: c.paid,
          free_nights: c.free,
          revenue: Math.round(c.revenue * 100) / 100,
          commission_actual: Math.round(c.commissionActual * 100) / 100,
          revenue_with_commission: Math.round(c.revenueWithCommission * 100) / 100,
        };
      })
    );

    const { error: e1 } = await supabase.from("indicator_months").upsert(monthRows, { onConflict: "month" });
    if (e1) return { error: e1.message };
    for (let i = 0; i < channelRows.length; i += 300) {
      const { error: e2 } = await supabase.from("indicator_month_channels").upsert(channelRows.slice(i, i + 300), { onConflict: "month,channel" });
      if (e2) return { error: e2.message };
    }
    revalidatePath("/dashboard/indicadores");
    return { success: true, months: months.length, full };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao sincronizar os indicadores." };
  }
}

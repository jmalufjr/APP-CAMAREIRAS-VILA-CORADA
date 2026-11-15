import { formatDateShortPt } from "@/lib/date";

// Rótulo compartilhado das contas: toda conta é identificada pela dupla
// suíte + hóspede (a referência da reserva na Stays fica escondida). Em
// "Consumo por suítes" também mostra as datas da estadia (withDates) para
// diferenciar duas contas com o mesmo nome (ex.: hóspede que voltou depois).
export function roomSlotLabel(
  room: {
    room_number: string;
    guestNameHint: string | null;
    stayCheckIn?: string | null;
    stayCheckOut?: string | null;
  },
  options: { withDates?: boolean } = {}
): string {
  const base = room.guestNameHint ? `Suíte ${room.room_number} — ${room.guestNameHint}` : `Suíte ${room.room_number}`;
  if (options.withDates && room.stayCheckIn && room.stayCheckOut) {
    return `${base} (${formatDateShortPt(room.stayCheckIn)} a ${formatDateShortPt(room.stayCheckOut)})`;
  }
  return base;
}

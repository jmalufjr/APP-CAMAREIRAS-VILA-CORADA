import type { RoomBillGuestSlot } from "@/lib/types";

// Rótulo compartilhado por "Consumo por quartos" (camareira e admin):
// toda conta é identificada pela dupla suíte/hóspede — mostra o nome
// assim que a sincronização com a Stays já souber quem é (a maioria dos
// casos, mesmo numa estadia contínua sem nenhuma divisão de conta). Só
// cai de volta pra "saída de hoje"/"chegada de hoje" (sem nome) quando o
// hóspede daquela conta específica ainda não foi identificado.
export function roomSlotLabel(room: {
  room_number: string;
  guestSlot: RoomBillGuestSlot;
  guestNameHint: string | null;
}): string {
  if (room.guestNameHint) return `Suíte ${room.room_number} — ${room.guestNameHint}`;
  if (room.guestSlot === "unica") return `Suíte ${room.room_number}`;
  const situacao = room.guestSlot === "saida_hoje" ? "saída de hoje" : "chegada de hoje";
  return `Suíte ${room.room_number} (${situacao})`;
}

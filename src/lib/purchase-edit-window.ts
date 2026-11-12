import { addDaysKey } from "@/lib/date";

// Uma despesa pode ser editada até `windowDays` dias depois do fim do mês da sua data.
export function purchaseEditDeadline(date: string, windowDays: number): string {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthEnd = `${date.slice(0, 7)}-${String(last).padStart(2, "0")}`;
  return addDaysKey(monthEnd, windowDays);
}

export function isPurchaseEditable(date: string, today: string, windowDays: number): boolean {
  return today <= purchaseEditDeadline(date, windowDays);
}

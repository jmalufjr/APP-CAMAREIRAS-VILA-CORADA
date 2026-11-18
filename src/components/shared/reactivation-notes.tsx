import type { ReactivationEntry } from "@/lib/room-bills";
import { formatDateTimePt } from "@/lib/date";

// Rodapé do card de uma conta que já foi informada como paga por engano e reaberta pelo administrador.
export function ReactivationNotes({ log }: { log: ReactivationEntry[] }) {
  if (!log || log.length === 0) return null;
  return (
    <div className="space-y-0.5 border-t border-border pt-2">
      {log.map((e, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          Conta informada como paga em {e.paid_at ? formatDateTimePt(e.paid_at) : "—"}
          {e.paid_by_name ? ` por ${e.paid_by_name}` : ""} e reaberta pelo administrador em {formatDateTimePt(e.reopened_at)}
          {e.reopened_by_name ? ` (${e.reopened_by_name})` : ""}.
        </p>
      ))}
    </div>
  );
}

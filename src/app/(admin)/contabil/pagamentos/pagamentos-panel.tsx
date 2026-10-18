"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { payExpense } from "@/lib/actions/expenses";
import type { PendingExpenseRow } from "@/lib/actions/expenses";
import type { SupplierPaymentMethod } from "@/lib/types";
import { SETTLEMENT_PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CircleDollarSign } from "lucide-react";

function formatDatePt(dateKey: string): string {
  return dateKey.split("-").reverse().join("/");
}

export function PagamentosPanel({ rows }: { rows: PendingExpenseRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.total_amount, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Total pendente: R$ {total.toFixed(2)}</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="text-sm font-medium">
                {r.supplier_name ?? "Sem fornecedor"} · R$ {r.total_amount.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Lançada em {formatDatePt(r.date)}
                {r.due_date ? ` · vencimento ${formatDatePt(r.due_date)}` : ""}
                {r.notes ? ` · ${r.notes}` : ""}
              </p>
            </div>
            <PayDialog expenseId={r.id} />
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma despesa pendente de pagamento.</p>
        )}
      </div>
    </div>
  );
}

function PayDialog({ expenseId }: { expenseId: string }) {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    startTransition(async () => {
      const result = await payExpense(expenseId, paymentMethod as SupplierPaymentMethod);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pagamento registrado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><CircleDollarSign size={14} /> Registrar pagamento</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>
        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Forma de pagamento">
              {(v: string) => SETTLEMENT_PAYMENT_METHOD_OPTIONS.find((o) => o.value === v)?.label ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SETTLEMENT_PAYMENT_METHOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Registrando..." : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

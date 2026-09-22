"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAccountingEmail } from "@/lib/actions/room-bills";
import type { ReceiptSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Movido de "Consumo de Bar e Frigobar" pra cá (ver CLAUDE.md Parte 34) —
// o mesmo e-mail agora serve dois propósitos: recibo em PDF de conta paga
// (envio automático, "melhor esforço") e demonstrativo de comissões das
// camareiras (envio manual, sob clique do admin). O nome interno da
// coluna/tabela continua "accounting_email"/"receipt_settings" — só o
// texto visível mudou.
export function EmailEnvioSettings({ receiptSettings }: { receiptSettings: ReceiptSettings }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [email, setEmail] = useState(receiptSettings.accounting_email ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await updateAccountingEmail(email);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("E-mail atualizado.");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">E-mail de envio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Input
          type="email"
          className="w-full sm:w-72"
          placeholder="contabilidade@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
        />
        <Button disabled={isPending} onClick={handleSave}>
          Salvar
        </Button>
        <p className="text-xs text-muted-foreground basis-full">
          É pra este e-mail que o recibo em PDF de uma conta é enviado automaticamente assim que a camareira
          informa o pagamento, e também pra onde o demonstrativo de comissões das camareiras pode ser enviado, em
          &ldquo;Comissões das camareiras&rdquo;.
        </p>
      </CardContent>
    </Card>
  );
}

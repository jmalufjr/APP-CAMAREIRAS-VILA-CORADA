"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTelegramStatus, createTelegramLink, unlinkTelegram, sendTelegramTest } from "@/lib/actions/telegram";

// Avisos de nova ocorrência de manutenção pelo Telegram: ativar (abre o bot), testar e desativar.
export function TelegramSettings() {
  const [status, setStatus] = useState<{ configured: boolean; linked: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => getTelegramStatus().then(setStatus);

  useEffect(() => {
    let active = true;
    const refresh = () => getTelegramStatus().then((s) => active && setStatus(s));
    refresh();
    // Ao voltar do Telegram para o app, confere se a ligação foi feita.
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function activate() {
    startTransition(async () => {
      const res = await createTelegramLink();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("url" in res && res.url) window.location.href = res.url;
    });
  }

  function test() {
    startTransition(async () => {
      const res = await sendTelegramTest();
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Teste enviado. Veja o Telegram.");
    });
  }

  function disable() {
    startTransition(async () => {
      const res = await unlinkTelegram();
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Avisos pelo Telegram desativados.");
      await load();
    });
  }

  if (!status) return null;
  const on = status.linked > 0;

  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {on ? <BellRing size={22} className="shrink-0 text-emerald-600" /> : <Send size={22} className="shrink-0 text-muted-foreground" />}
          <div className="min-w-0 text-sm">
            {on ? (
              <>
                <p className="font-medium">Avisos pelo Telegram ativados.</p>
                <p className="text-muted-foreground">Você recebe uma mensagem a cada nova ocorrência, com lembretes até tocar em “Abrir no app”.</p>
              </>
            ) : (
              <>
                <p className="font-medium">Receber aviso no Telegram quando uma ocorrência for registrada</p>
                <p className="text-muted-foreground">Toque em “Ativar no Telegram”, depois em “Iniciar” (ou “Start”) no Telegram. É preciso ter o app Telegram instalado.</p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {on ? (
            <>
              <Button variant="outline" disabled={isPending} onClick={test}>
                Enviar aviso de teste
              </Button>
              <Button variant="ghost" disabled={isPending} onClick={disable}>
                Desativar
              </Button>
            </>
          ) : (
            <Button disabled={isPending || !status.configured} onClick={activate}>
              Ativar no Telegram
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

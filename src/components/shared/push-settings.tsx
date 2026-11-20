"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getVapidPublicKey, savePushSubscription, removePushSubscription, sendTestPush } from "@/lib/actions/push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "denied" | "off" | "on";

// Avisos de nova ocorrência de manutenção neste aparelho (notificação push): ativar, desativar e testar.
export function PushSettings() {
  const [state, setState] = useState<State>("loading");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (existing && Notification.permission === "granted") setState("on");
        else if (Notification.permission === "denied") setState("denied");
        else setState("off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          toast.error("Você precisa tocar em “Permitir” para receber os avisos.");
          return;
        }
        const key = await getVapidPublicKey();
        if (!key) {
          toast.error("Avisos ainda não configurados no servidor.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const result = await savePushSubscription(json, navigator.userAgent);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        setState("on");
        toast.success("Avisos ativados neste aparelho.");
      } catch (e) {
        toast.error(`Não foi possível ativar os avisos: ${e instanceof Error ? e.message : "erro"}`);
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
        toast.success("Avisos desativados neste aparelho.");
      } catch {
        toast.error("Não foi possível desativar.");
      }
    });
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPush();
      if (result?.error) toast.error(result.error);
      else toast.success("Aviso de teste enviado. Ele deve aparecer em instantes.");
    });
  }

  if (state === "loading") return null;

  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {state === "on" ? <BellRing size={22} className="shrink-0 text-emerald-600" /> : state === "denied" ? <BellOff size={22} className="shrink-0 text-destructive" /> : <Bell size={22} className="shrink-0 text-muted-foreground" />}
          <div className="min-w-0 text-sm">
            {state === "on" && (
              <>
                <p className="font-medium">Avisos de nova ocorrência ativados neste aparelho.</p>
                <p className="text-muted-foreground">Toca uma notificação a cada ocorrência e repete o lembrete até você dispensá-la na tela.</p>
              </>
            )}
            {state === "off" && (
              <>
                <p className="font-medium">Receber aviso no celular quando uma ocorrência for registrada</p>
                <p className="text-muted-foreground">Toque em “Ativar” e depois em “Permitir”. É preciso fazer isso uma vez em cada aparelho.</p>
              </>
            )}
            {state === "denied" && (
              <>
                <p className="font-medium">Os avisos estão bloqueados neste aparelho.</p>
                <p className="text-muted-foreground">Nas configurações do navegador (ícone do cadeado ao lado do endereço), permita as notificações deste site e volte aqui.</p>
              </>
            )}
            {state === "unsupported" && (
              <>
                <p className="font-medium">Este navegador não aceita avisos.</p>
                <p className="text-muted-foreground">Use o Chrome no Android ou no computador.</p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {state === "off" && (
            <Button disabled={isPending} onClick={enable}>
              Ativar avisos
            </Button>
          )}
          {state === "on" && (
            <>
              <Button variant="outline" disabled={isPending} onClick={test}>
                Enviar aviso de teste
              </Button>
              <Button variant="ghost" disabled={isPending} onClick={disable}>
                Desativar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

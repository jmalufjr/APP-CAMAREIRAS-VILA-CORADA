/* Service worker: recebe os avisos (push) de nova ocorrência de manutenção. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Conta à página aberta (se houver) o que aconteceu, para aparecer no Diagnóstico.
async function tell(message) {
  try {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach((w) => w.postMessage(message));
  } catch (e) {
    /* sem página aberta */
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch (e) {
        data = { title: "Aviso", body: event.data ? event.data.text() : "" };
      }
      const title = data.title || "Aviso";
      const base = {
        body: data.body || "",
        tag: data.tag || "aviso",
        icon: "/vila-corada-logo.png",
        data: { url: data.url || "/", occurrenceId: data.occurrenceId || null },
      };
      await tell({ type: "push", step: "aviso recebido pelo aparelho" });
      try {
        // Mesmo aviso reenviado (lembrete) toca o som de novo e a notificação fica na tela até ser dispensada.
        await self.registration.showNotification(title, { ...base, renotify: true, requireInteraction: true });
        await tell({ type: "push", step: "notificação exibida" });
      } catch (e) {
        await tell({ type: "push", step: "erro ao exibir: " + (e && e.message ? e.message : String(e)) });
        // Nunca deixa um aviso sem notificação (o navegador pune sites que não mostram): tenta o modo mais simples.
        await self.registration.showNotification(title, { body: base.body, tag: base.tag, data: base.data });
        await tell({ type: "push", step: "notificação simples exibida" });
      }
    })()
  );
});

// Avisa o servidor que a pessoa viu o aviso (abriu ou dispensou): os lembretes daquela ocorrência param neste aparelho.
async function acknowledge(data) {
  try {
    if (!data || !data.occurrenceId) return;
    const sub = await self.registration.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/ack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ occurrenceId: data.occurrenceId, endpoint: sub.endpoint }),
    });
  } catch (e) {
    /* sem internet agora: o lembrete seguinte tenta de novo */
  }
}

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(acknowledge(event.notification.data));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      await acknowledge(event.notification.data);
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

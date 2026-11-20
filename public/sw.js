/* Service worker antigo dos avisos push do navegador (substituídos pelo Telegram).
   Fica só para se desinstalar sozinho nos aparelhos que o registraram. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch (e) {
        /* sem inscrição */
      }
      await self.registration.unregister();
    })()
  );
});

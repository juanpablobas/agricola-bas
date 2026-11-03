// Recibe los avisos de la app y los muestra en el celular.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch (_) { datos = { body: event.data ? event.data.text() : "" }; }
  const titulo = datos.title || "Agrícola BAS";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || "",
      icon: "/icono-192-v2.png",
      badge: "/favicon-v2.png",
      data: { url: datos.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) { v.navigate(url).catch(() => {}); return v.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});

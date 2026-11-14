// Nudge Me service worker.
// On iOS 18.4+ the browser shows Declarative Web Push messages itself, so this only
// handles browsers without that support.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  // A proposed notification means the browser will show the declarative message itself.
  if (event.notification) return;

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const n = data.notification || {};
  const tasks = [
    self.registration.showNotification(n.title || "Nudge Me", {
      body: n.body || "",
      tag: n.tag,
      renotify: Boolean(n.tag),
      requireInteraction: true,
      data: { url: n.navigate || "/" },
    }),
  ];
  if (n.app_badge !== undefined && self.navigator.setAppBadge) {
    tasks.push(self.navigator.setAppBadge(Number(n.app_badge)).catch(() => {}));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

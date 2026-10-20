// App shell cache (adapted from reference/pwa-port/sw.js).
// API responses and sign-in pages are NEVER cached here: data always comes live from the server.
const CACHE = "tkifa-g-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  // Sent on sign-out: forget the cached shell.
  if (e.data === "clear") e.waitUntil(caches.delete(CACHE));
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.startsWith("/api/")) return;
  // Network first so a new version shows up on the next open; cache only for offline use.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && r.type === "basic" && !r.redirected) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || (e.request.mode === "navigate" ? caches.match("/") : undefined))),
  );
});

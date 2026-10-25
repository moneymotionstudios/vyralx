// VYRALX service worker — network-first, offline fallback to cache.
const CACHE = "vyralx-v2";
const SHELL = [
  "./", "./index.html", "./discover.html", "./create.html", "./live.html", "./profile.html", "./auth.html",
  "./css/vyralx.css", "./js/config.js", "./js/app.js", "./js/auth.js", "./js/banner-data.js",
  "./manifest.webmanifest", "./icon.svg"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.hostname.endsWith("supabase.co")) return;
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});

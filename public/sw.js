const CACHE = "parawallet-shell-v7";
const BASE = "/ParaWallet/";
const SHELL = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}favicon.ico`,
  `${BASE}apple-touch-icon.png`,
  `${BASE}icon.svg`,
  `${BASE}brand/splash-logo-transparent.png`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/icon-maskable-192.png`,
  `${BASE}icons/icon-maskable-512.png`,
  `${BASE}vendor/lottie_light.min.js`,
  `${BASE}loading/animation.json`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const isNavigation = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
  event.respondWith(
    isNavigation
      ? fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(`${BASE}index.html`, copy));
          return response;
        }).catch(() => caches.match(`${BASE}index.html`))
      : caches.match(request).then((cached) => cached || fetch(request).then((response) => {
          if (response.ok && new URL(request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }))
  );
});

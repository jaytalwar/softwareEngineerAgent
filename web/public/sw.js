const CACHE_NAME = "swe-agent-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // The HTML shell (navigation requests) is *not* content-hashed — a
  // rebuild replaces it in place at the same URL, referencing whatever new
  // hashed asset filenames that build produced. Cache-first here meant a
  // returning visitor's cached shell could keep pointing at JS/CSS
  // filenames a later build no longer ships, breaking the app silently
  // until the cache was cleared by hand — hit exactly this during local
  // testing across rebuilds. Navigation is network-first instead: try
  // fresh every time, and only fall back to the cached shell if the
  // network is unreachable (offline), which is what this cache exists for
  // in the first place.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error())),
    );
    return;
  }

  // Everything else (JS/CSS/images) is content-hashed by the build — a
  // given URL's bytes never change, so cache-first (falling back to
  // network, and quietly refreshing the cache either way) is genuinely
  // safe and correct here, unlike for the shell above.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      return cached || (await network) || new Response("Offline", { status: 503 });
    }),
  );
});

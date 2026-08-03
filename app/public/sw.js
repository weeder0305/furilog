const CACHE_NAME = '__FURILOG_CACHE_NAME__';
const APP_SHELL = __FURILOG_PRECACHE__;
const scopedUrl = (path) => new URL(path, self.registration.scope).href;
const RUN_DOCUMENT = scopedUrl('run/');

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const regularShell = APP_SHELL.filter((path) => path !== './run/index.html');
  await cache.addAll(regularShell.map(scopedUrl));
  const runResponse = await fetch(RUN_DOCUMENT, { cache: 'no-store' });
  if (!runResponse.ok || runResponse.redirected) throw new Error('run document unavailable');
  await cache.put(RUN_DOCUMENT, runResponse);
  if (!await cache.match(RUN_DOCUMENT)) throw new Error('run document missing');
  return cache;
}

self.addEventListener('install', (event) => {
  // A failed update must leave the previously active worker and cache intact.
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(RUN_DOCUMENT))
      .then(async (runDocument) => {
        if (!runDocument) throw new Error('new cache is incomplete');
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith('furilog-web-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
        await self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(new Response('External network access is disabled.', { status: 403 }));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const installed = Boolean(await cache.match(RUN_DOCUMENT));

        if (!installed) return fetch(request);
        if (request.method !== 'GET') {
          return new Response('Network writes are disabled.', { status: 405 });
        }

        if (request.mode === 'navigate') {
          const installerPath = url.pathname.endsWith('/app/') || url.pathname.endsWith('/app/index.html');
          const documentUrl = installerPath ? scopedUrl('index.html') : RUN_DOCUMENT;
          const cachedDocument = await cache.match(documentUrl);
          if (cachedDocument?.ok && !cachedDocument.redirected) return cachedDocument;
          try {
            return await fetch(request);
          } catch {
            return new Response('The app is not saved on this device yet. Reopen the setup page while online.', { status: 503 });
          }
        }

        const cachedResource = await cache.match(request.url, { ignoreSearch: true, ignoreVary: true });
        if (cachedResource?.ok) return cachedResource;
        try {
          return await fetch(request);
        } catch {
          return new Response('This resource is not available offline.', { status: 504 });
        }
      } catch {
        return new Response('The offline app could not be read. Please reopen the setup page.', { status: 503 });
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FURILOG_INSTALL_OFFLINE') {
    event.waitUntil(
      cacheAppShell()
        .then(() => event.ports[0]?.postMessage({ ok: true, cachedResourceCount: APP_SHELL.length }))
        .catch(() => event.ports[0]?.postMessage({ ok: false }))
    );
    return;
  }

  if (event.data?.type === 'FURILOG_OFFLINE_STATUS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const installed = Boolean(await cache.match(RUN_DOCUMENT));
        event.ports[0]?.postMessage({
          installed,
          cacheName: CACHE_NAME,
          cachedResourceCount: installed ? APP_SHELL.length : 0,
          externalNetworkBlocked: installed,
        });
      })
    );
  }
});

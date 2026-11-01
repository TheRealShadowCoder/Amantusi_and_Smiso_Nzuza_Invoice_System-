/* Authentication-safe service worker.
   Authenticated documents and invoices must NEVER be served from a shared cache.
   The service worker preserves installability but delegates all requests to network.
*/
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', () => {
  // Deliberately do not intercept navigation or asset requests.
  // Cloudflare Pages Functions must authenticate every request.
});

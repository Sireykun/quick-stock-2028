const CACHE = 'quickstock-shell-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin || new URL(request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).then(response => { if (response.ok && (request.mode === 'navigate' || /\.(js|css|png|svg|webp|woff2?)$/.test(new URL(request.url).pathname))) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; }).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? await caches.match('/') : Response.error())));
});

// Never cache service notes, photos, reports, or API responses.
const CACHE = 'servicelogme-static-v1';
const STATIC = ['/icon-192.png', '/icon-512.png', '/icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('servicelogme-static-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {const url = new URL(event.request.url);if(url.origin === self.location.origin && STATIC.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));});

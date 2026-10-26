/* SEN BLE Probe service worker.
   HTML: network-first (a fresh deploy is picked up on the next launch when online; cached copy offline).
   Everything else in CORE: cache-first.
   Separate cache name from the calculator (sen-ballistics-*), so the two apps never touch each other's caches.
   RELEASE: bump CACHE together with every index.html change. */
const CACHE = 'sen-ble-probe-v1.3.1';
const CORE = ['./', './index.html', './manifest.json', './probe-icon-192.png', './probe-icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('sen-ble-probe-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isHTML = req.mode === 'navigate' || req.destination === 'document' || req.url.endsWith('.html');
  if (isHTML) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});

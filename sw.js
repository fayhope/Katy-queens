// Offline support: serve the app shell from cache when there's no network.
// Network-first so updates show up as soon as you're online. Bump VERSION
// when you change files if you want old caches cleaned up straight away.
const VERSION = 'kq-v2';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/code.js', 'js/config.js', 'js/parser.js', 'js/queens.js', 'js/stats.js', 'js/store.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Only same-origin GETs; Supabase calls always go to the network.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))),
  );
});

/* Service worker de Mínimas RFEN
   ----------------------------------------------------------------------------
   Objetivo: que la app abra al instante y sin cobertura la pantalla de carga.
   Los datos (Supabase, live, calendario) siempre van a la red: cachearlos daría
   información vieja, que es peor que no tener nada.

   El HTML va network-first: si hay red se sirve el nuevo y se guarda copia; si
   no, se usa la copia. Así una actualización entra en la siguiente apertura.
*/

const CACHE = 'minimas-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, CDNs, live: sin tocar

  // Navegación: red primero, copia si falla
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // Resto de estáticos propios: caché primero
  event.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      }
      return res;
    }))
  );
});

/* 오프라인용 — 앱 파일만 이 기기에 저장해 둔다(기록은 localStorage · 밖으로 보내지 않음) */
const V = 'fit-v4';
const FILES = ['./', 'index.html', 'style.css', 'engine.js', 'inbody.js', 'ibui.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'data/rules.json', 'data/exercises.json', 'data/programs.json', 'data/warmups.json', 'data/meals.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url); if (u.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});

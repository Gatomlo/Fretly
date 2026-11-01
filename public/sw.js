const CACHE = 'fretly-v4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'css/style.css',
  'js/app.js', 'js/music.js', 'js/chords.js', 'js/chordpro.js', 'js/pitch.js', 'js/diagram.js',
  'js/audio.js', 'js/store.js', 'js/seed.js', 'js/chordDialog.js', 'js/cover.js', 'js/account.js', 'js/capo.js', 'js/guided.js',
  'js/views/tuner.js', 'js/views/songs.js', 'js/views/editor.js', 'js/views/bible.js',
  'js/views/settings.js', 'js/views/reader.js', 'js/views/sets.js', 'js/views/set.js', 'js/views/print.js', 'js/views/login.js', 'js/views/reset.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (toujours à jour en ligne), cache en secours (hors-ligne)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)),
  );
});

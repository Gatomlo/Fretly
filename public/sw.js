// Mode hors ligne : toute l'application est préchargée (SHELL) ; chaque fichier est ensuite remis à jour
// en ligne (le réseau a 3 s pour répondre, sinon le cache sert). Les chansons sont dans le navigateur
// (localStorage) et ne dépendent donc pas du réseau. L'API (/api/...) n'est jamais mise en cache.
// Tout fichier ajouté dans public/ doit figurer ici (un test le vérifie) ; changer CACHE à chaque évolution.
const CACHE = 'fretly-v9';
const SHELL = [
  './', 'index.html', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'css/style.css',
  'js/app.js', 'js/music.js', 'js/chords.js', 'js/chordpro.js', 'js/pitch.js', 'js/diagram.js',
  'js/audio.js', 'js/store.js', 'js/seed.js', 'js/chordDialog.js', 'js/cover.js', 'js/urls.js', 'js/importer.js', 'js/account.js', 'js/capo.js', 'js/guided.js', 'js/pwa.js',
  'js/views/tuner.js', 'js/views/songs.js', 'js/views/editor.js', 'js/views/bible.js',
  'js/views/settings.js', 'js/views/reader.js', 'js/views/sets.js', 'js/views/set.js', 'js/views/print.js', 'js/views/import.js', 'js/views/login.js', 'js/views/reset.js',
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function handle(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
  network.catch(() => {}); // si on a déjà répondu depuis le cache, l'échec tardif est sans importance
  if (cached) {
    // Fichier connu : version fraîche si le réseau répond vite, sinon le cache (connexion lente ou absente)
    try {
      return await Promise.race([network, new Promise((_, no) => setTimeout(() => no(new Error('délai dépassé')), NETWORK_TIMEOUT_MS))]);
    } catch { return cached; }
  }
  try { return await network; } catch {
    // Hors ligne et page inconnue : on rouvre l'application (le routeur affichera l'écran demandé)
    if (req.mode === 'navigate') { const home = await cache.match('./'); if (home) return home; }
    return Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(handle(e.request));
});

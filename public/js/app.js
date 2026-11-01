import { settings, sync, account } from './store.js';
import { loadSession } from './account.js';
import { initPwa, initBar } from './pwa.js';

const ROUTES = [
  [/^#\/tuner$/, 'tuner', 'tuner'],
  [/^#\/songs$/, 'songs', 'songs'],
  [/^#\/song\/new$/, 'editor', 'songs'],
  [/^#\/song\/([^/]+)\/edit$/, 'editor', 'songs'],
  [/^#\/song\/([^/?]+)(?:\?set=([^&]+))?$/, 'reader', 'songs', true],
  [/^#\/login(?:\?invite=([^&]+))?$/, 'login', 'settings'],
  [/^#\/reset\?token=([^&]+)$/, 'reset', 'settings'],
  [/^#\/print\/((?:set|song)\/[^/]+)$/, 'print', 'songs', true],
  [/^#\/import$/, 'import', 'songs'],
  [/^#\/sets$/, 'sets', 'sets'],
  [/^#\/set\/([^/]+)$/, 'set', 'sets'],
  [/^#\/chords(?:\/(.+))?$/, 'bible', 'chords'],
  [/^#\/settings$/, 'settings', 'settings'],
];

// Écrans accessibles sans compte : l'accordeur, la bible des accords et la connexion elle-même
const PUBLIC_VIEWS = new Set(['tuner', 'bible', 'login', 'reset']);

const view = document.getElementById('view');
let cleanup = null;
let token = 0;

async function render() {
  const mine = ++token;
  cleanup?.();
  cleanup = null;
  const hash = location.hash || '#/songs';
  const match = ROUTES.map((r) => [r, r[0].exec(hash)]).find(([, m]) => m);
  if (!match) { location.hash = '#/songs'; return; }
  const [[, name, tab, fullscreen], m] = match;
  // Pas connecté : on bascule sur l'écran de connexion (sauf si le serveur est injoignable : mode local)
  if (account.loaded && account.available && !account.user && !PUBLIC_VIEWS.has(name)) {
    account.returnTo = hash;
    location.replace('#/login');
    return;
  }
  document.body.classList.toggle('reading', !!fullscreen);
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === tab));
  view.innerHTML = '';
  view.scrollTop = 0;
  const mod = await import(`./views/${name}.js`);
  if (mine !== token) return;
  const param = m[1] ? decodeURIComponent(m[1]) : null;
  cleanup = mod.mount(view, param, m[2] ? decodeURIComponent(m[2]) : null) || null;
}

document.documentElement.dataset.theme = settings.get().theme;
addEventListener('hashchange', render);
// Synchronisation au lancement ; on ne redessine que les écrans de liste (jamais pendant la lecture)
sync.onChange = () => { if (/^#\/(songs|sets|set\/)/.test(location.hash || '#/songs')) render(); };
// La session est connue avant le premier affichage (sinon on afficherait un écran protégé un instant)
loadSession().catch(() => {}).finally(() => { render(); sync.run().catch(() => {}); });
initPwa();
initBar(() => sync.run().catch(() => {})); // bandeau hors ligne / nouvelle version ; synchro au retour du réseau
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

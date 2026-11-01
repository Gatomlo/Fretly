import { settings, sync } from './store.js';

const ROUTES = [
  [/^#\/tuner$/, 'tuner', 'tuner'],
  [/^#\/songs$/, 'songs', 'songs'],
  [/^#\/song\/new$/, 'editor', 'songs'],
  [/^#\/song\/([^/]+)\/edit$/, 'editor', 'songs'],
  [/^#\/song\/([^/?]+)(?:\?set=([^&]+))?$/, 'reader', 'songs', true],
  [/^#\/print\/((?:set|song)\/[^/]+)$/, 'print', 'songs', true],
  [/^#\/sets$/, 'sets', 'sets'],
  [/^#\/set\/([^/]+)$/, 'set', 'sets'],
  [/^#\/chords(?:\/(.+))?$/, 'bible', 'chords'],
  [/^#\/settings$/, 'settings', 'settings'],
];

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
render();
// Synchronisation au lancement ; on ne redessine que les écrans de liste (jamais pendant la lecture)
sync.onChange = () => { if (/^#\/(songs|sets|set\/)/.test(location.hash || '#/songs')) render(); };
sync.run().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

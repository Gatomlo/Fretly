import { songs, settings, account } from '../store.js';
import { loadSession } from '../account.js';
import { fetchSources, importUrl } from '../importer.js';
import { parseUrls, normalizeUrl } from '../urls.js';
import { esc } from '../chordDialog.js';

// Import en masse : on colle une série d'adresses, elles vont dans une file (gardée sur l'appareil),
// puis « Importer » les traite une par une, à rythme poli pour le site d'origine.
const KEY = 'fretly.queue';
const PAUSE_MS = 700;
const STATUS = { pending: 'En attente', running: 'Import en cours…', ok: 'Importée', skip: 'Déjà dans le carnet', error: 'Échec' };
const ICON = { pending: '○', running: '⏳', ok: '✓', skip: '＝', error: '✕' };

const loadQueue = () => {
  try { return (JSON.parse(localStorage.getItem(KEY)) || []).map((i) => (i.status === 'running' ? { ...i, status: 'pending' } : i)); } catch { return []; }
};
const saveQueue = (q) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* stockage indisponible */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// « artiste / titre » lisible d'après la fin de l'adresse, tant que la chanson n'est pas importée
function label(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean).slice(-2).map((p) => decodeURIComponent(p).replace(/[-_]+/g, ' '));
    return parts.join(' / ') || url;
  } catch { return url; }
}

export function mount(root) {
  let alive = true;
  let running = false;
  let cancel = false;
  let notice = '';
  let sources = [];
  let queue = loadQueue();

  root.innerHTML = `
    <section class="page">
      <div class="page-head"><a class="btn icon" href="#/songs" aria-label="Retour">‹</a><h1>Importer des chansons</h1></div>
      <form id="f" class="form">
        <label>D'où vient l'import ?
          <select id="src"><option value="">Détection automatique</option></select>
        </label>
        <label>Adresses des partitions <small>(une par ligne, ou collées à la suite)</small>
          <textarea id="urls" rows="6" spellcheck="false" placeholder="https://…"></textarea>
        </label>
        <div class="row"><button class="btn primary" type="submit">＋ Ajouter à la file</button><span class="muted small" id="addmsg"></span></div>
      </form>
      <div id="queue"></div>
    </section>`;
  const $ = (q) => root.querySelector(q);

  fetchSources().then((list) => {
    if (!alive) return;
    sources = list;
    $('#src').insertAdjacentHTML('beforeend', list.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''));
    $('#src').value = list.some((s) => s.id === settings.get().importSource) ? settings.get().importSource : '';
    hint();
  });
  const hint = () => {
    const s = sources.find((x) => x.id === $('#src').value) || sources[0];
    if (s) $('#urls').placeholder = `${s.example}\n${s.example}`;
  };
  $('#src').onchange = () => { settings.set({ importSource: $('#src').value }); hint(); };

  const counts = () => queue.reduce((c, i) => ({ ...c, [i.status]: (c[i.status] || 0) + 1 }), {});

  function draw() {
    if (!alive) return;
    const c = counts();
    const pending = c.pending || 0;
    const done = queue.length - pending - (c.running || 0);
    const bar = queue.length ? Math.round((done / queue.length) * 100) : 0;
    $('#queue').innerHTML = queue.length ? `
      <h2>File d'attente <span class="muted small">${queue.length} adresse${queue.length > 1 ? 's' : ''}</span></h2>
      <div class="progress big" aria-hidden="true"><i style="width:${bar}%"></i></div>
      <p class="muted small">${[`${c.ok || 0} importée(s)`, c.skip ? `${c.skip} déjà présente(s)` : '', c.error ? `${c.error} échec(s)` : '', `${pending} en attente`].filter(Boolean).join(' · ')}</p>
      ${notice ? `<p class="error">${esc(notice)}</p>` : ''}
      <div class="row qtools">
        ${running ? '<button class="btn danger" data-q="stop">⏹ Arrêter</button>' : `<button class="btn primary" data-q="run" ${pending ? '' : 'disabled'}>▶ Importer (${pending})</button>`}
        ${!running && c.error ? '<button class="btn" data-q="retry">↻ Réessayer les échecs</button>' : ''}
        ${!running && (c.ok || c.skip) ? '<button class="btn" data-q="clean">Retirer les terminées</button>' : ''}
        ${!running ? '<button class="btn" data-q="clear">Vider la file</button>' : ''}
      </div>
      <ul class="list queue">${queue.map((i) => `<li class="qi ${i.status}"><span class="st" aria-hidden="true">${ICON[i.status]}</span><span class="meta"><b>${esc(i.title || label(i.url))}</b><span class="muted">${esc(i.status === 'error' ? i.error : STATUS[i.status])}</span></span>${running ? '' : `<button class="btn icon" data-rm="${i.id}" aria-label="Retirer">✕</button>`}</li>`).join('')}</ul>
      ${!running && done && !pending ? '<div class="row"><a class="btn primary" href="#/songs">Voir mes chansons</a></div>' : ''}` : '';
  }

  async function run() {
    if (running) return;
    if (!account.loaded) await loadSession();
    if (!account.user) { notice = 'Connectez-vous (Réglages) pour importer : les partitions passent par votre serveur.'; draw(); return; }
    notice = '';
    running = true;
    cancel = false;
    for (const item of queue) {
      if (cancel || !alive) break;
      if (item.status !== 'pending') continue;
      item.status = 'running';
      draw();
      try {
        const data = await importUrl(item.url, item.source || undefined);
        const key = normalizeUrl(item.url);
        const dup = songs.list().find((s) => s.sourceUrl && normalizeUrl(s.sourceUrl) === key);
        if (dup) { item.status = 'skip'; item.title = dup.title; }
        else {
          songs.save({ ...data, sourceUrl: item.url });
          item.status = 'ok';
          item.title = data.title;
        }
      } catch (e) {
        if (e.status === 401 || e.status === 429 || e.status === 0) {
          item.status = 'pending';
          notice = e.status === 401 ? 'Session expirée : reconnectez-vous (Réglages).' : e.message;
          cancel = true;
        } else { item.status = 'error'; item.error = e.message; }
      }
      saveQueue(queue);
      draw();
      if (!cancel) await sleep(PAUSE_MS);
    }
    running = false;
    saveQueue(queue);
    draw();
  }

  $('#f').onsubmit = (e) => {
    e.preventDefault();
    const urls = parseUrls($('#urls').value, queue.map((i) => i.url));
    $('#addmsg').textContent = urls.length ? `${urls.length} adresse${urls.length > 1 ? 's' : ''} ajoutée${urls.length > 1 ? 's' : ''}.` : 'Aucune nouvelle adresse reconnue.';
    if (!urls.length) return;
    const source = $('#src').value;
    queue = [...queue, ...urls.map((url, k) => ({ id: `${Date.now()}-${k}`, url, source, status: 'pending' }))];
    $('#urls').value = '';
    saveQueue(queue);
    draw();
  };

  $('#queue').onclick = (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { queue = queue.filter((i) => i.id !== rm.dataset.rm); saveQueue(queue); draw(); return; }
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (q === 'run') run();
    else if (q === 'stop') { cancel = true; }
    else if (q === 'retry') { queue = queue.map((i) => (i.status === 'error' ? { ...i, status: 'pending', error: '' } : i)); saveQueue(queue); draw(); run(); }
    else if (q === 'clean') { queue = queue.filter((i) => i.status === 'pending' || i.status === 'error'); saveQueue(queue); draw(); }
    else if (q === 'clear' && confirm('Vider toute la file d\'attente ?')) { queue = []; saveQueue(queue); notice = ''; draw(); }
  };

  draw();
  return () => { alive = false; cancel = true; };
}

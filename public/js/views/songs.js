import { songs, settings } from '../store.js';
import { esc } from '../chordDialog.js';
import { cover } from '../cover.js';

const greeting = () => { const h = new Date().getHours(); return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'; };
const SORTS = { title: 'Titre', artist: 'Artiste', recent: 'Joués récemment', key: 'Tonalité' };
const COMPARE = {
  title: (a, b) => a.title.localeCompare(b.title, 'fr'),
  artist: (a, b) => (a.artist || '~').localeCompare(b.artist || '~', 'fr') || a.title.localeCompare(b.title, 'fr'),
  recent: (a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || a.title.localeCompare(b.title, 'fr'),
  key: (a, b) => (a.key || '~').localeCompare(b.key || '~') || a.title.localeCompare(b.title, 'fr'),
};

export const tabs = (on) => `<nav class="seg2"><a class="${on === 'songs' ? 'on' : ''}" href="#/songs">Chansons</a><a class="${on === 'sets' ? 'on' : ''}" href="#/sets">Setlists</a></nav>`;

export function mount(root) {
  let sort = settings.get().sort in SORTS ? settings.get().sort : 'title';
  let filter = 'all';
  let q = '';
  root.innerHTML = `
    <section class="page">
      <div class="page-head">
        <div class="brand"><img src="icon.svg" alt="" width="44" height="44"><div><h1>${greeting()} 🎸</h1><span class="muted small" id="count"></span></div></div>
        <a class="btn primary" href="#/song/new">＋ Nouveau</a>
      </div>
      ${tabs('songs')}
      <div id="hero"></div>
      <div class="row tools">
        <input type="search" id="q" placeholder="Rechercher un titre, un artiste…" aria-label="Rechercher">
        <select id="sort" aria-label="Trier par">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div class="chips" id="chips"></div>
      <ul class="list" id="list"></ul>
    </section>`;
  const $ = (id) => root.querySelector('#' + id);

  const all = songs.list();
  $('count').textContent = `${all.length} chanson${all.length > 1 ? 's' : ''} dans votre carnet`;
  const last = all.find((s) => s.id === settings.get().last);
  if (last) {
    $('hero').innerHTML = `
      <a class="hero" href="#/song/${last.id}">
        ${cover(last)}
        <span class="meta"><small>Reprendre</small><b>${esc(last.title)}</b><span>${esc(last.artist || '')}</span></span>
        <span class="go" aria-hidden="true">▶</span>
      </a>`;
  }

  const tags = [...new Set(all.flatMap((s) => s.tags || []))].sort((a, b) => a.localeCompare(b, 'fr'));
  if (filter !== 'all' && filter !== 'fav' && !tags.includes(filter)) filter = 'all';

  function draw() {
    $('chips').innerHTML = [['all', 'Tous'], ['fav', '★ Favoris'], ...tags.map((t) => [t, `#${t}`])]
      .map(([k, l]) => `<button class="chip${k === filter ? ' on' : ''}" data-f="${esc(k)}">${esc(l)}</button>`).join('');
    const needle = q.trim().toLowerCase();
    const items = songs.list()
      .filter((s) => (!needle || `${s.title} ${s.artist}`.toLowerCase().includes(needle))
        && (filter === 'all' || (filter === 'fav' ? s.fav : (s.tags || []).includes(filter))))
      .sort(COMPARE[sort]);
    $('list').innerHTML = items.length
      ? items.map((s) => `<li><a class="song" href="#/song/${s.id}">${cover(s)}<span class="meta"><b>${esc(s.title)}</b><span class="muted">${esc(s.artist || '')}</span></span>${s.key ? `<em class="tag">${esc(s.key)}</em>` : ''}</a><button class="btn icon star${s.fav ? ' on' : ''}" data-fav="${s.id}" aria-label="Favori" aria-pressed="${!!s.fav}">${s.fav ? '★' : '☆'}</button><a class="btn icon" href="#/song/${s.id}/edit" aria-label="Modifier">✎</a></li>`).join('')
      : `<li class="empty-state"><div>🎶</div><b>${needle || filter !== 'all' ? 'Aucun résultat' : 'Votre carnet est vide'}</b><span class="muted">${needle || filter !== 'all' ? 'Essayez un autre filtre.' : 'Ajoutez une chanson ou importez-en une depuis boiteachansons.net.'}</span></li>`;
  }
  $('q').oninput = (e) => { q = e.target.value; draw(); };
  $('sort').onchange = (e) => { sort = e.target.value; settings.set({ sort }); draw(); };
  root.onclick = (e) => {
    const f = e.target.closest('[data-f]');
    if (f) { filter = f.dataset.f; draw(); }
    const fav = e.target.closest('[data-fav]');
    if (fav) { const s = songs.get(fav.dataset.fav); songs.save({ ...s, fav: !s.fav }); draw(); }
  };
  draw();
}

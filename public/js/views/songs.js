import { songs, settings } from '../store.js';
import { esc } from '../chordDialog.js';

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cover = (s) => `<span class="cover c${hash(s.title + s.artist) % 8}">${esc(([...s.title.trim()].find((c) => /\p{L}|\d/u.test(c)) || '♪').toUpperCase())}</span>`;
const greeting = () => { const h = new Date().getHours(); return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'; };

export function mount(root) {
  root.innerHTML = `
    <section class="page">
      <div class="page-head">
        <div class="brand"><img src="icon.svg" alt="" width="44" height="44"><div><h1>${greeting()} 🎸</h1><span class="muted small" id="count"></span></div></div>
        <a class="btn primary" href="#/song/new">＋ Nouveau</a>
      </div>
      <div id="hero"></div>
      <input type="search" id="q" placeholder="Rechercher un titre ou un artiste…" aria-label="Rechercher">
      <ul class="list" id="list"></ul>
    </section>`;
  const list = root.querySelector('#list');
  const all = songs.list();
  root.querySelector('#count').textContent = `${all.length} chanson${all.length > 1 ? 's' : ''} dans votre carnet`;

  const last = all.find((s) => s.id === settings.get().last);
  if (last) {
    root.querySelector('#hero').innerHTML = `
      <a class="hero" href="#/song/${last.id}">
        ${cover(last)}
        <span class="meta"><small>Reprendre</small><b>${esc(last.title)}</b><span>${esc(last.artist || '')}</span></span>
        <span class="go" aria-hidden="true">▶</span>
      </a>`;
  }

  const draw = (q = '') => {
    const needle = q.trim().toLowerCase();
    const items = all
      .filter((s) => !needle || `${s.title} ${s.artist}`.toLowerCase().includes(needle))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    list.innerHTML = items.length
      ? items.map((s) => `<li><a class="song" href="#/song/${s.id}">${cover(s)}<span class="meta"><b>${esc(s.title)}</b><span class="muted">${esc(s.artist || '')}</span></span>${s.key ? `<em class="tag">${esc(s.key)}</em>` : ''}</a><a class="btn icon" href="#/song/${s.id}/edit" aria-label="Modifier">✎</a></li>`).join('')
      : `<li class="empty-state"><div>🎶</div><b>${needle ? 'Aucun résultat' : 'Votre carnet est vide'}</b><span class="muted">${needle ? 'Essayez un autre titre.' : 'Ajoutez une chanson ou importez-en une depuis boiteachansons.net.'}</span></li>`;
  };
  root.querySelector('#q').oninput = (e) => draw(e.target.value);
  draw();
}

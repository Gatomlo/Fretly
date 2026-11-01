import { songs } from '../store.js';
import { esc } from '../chordDialog.js';

export function mount(root) {
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>Carnet de chant</h1><a class="btn primary" href="#/song/new">＋ Nouveau</a></div>
      <input type="search" id="q" placeholder="Rechercher un titre ou un artiste…" aria-label="Rechercher">
      <ul class="list" id="list"></ul>
    </section>`;
  const list = root.querySelector('#list');
  const draw = (q = '') => {
    const needle = q.trim().toLowerCase();
    const items = songs.list()
      .filter((s) => !needle || `${s.title} ${s.artist}`.toLowerCase().includes(needle))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    list.innerHTML = items.length
      ? items.map((s) => `<li><a href="#/song/${s.id}"><b>${esc(s.title)}</b><span class="muted">${esc(s.artist || '')}</span>${s.key ? `<em class="tag">${esc(s.key)}</em>` : ''}</a><a class="btn icon" href="#/song/${s.id}/edit" aria-label="Modifier">✎</a></li>`).join('')
      : '<li class="muted empty">Aucune chanson. Créez-en une avec « Nouveau ».</li>';
  };
  root.querySelector('#q').oninput = (e) => draw(e.target.value);
  draw();
}

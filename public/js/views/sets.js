import { sets, songs } from '../store.js';
import { esc } from '../chordDialog.js';
import { tabs } from './songs.js';

export function mount(root) {
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>Setlists</h1></div>
      ${tabs('sets')}
      <form class="row tools" id="f">
        <input name="name" placeholder="Nouvelle setlist (ex. Soirée du 14 juin)" aria-label="Nom de la setlist" required>
        <button class="btn primary" type="submit">＋ Créer</button>
      </form>
      <ul class="list" id="list"></ul>
    </section>`;
  const list = root.querySelector('#list');
  const draw = () => {
    const all = sets.list().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const known = new Set(songs.list().map((s) => s.id));
    list.innerHTML = all.length
      ? all.map((s) => {
        const n = s.songIds.filter((id) => known.has(id)).length;
        return `<li><a class="song" href="#/set/${s.id}"><span class="cover c${s.name.length % 8}">♫</span><span class="meta"><b>${esc(s.name)}</b><span class="muted">${n} chanson${n > 1 ? 's' : ''}</span></span></a></li>`;
      }).join('')
      : '<li class="empty-state"><div>📋</div><b>Aucune setlist</b><span class="muted">Créez-en une pour enchaîner vos morceaux dans l\'ordre.</span></li>';
  };
  root.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const s = sets.save({ name: e.target.name.value.trim(), songIds: [] });
    location.hash = `#/set/${s.id}`;
  };
  draw();
}

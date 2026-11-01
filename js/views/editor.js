import { songs } from '../store.js';
import { convertChordsOverLyrics } from '../chordpro.js';
import { esc } from '../chordDialog.js';

export function mount(root, id) {
  const song = (id && songs.get(id)) || { title: '', artist: '', key: '', capo: 0, body: '' };
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>${id ? 'Modifier' : 'Nouvelle chanson'}</h1></div>
      <form id="f" class="form">
        <label>Titre <input name="title" required value="${esc(song.title)}"></label>
        <label>Artiste <input name="artist" value="${esc(song.artist || '')}"></label>
        <div class="row">
          <label>Tonalité <input name="key" size="4" value="${esc(song.key || '')}"></label>
          <label>Capo <input name="capo" type="number" min="0" max="12" value="${song.capo || 0}"></label>
        </div>
        <label>Paroles et accords
          <textarea name="body" rows="16" spellcheck="false" placeholder="[Am]Paroles avec les [G]accords entre crochets">${esc(song.body)}</textarea>
        </label>
        <p class="muted small">Accords entre crochets juste avant la syllabe. <code>{c: Refrain}</code> ou <code>[Refrain]</code> sur sa ligne crée un titre de section. Vous collez un texte avec les accords <i>au-dessus</i> des paroles ? Utilisez « Convertir ».</p>
        <div class="row">
          <button class="btn primary" type="submit">Enregistrer</button>
          <button class="btn" type="button" id="conv">Convertir accords au-dessus</button>
          <a class="btn" href="${id ? '#/song/' + id : '#/songs'}">Annuler</a>
          ${id ? '<button class="btn danger" type="button" id="del">Supprimer</button>' : ''}
        </div>
      </form>
    </section>`;
  const f = root.querySelector('#f');
  root.querySelector('#conv').onclick = () => { f.body.value = convertChordsOverLyrics(f.body.value); };
  root.querySelector('#del')?.addEventListener('click', () => {
    if (confirm(`Supprimer « ${song.title} » ?`)) { songs.remove(id); location.hash = '#/songs'; }
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    const saved = songs.save({ ...song, title: f.title.value.trim(), artist: f.artist.value.trim(), key: f.key.value.trim(), capo: Number(f.capo.value) || 0, body: f.body.value });
    location.hash = `#/song/${saved.id}`;
  };
}

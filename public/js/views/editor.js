import { songs } from '../store.js';
import { convertChordsOverLyrics } from '../chordpro.js';
import { esc } from '../chordDialog.js';
import { fetchSources, importUrl } from '../importer.js';
import { settings } from '../store.js';

export function mount(root, id) {
  const song = (id && songs.get(id)) || { title: '', artist: '', key: '', capo: 0, tempo: 0, tags: [], body: '' };
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>${id ? 'Modifier' : 'Nouvelle chanson'}</h1></div>
      <div class="import form">
        <label>Importer depuis un site
          <select id="isrc"><option value="">Détection automatique</option></select>
        </label>
        <label>Adresse de la partition
          <input id="url" type="url" inputmode="url" placeholder="https://…">
        </label>
        <div class="row"><button class="btn" type="button" id="imp">⬇ Importer</button><a class="btn" href="#/import">Importer plusieurs d'un coup</a><span class="muted small" id="impMsg"></span></div>
      </div>
      <form id="f" class="form">
        <label>Titre <input name="title" required value="${esc(song.title)}"></label>
        <label>Artiste <input name="artist" value="${esc(song.artist || '')}"></label>
        <div class="row">
          <label>Tonalité <input name="key" size="4" value="${esc(song.key || '')}"></label>
          <label>Capo <input name="capo" type="number" min="0" max="12" value="${song.capo || 0}"></label>
          <label>Tempo (BPM) <input name="tempo" type="number" min="30" max="260" value="${song.tempo || ''}"></label>
        </div>
        <label>Étiquettes (séparées par des virgules) <input name="tags" value="${esc((song.tags || []).join(', '))}" placeholder="français, feu de camp…"></label>
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
  const msg = root.querySelector('#impMsg');
  const isrc = root.querySelector('#isrc');
  let imported = {}; // origine de la partition importée, conservée à l'enregistrement
  fetchSources().then((list) => {
    isrc.insertAdjacentHTML('beforeend', list.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''));
    isrc.value = list.some((x) => x.id === settings.get().importSource) ? settings.get().importSource : '';
    if (list[0]) root.querySelector('#url').placeholder = list[0].example;
  });
  isrc.onchange = () => settings.set({ importSource: isrc.value });
  root.querySelector('#imp').onclick = async () => {
    const url = root.querySelector('#url').value.trim();
    if (!url) { msg.textContent = "Collez l'adresse de la partition."; return; }
    msg.textContent = 'Import en cours…';
    try {
      const data = await importUrl(url, isrc.value || undefined);
      f.title.value = data.title;
      f.artist.value = data.artist;
      f.key.value = data.key;
      f.capo.value = data.capo;
      f.tempo.value = data.tempo || '';
      f.body.value = data.body;
      imported = { source: data.source, sourceUrl: url };
      msg.textContent = 'Importé : vérifiez puis enregistrez.';
    } catch (e) { msg.textContent = e.status === 401 ? 'Connectez-vous (Réglages) pour importer.' : e.message; }
  };
  root.querySelector('#del')?.addEventListener('click', () => {
    if (confirm(`Supprimer « ${song.title} » ?`)) { songs.remove(id); location.hash = '#/songs'; }
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    const saved = songs.save({ ...song, ...imported, title: f.title.value.trim(), artist: f.artist.value.trim(), key: f.key.value.trim(), capo: Number(f.capo.value) || 0, tempo: Number(f.tempo.value) || 0, tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean), body: f.body.value });
    location.hash = `#/song/${saved.id}`;
  };
}

import { sets, songs } from '../store.js';
import { esc } from '../chordDialog.js';
import { cover } from '../cover.js';

export function mount(root, id) {
  let set = sets.get(id);
  if (!set) { location.hash = '#/sets'; return; }
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><a class="btn icon" href="#/sets" aria-label="Retour">‹</a><h1 id="name" contenteditable="plaintext-only" spellcheck="false"></h1></div>
      <div class="row"><a class="btn primary big" id="play" href="#">▶ Jouer la setlist</a></div>
      <ul class="list" id="list"></ul>
      <details class="adder"><summary class="btn">＋ Ajouter une chanson</summary>
        <input type="search" id="q" placeholder="Rechercher…" aria-label="Rechercher une chanson">
        <ul class="list" id="pool"></ul>
      </details>
      <div class="row"><button class="btn danger" id="del">Supprimer la setlist</button></div>
    </section>`;
  const $ = (q) => root.querySelector(q);
  $('#name').textContent = set.name;

  const commit = (songIds) => { set = sets.save({ ...set, songIds }); draw(); };

  function draw() {
    const byId = new Map(songs.list().map((s) => [s.id, s]));
    const ids = set.songIds.filter((x) => byId.has(x));
    $('#play').style.display = ids.length ? '' : 'none';
    if (ids.length) $('#play').href = `#/song/${ids[0]}?set=${set.id}`;
    $('#list').innerHTML = ids.length
      ? ids.map((sid, i) => {
        const s = byId.get(sid);
        return `<li data-i="${i}"><a class="song" href="#/song/${sid}?set=${set.id}"><span class="num">${i + 1}</span>${cover(s)}<span class="meta"><b>${esc(s.title)}</b><span class="muted">${esc(s.artist || '')}</span></span></a><button class="btn icon" data-m="-1" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn icon" data-m="1" aria-label="Descendre" ${i === ids.length - 1 ? 'disabled' : ''}>↓</button><button class="btn icon" data-rm aria-label="Retirer">✕</button></li>`;
      }).join('')
      : '<li class="empty-state"><div>🎼</div><b>Setlist vide</b><span class="muted">Ajoutez des chansons ci-dessous.</span></li>';
    drawPool();
  }
  function drawPool() {
    const needle = $('#q').value.trim().toLowerCase();
    const inSet = new Set(set.songIds);
    const items = songs.list()
      .filter((s) => !inSet.has(s.id) && (!needle || `${s.title} ${s.artist}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    $('#pool').innerHTML = items.length
      ? items.map((s) => `<li><button class="song btn-row" data-add="${s.id}">${cover(s)}<span class="meta"><b>${esc(s.title)}</b><span class="muted">${esc(s.artist || '')}</span></span><span class="tag">＋</span></button></li>`).join('')
      : '<li class="muted empty">Aucune autre chanson.</li>';
  }

  $('#name').onblur = (e) => { const name = e.target.textContent.trim() || set.name; set = sets.save({ ...set, name }); e.target.textContent = name; };
  $('#name').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
  $('#q').oninput = drawPool;
  $('#del').onclick = () => { if (confirm(`Supprimer la setlist « ${set.name} » ?`)) { sets.remove(id); location.hash = '#/sets'; } };
  root.onclick = (e) => {
    const add = e.target.closest('[data-add]');
    if (add) return commit([...set.songIds, add.dataset.add]);
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    const byId = new Set(songs.list().map((s) => s.id));
    const ids = set.songIds.filter((x) => byId.has(x));
    const i = Number(li.dataset.i);
    if (e.target.closest('[data-rm]')) return commit(ids.filter((_, k) => k !== i));
    const m = e.target.closest('[data-m]');
    if (m) {
      const j = i + Number(m.dataset.m);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      commit(ids);
    }
  };
  draw();
}

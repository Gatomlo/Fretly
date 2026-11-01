import { settings, songs } from '../store.js';

export function mount(root) {
  const s = settings.get();
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>Réglages</h1></div>
      <div class="form">
        <label>Thème
          <select id="theme">${[['auto', 'Automatique'], ['dark', 'Sombre'], ['light', 'Clair']].map(([v, l]) => `<option value="${v}"${s.theme === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        </label>
        <label>Diapason (La4, Hz) <input id="ref" type="number" min="425" max="450" value="${s.ref}"></label>
        <h2>Sauvegarde</h2>
        <div class="row">
          <button class="btn" id="exp">Exporter mes chansons</button>
          <label class="btn">Importer<input id="imp" type="file" accept="application/json" hidden></label>
        </div>
        <p class="muted small" id="msg"></p>
        <h2>Pilotage mains libres</h2>
        <ul class="muted">
          <li><b>Défilement auto</b> : ▶ lance un compte à rebours de 3 s, puis le texte défile à la vitesse choisie (lignes/min, mémorisée par morceau).</li>
          <li><b>Mode pages</b> : le morceau est découpé en colonnes qui tiennent à l'écran ; sur tablette en paysage, tout s'affiche souvent d'un coup.</li>
          <li><b>Pédale Bluetooth</b> (AirTurn, PageFlip…) : flèches, Page↑/↓ = page précédente/suivante ; Espace = lecture/pause ; + / − = vitesse.</li>
          <li><b>Bords de l'écran</b> : larges bandes tactiles gauche/droite pour tourner la page ; toucher une ligne = reprendre à cet endroit (zone vide = pause).</li>
          <li>L'écran reste allumé pendant la lecture.</li>
        </ul>
      </div>
    </section>`;
  const $ = (id) => root.querySelector('#' + id);
  $('theme').onchange = (e) => settings.set({ theme: e.target.value });
  $('ref').onchange = (e) => settings.set({ ref: Math.min(450, Math.max(425, Number(e.target.value) || 440)) });
  $('exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([songs.exportJson()], { type: 'application/json' }));
    a.download = 'fretly-chansons.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('imp').onchange = async (e) => {
    try { $('msg').textContent = `${songs.importJson(await e.target.files[0].text())} chanson(s) importée(s).`; } catch { $('msg').textContent = 'Fichier invalide.'; }
  };
}

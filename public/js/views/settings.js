import { settings, songs, sync, account } from '../store.js';
import { esc } from '../chordDialog.js';
import { loadSession, logout, changePassword, inviteLink, listUsers, resetLink, removeUser } from '../account.js';

export function mount(root) {
  const s = settings.get();
  let alive = true;
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>Réglages</h1></div>
      <div class="form">
        <h2>Compte</h2>
        <div id="acct"><p class="muted">Chargement…</p></div>
        <h2>Affichage</h2>
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

  // ---------- Compte ----------
  const box = $('acct');
  const note = (t) => { const n = box.querySelector('#anote'); if (n) n.textContent = t; };
  const copyable = (label, link) => `<label>${label}<input class="copy" readonly value="${esc(link)}"></label><p class="muted small">Copiez ce lien et transmettez-le directement à la personne.</p>`;

  async function drawAdmin() {
    const panel = box.querySelector('#admin');
    if (!panel) return;
    let users = [];
    try { users = await listUsers(); } catch (e) { panel.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
    if (!alive) return;
    panel.innerHTML = `
      <h2>Administration</h2>
      <div class="row"><button class="btn" data-x="invite">＋ Inviter quelqu'un</button></div>
      <div id="linkout"></div>
      <ul class="list users">${users.map((u) => `<li><span class="meta"><b>${esc(u.name)}</b><span class="muted">${esc(u.email)}${u.role === 'admin' ? ' · admin' : ''}</span></span>
        <button class="btn" data-x="reset" data-id="${u.id}">Lien de réinitialisation</button>
        ${u.id === account.user.id ? '' : `<button class="btn danger icon" data-x="del" data-id="${u.id}" data-name="${esc(u.name)}" aria-label="Supprimer">✕</button>`}</li>`).join('')}</ul>`;
  }

  async function drawAccount() {
    if (!account.loaded) await loadSession();
    if (!alive) return;
    if (!account.available) {
      box.innerHTML = '<p class="muted small">Les comptes demandent le serveur Fretly (indisponible ici). Vos chansons restent sur cet appareil ; utilisez « Exporter » pour les sauvegarder.</p>';
    } else if (!account.user) {
      box.innerHTML = `<p class="muted small">Connectez-vous pour retrouver vos chansons, setlists et positions d'accord sur tous vos appareils, et pour importer depuis boiteachansons.net.</p>
        <div class="row"><a class="btn primary" href="#/login">${account.firstRun ? 'Créer le premier compte' : 'Se connecter'}</a></div>`;
    } else {
      const u = account.user;
      box.innerHTML = `
        <div class="who"><span class="cover c${u.email.length % 8}">${esc(u.name[0].toUpperCase())}</span><span class="meta"><b>${esc(u.name)}</b><span class="muted">${esc(u.email)}${u.role === 'admin' ? ' · administrateur' : ''}</span></span></div>
        <div class="row"><button class="btn primary" data-x="sync">Synchroniser</button><button class="btn" data-x="logout">Se déconnecter</button></div>
        <p class="muted small" id="anote">${sync.lastOk ? `Dernière synchronisation à ${new Date(sync.lastOk).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}.` : 'La synchronisation est automatique à chaque modification.'}</p>
        <details class="adder"><summary class="btn">Changer mon mot de passe</summary>
          <form id="pw" class="form">
            <label>Mot de passe actuel <input name="current" type="password" autocomplete="current-password" required></label>
            <label>Nouveau mot de passe <input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
            <p class="muted small" id="pwmsg"></p>
            <button class="btn primary" type="submit">Enregistrer</button>
          </form>
        </details>
        ${u.role === 'admin' ? '<div id="admin"></div>' : ''}`;
      box.querySelector('#pw').onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        try { await changePassword(f.current.value, f.password.value); box.querySelector('#pwmsg').textContent = 'Mot de passe modifié.'; f.reset(); }
        catch (ex) { box.querySelector('#pwmsg').textContent = ex.message; }
      };
      if (u.role === 'admin') drawAdmin();
    }
  }

  box.onclick = async (e) => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const x = b.dataset.x;
    try {
      if (x === 'sync') { note('Synchronisation…'); await sync.run(); drawAccount(); }
      else if (x === 'logout') { await logout(); account.returnTo = null; location.hash = '#/login'; }
      else if (x === 'invite') { const r = await inviteLink(); box.querySelector('#linkout').innerHTML = copyable(`Lien d'invitation (valable ${r.days} jours, usage unique)`, r.link); box.querySelector('.copy').select(); }
      else if (x === 'reset') { const r = await resetLink(b.dataset.id); box.querySelector('#linkout').innerHTML = copyable(`Lien de réinitialisation (valable ${r.hours} h, usage unique)`, r.link); box.querySelector('.copy').select(); }
      else if (x === 'del' && confirm(`Supprimer le compte de ${b.dataset.name} et toutes ses données ?`)) { await removeUser(b.dataset.id); drawAdmin(); }
    } catch (ex) { note(ex.message); alert(ex.message); }
  };
  drawAccount();
  return () => { alive = false; };
}

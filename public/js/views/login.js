import { account } from '../store.js';
import { loadSession, login, register } from '../account.js';
import { esc } from '../chordDialog.js';

export function mount(root, invite) {
  let alive = true;
  root.innerHTML = '<section class="page"><p class="muted">Chargement…</p></section>';

  async function draw() {
    if (!account.loaded) await loadSession();
    if (!alive) return;
    const create = !!invite || account.firstRun;
    let body;
    if (!account.available) {
      body = '<p class="muted">Les comptes demandent le serveur Fretly, indisponible ici. L\'application reste utilisable : vos chansons sont gardées sur cet appareil.</p>';
    } else if (account.user) {
      body = `<p>Vous êtes connecté en tant que <b>${esc(account.user.name)}</b> (${esc(account.user.email)}).</p><div class="row"><a class="btn primary" href="#/songs">Mes chansons</a><a class="btn" href="#/settings">Réglages</a></div>`;
    } else {
      body = `
        <p class="muted">${account.firstRun ? 'Aucun compte pour l\'instant : le premier que vous créez devient l\'administrateur (il pourra inviter les autres).' : invite ? 'Vous avez reçu une invitation : choisissez votre mot de passe.' : 'Connectez-vous pour retrouver vos chansons sur tous vos appareils.'}</p>
        <form id="f" class="form" autocomplete="on">
          ${create ? '<label>Prénom ou pseudo <input name="name" autocomplete="nickname" maxlength="60"></label>' : ''}
          <label>Adresse e-mail <input name="email" type="email" autocomplete="username" required></label>
          <label>Mot de passe ${create ? '<small>(8 caractères minimum)</small>' : ''} <input name="password" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" minlength="${create ? 8 : 1}" required></label>
          <p class="error" id="err" role="alert"></p>
          <div class="row"><button class="btn primary big" type="submit">${create ? 'Créer mon compte' : 'Se connecter'}</button></div>
        </form>
        ${create ? '' : '<p class="muted small">Pas de compte ? Demandez un lien d\'invitation à l\'administrateur. Mot de passe oublié ? Il peut vous envoyer un lien de réinitialisation.</p>'}
        <p class="muted small">Vos chansons déjà présentes sur cet appareil seront ajoutées à votre compte.</p>`;
    }
    root.innerHTML = `<section class="page"><div class="page-head"><h1>${create && !account.user ? 'Créer un compte' : 'Compte'}</h1></div>${body}</section>`;
    const f = root.querySelector('#f');
    if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = root.querySelector('#err');
      const btn = f.querySelector('button');
      err.textContent = '';
      btn.disabled = true;
      try {
        if (create) await register({ name: f.name.value, email: f.email.value, password: f.password.value, invite });
        else await login(f.email.value, f.password.value);
        location.hash = '#/songs';
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
  }
  draw();
  return () => { alive = false; };
}

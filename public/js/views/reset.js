import { resetConfirm } from '../account.js';

export function mount(root, token) {
  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>Nouveau mot de passe</h1></div>
      <p class="muted">Choisissez un nouveau mot de passe pour votre compte. Vous serez connecté ensuite.</p>
      <form id="f" class="form">
        <label>Nouveau mot de passe <small>(8 caractères minimum)</small> <input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="error" id="err" role="alert"></p>
        <div class="row"><button class="btn primary big" type="submit">Enregistrer</button></div>
      </form>
    </section>`;
  const f = root.querySelector('#f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    btn.disabled = true;
    try { await resetConfirm(token, f.password.value); location.hash = '#/songs'; }
    catch (ex) { root.querySelector('#err').textContent = ex.message; btn.disabled = false; }
  };
}

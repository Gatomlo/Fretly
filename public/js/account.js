import { account, sync } from './store.js';

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`api/auth/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Serveur injoignable.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export async function loadSession() {
  try {
    const d = await call('GET', 'session');
    account.user = d.user;
    account.firstRun = d.firstRun;
    account.available = true;
  } catch { account.available = false; }
  account.loaded = true;
}

// Connecté : on fusionne aussitôt les chansons locales avec celles du compte
async function entered(d) {
  account.user = d.user;
  account.firstRun = false;
  await sync.run().catch(() => {});
  return d.user;
}

export const login = (email, password) => call('POST', 'login', { email, password }).then(entered);
export const register = (body) => call('POST', 'register', body).then(entered);
export const resetConfirm = (token, password) => call('POST', 'reset-confirm', { token, password }).then(entered);
export async function logout() { await call('POST', 'logout'); account.user = null; }
export const changePassword = (current, password) => call('POST', 'password', { current, password });
export const inviteLink = () => call('POST', 'invite');
export const listUsers = () => call('GET', 'users');
export const resetLink = (userId) => call('POST', 'reset', { userId });
export const removeUser = (id) => call('DELETE', `users/${id}`);

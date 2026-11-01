// Installation de l'application et mode hors ligne : état, boutons des Réglages, bandeau réseau.

// Pur : plateforme d'après l'agent utilisateur (iPadOS se présente comme un Mac tactile)
export function detectPlatform(ua = '', touchPoints = 0) {
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// ---------- Installation ----------
const install = { prompt: null, done: false };
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
export const onInstallChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function initPwa() {
  // Le navigateur propose l'installation une seule fois : on garde l'événement pour le bouton des Réglages
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.prompt = e; notify(); });
  addEventListener('appinstalled', () => { install.prompt = null; install.done = true; notify(); });
}

export const canPromptInstall = () => !!install.prompt;
export const platform = () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
export const isStandalone = () => install.done || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isSecure = () => isSecureContext || location.hostname === 'localhost';

export async function promptInstall() {
  const p = install.prompt;
  if (!p) return 'unavailable';
  p.prompt();
  const { outcome } = await p.userChoice;
  install.prompt = null;
  notify();
  return outcome; // 'accepted' | 'dismissed'
}

// ---------- Hors ligne ----------
export async function offlineStatus() {
  const supported = 'serviceWorker' in navigator && isSecure();
  const out = { supported, controlled: false, files: 0, cacheName: '', persisted: null, canPersist: !!navigator.storage?.persist };
  if (supported) {
    out.controlled = !!navigator.serviceWorker.controller;
    try {
      const name = (await caches.keys()).find((k) => k.startsWith('fretly-'));
      if (name) { out.cacheName = name; out.files = (await (await caches.open(name)).keys()).length; }
    } catch { /* cache inaccessible */ }
  }
  try { out.persisted = await navigator.storage?.persisted?.(); } catch { /* non supporté */ }
  return out;
}

// Demande au navigateur de ne pas effacer les chansons en cas de manque de place
export async function requestPersist() {
  try { return await navigator.storage.persist(); } catch { return false; }
}

export async function checkUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) return 'unavailable';
  await reg.update();
  return reg.installing || reg.waiting ? 'installing' : 'uptodate';
}

// ---------- Bandeau réseau / mise à jour ----------
let bar;
function showBar(text, { action, onAction, kind = 'info' } = {}) {
  bar ||= Object.assign(document.createElement('div'), { className: 'bar', role: 'status' });
  bar.className = `bar ${kind}`;
  bar.textContent = text;
  if (action) {
    const b = Object.assign(document.createElement('button'), { className: 'btn', textContent: action });
    b.onclick = onAction;
    bar.append(' ', b);
  }
  if (!bar.isConnected) document.body.append(bar);
}
const hideBar = () => bar?.remove();

export function initBar(onBackOnline) {
  const sync = () => (navigator.onLine ? hideBar() : showBar('Hors ligne : vos chansons restent disponibles, la synchronisation reprendra au retour du réseau.', { kind: 'offline' }));
  addEventListener('offline', sync);
  addEventListener('online', () => { sync(); onBackOnline?.(); });
  sync();
  // Nouvelle version installée en arrière-plan : proposer de recharger (pas à la toute première installation)
  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (had) showBar('Une nouvelle version de Fretly est prête.', { action: 'Recharger', onAction: () => location.reload() });
    });
  }
}

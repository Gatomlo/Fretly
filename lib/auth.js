// Comptes utilisateurs simples, sur le principe de Cabas / Fée Lezcomptes : e-mail + mot de passe
// (scrypt), session par cookie HttpOnly de 90 jours, aucun e-mail envoyé.
//  - le premier compte créé est libre et devient administrateur ;
//  - ensuite, inscription uniquement par lien d'invitation (créé par l'administrateur) ;
//  - mot de passe oublié : lien de réinitialisation créé par l'administrateur, ou `npm run set-password`.
// Stockage : data/auth.json (écriture atomique). Les données des chansons sont dans lib/sync.js.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const express = require('express');
const syncStore = require('./sync');

const scrypt = promisify(crypto.scrypt);
const DATA = process.env.FRETLY_DATA || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA, 'auth.json');
const COOKIE = 'fretly_session';
const SESSION_TTL = 90 * 24 * 3600 * 1000;
const INVITE_TTL = 7 * 24 * 3600 * 1000;
const RESET_TTL = 48 * 3600 * 1000;
const MIN_PASSWORD = 8;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');
const httpError = (status, message) => Object.assign(new Error(message), { status });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Stockage ----------
let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { db = {}; }
  for (const k of ['users', 'invites', 'resets', 'sessions']) db[k] ||= [];
  return db;
}
function save() {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

// ---------- Limiteur d'échecs ----------
function limiter(windowMs) {
  const hits = new Map();
  const live = (k) => {
    const now = Date.now();
    const a = (hits.get(k) || []).filter((t) => now - t < windowMs);
    hits.set(k, a);
    return a;
  };
  return { count: (k) => live(k).length, hit: (k) => live(k).push(Date.now()) };
}
const failures = limiter(15 * 60 * 1000);
const tooManyFailures = (email) => failures.count(`u:${email}`) >= 8;
const recordFailure = (email) => { failures.hit(`u:${email}`); failures.hit('*'); };
const failureDelay = () => (failures.count('*') >= 40 ? 3000 : 600);

// ---------- Mots de passe (scrypt) : scrypt$<sel>$<empreinte> ----------
function checkPassword(p) {
  if (typeof p !== 'string' || p.length < MIN_PASSWORD) throw httpError(400, `Mot de passe trop court (${MIN_PASSWORD} caractères minimum).`);
  if (p.length > 200) throw httpError(400, 'Mot de passe trop long.');
}
async function hashPassword(p) {
  checkPassword(p);
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await scrypt(p, salt, 64)).toString('hex')}`;
}
// Compte inconnu : même calcul sur une empreinte factice (le temps de réponse ne révèle rien)
const DUMMY = `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`;
async function verifyPassword(p, stored) {
  const [, salt, hash] = String(stored || DUMMY).split('$');
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(String(p || '').slice(0, 200), Buffer.from(salt, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual) && !!stored;
}

function normEmail(e) {
  const mail = String(e || '').trim().toLowerCase();
  if (mail.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw httpError(400, 'Adresse e-mail invalide.');
  return mail;
}
const cleanName = (n) => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 60);
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

// ---------- Cookie et sessions ----------
// Chemin de montage (/fretly dans la passerelle, '' seule) : le cookie reste propre à l'app.
function rootPath(req) {
  const m = req.app && req.app.mountpath;
  return typeof m === 'string' && m !== '/' ? m : '';
}
// FRETLY_PUBLIC_URL (ex. https://exemple.be/fretly) évite de se fier à l'en-tête Host
function publicUrl(req) {
  const fixed = String(process.env.FRETLY_PUBLIC_URL || '').replace(/\/+$/, '');
  if (fixed) return fixed;
  const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  return `${proto}://${req.get('host')}${rootPath(req)}`;
}
function readCookie(req) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function setCookie(req, res, value, maxAge) {
  const secure = req.secure || String(req.get('x-forwarded-proto') || '').startsWith('https');
  const parts = [`${COOKIE}=${value}`, `Path=${rootPath(req)}/`, `Max-Age=${Math.floor(maxAge / 1000)}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
function createSession(req, res, userId) {
  const d = load();
  const token = newToken();
  const now = Date.now();
  d.sessions = d.sessions.filter((s) => s.exp > now);
  d.sessions.push({ hash: sha256(token), userId, exp: now + SESSION_TTL });
  save();
  setCookie(req, res, token, SESSION_TTL);
}
function destroySession(req, res) {
  const token = readCookie(req);
  if (token) {
    const d = load();
    d.sessions = d.sessions.filter((s) => s.hash !== sha256(token));
    save();
  }
  setCookie(req, res, '', 0);
}

function loadUser(req, res, next) {
  req.user = null;
  const token = readCookie(req);
  if (token) {
    const d = load();
    const s = d.sessions.find((x) => x.hash === sha256(token));
    const u = s && s.exp > Date.now() && d.users.find((x) => x.id === s.userId);
    if (u) {
      req.user = publicUser(u);
      if (s.exp - Date.now() < SESSION_TTL - 24 * 3600 * 1000) { // prolongée au plus une fois par jour
        s.exp = Date.now() + SESSION_TTL;
        save();
        setCookie(req, res, token, SESSION_TTL);
      }
    }
  }
  next();
}
const requireUser = (req, res, next) => (req.user ? next() : next(httpError(401, 'Connexion requise.')));
const requireAdmin = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : next(httpError(403, "Réservé à l'administrateur.")));

// ---------- Routes ----------
const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/session', (req, res) => res.json({ user: req.user, firstRun: load().users.length === 0 }));

router.post('/register', wrap(async (req, res) => {
  const { email, name, password, invite } = req.body || {};
  const mail = normEmail(email);
  const d = load();
  const first = d.users.length === 0;
  const inv = first ? null : d.invites.find((i) => i.hash === sha256(String(invite || '')) && i.exp > Date.now());
  if (!first && !inv) throw httpError(400, "Lien d'invitation invalide ou expiré.");
  if (d.users.some((u) => u.email === mail)) throw httpError(409, 'Cette adresse a déjà un compte.');
  const hash = await hashPassword(password);
  // Rien ne doit avoir changé pendant le calcul du hachage (deux inscriptions simultanées)
  if ((first && d.users.length !== 0) || (!first && !d.invites.includes(inv)) || d.users.some((u) => u.email === mail)) {
    throw httpError(409, 'Inscription concurrente, réessayez.');
  }
  const user = { id: crypto.randomBytes(16).toString('hex'), email: mail, name: cleanName(name) || mail.split('@')[0], hash, role: first ? 'admin' : 'user', created: Date.now() };
  d.users.push(user);
  if (inv) d.invites = d.invites.filter((i) => i !== inv);
  save();
  createSession(req, res, user.id);
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const mail = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (tooManyFailures(mail)) throw httpError(429, 'Trop d\'échecs : réessayez dans 15 minutes.');
  const u = load().users.find((x) => x.email === mail);
  if (!(await verifyPassword(req.body && req.body.password, u && u.hash))) {
    recordFailure(mail);
    await sleep(failureDelay());
    throw httpError(401, 'E-mail ou mot de passe incorrect.');
  }
  createSession(req, res, u.id);
  res.json({ user: publicUser(u) });
}));

router.post('/logout', (req, res) => { destroySession(req, res); res.json({ ok: true }); });

router.post('/password', requireUser, wrap(async (req, res) => {
  const d = load();
  const u = d.users.find((x) => x.id === req.user.id);
  if (!(await verifyPassword(req.body && req.body.current, u.hash))) throw httpError(403, 'Mot de passe actuel incorrect.');
  u.hash = await hashPassword(req.body.password);
  save();
  res.json({ ok: true });
}));

// --- Administrateur : invitations, utilisateurs, réinitialisations ---
router.post('/invite', requireUser, requireAdmin, (req, res) => {
  const d = load();
  const token = newToken();
  const now = Date.now();
  d.invites = d.invites.filter((i) => i.exp > now);
  d.invites.push({ hash: sha256(token), exp: now + INVITE_TTL, by: req.user.id });
  save();
  res.json({ link: `${publicUrl(req)}/#/login?invite=${token}`, days: INVITE_TTL / 86400000 });
});

router.get('/users', requireUser, requireAdmin, (req, res) => {
  res.json(load().users.map((u) => ({ ...publicUser(u), created: u.created })));
});

router.post('/reset', requireUser, requireAdmin, (req, res) => {
  const d = load();
  const u = d.users.find((x) => x.id === String((req.body && req.body.userId) || ''));
  if (!u) throw httpError(404, 'Utilisateur introuvable.');
  const token = newToken();
  d.resets = d.resets.filter((r) => r.exp > Date.now() && r.userId !== u.id);
  d.resets.push({ hash: sha256(token), userId: u.id, exp: Date.now() + RESET_TTL });
  save();
  res.json({ link: `${publicUrl(req)}/#/reset?token=${token}`, hours: RESET_TTL / 3600000 });
});

router.post('/reset-confirm', wrap(async (req, res) => {
  const d = load();
  const r = d.resets.find((x) => x.hash === sha256(String((req.body && req.body.token) || '')) && x.exp > Date.now());
  const u = r && d.users.find((x) => x.id === r.userId);
  if (!u) throw httpError(400, 'Lien expiré ou déjà utilisé. Demandez-en un nouveau.');
  u.hash = await hashPassword(req.body.password);
  d.resets = d.resets.filter((x) => x !== r);
  d.sessions = d.sessions.filter((s) => s.userId !== u.id); // les anciennes sessions sont fermées
  save();
  createSession(req, res, u.id);
  res.json({ user: publicUser(u) });
}));

router.delete('/users/:id', requireUser, requireAdmin, (req, res) => {
  const d = load();
  const u = d.users.find((x) => x.id === req.params.id);
  if (!u) throw httpError(404, 'Utilisateur introuvable.');
  if (u.id === req.user.id) throw httpError(400, 'Vous ne pouvez pas supprimer votre propre compte.');
  d.users = d.users.filter((x) => x !== u);
  d.sessions = d.sessions.filter((s) => s.userId !== u.id);
  d.resets = d.resets.filter((r) => r.userId !== u.id);
  save();
  syncStore.remove(u.id);
  res.json({ ok: true });
});

// Mot de passe de secours : `npm run set-password -- <email> <mot de passe>`
async function setPasswordFor(email, password) {
  const d = load();
  const u = d.users.find((x) => x.email === String(email || '').trim().toLowerCase());
  if (!u) throw new Error('Aucun compte avec cette adresse.');
  u.hash = await hashPassword(password);
  d.sessions = d.sessions.filter((s) => s.userId !== u.id);
  save();
}

// Pour les tests : repart d'un état vide relu depuis le disque
function resetCache() { db = null; }

module.exports = { router, loadUser, requireUser, setPasswordFor, hashPassword, verifyPassword, resetCache };

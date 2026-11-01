// Fretly : PWA statique. Autonome (`node server.js`) ou montée par node-gateway (apps/fretly -> /fretly).
const express = require('express');
const path = require('path');
const { importFromUrl } = require('./lib/boiteachansons');
const { sync } = require('./lib/sync');
const auth = require('./lib/auth');

const app = express();
app.use(auth.loadUser);

// Import d'une partition boiteachansons.net (le navigateur ne peut pas l'appeler directement : CORS).
// Réservé aux comptes : la passerelle n'est pas un relais ouvert.
app.get('/api/import', auth.requireUser, async (req, res) => {
  try {
    res.json(await importFromUrl(String(req.query.url || '')));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Comptes (e-mail + mot de passe, session par cookie) et synchronisation des données du compte
app.use('/api/auth', express.json({ limit: '20kb' }), auth.router);
app.post('/api/sync', auth.requireUser, express.json({ limit: '8mb' }), (req, res) => {
  res.json(sync(req.user.id, req.body));
});
// Erreurs de l'API en JSON (le front affiche `error`)
app.use('/api', (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  res.status(status).json({ error: status === 500 ? 'Erreur serveur.' : err.message });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => console.log(`Fretly sur http://localhost:${PORT}`));
}

module.exports = app;

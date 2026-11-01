// Fretly : PWA statique. Autonome (`node server.js`) ou montée par node-gateway (apps/fretly -> /fretly).
const express = require('express');
const path = require('path');
const { importFromUrl } = require('./lib/boiteachansons');

const app = express();
// Import d'une partition boiteachansons.net (le navigateur ne peut pas l'appeler directement : CORS)
app.get('/api/import', async (req, res) => {
  try {
    res.json(await importFromUrl(String(req.query.url || '')));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => console.log(`Fretly sur http://localhost:${PORT}`));
}

module.exports = app;

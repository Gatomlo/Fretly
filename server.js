// Fretly : PWA statique. Autonome (`node server.js`) ou montée par node-gateway (apps/fretly -> /fretly).
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => console.log(`Fretly sur http://localhost:${PORT}`));
}

module.exports = app;

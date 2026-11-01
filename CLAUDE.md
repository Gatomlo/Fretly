# Fretly

PWA pour guitariste (smartphone + tablette) : **accordeur**, **carnet de chant** (paroles + accords, format ChordPro) et **bible des accords** (tap sur un accord d'une chanson → diagramme). UI en français.

## Stack
Front : JavaScript ES modules natifs dans `public/`, **sans build**. Serveur : `server.js` (Express 4, fichiers statiques, `module.exports = app`, `listen` seulement si lancé seul) pour être monté par **node-gateway**. Données en `localStorage`. PWA hors-ligne (`sw.js`, réseau d'abord). Tests : `node --test` (Node ≥ 20).

## Architecture
- `public/index.html` + `public/js/app.js` (tous les chemins sont relatifs : l'app vit sous `/fretly/`) : routeur par hash (`#/tuner`, `#/songs`, `#/song/:id`, `#/song/:id/edit`, `#/chords/:accord`, `#/settings`) ; chaque vue = `js/views/<nom>.js` exportant `mount(root, param)` qui renvoie une fonction de nettoyage.
- Chemins ci-dessous relatifs à `public/js/`.
- Modules purs (testés, sans DOM) : `music.js` (notes, parsing/transposition d'accords), `chords.js` (doigtés générés depuis gabarits E/A mobiles + table `OPEN`), `chordpro.js` (parser + conversion « accords au-dessus »), `pitch.js` (YIN, accordages).
- `diagram.js` (SVG d'accord), `audio.js` (corde pincée Karplus-Strong), `chordDialog.js` (fenêtre d'accord), `store.js` (songs/settings), `seed.js` (2 chansons domaine public).
- `views/reader.js` : cœur du pilotage mains libres.

## Import de partitions
`GET /api/import?url=` (server.js) → `lib/boiteachansons.js` lit une page `https://www.boiteachansons.net/partitions/…` (hôte et chemin en liste blanche) et la convertit en ChordPro (`div.pL` / `span.a[data-aff]`, ton et capo en champs cachés). Utilisé par l'éditeur (champ « Importer »). Sans serveur Node, l'import est indisponible (coller le texte + « Convertir »). Contenu soumis aux droits de ses ayants droit : usage personnel.

## Pilotage mains libres (lecteur)
Défilement auto en lignes/min avec compte à rebours 3 s (vitesse mémorisée par chanson) ; mode **pages** en colonnes CSS (tout tient à l'écran, tablette paysage) ; bandes tactiles larges sur les bords ; touche texte = pause ; pédales Bluetooth (flèches, PageUp/Down, Espace = pause, +/− vitesse) ; Wake Lock.

## Modèle de données
Chanson : `{id, title, artist, key, capo, body (ChordPro), transpose, speed, updated}`. Clés localStorage : `fretly.songs|settings|seeded`.

## Commandes
- Lancer : `npm install` puis `npm start` (http://localhost:8080 ; le micro exige HTTPS ou localhost)
- Tests : `npm test`
- Déploiement : dossier `apps/fretly` de `Gatomlo/node-gateway` (route `/fretly`) ; copier sans `node_modules`, `npm install` à la racine de la passerelle, redémarrer. HTTPS fourni par l'hébergeur (Infomaniak). Si `public/sw.js` ou sa liste `SHELL` change, incrémenter `CACHE`.

## Méthode de travail
Tests d'abord sur les modules purs, puis vérification dans le navigateur. Pistes : Web MIDI/gamepad pour pédales, tuning ukulele/basse, icônes PNG, IndexedDB si gros carnets.

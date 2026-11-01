# Fretly

PWA pour guitariste (smartphone + tablette) : **accordeur**, **carnet de chant** (paroles + accords, format ChordPro) et **bible des accords** (tap sur un accord d'une chanson → diagramme). UI en français.

## Stack
JavaScript ES modules natifs, **sans build ni dépendance**. Données en `localStorage`. PWA hors-ligne (`sw.js`, réseau d'abord). Tests : `node --test` (Node ≥ 20).

## Architecture
- `index.html` + `js/app.js` : routeur par hash (`#/tuner`, `#/songs`, `#/song/:id`, `#/song/:id/edit`, `#/chords/:accord`, `#/settings`) ; chaque vue = `js/views/<nom>.js` exportant `mount(root, param)` qui renvoie une fonction de nettoyage.
- Modules purs (testés, sans DOM) : `music.js` (notes, parsing/transposition d'accords), `chords.js` (doigtés générés depuis gabarits E/A mobiles + table `OPEN`), `chordpro.js` (parser + conversion « accords au-dessus »), `pitch.js` (YIN, accordages).
- `diagram.js` (SVG d'accord), `audio.js` (corde pincée Karplus-Strong), `chordDialog.js` (fenêtre d'accord), `store.js` (songs/settings), `seed.js` (2 chansons domaine public).
- `views/reader.js` : cœur du pilotage mains libres.

## Pilotage mains libres (lecteur)
Défilement auto en lignes/min avec compte à rebours 3 s (vitesse mémorisée par chanson) ; mode **pages** en colonnes CSS (tout tient à l'écran, tablette paysage) ; bandes tactiles larges sur les bords ; touche texte = pause ; pédales Bluetooth (flèches, PageUp/Down, Espace = pause, +/− vitesse) ; Wake Lock.

## Modèle de données
Chanson : `{id, title, artist, key, capo, body (ChordPro), transpose, speed, updated}`. Clés localStorage : `fretly.songs|settings|seeded`.

## Commandes
- Lancer : `npm start` (http://localhost:8080 ; le micro exige HTTPS ou localhost)
- Tests : `npm test`
- Déploiement : GitHub Pages via `.github/workflows/pages.yml` (push sur `main`). Si `sw.js` ou la liste `SHELL` change, incrémenter `CACHE`.

## Méthode de travail
Tests d'abord sur les modules purs, puis vérification dans le navigateur. Pistes : Web MIDI/gamepad pour pédales, tuning ukulele/basse, icônes PNG, IndexedDB si gros carnets.

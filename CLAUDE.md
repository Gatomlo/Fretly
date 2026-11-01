# Fretly

PWA pour guitariste (smartphone + tablette) : **accordeur**, **carnet de chant** (paroles + accords, format ChordPro) et **bible des accords** (tap sur un accord d'une chanson → diagramme). UI en français.

## Stack
Front : JavaScript ES modules natifs dans `public/`, **sans build**. Serveur : `server.js` (Express 4, fichiers statiques, `module.exports = app`, `listen` seulement si lancé seul) pour être monté par **node-gateway**. Données en `localStorage`. PWA hors-ligne (`sw.js`, réseau d'abord). Tests : `node --test` (Node ≥ 20).

## Architecture
- `public/index.html` + `public/js/app.js` (tous les chemins sont relatifs : l'app vit sous `/fretly/`) : routeur par hash (`#/tuner`, `#/songs`, `#/song/:id`, `#/song/:id/edit`, `#/chords/:accord`, `#/settings`) ; chaque vue = `js/views/<nom>.js` exportant `mount(root, param)` qui renvoie une fonction de nettoyage.
- Chemins ci-dessous relatifs à `public/js/`.
- Modules purs (testés, sans DOM) : `music.js` (notes, parsing/transposition d'accords), `chords.js` (doigtés générés depuis gabarits E/A mobiles + table `OPEN`), `chordpro.js` (parser + conversion « accords au-dessus »), `pitch.js` (YIN, accordages).
- `diagram.js` (SVG d'accord), `audio.js` (corde pincée Karplus-Strong), `chordDialog.js` (fenêtre d'accord), `store.js` (songs/sets/settings/sync), `seed.js` (2 chansons domaine public, ids fixes), `cover.js` (teinte + couverture par chanson).
- `views/reader.js` : cœur du pilotage mains libres ; bandeau `#strip` = diagrammes des accords de la ligne en cours + suivantes (suit le scroll ou la page, bouton 🎸, réglage `strip`).

## Fonctions du carnet
Favoris, étiquettes, tri ; **setlists** (`#/sets`, `#/set/:id`, lecture `#/song/:id?set=:id` avec « Suivant ») ; accords **A2/E4**, 5, 7sus4, maj9… (alias dans `chords.js`, version simplifiée pour les accords étendus) ; **position d'accord préférée** (`settings.voicings`, étoile dans la fenêtre d'accord) ; ding de l'accordeur quand la corde est juste.
Lecteur : feuille d'options (⋯) = capo posé (les accords affichés sont les formes à jouer, option « accords d'origine »), métronome (tempo/tap, `audio.js`), mode scène, favori ; vitesse **par section** (en lecture, +/− règle la section en cours).

## Synchronisation (sans compte)
`POST /api/sync` (`lib/sync.js`) : l'en-tête `x-fretly-key` (code de 16-64 car. saisi dans Réglages) désigne un fichier `data/sync/<sha256>.json` ; fusion élément par élément (`updated` le plus récent gagne, suppressions = tombstones `deleted`). Le client (`store.js` : `sync.run/schedule`) synchronise au lancement et 1,5 s après chaque modification. `data/` n'est pas versionné : à conserver lors des déploiements (variable `FRETLY_DATA` possible).

## Import de partitions
`GET /api/import?url=` (server.js) → `lib/boiteachansons.js` lit une page `https://www.boiteachansons.net/partitions/…` (hôte et chemin en liste blanche) et la convertit en ChordPro (`div.pL` / `span.a[data-aff]`, ton et capo en champs cachés). Utilisé par l'éditeur (champ « Importer »). Sans serveur Node, l'import est indisponible (coller le texte + « Convertir »). Contenu soumis aux droits de ses ayants droit : usage personnel.

## Pilotage mains libres (lecteur)
Défilement auto en lignes/min avec compte à rebours 3 s (vitesse mémorisée par chanson) ; mode **pages** en colonnes CSS (tout tient à l'écran, tablette paysage) ; bandes tactiles larges sur les bords ; touche texte = pause ; pédales Bluetooth (flèches, PageUp/Down, Espace = pause, +/− vitesse) ; Wake Lock.

## Modèle de données
Chanson : `{id, title, artist, key, capo, body (ChordPro), transpose, speed, updated}`. Clés localStorage : `fretly.songs|settings|seeded`.

## Commandes
- Lancer : `npm install` puis `npm start` (http://localhost:8080 ; le micro exige HTTPS ou localhost)
- Tests : `npm test`
- Déploiement : dossier `apps/fretly` de `Gatomlo/node-gateway` (route `/fretly`) ; copier sans `node_modules`, `npm install` à la racine de la passerelle, redémarrer. HTTPS fourni par l'hébergeur (Infomaniak). Si `public/sw.js` ou sa liste `SHELL` change, incrémenter `CACHE`. Icônes PNG générées avec Pillow à partir de `icon.svg` (icon-192/512, apple-touch-icon).

## Méthode de travail
Tests d'abord sur les modules purs, puis vérification dans le navigateur. Pistes : Web MIDI/gamepad pour pédales, tuning ukulele/basse, icônes PNG, IndexedDB si gros carnets.

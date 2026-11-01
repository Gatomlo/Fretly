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

## Comptes et synchronisation
Même principe que Cabas / Fée Lezcomptes : e-mail + mot de passe (**scrypt**), session par cookie `fretly_session` (HttpOnly, SameSite=Lax, 90 j, `Path=<montage>/`), **aucun e-mail envoyé**. Le **premier compte créé est libre et devient admin** ; ensuite inscription **par lien d'invitation** (admin : Réglages → Administration, 7 j, usage unique) ; mot de passe oublié = **lien de réinitialisation** généré par l'admin (48 h) ou `npm run set-password -- <email> <mdp>`. Échecs de connexion limités (8 / 15 min / adresse).
- `lib/auth.js` : stockage `data/auth.json`, routes `/api/auth/*` (session, register, login, logout, password, invite, users, reset, reset-confirm), gardes `requireUser`. `FRETLY_PUBLIC_URL` (ex. `https://<domaine>/fretly`) fixe l'adresse des liens ; sinon déduite de la requête.
- `lib/sync.js` : `POST /api/sync` (connecté) fusionne l'état du compte (`data/sync/<idUtilisateur>.json`) : élément par élément, `updated` le plus récent gagne, suppressions = tombstones `deleted`. Client : `store.js` (`account`, `sync.run/schedule`) et `account.js` ; synchro au lancement et 1,5 s après chaque modification, uniquement connecté. Sans compte, tout reste local (l'app fonctionne hors serveur).
- `/api/import` exige aussi un compte. Vues : `#/login[?invite=]`, `#/reset?token=`, section Compte des Réglages.
- `data/` (comptes + données) n'est pas versionné : **à conserver lors des déploiements** (`FRETLY_DATA` pour le déplacer).

## Import de partitions (plusieurs sources possibles)
- **Registre** `lib/sources.js` : un site = un module (`checkUrl(raw)` valide l'adresse et lève une erreur sinon ; `parse(html)` renvoie `{title, artist, key, capo, tempo, body ChordPro}`) + une entrée dans `SOURCES`. L'éditeur et l'écran d'import proposent alors automatiquement le nouveau site. Source actuelle : `lib/boiteachansons.js` (`div.pL` / `span.a[data-aff]`, ton et capo en champs cachés).
- API : `GET /api/import/sources` (public) ; `GET /api/import?url=&source=` (compte requis, 300/heure/compte, source détectée d'après l'adresse si absente, hôte et chemin en liste blanche).
- **Import en masse** `#/import` (`views/import.js`) : choix de la source, adresses collées (une par ligne, extraites par `urls.js`) → **file d'attente** gardée sur l'appareil (`fretly.queue`) → « Importer » les traite une à une (pause 700 ms), reprise possible, échecs relançables, doublons repérés via `sourceUrl` (champ `source`/`sourceUrl` conservés sur la chanson, lien « Source » dans les options du lecteur). Éditeur : même choix de source pour un import unitaire.
- Sans serveur Node ni compte, l'import est indisponible (coller le texte + « Convertir »). Contenu soumis aux droits de ses ayants droit : usage personnel.

## Pilotage mains libres (lecteur)
Défilement auto en lignes/min avec compte à rebours 3 s (vitesse mémorisée par chanson) ; mode **pages** en colonnes CSS (tout tient à l'écran, tablette paysage) ; bandes tactiles larges sur les bords ; touche texte = pause ; pédales Bluetooth (flèches, PageUp/Down, Espace = pause, +/− vitesse) ; Wake Lock.

## Modèle de données
Chanson : `{id, title, artist, key, capo, body (ChordPro), transpose, speed, updated}`. Clés localStorage : `fretly.songs|settings|seeded`.

## Commandes
- Lancer : `npm install` puis `npm start` (http://localhost:8080 ; le micro exige HTTPS ou localhost)
- Tests : `npm test`
- Déploiement : dossier `apps/fretly` de `Gatomlo/node-gateway` (route `/fretly`) ; copier sans `node_modules`, `npm install` à la racine de la passerelle, redémarrer. HTTPS fourni par l'hébergeur (Infomaniak). Si `public/sw.js` ou sa liste `SHELL` change, incrémenter `CACHE`. Icônes : `public/manifest.json` (nom exigé par node-gateway : sa page d'accueil affiche `icons[0]` en tuile), `public/icon.svg` + PNG (icon-192/512, apple-touch-icon) générés par `python scripts/make-icons.py` (Pillow, même dessin que le SVG : à modifier ensemble).

## Méthode de travail
Tests d'abord sur les modules purs, puis vérification dans le navigateur. Pistes : Web MIDI/gamepad pour pédales, tuning ukulele/basse, icônes PNG, IndexedDB si gros carnets.

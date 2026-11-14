# Lot 11 / T0 — Outillage de preuve audio

Tâche T0 du plan du chef de lot (elle n'est pas dans `lots/lot-11.md`) : outillage seulement, aucun code du jeu.
Constats : MIX-11 (partie banc), MIX-09, LOAD-13, MIX-08.

Classe de preuve : **état identique**. Le commit ne touche ni `src/`, ni `dist/`, ni `SIZE.json` ;
`python3 tools/build.py` rejoué redonne `dist/index.html` et `SIZE.json` à l'octet près.

Base : `71eca61c0b8f3bbaa05b0692d9fa4fd192b9f2db` (`chantier/integration`). Ses dossiers `src/`, `tools/` et `checks/`
sont identiques à `main` `363473a` (METAL 0.8.1, musique d'accueil thrash comprise).
`src/audio.js` `4b36fde2…452b6d`, `src/music.js` `6f1ab99a…f61f74` (sha256 complets dans `manifest.json`).

## Ce que T0 livre

1. **`tools/audio-prep-profile.mjs`** : profil de la préparation audio dans le domaine principal de Node
   (`tools/realm-loader.mjs`, realm `main`), jamais sous `node:vm`.
   - Tranches réelles de `FAudio.prepare(stage)` et de `FMusic.warmup('title')`, avec un contexte Web Audio factice
     et un minuteur factice pompé par le banc : un rappel du minuteur et toutes ses microtâches forment une tranche,
     ce qu'un navigateur exécute d'un bloc.
   - Deux racines comparées par paires, ordre inversé une répétition sur deux ; médianes.
   - Empreintes sha256 (MIX-09) :
     - les 64 tampons d'effets à 22 050 Hz, construits deux fois dans le même processus, en ordre direct puis inverse ;
     - les modules 0, 1, 2 et titre, en ordre direct puis inverse ;
     - `prepareMatchesDirect` : les tampons et les modules réellement construits par le chemin découpé
       (`prepare`, `warmup`) sont comparés, à chaque passage, à la construction directe.
2. **Banc MIX** (`docs/chantier-moteur/bancs/mix/`) :
   - `gen.mjs` accepte un 4e argument facultatif, la racine B, embarquée en `SRC_B`.
     `SRC_INFO` donne la racine et les sha256 de chaque source.
   - `mix.js`, rendu « source telle quelle » (`v.source` = `'A'` ou `'B'`) :
     - FMusic puis FAudio de la source choisie sont réévalués à chaque rendu, sans aucun remplacement dans le source ;
     - aucun réglage du compresseur n'est imposé, et il n'y a pas de prises internes ;
     - on mesure la sortie (canaux 0 et 1), `audio.stats` et le nombre d'automatisations AudioParam.
   - `mix.js`, scène `t` (écran titre) :
     - le contexte s'ouvre son coupé, comme dans le jeu (audioGate) ;
     - puis `prepareTitle()`, `setTitlePlaying(true)`, son rétabli, et `audio.tick` à chaque image ;
     - durée : 30 s de scène, plus 2 s d'amorce et 1,5 s de traîne.
   - `mix.html?job=ab[&scenes=c,a,t][&noise=1]` rend la même scène avec A puis avec B. Il rend compte :
     - de la différence : `diffPeakDbFS`, `diffRmsDbFS` (`null` = −∞, sorties identiques), `firstDiffSec`, `firstOver90Sec` ;
     - de `audioParamCalls` pour A et pour B, du niveau de sortie et des voix de chaque côté ;
     - de `nullTestPass`, le critère de MIX-08 : RMS ≤ −110 dB et crête ≤ −80 dBFS ;
     - du bruit du banc, mesuré dans la même page : A est rendue `noise` fois de plus (1 par défaut, 8 au plus) et on garde le pire cas.

Les autres jobs (`calib`, `iso`, `matrix`, `null`, `tell`, `bands`, `perf`, `idle`, `attrib`, `wav`, `shelfk`) gardent
leurs remplacements de source et rendent les mêmes valeurs qu'avant : c'est vérifié sur `calib` et `null` ci-dessous.

## Reproduire

Toujours sur une copie du banc **hors du dépôt** : `run.py` écrit son profil Chrome (`chrome-profile`) à côté de lui.
Chrome est lancé sans interface, sur `file://`, sans port ni réseau.

```sh
cd <racine du dépôt>; S=<dossier temporaire hors dépôt>; mkdir -p $S/base
git archive 71eca61 src tools | tar -x -C $S/base
cp -R docs/chantier-moteur/bancs/mix $S/mix
node $S/mix/record.mjs $S/base $S/mix     # ou : gzip -dc docs/chantier-moteur/preuves/lot-11/t0/scenes.js.gz > $S/mix/scenes.js
node $S/mix/gen.mjs $S/base docs/chantier-moteur/bancs/feel/doomish.mjs $S/mix .
(cd $S/mix && python3 -I run.py "mix.html?job=calib" 120 > calib.json)
(cd $S/mix && python3 -I run.py "mix.html?job=null&scenes=c,a" 280 > null.json)
(cd $S/mix && python3 -I run.py "mix.html?job=ab&scenes=c,a,t&noise=3" 280 > ab-aa.json)
node tools/audio-prep-profile.mjs $S/base . --reps 7 --out $S/prep-aa.json
node docs/chantier-moteur/bancs/loop/play.mjs . 30 60 > $S/play-base.json
node docs/chantier-moteur/bancs/mix/load13.mjs .
```

Pour une tâche suivante, A est le commit parent de la tâche et B l'arbre de la tâche :

```sh
git archive <parent> src | tar -x -C $S/A
node $S/mix/gen.mjs $S/A docs/chantier-moteur/bancs/feel/doomish.mjs $S/mix .
(cd $S/mix && python3 -I run.py "mix.html?job=ab&scenes=c,a,t&noise=3" 280 > ab.json)
node tools/audio-prep-profile.mjs $S/A . --reps 7 --out $S/prep.json
```

Les scènes s'enregistrent une seule fois, depuis la base : `scenes.js` a pour sha256
`1f066203d3a8a5ca27262a691375a028cc890536f97b1be6b44ea3f4b62f9345`. Une copie est ici, dans `scenes.js.gz`.

## Références mesurées sur la base

Machine : Mac M5 à 10 cœurs, macOS 27.2.1, Node 24.18.0, Chrome 157.0.8103.39 sans interface, OfflineAudioContext à 48 kHz.

### Préparation audio — `prep-aa.json`

A est l'archive de `71eca61`, B l'arbre de travail : les sources sont identiques. 7 paires alternées, domaine principal, médianes.

| Mesure | A (base) | B (arbre) |
|---|---:|---:|
| Tranche maximale de `prepare(0)` | 26,18 ms | 26,04 ms |
| Total de `prepare(0)` | 155,9 ms | 150,1 ms |
| Nombre de tranches | 25 | 25 |
| Tranches au-dessus de 8 ms | 4 | 4 |
| `warmup('title')` : tranche maximale / total | 8,44 / 43,8 ms | 7,89 / 43,1 ms |
| Synthèse directe des 64 tampons (une passe) | 117,3 ms | 152,4 ms |

La machine est partagée. Un premier passage, plus chargé, a donné 34 ms et 207 ms pour les deux racines, avec le même
écart entre elles : seules les comparaisons appariées font foi.

Contenu des tranches de `prepare(0)` : 17 lots de 2 noms d'effets (2 variantes chacun, une seule pour les moteurs),
alternés avec 8 étapes musicales (6 instruments, la note de tension, puis `moduleFor`). Étiquetage fait par une copie
instrumentée, non versionnée.

- Les tranches au-dessus de 8 ms sont les lots `impact:*` + `break:*` :
  - metal, 10e tranche, médiane ≈ 25 ms ;
  - stone, 14e tranche ;
  - wood, 18e tranche ;
  - glass, 20e tranche, médiane ≈ 24 ms.
- `moduleFor` est la 17e tranche, médiane ≈ 7,5 ms.
- La dernière tranche contient le dernier lot, `finish()` et la conversion des 15 tampons de musique, ≈ 5 ms.

Empreintes : elles sont identiques pour A et B (`sameBankAB` et `sameModulesAB` vrais).

| Objet | sha256 |
|---|---|
| Banque de 64 tampons (sha256 des sha256, ordre de warmBank) | `33ab837bd0d739e97a8ab7c9a3461210be14b0b028aed4138fed8256067db043` |
| Module 0 | `50d88a07744be3d2e51a98c15f5367351f4238c504644e5475aebf64d8758cd0` |
| Module 1 | `c12b06dab600fbc391299f10b6b1814db39b6c8bc7e23569c2bd1f204b81fcbd` |
| Module 2 | `738adaa5a8460e6f8fb8a3f6b11f05d25034dede0845553587b87ea03d7a6c39` |
| Module titre | `88dfafde9f335f640c907cb709e96de72bc00d7a9fa6fb020a4625b08a08efe7` |

- En ordre inverse : 0 tampon différent, et des modules identiques.
- `prepareMatchesDirect` est vrai pour la banque, le module 0 et le module titre, sur les 14 passages.

### LOAD-13 / MIX-09 — `load13.json`

64 tampons, 0 différent, modules identiques. Le script tourne sous `node:vm` : il vaut pour les empreintes, jamais pour les temps.

### Compresseur — `calib.json`

Gain de rattrapage du DynamicsCompressor de Chrome :

| Réglage | Rattrapage |
|---|---:|
| cur | 4,55 dB |
| feel07 | 3,73 dB |
| lim | 2,56 dB |
| lim2 | 3,53 dB |
| off | 0 dB |

Retard : 288 échantillons (6 ms) à 48 kHz.

### LOOP-14 / MIX-08 — `null.json`

Différences avec le rendu actuel, en dBFS crête / dB RMS :

| Scène | Bruit du banc (2e passe) | LOOP-14 exact | LOOP-14 seuils | Appels : actuel → exact |
|---|---|---|---|---|
| c | −113,86 / −151,25 | −88,67 / −124,15 | −65,33 / −91,89 | 64 479 → 9 485 |
| a | −132,45 / −157,86 | −107,47 / −130,84 | −68,72 / −95,17 | 63 479 → 7 100 |

### `job=ab`, base contre arbre (A/A) — `ab-aa.json`

Sources identiques (`sameSource` vrai). Le bruit est le pire cas de 3 rendus supplémentaires de A.

| Scène | Différence A/B, crête / RMS | Bruit du banc, crête / RMS | Appels A = B | Sortie : crête / RMS |
|---|---|---|---:|---|
| c | −132,45 / −155,34 | −132,45 / −155,23 | 64 479 | 0,673 / −20,52 dBFS |
| a | −138,47 / −159,44 | −138,47 / −158,08 | 63 479 | 0,392 / −23,72 dBFS |
| t | −130,51 / −154,90 | −102,98 / −151,35 | 38 280 | 0,369 / −18,93 dBFS |

- `nullTestPass` est vrai partout, et `prepareTitle()` rend `true`.
- Les appels de A en (c) et (a) sont exactement ceux du rendu actuel de `job=null` : le mode « tel quel » ne perd ni n'ajoute d'automatisation.
- Contrôle croisé, sur une page jetable non versionnée : le rendu « tel quel » contre le rendu `cur` du banc avec remplacements
  donne le même nombre d'appels (64 479, 63 479, 38 280) et des différences au niveau du bruit :
  −113,86 / −151,43 en c, −138,47 / −158,34 en a, −132,45 / −156,89 en t.

### Le bruit du banc n'est jamais −∞

Deux rendus de la même source diffèrent de −103 à −138 dBFS en crête et de −151 à −161 dB en RMS. L'écart apparaît
dès 0,06 s, avec les premières notes de la musique, y compris sur l'écran titre.

Un essai avec `audio.js` et `music.js` privés de leurs gestionnaires `onended` donne le même bruit. La cause est donc
interne à Chrome : l'ordre de sommation des entrées d'un nœud.

Une égalité « −∞ » n'est donc pas atteignable. Un résultat « identique » se prouve par une différence A/B qui reste
dans l'enveloppe du bruit mesuré dans la même page, et par le critère de MIX-08.

### Boucle de jeu — `play-base.json`

`play.mjs` (`node:vm`, comptes seulement) : 34 appels AudioParam par image, 0,64 nœud par image, 78 tirs en 30 s à 60 Hz.

## Tests

`python3 tools/build.py` laisse `dist/index.html` (812 696 octets, sha256 `4587dc49…5c485a`) et `SIZE.json` inchangés.

`npm test` donne 462/470, soit exactement la référence. Les 8 échecs sont les échecs admis de `checks/campaign-world.test.mjs` :
- les six empreintes « legacy seed 1 / 96, sector 0 à 2 » ;
- « campaign mode is strictly opt-in… » ;
- « the first three campaign worlds preserve historical geometry… ».

La chaîne `&&` de `npm test` s'arrête après eux. `node checks/build.test.mjs`, lancé à part, rend `PASS`.

## Pièges

- `bancs/load/music.mjs` tourne sous `node:vm` sans le `Math` de l'hôte : les temps y sont gonflés d'environ 7 fois.
  Ne pas s'en servir pour des temps ; `tools/audio-prep-profile.mjs` le remplace.
- Après LOOP-14 (T2), `job=null` ne s'applique plus, car ses ancres `l14a` et `l14b` disparaissent.
  Utiliser `job=ab`, avec A = le commit parent.
- Le rendu « tel quel » appelle `FAudio.create()` sans option et ne charge que `audio.js` et `music.js`.
  Si une tâche change la création dans `game.js` (fichier de recettes chargé après `audio.js`, `FAudio.create(options)`),
  il faut étendre `gen.mjs` et `render` dans la même tâche. Sinon l'A/B mesurerait le moteur par défaut, pas METAL.
- Les WAV A/B 1 à 4 de l'audit n'existent plus : les régénérer avec `job=wav` sur une copie, hors du dépôt.

## Fichiers

| Fichier | Contenu |
|---|---|
| `prep-aa.json` | Profil de préparation A/A, 7 paires, avec les tranches de chaque passage |
| `load13.json` | Test de nullité LOAD-13 (`load13.mjs`) |
| `calib.json` | `job=calib` |
| `null.json` | `job=null&scenes=c,a` |
| `ab-aa.json` | `job=ab&scenes=c,a,t&noise=3`, base contre arbre |
| `play-base.json` | `play.mjs . 30 60` |
| `scenes.js.gz` | Les 4 scènes de 30 s enregistrées depuis la base |
| `npm-test.log.gz` | `npm test` complet sur l'arbre de T0 |
| `manifest.json` | sha256 des sources, des outils et des fichiers de ce dossier |

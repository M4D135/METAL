# Validation — lot « jeu-pieges-massifs »

Branche `chantier/jeu-pieges-massifs`, base `1814b81`. Machine : poste de
développement partagé, Linux arm64, Node 24.18, processus principal (jamais
`node:vm` pour les mesures). Aucune image, texture, modèle, police ou son importé ;
aucun CDN ni dépendance d'exécution cachée (`external_assets: 0`).

## Ce qui a été exécuté, et comment

| Vérification | Comment | Résultat |
| --- | --- | --- |
| Suite complète | `npm test` (27 fichiers : 25 dans le lot `node --test`, plus `checks/world.test.mjs` et `checks/build.test.mjs`) | **577 tests, 577 passés, 0 échec** (référence de départ : 510/510) |
| Référence de départ | `npm test` sur `1814b81` avant toute modification | 510 tests, 510 passés, 0 échec — aucun test de la base ne tombe |
| Brique des passages | `checks/passages.test.mjs` | 9/9 — `grid`, `flood`, `reaches`, `cuts`, `nearestFree`, `mandatoryLinks`, `tourLinks` |
| Pièges sur le chemin obligatoire | `checks/traps-mandatory.test.mjs`, banc écrit pour ce lot | **27 échecs sur la base → 58/58 en fin de lot** |
| Cohérence des mondes | `node checks/world.test.mjs` (script autonome, 18 cas) | PASS — batteries solidaires, un seul rythme par barrière, **une phase distincte par lame**, ciel ouvert au centre, aucun piège dans la zone d'entrée |
| Niveau réellement finissable | `checks/simulation.test.mjs`, bot de navigation marchant avec les collisions réelles | 120/120 — le bot attend la pièce qui barre sa case, fuit celle qui passe sur lui, fait un pas de côté ; **aucun piège diminué pour le faire passer** |
| Arme légère vs machine | même banc, 1 200 tirs de mitraillette sur une barrière | aucune pièce détruite, `hp >= 1` partout, **et** au moins une pièce marquée (`hp < 18`) |
| Explosion vs machine | même banc, projectiles `grenade` réels (`blastRadius 4,2`, `terrainPower 55`), jusqu'à 6 charges | coupe entière démontée |
| Accessibilité après destruction | même banc | chaque groupe destructible de piège porte **0 collier solide** |
| Empreintes de génération | `node tools/platform-math.mjs worlds . --fixture write`, puis `checks/campaign-world.test.mjs` (46 tests) | 6 mondes classiques + 108 mondes de campagne recalculés (changement de génération voulu), stables depuis |
| Coût du pas de simulation | `tools/ab2.mjs`, quatre scénarios historiques, 1 800 pas, comparaison appariée alternée | `identical: true` sur les deux runs (empreintes d'état strictement identiques) ; **médiane appariée −2,3 % à −10,3 %** |
| Profil à l'appui de l'optimisation | `banc-pas.mjs` + `--cpu-prof`, 21 600 pas, résumé dans les preuves | `updateEnvironment` 5,1 %, `trapPose` 3,1 % → **8 % du pas** imputable aux machines |
| Piste écartée | `part-passages.mjs`, 360 mondes chronométrés sur 3 passes | `FPassages` = **0,35 %** de la génération (103 ms / 29 029 ms) → rien de commité |
| Budgets de monde | 12 mondes classiques + 108 mondes de campagne mesurés | maillages **17 587 / 18 000**, colliers **500 / 512**, **42 machines max**, 6 à 7 barrières par monde |
| Taille et intégrité | `python3 tools/build.py`, `sha256sum dist/index.html` contre `SIZE.json` | **858 218 octets bruts** (264 166 compressés), sha256 `76b62a273bec2abc4e1ae83750ce952db8b049dc3805aee875eb1c3611e7f044`, identique à `SIZE.json` ; `external_assets: 0` |

## Ce qui a été changé aux tests, et pourquoi c'est voulu

- `checks/world.test.mjs` : l'assertion « exactement 3 pièges, un de chaque kind »
  devient « batterie solidaire » (≥ 2 lames + presse + pics, une seule période). La
  contrainte « même phase pour toute la coupe », d'abord écrite, a été **remplacée
  par « une phase distincte par lame »** : synchrones, les lames mureraient le
  couloir et le niveau ne serait plus finissable. C'est le test de complétion qui
  l'a démontré.
- `checks/world.test.mjs` : `world.horrorSites.length` ne vaut plus 7 en dur mais
  `pipes + pièges au-delà de 16 m du départ`.
- `checks/campaign-world.test.mjs` : les 6 `legacyHashes` et les 108 empreintes de
  `campaign-world-digests.json` sont regelées — les mondes JSON changent, c'est le
  but du lot.
- `checks/simulation.test.mjs` : le bot attend / fuit / contourne les machines. La
  règle du test (finir le niveau en marchant) est inchangée ; seule sa stratégie
  devient physiquement honnête.
- `package.json` : `checks/passages.test.mjs` et `checks/traps-mandatory.test.mjs`
  rejoignent la liste de `npm test` (510 → 577 tests).

## Ce qui n'est PAS testé, et attend un vrai appareil

- **La lisibilité du piège de loin.** Les lampes émissives et les barres d'alerte
  sont prouvées en géométrie, en portée et en position (hors du centre du couloir).
  Elles n'ont pas été jugées à l'œil sur un écran de téléphone. C'est le point le
  plus subjectif du lot, et le seul qui ne puisse pas se régler par un banc.
- **Le rendu visible d'une machine abîmée.** Une machine à 1 point de structure
  après 1 200 balles est un état de simulation prouvé ; ce qu'elle donne à voir ne
  l'est pas.
- **Le son et les effets** de la destruction d'une machine : non instrumentés.
- **Le combat réel** : « une explosion d'ennemi démonte la machine qui me barrait le
  chemin » n'est pas exercé ; les contacts piège/ennemis le sont, ce cas précis non.
- **Tactile et AZERTY/QWERTY** : rien dans ce lot ne touche les entrées, mais rien
  ne l'a revérifié sur matériel non plus.
- **Le rendu de secours** (Canvas 2D) sur la nouvelle machinerie : la scène 3D et sa
  copie de secours suivent la même scène, mais les lampes et barres d'alerte n'ont
  pas été regardées en mode secours.

## Ce qui n'a pas été touché

Ni la taille du monde, ni la caméra, ni les entrées, ni l'économie, ni l'audio, ni
les points de reprise. Aucun actif importé. Le principe central du projet est intact
: tout est généré par le code.

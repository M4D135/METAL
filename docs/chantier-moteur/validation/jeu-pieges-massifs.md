# Validation — lot « jeu-pieges-massifs »

Branche `chantier/jeu-pieges-massifs`, base `1814b81`. Machine : poste de
développement partagé, Linux arm64, Node 24.18, processus principal (jamais
`node:vm` pour les mesures). Aucune image, texture, modèle, police ou son importé ;
aucun CDN ni dépendance d'exécution cachée (`external_assets: 0`).

## Ce qui a été exécuté, et comment

| Vérification | Comment | Résultat |
| --- | --- | --- |
| Suite complète | `npm test` (27 fichiers : 25 dans le lot `node --test`, plus `checks/world.test.mjs` et `checks/build.test.mjs`) | **579 tests, 579 passés, 0 échec** (référence de départ : 510/510) |
| Référence de départ | `npm test` sur `1814b81` avant toute modification | 510 tests, 510 passés, 0 échec — aucun test de la base ne tombe |
| Brique des passages | `checks/passages.test.mjs` | 9/9 — `grid`, `flood`, `reaches`, `cuts`, `nearestFree`, `mandatoryLinks`, `tourLinks` |
| Pièges sur le chemin obligatoire | `checks/traps-mandatory.test.mjs`, banc écrit pour ce lot | **27 échecs sur la base → 59/59 en fin de lot** (dont le cas « corps dans la bande d'arrêt d'une lame », qui échouait avant le correctif `99596c3`) |
| Cohérence des mondes | `node checks/world.test.mjs` (script autonome, 18 cas) | PASS — batteries solidaires, un seul rythme par barrière, **une phase distincte par lame**, ciel ouvert au centre, aucun piège dans la zone d'entrée |
| Niveau réellement finissable | `checks/simulation.test.mjs`, bot de navigation marchant avec les collisions réelles | 120/120 — le bot attend la pièce qui barre sa case, fuit celle qui passe sur lui, fait un pas de côté ; **aucun piège diminué pour le faire passer** |
| Arme légère vs machine | même banc, 1 200 tirs de mitraillette sur une barrière | aucune pièce détruite, `hp >= 1` partout, **et** au moins une pièce marquée (`hp < 18`) |
| Explosion vs machine | même banc, projectiles `grenade` réels (`blastRadius 4,2`, `terrainPower 55`), jusqu'à 6 charges | coupe entière démontée |
| Accessibilité après destruction | même banc | chaque groupe destructible de piège porte **0 collier solide** |
| Empreintes de génération | `node tools/platform-math.mjs worlds . --fixture write`, puis `checks/campaign-world.test.mjs` (47 tests) | 6 mondes classiques + 108 mondes de campagne recalculés (changement de génération voulu), stables depuis ; l'empreinte du **plan** est épinglée contre la base du lot |
| Coût du pas de simulation | `tools/ab2.mjs`, 6 scénarios (4 historiques + 2 campagne V2), 1 800 pas, 5 répétitions, comparaison appariée alternée | `identical: true` sur les deux runs (empreintes d'état strictement identiques) ; **médiane appariée −0,83 % à −10,92 %** selon scénario et run — seuil de 5 % non atteint, assumé et chiffré dans le rapport |
| Profil à l'appui de l'optimisation | `banc-pas.mjs` + `--cpu-prof`, 21 600 pas, résumé dans les preuves | `updateEnvironment` 5,1 %, `trapPose` 3,1 % → **8 % du pas** imputable aux machines |
| Piste écartée | `part-passages.mjs`, 360 mondes chronométrés sur 3 passes | `FPassages` = **0,35 %** de la génération (103 ms / 29 029 ms) → rien de commité |
| Budgets de monde | 12 mondes classiques + 108 mondes de campagne mesurés | maillages **17 587 / 18 000**, colliers **500 / 512**, **42 machines max**, 6 à 7 barrières par monde |
| Taille et intégrité | `python3 tools/build.py`, `sha256sum dist/index.html` contre `SIZE.json` | **858 656 octets bruts**, sha256 `e2348300654115f74cd391f971e5c1f264f081bfe0e3f3e76b7616390162bf02`, identique à `SIZE.json` ; `external_assets: 0` ; plafond 1 400 000 respecté |
| Contre-vérification — ce qui bouge hors pièges | `node .relais/compare2.mjs .relais/base .` sur 81 mondes | `same=0 diffs=81` ; `pipes` 81/81, `enemies` 81/81, `encounterBays` 74/81, `encounters` 65/81, `ambience` 27/81, `pickups` 22/81, `machinery` 9/81 — la phrase « same supplies and garrison » du banc était fausse, réécrite |
| Contre-vérification — le plan n'a pas bougé | `node .relais/plan-pin.mjs .relais/base .` sur les 114 mondes, 16 champs structurels | `PLAN IDENTIQUE`, empreinte `c512762e3cf8f14c3ecb4611f38eb019807dff98891ab4547105e3b97c2be352` sur les deux états — épinglée par un test |
| Contre-vérification — garnison hors des machines | `node .relais/emprise.mjs <racine> 0.7 --full` | 0 entrée de garnison ni de baie dans l'emprise d'une machine sur 3 496 entrées, base et tête. **17 cells de réserve** en revanche dans l'emprise d'une machine sur la tête (0 sur la base) — atteignables, mais sous la menace : décision à confirmer par David |
| Contre-vérification — boîte de repos figée | `node .relais/shortcut-probe.mjs .relais/avant-au-dela .` | avant le correctif : `après retrait : avant -4.3500 | tête -1.9700`, `DIVERGENCE: OUI` ; après : les deux à `-4.3500`, `DIVERGENCE: NON` |
| Contre-vérification — densité et ancres | `node .relais/densite.mjs .` sur les 18 mondes de `checks/world.test.mjs` | 30 à 42 machines en 6 à 7 coupes, 34 à 46 ancres : les planchers du banc (24) sont sous la mesure, l'assertion d'ancres n'est plus la formule de `world.js` |

## Ce qui a été changé aux tests, et pourquoi c'est voulu

- `checks/world.test.mjs` : l'assertion « exactement 3 pièges, un de chaque kind »
  devient « batterie solidaire » (≥ 2 lames + presse + pics, une seule période). La
  contrainte « même phase pour toute la coupe », d'abord écrite, a été **remplacée
  par « une phase distincte par lame »** : synchrones, les lames mureraient le
  couloir et le niveau ne serait plus finissable. C'est le test de complétion qui
  l'a démontré.
- `checks/world.test.mjs` : `world.horrorSites.length` ne vaut plus 7 en dur. L'assertion
  du lot (`pipes + pièges au-delà de 16 m du départ`) reproduisait exactement la formule
  de construction de `src/world.js` et ne pouvait plus tomber : elle est remplacée par un
  **décompte indépendant** (conduites, lames, presses, pics comptés séparément hors du
  périmètre), un contrôle que toute machine est l'une des trois sortes, et un plancher à
  24 (mesuré 34 à 46).
- `checks/world.test.mjs` : le plancher de densité passe de `>=4` machines à **`>=24`
  machines et `>=4` coupes** (mesuré 30 à 42 machines en 6 à 7 coupes). Aucune assertion
  n'est affaiblie ici : les deux sont relevées.
- `checks/campaign-world.test.mjs` : deux contrôles ajoutés au tour de contre-vérification —
  l'**empreinte du plan** (16 champs structurels) épinglée sur les 114 mondes contre la
  base du lot, et la **garnison hors de l'emprise** des machines. Le commentaire qui
  justifiait la reglée des empreintes a été réécrit : il affirmait « same supplies and
  garrison », ce que la mesure dément.
- `checks/traps-mandatory.test.mjs` : un cas de plus, « un corps dans la bande d'arrêt
  d'une lame ne la fige pas hors de son repos ». Il échouait sur l'état corrigé
  (`lame figée à -1.97 au lieu de son repos -4.35`) et passe depuis.
- `checks/campaign-world.test.mjs` : les 6 `legacyHashes` et les 108 empreintes de
  `campaign-world-digests.json` sont regelées — les mondes JSON changent, c'est le
  but du lot.
- `checks/simulation.test.mjs` : le bot attend / fuit / contourne les machines. La
  règle du test (finir le niveau en marchant) est inchangée ; seule sa stratégie
  devient physiquement honnête.
- `package.json` : `checks/passages.test.mjs` et `checks/traps-mandatory.test.mjs`
  rejoignent la liste de `npm test` (510 → 579 tests, dont 2 ajoutées au tour de
  contre-vérification).

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
- **Une machine arrêtée par un corps en fin de course** n'est exercée que par le cas
  unique du banc (un corps, une lame, un monde). Les autres combinaisons — presse
  bloquée à mi-course par un corps surélevé, deux corps dans la même bande — ne sont
  pas jouées.
- **Une cellule de réserve posée sous une machine** : 17 cas mesurés sur les 114 mondes
  de référence, atteignables mais jamais jugés à l'œil. Décision à confirmer par David.
- **Tactile et AZERTY/QWERTY** : rien dans ce lot ne touche les entrées, mais rien
  ne l'a revérifié sur matériel non plus.
- **Le rendu de secours** (Canvas 2D) sur la nouvelle machinerie : la scène 3D et sa
  copie de secours suivent la même scène, mais les lampes et barres d'alerte n'ont
  pas été regardées en mode secours.

## Ce qui n'a pas été touché

Ni la taille du monde, ni la caméra, ni les entrées, ni l'économie, ni l'audio, ni
les points de reprise. Aucun actif importé. Le principe central du projet est intact
: tout est généré par le code.

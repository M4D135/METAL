# Lot 02 / T1 — invalidation locale de la navigation, arêtes sur le statique seul

## Résultat

**Livré : SIM-01, SIM-V1 (option a) et BOSS-08, classe « meilleure ».** Sur les neuf scénarios de preuve, l'état reste identique à l'avant pendant 1 800 pas, pas à pas et au snapshot final. Une seule divergence apparaît, sur `legacy-s2` avec l'arme 2, au pas 1651. Elle est attribuée à SIM-V1 : une arête de piège devient statique. Après le changement, aucune arête périmée n'apparaît sur neuf scénarios avec le pilote du contre-vérificateur. Au repos, la grille est toujours égale à un recalcul complet.

Le CPU total de simulation baisse de 13 à 33 % sur 1 800 pas (tools/ab2). C'est le gain du prototype du plan, à 1 point près à 1 800 pas sur le banc du plan. **Le critère du ratio médian n'est pas atteint** : la cible était 0,80 au plus sur `legacy-s2`, l'abandon au-dessus de 0,90. La médiane de dix mesures vaut 0,89 pour T1 et 0,86 pour le prototype, mesuré dans les mêmes conditions. La section « Gain » montre pourquoi cet indicateur mesure surtout le bruit.

| Élément | Valeur |
| --- | --- |
| Avant | `chantier/lot-02-simulation` à `71eca61`, worktree détaché ; `src/simulation.js` sha256 `96544ee9…` |
| Après | arbre T1 ; `src/simulation.js` sha256 `985aa31c…` (seul source modifié) |
| Machine | Apple M5, 10 cœurs logiques, Node v24.18.0 (`darwin arm64`), partagée (charge 3 à 6) |
| Domaine | principal de Node pour toutes les mesures (tools/realm-loader.mjs ou bancs/sim/fast.mjs), jamais `node:vm` |

## Constats traités

| ID | Livré |
| --- | --- |
| SIM-01 | `navDiff` calcule la différence multi-ensemble des colliders entre deux révisions. Il compare les valeurs exactes des six bornes : empreinte FNV d'abord, puis égalité champ à champ. Il est isolé pour être remplacé par le delta de révision du lot 03. Une différence vide n'invalide rien. Les cellules à 0,4 m (+1e-6) et les arêtes à 1,2 m (+1e-6) d'un rectangle touché sont remises en file ou effacées. La file amortie (768 cellules par pas) est inchangée. Les chemins de tous les ennemis sont toujours remis à zéro à chaque révision, à l'ouverture et à la destruction d'une porte. |
| SIM-V1 | Option (a) : `segmentFree` passe `traps=[]` à ses trois appels de `blocked`. Cellules et arêtes suivent la même règle statique. Les lames et les presses bloquent toujours les corps dans `move()` et blessent toujours. Une porte marque sa boîte dès que son `minY` change (progression, ouverture, destruction), donc avant `progress=1`. |
| BOSS-08 | Si les marques couvrent plus d'un quart de la grille, toute la grille est remise en file et le cache d'arêtes est vidé, comme avant. |

`create` et `restore` recalculent toujours toute la grille. `snapshot()` vide toujours la file. Le snapshot ne contient rien de nouveau et son format est inchangé.

Changements de `src/simulation.js` (+60/−13 lignes) :

- l. 201-207 : ajout de `navRects`, `noTraps` et `navMark`. `updateDoorBoxes` marque chaque mouvement vertical d'une porte.
- l. 235-258 : `navDiff` s'exécute dans `syncDestruction`, avant le remplacement de `solids`.
- l. 339 : `navInvalidate()` s'exécute en fin de `updateSystems` quand seules des marques de porte attendent. La remise à zéro des chemins n'a lieu qu'aux révisions et aux lignes 323 et 935, comme avant.
- l. 539 : la grille initiale efface les marques de la création.
- l. 1372-1396 : `segmentFree` ne lit que le statique.
- l. 1408-1437 : ajout de `navEnqueue`, `navReach` et `navInvalidate`. `refreshNav` les appelle.
- l. 2266 : l'API `nav` expose aussi `edgeKnown` et `edgeOpen`, lus par les tests.

Les ancres de `tools/proof/instrument.mjs` sont intactes : signatures de `blocked` et de `segmentFree`, ligne du `pop` d'A*, deux occurrences exactes de `s.destructionRevision++;`.

## (1) État : avant contre après, `tools/ab2.mjs`

Chaque scénario compte 1 800 pas : un passage de chauffe écarté, deux passages mesurés et un rejeu instrumenté. L'identité exige trois choses :

- l'empreinte FNV identique à chaque pas ;
- le SHA-256 identique au snapshot final ;
- la stabilité entre les passages et dans le rejeu.

Résumés : [`ab2-sc9.json`](ab2-sc9.json) et [`ab2-legacy-s2-arme2.json`](ab2-legacy-s2-arme2.json). Rapport complet de la divergence : [`ab2-legacy-s2-arme2.full.json.gz`](ab2-legacy-s2-arme2.full.json.gz), avec ses chemins absolus remplacés par des étiquettes.

| Scénario | Identique | CPU avant → après (ms) | Ratio total | Médiane appariée | `blocked` | `segmentFree` |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| legacy-s0 | oui | 877 → 763 | 0,870 | 1,011 | 318 467 → 42 887 | 15 210 → 6 376 |
| legacy-s2 | oui | 1 154 → 865 | 0,750 | 0,963 | 603 871 → 30 301 | 13 452 → 4 665 |
| campaign-w10 | oui | 862 → 657 | 0,762 | 1,007 | 523 957 → 43 871 | 20 603 → 6 440 |
| campaign-w16 | oui | 730 → 541 | 0,741 | 1,000 | 587 901 → 71 952 | 30 016 → 12 986 |
| campaign2-w1 | oui | 624 → 458 | 0,734 | 1,000 | 493 665 → 64 954 | 25 013 → 10 875 |
| campaign2-w5 | oui | 1 188 → 937 | 0,789 | 0,949 | 642 716 → 7 505 | 0 → 0 |
| campaign2-w9 | oui | 698 → 535 | 0,767 | 0,993 | 451 648 → 7 209 | 0 → 0 |
| campaign2-w13 | oui | 885 → 596 | 0,673 | 0,978 | 580 005 → 66 607 | 34 331 → 11 066 |
| campaign2-w18 | oui | 889 → 636 | 0,715 | 0,910 | 469 148 → 7 233 | 0 → 0 |
| legacy-s2, arme 2 | **non, dès le pas 1651** | 2 209 → 2 103 | 0,952 | 0,992 | 247 680 → 27 515 | 3 301 → 3 309 |

Sommes de contrôle des rapports : `8d1e3a27d0e0626dd90889a91ac65277f14f09b8ba1ff52abbc0a6af40df3671` pour les neuf scénarios et `c5aa7f6fff671206faa7fd7f9fd99197fa9e3d5aa5bafa62d7ba6ab77ec76ed5` pour l'arme 2. Elles ne dépendent que des sources et se reproduisent avec les commandes en bas de page. `$SC9` n'est défini dans aucun document du chantier. Il est lu ici comme les quatre scénarios historiques plus cinq mondes V2 répartis (1, 5, 9, 13, 18).

Les autres compteurs, sur 1 800 pas : `ground` baisse de 20 à 47 %. A* fait autant d'extractions avant et après. Le nombre de nœuds visités change de 0,3 % au plus dans quatre scénarios (`legacy-s2` 19 016 → 18 960 ; `campaign-w16` 60 783 → 60 811 ; `campaign2-w1` et `campaign2-w13` +7), avec des routes identiques puisque l'état l'est. Seules deux lectures d'A* diffèrent entre l'avant et l'après : les arêtes de piège, devenues statiques, et la grille, à jour plus tôt.

Les pointes de replanification à cache froid se raréfient. Dans les scénarios où des routes sont cherchées, l'avant comptait trois à cinq pas à plus de 4 000 `segmentFree`, autant que de vidages globaux du cache. Après, il en reste un ou deux, sur des zones où le cache était encore vide. Exemple, `legacy-s2`, cinq pires pas : `[4422, 4422, 4422, 37, 37]` → `[4405, 37, 37, 37, 37]`. Ces valeurs figurent dans le champ `peaks` des résumés.

**Divergence `legacy-s2` arme 2, pas 1651.** [`attribution.mjs`](attribution.mjs) fait avancer trois variantes en lockstep, avec le pilote et l'arme de tools/ab2 : A (avant), B (après) et C (avant + SIM-V1 seul, sans l'invalidation locale). Sortie : [`attribution-legacy-s2-arme2.json`](attribution-legacy-s2-arme2.json).

- A/B et A/C divergent au même pas, 1651. B et C restent identiques pendant 1 800 pas, pour l'état comme pour chaque appel de `route`.
- La première route différente est celle de l'ennemi 0 au pas 1651. Les deux chemins A* bruts ont 71 nœuds, soit le même coût, et huit points de passage une fois tirés, mais ils ne passent pas par les mêmes cases.
- Juste avant ce pas, le cache de A contient sept arêtes autour de la lame en (−6 ; 43). Elles sont en cache fermées, alors qu'elles sont ouvertes sur le statique : la lame, seule entrée mobile de `segmentFree`, passait quand elles ont été testées. La dernière révision de destruction date du pas 658.

Cause : arête de piège devenue statique (SIM-V1). Sur ce passage, l'invalidation locale de SIM-01 n'ajoute aucune divergence.

## (2) Arêtes et cellules : [`stale-static.mjs`](stale-static.mjs)

Ce script est une copie adaptée de `bancs/sim-verif2/stale.mjs`. A (avant) et B (après) avancent en lockstep pendant 1 800 pas. Le pilote est celui du contre-vérificateur : armes 2, 0, 3 et 1, PV remis à 100 sous 40. Tous les 30 pas, chaque arête en cache est rejugée deux fois : avec le prédicat propre de la variante (pièges compris pour A), puis avec le prédicat statique. Quand la file est vide, la grille est comparée à un recalcul complet. Sorties : [`stale-static.txt`](stale-static.txt) et [`stale-static.json`](stale-static.json).

| Scénario | État A/B | Grilles différentes : pas (max cellules) | Avant, arêtes périmées, prédicat propre (moy./max) | Avant, prédicat statique | **Après, les deux prédicats** | Grille au repos ≠ recalcul (avant ; après) | Cellules évaluées (avant → après) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | identique | 139 (24) | 0 / 0 | 0 / 0 | **0 / 0** | 0 sur 47 ; 0 sur 60 | 441 560 → 247 |
| c9 | identique | 9 (4) | 0,63 / 19 | 0 / 0 | **0 / 0** | 0 sur 48 ; 0 sur 60 | 378 720 → 6 |
| 0 | identique | 9 (4) | 0 / 0 | 0 / 0 | **0 / 0** | 0 sur 54 ; 0 sur 60 | 191 714 → 6 |
| c15 | identique | 9 (4) | 1,27 / 19 | 0,17 / 5 | **0 / 0** | 0 sur 52 ; 0 sur 60 | 244 800 → 6 |
| v1 | identique | 9 (4) | 0,63 / 19 | 0,33 / 10 | **0 / 0** | 0 sur 51 ; 0 sur 60 | 270 300 → 6 |
| v5 | identique | 0 | aucune arête | aucune arête | **0 / 0** | 0 sur 47 ; 0 sur 60 | 456 930 → 280 |
| v9 | identique | 39 (6) | 0 / 0 | 0 / 0 | **0 / 0** | 0 sur 47 ; 0 sur 60 | 486 084 → 9 |
| v13 | identique | 9 (4) | 0,83 / 10 | 1,33 / 10 | **0 / 0** | 0 sur 51 ; 0 sur 60 | 282 838 → 8 |
| v18 | identique | 39 (6) | aucune arête | aucune arête | **0 / 0** | 0 sur 49 ; 0 sur 60 | 399 740 → 9 |

Les libellés se lisent ainsi : `2` est le monde classique 2, `c9` le monde d'indice 9 de la campagne V1, `v5` le monde 5 de la campagne V2. Tous les mondes portent une lame, une presse et des pointes.

Les grilles diffèrent seulement pendant que la file de l'avant rattrape les changements : la grille d'après est à jour plus tôt. Plus d'arêtes restent connues après (2 366 contre 1 104 en moyenne sur `2`), car le cache n'est plus vidé en entier. La mémoire est la même, deux `Uint8Array`.

## (3) à (5) Tests de `checks/simulation.test.mjs`

**Test réécrit (l. 1862-1871 de l'avant).** L'ancien test, *A breach changes collision immediately while a large navigation grid is refreshed in bounded batches*, exigeait `navPending > 0` après une brèche locale dans une grille de 200 m. Cette brèche tient désormais en un pas, ce qui est le but de SIM-01. Le nouveau test s'appelle *A breach changes collision immediately; the walking map follows it locally in bounded batches, and a change beyond a quarter of the grid stays amortised*. Il vérifie :

- au plus 768 cellules par pas, sans file en attente ;
- entre 1 et 199 cellules évaluées ;
- la cellule de la brèche libre aussitôt et le passage physique immédiat ;
- une copie restaurée égale à la grille vivante.

L'amortissement reste testé avec un mur qui barre un niveau de 806 cellules, donc au-delà du quart :

- `navPending > 0` ;
- au plus 768 cellules par pas ;
- le point de reprise matérialise la file ;
- la copie restaurée est égale.

**Trois tests neufs :**

- *After several breaches and a door opening, the walking map and every cached edge at rest equal a full rebuild* : deux brèches de roquette, puis une porte motorisée. La file ne se remplit jamais au-delà du local. Au repos, aucune cellule de la grille et aucune arête connue du cache n'est fausse. La copie restaurée est égale.
- *A door opened by progression updates the walking map beside it as soon as it clears a body, matching a full rebuild at every step* : c'est l'ouverture de la ligne 300 de l'avant, devenue la ligne 323. Aucune cellule ni arête n'est fausse, à aucun pas. Le passage entre dans la carte avant `progress=1`, vers 0,55, quand `minY` franchit le sol + 1,8. L'avant gardait quatre cellules fausses de 0,55 à 1.
- *Route tests and cached edges read the static map only; a moving blade still blocks bodies (SIM-V1)*.

Ces quatre tests échouent sur le code d'avant. Cela a été vérifié avec une copie temporaire du fichier de test dans le worktree d'avant, retirée ensuite.

## (6) Gain

**Banc du plan** (`bancs/sim/ab2.mjs`, `performance.now`, B = A + correctif). Le prototype (`nav-local.mjs navLocalPatch`) et T1 (`tree-patch.mjs treeSimulation`) sont mesurés contre le même avant, en exécutions alternées. Médianes des exécutions ; sortie : [`bench-alternated.json`](bench-alternated.json).

| Scénario | 1 800 pas × 3 : CPU total T1 (prototype) | 300 pas × 6 : CPU total T1 (prototype) | 300 pas : ratio médian par pas T1 (prototype) |
| --- | ---: | ---: | ---: |
| legacy-s0 | −22 % (−22 %) | −22,5 % (−21,5 %) | 0,94 (0,98) |
| legacy-s2 | −27 % (−27 %) | −28 % (−35 %) | 0,895 (0,83) |
| campaign-w10 | −35 % (−34 %) | −24,5 % (−27 %) | 0,94 (0,865) |
| campaign-w16 | −35 % (−34 %) | −22,5 % (−16,5 %) | 0,965 (0,95) |

**Lockstep à trois** ([`three-way.mjs`](three-way.mjs)). A, le prototype P et T1 avancent dans le même processus, dans un ordre tournant parmi les six permutations. Sorties : [`three-way-300.json`](three-way-300.json), [`three-way-1800.json`](three-way-1800.json) et [`three-way-controls.json`](three-way-controls.json).

- 1 800 pas × 3, ratio du CPU total T/A : 0,763, 0,720, 0,671 et 0,651 sur les quatre scénarios historiques, contre 0,766, 0,729, 0,677 et 0,690 pour P/A. T/P vaut 0,94 à 1,00.
- 300 pas × 8, contrôles A/A : deux copies d'une même source s'écartent jusqu'à 1,176 en CPU total (T2/T sur `campaign-w16`). Changer l'ordre de chargement inverse le signe de T/P. À 300 pas, T et P ne se distinguent donc pas. Hors événements de navigation, leurs codes ne diffèrent que par une comparaison par porte et un test de longueur à chaque pas.

**Ce que mesure le ratio médian par pas.** Les décomptes viennent de [`pump-steps.mjs`](pump-steps.mjs) ; sortie : [`pump-steps.txt`](pump-steps.txt). Sur les 300 premiers pas de `legacy-s2`, l'avant pompe sa file à 134 pas, soit 45 %, et l'après à aucun. Les mêmes chiffres valent 690 pas sur 1 800 avant et 2 après. La médiane par pas tombe donc parmi les pas inchangés : elle mesure la queue basse de leur bruit, pas le travail économisé.

Dix mesures de ce ratio ont été faites pour T1, avec le banc et le lockstep. Elles vont de 0,784 à 0,95, avec une médiane de 0,89. Le prototype, mesuré de même, va de 0,80 à 0,968, avec une médiane de 0,857. Le 0,79 du plan ne se reproduit pas ici, même pour le prototype. Il a été mesuré dans d'autres conditions : son pic de 15,1 ms se compare au pic de l'avant ici, 1,4 à 5,4 ms sur les mêmes 300 pas de `legacy-s2`.

Le gain annoncé en CPU total se reproduit entièrement sur `legacy-s2` : −24 % annoncé, −20 à −34 % mesuré à 300 pas et −25 à −29 % à 1 800 pas. Il est donc reproduit à plus de la moitié, et la tâche n'est pas abandonnée.

Le travail économisé sur 1 800 pas est le suivant :

- cellules évaluées par la file : 231 650 à 529 870 avant, contre 6 à 19 après, sur les quatre scénarios du banc (`pump-steps.txt`) ;
- `blocked` : −86 à −99 %, sur les neuf scénarios de tools/ab2 ;
- `segmentFree` : −57 à −69 % là où des routes sont cherchées, sur les mêmes neuf scénarios.

## Risque de SIM-V1 (a) : un ennemi face à une lame

Le risque est noté dans `constats/SIM.md`. [`blade-crossing.mjs`](blade-crossing.mjs) le teste sur un mur percé d'une ouverture de 2,2 m, qu'une lame balaie. L'ennemi part au sud. Le joueur se tient au nord, hors de portée d'attaque. Seize réglages de lame ont été essayés, 30 s au plus chacun. L'ennemi de type 0 de ce décor a 3 PV, et un coup de lame le tue. Sorties : [`blade-crossing.txt`](blade-crossing.txt) et [`blade-crossing.json`](blade-crossing.json).

| | Traversées | Tués par la lame | Immobiles (tactique `hold`, aucune route) | Blocage max (`stuck`) |
| --- | ---: | ---: | ---: | ---: |
| Avant | 2 | 7 | 7 | 0,63 s |
| Après | 8 | 8 | 0 | 1,15 s |

Avant, une arête testée pendant le passage de la lame restait fermée jusqu'à la prochaine révision de destruction : l'ennemi ne bougeait plus du tout. Après, il planifie à travers le balayage. Il passe, ou il meurt dans la lame. Il ne reste jamais bloqué : le plus long blocage dure 1,15 s, avec une replanification au seuil de 1,1 s. Les tests `brain`, `natural-spawn` et `campaign-simulation` passent.

## (7) Tests, build et taille

- `npm test` : 473 tests, 465 réussis et 8 échecs. Ce sont les 8 échecs admis de `checks/campaign-world.test.mjs` : six *legacy seed 1 / 96, sector 0 à 2: exact pre-campaign world fingerprint*, puis *campaign mode is strictly opt-in…* et *the first three campaign worlds preserve historical geometry…*. La base était 462/470, plus les trois tests neufs. `world.test.mjs` passe. Journal : [`npm-test.log.gz`](npm-test.log.gz).
- Les 14 fichiers de `bancs/sim/run-checks.sh`, exécutés sur l'arbre : 321/321. La base était 317/318 avec le prototype, et le seul échec était le test réécrit. Journal : [`checks-simulation-subset.log.gz`](checks-simulation-subset.log.gz).
- `python3 tools/build.py` et `node checks/build.test.mjs` passent, sans ressource externe.
- `dist/index.html` passe de 812 696 à 816 177 octets (+3 481) et de 245 325 à 246 600 octets en gzip (+1 275). `simulation.js` passe de 202 378 à 205 859 octets. Le plan estimait le surcoût à 1,9 Ko environ. L'écart vient du repli au quart, du marquage des portes, de SIM-V1 et de commentaires.

## À confirmer par David

1. Le comportement près des pièges change (SIM-V1 a). Les ennemis ne restent plus figés derrière une arête fermée par une lame. En contrepartie, ils planifient à travers les balayages et peuvent y mourir. La décision de ruée (`rush`, l. 1289) passe aussi par `segmentFree` : elle ignore désormais la pose des pièges. L'option (b) du constat garderait la sémantique dynamique : marquer le balayage d'un piège quand `hot` change.
2. Le critère « ratio médian ≤ 0,80 » n'est pas atteint (médiane 0,89, prototype 0,857), et il est structurellement fragile. Le CPU total reproduit le gain annoncé. Il faut accepter la tâche sur cette base, ou fixer un autre critère.
3. Une porte en mouvement est marquée à chaque pas où sa boîte bouge, et pas seulement au franchissement de sol + 1,8. C'est un sur-ensemble exact quelle que soit la hauteur du sol, sans remise à zéro des chemins par ces marques.
4. Le test des lignes 1862-1871 a été réécrit, pour la raison donnée plus haut.
5. `nav.edgeKnown` et `nav.edgeOpen` sont exposés dans l'API de simulation pour les tests.

## Limites et notes pour la suite

- Un piège de sol (`kind:'floor'`) agit encore via `ground()`. Le cas reste dynamique et non invalidé. Avant, chaque vidage global le corrigeait par hasard. Aucun monde généré n'en contient.
- Deux comportements préexistants restent en l'état. `restore` refuse un ennemi qui touche la boîte d'une lame. `snapshot()` ignore un `navDirty` posé après `updateSystems` dans le même pas, par une révision tardive. T1 ne change que la durée de l'écart de grille qui en résulte entre l'original et une copie restaurée : un pas au lieu de la durée de la file.
- `tools/ab2.mjs` échoue en fin d'exécution sur cette machine : *host global keys changed*, à cause des `Symbol(undici.globalDispatcher.*)` créés paresseusement. Toutes les commandes `tools/*` passent donc par `--import` d'un préchargement d'une ligne, `Object.getOwnPropertyDescriptors(globalThis);`, non versionné. La correction commune revient à l'orchestrateur (lot 02, T0).
- Le lot 03 remplace `navDiff` par le delta de révision de la destruction.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `stale-static.mjs`, `.txt`, `.json` | arêtes périmées et grille au repos, neuf scénarios |
| `attribution.mjs`, `attribution-legacy-s2-arme2.*` | attribution de la divergence (A, B, C) |
| `summarize-ab2.mjs`, `ab2-sc9.json`, `ab2-legacy-s2-arme2.json` | résumés des rapports tools/ab2 |
| `ab2-legacy-s2-arme2.full.json.gz` | rapport complet de la divergence (239 Ko) |
| `tree-patch.mjs`, `bench-alternated.json` | variante T1 du banc du plan, mesures alternées |
| `three-way.mjs`, `three-way.txt`, `three-way-*.json` | lockstep avant, prototype et T1, contrôles A/A |
| `pump-steps.mjs`, `pump-steps.txt` | pas où la file travaille, cellules évaluées |
| `blade-crossing.mjs`, `.txt`, `.json` | risque SIM-V1 (a) |
| `npm-test.log.gz`, `checks-simulation-subset.log.gz` | journaux de tests, chemins remplacés par `<arbre>` et `<avant>` |

## Commandes

`<avant>` est un worktree détaché de `71eca61`. `<pre>` est le préchargement d'une ligne décrit plus haut. Ces commandes sont lancées depuis la racine de l'arbre.

```sh
node --import <pre> tools/ab2.mjs <avant> . --scenario legacy-s0,legacy-s2,campaign-w10,campaign-w16,campaign2-w1,campaign2-w5,campaign2-w9,campaign2-w13,campaign2-w18 --out sc9.json
node --import <pre> tools/ab2.mjs <avant> . --scenario legacy-s2 --weapon 2 --out s2w2.json
node docs/chantier-moteur/preuves/lot-02/t1/summarize-ab2.mjs sc9.json ab2-sc9.json "avant 71eca61" "après T1"
JSON_OUT=attribution.json node docs/chantier-moteur/preuves/lot-02/t1/attribution.mjs <avant> .
SCEN=2,c9,0,c15,v1,v5,v9,v13,v18 JSON_OUT=stale.json node docs/chantier-moteur/preuves/lot-02/t1/stale-static.mjs <avant> .
node docs/chantier-moteur/preuves/lot-02/t1/blade-crossing.mjs <avant> . blade.json
(cd docs/chantier-moteur/bancs/sim && METAL_ROOT=<avant> REPS=2 STEPS=300 node ab2.mjs ../../preuves/lot-02/t1/tree-patch.mjs treeSimulation)
(cd docs/chantier-moteur/bancs/sim && METAL_ROOT=<avant> REPS=2 STEPS=300 node ab2.mjs nav-local.mjs navLocalPatch)
(cd docs/chantier-moteur/preuves/lot-02/t1 && METAL_ROOT=<avant> STEPS=300 REPS=9 node three-way.mjs out.json)
python3 tools/build.py && npm test; node checks/build.test.mjs
```

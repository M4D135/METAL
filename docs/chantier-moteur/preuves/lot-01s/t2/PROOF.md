# Lot 01 suite / T2 — FMath dans la génération du monde (MURS-V1)

Constats : MURS-V1 (`constats/MURS.md`, l. 690), MURS-06 (l. 359 : rien n'est
écrit dans l'objet monde), LOAD-06 (`constats/LOAD.md`, l. 325 : même zone de
`world.js`, lot 02 T5) et IA-12 (`constats/IA.md`, l. 567 : risque de rejeu,
lot 13). Base : `5e86238` (T1), au-dessus de `71eca61`. La base des mesures,
`$BASE`, est `git archive 71eca61` : son `world.js` appelle encore le `Math` de
la machine.

**Classe de preuve : état identique par rapport à la référence x86-64** (les
empreintes dorées de `checks/campaign-world.test.mjs`, les rejeux Linux du
lot 00). Sur le Mac et sous Linux arm64, les mondes changent pour devenir ceux
de x86-64 : au plus 7,1e-15 sur les positions et 2,32e-14 rad sur les
rotations, sans aucun changement de structure (§ 3).

## Le changement

- `src/world.js` : les 87 appels directs du source (36 `Math.sin`,
  37 `Math.cos`, 13 `Math.atan2` et 1 `Math.atan`, sur 39 lignes) passent à
  `FMath`, lu une fois en tête (`const FMath = window.FMath;`). Sans
  `src/fmath.js`, le chargement s'arrête sur « FWorld: charger src/fmath.js
  avant src/world.js ». Restent `Math.hypot` (61 appels dans le source,
  tâche T3), les fonctions exactes et
  `Math[k.startsWith('min')?'min':'max']` (l. 1350). `generation:6` ne change
  pas. Aucun autre fichier de `src/` ne change : ni l'empreinte
  (`src/simulation.js`, l. 236-241), ni le contrôle de `restore`.
- `tools/build.py` assemble `fmath.js` en premier. `dist/index.html` passe de
  812 696 à 830 459 octets (gzip : 245 325 à 252 733 ; SHA-256 `bbb640e9…`),
  pour un budget de 1 400 000. `python3 tools/build.py`, rejoué dans une copie,
  redonne `dist/index.html` et `SIZE.json` à l'identique.
- Chargeurs (fmath avant world) : seules les lignes de chargement changent dans
  `checks/world`, `campaign-world`, `destruction`, `checkpoint` (l. 9 et 585),
  `natural-spawn`, `simulation` et `cadence`. Aucune assertion ni
  `legacyHashes` ne change. `tools/realm-loader.mjs` reçoit
  `defaultModules(root)` : fmath en tête si la racine a `src/fmath.js`.
  `tools/campaign-profiles.mjs` et `tools/boss-profiles.mjs` font de même.
- Tests ajoutés : un test dans `checks/fmath.test.mjs` (garde statique de
  `world.js`, refus de charger sans FMath, monde complet généré avec sin, cos,
  atan et atan2 de l'hôte empoisonnés) ; `checks/build.test.mjs` vérifie que
  `FMath` est défini avant que `world.js` le lise.
- Outils : `tools/platform-math.mjs` (`--base`, `worlds`, `checkpoints --from`,
  `sim-risk`), `tools/gen-ab.mjs` et `tools/proof/fmath-global.mjs` ;
  [shell-checkpoints.mjs](shell-checkpoints.mjs) et
  [loader-check.mjs](loader-check.mjs) dans ce dossier.

Machines :

- **Mac** : Apple M5, macOS 27.2.1 (Darwin 27.2.0), Node 24.18.0
  (V8 13.6.233.17-node.50) darwin-arm64, Chrome 157.0.8103.39, `jsc` du système.
- **Spark** : NVIDIA GB10, Linux 6.17.0-1026-nvidia arm64, Node 24.18.0 (même
  V8), Chrome 151.0.7922.137, pas de `jsc`.

Aucune machine x86-64 n'est joignable : les oracles x86-64 sont ceux du dépôt,
jamais régénérés.

## 1. npm test : 481 sur 481, sur les deux machines

| | tests | réussis | échecs | `checks/build.test.mjs` |
|---|---|---|---|---|
| Mac, avant (`5e86238`, `t1/mac/npm-test.log.gz`) | 480 | 472 | 8 | non atteint |
| Spark, avant (`5e86238`, remesuré le 13/11) | 480 | 472 | 8 | non atteint |
| Mac, après | **481** | **481** | **0** | PASS |
| Spark, après | **481** | **481** | **0** | PASS |

481 = 470 + 11 tests FMath (D4 : les 10 de T1 et la garde de T2). Les 8 échecs
d'avant sont les 8 historiques ; ils passent. `checks/world.test.mjs`, lancé à
part, passe (18 cas). `checks/build.test.mjs` s'exécute et passe : 830 459
octets, `bbb640e9…`. Durée TAP : 159 s au Mac, 133 s au Spark. Journaux :
`mac/npm-test.log.gz`, `spark/npm-test.log.gz` et
`spark/npm-test-avant-5e86238.log.gz`.

## 2. Les 8 tests historiques et les 114 mondes

`golden` rejoue les 8 tests (`golden.json`) : **0/8** avec le `world.js` de
`$BASE` et le `Math` de la machine, **8/8** avec la branche, au Mac comme au
Spark. Les empreintes, les sous-ensembles et les 108 mondes de campagne sont
identiques aux sorties de T1, où FMath était injecté dans l'ancien `world.js`.

`worlds` (`worlds.json`) donne le SHA-256 du JSON des 114 mondes (classiques
des graines 1 et 96, campagnes V1 et V2 des graines 1, 96 et 2026) :

- 114/114 égaux au `world.js` de `$BASE` avec FMath injecté : le branchement ne
  change que la trigonométrie ;
- 114/114 égaux entre le Mac et le Spark (empreinte des empreintes
  `a207bc03…`) ;
- les 6 mondes classiques égalent les `legacyHashes` du test, et les 108 mondes
  de campagne égalent les mondes FMath de T1 sur les deux machines.

## 3. Points de reprise pris avant le correctif

**Identité des mondes** (`checkpoints . --base`, `checkpoints.json`, identique
à T1). L'empreinte de reprise (`snapshot().fingerprint`) change exactement là
où `destructibles` change :

| | classiques | V1 | V2 |
|---|---|---|---|
| Mac | 3/6 (1/2, 96/0, 96/2) | 8/18 | 8/18 |
| Spark | 3/6 (les mêmes) | 7/18 | 7/18 |

En V1 et en V2, il s'agit des mondes 1, 3, 5, 6, 8, 9, 10 et 15 de la graine 96
au Mac, et des mêmes sauf le monde 10 au Spark. `meshes` change dans les
42 mondes, `destructibles` dans 19 (Mac) et 17 (Spark). Un monde changé compte
de 1 à 72 nombres différents (74 au Spark), pour un écart maximal de 2,32e-14.
Aucune différence de structure.

**Lecture croisée** (`checkpoints . --from $BASE`,
`checkpoints-from-base.json`). Chaque point est écrit par le monde et la
simulation de `$BASE` après 30 pas, puis relu par la branche comme le fait le
shell (`restore(point,{recover:true})`, puis sans les gravats) :

| | restaurés | refusés | refusés aussi sans gravats |
|---|---|---|---|
| Mac | 23 | 19 | 19 |
| Spark | 25 | 17 (pas le monde 10) | 17 |

Les refus tombent exactement là où l'empreinte diffère
(`refusedExactlyWhereFingerprintDiffers: true`).

**Shell réel** ([shell-checkpoints.mjs](shell-checkpoints.mjs),
`shell-checkpoints.json`). Le harnais du navigateur de
`checks/checkpoint.test.mjs` est lu tel quel, puis `src/game.js` reprend une
enveloppe écrite comme `saveCheckpoint()` après 60 pas de `$BASE`. Le shell de
`$BASE` reprend les 6 enveloppes (témoin). Avec la branche, résultats
identiques au Mac et au Spark :

| Cas | `restore` | Message | Suite |
|---|---|---|---|
| classique 96/0, V1 et V2 monde 1 (96) | refusé, puis refusé sans gravats | « Point de reprise illisible. Reprise à l'entrée de ce secteur. » | original gardé dans `ferro-expedition-v2-refuse` ; même graine, même secteur ; chargement d'entrée et statistiques gardés ; nouveau point à 0 relais |
| classique 1/0, V1 et V2 monde 2 (96) | accepté | « Signal retrouvé. Reprise au dernier point enregistré. » | aucun emplacement de refus |

Aucune exception, aucune erreur de console. Une reprise refusée revient à
l'entrée du secteur avec le chargement d'entrée : ce qui a été ramassé dans le
secteur est perdu (D2).

**Chrome.** L'empreinte d'un monde généré par Chrome avant le correctif diffère
de celle du monde corrigé dans **42 mondes sur 42**, sous macOS comme sous
Linux (`engines.json`, `nativeChromePointRefusedAfterFix`) : `restore` refusera
ces points, puis le repli s'appliquera. Ce chiffre compare des empreintes ; la
reprise n'a pas été jouée dans Chrome.

## 4. Navigateurs et autres moteurs

`engines . --base` (`engines.json`) ouvre des pages `file://` dans Chrome sans
tête (`--dump-dom`, profil privé, aucun port) :

- FMath passe ses 3 836 vecteurs dans Chrome 157 (Mac) et 151 (Linux).
- La page qui charge `fmath.js` puis le `world.js` de la branche donne
  **42/42** empreintes de reprise et 42/42 FNV du JSON égales à Node, sur les
  deux machines. Chrome sous macOS et Chrome sous Linux donnent les mêmes
  42 mondes.
- Avant le correctif, les mondes natifs de Chrome n'égalaient ceux de Node
  natif dans aucun des 42 cas ; le sin de Chrome est correctement arrondi sur
  les 1 800 entrées du pilote (comme en T1).
- `jsc` (Mac) : FMath passe ses 3 836 vecteurs. Les mondes égalent ceux de
  Node dans 0 cas sur 10, et dans 10 sur 10 avec en plus un portage de l'hypot
  de V8 (T3, D3).
- Ne sont pas mesurés : Firefox (absent), Safari en vrai, Chrome sous Windows ou
  x86-64, les téléphones.

## 5. Rejeux de preuve (oracles x86-64)

| | Mac | Spark |
|---|---|---|
| `replay --fmath`, 4 scénarios de 1 800 pas | **4/4 identiques**, `09a3eca4…` | **4/4**, `09a3eca4…` |
| `replay --fmath`, V2 courts (120 pas) | `2d73cf2a`, `65883f09` = oracle | idem |
| `fmath-global.mjs` en précharge, `profile-steps`, `reference-check` | `stateIdentical: true` | `stateIdentical: true` |
| Math de la machine, 4 scénarios | divergence au 44e pas | au 38e pas |
| Math de la machine, V2 courts | 84e et 44e pas | 78e et 38e pas |

Les chaînes FMath sont celles de la référence (`4c43a6fb`, `c8706f53`,
`59e36477`, `b4e5f58e`), comme en T1. Sans FMath dans la simulation, les rejeux
divergent aux mêmes pas qu'en T1, bien que leurs mondes soient désormais ceux
de x86-64 : la simulation diverge elle-même (§ 6).

## 6. Risque pour le lot 13 (`sim-risk`)

Génération et pilote de preuve en FMath, simulation, destruction et cerveau
avec le `Math` de la machine (`sim-risk.json`) ; 7 200 pas (4 × 1 800) :

| | Mac | Spark |
|---|---|---|
| Premier pas divergent, 4 scénarios | 44e (4/4) | 38e (4/4) |
| Avec FMath dans tous les modules (`--sim-fmath`) | 4/4 identiques | 4/4 identiques |
| sin par pas, part divergente | 100,2 ; 0,43 % | 100,2 ; 0,41 % |
| cos par pas | 101,0 ; 0,075 % | 101,0 ; 0,075 % |
| atan2 par pas | 62,7 ; 0,14 % | 62,7 ; 0,12 % |

Le premier écart d'un rejeu natif vient donc de la simulation elle-même, au même
pas que le rejeu natif complet. Presque tous les appels viennent de
`simulation.js` ; `destruction.js` appelle 1 551 sin et 1 551 cos. Comptés sans
référence portable : `exp` (136 717 appels, 19 par pas), `log` (40) et `pow`
(1 762, destruction), ainsi que `**` dans le source (renderer 18, economy 1,
simulation 4). Avec FMath partout, les quatre rejeux égalent x86-64 : sur ces
scénarios, ces fonctions ne font apparaître aucun écart dans l'état. Le pilote
(`Math.sin(i/90)`) s'écarte de FMath dès l'indice 42 sur les deux machines. Le
cerveau WebNN (IA-12) n'est pas couvert : il tourne ici en mode cpu. Aucun
changement de simulation dans ce lot (D6).

## 7. Coût de la génération

`tools/gen-ab.mjs` mesure `FWorld.create` dans le domaine principal (précharge
undici, D5) : 3 passes de chauffe, temps CPU du fil principal, médianes. Chaque
fichier contient son propre contrôle A/A (un second chargement de A) et tourne
les six ordres possibles. Le rapport retenu est la moyenne géométrique des deux
orientations : √((B/A en base→branche) / (B/A en branche→base)). Les rapports
bruts restent dans les fichiers, défavorables compris.

| Monde | CPU de la base, Mac | Mac, essai 1 (15 rép.) | essai 2 (21) | essai 3 (21) | CPU de la base, Spark | Spark (15) |
|---|---|---|---|---|---|---|
| l:0 | 37,8 ms | 1,012 | 1,016 | 0,996 | 52,8 ms | 1,018 |
| l:2 | 44,9 ms | 1,008 | | | 64,0 ms | 1,018 |
| v1:9 | 36,0 ms | 1,014 | | | 50,5 ms | 1,022 |
| c:0 | 41,4 ms | 1,037 | | | 58,9 ms | 1,015 |
| c:9 | 42,7 ms | 1,021 | 1,014 | 1,024 | 56,6 ms | 1,020 |
| c:17 | 52,2 ms | 1,029 | 1,010 | 1,015 | 73,7 ms | 1,028 |

- Contrôle A/A : médianes A'/A de 0,966 à 1,032 au Mac et de 0,973 à 1,011
  au Spark, dans toutes les passes. Les deux orientations diffèrent de 0 à
  7 points, l'écart le plus grand étant sur l:0.
- Rapports bruts les plus défavorables : 1,033 (c:17, Mac, base→branche) et
  1/0,956 = 1,046 (l:0 et c:0 au Mac, l:0 au Spark, branche→base).

**Surcoût de FMath : +1 à +3 %** de `FWorld.create` (au plus +3,7 %), soit au
plus 2,1 ms par monde. C'est l'ordre du bruit A/A, mais le signe est le même
dans 17 mesures sur 18. Le surcoût n'est pas une option : la génération doit rester
déterministe. Accélérer FMath obligerait à refaire la preuve exhaustive de T1 ;
ce n'est pas fait ici.

## 8. Chargeur et profils publiés

- [loader-check.mjs](loader-check.mjs) (`mac/loader-check.json`) : la branche
  charge `fmath` en tête, `$BASE` garde sa liste historique, une copie sans
  `src/fmath.js` est refusée par son nom, une copie sans `src/brain.js` échoue
  toujours à la lecture de `brain.js`, et `world.js` seul s'arrête sur son
  message.
- `t1/profiles-check.mjs` (`profiles.json`) : `campaign-balance` et
  `boss-profiles` sont identiques octet pour octet aux archives x86-64 du
  lot 00. `campaign-profiles` ne diffère que par ses relevés de sources
  (`sources.fmath`, `sourceSha256.fmath`, `.world` et `.simulation`). Les trois
  sorties sont identiques entre le Mac et le Spark. Sur `$BASE`, les deux outils
  modifiés tournent toujours.

## Chemins des machines

Après la mesure, les préfixes absolus propres aux machines ont été réécrits :
dossier personnel du Mac et du Spark en `~`, dossier de travail du Mac en `$W`.
Ils apparaissent dans les chemins des sorties JSON (racines, base, dossiers de
travail, profil relu) et dans les piles d'appel du journal `npm-test-avant`.
Aucun autre octet n'a changé ([manifest.json](manifest.json)).

## Reproduire

Depuis la racine du dépôt. `O` vaut `$P/mac` ou `$P/spark`, `W` est un dossier
de travail, `CHROME` est le binaire de Chrome et `M` vaut `mac` ou `spark`.
Les commandes de T1 qui veulent la variante native de la machine
(`golden`, `census --path host`, `checkpoints`, `pages`, `engines`) demandent
désormais `--base $BASE` sur la branche.

```sh
P=docs/chantier-moteur/preuves/lot-01s/t2 BASE=$W/base71 U='--import=data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'
mkdir -p $BASE && git archive 71eca61 | tar -x -C $BASE
npm test > $W/npm-test.log 2>&1
node tools/platform-math.mjs worlds . --base $BASE --out $O/worlds.json
node tools/platform-math.mjs golden . --base $BASE --out $O/golden.json
node tools/platform-math.mjs checkpoints . --base $BASE --out $O/checkpoints.json
node tools/platform-math.mjs checkpoints . --from $BASE --out $O/checkpoints-from-base.json
node $P/shell-checkpoints.mjs --base $BASE --out $O/shell-checkpoints.json
node tools/platform-math.mjs sim-risk . --out $O/sim-risk.json
node tools/platform-math.mjs sim-risk . --sim-fmath --out $O/sim-risk-fmath.json
node tools/platform-math.mjs replay . --fmath --out $O/replay-fmath.json
node tools/platform-math.mjs replay . --out $O/replay-native.json
node tools/platform-math.mjs replay . --fmath --scenario campaign2-w1,campaign2-w10 --steps 120 --out $O/replay-v2-fmath.json
node tools/platform-math.mjs replay . --scenario campaign2-w1,campaign2-w10 --steps 120 --out $O/replay-v2-native.json
node $U --import=./tools/proof/fmath-global.mjs tools/profile-steps.mjs . --reps 1 --warmups 1 --no-counters --out $W/p.json
node tools/proof/reference-check.mjs $W/p.json > $O/reference-check-fmath-global.json
node tools/platform-math.mjs engines . --base $BASE --dir $W/eng --census docs/chantier-moteur/preuves/lot-01s/t1/$M/census.json --chrome "$CHROME" --out $O/engines.json
node $U tools/gen-ab.mjs $BASE $BASE --reps 15 --warm 3 --out $O/gen-ab-aa.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs $BASE . --reps 15 --warm 3 --out $O/gen-ab-base-branch-1.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs . $BASE --reps 15 --warm 3 --out $O/gen-ab-branch-base-1.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs $BASE . --reps 21 --warm 3 --out $O/gen-ab-base-branch-2.json l:0 c:9 c:17   # Mac, essais 2 et 3
node $U tools/gen-ab.mjs . $BASE --reps 21 --warm 3 --out $O/gen-ab-branch-base-2.json l:0 c:9 c:17
node docs/chantier-moteur/preuves/lot-01s/t1/profiles-check.mjs --work $W/prof --out $O/profiles.json
node $P/loader-check.mjs --base $BASE --work $W/loader --out $P/mac/loader-check.json
```

Sur le Spark, le dépôt et `$BASE` sont copiés par `rsync` sous
`~/metal-tests/`, où pointe aussi `TMPDIR`. Un seul Chrome tourne à la fois,
sans aucun port.

## Limites et suites

- Aucune mesure nouvelle sous x86-64 : les oracles sont ceux du dépôt (lot 00
  et préflight du lot 01).
- Safari reste différent tant que `Math.hypot` n'est pas porté (T3).
- La simulation garde le `Math` de la machine : un rejeu n'est fiable que sur le
  même moteur et la même plateforme (Mac : 44e pas ; Spark : 38e pas), jusqu'au
  lot 13 (D6). `exp`, `log`, `pow` et `**` y restent non vérifiés.
- Intégration : le lot 02 T5 (LOAD-06) réécrit la zone de `world.js` qui va
  désormais des l. 1346 à 1395 : il doit garder `FMath` (le cos et le sin de
  l'ancienne l. 1342 sont à la l. 1348) et attendre 0 échec. Le lot 07 doit
  charger `fmath.js` avant `world.js` dans son worker. Toute référence d'état ou
  d'empreinte prise sur le Mac avant la fusion est à reprendre (lots 04, 09, 10
  et 14). `tools/realm-loader.mjs` est partagé avec le lot 00.

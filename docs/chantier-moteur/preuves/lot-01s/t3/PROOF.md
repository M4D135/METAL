# Lot 01 suite / T3 — FMath.hypot, portage exact de l'hypot de V8 (MURS-V1, SIM-10)

Constats : MURS-V1 (`constats/MURS.md`, l. 690), dont c'est la suite pour
JavaScriptCore, le moteur de Safari ; SIM-10 (`constats/SIM.md`, l. 382 :
`Math.hypot` coûte et alloue, mais `sqrt` ne le remplace pas exactement). Base :
`6829b0c` (T2). Bases des mesures : `$T2` est `git archive 6829b0c`, `$BASE` est
`git archive 71eca61` (le `world.js` d'avant T2).

**Classe de preuve : état identique sous V8, identité nouvelle sous
JavaScriptCore.** Sous V8, au Mac comme au Spark, les 114 mondes sont ceux de T2
bit pour bit, les 8 tests historiques passent et les rejeux égalent l'oracle
x86-64. Dans `jsc`, les mondes du jeu égalent ceux de Node dans **114 cas sur
114**, contre 0 sur 114 avec T2 (§ 4).

## Le changement

- `src/fmath.js` reçoit `hypot2(x,y)`, `hypot3(x,y,z)` et `hypot(...)`. Ce sont
  des portages de `MathHypot` (`src/builtins/math.tq` de V8) :
  - les arguments sont convertis une fois chacun, dans l'ordre ;
  - Infinity l'emporte sur NaN, puis NaN, puis un maximum nul donne +0 ;
  - la somme compensée de Kahan des (|x|/max)² se fait dans l'ordre des arguments ;
  - le résultat est `sqrt(somme)·max`.

  À deux arguments, le premier pas de Kahan est exact et le terme du maximum vaut
  exactement 1, d'où `sqrt(1+r²)·max` avec `r=min/max`. À trois arguments, la
  formule est `sqrt(s+(c²-((s-a²)-b²)))·max` avec `s=a²+b²`.

  `hypot2` et `hypot3` n'allouent rien : ils n'utilisent ni tableau, ni
  `arguments`, ni `new`, ce que le test d'API vérifie sur leur source. Leur arité
  est fixe : `hypot2(3)` vaut NaN, comme `Math.hypot(3, undefined)`. `hypot`
  accepte toute arité, avec un `Float64Array` au-delà de trois arguments. Seules
  des fonctions exactes de `Math` sont appelées (abs, floor, sqrt).
- `src/world.js` : les 61 appels à `Math.hypot`, répartis sur 40 lignes,
  deviennent 53 `FMath.hypot2` et 8 `FMath.hypot3`. L'arité et l'ordre des
  arguments sont gardés, car `hypot(a,b,0)` peut différer de `hypot(a,b)` et
  l'ordre compte à trois arguments. L'appel étalé de la l. 658,
  `Math.hypot(...environment.sunDirection)`, devient
  `FMath.hypot3(sunX,sunY,sunZ)` : `sunDirection` est toujours l'un des trois
  littéraux à 3 composantes des l. 653-655. Une fois `FMath.hypot2(` et
  `FMath.hypot3(` ramenés à `Math.hypot(`, le diff ne garde que cette ligne et
  l'en-tête (une ligne de plus).
- `checks/fmath.test.mjs` passe de 11 à 15 tests. Les 4 nouveaux tests :
  - la table couvre tous les chemins ;
  - elle est égale bit pour bit à FMath ;
  - elle égale le `Math.hypot` de ce V8, et FMath l'égale sur 120 000 entrées tirées ;
  - les conversions se font dans l'ordre et les valeurs spéciales sont gardées.

  Deux tests sont **mis à jour exprès** :
  - le test d'API : nouvelles clés et nouveaux appels exacts, et pas de `arguments` dans `hypot2`/`hypot3` ;
  - la garde de `world.js` : `hypot` sort des fonctions de `Math` permises, chaque
    `FMath.hypot2` et `FMath.hypot3` doit recevoir exactement 2 ou 3 arguments
    sans étalement, et un monde est encore généré avec le `hypot` de l'hôte
    empoisonné.
- `checks/fmath-hypot-vectors.txt` (nouveau, 1 578 lignes, 119 692 octets) :
  table des entrées et des bits de `Math.hypot` de V8 13.6.233.17-node.50.
  Groupes : special 768, edge 35, random 300, kahan 60, order 48, arity 48,
  world 200 et many 119. Elle est écrite par `hypot-proof.mjs vectors --write`
  et régénérée à l'identique au Mac et au Spark (`vectors-check.json`).
- `tools/platform-math.mjs` :
  - `census` compare `hypot2` et `hypot3` au `Math.hypot` de l'hôte ;
  - la page `jsc` génère les 114 mondes avec le `world.js` de la racine et le
    `Math` de `jsc`, puis les hache en SHA-256 écrit en JS pur, vérifié contre
    `node:crypto` ;
  - avec `--base`, elle garde les variantes native, fmath et fmathV8Hypot sur
    les 42 mondes de la graine 96 ;
  - Chrome et `jsc` passent aussi la table hypot.
- `dist/index.html` passe de 830 459 à 833 373 octets (gzip : 252 733 à
  253 760 ; SHA-256 `bbb640e9…` à `f4efa378…`), pour un budget de 1 400 000.
  `python3 tools/build.py`, rejoué dans une copie, redonne `dist/index.html` et
  `SIZE.json` à l'identique. Dans `SIZE.json`, `fmath.js` passe de 17 281 à
  19 961 octets et `world.js` de 133 688 à 133 922 octets.
- Documentation : `docs/ARCHITECTURE.md`, `README.md` et `tools/proof/README.md`
  nomment hypot, hypot2 et hypot3, ainsi que JavaScriptCore.
- Outils de preuve de ce dossier : [hypot-proof.mjs](hypot-proof.mjs)
  (vectors, sweep, worlds, micro), [mutation-check.mjs](mutation-check.mjs) et
  [dist-check.mjs](dist-check.mjs).

Machines (les mêmes qu'en T2) :

- **Mac** : Apple M5, macOS 27.2.1 (Darwin 27.2.0), Node 24.18.0
  (V8 13.6.233.17-node.50) darwin-arm64, Chrome 157.0.8103.39, `jsc` du
  système (JavaScriptCore.framework).
- **Spark** : NVIDIA GB10, Linux 6.17.0-1026-nvidia arm64, Node 24.18.0 (même
  V8), Chrome 151.0.7922.137, pas de `jsc`.

Aucune machine x86-64 n'est joignable. Les oracles x86-64 sont ceux du dépôt et
n'ont pas été régénérés.

## 1. Exactitude : bit pour bit avec `Math.hypot` de V8

| Comparaison (`Object.is`, un NaN égale tout NaN) | Mac | Spark |
|---|---|---|
| `sweep`, graine 1592591107 : 41 012 760 entrées (1) | **0 écart** | **0 écart** |
| Tous les appels des 114 mondes : `hypot2` 67 577 290 appels (56 043 049 entrées distinctes), `hypot3` 29 208 587 (20 614 713) (2) | **0 écart** | **0 écart** |
| Table `checks/fmath-hypot-vectors.txt`, 1 578 lignes, 3 037 cas avec `hypot2` et `hypot3` | régénérée à l'identique | régénérée à l'identique |

(1) Les 41 012 760 entrées se répartissent ainsi :

- 10⁷ pour chacune des fonctions `hypot2`, `hypot(a,b)`, `hypot3` et `hypot(a,b,c)` ;
- 10⁶ pour les arités 0, 1 et 4 à 8 ;
- 529 et 12 167 pour les grilles de valeurs spéciales (23² et 23³), et 64 cas qui mêlent Infinity et NaN.

Les entrées couvrent ±0, les sous-normaux, les petites et les grandes
magnitudes, les valeurs proches du plus grand double, des bits quelconques, des
valeurs voisines entre elles, des valeurs des mondes, ainsi qu'Infinity et NaN
(`hypot-sweep.json`).

(2) `hypot-worlds.json` : les entrées distinctes sont comptées monde par monde,
puis sommées. Les deux machines donnent les mêmes comptes.

**Les tests détectent les fautes réelles** (`mac/mutation-check.json`).
`mutation-check.mjs` applique 13 fautes à une copie de `src/fmath.js`, par
exemple :

- Kahan omis ou dans l'autre ordre ;
- y sommé avant x ;
- NaN testé avant Infinity ;
- 0 rendu à côté d'un NaN ;
- `sqrt(x*x+y*y)` ;
- conversion dans l'autre ordre, ou en double.

Les 13 sont prises. Le témoin passe. La forme littérale de V8 pour deux
arguments (deux quotients, `(0+p²)+q²`) passe aussi : c'est une formulation
équivalente, qui montre que la forme réduite de `hypot2` n'est pas une
approximation.

## 2. npm test : 485 sur 485, sur les deux machines

| | tests | réussis | échecs | `checks/build.test.mjs` |
|---|---|---|---|---|
| Mac, avant (`6829b0c`, `t2/mac/npm-test.log.gz`) | 481 | 481 | 0 | PASS |
| Spark, avant (`6829b0c`, `t2/spark/npm-test.log.gz`) | 481 | 481 | 0 | PASS |
| Mac, après | **485** | **485** | **0** | PASS |
| Spark, après | **485** | **485** | **0** | PASS |

485 = 481 + 4 nouveaux tests FMath. `checks/build.test.mjs` passe avec
833 373 octets et `f4efa378…`. Durée TAP : 122 s au Mac, 111 s au Spark.
Journaux : `mac/npm-test.log.gz` et `spark/npm-test.log.gz`.

## 3. Sous V8 : les 8 tests historiques, les 114 mondes, les rejeux

- `golden` (`golden.json`) rejoue les 8 tests à empreintes dorées de
  `checks/campaign-world.test.mjs` (MURS-V1). Le `world.js` de `$BASE` avec le
  `Math` de la machine en réussit **0/8**, la branche **8/8**, au Mac comme au
  Spark.
- `worlds . --base $T2` (`worlds.json`) donne **114/114** mondes égaux à T2
  (SHA-256 du JSON) sur chaque machine, et 114/114 égaux entre le Mac et le
  Spark. L'empreinte des empreintes est `a207bc03…`, celle de T2.
- `census` (`census.json`) relève, sur les 114 mondes, les seules fonctions
  appelées par `world.js` :
  - fonctions exactes de `Math` : abs, ceil, floor, imul, max, min, round, sign et sqrt ;
  - fonctions de FMath : sin, cos, atan, atan2, hypot2 et hypot3.

  `Math.hypot` n'est plus appelé. Sur les 96 785 877 appels, `hypot2` et
  `hypot3` égalent le `Math.hypot` de l'hôte (0 écart, aucun monde touché), au
  Mac comme au Spark.
- `replay --fmath` donne **4/4** scénarios de 1 800 pas identiques à l'oracle
  x86-64 (`09a3eca4…`). Les V2 courts (120 pas) égalent aussi leur oracle. Les
  quatre fichiers `replay-*` sont identiques à ceux de T2, à l'environnement et à
  la racine près. Les mondes de ces rejeux sont générés par `FMath.hypot2/3` : avec
  les hypot portés, ils égalent donc toujours l'oracle x86-64.

## 4. JavaScriptCore (le moteur de Safari) et Chrome

`engines` (`engines.json`) ouvre des pages `file://` dans Chrome sans tête
(`--dump-dom`, profil privé, aucun port) et lance `jsc` du système sur un
script. Le même outil, appliqué à `$T2`, donne la colonne « avant »
(`mac/engines-t2.json`).

| Mac, `jsc` | T2 (`$T2`) | T3 |
|---|---|---|
| Mondes du jeu égaux à Node (SHA-256) | **0/114** (0/6, 0/54, 0/54) | **114/114** (6/6, 54/54, 54/54) |
| dont les 42 mondes de la graine 96 | 0/42 | 42/42 |
| Vecteurs FMath (`fmath-vectors.txt`) | 3 836/3 836 | 3 836/3 836 |
| Vecteurs hypot (`fmath-hypot-vectors.txt`) | absents | 3 037/3 037 |

Sur les 42 mondes de la graine 96, le `world.js` de `$BASE` donne :

- 0/42 avec le `Math` de `jsc` ;
- 0/42 avec la trigonométrie de FMath, ce qui est l'état de T2 ;
- 42/42 avec la trigonométrie de FMath et l'hypot de V8 porté.

Le `Math.hypot` de `jsc` était donc la dernière cause d'écart de la génération.

Chrome 157 (macOS) et Chrome 151 (Linux) :

- avant comme après T3, les 3 836 vecteurs FMath passent, et les 42 empreintes
  de reprise et les 42 FNV des mondes égalent Node ;
- après T3, les 3 037 vecteurs hypot passent aussi.

**La page publiée** ([dist-check.mjs](dist-check.mjs), `dist-check.json`). Une
copie de `dist/index.html`, tel que construit, reçoit un relevé d'erreurs en tête
et une sonde en pied. La sonde hache en SHA-256 les 42 mondes de la graine 96
générés par le `FWorld` de la page. Le résultat est de **42/42** égaux à Node
dans Chrome 157 (Mac) et dans Chrome 151 (Spark), sans erreur de page.

Ne sont pas mesurés :

- Safari lui-même, sous macOS comme sous iOS : seul le moteur `jsc` du système
  l'a été, et le rendu WebGL ne participe pas à la génération ;
- Firefox ;
- Chrome sous Windows ou x86-64 ;
- les téléphones.

## 5. Garde statique : `world.js` n'appelle aucune fonction inexacte de `Math`

Le test « world.js takes sin, cos, atan, atan2 and hypot from FMath only and
refuses to load without it » vérifie le source sans ses commentaires :

- les seules fonctions de `Math` permises sont abs, ceil, floor, round, trunc,
  sign, min, max, sqrt, imul, fround et clz32, plus les constantes ;
  `Math[k.startsWith('min')?'min':'max']` est le seul accès calculé ;
- l'opérateur `**` est absent ;
- `FMath` est lu une fois et jamais réassigné ;
- seuls sin, cos, atan, atan2, hypot2 et hypot3 sont appelés sur `FMath`, et
  hypot2 comme hypot3 servent ;
- chaque `FMath.hypot2` et `FMath.hypot3` a exactement 2 ou 3 arguments, sans
  étalement ;
- un monde complet est généré alors que sin, cos, atan, atan2 et hypot de
  l'hôte lèvent une erreur.

Le `census` du § 3 le confirme à l'exécution.

## 6. Coût (SIM-10)

`tools/gen-ab.mjs` mesure `FWorld.create` comme en T2 :

- domaine principal, précharge undici ;
- 15 répétitions, 3 passes de chauffe ;
- temps CPU du fil principal, médianes ;
- six ordres tournants, avec un contrôle A/A dans chaque fichier.

Le rapport retenu est √((B/A en T2→T3) / (B/A en T3→T2)), une estimation de
T3/T2.

| Monde | CPU T2, Mac | Mac T2→T3 | Mac T3→T2 | **Mac T3/T2** | CPU T2, Spark | Spark T2→T3 | Spark T3→T2 | **Spark T3/T2** |
|---|---|---|---|---|---|---|---|---|
| l:0 | 39,0 ms | 0,864 | 1,106 | **0,884** | 52,2 ms | 0,809 | 1,154 | **0,837** |
| l:2 | 45,3 ms | 0,870 | 1,141 | **0,873** | 63,4 ms | 0,843 | 1,176 | **0,847** |
| v1:9 | 38,3 ms | 0,875 | 1,149 | **0,873** | 50,7 ms | 0,872 | 1,131 | **0,878** |
| c:0 | 41,3 ms | 0,902 | 1,096 | **0,907** | 58,9 ms | 0,867 | 1,120 | **0,880** |
| c:9 | 42,0 ms | 0,875 | 1,135 | **0,878** | 58,2 ms | 0,867 | 1,155 | **0,866** |
| c:17 | 56,3 ms | 0,890 | 1,108 | **0,896** | 74,0 ms | 0,877 | 1,157 | **0,871** |

Fichiers : au Mac, `gen-ab-t2-t3-2.json` et `gen-ab-t3-t2-2.json` ; au Spark,
`gen-ab-t2-t3-1.json` et `gen-ab-t3-t2-1.json`.

- Un premier essai au Mac (l:0, c:9 et c:17 ; `gen-ab-*-1.json`) donnait
  0,887, 0,928 et 0,919 : le gain se reproduit.
- Contrôles A/A (`$T2` contre `$T2`, `gen-ab-aa.json`) :
  - Mac : B/A de 0,988 à 1,016, A'/A de 0,959 à 1,035 dans les cinq fichiers ;
    l'A/A d'entrée (`gen-ab-aa-entree.json`, charge 4,9) montait à 1,076 ;
  - Spark : B/A de 0,982 à 1,006, A'/A de 0,954 à 1,016.
- Le rapport brut le moins favorable reste un gain :
  - séries complètes : 0,912 au Mac (c:0, T3→T2) et 0,893 au Spark (c:0) ;
  - premier essai : c:9 en T3→T2 donnait 1,015, soit 0,985.

**Gain : −9 à −13 % de `FWorld.create` au Mac (4,1 à 6,7 ms par monde), −12 à
−16 % au Spark (6,8 à 10,1 ms).** C'est deux à trois fois l'écart A/A le plus
large de la même machine.
La cause est l'appel lui-même. `hypot-proof.mjs micro` (`hypot-micro.json`)
rejoue les 3 688 425 appels à deux arguments et les 1 624 289 appels à trois
arguments relevés dans six mondes. Les passes sont alternées, et les sommes des
résultats sont identiques des deux côtés. Durées en ns par appel :

| | Mac, `Math.hypot` | Mac, FMath | Spark, `Math.hypot` | Spark, FMath |
|---|---|---|---|---|
| 2 arguments, en cache (4 096 entrées) | 7,92 | **1,23** | 10,03 | **1,23** |
| 3 arguments, en cache | 10,52 | **2,01** | 12,88 | **2,10** |
| 2 arguments, toutes les entrées | 8,15 | **1,97** | 10,00 | **1,95** |
| 3 arguments, toutes les entrées | 9,92 | **3,23** | 12,02 | **3,36** |

Le builtin de V8 reste un appel hors ligne, et SIM-10 relève qu'il alloue de 48
à 100 octets par appel. `hypot2` et `hypot3` sont de petites fonctions sans
allocation, que TurboFan peut intégrer à l'appelant. Ce gain ne
contredit pas SIM-10 (« pas de remplacement global » par `sqrt`) : le
remplacement est exact.

## 7. Suites et intégration

- Lot 02 T5 (LOAD-06) réécrit une zone de `world.js` qui va désormais des
  l. 1347 à 1397, une ligne plus bas qu'en T2. Il doit garder trois appels :
  `FMath.hypot3` dans `distance` (l. 1352), et `FMath.hypot2` dans
  `pointSegment` (l. 1396) et dans `nearBox` (l. 1397). Il doit aussi garder les
  `FMath.cos`/`FMath.sin` de la l. 1349 et attendre 0 échec. La garde statique
  refusera tout `Math.hypot` réintroduit.
- Lot 02 T16 (SIM-10) vise `src/simulation.js` (saut du déplacement nul) et
  reste valable : T3 ne touche pas la simulation.
- Lot 13 : `src/simulation.js` garde 138 `Math.hypot`, dont 20 étalés. Pour un
  rejeu identique sous Safari, il leur faudra `FMath.hypot2/3`, en gardant
  l'arité de chaque appel, avec en prime le gain de SIM-10. C'est signalé
  seulement, rien n'est fait ici.
- Toute référence d'empreinte prise dans Safari avant cette tâche est à
  reprendre. Les références V8 ne changent pas.

## Chemins des machines

Après la mesure, les préfixes absolus propres aux machines ont été réécrits dans
les sorties JSON, comme en T2 : le dossier personnel du Mac et celui du Spark en
`~`, le dossier de travail du Mac en `$W`. Les journaux `npm test` n'en
contenaient pas. Aucun autre octet n'a changé
([manifest.json](manifest.json)).

## Reproduire

Depuis la racine du dépôt. `O` vaut `$P/mac` ou `$P/spark`, `W` est un dossier
de travail, `CHROME` est le binaire de Chrome et `M` vaut `mac` ou `spark`.

```sh
P=docs/chantier-moteur/preuves/lot-01s/t3 BASE=$W/base71 T2=$W/t2 U='--import=data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'
mkdir -p $BASE $T2 && git archive 71eca61 | tar -x -C $BASE && git archive 6829b0c | tar -x -C $T2
npm test > $W/npm-test.log 2>&1
node $P/hypot-proof.mjs vectors > $O/vectors-check.json     # vectors --write régénère la table
node $P/hypot-proof.mjs sweep --count 10000000 --report $O/hypot-sweep.json
node --max-old-space-size=4096 $P/hypot-proof.mjs worlds --report $O/hypot-worlds.json
node $P/mutation-check.mjs --report $O/mutation-check.json   # Mac
node tools/platform-math.mjs worlds . --base $T2 --out $O/worlds.json
node tools/platform-math.mjs golden . --base $BASE --out $O/golden.json
node tools/platform-math.mjs census . --out $O/census.json
node tools/platform-math.mjs replay . --fmath --out $O/replay-fmath.json
node tools/platform-math.mjs replay . --fmath --scenario campaign2-w1,campaign2-w10 --steps 120 --out $O/replay-v2-fmath.json
node tools/platform-math.mjs engines . --base $BASE --dir $W/eng --census docs/chantier-moteur/preuves/lot-01s/t1/$M/census.json --chrome "$CHROME" --out $O/engines.json
node tools/platform-math.mjs engines $T2 --base $BASE --dir $W/eng-t2 --census docs/chantier-moteur/preuves/lot-01s/t1/mac/census.json --chrome "$CHROME" --out $P/mac/engines-t2.json   # Mac
node $P/dist-check.mjs --dir $W/dist --chrome "$CHROME" --report $O/dist-check.json
node $U tools/gen-ab.mjs $T2 $T2 --reps 15 --out $O/gen-ab-aa.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs $T2 . --reps 15 --out $O/gen-ab-t2-t3-N.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs . $T2 --reps 15 --out $O/gen-ab-t3-t2-N.json l:0 l:2 v1:9 c:0 c:9 c:17
node $P/hypot-proof.mjs micro --reps 11 --report $O/hypot-micro.json
```

Sur le Spark, le dépôt, `$T2` et `$BASE` sont copiés sous `~/metal-tests/`, où
pointe aussi `TMPDIR`. Un seul Chrome tourne à la fois, sans aucun port. Les
mesures de temps passent l'une après l'autre sur chaque machine.

## Limites

- Safari n'est pas mesuré en vrai : seul le moteur `jsc` du système l'est (§ 4).
- Aucune mesure nouvelle sous x86-64. Le `MathHypot` de V8 n'enchaîne que des
  opérations IEEE arrondies une à une (abs, division, multiplication, addition,
  soustraction, sqrt), sans contraction en FMA. Les oracles x86-64 du dépôt
  (8 empreintes dorées, rejeux) restent égaux.
- La simulation garde le `Math` de la machine, y compris `Math.hypot`, jusqu'au
  lot 13. Un rejeu dans Safari peut donc encore diverger de V8, même si le monde
  de départ est désormais le même.
- Le numéro de version (0.8.1) n'est pas touché : c'est le rôle de l'agent de
  version.

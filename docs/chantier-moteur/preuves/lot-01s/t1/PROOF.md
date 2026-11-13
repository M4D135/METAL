# Lot 01 suite / T1 — cause des 8 échecs historiques (MURS-V1)

Constats : MURS-V1 (`constats/MURS.md`, l. 690), MURS-06 (ne rien écrire dans
l'objet monde), MASTER-PROMPT § 6 bis n° 1 (tests rouges sur `main`). Le
préflight MURS-V1 du lot 01 (`RAPPORT.md`, l. 199-225) passe les 8 tests sur
Linux x86-64 (Node 24.22.1) et note que le résultat du Mac « n'est ni reproduit
ni expliqué ». Ce dossier reprend le commit wip `9f35223` (`src/fmath.js`,
`checks/fmath.test.mjs`, `checks/fmath-vectors.txt`, `package.json`,
`tools/platform-math.mjs` et les outils de ce dossier), resté sans preuve.

**Classe de preuve : état identique.** Le jeu ne change pas. `src/world.js`,
`tools/build.py`, `dist/index.html` et `SIZE.json` sont intacts ;
`python3 tools/build.py`, rejoué dans une copie, redonne `dist/index.html`
(812 696 octets, SHA-256 `4587dc49…`) et `SIZE.json` à l'identique.
`src/fmath.js` n'est chargé ni par le jeu ni par le build (il n'est pas dans la
liste des modules de `tools/build.py`) : ici, c'est un instrument. Le
branchement est la tâche T2.

**Cause.** Sur arm64, le fdlibm C++ de V8 (`src/base/ieee754.cc`), qui calcule
`Math.sin`, `cos`, `atan` et `atan2`, est compilé avec contraction des
multiplications-additions en FMA. Le x86-64 de base n'a pas d'instruction FMA,
et c'est sur x86-64 que les empreintes dorées passent. Les résultats diffèrent
d'un ulp (sur tous les échantillons conservés) pour 0,14 à 0,23 % des appels de
la génération. Ni la locale, ni le fuseau, ni un commit ne sont en cause.

Machines :

- **Mac** : Apple M5, macOS 27.2.1 (Darwin 27.2.0), Node 24.18.0
  (V8 13.6.233.17-node.50) darwin-arm64, Apple clang 21.0.0,
  Chrome 157.0.8103.39, `jsc` du système.
- **Spark** : NVIDIA GB10 (Cortex-X925 + Cortex-A725), Linux 6.17.0-1026-nvidia
  arm64, Node 24.18.0 (même V8), gcc 13.3.0, Chrome 151.0.7922.137, pas de `jsc`.

Les 28 sources mesurées sont identiques octet pour octet sur les deux machines
et à ce commit (`*/environment.json`). Les oracles x86-64 sont ceux du dépôt,
jamais régénérés : les `legacyHashes` de `checks/campaign-world.test.mjs` (8/8
sur Linux x86-64 au préflight du lot 01), `tools/proof/reference-63668ac.json` et
`docs/chantier-moteur/preuves/lot-00/aa-v2-short.json.gz` (lot 00 : Linux x64,
Node 24.22.1, V8 13.6.233.17-node.58, AMD EPYC 9V45). Aucune machine x86-64
n'était joignable pour une mesure nouvelle : david-pc ne répondait pas le 13/11.

Tous les chiffres ci-dessous sont dans [summary.json](summary.json), que
[summarize.mjs](summarize.mjs) calcule à partir des sorties de `mac/` et
`spark/`.

## 1. Les 8 tests historiques : 0/8 avec le Math de l'hôte, 8/8 avec FMath

`tools/platform-math.mjs golden` rejoue les 8 tests, avec les mêmes
transformations que `checks/campaign-world.test.mjs`. `src/world.js` est chargé
dans le domaine principal de Node, sous le Math de l'hôte, puis sous FMath
injecté par `loadRealm` (`golden.json`). Chaque chaîne donne un chiffre par
test, dans l'ordre du fichier (1 = réussi) :

| Fonctions prises dans FMath | Mac | Spark |
|---|---|---|
| aucune (Math de l'hôte) | 0/8 | 0/8 |
| sin, cos, atan, atan2 | **8/8** | **8/8** |
| sin, cos | 00001000 | 00000000 |
| atan, atan2 | 01000000 | 01000000 |
| sin, cos, atan2 | 11111111 | 11111111 |

sin et cos seuls ne suffisent pas, atan et atan2 seuls non plus. sin, cos et
atan2 suffisent ensemble. atan n'est pas nécessaire, car il n'a aucun appel
divergent dans les mondes que vérifient ces tests. Au Mac, seul le monde 18 de
la graine 1 en a, en V1 comme en V2.

## 2. Recensement des appels pendant la génération (114 mondes)

Les 114 mondes sont les classiques des graines 1 et 96 (6) et les campagnes V1
et V2 des graines 1, 96 et 2026 (54 + 54). Chaque appel à une fonction de `Math`
depuis `src/world.js` est compté, et les appels de sin, cos, atan et atan2 sont
comparés à FMath (`census.json`) :

| Fonction | Appels | Divergents, Mac | Divergents, Spark | Argument max. en valeur absolue |
|---|---|---|---|---|
| sin | 5 808 589 | 13 414 (0,23 %) | 13 414 | 14,22 |
| cos | 5 809 615 | 8 267 (0,14 %) | 8 267 | 14,22 |
| atan2 | 325 622 | 707 (0,22 %) | 368 | 68,58 (max. de \|y\| et \|x\|) |
| atan | 1 026 | 4 | 0 | 0,27 |

Les 6 mondes classiques et les 108 mondes de campagne ont tous des appels
divergents à sin et à cos. Aucun appel à sin ou à cos ne passe par la réduction
des grands arguments (`__kernel_rem_pio2`, `largeArgumentCalls` 0).

Les autres fonctions appelées sont exactes par la spécification ECMAScript (abs,
ceil, floor, imul, max, min, round, sign, sqrt), sauf `Math.hypot`
(96 785 877 appels : 67 577 290 à deux arguments, 29 208 587 à trois). V8 la
calcule avec le même algorithme (builtin Torque) sur toutes les plateformes. Avec
FMath, les mondes du Mac et du Spark sont identiques entre eux (§ 3) et
conformes aux oracles x86-64 (§ 1 et § 4). `src/world.js` n'emploie ni `**`, ni
`Math.pow`, `exp` ou `log`, ni horloge, ni `Math.random` : son aléa vient d'un
générateur à graine.

## 3. La cause, prouvée par un témoin C

[fdlibm-v8.c](fdlibm-v8.c) transcrit en C, expression pour expression, le fdlibm
de V8 (`__kernel_sin`, `__kernel_cos`, `__ieee754_rem_pio2`, `__kernel_rem_pio2`,
`atan`, `atan2`). [gen-vectors.mjs](gen-vectors.mjs) le compile deux fois, sans
contraction (`-ffp-contract=off`) et avec la contraction par défaut du
compilateur (clang : `=on` ; gcc : `=fast`), puis compare les résultats :

| Entrées | Machine | FMath = témoin sans contraction | Hôte = témoin contracté | Hôte ≠ témoin sans contraction |
|---|---|---|---|---|
| Toutes les entrées distinctes de la génération, mondes FMath : 1 761 019 (sin 818 722, cos 818 794, atan 216, atan2 123 287) | Mac, clang | 100 % | 100 % | 6 810 (sin 4 471, cos 1 996, atan 1, atan2 342) |
| idem | Spark, gcc | 100 % | 100 % | 6 646 (sin 4 471, cos 1 996, atan 0, atan2 179) |
| Toutes les entrées distinctes de la génération, mondes de l'hôte : 1 761 019 | Mac | 100 % | 100 % | 6 800 |
| idem | Spark | 100 % | 100 % | 6 637 |
| 2 000 000 d'entrées aléatoires à graine fixe, 500 000 par fonction, par classes d'arguments : moyens, grands jusqu'au plus grand double, proches des multiples de π/2, minuscules, motifs de bits quelconques | Mac | 100 % | 100 % | 2 904 |
| idem | Spark | 100 % | 100 % | 2 856 |
| 6 979 cas : les 3 836 de `checks/fmath-vectors.txt`, les 1 800 entrées du pilote, 1 343 entrées divergentes récoltées | Mac | 100 % | 100 % | 1 671 |
| idem | Spark | 100 % | 100 % | 1 284 |

Les entrées sont identifiées par leurs motifs de bits (−0 et 0 sont distincts),
les NaN comptent comme un seul NaN et seuls les comptes sont écrits
(`exhaustive-*.json`, `sweep.json`, `vectors-*.json`). Les 455 réductions
`__ieee754_rem_pio2` de la table (n, y0, y1) sont identiques entre les deux
compilations du témoin.

- La table de vecteurs régénérée est **identique** au fichier commité, avec clang
  sur le Mac comme avec gcc sur le Spark (`identicalToExisting: true`). Le fichier
  n'est pas réécrit.
- gcc 13 traite `-ffp-contract=on` comme `off` : 7 434 cas sur 7 434 et
  1 761 019 entrées sur 1 761 019 sont identiques entre `=on` et `=off`. Le Math
  du Spark correspond donc à `=fast`, le défaut de gcc.
- Sur les mêmes entrées (mondes FMath, balayage aléatoire), les empreintes des
  résultats triés (`digests`) donnent trois résultats. FMath et le témoin sans
  contraction donnent les mêmes résultats sur les deux machines (clang `=off`
  = gcc `=off`). Les témoins contractés par clang et par gcc sont identiques pour
  sin et cos, et différents pour atan et atan2. Le Math de l'hôte suit donc le
  même partage entre le Mac et le Spark.

**Conclusion.** Sur arm64, le fdlibm C++ de V8 est compilé avec contraction en
FMA : par clang (`=on`, son défaut) pour le Node du Mac, par gcc (`=fast`, son
défaut) pour le Node de Linux arm64. Le x86-64 de base n'a pas de FMA, d'où
l'accord de Linux x86-64 avec les empreintes dorées. Le Mac et Linux arm64
diffèrent aussi entre eux. atan2 diverge de FMath sur 707 appels au Mac, contre
368 au Spark. Le JSON des mondes de l'hôte diffère entre les deux machines pour
112 mondes sur 114, et les empreintes de reprise pour 2 sur 42 (graine 96,
monde 10, en V1 et en V2). Avec FMath, les deux machines donnent les mêmes
114 mondes (SHA-256 du JSON) et les mêmes 42 empreintes de reprise, et elles
passent les 8 tests historiques.

## 4. Oracles x86-64 du dépôt : rejeux de preuve

`tools/platform-math.mjs replay` lance `tools/profile-steps.mjs` dans le
processus : quatre scénarios de 1 800 pas, comparés pas à pas à
`tools/proof/reference-63668ac.json`. Les deux V2 courts (120 pas,
`campaign2-w1` et `campaign2-w10`) sont comparés à `proofA` de
`aa-v2-short.json.gz`. Avec `--fmath`, sin, cos, atan et atan2 sont remplacés
dans tout le processus : monde, simulation et pilote.

| | Mac | Spark |
|---|---|---|
| FMath, 4 scénarios | **4/4 identiques**, checksum `09a3eca4…` (celui de la référence) | **4/4 identiques**, `09a3eca4…` |
| FMath, V2 courts | `2d73cf2a`, `65883f09` = oracle | `2d73cf2a`, `65883f09` = oracle |
| Math de l'hôte, 4 scénarios | divergence au 44e pas (4/4) | divergence au 38e pas (4/4) |
| Math de l'hôte, V2 courts | 84e et 44e pas | 78e et 38e pas |

Le pilote de `tools/proof/scenarios.mjs` (l. 30, `input.moveX=Math.sin(index/90)`)
diverge lui-même à partir de l'indice 42, sur les deux machines. Au Mac, la
divergence apparaît juste après cet écart. Au Spark, elle le précède : une autre
source, le monde ou la simulation, diverge plus tôt.

## 5. « Pourquoi les V2 échappent » : ils n'échappent pas

- Avec FMath, 54 mondes V1 sur 54 et 54 mondes V2 sur 54 changent au Mac (51/54
  et 51/54 au Spark). Ils s'écartent donc de x86-64 comme les mondes classiques.
  Mais aucun test ne compare leur empreinte à une valeur attendue : les boucles
  de `checks/campaign-world.test.mjs` (l. 208-289) vérifient la structure,
  l'accessibilité et la répétabilité dans le même processus. Seuls les trois
  premiers mondes V1 de la graine 96 sont ramenés aux empreintes classiques, par
  le 8e test historique, qui échoue.
- Les profils publiés n'y sont pas sensibles. Sur les deux machines,
  `campaign-balance` et `boss-profiles` sont identiques octet pour octet aux
  archives x86-64 du lot 00. `campaign-profiles` ne diffère que par
  `sourceSha256.simulation`, car `src/simulation.js` a changé au lot 01
  (`profiles.json`).
- Les écarts portent sur `meshes` (42 mondes sur 42) et sur `destructibles`
  (19/42 au Mac, 17/42 au Spark). Un monde changé compte de 1 à 72 nombres
  différents (74 au Spark), et l'écart maximal est de 7,1e-15 sur les positions,
  6,4e-15 sur les tailles, 3,6e-15 sur les bornes et 2,32e-14 rad sur les
  rotations. Aucune différence ne touche la structure (`checkpoints.json`).
  L'empreinte de reprise (`FSimulation`, `snapshot().fingerprint`) change
  exactement là où `destructibles` change. Au Mac : 3 classiques sur 6 (graine 1
  secteur 2, graine 96 secteurs 0 et 2), 8 mondes V1 sur 18 et 8 mondes V2 sur 18
  (graine 96, mondes 1, 3, 5, 6, 8, 9, 10 et 15). Au Spark : les mêmes, sauf le
  monde 10 (7/18 et 7/18).

## 6. Autres moteurs

- **Chrome** (157 sur le Mac, 151 sur le Spark ; sans tête, pages `file://`) donne
  l'arrondi correct de sin, cos, atan et atan2 sur toutes les entrées vérifiées.
  Au Mac, il y en a 2 251 : 1 800 du pilote, puis 150 sin, 150 cos, 150 atan2 et
  1 atan parmi les entrées divergentes de la génération. Au Spark, il y en a 2 250,
  sans atan, faute d'entrée divergente. La référence est calculée exactement en
  virgule fixe BigInt, sans cas indécis. C'est un troisième comportement : sur le
  pilote, le Math de Node est correct pour 1 749 entrées sur 1 800, et fdlibm
  (FMath) pour 1 742 sur 1 800. L'origine de ce comportement dans le V8 de Chrome
  n'est pas établie ; seul le comportement est mesuré.
- Les mondes natifs de Chrome sont identiques entre le Mac et Linux arm64
  (42 empreintes de reprise sur 42, et 42 FNV du JSON sur 42), mais aucun n'égale
  celui de Node (0/42 sur les deux machines). Dans Chrome, FMath change les
  42 empreintes. Avec FMath, Chrome égale Node : 42/42 empreintes et 42/42 FNV du
  JSON, sur les deux machines. FMath passe ses 3 836 vecteurs dans Chrome. Sous
  Linux, la chaîne d'agent de Chrome annonce `x86_64`, une valeur figée par
  Chrome : la machine est bien arm64.
- **JavaScriptCore** (moteur de Safari, `jsc` du Mac) : FMath passe ses 3 836
  vecteurs sur 3 836. Les mondes égalent ceux de Node dans 0 cas sur 10 avec
  FMath pour la seule trigonométrie, et dans 10 sur 10 avec en plus un portage de
  l'hypot de V8 (tâche T3). `jsc` est absent du Spark, où la mesure est sautée.
- Firefox n'est pas installé : il n'est pas testé.

## 7. Qualité de FMath

- `checks/fmath.test.mjs` compte 10 tests, inclus dans `npm test`. Ils vérifient
  que l'objet est gelé et n'expose que sin, cos, atan et atan2, et que la table
  couvre tous les chemins. Ils vérifient l'égalité bit à bit avec le témoin sans
  contraction pour sin, cos, atan, atan2 et les réductions (n, y0, y1).
  Ils vérifient aussi l'indépendance de l'ordre d'appel et du boutisme (mots
  gros-boutistes simulés), puis les valeurs spéciales et les conversions (±0,
  ±Infinity, NaN, chaînes, null, arguments absents). Enfin, ils comparent les
  constantes à leurs mots hexadécimaux, et les tables de réduction et les
  constantes dérivées de π au calcul BigInt (π par la formule de Machin,
  1 800 bits). Les vecteurs viennent du seul témoin sans contraction, jamais du
  Math de la machine.
- La table couvre toutes les branches de réduction (`branch-coverage.json` :
  aucune ne manque).
- Mutations (`mutation-check.json`) : les 7 mutations réelles sont détectées.
  Deux mutants sont équivalents : le seuil d'atan à 2^-29 au lieu de 2^-27, et un
  terme ajouté par recalcul dans `__kernel_rem_pio2`. Ils ne donnent aucune
  différence sur 200 008 et 200 002 entrées ciblées. Le Spark donne les mêmes
  résultats.
- `src/fmath.js` porte la notice de Sun (fdlibm) et la notice BSD de V8
  (« Copyright 2016 the V8 project authors », avec ses conditions et son
  avertissement), comme `fdlibm-v8.c`.

## 8. npm test

| | tests | réussis | échecs |
|---|---|---|---|
| Spark, base `9f35223` | 480 | 472 | 8 |
| Spark, état final | 480 | 472 | 8 |
| Mac, état final | 480 | 472 | 8 |

Les 8 échecs sont exactement les 8 historiques : les 6 empreintes classiques,
« campaign mode is strictly opt-in… » et « the first three campaign worlds
preserve historical geometry… ». `checks/build.test.mjs` n'est pas atteint
(enchaînement `&&` du script `test`). Les journaux sont
`mac/npm-test.log.gz`, `spark/npm-test.log.gz` et
`spark/npm-test-base-9f35223.log.gz`.

## Chemins des machines

Après la mesure, les chemins absolus propres aux machines ont été réécrits
relativement au dossier personnel (`~`) ou au dossier de travail (`$W`) : les
champs `root` et `dir` des sorties JSON, et les chemins des piles d'appel dans
les journaux de `npm test`. Aucun autre octet n'a changé
(`manifest.json`, `pathNormalization`).

## Reproduire

Les commandes se lancent depuis la racine du dépôt. `O` vaut `mac` ou `spark`
sous ce dossier, `W` est un dossier de travail, `CC` vaut `clang` (Mac) ou `gcc`
(Spark) et `CHROME` est le binaire de Chrome. [manifest.json](manifest.json)
donne la liste exacte, les environnements et l'empreinte de chaque fichier.

```sh
P=docs/chantier-moteur/preuves/lot-01s/t1
node tools/platform-math.mjs golden . --out $O/golden.json
node tools/platform-math.mjs census . --out $O/census.json
node tools/platform-math.mjs checkpoints . --out $O/checkpoints.json
node tools/platform-math.mjs replay . --out $O/replay-native.json
node tools/platform-math.mjs replay . --fmath --out $O/replay-fmath.json
node tools/platform-math.mjs replay . --scenario campaign2-w1,campaign2-w10 --steps 120 --out $O/replay-v2-native.json
node tools/platform-math.mjs replay . --fmath --scenario campaign2-w1,campaign2-w10 --steps 120 --out $O/replay-v2-fmath.json
node tools/platform-math.mjs engines . --dir $W/eng --census $O/census.json --chrome "$CHROME" --out $O/engines.json
node $P/gen-vectors.mjs vectors --cc $CC --work $W/vec --report $O/vectors-$CC.json
node $P/gen-vectors.mjs exhaustive --cc $CC --path fmath --work $W/ex --report $O/exhaustive-fmath.json
node $P/gen-vectors.mjs exhaustive --cc $CC --path host --work $W/ex --report $O/exhaustive-host.json
node $P/gen-vectors.mjs sweep --cc $CC --work $W/sw --report $O/sweep.json
node $P/branch-coverage.mjs > $O/branch-coverage.json
node $P/mutation-check.mjs $W/mut > $O/mutation-check.json
node $P/profiles-check.mjs --work $W/prof --out $O/profiles.json
node $P/summarize.mjs env --cc $CC --chrome "$CHROME" --out $O/environment.json
node $P/summarize.mjs
```

Sur le Spark, le dépôt est copié par `rsync` sous `~/metal-tests/` et `TMPDIR`
pointe aussi sous `~/metal-tests/`. Un seul Chrome tourne à la fois, sans aucun
port. `gen-vectors.mjs` ne réécrit `checks/fmath-vectors.txt` qu'avec `--write`,
jamais employé ici.

## Limites et suites

- Les oracles x86-64 sont ceux du dépôt (lot 00 et préflight du lot 01). Aucune
  mesure nouvelle n'a été faite sous x86-64.
- Chrome n'est mesuré que sans tête, sous macOS et Linux arm64. Ne sont pas
  mesurés : Windows, Chrome sous x86-64, Firefox, et Safari en vrai (seul `jsc`
  l'est).
- Pour T2 : d'après ces mesures, injecter FMath dans la génération du monde
  rendra à Node, sur le Mac comme sur Linux arm64, les mondes de x86-64, et
  alignera Chrome sur eux. `tools/build.py` devra charger `fmath.js` avant
  `world.js`. Le build ne minifie pas : la notice BSD de V8 ajoutera 1 696 octets
  à `dist/index.html`, sur les 17 281 octets du fichier.
- La simulation, le pilote de preuve et d'autres modules (`src/simulation.js`
  notamment) appellent toujours le Math de l'hôte. Un rejeu natif n'est donc
  reproductible que sur la même plateforme (Mac : 44e pas ; Spark : 38e pas).
  T1 n'y touche pas.

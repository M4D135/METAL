# Lot 01 suite — clôture : les mêmes mondes sur toutes les plateformes (MURS-V1)

Branche `chantier/lot-01s-determinisme-plateformes`, base `71eca61`
(`origin/chantier/integration`). Le lot a cinq tâches, une par commit :

| Tâche | Commit | Objet | Preuve |
|---|---|---|---|
| T1 | `5e86238` | cause des 8 échecs prouvée, FMath écrit et vérifié ; reprend le wip `9f35223` sans le réécrire | [t1/PROOF.md](../t1/PROOF.md) |
| T2 | `6829b0c` | `src/world.js` prend sin, cos, atan et atan2 dans FMath | [t2/PROOF.md](../t2/PROOF.md) |
| T3 | `0d529ac` | `FMath.hypot2`, `hypot3` et `hypot`, portages du `MathHypot` de V8 | [t3/PROOF.md](../t3/PROOF.md) |
| T4 | `32cb7ec` | empreintes dorées des 108 mondes de campagne | [t4/PROOF.md](../t4/PROOF.md) |
| T5 | ce commit | preuves finales, mesures par moteur, rapport du lot | ce dossier |

Aucune tâche n'est sautée. X1 à X5 ne sont pas faites, pour les raisons du § 9.
Rien n'est poussé. `main`, le numéro de version (0.8.1) et le site ne sont pas
touchés.

**Classe de preuve de T5 : état identique.** Aucun code n'est modifié : T5
n'ajoute que des preuves et deux outils de preuve,
[ecarts-moteurs.mjs](ecarts-moteurs.mjs) et [resume.mjs](resume.mjs).
`python3 tools/build.py` redonne `dist/index.html` et `SIZE.json` octet pour
octet (`git diff --exit-code` vide). Les chiffres de T5 sont dans
[resume.json](resume.json), que `resume.mjs` calcule à partir des seuls
fichiers de ce dossier. L'empreinte de chaque fichier est dans
[manifest.json](manifest.json).

Machines :

- **Mac** : Apple M5, macOS 27.2.1 (Darwin 27.2.0), Node 24.18.0
  (V8 13.6.233.17-node.50) darwin-arm64, Chrome 157.0.8103.39, `jsc` du système ;
- **Spark** : NVIDIA GB10, Linux 6.17.0-1026-nvidia arm64, même Node, Chrome
  151.0.7922.137, pas de `jsc`.

## 1. La référence de tests

**Sur ce Mac et sur le Spark, la référence de tests devient 470/470 : les 470
tests existants passent, dont les 8 historiques.** `npm test` affiche
**485/485** sur les deux machines, soit (470 + 15)/(470 + 15). Les 15 tests
ajoutés par le lot (D4) sont tous dans `checks/fmath.test.mjs` : les 10 tests
FMath de T1, la garde de `world.js` de T2 et les 4 tests hypot de T3.

| `npm test` | tests | réussis | échecs | ignorés | `checks/build.test.mjs` | Journal |
|---|---|---|---|---|---|---|
| Spark, base `71eca61` (relancé le 13/11) | 470 | 462 | 8 | 0 | non atteint (`&&`) | [npm-test-spark-avant-71eca61.log.gz](npm-test-spark-avant-71eca61.log.gz) |
| Mac, final | **485** | **485** | **0** | 0 | PASS | [npm-test-mac.log.gz](npm-test-mac.log.gz) |
| Spark, final | **485** | **485** | **0** | 0 | PASS | [npm-test-spark.log.gz](npm-test-spark.log.gz) |

- **Test par test** (`resume.json`, `tests`) : les 470 tests de la base sont
  présents sous le même nom dans les deux journaux finaux, et tous passent. Les
  8 échecs de la base sont les 8 historiques : les 6 empreintes classiques,
  « campaign mode is strictly opt-in… » et « the first three campaign worlds
  preserve historical geometry… ». Ils passent tous les 8. Aucun test n'est
  ignoré ni marqué TODO.
- **Au Mac**, la base n'a pas été relancée. Le journal de T1
  (`t1/mac/npm-test.log.gz`, `5e86238`) donne 480 tests, 472 réussis et
  8 échecs, les 8 mêmes. Ce commit n'ajoute au décompte que les 10 tests de
  `checks/fmath.test.mjs` : les 470 autres sont ceux de la base.
- `checks/world.test.mjs`, lancé à part, passe (18 cas) dans les trois journaux.
  `checks/build.test.mjs` ne s'exécutait pas tant que les 8 tests échouaient ; il
  passe désormais. Durées TAP : 85 s au Mac, 114 s au Spark.
- **Les 8 tests historiques seuls** (banc 4, `--test-name-pattern`) donnent
  **0/8 → 8/8**, au Mac comme au Spark (`mac/historiques*.tap`,
  `spark/historiques*.tap`).
- Tests modifiés pendant le lot, tous dans le commit du changement et sans
  aucune assertion affaiblie :
  - T2 ne change que les lignes de chargement (fmath avant world) de sept
    fichiers de `checks/`. Il ajoute aussi deux contrôles à
    `checks/build.test.mjs` : FMath est présent dans la page, et défini avant
    `world.js` ;
  - T3 met à jour exprès deux tests ajoutés par le lot, celui de l'API et la
    garde ;
  - T4 ajoute une assertion d'empreinte dans les deux boucles de campagne
    existantes.

  `legacyHashes` n'est pas régénéré.

## 2. La distribution

`dist/index.html` passe de **812 696 à 833 373 octets bruts** (+20 677, dont
19 961 pour `fmath.js` et 713 de plus pour `world.js`). En gzip, il
passe de 245 325 à 253 760 octets ; le budget est de 1 400 000. SHA-256
`f4efa37800fdda0e68c66496c6e198b89f805827999bca330002abae8b486787`, aucune
ressource externe, version 0.8.1. `tools/build.py` charge `fmath.js` en tête, et
`checks/build.test.mjs` vérifie que `FMath` est défini avant que `world.js` le
lise.

## 3. La cause (T1)

Sur arm64, le fdlibm C++ de V8 (`src/base/ieee754.cc`), qui calcule `Math.sin`,
`cos`, `atan` et `atan2`, est compilé avec contraction des
multiplications-additions en FMA. Pour le Node de macOS, c'est clang avec
`-ffp-contract=on`, son défaut ; pour le Node de Linux arm64, gcc avec `=fast`,
son défaut. Le x86-64 de base n'a pas de FMA : c'est là que les empreintes
dorées ont été prises, et là qu'elles passent. Ni la locale, ni le fuseau, ni
un commit ne sont en cause.

**Le témoin exhaustif le prouve.** `t1/fdlibm-v8.c` transcrit en C le fdlibm de
V8, puis il est compilé avec et sans contraction. Les entrées sont les
1 761 019 entrées distinctes de la génération des 114 mondes, plus
2 000 000 d'entrées tirées. Sur 100 % de ces entrées, FMath égale le témoin sans
contraction, et le `Math` de l'hôte égale le témoin contracté. Le résultat est
le même au Mac (clang) et au Spark (gcc).

Appels de la génération dont le résultat diffère de FMath, avant le correctif
(recensement de T1 sur les 114 mondes ; pour hypot, celui de T3, qui compare
`FMath.hypot2` et `hypot3` au `Math.hypot` de l'hôte) :

| Fonction | Appels | Mac | Spark |
|---|---|---|---|
| sin | 5 808 589 | 13 414 (0,23 %) | 13 414 (0,23 %) |
| cos | 5 809 615 | 8 267 (0,14 %) | 8 267 (0,14 %) |
| atan2 | 325 622 | 707 (0,22 %) | 368 (0,11 %) |
| atan | 1 026 | 4 | 0 |
| hypot (V8) | 96 785 877 | 0 | 0 |

**Après le correctif : 0.** `world.js` n'appelle plus que des fonctions exactes de
`Math` (abs, ceil, floor, imul, max, min, round, sign, sqrt) et celles de
FMath (sin, cos, atan, atan2, hypot2, hypot3). La garde statique de
`npm test` le vérifie, et le recensement de T3 le confirme à l'exécution.

Les autres moteurs ont leurs propres résultats :

- Chrome (157 sous macOS, 151 sous Linux arm64) arrondit correctement sin, cos,
  atan et atan2 sur toutes les entrées vérifiées ;
- JavaScriptCore (`jsc`, le moteur de Safari) a sa propre trigonométrie et son
  propre `Math.hypot`, d'où T3.

## 4. La prémisse « les mondes V2 échappent » est fausse

Les mondes V2 n'échappaient pas. Avec FMath, 54 mondes V1 sur 54 et 54 mondes V2
sur 54 changent au Mac (51/54 et 51/54 au Spark), comme les mondes classiques.
Mais aucun test ne comparait leur empreinte à une valeur attendue.

Depuis T4 (D7), `checks/campaign-world-digests.json` fixe les 108 mondes de
campagne. Le témoin de MURS-06, un champ ajouté aux seuls mondes V2, passait
46 tests sur 46 avant ; il en fait échouer 18 après.

## 5. Le choix (D1), et ce qui change pour les joueurs

FMath reproduit le fdlibm de V8 compilé sans FMA, c'est-à-dire Node sous
x86-64. Les empreintes dorées et les rejeux Linux du dépôt restent donc les
références, sans rien régénérer. `FMath.hypot2` et `hypot3` portent le
`MathHypot` de V8, le même sur toutes ses plateformes.

**Mesure nouvelle de T5** ([ecarts-moteurs.mjs](ecarts-moteurs.mjs),
`mac/ecarts-moteurs.json` et `spark/ecarts-moteurs.json`). Pour chacun des 114
mondes, l'outil génère le monde deux fois dans le même moteur :

- avant : le `world.js` de la base, avec le `Math` du moteur ;
- après : le `world.js` de la branche.

Il compare ensuite les deux mondes nombre par nombre et en compte les
différences de structure. Le même code de comparaison tourne dans Node, dans
Chrome (page `file://`) et dans `jsc`.

| Moteur | Mondes changés | Nombres changés par monde | Positions (m) | Tailles (m) | Rotations (rad) | Bornes (m) | Structure | Après = Node |
|---|---|---|---|---|---|---|---|---|
| Node, Mac (darwin-arm64) | 114/114 | 1 à 85 | 1,42e-14 | 6,44e-15 | 2,32e-14 | 7,11e-15 | identique | — |
| Node, Spark (linux-arm64) | 108/114 | 1 à 76 | 7,11e-15 | 6,44e-15 | 2,32e-14 | 7,11e-15 | identique | — |
| Chrome 157, macOS | 114/114 | 135 à 885 | 2,84e-14 | 1,33e-14 | 3,94e-14 | 1,42e-14 | identique | 114/114 |
| Chrome 151, Linux arm64 | 114/114 | 135 à 885 | 2,84e-14 | 1,33e-14 | 3,94e-14 | 1,42e-14 | identique | 114/114 |
| JavaScriptCore (`jsc`), macOS | 114/114 | 283 à 1 755 | 2,84e-14 | 1,71e-14 | 4,78e-14 | 1,42e-14 | identique | 114/114 |
| Node, x86-64 | aucun, par déduction (FMath = fdlibm sans FMA) | | | | | | | |

Les colonnes de positions, tailles et rotations portent sur les maillages
(`meshes`), celle des bornes sur les éléments destructibles (`destructibles`).
Quelques autres champs bougent aussi, jamais de plus de 2,84e-14 :

- dans Chrome : l'orientation des ennemis, de 4,44e-16 rad au plus ;
- dans `jsc` : la même orientation, la position des ennemis (1,78e-15 m),
  les directions des tuyaux (2,22e-16), les distances d'approche des rencontres
  (2,84e-14 m) et leurs rayons de laisse (1,42e-14 m).

**Pour les joueurs, l'écart est donc d'au plus 2,84e-14 m et 4,78e-14 rad, sans
aucun changement de structure.** Cela vaut sur le Mac et sous Linux arm64, dans
Chrome et dans le moteur de Safari. Après le correctif, les cinq moteurs mesurés
donnent les mêmes 114 mondes : l'empreinte de reprise et le FNV du JSON
l'établissent ici, et les SHA-256 du JSON l'établissent contre le fichier de T4.

**Correction d'un chiffre du plan.** La borne « au plus 7,1e-15 m et
2,32e-14 rad » ne vaut que pour Node sous arm64, sur les 42 mondes de T1 (les 6
classiques et les 36 mondes de campagne de la graine 96). L'outil retrouve
exactement ces maxima sur ce sous-ensemble (`t1t2Worlds42`). Sur les 114 mondes,
Node au Mac va jusqu'à 1,42e-14 m. Dans Chrome et dans `jsc`, l'écart va jusqu'à
2,84e-14 m et 4,78e-14 rad. Ces écarts restent sans effet visible.

## 6. Points de reprise pris avant le correctif (D2)

Quand l'empreinte de reprise d'un monde change, `restore` refuse un point de
reprise pris avant le correctif. Le shell applique alors le repli du lot 01 :

- il réessaie sans les gravats ;
- en cas de nouveau refus, il reprend à l'entrée du secteur, avec le chargement
  d'entrée et le message « Point de reprise illisible. Reprise à l'entrée de ce
  secteur. » ;
- l'original est gardé dans `ferro-expedition-v2-refuse`.

T2 l'a vérifié avec le shell réel, sans aucune exception. Le format des
sauvegardes ne change pas, et `world.generation` reste 6.

| Plateforme | Points refusés, 114 mondes | dont les 42 de T2 | Mesure |
|---|---|---|---|
| Node, Mac | 57/114 (3/6, 27/54 V1, 27/54 V2) | 19/42 | empreintes (T5) ; relecture et shell réels (T2) |
| Node, Linux arm64 | 51/114 (3/6, 24/54, 24/54) | 17/42 | idem |
| Chrome 157 (macOS) et 151 (Linux) | **114/114** | 42/42 | empreintes calculées dans Chrome ; reprise non jouée |
| Safari (`jsc`, macOS) | **114/114** | 42/42 | empreintes calculées dans `jsc` (nouveau en T5) ; reprise non jouée |
| x86-64 | aucun, par déduction | | |

Toute partie en cours dans un navigateur reprend donc une fois à l'entrée de
son secteur. Ce qui a été ramassé dans le secteur est perdu, mais la graine, le
secteur et la campagne sont gardés. Selon le point de reprise, le site est en
audience privée (D2).

Avant le correctif, les points de reprise n'étaient même pas portables entre
deux machines arm64 : 8 empreintes sur 114 différaient entre le Mac et le Spark.
Après, les 114 sont égales.

## 7. Coût de la génération

| `FWorld.create` | Mac | Spark |
|---|---|---|
| T2, trigonométrie FMath (`t2/PROOF.md`, § 7) | +1 à +3 % (au plus +3,7 %) | +1,5 à +2,8 % |
| T3, `hypot2` et `hypot3` sans allocation (`t3/PROOF.md`, § 6) | −9 à −13 % | −12 à −16 % |
| **Lot entier, mesuré directement (T5) : `71eca61` → final** | **−8 à −12 %** (rapports de 0,879 à 0,918) | **−11 à −18 %** (de 0,824 à 0,892) |

La mesure de T5 reprend la méthode de T2 et de T3 :

- outil `tools/gen-ab.mjs`, dans le domaine principal, avec la précharge undici
  (D5) ;
- 15 répétitions et 3 passes de chauffe, sur le temps CPU du fil principal,
  réduites à des médianes ;
- six ordres tournants, avec un contrôle A/A dans chaque fichier ;
- deux séries par orientation.

Le rapport retenu est √((B/A base → final) / (B/A final → base)).

| Monde | Mac : CPU base → final | Mac, séries 1 et 2 | Spark : CPU base → final | Spark, séries 1 et 2 |
|---|---|---|---|---|
| l:0 | 40,1 → 35,4 ms | 0,885 ; 0,910 | 53,1 → 44,9 ms | 0,871 ; 0,836 |
| l:2 | 48,5 → 42,7 ms | 0,883 ; 0,879 | 62,8 → 57,6 ms | 0,880 ; 0,824 |
| v1:9 | 39,2 → 35,0 ms | 0,897 ; 0,912 | 52,4 → 44,4 ms | 0,832 ; 0,831 |
| c:0 | 42,2 → 37,7 ms | 0,902 ; 0,918 | 58,0 → 52,0 ms | 0,890 ; 0,884 |
| c:9 | 39,8 → 36,2 ms | 0,891 ; 0,890 | 56,4 → 49,5 ms | 0,883 ; 0,858 |
| c:17 | 53,0 → 47,2 ms | 0,910 ; 0,903 | 72,4 → 63,5 ms | 0,892 ; 0,877 |

- Contrôle A/A : au Mac, B/A va de 0,987 à 1,008 (base contre base) et A'/A de
  0,973 à 1,018 ; au Spark, de 0,984 à 1,020 et de 0,962 à 1,031. La charge du
  Spark est montée de 1 à 3,2 pendant la seconde série, plus dispersée.
- Rapport brut le moins favorable : 0,934 au Mac, 0,905 au Spark. Toutes les
  mesures donnent donc un gain.

Le gain vient de T3 : `hypot2` et `hypot3` n'allouent rien, alors que le builtin
de V8 est un appel hors ligne (SIM-10). Il compense le surcoût de la
trigonométrie portable de T2. La génération reste déterministe, sans option.

## 8. Risque pour le lot 13 (D6)

La simulation garde le `Math` de la machine : ce lot n'y change rien. Les
mesures de T2 (§ 5 et 6) restent valables, car T3 et T4 ne changent aucun monde
sous V8 :

- un rejeu natif diverge de l'oracle x86-64 au 44e pas au Mac et au 38e au
  Spark, sur les 4 scénarios de 1 800 pas, alors que ses mondes sont désormais
  ceux de x86-64 ;
- avec FMath dans tous les modules (`tools/proof/fmath-global.mjs`), les
  4 rejeux et les 2 V2 courts égalent l'oracle (`09a3eca4…`, `2d73cf2a`,
  `65883f09`) ;
- chaque pas fait en moyenne 100,2 appels à sin (0,43 % divergents au Mac,
  0,41 % au Spark), 101,0 à cos (0,075 %) et 62,7 à atan2 (0,14 % et 0,12 %) ;
- `exp` (19 appels par pas), `log`, `pow` et `**` restent sans référence
  portable ;
- `src/simulation.js` garde 138 `Math.hypot`, dont 20 étalés : un rejeu dans
  Safari peut encore diverger de V8 ;
- le pilote de preuve (`tools/proof/scenarios.mjs`, l. 30,
  `Math.sin(index/90)`) s'écarte de FMath dès l'indice 42 ;
- le cerveau WebNN (IA-12) n'est pas couvert.

## 9. Décisions D1 à D9 : valeurs par défaut appliquées, à confirmer par David

| | Question | Réponse retenue | Où |
|---|---|---|---|
| D1 | Mathématique de référence de la génération | le fdlibm de V8 sans FMA, c'est-à-dire Node sous x86-64 ; l'arrondi correct de Chrome est écarté, car il obligerait à régénérer les empreintes dorées | T1, T2 ; § 5 |
| D2 | Points de reprise d'avant le correctif | refusés une fois, puis repli du lot 01 ; pas de chemin de compatibilité (X3), qui serait non déterministe | T2 ; § 6 |
| D3 | FMath.hypot pour Safari | oui (T3). Il touche les 61 appels de `world.js` que le lot 02 T16 (SIM-10) demandait de laisser, pour éviter un remplacement inexact par `sqrt` : à arbitrer avec le lot 02 | T3 |
| D4 | Tests du lot comptés dans `npm test` | oui : 470/470 pour les tests existants, 485/485 au total | § 1 |
| D5 | Précharge undici (Node 24.18) | gardée dans les commandes ; le correctif central de `tools/realm-loader.mjs` (X5) revient à l'orchestrateur | outils |
| D6 | Simulation et rejeu multiplateforme | aucun changement dans ce lot ; portage au lot 13 (X2) | § 8 |
| D7 | Empreintes dorées des 108 mondes de campagne | oui (T4) | T4 ; § 4 |
| D8 | Oracle x86-64 direct, par un Node x64 sous Rosetta 2 (X4) | non sans l'accord explicite de David, car il faut télécharger un binaire ; david-pc ne répondait pas le 13/11 | § 10 |
| D9 | Licence de FMath | code porté de V8 (BSD) et de fdlibm (Sun), écrit dans le dépôt, sans dépendance ni fichier importé ; les deux notices sont gardées dans `src/fmath.js` et dans la page : 264 octets pour Sun, 1 744 pour V8, soit environ 2 Ko (le plan disait 1,5 Ko) | T1 |

Tâches écartées, avec leur raison :

- X1, régénérer les empreintes : la cause est la plateforme, pas un commit ;
- X2 : relève du lot 13 ;
- X3 : inutile tant que D2 reste à oui ;
- X4 : attend D8 ;
- X5 : revient à l'orchestrateur.

## 10. Ce qui a été testé, et où

- **Node 24.18.0** sur le Mac (darwin-arm64) et sur le Spark (linux-arm64) :
  `npm test`, les outils de `tools/` et ceux du lot.
- **Chrome sans tête**, 157.0.8103.39 (macOS) et 151.0.7922.137 (Linux arm64) :
  pages `file://` des modules (T1 à T3, T5), et `dist/index.html` tel que
  construit, dont le `FWorld` génère les mondes (T3, T4). Aucune partie n'a été
  jouée dans un navigateur, et aucun rendu n'a été regardé : la génération ne
  dépend pas du rendu WebGL.
- **JavaScriptCore** : `jsc` du système, sur le Mac, par des scripts. C'est le
  moteur de Safari, pas Safari.app.
- **x86-64** : uniquement par les oracles du dépôt et par le témoin exhaustif.
  Ces oracles sont les empreintes dorées `legacyHashes`,
  `tools/proof/reference-63668ac.json` et `aa-v2-short.json.gz` du lot 00.
  Aucune machine x86-64 n'était joignable (david-pc), et aucun Node x64 n'a été
  téléchargé (D8).
- **Attendent un vrai appareil** : Safari.app (macOS et iOS), Firefox (absent),
  Windows et Chrome sous x86-64, les téléphones.
  - Avant le correctif, ces plateformes généraient sans doute elles aussi
    d'autres mondes. Leurs points de reprise seraient alors refusés une fois.
  - Après le correctif, FMath n'emploie que des opérations IEEE arrondies une à
    une et des fonctions exactes. Elles devraient donc égaler les autres moteurs,
    mais ce n'est pas vérifié : `t4/engines-fixture.mjs` le vérifierait.

## 11. Intégration et suites

- **Lot 02 T5 (LOAD-06)** : la zone de `world.js` qu'il réécrit va des l. 1347 à
  1397. Il doit garder trois appels et attendre 0 échec : `FMath.hypot3`
  (l. 1352), `FMath.hypot2` (l. 1396 et 1397) et `FMath.cos`/`sin` (l. 1349).
- **Lot 02 T16 (SIM-10)** : conflit textuel avec T3 sur les appels de
  `world.js` (D3). Sa cible, `src/simulation.js`, reste valable.
- **Lot 07** : le worker de génération doit charger `fmath.js` avant
  `world.js`.
- **Références d'état** : toute référence d'état ou d'empreinte prise sur un Mac
  ou dans un navigateur avant la fusion est à reprendre (lots 04, 09, 10 et 14).
- **Mondes de campagne** : un lot qui change exprès un monde de campagne
  régénère `checks/campaign-world-digests.json` dans le même commit, par
  `node tools/platform-math.mjs worlds . --fixture write`. Il cite alors la liste
  `changedFromPrevious` dans son message.
- **Chargeur** : `tools/realm-loader.mjs` (liste de modules par racine) est
  partagé avec le lot 00. La précharge undici reste à corriger centralement
  (X5).
- **x86-64** : quand une machine x86-64 sera joignable, y lancer
  `node tools/platform-math.mjs worlds . --fixture check` (108/108 attendu),
  puis `npm test`.

## 12. Section à reporter dans `docs/chantier-moteur/RAPPORT.md`

À recopier telle quelle à la suite du lot 01. Les liens sont relatifs à
`docs/chantier-moteur/`.

```markdown
## Lot 01 suite — mêmes mondes sur toutes les plateformes (MURS-V1) — 13 novembre 2026

**T1 à T5 terminés.** Branche `chantier/lot-01s-determinisme-plateformes`, base `71eca61`. Le lot traite la décision n° 1 du § 6 bis (tests rouges sur `main`) et le préflight MURS-V1 du lot 01, resté « ni reproduit ni expliqué ».

**Cause.** Sur arm64, le fdlibm C++ de V8, qui calcule `Math.sin`, `cos`, `atan` et `atan2`, est compilé avec contraction en FMA : clang `-ffp-contract=on` sous macOS, gcc `=fast` sous Linux. Le x86-64 de base, où les empreintes dorées ont été prises, n'a pas de FMA. Un témoin C l'établit sur 100 % des 1 761 019 entrées distinctes de la génération, au Mac et au Spark : c'est le fdlibm de V8, compilé avec et sans contraction. Chrome et JavaScriptCore donnent encore d'autres résultats, et JavaScriptCore diffère jusque dans `Math.hypot`. Les mondes V2 n'« échappaient » pas : ils changeaient aussi, mais aucun test ne les comparait à une valeur attendue.

| Tâche | Livré | Avant → après |
|---|---|---|
| T1 `5e86238` | cause prouvée ; `src/fmath.js` (fdlibm de V8 sans FMA, en JavaScript pur) et 10 tests | 8 tests historiques : 0/8 sous le Math de l'hôte, 8/8 avec FMath injecté |
| T2 `6829b0c` | `world.js` prend sin, cos, atan et atan2 dans FMath ; garde statique | `npm test` : 8 échecs → 481/481 au Mac et au Spark ; génération +1 à +3 % |
| T3 `0d529ac` | `FMath.hypot2`, `hypot3` et `hypot` (MathHypot de V8) | `jsc` : mondes égaux à Node, de 0/114 à 114/114 ; génération −9 à −13 % (Mac), −12 à −16 % (Spark) |
| T4 `32cb7ec` | empreintes dorées des 108 mondes de campagne | mondes de campagne comparés à une valeur attendue : 0/108 → 108/108 |
| T5 | preuves finales et mesures par moteur | ci-dessous |

| Validation finale | Mac | Spark |
|---|---|---|
| `npm test` | **485/485**, zéro échec ni test ignoré | **485/485** |
| dont les 470 tests de la base | 470/470 (462 avant) | 470/470 (462 avant) |
| 8 tests historiques | 0/8 → 8/8 | 0/8 → 8/8 |
| `checks/build.test.mjs` | PASS (non atteint avant) | PASS |
| Coût de `FWorld.create`, lot entier | −8 à −12 % | −11 à −18 % |

**Sur ce Mac et sur le Spark, la référence de tests devient 470/470 : les 470 tests existants passent, dont les 8 historiques.** `npm test` affiche 485/485, soit (470 + 15)/(470 + 15), avec les 15 tests FMath du lot (D4).

Le HTML brut passe de **812 696 à 833 373 octets** (+20 677), pour une limite de 1 400 000. La version **0.8.1** est conservée. SHA-256 : `f4efa37800fdda0e68c66496c6e198b89f805827999bca330002abae8b486787`.

**Ce qui change pour les joueurs.** Les mondes deviennent ceux de Node sous x86-64, d'après les oracles du dépôt, et ils sont identiques dans les cinq moteurs mesurés : Node au Mac et sous Linux arm64, Chrome 157 et 151, et `jsc`. L'écart avec les mondes d'avant est d'au plus 2,84e-14 m et 4,78e-14 rad, sans aucun changement de structure. Un point de reprise pris avant le correctif, dans un monde dont l'empreinte change, est refusé une fois ; le repli du lot 01 reprend alors à l'entrée du secteur. Cela concerne 114 mondes sur 114 dans Chrome et dans `jsc`, 57/114 sous Node au Mac, 51/114 sous Linux arm64 et, par déduction, aucun sous x86-64.

**Décisions laissées à David** (valeurs par défaut appliquées) :
- D1 : la référence est le fdlibm de V8 sans FMA ;
- D2 : les reprises d'avant le correctif sont refusées une fois, sans chemin de compatibilité ;
- D3 : FMath.hypot est inclus, à arbitrer avec le lot 02 T16 ;
- D4 : les tests du lot sont comptés ;
- D5 : la précharge undici reste dans les commandes ;
- D6 : la simulation reste inchangée jusqu'au lot 13 ;
- D7 : les 108 mondes de campagne ont leurs empreintes dorées ;
- D8 : pas d'oracle x86-64 sous Rosetta sans son accord ;
- D9 : les notices de V8 et de Sun sont gardées (environ 2 Ko).

Détail : [preuves finales](preuves/lot-01s/final/README.md).

**Reste à vérifier sur du vrai matériel** : Safari.app (macOS, iOS), Firefox, Windows et Chrome sous x86-64, les téléphones. Le x86-64 n'est couvert que par les oracles du dépôt, car david-pc était injoignable. La simulation garde le `Math` de la machine jusqu'au lot 13 : un rejeu reste donc propre à une plateforme (divergence au 44e pas au Mac, au 38e sous Linux arm64).
```

## 13. Entrée à reporter dans `VALIDATION.md` (racine)

À placer en tête du fichier, au-dessus de l'entrée du lot 01. Les liens sont
relatifs à la racine du dépôt.

```markdown
# Validation du chantier moteur — lot 01 suite terminé — 13 novembre 2026

**MURS-V1 : mêmes mondes sur toutes les plateformes.** `src/world.js` prend sa trigonométrie et son hypot dans FMath (`src/fmath.js`) : le fdlibm et le MathHypot de V8, en JavaScript pur et sans FMA. 108 empreintes dorées fixent les mondes de campagne.

| Contrôle | Mac (macOS arm64) | Spark (Linux arm64) |
|---|---|---|
| `npm test` complet | **485/485**, zéro échec, zéro ignoré ; base 462/470 | **485/485** ; base 462/470 |
| 470 tests de la base | 470/470, dont les 8 historiques | 470/470 |
| Vérification indépendante du monde | **18 cas**, PASS | **18 cas**, PASS |
| Build autonome | **833 373 octets bruts**, zéro ressource externe | idem |
| Version | **0.8.1** | **0.8.1** |

SHA-256 : `f4efa37800fdda0e68c66496c6e198b89f805827999bca330002abae8b486787`. [Rapport](docs/chantier-moteur/RAPPORT.md), [preuves finales](docs/chantier-moteur/preuves/lot-01s/final/README.md).

Ce qui a été testé :
- Node 24.18, sur les deux machines ;
- Chrome sans tête, 157 (macOS) et 151 (Linux arm64), sur des pages `file://` des modules et sur `dist/index.html` chargé pour générer les 114 mondes, mais pas sur le jeu joué ;
- JavaScriptCore, par `jsc` : le moteur de Safari, pas Safari.app.

Dans ces cinq moteurs, les 114 mondes mesurés sont identiques après le correctif. Par rapport aux mondes d'avant, le correctif déplace des valeurs d'au plus 2,84e-14 m et 4,78e-14 rad, sans changement de structure. Le x86-64 n'est couvert que par les oracles du dépôt (empreintes dorées et rejeux Linux) : aucune machine x86-64 n'était joignable.

Un point de reprise pris avant le correctif dans un monde changé est refusé une fois. Le repli du lot 01 reprend alors à l'entrée du secteur ; ce repli est vérifié avec le shell réel sous Node. Cela concerne tous les points de Chrome et de `jsc`, et 57 mondes sur 114 sous Node au Mac. Le format des sauvegardes est inchangé.

Attendent un vrai appareil : Safari.app sous macOS et iOS, Firefox, Windows et Chrome sous x86-64, et les téléphones. Aucune fusion de main, aucun déploiement, aucun changement de version. Le navigateur, les outils et les preuves sont exclus de la taille brute du jeu.
```

## Reproduire

Depuis la racine du dépôt. `O` vaut `$P/mac` ou `$P/spark`, et `W` est un
dossier de travail.

```sh
P=docs/chantier-moteur/preuves/lot-01s/final BASE=$W/base71 U='--import=data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'
mkdir -p $BASE && git archive 71eca61 | tar -x -C $BASE
python3 tools/build.py && git diff --exit-code dist/index.html SIZE.json
npm test > $W/npm-test.log 2>&1                       # au Mac, puis au Spark, et sur $BASE au Spark
node --test --test-reporter=tap --test-name-pattern='exact pre-campaign|strictly opt-in|first three campaign' checks/campaign-world.test.mjs > $O/historiques.tap
(cd $BASE && node --test --test-reporter=tap --test-name-pattern='exact pre-campaign|strictly opt-in|first three campaign' checks/campaign-world.test.mjs) > $O/historiques-avant-71eca61.tap
node $U $P/ecarts-moteurs.mjs --base $BASE --dir $W/ecarts --report $O/ecarts-moteurs.json      # Spark : --chrome /usr/bin/google-chrome --jsc none
node $U tools/gen-ab.mjs $BASE $BASE --reps 15 --warm 3 --out $O/gen-ab-aa.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs $BASE . --reps 15 --warm 3 --out $O/gen-ab-base-final.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs . $BASE --reps 15 --warm 3 --out $O/gen-ab-final-base.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs $BASE . --reps 15 --warm 3 --out $O/gen-ab-base-final-2.json l:0 l:2 v1:9 c:0 c:9 c:17
node $U tools/gen-ab.mjs . $BASE --reps 15 --warm 3 --out $O/gen-ab-final-base-2.json l:0 l:2 v1:9 c:0 c:9 c:17
node $P/resume.mjs                                     # écrit $P/resume.json
```

Au Spark, `npm test` tourne sur une copie du dépôt envoyée par `rsync` sous
`~/metal-tests/`, par le script du chantier, hors dépôt. Les autres commandes
tournent sous `~/metal-tests/lot01s-t5/`, où pointe aussi `TMPDIR`. Un seul
Chrome tourne à la fois, sans aucun port ni serveur. Les mesures de temps
passent l'une après l'autre sur chaque machine.

## Chemins des machines

Après la mesure, trois préfixes propres aux machines ont été réécrits : le
dossier personnel du Mac et celui du Spark sont devenus `~`, et le dossier de
travail du Mac est devenu `$W`. Ces préfixes figuraient à trois endroits :

- les racines des sorties `gen-ab-*.json` ;
- les piles d'appel des deux fichiers `historiques-avant-71eca61.tap` ;
- les piles d'appel de `npm-test-spark-avant-71eca61.log.gz`.

Les journaux finaux, les sorties `ecarts-moteurs.json` et `historiques.tap`
n'en contenaient pas. Aucun autre octet n'a changé ([manifest.json](manifest.json)).

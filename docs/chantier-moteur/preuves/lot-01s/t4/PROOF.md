# Lot 01 suite / T4 — Empreintes dorées des 108 mondes de campagne (MURS-V1, MURS-06)

Constats : MURS-V1 (`constats/MURS.md`, l. 690 : les mondes V2 « échappaient »
faute de valeur attendue) et MURS-06 (l. 359 : un champ ajouté au monde casse les
sauvegardes, et seuls les mondes classiques avaient un test qui le voyait).
Base : `0d529ac` (T3). Les mesures « avant » portent sur `0d529ac` : l'arbre
propre pour les bancs, `git archive 0d529ac` pour les témoins.

**Classe de preuve : état identique.** Seuls les tests et un outil changent ; le
jeu ne change pas. `src/` est intact, et `python3 tools/build.py` redonne
`dist/index.html` et `SIZE.json` à l'identique (833 373 octets, SHA-256
`f4efa378…`).

## Le changement

- `checks/campaign-world-digests.json` (nouveau, 8 705 octets, SHA-256
  `9618b8e2…`) contient les SHA-256 de `JSON.stringify(monde)`, calculés comme le
  `digest()` du test, des 54 mondes V1 (`{campaign:true}`) et des 54 mondes V2
  (`{campaign:true,campaignVersion:2}`) : graines 1, 96 et 2026, mondes 1 à 18.
  En tête, le fichier donne la commande qui l'écrit
  (`node tools/platform-math.mjs worlds . --fixture write`), la définition de
  l'empreinte et la règle de régénération.
- `checks/campaign-world.test.mjs` : une assertion par graine et par monde dans
  les deux boucles existantes, après toutes leurs vérifications. Dans la boucle V1,
  elle vient à la fin du corps de chaque graine ; dans la boucle V2, juste après
  le contrôle de déterminisme. Elle porte sur le monde déjà créé : aucun monde de
  plus n'est généré. Le fichier est lu une fois en tête. Aucun test n'est ajouté,
  et aucune autre assertion n'est modifiée, ni `legacyHashes`, ni les 8 tests
  historiques.
- `tools/platform-math.mjs worlds --fixture check|write` :
  - `check` compare les 108 mondes de la racine au fichier, puis donne le
    nombre de mondes égaux, la liste des écarts et l'accord des six mondes
    classiques avec `legacyHashes`. Le code de sortie vaut 1 au moindre écart.
  - `write` réécrit le fichier, et dit quels mondes changent par rapport au
    fichier précédent.
  - `write` est refusé dans trois cas : un `world.js` qui ne prend pas sa
    trigonométrie dans FMath ; d'autres graines que celles du test, qui sont
    lues dans le test lui-même ; un passage dont les six mondes classiques
    diffèrent des `legacyHashes` du test, c'est-à-dire de l'oracle x86-64.
  - Le Math natif d'un arm64 ne peut donc pas entrer dans le fichier.
- Documentation : `tools/proof/README.md` (la règle de régénération) et une
  phrase dans `docs/ARCHITECTURE.md`.
- Outils de preuve de ce dossier :
  - [sensitivity.mjs](sensitivity.mjs) : témoins de sensibilité, dans des copies jetables ;
  - [engines-fixture.mjs](engines-fixture.mjs) : Chrome et `jsc` ;
  - [fixture-guards.mjs](fixture-guards.mjs) : refus de l'outil ;
  - [digest-cost.mjs](digest-cost.mjs) : coût ajouté au test.

Machines :

- **Mac** : Apple M5, macOS 27.2.1, Node 24.18.0 (V8 13.6.233.17-node.50)
  darwin-arm64, Chrome 157.0.8103.39, `jsc` du système ;
- **Spark** : NVIDIA GB10, Linux 6.17.0-1026-nvidia arm64, même Node, Chrome
  151.0.7922.137, pas de `jsc`.

## 1. Les 108 empreintes sont celles du chemin FMath, sur toutes les machines

Le fichier est écrit au Mac, par le `world.js` branché sur FMath (T2, T3), jamais
par le Math natif de l'arm64. Toutes les sources donnent les mêmes valeurs.

| Source | Mondes de campagne égaux au fichier | 6 mondes classiques = `legacyHashes` |
|---|---|---|
| Node, Mac (`mac/worlds.json`) | **108/108** | 6/6 |
| Node, Spark (`spark/worlds.json`) | **108/108** | 6/6 |
| Chrome 157, Mac : `dist/index.html` tel que construit, `file://` (`mac/engines-fixture.json`) | **108/108** | 6/6 |
| Chrome 151, Spark (`spark/engines-fixture.json`) | **108/108** | 6/6 |
| JavaScriptCore (`jsc`), Mac (`mac/engines-fixture.json`) | **108/108** | 6/6 |
| Sorties de T3, au même `src/` : `worlds.json` du Mac et du Spark, mondes de `jsc` dans `engines.json` | 108/108 chacune | — |

- Les 114 empreintes (6 classiques, 54 V1, 54 V2) sont égales entre le Mac et
  le Spark : 114/114. L'empreinte des empreintes vaut `a207bc03…`, comme avant
  T4 et comme en T2 et T3.
- `write` régénère le fichier octet pour octet au Mac comme au Spark
  (`fixture-guards.json`, cas `write`).
- Chrome et `jsc` hachent en SHA-256 écrit en JS pur, vérifié contre
  `node:crypto`. Ni Chrome ni `jsc` ne relèvent d'erreur de page ou de sonde.
  Les 114 mondes prennent 7 s dans Chrome 157, 9,9 s dans Chrome 151 et 6,5 s
  dans `jsc`.

**Rattachement à x86-64.** Il n'est pas mesuré directement : aucune machine
x86-64 n'est joignable. Il repose sur trois résultats :

- le témoin exhaustif de T1 (`t1/*/exhaustive-fmath.json`) : FMath égale le
  fdlibm compilé sans contraction en FMA, le code du V8 de x86-64, sur 100 % des
  1 761 019 entrées distinctes de sin, cos, atan et atan2. Ces entrées sont
  celles de la génération des mêmes 114 mondes, V1 et V2 des trois graines
  compris, au Mac (clang) comme au Spark (gcc) ;
- hypot, porté en T3, est l'algorithme de V8, le même sur toutes ses
  plateformes ;
- dans chaque passage, les six mondes classiques égalent les empreintes dorées
  prises sous Linux x86-64, et les rejeux de preuve égalent leurs oracles
  x86-64 (T1 à T3).

## 2. Témoin de sensibilité : un champ dans les seuls mondes V2

`sensitivity.mjs` copie `src/` et `checks/` de chaque côté dans un dossier
jetable. Le côté « avant » est `0d529ac`, le côté « après » l'arbre de travail
de T4. Le script modifie `src/world.js` de la copie, à une ancre exacte et
unique, puis lance `checks/campaign-world.test.mjs` en entier (46 tests). Rien
de cela n'est commité. Les résultats sont **identiques au Mac et au Spark** :

| Témoin dans `world.js` | Avant T4 | Après T4 |
|---|---|---|
| aucun (contrôle) | 46/46 | 46/46 |
| `armor:'heavy'` sur les murs des **seuls V2** (le témoin de MURS-06, `bancs/murs/save-compat.mjs`, l. 23) | **46/46 : non vu** | **28/46** : les 18 boucles V2 échouent, toutes sur l'empreinte dorée |
| le même champ sur les seuls V1 | 45/46 : seul « the first three campaign worlds… » le voit (3 mondes de la graine 96) | 26/46 : les 18 boucles V1, ce test, et « all eighteen layouts… » |
| FMath remplacé par le Math du moteur (sin, cos, atan, atan2, hypot) : la génération d'avant T2, la situation de MURS-V1 | 38/46 : seuls les 8 historiques le voient | 1/46 : les 8 historiques, les 18 boucles V1, les 18 boucles V2, « all eighteen layouts… » |

- Avant T4, un écart d'un ulp ou un champ dans un monde V2 passait donc tous les
  tests. Après T4, chacun des 108 mondes est comparé à sa valeur attendue.
- Dans les copies d'après, chaque échec d'une boucle porte le message
  « world differs from its golden digest in checks/campaign-world-digests.json ».
- « all eighteen layouts… » échoue par contrecoup, avec le message
  « seed 96: campaign worlds are duplicated ». Une boucle V1 s'arrête au premier
  échec, et les signatures des graines suivantes manquent : c'était déjà le cas
  pour tout échec dans cette boucle.

## 3. Refus de l'outil (`fixture-guards.json`, Mac et Spark)

Chaque cas s'exécute dans une copie de `src/`, `checks/` et `tools/`. Les deux
machines donnent les mêmes résultats.

| Cas | Résultat |
|---|---|
| `check` sur la copie telle quelle | code 0, 108/108, `legacyHashes` 6/6 |
| `check`, une empreinte du fichier altérée (V2, graine 2026, monde 18) | code 1, 107/108, l'écart nommé `v2:2026:18` |
| `write --seeds 1,96` | refusé avant toute génération, fichier intact |
| `write` avec le `world.js` d'avant T2 (`71eca61` au Mac, la même arborescence au Spark) | refusé avant toute génération, fichier intact |
| `write` avec le Math du moteur à la place de FMath | refusé : les 6 mondes classiques diffèrent des `legacyHashes`, fichier intact |
| `write` sur la copie telle quelle | code 0, fichier réécrit octet pour octet (`9618b8e2…`) |

## 4. Bancs, avant et après

Banc 1 : `node --test --test-reporter=tap --test-name-pattern='^campaign world|^boss campaign' checks/campaign-world.test.mjs`
(`mac/bench1-before.tap`, `mac/bench1-after.tap`).

| | Avant (`0d529ac`) | Après |
|---|---|---|
| Tests | 37/37 | 37/37 |
| Durée (TAP, Mac partagé, une passe) | 69,2 s | 70,2 s |
| Mondes de campagne comparés à une valeur attendue | 0/108 ; seule la géométrie de 3 V1 de la graine 96 est comparée, par un test historique | **108/108** |

Le coût ajouté est mesuré seul par `digest-cost.mjs` (`mac/digest-cost.json`),
sur des mondes déjà construits, en 5 passes alternées, avec la médiane par
monde. Les 108 `digest()` coûtent **1 722 ms de CPU** dans le contexte `node:vm`
du test, soit 15,9 ms par monde pour un JSON de 3,6 à 5,3 Mo. Ils coûtent 1 592 ms
dans le domaine principal. La construction des mêmes 108 mondes coûte 28,8 s
dans `node:vm`, et le test construit chaque monde deux fois, plus ses
contrôles.

Banc 2 : `node tools/platform-math.mjs worlds . --out …` donne 114 empreintes au
Mac et au Spark, égales deux à deux (`a207bc03…`). Les 108 de campagne sont
celles du fichier (§ 1).

## 5. npm test

| | tests | réussis | échecs | `checks/build.test.mjs` |
|---|---|---|---|---|
| Mac, avant (`0d529ac`, `t3/mac/npm-test.log.gz`) | 485 | 485 | 0 | PASS |
| Spark, avant (`0d529ac`, `t3/spark/npm-test.log.gz`) | 485 | 485 | 0 | PASS |
| Mac, après (`mac/npm-test.log.gz`) | **485** | **485** | **0** | PASS |
| Spark, après (`spark/npm-test.log.gz`) | **485** | **485** | **0** | PASS |

Aucun test n'est ajouté. La référence reste donc **485/485**.

## Régénérer le fichier

Seul un changement voulu de la génération d'un monde de campagne justifie de
régénérer le fichier : par exemple les lots 10, 14, 16 ou 17. La régénération se
fait dans le commit qui fait ce changement et qui dit pourquoi, jamais pour faire
passer un test. La commande est `node tools/platform-math.mjs worlds . --fixture write`.
Elle liste les mondes changés (`changedFromPrevious`), à recopier dans le message
du commit.

## Chemins des machines

Après la mesure, le champ `root` des sorties `worlds.json` a été réécrit : le
dossier personnel du Mac et celui du Spark sont remplacés par `~`. Les autres
outils de ce dossier écrivent déjà `$W` pour le dossier de travail. Aucun autre
octet n'a changé ([manifest.json](manifest.json)).

## Reproduire

Les commandes se lancent depuis la racine du dépôt. `O` vaut `$P/mac` ou
`$P/spark`, `W` est un dossier de travail et `CHROME` est le binaire de Chrome.
Au Spark, `--before-tree $W/avant` remplace `--before 0d529ac`, l'avant venant de
`git archive 0d529ac`, et `--pre-t2-tree $W/base71` remplace `--pre-t2 71eca61`.

```sh
P=docs/chantier-moteur/preuves/lot-01s/t4
# à 0d529ac (avant) : la même commande de banc 1 > $O/bench1-before.tap, puis
# node tools/platform-math.mjs worlds . --out $O/worlds-before.json
node --test --test-reporter=tap --test-name-pattern='^campaign world|^boss campaign' checks/campaign-world.test.mjs > $O/bench1-after.tap
node tools/platform-math.mjs worlds . --fixture check --out $O/worlds.json
node $P/engines-fixture.mjs --dir $W/eng --chrome "$CHROME" --report $O/engines-fixture.json      # Spark : --jsc none
node $P/fixture-guards.mjs --work $W/guards --pre-t2 71eca61 --report $O/fixture-guards.json
node $P/sensitivity.mjs --work $W/sens --before 0d529ac --after-tree . --jobs 4 --report $O/sensitivity.json
node $P/digest-cost.mjs --reps 5 --report $O/digest-cost.json                                      # Mac
npm test > $W/npm-test.log 2>&1
```

Au Spark, tout se trouve sous `~/metal-tests/lot01s-t4/`, où pointe aussi
`TMPDIR`. Un seul Chrome tourne à la fois, sans aucun port ni serveur.

## Limites

- Aucune mesure nouvelle sous x86-64 : le rattachement est celui du § 1. Quand
  une machine x86-64 sera joignable (david-pc), il faudra y lancer
  `node tools/platform-math.mjs worlds . --fixture check` (108/108 attendu), puis
  la boucle du test.
- Ne sont pas mesurés : Safari lui-même (seul le moteur `jsc` l'est), Firefox
  (absent), Chrome sous Windows et sous x86-64, et les téléphones.
- Le test coûte 1,7 s de CPU de plus (§ 4), pour un banc 1 d'environ 70 s au Mac.

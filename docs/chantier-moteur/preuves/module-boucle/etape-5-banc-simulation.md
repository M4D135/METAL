# Étape 5 — banc de simulation réelle : preuves

Mac M5 (arm64, macOS 27.2.1), Node v24.18.0, branche `chantier/module-boucle`, parent `507c319` (étape 4), base `71eca61`.
Classe de preuve : état identique, avec une seule empreinte d'état quel que soit l'écran. Constats : STAB-06, LOOP-05
(absorbé par STAB-06), STAB-V1 (formule actuelle), PARA-V1 (simulation sur le fil principal). Mesures et lecture :
document, section 4.2.

## Origine de l'outil et conformité au §7.3

Le relais ne l'avait pas écrit : `git ls-tree -r spark/spark-wip/boucle` ne contient pas
`tools/boucle-banc-simulation.mjs`. L'outil est donc écrit depuis la mission.

- Lignes 8 à 52 : le bloc de code du §7.3, lignes 945 à 989 de la mission, recopié tel quel (`cmp` : identique).
- Avant le bloc : 4 lignes de commentaire et 3 imports (`fs`, `path`, `os`).
- Après le bloc : le déroulé, le JSON et le code de sortie.

| Exigence (§7, §7.3) | Outil |
|---|---|
| racine par `fileURLToPath(new URL('../', import.meta.url))` | oui (bloc du §7.3) |
| domaine principal, jamais `node:vm` | oui : `loadRealm({root, realm: 'main'})` pour la simulation (modules par défaut), `loadRealm({root, modules: ['loop'], realm: 'main'})` pour FLoop |
| motifs `60`, `q60`, `59.94`, `75`, `120`, `144`, `165`, `jit144`, `long60` | oui, dans cet ordre |
| chauffe : un `withLoop('60')` et un `current('60')`, non comptés | oui |
| par motif, trois paires alternées (FLoop, actuel), (actuel, FLoop), (FLoop, actuel) ; trois rapports et leur médiane | oui ; avec le rejeu, 57 exécutions, en série |
| chaque exécution `withLoop` : `sameAsReplay` vrai et `chainHash` de `ref` | oui, vérifié sur les 27 exécutions comptées |
| JSON : `reference` `{steps, chainHash, snapshotSha256}`, `floop[]` (première exécution, sans `rows`), `distinctChainHashes`, `allSameAsReplay`, `current[]`, `distinctSnapshotsCurrent`, `cpu[]` | oui, sauf `cpu[]`, nommé `cpuRatios` (ci-dessous) ; aucun tableau par pas ni par image |
| le JSON commence par `schema`, `node`, `arch`, `platform`, `cpu`, `loadavg` | oui ; `loadavg` est lu après le rejeu de référence, juste avant la chauffe |
| code 1 si `distinctChainHashes !== 1` ou si `allSameAsReplay` est faux | oui ; code 1 aussi si une exécution FLoop n'a pas 1 800 pas (critère 6 du §9) |
| un court résumé ; n'écrit que dans `preuves/module-boucle/` | oui : une ligne par motif, puis un bilan ; seulement `banc-simulation.json` (`git status --short` après chaque passe) |

**Écart avec le §7.3.** Le §7 veut une clé `cpu` (modèle du processeur) en tête de chaque JSON, et le §7.3 une liste
`cpu[]` de rapports. Un objet JSON ne peut pas porter les deux ; un littéral JavaScript avec deux clés `cpu` garderait
la seconde en silence, et le modèle serait perdu. L'en-tête garde donc `cpu` (comme `banc-horloge.json`), et la liste
s'appelle `cpuRatios`, avec les champs du §7.3 (`name`, `ratios`, `medianRatio`).

**Ajouts, pour information** (ils ne changent aucun critère) : `loadavgEnd`, `seconds`, `scenario`, `seed`, `steps`,
`patterns`, `floopRuns`, `allStepsDone` et `currentRepeatable` (les trois exécutions actuelles d'un motif donnent le
même instantané) ; dans chaque entrée de `cpuRatios`, le CPU des trois exécutions de chaque sorte ; `floopCpuSpread`,
le minimum, la médiane et le maximum du CPU des 27 exécutions FLoop, qui font toutes le même travail.

## Avant

- Parent `507c319` : ni outil ni JSON (`git show 507c319:tools/boucle-banc-simulation.mjs` : code 128).
- Chiffre de départ : la formule actuelle de `game.js` (STAB-V1, lignes 787 et 802), jouée par `current()` dans le même banc,
  donne 9 instantanés distincts pour 9 écrans, et aucun n'est celui du rejeu.

## Après

`node tools/boucle-banc-simulation.mjs`, trois passes en série, toutes en code 0 avec le même bilan :

```
bilan : ok — référence 1800 pas, 576ce3b4, ni mort ni victoire ; FLoop 1 empreinte(s) sur 27 exécutions,
toutes égales au rejeu ; actuel 9 instantanés distincts sur 9 ; …
```

| Passe | Durée | `loadavg` (1 min), départ → fin | CPU des exécutions FLoop, même travail (ms par seconde simulée) |
|---|---|---|---|
| 1 | 127,2 s | 3,58 → 3,66 | 44,3 à 115,9 (les 9 premières exécutions, seules rangées par cette version) |
| 2 | 174,9 s | 2,70 → 5,22 | 42,7 à 127,1 (27 exécutions) |
| 3, rangée | 178,6 s | 4,74 → 3,94 | 44,2 à 142,7 (27 exécutions) |

- La passe 1 a tourné avant l'ajout des champs de CPU par exécution (`floopCpuSpread`, séries de `cpuRatios`) : le
  calcul des empreintes et des pas est le même.
- **Même résultat d'un processus à l'autre.** Après retrait de `loadavg`, `loadavgEnd`, `seconds`, `cpuRatios`,
  `floopCpuSpread` et des `cpuMsPerSimSecond`, les trois JSON sont identiques : mêmes images, mêmes pas, même
  `chainHash` `576ce3b4`, mêmes instantanés, FLoop comme formule actuelle.
- `banc-simulation.json` : 11 263 octets. `reference` : 1 800 pas, `chainHash` `576ce3b4`, instantané
  `966c41e5710dbe3eaba351dfc6f546aff6cfa8e6d3de91e31ea91c571603ebc5`. `distinctChainHashes` 1, `allSameAsReplay` vrai,
  `allStepsDone` vrai, `distinctSnapshotsCurrent` 9, `currentRepeatable` vrai.
- Images FLoop pour 1 800 pas : 1 800, 1 800, 1 799, 2 249, 3 598, 4 317, 4 946, 4 317 et 1 786. Pas de la formule
  actuelle en 30 s : 1 800, 1 800, 1 798, 2 250, 3 600, 4 320, 4 950, 4 320 et 1 818. Ce sont les valeurs du §8 de la
  mission et de la pré-mesure du chef de lot.

**Rapport de CPU médian, FLoop sur actuel** (information, sans seuil ; lecture dans le document, section 4.2) :

| Motif | Passe 1 | Passe 2 | Passe 3 (JSON) | 9 rapports : médiane (min à max) | Pré-mesure du chef (une passe) |
|---|---|---|---|---|---|
| 60 | 0,98 | 1,00 | 1,06 | 1,00 (0,92 à 1,09) | 0,99 |
| q60 | 1,06 | 0,99 | 1,01 | 1,01 (0,99 à 1,88) | 0,99 |
| 59.94 | 1,11 | 1,00 | 0,88 | 1,01 (0,83 à 1,64) | 0,91 |
| 75 | 0,95 | 0,86 | 0,94 | 0,94 (0,85 à 1,29) | 0,92 |
| 120 | 0,58 | 0,56 | 0,54 | 0,56 (0,53 à 0,60) | 0,57 |
| 144 | 0,46 | 0,50 | 0,42 | 0,46 (0,40 à 0,63) | 0,50 |
| 165 | 0,40 | 0,39 | 0,41 | 0,40 (0,39 à 0,66) | 0,49 |
| jit144 | 0,48 | 0,49 | 0,43 | 0,48 (0,33 à 0,51) | 0,48 |
| long60 | 0,97 | 1,02 | 0,94 | 0,97 (0,70 à 1,26) | 0,94 |

Aucun gain n'est tiré de ce rapport. À 60 Hz, le gain CPU de STAB-06 a déjà été pris par STAB-V1 (lot 01). Au-dessus
de 60 Hz, les deux exécutions d'une paire ne jouent pas la même partie : le pilote est indexé par pas, et la formule
actuelle fait 75 à 165 pas par seconde simulée.

## Tests

- `node --test --test-reporter=tap checks/floop.test.mjs checks/fschedule.test.mjs` : 50 réussis, 0 échec, 12,1 s
  (Mac chargé). Aucun test n'est touché à cette étape ; le banc n'entre pas dans `npm test` (`package.json`
  inchangé, raccord).
- `npm test` complet sur le Spark (Linux aarch64, Node v24.18.0, `outils/npm-test-spark.sh`), sur l'état final du
  clone : 470 tests, 462 réussis, 8 échecs, 130,5 s de `node --test`. Ce sont les 8 échecs de la référence de
  l'étape 0 (`not ok 108` à `115` de `checks/campaign-world.test.mjs` : six empreintes legacy, graines 1 et 96,
  secteurs 0 à 2, puis « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve historical
  geometry… »). Aucun nouvel échec. La chaîne `&&` s'arrête avant `node checks/build.test.mjs`, lancé à part : PASS.

## Le jeu est inchangé

- Fichiers de l'étape : `tools/boucle-banc-simulation.mjs`, `banc-simulation.json` et cette note sont créés ;
  `docs/chantier-moteur/modules/boucle.md` est complété (section 4.2, et deux renvois en 4). Aucun fichier du jeu
  n'est touché.
- `python3 tools/build.py` dans un arbre jetable au parent (`git worktree add --detach
  …/verif/module-boucle-MB-5-avant 507c319`, retiré ensuite) : code 0 ; `dist/index.html` et `SIZE.json` identiques
  à ceux du clone (`cmp`) ; 812 696 octets (budget 1 400 000), sha256
  `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a` ; `FLoop` et `FSchedule` absents de la page.
  `node checks/build.test.mjs` : PASS. Rien à commiter dans `dist/` ni dans `SIZE.json`.

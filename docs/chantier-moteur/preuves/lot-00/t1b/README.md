# Preuves du lot 00 / T1b — globales paresseuses de Node 24.18 dans le chargeur

Constats : SIM-11, IA-06 (chargeur en domaine principal du lot 00 T1). Correctif
commun attendu par le lot 01 suite (décision D5) et par le lot 02 (T0), qui
préchargeaient `--import='data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'`
dans chacune de leurs commandes.

Classe de preuve : état identique (outillage). `src/`, `checks/`,
`dist/index.html` et `SIZE.json` sont inchangés (812 696 octets, SHA-256
`4587dc49…`).

Machines : Mac M5 à 10 cœurs, Darwin 27.2.0, Node 24.18.0 (V8
13.6.233.17-node.50, undici 7.28.0), partagé avec d'autres agents ; Spark,
Linux arm64, même Node.

## Cause

Sous Node 24.18, `FormData` est une propriété de données paresseuse de
`globalThis`. La première lecture de son descripteur charge undici, qui ajoute
`Symbol(undici.globalDispatcher.2)` et `Symbol(undici.globalDispatcher.1)` :
182 clés avant, 184 après, sur le Mac comme sur le Spark. Les outils capturent
`Object.getOwnPropertyDescriptors(globalThis)` au début, ce qui déclenche ce
chargement pendant la capture elle-même (les clés sont relevées avant), puis
`assertHostGlobalsUnchanged` voit deux clés de plus et échoue, après tout le
travail de mesure.

## Correctif

`tools/realm-loader.mjs`, juste après les imports : un commentaire et la ligne
`Object.getOwnPropertyDescriptors(globalThis);`, exécutée à l'import du
chargeur, avant toute capture. Coût : une fois par processus, 11,7 ms sur le Mac
(médiane de 7 processus, 11,3 à 13,4 ms), aucune ressource active ensuite
(`process.getActiveResourcesInfo()` vide).
`assertHostGlobalsUnchanged` n'est pas modifiée et ne filtre aucun symbole.

Ordre de chargement vérifié : dans `ab2.mjs`, `profile-steps.mjs`,
`realm-check.mjs` et `proof/self-check.mjs`, le chargeur est le premier module
local importé (seuls des modules `node:` le précèdent) ; les seules captures de
`tools/` sont dans des fonctions, ou en tête de `self-check.mjs` après ses
imports. Les modules ESM importés sont évalués avant le corps de l'outil :
la lecture du chargeur précède donc toutes les captures.

Le bloc suit le dernier import sans ligne vide : la ligne vide et
`DEFAULT_ROOT` restent intactes entre lui et `DEFAULT_MODULES`, où le lot 01
suite (T2) ajoute `fmath`. `git merge-file` de ce changement contre un
`DEFAULT_MODULES` modifié ne donne aucun conflit, avec ou sans commentaire
ajouté au-dessus, et même si `DEFAULT_ROOT` change aussi.

## Avant et après

Avant : commit `501ec26`, sans précharge. Après : ce commit, sans précharge.

| Commande | Avant | Après |
|---|---|---|
| `node tools/realm-loader.mjs` | code 1, « host global keys changed » (+2 symboles undici) | code 0 |
| `node tools/proof/self-check.mjs` | code 1, même erreur | code 0, `globalsPreserved` vrai, `3d779b7a` / `7d6503d4` |
| `node tools/ab2.mjs . . --scenario legacy-s0 --steps 120 --reps 1 --warmups 1 --no-counters` | code 1, même erreur, aucun rapport | code 0, identique, `2d598f82…` |
| `node tools/ab2.mjs . . --scenario all --no-counters` | non relancé : même assertion en fin de course | code 0, identique, `779c1673…`, 36 s |
| `node tools/profile-steps.mjs .`, deux fois | code 1 (vérifié en court) | code 0, `b657e97b…` les deux fois, 25 s |
| `node tools/realm-check.mjs .` | code 1 (vérifié en court) | code 0, identique, `181904b3…`, 24 s |
| `node tools/cadence-profile.mjs . . c0 15 2` | code 0 (aucun contrôle des globales) | code 0, mêmes pas, histogrammes et snapshots |

Identité d'état : chaque rapport d'après égale celui de l'arbre d'avant lancé
avec la précharge, sur le même Mac : sorties de `realm-loader.mjs` et de
`self-check.mjs` identiques à l'octet, mêmes empreintes `2d598f82…`
(`ab2` court), `779c1673…` (`ab2` complet), `b657e97b…` (`profile-steps`) et
`181904b3…` (`realm-check`). Avec la précharge, l'après donne encore les mêmes
sorties (`realm-loader`, `self-check`, `ab2` court) : les commandes des plans en
cours continuent de marcher, y compris sous la forme
`--import='data:text/javascript,…'`. Au passage, `realm-check` redonne le biais
de SIM-11 : `ground` ×10,3 et ×11,6 plus lent en `vm`, pas ×6,2 et ×7,0
(legacy-s0, campaign-w10 ; charge 2,6 au départ).

Sur le Spark, avec le correctif et sans précharge : `self-check.mjs` code 0
(`3d779b7a` / `7d6503d4`), `profile-steps.mjs` code 0, `5d264356…`.

## `reference-check.mjs` sur arm64

`reference-63668ac.json` vient de Linux x86-64, Node 24.22.1
(`../reference-environment.json.gz`). Sur arm64, `reference-check.mjs` échoue
sans aucun changement de code ; ce n'est donc pas une preuve valable ici.

| | Mac (macOS arm64) | Spark (Linux arm64) |
|---|---|---|
| Empreinte `profile-steps` | `b657e97b…` | `5d264356…` |
| Mêmes empreintes sur les sources de 63668ac | oui | oui |
| Premier pas qui quitte la référence x86-64 (4 scénarios) | 43 | 37 |
| `legacy-s0`, `chainHash` (référence `4c43a6fb`) | `576ce3b4` | `fee1bbf7` |

Le Mac et le Spark divergent aussi entre eux, au pas 37, pour les quatre
scénarios. `sin-fma.mjs` compare `Math.sin(i/90)`, l'entrée du pilote, au noyau
`__kernel_sin` de fdlibm évalué avec et sans FMA (FMA exacte calculée en
BigInt) : sur les deux machines, `Math.sin` égale l'évaluation avec FMA pour
i = 1 à 70, et diffère d'un ulp de l'évaluation sans FMA pour i = 42 et 66
(`sin-fma.json`, Mac). Sur le Mac, remplacer `Math.sin` et `Math.cos` par
fdlibm sans FMA dans tout le processus ne suffit pas à retrouver la référence
(essai jetable, non versé) : d'autres fonctions sont en cause, comme l'établit
le lot 01 suite (`sin`, `cos`, `atan`, `atan2`).

## Fichiers

| Fichier | Contenu |
|---|---|
| `resultats.json` | Toutes les commandes, codes de sortie, erreurs et empreintes, avant et après, Mac et Spark, et le résultat de `npm test`. |
| `sin-fma.mjs`, `sin-fma.json` | Contrôle de la contraction FMA de `Math.sin` sur l'entrée du pilote. |

Les rapports complets (7 à 10 Mo chacun) ne sont pas versés : ils se
reproduisent par les commandes ci-dessus, et `resultats.json` en garde les
empreintes.

## Tests

`npm test` (Spark, copie de ce dossier) : 470 tests, 462 réussis, 8 échecs,
les 8 empreintes historiques admises de `checks/campaign-world.test.mjs`
(tests 108 à 115), comme sur la base. `node checks/build.test.mjs`, lancé à
part car la chaîne de `npm test` s'arrête avant lui : PASS.

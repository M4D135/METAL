# Étape 3 — FSchedule : preuves

Mac M5 (arm64, macOS), Node v24.18.0, branche `chantier/module-boucle`, parent `3bd5423` (étape 2), base `71eca61`.
Classe de preuve : état identique pour le jeu (fichiers neufs seulement, rien n'est branché). Constats : STAB-07 ;
LOAD-03, LOAD-13 et l'arbitrage « LOOP-03, LOAD-03, SIM-01 » pour les règles d'usage (document, sections 2.9 et 2.11).

## Origine des fichiers et conformité au code normatif

Les fichiers viennent du commit `4b75580` du relais (branche `spark/spark-wip/boucle`), repris par
`git checkout 4b75580 -- src/schedule.js checks/fschedule.test.mjs` (pas de cherry-pick), puis relus. Le document
n'a pas été repris de `4b75580` : la version du relais réécrit tout le fichier (309 lignes changées) et perdrait les
sections de FLoop des étapes 1 et 2. La section FSchedule et les 5 règles de déterminisme y sont gardées, réécrites
dans le document actuel (sections 2.8 à 2.12).

| Fichier | Octets | sha256 | Contrôle |
|---|---|---|---|
| `src/schedule.js` | 4 221 | `48a8b7cf0bba9a54ef6cff896110a654195b05606392c2d74ef3a3691edf9d12` | `cmp` avec les lignes 461 à 534 de la mission (§4.10) : identique |
| `checks/fschedule.test.mjs` | 16 685 | `9a45630c1b34b4f37ef2d9933d55e02faad33e3499aa7e519bb601c6dcb762e4` | relu test par test contre le §6.3, puis renforcé (ci-dessous) |

`src/schedule.js` fait 4 221 octets : sous la limite de 6 000 et sous la cible de 4 300. Il n'est pas compacté
(son sha256 doit rester celui du code normatif). Seule la première ligne, le commentaire d'en-tête, contient un
caractère non ASCII (le tiret « — », comme `src/motion.js`). Écart noté, non corrigé : STAB-07 estimait
l'ordonnanceur à « environ 1,5 Ko » ; le code normatif fait 4,2 Ko (validation des entrées, deux files, garde de
`flush`, 7 statistiques).

## Banc de départ et commande du plan

- Avant (parent `3bd5423`) : `src/schedule.js` et `checks/fschedule.test.mjs` absents ;
  `git grep -n -e FSchedule -- src checks tools` ne trouve rien (code 1).
- La commande de banc du plan commence par `git checkout 4b75580 -- … docs/chantier-moteur/modules/boucle.md`, qui
  écraserait, dans le clone, le document des étapes 1 et 2 et les tests renforcés. Elle a donc été rejouée telle
  quelle dans un arbre jetable (`git worktree add --detach …/verif/module-boucle-MB-3-avant 3bd5423`, retiré
  ensuite) : `cmp` identique, `node --test checks/floop.test.mjs checks/fschedule.test.mjs` donne 50 réussis,
  0 échec, en 6,7 s, et `wc -c src/schedule.js` 4 221 (sha256 `48a8b7cf…`, celui du §4.10).

## Tests : `node --test checks/floop.test.mjs checks/fschedule.test.mjs`

| | Tests | Réussis | Échecs | Durée |
|---|---|---|---|---|
| Avant (étape 2, `3bd5423`) : FSchedule absent | 28 | 28 | 0 | 6,8 s |
| Version du relais (`4b75580`), arbre jetable | 50 | 50 | 0 | 6,7 s |
| Après (étape 3) | 50 | 50 | 0 | 6,9 s |

`node --test checks/fschedule.test.mjs` seul : 22 réussis, médiane de 113 ms sur 5 lancements alternés avec la
version du relais (relais : 112 ms) ; la mission demande moins de 5 s. S18 en prend 68 à 71 ms sous `node:vm`,
presque tout pour les 1e6 appels de sa garde ; dans le domaine principal de Node (`loadRealm`, `realm: 'main'`),
ces 1e6 appels prennent 6,0 ms (médiane de 5 essais, 5,0 à 8,9 ms) : c'est ce que coûterait au jeu un `flush` qui
tombe sur une tâche sans fin, avant l'exception.

Toutes les valeurs attendues du §6.3 sont gardées. Le relais était conforme au §6.3, avec deux assertions plus faibles
que la lettre, renforcées comme le demandait le chef de lot :
1. **S10** : le relais ne vérifiait que `task.key` ; le test vérifie maintenant que la tâche reçue est
   l'enregistrement rendu par `add` (`task === rec`), et ajoute une seconde tâche après une tâche de 1 ms : elle reçoit
   `now() + budget restant` = 101 + 3 = 104 (une échéance « début + budget entier » donnerait 105).
2. **S18** : le relais ne gardait que le dernier argument ; le test vérifie que **chacun** des 40 appels reçoit
   `Number.MAX_SAFE_INTEGER`, plus `runs` 40, la tâche sans fin non retirée (`removed` faux) et l'erreur comptée
   pour le retour −2.

Autres renforcements (détail dans la section 2.12 du document) : S04 vérifie la valeur par défaut d'`agingFrames`
(sans option), s'arrête dès que L a tourné puis vérifie `done` et `removed`, et vérifie que S a tourné à chaque
pompe d'avant (180 et 60) ; S14 trace aussi les unités offertes, et vérifie que l'horloge irrégulière a bien agi sur
la file « image » (`maxSliceMs` 0 contre 4,8 ms, dépassements 0 contre 688,8 ms) avec une trace « sim » identique ;
S15 (aucune unité comptée pour un retour invalide ; un argument refusé, `pumpSim()` compris, n'appelle aucune tâche
et ne compte pas d'erreur) ; S16 (même chose dans la file « sim », avec une tâche qui suit) ; S20 (les 12 champs de
l'enregistrement, les 7 statistiques à 0, `pump(0)` qui lève sans horloge) ; S09 (un `pump` sans budget ne fait pas
vieillir) ; S08 et la garde de S18 avec l'horloge interdite ; S11 (même découpage avec l'horloge interdite).

## Contrôle par mutants

`node docs/chantier-moteur/preuves/module-boucle/etape-3-mutants.mjs` (19 mutants, chacun une erreur plausible
appliquée à une copie jetable du code normatif ; résultat dans `etape-3-mutants.json`, code de sortie 0, 6 s environ).
Les deux versions du test passent sur le témoin. Relancé une seconde fois sur l'état final : mêmes lignes, mêmes
survivants, mêmes sha256 (code, test du relais, test de l'étape 3).

| Mutant | Test du relais (`4b75580`) | Test de l'étape 3 |
|---|---|---|
| M01 `pump` passe une copie de l'enregistrement à `run` | survit | tué (S10) |
| M02 `flush` « sim » : premier appel avec `Infinity` | survit | tué (S18) |
| M03 `agingFrames` par défaut à 10 | survit | tué (S04) |
| M04 échéance = début + budget entier | survit | tué (S10) |
| M05 `simUnits` compté avant la validation | survit | tué (S15) |
| M06 argument refusé de `pumpSim` compté comme erreur | survit | tué (S15) |
| M07 une exception « sim » vide la file | survit | tué (S16) |
| M08 enregistrement sans `lastPump` initial | survit | tué (S20) |
| M09 `maxSliceMs` initial à −Infinity | survit | tué (S20) |
| M10 `count('frame')` compte les deux files | survit | tué (S06) |
| M11 `flush` « image » lit l'horloge (durée) | survit | tué (S08, S18) |
| M12 `pump` à budget nul fait vieillir la file | survit | tué (S09) |
| M13 les tâches sautées ne vieillissent pas | tué (S04, S21) | tué (S04, S21) |
| M14 `pumpSim` lit l'horloge | tué (S11) | tué (S11) |
| M15 remplacement de clé dans les deux files | tué (S06) | tué (S06) |
| M16 `has` ne regarde que la file « image » | tué (S13) | tué (S13, S15, S16) |
| M17 `pumpSim` offre le total à chaque tâche | tué (S12, S14) | tué (S12, S14) |
| M18 tâche plus longue que le budget lancée après une autre | tué (S04, S21) | tué (S04, S21) |
| M19 garde de `flush` à 1e5 appels | tué (S18) | tué (S18) |
| **Survivants** | **12 / 19** | **0 / 19** |

M11 et M12 portent sur des propriétés du code normatif que le §4.9 n'écrit pas en toutes lettres (`flush` ne lit pas
l'horloge ; une image sans budget ne fait vieillir personne) : les tests les fixent, et le document les décrit.

## Points relevés, sans rien changer au code normatif

1. **Tâches sans clé.** Une tâche ajoutée sans `key` a la clé `undefined` ; `cancel()`, `has()` et `flush()` sans
   argument les visent. Vérifié : avec deux tâches sans clé et une tâche `'k'`, `has(undefined)` rend `true` et
   `cancel()` rend `true` et en retire deux (3 tâches, puis 1). Au raccord : une clé pour toute tâche qu'on voudra
   annuler ou forcer (document, section 2.9). Question ouverte pour l'étape 7.
2. **`capMs` non validé.** `FSchedule.budget(1000/60, 5, NaN)` rend `NaN`, et `pump(NaN)` rend 0 : sans danger.
3. **Fiche du lot 07, T8.** Sa preuve cite `bancs/sched.mjs`, qui n'existe pas ; le vrai fichier est
   `bancs/stab/sched.mjs` (déjà relevé à l'étape 0). Ce prototype a été lu, pas repris.

## Le jeu est inchangé

- Fichiers de l'étape : `src/schedule.js`, `checks/fschedule.test.mjs`, `etape-3-fschedule.md`,
  `etape-3-mutants.mjs` et `etape-3-mutants.json` créés ; `docs/chantier-moteur/modules/boucle.md` complété (fichier
  du module). Aucun fichier du jeu touché.
- `python3 tools/build.py` dans l'arbre jetable, avec les fichiers de l'étape recopiés dedans : code 0 ;
  `dist/index.html` et `SIZE.json` identiques à ceux du clone (`cmp`) ; 812 696 octets (budget 1 400 000), sha256
  `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a` ; `FSchedule` et `FLoop` absents de la page
  (le module n'est pas dans la liste `modules` de `tools/build.py`). `node checks/build.test.mjs` : PASS, code 0.
  Rien à commiter dans `dist/` ni `SIZE.json`.
- Chargement dans le domaine principal : `loadRealm({root, modules: ['schedule'], realm: 'main'}).window.FSchedule`
  donne `create` et `budget` ; avec `['loop', 'schedule']`, `FLoop` et `FSchedule` sont tous deux présents.
- `npm test` complet sur le Spark (Linux aarch64, Node v24.18.0, `outils/npm-test-spark.sh`), lancé sur l'état
  final du clone : 470 tests, 462 réussis, 8 échecs, 137 s de `node --test`. Ce sont les 8 échecs de la référence
  de l'étape 0 (`not ok 108` à `115` de `checks/campaign-world.test.mjs` : six empreintes legacy, graines 1 et 96,
  secteurs 0 à 2, puis « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve
  historical geometry… »). Aucun nouvel échec. La chaîne `&&` s'arrête avant `node checks/build.test.mjs`, lancé à
  part (PASS). `checks/fschedule.test.mjs` n'est pas dans `npm test` (`package.json` inchangé, raccord).

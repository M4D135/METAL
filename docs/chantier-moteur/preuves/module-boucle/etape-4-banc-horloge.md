# Étape 4 — banc d'horloge : preuves

Mac M5 (arm64, macOS 27.2.1), Node v24.18.0, branche `chantier/module-boucle`, parent `e00ec04` (étape 3), base `71eca61`.
Classe de preuve : état identique pour le jeu (fichiers neufs seulement, rien n'est branché). Constats : STAB-06
(réserve 2 de sa contre-vérification : écart temps simulé / temps réel sous un pas sur 10 minutes), STAB-V3
(horodatages réalistes et déclarés), LOOP-05 (absorbé par STAB-06). Mesures et lecture : document, section 4.1.

## Origine de l'outil et conformité au §7.2

`tools/boucle-banc-horloge.mjs` vient du commit `bcec58a` du relais (branche `spark/spark-wip/boucle`,
« wip(spark-boucle) : état laissé par le relais OpenCode à son arrêt »). Il est repris par la commande du plan,
`git checkout bcec58a -- tools/boucle-banc-horloge.mjs` (pas de cherry-pick), sans retouche : 2 384 octets, sha256
`2354dd127e58d6318ba169312d7a690d90771d520b43acb417d42991d54474b7`. Relu ligne à ligne contre le §7 et le §7.2 de
la mission :

| Exigence | Outil du relais |
|---|---|
| racine par `fileURLToPath(new URL('../', import.meta.url))` | oui |
| FLoop dans le domaine principal, jamais `node:vm` | oui : `loadRealm({root, modules: ['loop'], realm: 'main'}).window.FLoop` (FSchedule est inutile ici) |
| pour chacun des 21 motifs, `runPattern(FLoop, nom)` et `compare(résultat, REFERENCE[nom])` | oui, sur `Object.keys(FRAMES)`, les 21 clés de `REFERENCE` |
| `patterns[]` : chaque résultat avec son champ `differences`, sans `marks` volumineux | oui : `runPattern` ne remplit `marks` que pour `long60` (3 images) et `switch` (2 valeurs), `{}` ailleurs ; aucun tableau par image |
| `checks` : `allMatchReference`, `allInvariant` (`< 1e-6`), `allEcartBelowStep` (`≤ stepMs`), `allDilationBound`, `maxStepsPerFrame`, `loopBytes`, `loopSha256` | oui ; `loopBytes` est la longueur du `Buffer`, donc des octets |
| le JSON commence par `schema`, `node`, `arch`, `platform`, `cpu`, `loadavg` | oui, puis `stepMs` (en plus, sans gêne), `patterns`, `checks` |
| une ligne par motif (`nom : ok` ou les écarts), code 1 si un motif s'écarte | oui ; code 1 aussi si un autre critère tombe (§7 : « sortent en code 1 si un critère tombe ») |
| n'écrit que dans `preuves/module-boucle/` | oui : `banc-horloge.json` seul (`git status --short` après chaque lancement) |

Deux remarques, sans effet : l'ordre des motifs est celui de `Object.keys(FRAMES)`, où les clés entières (`30` à
`240`) passent devant les autres (`59.94` vient après `240`), règle des objets JavaScript ; `loadavg` est lu à la fin
du banc.

## Avant

- Parent `e00ec04` : `tools/boucle-banc-horloge.mjs` et `banc-horloge.json` absents
  (`git show e00ec04:tools/boucle-banc-horloge.mjs` : code 128). Seul T-F28 (`checks/floop.test.mjs`, sous `node:vm`)
  comparait les 21 motifs à `REFERENCE`, sans rien écrire : 2,24 s.
- Commande du plan, lancée dans le clone (elle n'ajoute que l'outil, rien n'est écrasé), puis rejouée dans un arbre
  jetable au parent (`git worktree add --detach …/verif/module-boucle-MB-4-avant e00ec04`, retiré ensuite) :
  21 lignes « ok », « bilan : ok (21 motifs, pas max par image 5) », code 0 ; JSON identique à celui du clone, hors
  `loadavg`.

## Après

- `node tools/boucle-banc-horloge.mjs` : 21 lignes « ok », bilan ok, code 0. Durée : 0,15 à 0,17 s
  (`/usr/bin/time`, 6 lancements, démarrage de Node compris, charge 2,7 à 3,6).
- `banc-horloge.json` : 16 659 octets, `loadavg` 3,94 / 3,71 / 3,12. `checks` : `allMatchReference`,
  `allInvariant`, `allEcartBelowStep` et `allDilationBound` vrais ; `maxStepsPerFrame` 5 (`long60`) ; `loopBytes`
  6 042 ; `loopSha256` `2002052f16b930748cb33c59366686744d8f7ba0b05add3e517d6271e46214c5` (code normatif du §4.5).
- `maxInvariantErr` : 3,49e-10 ms au pire (`59.94`). `maxEcartMs` : 6,26 ms au pire (`bimodal`), donc toujours
  sous un pas (16,667 ms). `allDilationBound` : 566,65 ms au pire (`59.94`), pour une borne de 6 016 ms.
- Cinq lancements successifs : même JSON hors `loadavg`, même sortie console. Le JSON rangé est le cinquième.
- Le tableau complet (21 motifs, comptes exacts du §8 de la mission) et les motifs déclarés sont dans le document,
  section 4.1. Les 21 lignes du tableau ont été recalculées depuis le JSON et comparées au texte : conformes.

## Même mesure dans les deux domaines

`node docs/chantier-moteur/preuves/module-boucle/etape-4-domaines.mjs` (écrit `etape-4-domaines.json`) : `runPattern`
sur les 21 motifs, avec FLoop chargé par `loadRealm` (domaine principal, comme le banc) puis par `vm.runInContext`
(comme `checks/floop.test.mjs`) ; une chauffe, puis 5 paires alternées. Les 10 exécutions rendent le même JSON au bit
près (`identical: true`) : le banc et T-F28 mesurent la même chose, et `src/loop.js` est déterministe d'un domaine à
l'autre. Pour information, médianes de 149 ms (domaine principal) et de 1 366,5 ms (`node:vm`), rapport 9,2 sous une
charge de 3,2 ; un premier essai jetable donnait 7,3. C'est la fourchette de 4,5 à 9 du MASTER-PROMPT (§4).

## Tests

`node --test checks/floop.test.mjs checks/fschedule.test.mjs` : 50 réussis, 0 échec, 6,7 s. Aucun test n'est
touché à cette étape.

## Le jeu est inchangé

- Fichiers de l'étape : `tools/boucle-banc-horloge.mjs`, `banc-horloge.json`, `etape-4-banc-horloge.md`,
  `etape-4-domaines.mjs` et `etape-4-domaines.json` créés ; `docs/chantier-moteur/modules/boucle.md` complété
  (section 4.1). Aucun fichier du jeu touché.
- `python3 tools/build.py` dans l'arbre jetable, avec l'outil recopié dedans : code 0 ; `dist/index.html` et
  `SIZE.json` identiques à ceux du clone (`cmp`) ; 812 696 octets (budget 1 400 000), sha256
  `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a` ; `FLoop` et `FSchedule` absents de la page.
  `node checks/build.test.mjs` : PASS. Rien à commiter dans `dist/` ni `SIZE.json`.
- `npm test` complet sur le Spark (Linux aarch64, Node v24.18.0, `outils/npm-test-spark.sh`), lancé sur l'état
  final du clone : 470 tests, 462 réussis, 8 échecs, 138 s de `node --test`. Ce sont les 8 échecs de la référence
  de l'étape 0 (`not ok 108` à `115` de `checks/campaign-world.test.mjs` : six empreintes legacy, graines 1 et 96,
  secteurs 0 à 2, puis « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve
  historical geometry… »). Aucun nouvel échec. La chaîne `&&` s'arrête avant `node checks/build.test.mjs`, lancé à
  part (PASS, ci-dessus). Le banc d'horloge n'est pas dans `npm test` (`package.json` inchangé, raccord).

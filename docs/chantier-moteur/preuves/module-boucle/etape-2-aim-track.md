# Étape 2 — angles (`aim`) et interpolation (`track`) : preuves

Mac M5 (arm64, macOS), Node v24.18.0, branche `chantier/module-boucle`, parent `337dfd9` (étape 1), base `71eca61`.
Classe de preuve : état identique pour le jeu (rien n'est branché ; `src/loop.js` est inchangé depuis l'étape 1,
6 042 octets, sha256 `2002052f…46214c5`). Constats : STAB-06, DEMO-V3, PARA-05 (réfuté pour le dessin hors rAF ;
la prédiction du lacet et du tangage reste valide), MASTER-PROMPT §6 (rotation de la vue à chaque image).

## Origine

Le relais avait écrit T-F26 et T-F27 au commit `45d0af7` (branche `spark/spark-wip/boucle`). Entre `0a326af` et
`45d0af7`, le diff ne contient que ces deux tests et la section aim/track du document. Relus ligne à ligne contre
le §6.2 de la mission : conformes (générateur, graine 7, `Object.is`, valeurs attendues et tolérances).

Ils n'ont pas été repris par `git checkout 45d0af7 -- checks/floop.test.mjs docs/chantier-moteur/modules/boucle.md`
(la commande de banc du plan) : elle aurait écrasé les renforcements de l'étape 1 (T-F12, T-F18, T-F19, T-F22) et
le document de l'étape 1. Le fichier de l'étape 1 est gardé tel quel (diff : 134 lignes ajoutées entre T-F25 et
T-F28, aucune retirée) ; T-F26 et T-F27 y sont écrits d'après le §6.2, puis renforcés. La commande du plan a été
rejouée dans une copie jetable (test du relais, `src/loop.js` identique) : 28 réussis, 0 échec.

## Tests : `node --test checks/floop.test.mjs`

| | Tests | Réussis | Échecs | Durée |
|---|---|---|---|---|
| Avant (étape 1, `337dfd9`) | 26 | 26 | 0 | 6,9 s |
| Version du relais (§6.2), copie jetable | 28 | 28 | 0 | 6,5 s |
| Après (étape 2) | 28 | 28 | 0 | 6,8 s |

Valeurs du §6.2 toutes gardées. Ajouts (section 2.7 du document) :
- **T-F26** : contrat avec le jeu. La ligne qui écrit le lacet et le tangage à partir de `input.lookX` et
  `input.lookY` est relue dans `src/simulation.js` (aujourd'hui la ligne 1909, et `clamp` ligne 4), exécutée
  telle quelle et comparée à `aim` par `Object.is`, en plus du calcul transcrit. Couverture des 1 000 tuples
  vérifiée : 36 touchent la borne basse du tangage, 50 la borne haute, 207 ont un lacet hors de [−π, π]. Cas
  ajoutés : `NaN`, `undefined`, ±`Infinity`, `null`, `'0.1'`, tangage hors bornes, borne basse, lacet de 1 000 rad.
- **T-F27** : quel `id` `prune()` oublie ; chemin court dans l'autre sens ; angle rendu modulo 2π ; distance 3D
  (saut vertical, saut en z, diagonale de 2,08 m) ; valeurs par défaut (`snap` 2 m, `a = 0`, `alpha = 1`) ;
  option `snap` ; deux traqueurs aux mêmes `id` ; images à plusieurs pas (30 Hz, `long60`).

### Mutants de `src/loop.js` (copies jetables, `--test-name-pattern=T-F2[67]`)

| Mutant | Tests de l'étape 1 (avant) | T-F26/T-F27 du §6.2 (relais) | T-F26/T-F27 de l'étape 2 |
|---|---|---|---|
| A1 regard non fini remplacé par `lookX\|\|0` | survit | survit | tué (T-F26) |
| A2 `isFinite` global au lieu de `Number.isFinite` | survit | survit | tué (T-F26) |
| A3 lacet replié dans [−π, π] | survit | tué | tué (T-F26) |
| A4 borne basse du tangage oubliée | survit | tué | tué (T-F26) |
| T1 `wrap` par `Math.floor` | survit | survit | tué (T-F27) |
| T2 distance en 2D (x, z) | survit | survit | tué (T-F27) |
| T3 option `snap` ignorée | survit | survit | tué (T-F27) |
| T4 `snap` par défaut de 3 m | survit | survit | tué (T-F27) |
| T5 `prune` inversé | survit | tué | tué (T-F27) |
| T6 première sauvegarde de l'image gardée | survit | survit | tué (T-F27) |
| T7 traqueurs qui partagent leurs `id` | survit | survit | tué (T-F27) |
| T8 `alpha` par défaut à 0 | survit | survit | tué (T-F27) |
| T9 angle sauvé sans défaut (NaN) | survit | survit | tué (T-F27) |
| T10 seuil strict (`<` au lieu de `<=`) | survit | tué | tué (T-F27) |
| **Survivants** | **14 / 14** | **10 / 14** | **0 / 14** |

Témoin sans mutation : les deux versions de T-F26 et T-F27 passent.

### Dérives du jeu (copie jetable de `src/simulation.js`, T-F26 seul)

| Changement dans `src/simulation.js` | T-F26 |
|---|---|
| bornes du tangage à ±1,25 | échoue |
| lacet replié modulo 2π | échoue |
| recul ajouté au tangage dans la même écriture | échoue |
| seconde consommation du regard (`p.yaw+=input.lookX*0`) | échoue |
| témoin : autre lecture du regard, sans écriture d'angle | passe |
| témoin : reformatage de la ligne (espaces) | passe |

## Émulation du raccord sur la vraie simulation

`node docs/chantier-moteur/preuves/module-boucle/etape-2-emulation.mjs` (domaine principal, aucune horloge lue)
écrit `etape-2-emulation.json`, 23 Ko, code de sortie 0, 58 s sur le Mac (charge 2,5 à 2,9). Deux exécutions
donnent le même JSON au champ `loadavg` près. Rien n'est branché : le script émule le plan de raccord (§5 du
document) autour de `sim.step`, avec les outils de `tools/proof` (`createRun`, `drive`, `observeRun`).

Protocole : les 4 scénarios de `tools/proof/scenarios.mjs` × 4 motifs (`60`, `120`, `144`, `jit144`), plus
`legacy-s2` au lance-roquettes (arme 2) à 144 Hz et `jit144`, seul cas où des projectiles existent ; graine 96,
1 800 pas pilotés par FLoop. Le pilote de l'audit tourne la vue en écrivant `state.player.yaw` : cette écriture
est annulée et remplacée par une souris émulée et semée (0,6 rad/s de lacet, le rythme du pilote, et une
oscillation du tangage qui touche les deux bornes). Le regard s'accumule d'image en image et n'est consommé
qu'au premier pas. Quatre traqueurs : joueur, ennemis (`e.x`, `e.baseY`, `e.z`, `e.yaw`), projectiles, débris
structurels.

| Motif | Images (sans pas) | Vue de la simulation seule en retard | `aim` : écarts au bit près | Caméra figée alors que le joueur avance : sans interpolation | avec `track` |
|---|---|---|---|---|---|
| 60 | 1 800 (0) | 0 | 0 | 0 % | 0 |
| 120 | 3 598 (1 798) | 1 798 | 0 | 50,0 % (852 à 1 246 images) | 0 |
| 144 | 4 317 (2 517) | 2 517 | 0 | 58,3 % (1 188 à 2 125) | 0 |
| jit144 | 4 317 (2 517) | 2 517 | 0 | 58,3 % (1 192 à 2 130) | 0 |

Bilan (`checks` du JSON) :
- `aim` : 32 400 pas qui consomment un regard, dont 5 441 avec le tangage en butée : 0 écart (`Object.is`) entre
  l'angle atteint par la simulation et `aim`. Le lacet affiché par `aim` suit la somme de toute la souris reçue à
  8,2e-14 rad près à chaque image ; la vue de la simulation seule a jusqu'à deux images de regard de retard à
  144 Hz (0,012 rad avec cette souris). Aucun pas n'a quitté `step` sans consommer le regard.
- `track` : 0 image figée sur les 18 parties. Déplacement maximal en un pas : joueur 0,40 m, ennemis 0,10 m,
  projectiles 0,40 m, débris structurels 2,25 m. Aucun saut de plus de 2 m sur les 16 parties sans arme lourde ;
  au lance-roquettes, un par partie : le débris structurel 23 soulevé de 2,23 m au pas 287, sans vitesse (correction
  de position de la simulation), rendu à sa pose courante comme le veut le seuil. Entités suivies au plus :
  170 ennemis, 3 projectiles, 128 débris structurels. Sans `id` : jusqu'à 8 balles ennemies et 10 éclats.
- Lecture seule : les 18 parties rejouées sans `aim` ni `track` donnent le même `chainHash` et le même
  `snapshot` : l'affichage ne change pas la simulation.

C'est une émulation sur des horodatages synthétiques, pas une mesure du jeu : aucun gain n'est annoncé pour METAL.

## Le jeu est inchangé

- Fichiers de l'étape : `checks/floop.test.mjs` et `docs/chantier-moteur/modules/boucle.md` modifiés (fichiers
  du module), `etape-2-aim-track.md`, `etape-2-emulation.mjs` et `etape-2-emulation.json` créés ici. Aucun
  fichier du jeu touché.
- `python3 tools/build.py` dans une copie jetable de l'arbre de travail : code 0 ; `dist/index.html` et
  `SIZE.json` identiques à ceux du dépôt (`cmp`) ; 812 696 octets, sha256 `4587dc49…` ; `FLoop` absent de la page.
  `node checks/build.test.mjs` : PASS.
- `npm test` complet sur le Spark (Linux aarch64, Node v24.18.0, `outils/npm-test-spark.sh`) : 470 tests,
  462 réussis, 8 échecs, 132 s de `node --test`. Ce sont les 8 échecs de la référence de l'étape 0 (`not ok 108`
  à `115` de `checks/campaign-world.test.mjs` : six empreintes legacy, graines 1 et 96, secteurs 0 à 2, puis
  « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve historical geometry… »).
  Aucun nouvel échec. `checks/floop.test.mjs` n'est pas dans `npm test` (`package.json` inchangé, raccord).

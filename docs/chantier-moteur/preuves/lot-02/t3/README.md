# Lot 02 / T3 — Sommeil des débris indexé sur la révision, mémo de debrisFloor, debrisBoxes sur le miroir CSR, feuillage à 38 points

## Résultat

**Livré : SIM-03 et LOAD-05 (points 1, 3 et 4), classe « état identique ».** Un gravat au repos sur le sol ou sur un collider statique n'est plus recalculé tant que la révision de destruction ne change pas. L'état reste identique à l'avant, pas à pas et au snapshot final :

- pendant 1 800 pas sur les neuf scénarios `$SC9` ;
- sur `legacy-s2` arme 2, pendant 1 800 et 3 600 pas.

La reprise est identique. Un contrôle en ombre a porté sur 11,85 millions de vérifications de pièces au repos, dont 98,9 % auraient été sautées. Il ne trouve aucun sommeil faux, aucun écart du mémo, de la liste des boîtes ou du feuillage.

Le CPU total de simulation baisse ainsi :

| Mesure | Gain | Seuil |
| --- | --- | --- |
| Roquettes (`legacy-s2` arme 2), médiane de cinq passages appariés | **−46 %** (ratio 0,543), puis **−50 %** (0,497) à charge plus basse | fiche −32 à −34 % ; abandon au-dessus de −16 % |
| `campaign-w10` | −10 %, puis −18 % à charge plus basse | fiche −5 à −11 % |
| Médiane des neuf scénarios | −10 % | |

Les appels à `ground()` baissent de 58 à 81 %. Sur la scène du banc LOAD-05 (huit murs démolis, 128 gravats), `updateDebris` passe de 0,063 à 0,021 ms par pas de repos.

| Élément | Valeur |
| --- | --- |
| Avant | `chantier/lot-02-simulation` à `4e184e9` (T17), export de `src/` (`$PREV`) ; `src/simulation.js` sha256 `f03e2082…`, le même qu'en T2 (`4a06bbf`) |
| Après | arbre T3 ; `src/simulation.js` sha256 `32709a91…`, seul source modifié |
| Machine | Apple M5, 10 cœurs logiques, Node v24.18.0 (`darwin arm64`), partagée (charge 1,2 à 21 pendant les mesures) |
| Domaine | principal de Node pour toutes les mesures (tools/ab2, tools/realm-loader), jamais `node:vm` |

## Ce qui change dans `src/simulation.js` (+58/−12 lignes)

- **Sommeil (l. 1111-1124, 1149-1156 et 1182).** `debrisSleep` est une `WeakMap` qui associe une pièce à une révision.
  - **Mise en sommeil.** Une pièce au repos est inscrite avec `seenDestructionRevision` quand son appui est le sol ou un collider statique (`debrisStaticSupport`).
  - **Saut.** Tant que la révision ne change pas, `updateDebris` saute la pièce. Ce saut vient après la mise à jour de `age` et `impactWait`, qui continuent comme avant.
  - **Réveil.** `delete` quand l'appui manque. Dès que la révision change, la pièce repasse par le chemin complet.
  - **Pièges de sol.** Le sommeil est coupé à chaque pas où `trapStates` contient un piège `kind==='floor'`. Il n'y a aucun compteur global, et les pièges ne comptent que par leur genre.
  - **Commentaire pour le lot 17.** Tout futur support mobile capable de se retirer sous une pièce doit la réveiller (`debrisSleep.delete`).
- **`debrisStaticSupport`.** Il reprend les prédicats de `debrisSupport` (contact à 0,018, recouvrement à 0,002). Il ne les applique qu'au sol et aux boîtes statiques de la liste, celles qui suivent `debrisStaticFrom`.
- **Mémo de `debrisFloor` (l. 1083-1091).** Il garde deux entrées, clés `x`, `z`, `h[0]` et `h[2]`, remises à `NaN` au début de chaque `updateDebris`. Il ne vaut que dans cet appel, où `ground()` ne peut pas changer. `debrisSupport` et `debrisStaticSupport` font donc un seul parcours du sol (LOAD-05 point 4).
- **`debrisBoxes` sur le miroir (l. 1092-1104).**
  - Les boîtes dynamiques filtrées viennent d'abord, puis les statiques, case par case. Chaque boîte n'est prise qu'une fois, grâce aux estampilles `solidStamp` et `solidSerial`.
  - L'ordre est exactement celui de l'ancien `Set`, dont `boxes.find` et les départages de `debrisSweep` dépendent.
  - Le code n'emploie ni `Set` ni `Array.from`, et le tableau de sortie est réutilisé (LOAD-05 point 3).
  - La liste dynamique est toujours calculée une fois par pas.
- **Miroir CSR (l. 286-300).**
  - Il reprend `bancs/sim/mirror.mjs`, placé juste avant `    function syncDestruction(){`, avec ses noms : `mirrorFor`, `mirrorStart`, `mirrorIdx`, `mirrorBox`, `solidStamp`, `solidSerial` et `ensureMirror`.
  - Sa garde porte sur l'identité de `solids` et sur `collisionBuilds`, compteur incrémenté par `rebuildCollision` (l. 276-278).
  - Il est reconstruit au premier usage qui suit un changement, c'est-à-dire après `syncDestruction` ou `restore`.
- **Feuillage (l. 78-79).** Le maximum se calcule en boucle sur les 38 points uniques au lieu des 216. Le texte du prototype est gardé mot pour mot, car T11 s'y ancre.
- **`restore` (l. 2356).** `debrisSleep=new WeakMap()` : le sommeil n'est jamais sauvegardé. `snapshot` est inchangé, et le format de sauvegarde aussi.

**Écarts avec le prototype** (`bancs/sim/debris-v2.mjs` et `mirror.mjs`) :

1. La garde du miroir teste aussi `collisionBuilds`, comme le demande le plan. Une révision qui garderait les mêmes objets reconstruit donc tout de même le miroir.
2. Les pièges de sol sont lus à chaque pas dans `trapStates`, y compris au moment du saut. Le prototype les lisait une fois, à la création, dans `world.traps`. Or `restore` remplace `trapStates`.
3. `debrisStaticSupport` commence à `debrisStaticFrom`, au lieu de chercher chaque boîte avec `dynamic.includes(box)`.
4. `debrisSleep` est déclarée avec `let` et vidée par `restore`. Le prototype la déclarait avec `const` et ne la vidait jamais.
5. Le tableau rendu par `debrisBoxes` est réutilisé.
6. `delete` est aussi appelé quand une pièce se pose. C'est une précaution : aucune entrée ancienne ne survit à un nouveau repos.

## Banc de départ, sur l'état 4e184e9, avant tout code

Ce sont les commandes du plan, lancées avec `METAL_ROOT=$PREV`. Sortie : [`banc-depart.txt`](banc-depart.txt). Le gain se reproduit, et la tâche continue.

| Banc | legacy-s0 | legacy-s2 | campaign-w10 | campaign-w16 | legacy-s2, arme 2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Prototype, `ab2.mjs debris-v2.mjs debrisPatch`, 1 800 pas × 2 : CPU total | −8 % | −25 % | −19 % | −18 % | −50 % |
| Idem, ratio médian par pas | 0,76 | 0,70 | 0,73 | 0,74 | 0,44 |

- **`v05.mjs l:0 8`.** Dix murs sont trouvés. On obtient 128 gravats ; 9 sont éveillés après 10 s, et 8 le sont encore après 70 s. Au mieux, les débris coûtent 0,063 ms par pas : 0,041 ms pour les seuls gravats au repos, 0,022 ms pour ceux qui ne se posent jamais.
- **`v05b.mjs l:0 8`.** Aucun écart sur 23 snapshots, et 581 086 contrôles sautés. Le pas de repos passe de 0,111 à 0,082 ms (−26 %).
- **`sim-verif2/ab.mjs`, `SCEN=2,c9`, 600 pas.** Sur `legacy-s2`, le CPU passe de 543 à 282 ms (−48 %, ratio médian 0,46). Sur `c9`, il passe de 90 à 98 ms (+9 %), et le temps mur de 36 à 36 ms (−1 %). L'état est identique.

Le plan donne `c9` pour `campaign2-w10`. Or `sim-verif2/load.mjs` crée `c9` avec `{campaign:true}`, sans `campaignVersion` : c'est `campaign-w10`, la campagne V1.

## (1) État : tools/ab2, avant contre arbre

Résumés, produits par la ligne `node -e` du plan :

- [`ab2-resume.json`](ab2-resume.json) : les neuf scénarios `$SC9` ;
- [`ab2-resume-w2.json`](ab2-resume-w2.json) : `legacy-s2` arme 2 ;
- [`ab2-resume-w2-3600.json`](ab2-resume-w2-3600.json) : `legacy-s2` arme 2, 3 600 pas.

Les trois exécutions sortent avec le code 0. L'empreinte `fnv1a32-float64le-state-v1` est identique à chaque pas ; elle couvre `rotation`, `angularVelocity`, `age`, `resting`, `settleTime` et `impactWait` des débris. Le SHA-256 du snapshot final est identique, et les variantes restent stables d'un passage à l'autre.

| Scénario | Identique | Chaîne | CPU total avant → après (ms, 2 passages) | Ratio total | Médiane appariée |
| --- | --- | --- | ---: | ---: | ---: |
| legacy-s0 | oui | `576ce3b4` | 399 → 369 | 0,925 | 0,861 |
| legacy-s2 | oui | `54574123` | 407 → 365 | 0,897 | 0,824 |
| campaign-w10 | oui | `6cd12673` | 301 → 273 | 0,906 | 0,803 |
| campaign-w16 | oui | `6de7419e` | 658 → 586 | 0,890 | 0,878 |
| campaign2-w1 | oui | `36b0dc6a` | 549 → 556 | 1,014 | 0,906 |
| campaign2-w7 | oui | `357d17e8` | 285 → 259 | 0,906 | 0,868 |
| campaign2-w10 | oui | `8f6aafe7` | 250 → 232 | 0,927 | 0,894 |
| campaign2-w13 | oui | `7e60456d` | 452 → 433 | 0,959 | 0,842 |
| campaign2-w18 | oui | `89ab7825` | 745 → 603 | 0,808 | 0,798 |
| legacy-s2, arme 2 | oui | `4cb96028` | 1 058 → 555 | 0,524 | 0,446 |
| legacy-s2, arme 2, 3 600 pas | oui | `5d6c3912` | 2 134 → 1 150 | 0,539 | 0,571 |

Sommes de contrôle :

| Exécution | Somme de contrôle |
| --- | --- |
| Neuf scénarios | `bf5552948fb5064839516956db885680cb89de5a2da34733489f9f2f56f24e01` |
| Arme 2 | `4dd7094c6038450cb8bd6121db0eb293b1c6a7da592510e7bf7d0ea44f58ecba` |
| Arme 2, 3 600 pas | `1c2594440fd33e6191e1b723370572c06d3dca33d766719bcccf18a7198a9569` |

Les chaînes et la somme de l'arme 2 sont celles de T2 : la trajectoire n'a pas bougé depuis. Les CPU de ce tableau viennent de deux passages, sous une charge de 2,4 à 4,2. Le gain se lit en (4).

## (2) Reprise : [`reprise.txt`](reprise.txt)

C'est la commande REPRISE du plan, l'avant contre l'arbre : 900 pas, snapshot, JSON, `restore`, puis 600 pas, sur `legacy-s2` (arme 2), `campaign-w10` et `campaign2-w10`. Les six restaurations réussissent. `snapshotSame` et `continuationSame` valent `true` partout. Le snapshot ne contient rien de nouveau.

## (3) Exactitude en ombre : [`exactitude.mjs`](exactitude.mjs), sorties [`exactitude.txt`](exactitude.txt) et [`exactitude.json`](exactitude.json)

L'arbre est chargé dans le domaine principal avec des sondes posées par chaînes exactes. Chaque sonde compare un changement à l'avant :

- **Sommeil.** Une pièce que l'arbre sauterait suit quand même le chemin complet. On compte trois fautes possibles :
  - le chemin complet l'aurait réveillée (sommeil faux) ;
  - il aurait touché `rotation`, `angularVelocity` ou `settleTime` ;
  - l'appui statique a disparu alors que la pièce est endormie.
- **Mémo.** Chaque réponse est comparée, par `Object.is`, à la formule de l'avant.
- **`debrisBoxes`.** La liste est comparée rang par rang, même objet au même rang, à celle de la fonction de l'avant. Le texte de cette fonction est lu dans `$PREV`.
- **Feuillage.** Le maximum sur 38 points est comparé à celui de l'avant sur 216 points.

Comme le chemin complet est suivi, l'état avance comme celui de l'avant. Les scénarios couverts :

- **Pilote de tools/proof.** Les 22 scénarios du catalogue, avec trois armes : arme d'origine sur 1 800 pas, roquettes sur 3 600 pas, grenades sur 1 800 pas. Il y a 44 reprises à mi-course, toutes réussies : 22 dans une simulation neuve (arme d'origine), 22 dans la même simulation (grenades).
- **Démolitions du banc LOAD-05.** Sept scènes : `l:0`, `l:1`, `l:2`, `c:0`, `c:9`, `c:12` et `c:17`. Dans chacune, huit murs sont démolis à la roquette, puis viennent 1 800 pas de marche armée et 600 pas de repos. Les révisions s'enchaînent pendant que les gravats dorment.
- **`debrisHalf` en direct.** L'arbre et l'avant sont comparés sur sept formes × 40 000 tailles et rotations, tirées d'un générateur à graine. Les tirages comprennent ±0, ±π/2, ±π et 3π.

| Contrôle | Volume | Écarts |
| --- | ---: | ---: |
| Pièces au repos vérifiées | 11 850 761 | |
| dont sautées par l'arbre | 11 726 314 (98,9 %) | |
| … que le chemin complet aurait réveillées | | **0** |
| … dont l'état aurait été touché | | **0** |
| … endormies sans appui statique | | **0** |
| `debrisFloor` : réponses du mémo | 31 226 615 sur 50 785 809 appels (61,5 %) | **0** |
| `debrisBoxes` : listes comparées | 13 916 747 | **0** |
| Feuillage, en jeu | 196 218 | **0** |
| `debrisHalf` en direct | 280 000 | **0** |

`FRender.foliageTriangles()` donne 216 points, dont 38 uniques.

## (4) Gain : [`gain-5-passages.json`](gain-5-passages.json) et [`gain-5-passages-w2.json`](gain-5-passages-w2.json)

La mesure passe par tools/ab2 avec `--reps 5` : une chauffe écartée, puis cinq passages mesurés de 1 800 pas. L'ordre AB/BA alterne à chaque pas et à chaque passage. Pour chaque scénario, le gain retenu est la médiane des cinq ratios de CPU total, calculée par [`../t2/resume-gain.mjs`](../t2/resume-gain.mjs). Ces passages redonnent aussi les sommes de contrôle d'identité de (1). La charge est montée à 11,8 pendant les neuf scénarios.

| Scénario | CPU total avant → après (ms, 5 passages) | Ratios des 5 passages | Médiane | Gain | Médiane appariée par pas |
| --- | ---: | --- | ---: | ---: | ---: |
| legacy-s0 | 931 → 869 | 0,83 1,01 0,91 1,08 0,89 | 0,907 | −9 % | 0,845 |
| legacy-s2 | 1 030 → 792 | 0,82 0,77 0,76 0,73 0,77 | 0,768 | −23 % | 0,787 |
| campaign-w10 | 828 → 793 | 0,92 0,89 0,87 1,22 0,90 | 0,904 | −10 % | 0,859 |
| campaign-w16 | 942 → 872 | 0,89 1,01 0,89 0,83 0,99 | 0,890 | −11 % | 0,878 |
| campaign2-w1 | 747 → 713 | 1,19 0,92 0,92 0,89 0,80 | 0,920 | −8 % | 0,856 |
| campaign2-w7 | 635 → 558 | 0,88 0,85 0,90 0,84 0,93 | 0,882 | −12 % | 0,833 |
| campaign2-w10 | 682 → 589 | 0,76 0,82 0,91 0,94 0,91 | 0,908 | −9 % | 0,860 |
| campaign2-w13 | 886 → 803 | 0,83 0,86 0,93 0,98 0,91 | 0,914 | −9 % | 0,831 |
| campaign2-w18 | 1 249 → 1 015 | 0,77 0,83 0,77 0,86 0,83 | 0,827 | −17 % | 0,817 |
| **Médiane des neuf** | | | **0,904** | **−10 %** | |
| **legacy-s2, arme 2** | 8 482 → 4 605 | 0,59 0,56 0,54 0,51 0,47 | **0,543** | **−46 %** | 0,510 |

**Confirmation à charge plus basse (2,1 à 2,7).** Résumés : [`gain-5-passages-w2-bis.json`](gain-5-passages-w2-bis.json) et [`gain-5-passages-w10-bis.json`](gain-5-passages-w10-bis.json).

| Scénario | CPU total avant → après (ms, 5 passages) | Ratios des 5 passages | Médiane | Médiane appariée par pas |
| --- | ---: | --- | ---: | ---: |
| `legacy-s2` arme 2 | 2 206 → 1 109 | 0,55 0,50 0,50 0,49 0,48 | **0,497 (−50 %)** | 0,444 |
| `campaign-w10` | 999 → 839 | 0,87 0,82 0,81 0,89 0,78 | **0,821 (−18 %)** | 0,797 |

La fiche annonçait −32 à −34 % aux roquettes, et l'abandon était fixé sous −16 %. Le gain mesuré, −46 à −50 %, dépasse l'annonce : après T1 et T2, les débris pèsent une part plus grande du pas. Sur `campaign-w10`, la fiche attendait −5 à −11 % ; on mesure −10 % sous forte charge et −18 % sous charge basse. La tâche est gardée.

## (5) Gravats au repos, LOAD-05 : [`repos.mjs`](repos.mjs), sorties [`repos.txt`](repos.txt) et [`repos.json`](repos.json)

C'est la scène du banc LOAD-05 (`v05` et `v05b`) : huit murs démolis à la roquette, 1 800 pas de marche armée, puis 600 pas de repos. L'avant et l'arbre avancent en lockstep avec les mêmes entrées. L'empreinte d'état est égale à chaque pas, et le SHA-256 du snapshot est égal à la fin de chaque phase. On mesure ensuite des blocs de 150 pas de repos, en alternant l'ordre AB/BA à chaque bloc. Il y a onze paires mesurées, après une paire de chauffe. Le temps est pris par `performance.now`, autour de `sim.step` et autour de l'appel `updateDebris(dt)` ; la sonde est la même des deux côtés.

| Scène | Gravats (au repos) | Révision | Pas de repos, médiane (ms) | Ratio médian | `updateDebris`, médiane (ms) | Ratio médian |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `l:0` | 128 (118) | 21 | 0,114 → 0,071 | 0,624 | 0,063 → 0,021 | 0,325 |
| `l:2` | 127 (125) | 18 | 0,186 → 0,134 | 0,706 | 0,063 → 0,008 | 0,121 |
| `c:9` (campaign2-w10) | 128 (113) | 14 | 0,176 → 0,072 | 0,410 | 0,144 → 0,040 | 0,273 |

Ce qui reste du coût vient des pièces éveillées. Parmi elles, les morceaux qui ne se posent jamais relèvent de LOAD-05 point 2, et donc du lot 12.

## Compteurs : [`compteurs.mjs`](compteurs.mjs), sortie [`compteurs.json`](compteurs.json)

Ce sont les sommes du rejeu instrumenté de tools/ab2 (`--reps 1`, avec compteurs), sur 1 800 pas. Le rejeu vérifie aussi l'identité pas à pas. Seul `ground` change. `blocked`, `segmentFree`, `astarPops`, `astarNodes` et `revisions` sont identiques des deux côtés.

| Scénario | Appels à `ground()` avant → après | Ratio |
| --- | ---: | ---: |
| legacy-s0 | 716 971 → 207 096 | 0,289 |
| legacy-s2 | 1 705 517 → 468 437 | 0,275 |
| campaign-w10 | 839 745 → 266 875 | 0,318 |
| campaign-w16 | 891 341 → 308 746 | 0,346 |
| campaign2-w1 | 713 832 → 262 807 | 0,368 |
| campaign2-w7 | 537 430 → 227 185 | 0,423 |
| campaign2-w10 | 516 074 → 222 549 | 0,431 |
| campaign2-w13 | 621 636 → 245 866 | 0,396 |
| campaign2-w18 | 1 365 859 → 339 859 | 0,249 |
| legacy-s2, arme 2 | 2 709 144 → 512 314 | 0,189 |

## Tests

**Quatre tests neufs dans `checks/simulation.test.mjs`.** Les gravats y sont posés directement dans `sim.state.debris`.

1. ***Rubble sleep: a sleeping piece wakes when a revision removes its own support, while other resting pieces keep their exact pose.***
   - Mise en place : deux caisses destructibles portent chacune une pièce, et une troisième pièce repose sur le sol.
   - Une explosion détruit la caisse de gauche. Au pas suivant, sa pièce n'est plus au repos. Les deux autres gardent leur pose exacte (`deepEqual`).
   - La pièce de gauche se repose ensuite sur le sol. On fait sauter la caisse de droite, et sa pièce se réveille à son tour, sous la nouvelle révision.
2. ***Rubble sleep: a piece resting on a lift deck is re-checked every step and follows the deck down.***
   - Une pièce posée sur un monte-charge levé ne dort pas, car un appui dynamique ne suffit pas.
   - Elle suit la descente, à moins de 0,5 m du plateau, et se repose au sol.
3. ***Rubble sleep: a sinking floor trap drops the rubble resting on it, as nothing sleeps while a floor trap exists.*** Le piège de sol est déclenché par le joueur. Pendant qu'il s'enfonce, la pièce tombe sous −0,6 m.
4. ***Rubble sleep: restored resting rubble is revalidated at its first step, as sleep is never saved.***
   - Dans un snapshot, un rail au repos est relevé de 0,02 m. C'est dans la tolérance de 0,03 m de `restore`, mais au-delà du contact de 0,018 m.
   - On restaure ce snapshot dans une simulation neuve, puis dans la même. Au premier pas, la pièce n'est plus au repos. Elle se repose ensuite à moins de 0,005 m de sa hauteur d'origine.

Le test d'origine *settled wreckage wakes and falls when its real supporting platform is destroyed* passe toujours.

**Tests de mutation : [`mutations.mjs`](mutations.mjs), sortie [`mutations.txt`](mutations.txt).** Cinq fautes sont injectées dans `src/simulation.js` :

- sommeil sur tout appui ;
- sommeil sans révision ;
- sommeil malgré un piège de sol ;
- mémo gardé d'un pas à l'autre ;
- appui statique qui compte les boîtes dynamiques.

Chacune fait échouer au moins un des cinq tests visés, alors que l'arbre intact les passe tous. L'avant, qui n'a pas de sommeil, passe aussi les cinq. Deux fautes ne sont détectables par aucun test : l'oubli de la remise à zéro dans `restore`, et l'oubli du `delete` quand une pièce se pose. `restore` crée de nouveaux objets, qui ne sont donc pas dans l'ancienne `WeakMap`, et aucun code extérieur ne remet `resting` à `false`. Ces deux lignes sont des précautions.

**Suite complète.**

- **`npm test` (Spark, sur l'arbre du commit).** 490 tests, 482 réussis, 8 échecs, en 138 s. Ce sont les 8 échecs admis de `checks/campaign-world.test.mjs` :
  - six *legacy seed 1 / 96, sector 0 à 2: exact pre-campaign world fingerprint* ;
  - *campaign mode is strictly opt-in…* ;
  - *the first three campaign worlds preserve historical geometry…*.

  La base 4e184e9 était à 478/486 : les quatre tests neufs passent, et aucun autre échec n'apparaît. Journal : [`npm-test.log.gz`](npm-test.log.gz), chemins remplacés par `<arbre>`.
- **`python3 tools/build.py`, puis `node checks/build.test.mjs`.** PASS, sans ressource externe.
- **Taille.**

  | Fichier | Avant (octets) | Après (octets) | Écart |
  | --- | ---: | ---: | ---: |
  | `dist/index.html` | 822 198 | 826 692 | +4 494 |
  | `dist/index.html` en gzip | 248 998 | 250 652 | +1 654 |
  | `simulation.js` | 211 069 | 215 563 | +4 494 |

  Les 4 494 octets ajoutés se décomposent en 1 618 octets de commentaires et 2 876 octets de code net.

## À confirmer par David

1. **Pièges de sol.** Le sommeil est coupé à chaque pas où un piège `kind==='floor'` est listé. Le prototype le coupait une fois, à la création. D'après T2, aucun monde généré n'a de piège de sol, donc le jeu ne perd rien aujourd'hui. **Valeur par défaut : garder.**
2. **Miroir reconstruit au premier usage.** Le plan dit de le reconstruire après `syncDestruction` et après `restore`. Ici, il l'est à la première requête qui suit, ce qui donne le même résultat. **Valeur par défaut : garder.**
3. **Feuillage.** La boucle ignorerait un `NaN` que `Math.max` propagerait. Ce cas est inaccessible : les tailles sont validées finies, et les rotations viennent d'`atan2` sur des valeurs finies ou sont validées par `restore`. Le texte du prototype est gardé mot pour mot pour T11. **Valeur par défaut : accepter.**

## À vérifier sur du vrai matériel

Seul Node a été mesuré, dans le domaine principal, sur un Mac M5 (V8 13.6, celui de Chrome). L'exactitude ne dépend pas du moteur JavaScript : le sommeil, le mémo et les listes ne changent que le nombre d'appels, pas l'arithmétique.

Le gain reste à confirmer :

- dans une vraie page, au temps d'image ;
- sur téléphone (Safari et JavaScriptCore, Chrome Android) ;
- sur Firefox (SpiderMonkey) ;
- sur un PC Windows avec carte NVIDIA.

C'est surtout utile dans les images à plusieurs sous-pas, après une démolition. Le rendu des débris (`effects.js`) ne change pas.

## Notes pour la suite

- **Bancs.** Après ce commit, les bancs prennent `debrisV2`, `blockedV2` et `rayV2`, ou `METAL_ROOT=$BASE71`.
  - `blockedPatch` et `rayPatch` lèvent `Identifier 'mirrorFor' has already been declared`, comme prévu.
  - `blockedV2`, `rayV2` et les deux ensemble s'appliquent à l'arbre T3, se chargent et gardent un état identique sur 600 pas (`legacy-s2` et `campaign2-w10`, arme 2). Ce n'est qu'un contrôle d'ancres ; la preuve revient à T6 et T8.
  - `segmentV2` ne s'applique plus depuis T1. Son ancre `if(blocked(ax,az,r)||blocked(bx,bz,r))return false;` existe sur 71eca61, mais plus sur 4e184e9.
- **T6 et T8.** `mirrorBox` copie les bornes au moment de la construction. `debrisBoxes`, lui, lit les boîtes vivantes (`solids[n]`) et n'emploie que `mirrorStart` et `mirrorIdx`. Une boîte modifiée en place sans `rebuildCollision` désaccorderait `mirrorBox` ; aujourd'hui, la destruction remplace le tableau.
- **Lot 03.** Il gardera l'identité des boîtes et invalidera par révision. Il devra appeler `rebuildCollision`, ou incrémenter `collisionBuilds`, à chaque changement des seaux, pour que le miroir suive.
- **Lot 12 (LOAD-05 point 2, morceaux coincés).** Sur la scène LOAD-05, 8 morceaux sur 128 sont encore éveillés après 70 s (banc de départ). Avec les autres pièces éveillées, ils forment l'essentiel du coût restant de `updateDebris`, soit 0,021 ms par pas sur `l:0`. T3 ne change pas le format de sauvegarde.
- **T11 (`debrisFast`).** Le correctif de `bancs/reste/debrisfast.mjs` s'applique à l'arbre T3, avec ses deux remplacements.
- **Lot 17.** Un support mobile (corps portés, plateformes) doit réveiller les pièces qu'il portait, avec `debrisSleep.delete` : voir le commentaire au-dessus de `debrisSleep`.
- **Lot 14 (relief destructible).** Le sommeil suppose des sols figés entre deux révisions. Un changement de sol qui ne passe pas par une révision de destruction devra vider `debrisSleep`, ou réveiller les pièces de la zone touchée.
- **T10 (hypot).** Les `Math.hypot` de `updateDebris` ne s'exécutent plus que pour les pièces éveillées.
- **Plan.** `c9` de `sim-verif2` est `campaign-w10` (V1), pas `campaign2-w10`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `banc-depart.txt` | banc de départ du plan, sur l'état 4e184e9 |
| `ab2-resume.json`, `ab2-resume-w2.json`, `ab2-resume-w2-3600.json` | résumés tools/ab2 : neuf scénarios, arme 2, arme 2 sur 3 600 pas |
| `reprise.txt` | reprise, avant contre arbre |
| `exactitude.mjs`, `.txt`, `.json` | contrôle en ombre du sommeil, du mémo, des boîtes et du feuillage |
| `gain-5-passages.json`, `gain-5-passages-w2.json` | gain sur 5 passages : neuf scénarios, arme 2 |
| `gain-5-passages-w2-bis.json`, `gain-5-passages-w10-bis.json` | confirmation à charge plus basse |
| `repos.mjs`, `.txt`, `.json` | gravats au repos (scène LOAD-05), apparié |
| `compteurs.mjs`, `compteurs.json` | appels à `ground()` et autres compteurs du rejeu de tools/ab2 |
| `mutations.mjs`, `mutations.txt` | tests de mutation des tests neufs |
| `npm-test.log.gz` | journal de `npm test` (Spark) |

## Commandes

Elles se lancent depuis la racine de l'arbre. `T` est un dossier temporaire, et `PREV=$T/prev-t3` vaut `git archive 4e184e9 src`. `S` est le dossier de session de l'orchestrateur, où se trouve la version réparée de `variants.mjs` du plan.

```sh
W='--import=data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'
B=docs/chantier-moteur/bancs
SC9=legacy-s0,legacy-s2,campaign-w10,campaign-w16,campaign2-w1,campaign2-w7,campaign2-w10,campaign2-w13,campaign2-w18
# Banc de départ, avant tout code
export METAL_ROOT=$PREV
STEPS=1800 REPS=2 node $B/sim/ab2.mjs debris-v2.mjs debrisPatch
WEAPON=2 SCEN=legacy-s2 STEPS=1800 REPS=2 node $B/sim/ab2.mjs debris-v2.mjs debrisPatch
node $B/load-verif2/v05.mjs l:0 8
node $B/load-verif2/v05b.mjs l:0 8
SCEN=2,c9 STEPS=600 node $B/sim-verif2/ab.mjs $S/lot02c/variants.mjs debris
unset METAL_ROOT
# (1) État, puis la ligne node -e du plan pour les résumés
node $W tools/ab2.mjs $PREV . --scenario $SC9 --no-counters --out $T/ab2-t3.json
node $W tools/ab2.mjs $PREV . --scenario legacy-s2 --weapon 2 --no-counters --out $T/ab2-t3-w2.json
node $W tools/ab2.mjs $PREV . --scenario legacy-s2 --weapon 2 --steps 3600 --no-counters --out $T/ab2-t3-w2-3600.json
# (2) Reprise : la commande REPRISE du plan, avec $PREV . 900 600 legacy-s2,campaign-w10,campaign2-w10
# (3) Exactitude en ombre
node docs/chantier-moteur/preuves/lot-02/t3/exactitude.mjs . $PREV --json $T/exactitude.json
# (4) Gain sur 5 passages
node $W tools/ab2.mjs $PREV . --scenario legacy-s2 --weapon 2 --reps 5 --no-counters --out $T/ab2-gain5-w2.json
node $W tools/ab2.mjs $PREV . --scenario $SC9 --reps 5 --no-counters --out $T/ab2-gain5.json
node docs/chantier-moteur/preuves/lot-02/t2/resume-gain.mjs $T/ab2-gain5.json
# (5) Gravats au repos
node docs/chantier-moteur/preuves/lot-02/t3/repos.mjs $PREV . 12 l:0,l:2,c:9
# Compteurs
node $W tools/ab2.mjs $PREV . --scenario $SC9 --reps 1 --out $T/ab2-compteurs.json
node $W tools/ab2.mjs $PREV . --scenario legacy-s2,campaign-w10 --weapon 2 --reps 1 --out $T/ab2-compteurs-w2.json
node docs/chantier-moteur/preuves/lot-02/t3/compteurs.mjs $T/ab2-compteurs.json $T/ab2-compteurs-w2.json
# Mutations
node docs/chantier-moteur/preuves/lot-02/t3/mutations.mjs . $T/mutations $PREV
```

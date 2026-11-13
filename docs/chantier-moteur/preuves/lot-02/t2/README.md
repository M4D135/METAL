# Lot 02 / T2 — ground() en SoA, sous-grille de 2 m

## Résultat

**Livré : SIM-02, classe « état identique ».** `ground()` lit désormais une copie typée des sols, rangée dans des cases de 2 m emboîtées dans les seaux de 8 m. Sur 49,7 millions de points et 1,98 million de listes de pièges, il rend exactement la valeur de l'avant (`Object.is`, donc `-0` et `NaN` compris). Sur 6,86 millions d'appels réels, relevés pendant les rejeux des scénarios, l'écart est nul aussi. L'état est identique à l'avant pendant 1 800 pas sur onze scénarios et sur `legacy-s2` arme 2, pas à pas et au snapshot final. La reprise est identique.

Le CPU total de simulation baisse de **17 à 42 %** selon le scénario, **médiane −26 %** (ratio 0,738). La mesure porte sur cinq passages appariés de 1 800 pas, sur onze scénarios ; `legacy-s2` arme 2 baisse de 24 à 27 %. La fiche annonçait −14 à −29 %, et le seuil d'abandon était un ratio de 0,93. Un appel coûte 10 à 13 ns au lieu de 21 à 77 ns.

| Élément | Valeur |
| --- | --- |
| Avant | `chantier/lot-02-simulation` à `51a85e9` (T1), export de `src/` ; `src/simulation.js` sha256 `985aa31c…` |
| Après | arbre T2 ; `src/simulation.js` sha256 `f03e2082…`, seul source modifié |
| Machine | Apple M5, 10 cœurs logiques, Node v24.18.0 (`darwin arm64`), partagée (charge 1,6 à 3,0) |
| Domaine | principal de Node pour toutes les mesures (tools/realm-loader.mjs, bancs/load-verif2 ou bancs/sim/fast.mjs), jamais `node:vm` |

## Ce qui change dans `src/simulation.js` (+64/−11 lignes)

`indexFloors()` construit l'index à la création :

- **SoA.** `gFX`, `gFZ`, `gHW` (= w/2+1e-7), `gHD`, `gFY` (= y‖0), `gSX`, `gSZ` en `Float64Array`, et `gFK` en `Uint8Array` (0 plat, 1 rampe, 2 substrat ou repli). `world.walkable` n'est jamais écrit : l'empreinte du monde ne bouge pas.
- **Cases de 2 m.** Elles sont rangées en CSR (`gStart`, `gCells`) et emboîtées dans les seaux de 8 m. Les candidats d'une case sont les sols de son seau parent dont la boîte, élargie de 1e-6, touche la case. Un sol n'est écarté d'une case, ou jugé la couvrir, que si sa boîte et la case sont finies et sous 2^24 m : la marge dépasse alors toute erreur d'arrondi.
- **Plats d'abord, du plus haut au plus bas** (tri stable). Quand tous les plats candidats ont un centre et une hauteur finis, le premier qui contient le point donne la réponse, sans balayage.
- **`gTop`.** Il vaut la hauteur d'un plat le plus haut qui couvre toute la case, à 1e-6 près : la réponse est alors immédiate. Sinon, il donne la réponse quand aucun plat ne contient le point : rien du tout (−∞), ou la hauteur d'un substrat plat qui couvre la case et domine les autres, sans rampe autour. `NaN` demande le balayage.
- **`groundScan()`** garde l'arithmétique et la priorité d'origine : plat, puis rampe, puis substrat ou repli. Il balaie la case, ou tous les sols hors de la grille.
- **Pièges.** La liste filtrée `kind==='floor'` est mise en cache par identité et par longueur du tableau reçu. La boucle d'origine est gardée, dans le même ordre. Aucun monde généré n'a de piège de sol.
- **Reconstruction.** L'index, `floorBuckets` compris, est reconstruit dès que la liste des sols change d'identité ou de longueur. Le lot 14 rendra le relief destructible aux explosifs. Un code qui modifiera un sol en place devra appeler `indexFloors()`.
- **`floorBuckets`** reste servi à `fallbackLanding` et à `beneathTerrain`. Toutes deux appellent `ground()` avant de le lire, donc après une éventuelle reconstruction. `groundAt` passe par `ground()`.

La ligne `function ground(x,z,activeTraps=trapStates){` est inchangée. C'est l'ancre de `tools/proof/instrument.mjs` : le rejeu à compteurs de tools/ab2 passe.

**Écarts avec le prototype** (`bancs/sim/ground-v2.mjs`) :

1. Plats triés et `gFlats` : une case sans plat couvrant n'est plus balayée en entier.
2. `gTop` sert aussi aux cases et aux points sans plat.
3. La case vient de `Math.floor(x/8*4)` et non de `x/2`. Elle tombe ainsi toujours dans le seau que choisit l'index de 8 m, même pour les sous-normaux. La variante `x/2` diverge, par exemple à x = −1,5e-323 ; le test neuf la détecte.
4. Garde 2^24 m sur l'exclusion et la couverture. Le prototype les appliquait à tous les sols, même à ceux dont les bornes dépassent la précision de la marge.
5. Reconstruction quand la liste change ; le prototype construisait une seule fois.

## Banc de départ, sur l'état T1, avant tout code

| Banc | legacy-s0 | legacy-s2 | campaign-w10 | campaign-w16 |
| --- | ---: | ---: | ---: | ---: |
| Prototype, `ab2.mjs ground-v2.mjs groundPatch 2`, 1 800 pas : CPU total | −19 % | −34 % | −26 % | −27 % |
| Idem, ratio médian par pas | 0,79 | 0,66 | 0,74 | 0,73 |
| Prototype, `ground-equiv.mjs 2` : écarts | 0 | 0 | 0 | 0 |
| Idem, gain par appel sur points uniformes | ×4,03 | ×3,29 | ×3,39 | ×3,23 |

Sorties : [`banc-depart-ab2.txt`](banc-depart-ab2.txt) et [`banc-depart-equiv.txt`](banc-depart-equiv.txt). Le gain de la fiche se reproduit. La mesure prise avant l'écriture du code donnait −17, −34, −26 et −29 % ; celle du tableau, refaite sur le même état juste avant le commit, la confirme.

## (1) Équivalence de `ground()` : [`ground-equiv2.mjs`](ground-equiv2.mjs)

C'est une copie à deux racines de `bancs/sim/ground-equiv.mjs`. Elle charge l'avant et l'arbre par `loadFast({srcDir})` de `bancs/load-verif2/lib.mjs`, et compare `sim.ground(x,z[,pièges])` par `Object.is`. Une exception doit être la même des deux côtés.

- La suite de `ground-equiv` est inchangée : générateur, points, listes de pièges et chronométrage. Elle porte sur les quatre scénarios historiques, soit 6,21 à 6,34 M points et 300 000 listes de pièges par scénario.
- S'y ajoutent, avec un générateur séparé :
  - les 18 mondes de la campagne V2, environ 1 M points et 30 000 listes de pièges chacun ;
  - des coordonnées minuscules et sous-normales ;
  - treize mondes synthétiques aux sols hostiles : vide, champs absents, égalités, rampes, repli sans substrat, zéros signés, NaN et infinis, sols énormes, tailles négatives, sols hors des bornes, bords posés à 1e-7 d'une frontière de case.
- **Total : 49 712 846 points et 1 980 000 listes de pièges, 0 écart.** Sorties : [`ground-equiv2.txt`](ground-equiv2.txt) et [`ground-equiv2.json`](ground-equiv2.json). Un second passage, juste avant le commit, donne de nouveau 0 écart.
- Coût par appel, médiane de 5 : 66 à 71 ns contre 14,8 à 16,2 ns sur points uniformes (×4,2 à ×4,8) ; 78 à 82 ns contre 19,8 à 21,8 ns sur points de trace (×3,6 à ×4,0).

**Les vrais appels : [`appels-reels.mjs`](appels-reels.mjs).** L'avant, instrumenté en mémoire, relève les arguments de chaque appel de `ground()` pendant 1 800 pas : quatre scénarios, plus `legacy-s2` arme 2. Ces 6 862 718 appels sont rejoués sur l'avant et sur l'arbre, avec 0 écart. Sorties : [`appels-reels.txt`](appels-reels.txt) et [`appels-reels-ordre-inverse.txt`](appels-reels-ordre-inverse.txt).

| Scénario | Appels | ns par appel, avant → arbre (ordre inverse) | Sans balayage de case |
| --- | ---: | ---: | ---: |
| legacy-s0 | 716 971 | 20,6 → 10,4 (77,2 → 13,0) | 95,4 % |
| legacy-s2 | 1 705 517 | 67,2 → 11,5 (72,5 → 12,8) | 96,0 % |
| campaign-w10 | 839 745 | 63,2 → 11,5 (68,0 → 11,9) | 88,9 % |
| campaign-w16 | 891 341 | 67,9 → 11,7 (67,9 → 12,5) | 92,7 % |
| legacy-s2, arme 2 | 2 709 144 | 66,3 → 12,9 (64,5 → 12,2) | 79,2 % |

La boucle d'objets de l'avant ralentit à mesure qu'elle voit les sols d'autres mondes : ses lectures deviennent mégamorphes. `legacy-s0`, joué en premier, en montre le meilleur cas, soit un ratio de 0,51. Une page de jeu crée plusieurs mondes au fil d'une session. Aucun appel ne tombe hors de la grille. Un appel teste en moyenne 0,40 à 0,59 plat, et un balayage 1,0 à 2,0 candidat.

## (2) État : tools/ab2, avant contre arbre

Résumés : [`ab2-resume.json`](ab2-resume.json) (onze scénarios) et [`ab2-resume-w2.json`](ab2-resume-w2.json) (`legacy-s2` arme 2). Ils sont produits par la ligne `node -e` du plan. Les deux exécutions sortent avec le code 0 : empreinte `fnv1a32-float64le-state-v1` identique à chaque pas, SHA-256 identique au snapshot final, variantes stables entre les passages.

| Scénario | Identique | Chaîne | CPU total avant → après (ms, 2 passages) | Ratio total | Médiane appariée |
| --- | --- | --- | ---: | ---: | ---: |
| legacy-s0 | oui | `576ce3b4` | 581 → 491 | 0,845 | 0,851 |
| legacy-s2 | oui | `54574123` | 735 → 530 | 0,720 | 0,710 |
| campaign-w10 | oui | `6cd12673` | 504 → 422 | 0,837 | 0,759 |
| campaign-w16 | oui | `6de7419e` | 542 → 408 | 0,753 | 0,760 |
| campaign2-w1 | oui | `36b0dc6a` | 335 → 244 | 0,727 | 0,733 |
| campaign2-w5 | oui | `9d97be87` | 796 → 463 | 0,583 | 0,574 |
| campaign2-w7 | oui | `357d17e8` | 382 → 294 | 0,769 | 0,758 |
| campaign2-w9 | oui | `8057719c` | 452 → 318 | 0,703 | 0,691 |
| campaign2-w10 | oui | `8f6aafe7` | 342 → 268 | 0,784 | 0,807 |
| campaign2-w13 | oui | `7e60456d` | 412 → 340 | 0,824 | 0,826 |
| campaign2-w18 | oui | `89ab7825` | 552 → 446 | 0,808 | 0,767 |
| legacy-s2, arme 2 | oui | `4cb96028` | 1 434 → 1 082 | 0,755 | 0,745 |

Sommes de contrôle : `c99c9f5fab27d2ab6da432496d7f03b0174ed8f01f2cac1c61ce2e54e4e6a23d` pour les onze scénarios, `4dd7094c6038450cb8bd6121db0eb293b1c6a7da592510e7bf7d0ea44f58ecba` pour l'arme 2. La seconde a été reproduite à l'identique juste avant le commit. `$SC11` désigne les neuf scénarios `$SC9` du plan, plus `campaign2-w5` et `campaign2-w9`, déjà mesurés en T1.

## (3) Reprise : [`reprise.txt`](reprise.txt)

C'est la commande REPRISE du plan, l'avant contre l'arbre : 900 pas, snapshot, JSON, `restore`, puis 600 pas. Sur `legacy-s2` (arme 2), `campaign-w10` et `campaign2-w10`, les deux restaurations réussissent. Les snapshots sont identiques (`snapshotSame`), et les continuations restaurées aussi (`continuationSame`). Un second passage juste avant le commit redonne le même fichier, octet pour octet. Le snapshot ne contient rien de nouveau ; son format est inchangé.

## (4) Gain : [`gain-5-passages.json`](gain-5-passages.json)

La mesure passe par tools/ab2 avec `--reps 5` : une chauffe écartée, puis cinq passages mesurés de 1 800 pas. L'ordre AB/BA alterne à chaque pas et à chaque passage. Pour chaque scénario, le gain retenu est la médiane des cinq ratios de CPU total. Ce passage redonne aussi la somme de contrôle d'identité de (2), `c99c9f5f…` : l'état est identique sur les onze scénarios, à chacun des cinq passages.

| Scénario | CPU total avant → après (ms, 5 passages) | Ratios des 5 passages | Médiane | Gain |
| --- | ---: | --- | ---: | ---: |
| legacy-s0 | 1 299 → 1 069 | 0,80 0,88 0,90 0,78 0,76 | 0,800 | −20 % |
| legacy-s2 | 1 874 → 1 239 | 0,63 0,67 0,67 0,67 0,67 | 0,668 | −33 % |
| campaign-w10 | 1 171 → 896 | 0,80 0,73 0,72 0,74 0,83 | 0,738 | −26 % |
| campaign-w16 | 1 185 → 896 | 0,78 0,72 0,77 0,74 0,76 | 0,761 | −24 % |
| campaign2-w1 | 1 071 → 812 | 0,80 0,86 0,71 0,73 0,66 | 0,732 | −27 % |
| campaign2-w5 | 1 919 → 1 111 | 0,59 0,57 0,58 0,59 0,57 | 0,577 | −42 % |
| campaign2-w7 | 847 → 711 | 0,84 0,81 0,78 0,80 0,95 | 0,811 | −19 % |
| campaign2-w9 | 1 236 → 935 | 0,70 0,79 0,88 0,69 0,72 | 0,717 | −28 % |
| campaign2-w10 | 805 → 638 | 0,74 0,82 0,79 0,81 0,81 | 0,806 | −19 % |
| campaign2-w13 | 983 → 812 | 0,83 0,80 0,79 0,84 0,87 | 0,830 | −17 % |
| campaign2-w18 | 1 486 → 1 084 | 0,71 0,65 0,72 0,72 0,86 | 0,724 | −28 % |
| **Médiane des onze** | | | **0,738** | **−26 %** |

Pour `legacy-s2` arme 2, la preuve d'état (deux passages mesurés) donne un ratio de 0,755. Refaite juste avant le commit, elle donne 0,729, avec des passages à 0,739 et 0,717. Les ratios médians par pas vont de 0,57 à 0,82. Sur les quatre scénarios historiques, l'arbre fait aussi bien que le prototype : −20, −33, −26 et −24 %, contre −19, −34, −26 et −27 % au banc de départ, sur un autre banc.

La fiche annonçait −14 à −29 % (gain corrigé de la contre-vérification). Le gain est reproduit, et le seuil d'abandon (ratio au-dessus de 0,93) n'est pas atteint : la tâche est gardée.

## Index : taille et coût ([`index.mjs`](index.mjs), sortie [`index.txt`](index.txt))

- Sur les 42 mondes générés (6 classiques, 18 de la campagne V1, 18 de la V2, graine 96) : 24 à 28 sols, 6 400 à 7 776 cases de 2 m et 8 546 à 10 101 candidats. Les tableaux typés pèsent **119 à 143 Ko** par simulation. 80,9 à 82,8 % des cases répondent sans aucun test, 8,0 à 10,7 % testent leurs plats d'abord, et 6,9 à 10,4 % sont balayées.
- `indexFloors()` prend 0,45 à 0,64 ms en médiane par création, 3,7 ms au plus. Dans un processus neuf, la première fois, il prend 2,4 à 3,5 ms.
- `FSimulation.create`, en médiane de 10 créations alternées, passe de 17,50 à 15,18 ms (`legacy-s0`), de 19,72 à 16,31 ms (`legacy-s2`) et de 15,88 à 13,95 ms (`campaign-w10`). Il monte de 15,95 à 17,12 ms sur `campaign-w16`. Dans un processus neuf, sur `legacy-s2` : 35,8 à 37,0 ms avant, 33,9 à 34,5 ms après. La grille de navigation, construite à la création, appelle `ground()` pour chaque cellule ; cela compense le coût de l'index.

## Tests

**Deux tests neufs dans `checks/simulation.test.mjs`.**

1. *ground() answers exactly like a scan of its 8 m bucket, on floor edges, cell borders and odd values*. `referenceGround` redit la règle d'avant, sans index. Le test la compare à `ground()` par `Object.is`, sur plus de 60 000 points (seuil du test). Il couvre deux mondes synthétiques conçus pour mettre l'index en défaut, un monde sans sol et deux mondes générés. Les points sont tirés sur les bords de sols (±1e-7, ±ulp, ±1e-6), sur les frontières de cases de 2 et de 8 m et sur des valeurs extrêmes (sous-normaux, NaN, ±∞, 1e300). Les listes de pièges sont celles de l'état et des listes explicites.
2. *ground() follows the floor list and the trap list it reads, including restored traps*. Il vérifie le suivi d'un sol ajouté puis retiré, d'un piège qui bouge en place et d'une autre liste qu'on allonge. Après un `restore`, ce sont les pièges restaurés qui comptent.

**Tests de mutation : [`mutations.mjs`](mutations.mjs), sortie [`mutations.txt`](mutations.txt).** Quatorze fautes sont injectées dans `src/simulation.js` : marge nulle, case par `x/2`, plats non finis admis, garde 2^24 supprimée, rampe avant plat, tri inversé, substrat sans couverture, substrat malgré les rampes, cache des pièges par longueur seule ou par identité seule, cache des sols par identité seule, retour à 0 supprimé, bord strict, rien hors de la grille. Chacune fait échouer au moins un des deux tests, alors que l'arbre intact passe les deux. Sur l'avant, le test 1 passe et le test 2 échoue sur le sol ajouté : l'avant n'indexait les sols qu'à la création.

**Suite complète.**

- `npm test`, lancé sur le Spark sur l'arbre du commit : 475 tests, 467 réussis, 8 échecs, en 131 s. Ce sont les 8 échecs admis de `checks/campaign-world.test.mjs` : six *legacy seed 1 / 96, sector 0 à 2: exact pre-campaign world fingerprint*, puis *campaign mode is strictly opt-in…* et *the first three campaign worlds preserve historical geometry…*. La base T1 était à 465/473 : les deux tests neufs passent, et il n'y a aucun échec de plus. Journal : [`npm-test.log.gz`](npm-test.log.gz), chemins remplacés par `<arbre>`.
- `python3 tools/build.py`, puis `node checks/build.test.mjs` : PASS, sans ressource externe. Reconstruire redonne les mêmes octets.
- `dist/index.html` passe de 816 177 à 821 387 octets (+5 210), et de 246 600 à 248 706 octets en gzip (+2 106). `simulation.js` passe de 205 859 à 211 069 octets. La fiche estimait 1,9 Ko pour le prototype. L'ajout se compose de 1 611 octets de commentaires et de 3 599 octets de code net. Ce code comprend deux raccourcis exacts de plus que le prototype, et la reconstruction.

## À confirmer par David

1. **L'index suit la liste des sols.** L'avant indexait les sols une seule fois, à la création : un sol ajouté ensuite n'était trouvé qu'hors de la grille. Désormais, ajout et retrait sont suivis (test 2). Aujourd'hui, rien ne modifie `world.walkable` après la création, donc le jeu ne change pas. Pour le lot 14, une modification en place d'un sol devra appeler `indexFloors()`. **Valeur par défaut : garder.**
2. **Mémoire.** L'index pèse 119 à 143 Ko par simulation, et non « quelques Ko » comme le dit la fiche. Le prototype a les mêmes tableaux par case, du même ordre de taille. **Valeur par défaut : accepter.**
3. **Taille.** +5,2 Ko bruts, contre +1,9 Ko estimés. **Valeur par défaut : accepter**, puisque la page reste à 821 Ko pour un budget de 1 400 000 octets.

## À vérifier sur du vrai matériel

Seul Node, dans le domaine principal, a été mesuré, sur un Mac M5 (V8 13.6, celui de Chrome). L'exactitude ne dépend pas du moteur JavaScript. Le code n'emploie que des opérations IEEE-754 et des comparaisons, `Math.floor`, `Math.max` selon la spécification et des multiplications exactes par 4. Le gain reste à confirmer sur téléphone (Safari et JavaScriptCore, Chrome Android), sur Firefox (SpiderMonkey) et sur un PC Windows. Le coût d'une boucle d'objets mégamorphe et celui des tableaux typés y diffèrent. La contre-vérification de SIM-02 rappelle que l'intérêt réel est sur mobile, et dans les images à plusieurs sous-pas.

## Notes pour la suite

- **T3 et T6.** T3 met les débris au repos en sommeil, et T6 passe le sol déjà connu à `blocked`. Toutes deux réduisent le nombre d'appels à `ground()` : leurs gains ne s'additionnent pas à celui-ci. Elles se mesurent contre le commit de T2.
- **Lot 14, relief destructible.** Remplacer la liste, ou lui ajouter ou retirer un sol, reconstruit l'index au prochain appel de `ground()`, `floorBuckets` compris. Une modification en place d'un sol doit appeler `indexFloors()`. Une reconstruction coûte environ 0,5 ms. Si chaque explosion en déclenche une, prévoir une mise à jour locale des seules cases touchées.
- **Lot 12.** T2 ne change pas le format de sauvegarde : rien à reporter.
- `floors` est une constante liée à `world.walkable`. Le test d'identité ne servira que si elle devient réassignable.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `banc-depart-ab2.txt`, `banc-depart-equiv.txt` | banc de départ du prototype, sur l'état T1 |
| `ground-equiv2.mjs`, `.txt`, `.json` | équivalence de `ground()` à deux racines, 49,7 M points |
| `appels-reels.mjs`, `appels-reels*.txt` | rejeu des appels réels, coût par appel, chemins pris |
| `ab2-resume.json`, `ab2-resume-w2.json` | résumés de tools/ab2 : état, onze scénarios et arme 2 |
| `reprise.txt` | reprise avant contre arbre |
| `resume-gain.mjs`, `gain-5-passages.json` | gain de CPU total sur 5 passages appariés |
| `index.mjs`, `index.txt` | taille et coût de l'index, 42 mondes |
| `mutations.mjs`, `mutations.txt` | tests de mutation des deux tests neufs |
| `npm-test.log.gz` | journal de `npm test` (Spark) |

## Commandes

Lancées depuis la racine de l'arbre. `T` est un dossier temporaire, et `PREV=$T/prev-t2` vaut `git archive 51a85e9 src`.

```sh
W='--import=data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'
SC11=legacy-s0,legacy-s2,campaign-w10,campaign-w16,campaign2-w1,campaign2-w5,campaign2-w7,campaign2-w9,campaign2-w10,campaign2-w13,campaign2-w18
# Banc de départ, avant tout code
(cd docs/chantier-moteur/bancs/sim && METAL_ROOT=$PREV STEPS=1800 REPS=2 node ab2.mjs ground-v2.mjs groundPatch 2)
(cd docs/chantier-moteur/bancs/sim && METAL_ROOT=$PREV node ground-equiv.mjs 2)
# (1) Équivalence et appels réels
node docs/chantier-moteur/preuves/lot-02/t2/ground-equiv2.mjs $PREV . --json $T/ground-equiv2.json
node docs/chantier-moteur/preuves/lot-02/t2/appels-reels.mjs $PREV .
node docs/chantier-moteur/preuves/lot-02/t2/appels-reels.mjs $PREV . --ordre-inverse
# (2) État, puis la ligne node -e du plan pour les résumés
node $W tools/ab2.mjs $PREV . --scenario $SC11 --no-counters --out $T/ab2-t2.json
node $W tools/ab2.mjs $PREV . --scenario legacy-s2 --weapon 2 --no-counters --out $T/ab2-t2-w2.json
# (3) Reprise : la commande REPRISE du plan, avec $PREV . 900 600 legacy-s2,campaign-w10,campaign2-w10
# (4) Gain sur 5 passages
node $W tools/ab2.mjs $PREV . --scenario $SC11 --reps 5 --no-counters --out $T/ab2-gain5.json
node docs/chantier-moteur/preuves/lot-02/t2/resume-gain.mjs $T/ab2-gain5.json
# Index et mutations
node docs/chantier-moteur/preuves/lot-02/t2/index.mjs $PREV .
node docs/chantier-moteur/preuves/lot-02/t2/mutations.mjs . $T/mutations $PREV
```

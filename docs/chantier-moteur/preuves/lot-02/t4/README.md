# Lot 02 / T4 — Point de reprise : écriture différée

## Résultat

**Livré : LOAD-03, classe « état identique » (simulation non touchée, `git diff src/simulation.js` vide).** L'instantané `checkpoint=sim.snapshot()` et l'enveloppe `savedRun` restent pris dans l'image du relais. Seuls `JSON.stringify` et `localStorage.setItem` en sortent : ils partent dans une tâche `requestIdleCallback({timeout:500})`, ou `setTimeout(0)` quand elle manque, et ne font qu'une écriture pour tous les points d'une même image. Cette écriture est forcée, de façon synchrone, sur `pagehide`, sur `visibilitychange` (page cachée) et au début de Continuer, avant toute lecture ou tout remplacement des emplacements. La clé `ferro-expedition-v2` et le format ne changent pas.

Mesure principale : Chrome 157 sans tête sur Apple M5, le vrai jeu piloté. Le joueur marche jusqu'au relais, 13 images après une brèche ouverte au relais. 6 répétitions appariées et alternées, 3 mondes, 54 prises par variante :

- **Avant** (`4a06bbf`) : chaque image de prise fait 1 `stringify` et 1 `setItem`, pour 0,3 à 0,7 ms en médiane selon le monde, et 1,7 ms au plus. Le point de reprise y coûte, en tout, 1,15 à 2,75 ms en médiane, et 5,0 ms au plus.
- **Après** : il y a **0 `stringify` et 0 `setItem` dans l'image de prise sur 54 prises**. Les 54 écritures ont lieu dans une tâche différée, 3,6 à 4,3 ms après l'instantané en médiane (7,9 ms au plus). Elles coûtent 0,4 à 0,6 ms en médiane, et 1,2 ms au plus. Dans l'image, le point ne coûte plus que l'instantané : **1,0 à 1,55 ms en médiane, 2,7 ms au plus**. L'écart apparié par répétition est de 0,2, 0,6 et 1,3 ms par prise (nouvelle expédition, `legacy-s2`, monde 18).
- Le plan annonçait 0,2 à 1,0 ms gagnés par point sur M5, et ≈ 1,4 ms pour l'instantané seul. Le gain est reproduit (le seuil d'abandon était la moitié), et la tâche est gardée.
- Il n'y a **aucune tâche longue** (`longtask`, 50 ms et plus) pendant une prise, sur 108 prises. Les seules tâches longues sont celles du chargement de la page et du monde.
- **Critère « aucune tâche de plus de 5 ms à la prise »** : il est tenu pour le point de reprise. Après T4, sa part dans l'image (l'instantané seul) prend 2,7 ms au plus, et elle ne dépasse 5 ms à aucune des 54 prises. Il ne l'est pas pour l'image entière : 13 images de prise sur 54 dépassent 5 ms après, contre 22 sur 54 avant (7,4 ms au plus après, 11,0 ms avant). Le dépassement vient de ce que T4 ne touche pas : le dessin, le traitement du relais (son, message, particules, ATH) et l'instantané, qui reste dans l'image par décision (ARBITRAGES). Les images de marche ordinaires montent elles aussi à 4,9 à 6,6 ms au plus. Le détail est en (2).

| Élément | Valeur |
| --- | --- |
| Avant | `chantier/lot-02-simulation` à `4a06bbf` (T2) ; `dist/index.html` 821 387 octets, sha256 `fbad80d5…` |
| Après | arbre T4 ; `dist/index.html` 822 198 octets, sha256 `5f30929c…` ; seul source modifié : `src/game.js` |
| Machine | Apple M5, 10 cœurs logiques, macOS 27.2, Node v24.18.0, Chrome 157.0.8103.39 (`--headless=new`, ANGLE Metal), partagée (charge 2,1 à 3,6) |
| Domaine | Node : domaine principal (`bancs/load-verif2/lib.mjs`, `tools/realm-loader.mjs`), jamais un contexte `node:vm` isolé ; Chrome : CDP sur `--remote-debugging-pipe`, sans port, réseau coupé (`--host-resolver-rules`) |

## Ce qui change dans `src/game.js` (+18/−3 lignes)

- **`writeSave()`** : c'est la seule fonction d'écriture. Elle prend le point en attente et appelle `preserveRefusedSave()` juste avant `setItem` (LOAD-01), puis `localStorage.setItem(SAVE_KEY, JSON.stringify(run))`. `saveAvailable` et le texte « Sauvegarde locale active » / « Reprise disponible pendant cette session » suivent le résultat de cette écriture. Sans point en attente, elle ne fait rien.
- **`queueSave(run)`** : retient le dernier point (`pendingSave`). Une seule tâche est demandée tant qu'aucune n'a tourné (`saveQueued`). Plusieurs points de la même image, ou d'images proches, donnent donc une seule écriture, celle du dernier point.
- **`saveCheckpoint()`** : l'instantané, l'enveloppe `savedRun` et `refreshContinue()` restent synchrones. Seul l'appel `queueSave(savedRun)` remplace l'écriture. Le report « en l'air » (`checkpointPending`) ne change pas.
- **`clearSave()`** annule aussi le point en attente (`pendingSave=null`) : la tâche déjà demandée ne trouve plus rien à écrire, et le point effacé ne revient pas.
- **`resumeSaved()`** commence par `writeSave()`. Le point en attente atteint donc le stockage avant les copies `-refuse` et `-before-ascension` et avant la copie de secours sans gravats.
- **Écouteurs** : `pagehide` sur `window` et `visibilitychange` (page cachée) sur `document` appellent `writeSave()`. Ils sont posés avant l'écouteur existant de `visibilitychange` : l'écriture précède la mise en pause.

`readSave()` n'est appelé qu'au démarrage, quand rien n'est encore en attente. La taille augmente de 811 octets pour la page (248 706 → 248 998 octets en gzip) et pour `game.js` (104 096 → 104 907).

## Banc de départ (Node) : [`v03-roots.mjs`](v03-roots.mjs), sortie [`v03-roots.txt`](v03-roots.txt)

Le banc mesure l'instantané pris juste après une brèche, `legacy-s0`, en 7 passages alternés : `71eca61` (avant T1) contre l'arbre. Avant T1, il coûte 5,2 à 6,5 ms au mieux et 5,3 à 7,4 ms en médiane, avec 36 346 cellules en file. Sur l'arbre (T1), il coûte 0,58 à 0,74 ms au mieux et 0,66 à 0,82 ms en médiane, file vide. `JSON.stringify` prend 0,28 à 0,37 ms pour 167 158 caractères. Un premier passage, sous plus de charge, donnait 9,8 ms contre 1,1 ms (première ligne du fichier). Ce sont les ordres de grandeur du plan (10,7 contre 1,4 à 1,5 ms ; 0,57 ms). Après T1, ce qui restait dans l'image hors instantané, c'étaient `stringify` et `setItem` : c'est ce que T4 retire.

## (1) L'instantané peut être sérialisé plus tard : [`snap-shared.mjs`](snap-shared.mjs), sortie [`snap-shared.json`](snap-shared.json)

Différer `stringify` n'est juste que si l'objet rendu par `snapshot()` ne bouge plus quand la simulation continue. Le banc couvre 10 scénarios (`legacy-s0`, `legacy-s2`, `legacy-s2` arme 2, `campaign-w10`, `campaign-w16`, `campaign2-w1`, `-w7`, `-w10`, `-w13` et `-w18`), avec un instantané après 300, 900 et 1 500 pas. Pour chacun :

- il cherche, depuis l'état vivant, les objets de l'instantané qu'on peut atteindre (`sim`, `sim.state`, `sim.destruction`, contenus des `Map` et `Set` compris). Seules les 2 boîtes `state.traps[i].box` sont partagées, rien d'autre. `trapPose` les remplace à chaque pas (`simulation.js:1961`), il ne les modifie jamais en place ;
- il refait `JSON.stringify` du même objet après 120 pas de plus. Le texte est **identique dans les 30 cas**, alors que l'état a changé dans les 30 (83 096 à 316 590 caractères, jusqu'à 128 gravats).

Le test 11 garde ce point dans le jeu : une lame qui bouge ne déforme pas un point en attente.

## (2) Chrome, approche à pied (mesure principale) : [`chrome-sonde-approche.js`](chrome-sonde-approche.js), résumé [`chrome-approche.json`](chrome-approche.json)

La sonde est chargée avant le script du jeu, dans une copie de `dist/index.html` A (`4a06bbf`) ou B (arbre). Elle chronomètre chaque rappel `frame` du jeu. Elle mesure aussi `sim.step` (somme des sous-pas), `renderer.draw`, `sim.snapshot()`, `JSON.stringify` de plus de 20 000 caractères et `setItem` de la clé de reprise, et note ceux qui tombent hors de toute image. Pour chaque relais, elle procède ainsi :

1. le joueur est posé à 2,6 m du relais, au même niveau, sur un chemin droit libre, et la scène se stabilise pendant 40 images ;
2. une brèche est ouverte au relais (`destruction.blast` ; la révision de destruction change aux 108 prises), puis on attend 3 images ;
3. le joueur marche jusqu'au relais à 0,12 m par image. La prise tombe à la 10e image de marche : c'est une image de marche ordinaire, sans téléportation.

Les mondes sont la reprise d'une vraie sauvegarde lourde `legacy-s2` (secteur 3, après 900 pas aux roquettes), la reprise de `campaign2-w18` (après 1 500 pas) et une nouvelle expédition (monde 1). Les sauvegardes viennent de [`chrome-sauvegarde.mjs`](chrome-sauvegarde.mjs), les pages de [`chrome-pages.py`](chrome-pages.py), et le pilote est [`chrome-drive.mjs`](chrome-drive.mjs). Chaque passage lance un seul Chrome, avec un profil neuf et sans port, et ouvre un onglet neuf par page. Chaque répétition joue A puis B, ou B puis A (ordre alterné). Les médianes et les maxima portent sur les 18 prises de chaque variante, en ms.

| Monde (caractères écrits) | A : `stringify`+`setItem` dans l'image | A : point dans l'image | B : point dans l'image (instantané seul) | Écart apparié A−B | B : écriture différée, coût | B : délai après l'instantané |
| --- | --- | --- | --- | --- | --- | --- |
| `legacy-s2` repris (209 869–210 654) | 0,45 / 1,2 | 1,95 / 3,8 | 1,25 / 2,7 | 0,6 | 0,5 / 0,9 | 4,05 / 7,9 |
| `campaign2-w18` repris (275 000–276 175) | 0,7 / 1,7 | 2,75 / 5,0 | 1,55 / 2,7 | 1,3 | 0,6 / 1,2 | 3,55 / 6,3 |
| nouvelle expédition (82 816–83 652) | 0,3 / 0,5 | 1,15 / 2,0 | 1,0 / 1,5 | 0,2 | 0,4 / 0,7 | 4,3 / 6,9 |

*Valeurs en médiane / maximum. « Point dans l'image » : instantané + `stringify` + `setItem` dans l'image de prise.*

- **Où tombent les appels.** Dans A, les 54 prises font chacune 1 `stringify` et 1 `setItem` dans l'image. Dans B, il n'y en a aucun dans l'image : les 54 écritures, et les 54 `stringify`, ont lieu dans une tâche différée. L'instantané est pris dans l'image de prise 108 fois sur 108, et jamais en vol.
- **Image de prise entière** (rappel `frame`). En médiane, A prend 4,35, 5,15 et 3,75 ms (11,0 au plus) et B 3,75, 3,35 et 4,25 ms (7,4 au plus). L'écart apparié est de 1,25, 2,1 et 0,1 ms. Il est bruité : une image de prise dure 3 à 10 ms, et la part retirée ne pèse que 0,3 à 0,7 ms. Dans B, l'image de prise se décompose en `sim.step` 0,2 à 0,3 ms, dessin 0,8 à 1,3 ms, instantané 1,0 à 1,55 ms et reste 0,8 à 1,5 ms : c'est le traitement du relais (son, message, particules, ATH), contre 0,3 à 0,4 ms de reste dans une image de marche. Les images de marche qui précèdent la prise prennent 1,6 à 2,1 ms en médiane, et 4,9 à 6,6 ms au plus.
- **Images de prise au-dessus de 5 ms** : 22 sur 54 dans A, 13 sur 54 dans B. Le point de reprise lui-même dépasse 5 ms 0 fois sur 54 dans les deux variantes. Le maximum de A vaut 5,0 ms tout juste.
- **Tâches longues** (`PerformanceObserver` `longtask`, 50 ms et plus) : il n'y en a aucune pendant une prise. Chaque page en compte deux en médiane (432 ms au plus). Un relevé de contrôle de leurs dates, sur un passage de `legacy-s2` et un de la nouvelle expédition, les place au chargement de la page, puis à celui du monde, au clic sur Lancer ou Reprendre. Cette API ne voit rien sous 50 ms : le seuil de 5 ms du plan se lit donc sur les durées d'image mesurées par la sonde.

## (3) Chrome, téléportation sur le relais et repli `setTimeout` : [`chrome-sonde-teleport.js`](chrome-sonde-teleport.js), résumés [`chrome-teleport.json`](chrome-teleport.json) et [`chrome-sans-idle.json`](chrome-sans-idle.json)

C'est la première sonde, jouée sur les mêmes pages A et B, 6 répétitions. La brèche est ouverte au relais, puis le joueur est posé dessus 15 images plus tard. Le résultat est le même : 1 `stringify` et 1 `setItem` par prise dans A (0,2 à 0,9 ms en médiane, 1,2 au plus), et 0 sur 54 dans B, où les écritures ont lieu 4,6 à 9,6 ms plus tard en médiane (16,4 au plus). La téléportation alourdit l'image de prise : A prend 4,5 à 8,7 ms en médiane et B 4,55 à 8,4 ms. Cette sonde sert à placer les appels, pas à chronométrer l'image.

Le repli sans `requestIdleCallback` (page C : B où `window.requestIdleCallback` vaut `undefined`, comme sous Safari), en 5 répétitions sur `legacy-s2`, donne 0 sur 15 dans l'image de prise. Les 15 écritures passent par `setTimeout(0)`, 5,9 ms après l'instantané en médiane (10,6 au plus), pour 0,6 ms.

Les mesures brutes des sept passages sont dans [`chrome-brut.json.gz`](chrome-brut.json.gz) (chemins locaux remplacés par `$T`).

## Tests

**Harnais de `checks/checkpoint.test.mjs`.** Aucune assertion existante n'est modifiée. Voici ce qui change :

- un `requestIdleCallback` factice met les rappels en file. Chaque action du harnais (`frame`, `click`, `emit`, `key`, `emitDocument`) est une tâche, suivie de la file au repos, comme dans un navigateur. Les tests existants qui lisent le stockage juste après `frame()` voient donc l'écriture différée sans changer ;
- une écriture faite au repos note le mode de la tâche qui l'a demandée, c'est-à-dire l'image de prise. Le mode noté reste ainsi celui de la prise ;
- `document.addEventListener` est capturé (c'était un `noop`) et `emitDocument` le déclenche ;
- `manualIdle` laisse le test vider la file lui-même, et `idle: false` retire `requestIdleCallback` pour tester le repli.

**Onze tests neufs (LOAD-03).**

1. *a checkpoint snapshot stays in its frame while JSON and storage wait for one idle write* : aucun `setItem` dans l'image de prise. Il y a une seule écriture après la tâche différée, même quand celle-ci tourne après une pause, et elle est notée avec le mode `playing` de la prise. Le délai vaut 500 ms, et le point écrit est le texte de l'instantané de l'image.
2. *two checkpoints taken in one frame share a single idle write of the latest point* : deux relais pris dans deux sous-pas de la même image donnent une seule écriture, celle du second point.
3. et 4. *pagehide* / *visibilitychange writes a pending checkpoint synchronously and only once* : l'écriture a lieu pendant l'évènement, une seule fois, et la page cachée se met toujours en pause.
5. *finishing the expedition cancels a pending checkpoint write* : `clearSave` annule deux points en attente, et rien ne revient après la tâche.
6. *the deferred write preserves the refused slot immediately before replacing the active point* : à la reprise, la première copie dans `-refuse` échoue (stockage occupé). L'écriture différée copie alors d'abord le point refusé dans `-refuse`, puis elle remplace le point actif.
7. *a failed deferred write keeps the session point and reports that it is not stored* : si `setItem` lève, `saveAvailable` passe à `false`, le message « Reprise disponible pendant cette session » s'affiche et la reprise de la session reste possible. L'écriture suivante, réussie, rétablit le message.
8. *no checkpoint snapshot is taken in flight, not even when the page hides* : un relais pris en vol, puis `pagehide` et `visibilitychange`, ne déclenchent aucun instantané. Le point attend l'atterrissage.
9. *without requestIdleCallback the write leaves the frame through a zero-delay timer*.
10. *Continue writes a pending point before it reads or replaces the save slots* : le joueur meurt avec un point en attente, et Continuer l'écrit avant de reprendre.
11. *a deferred point keeps the state of its snapshot frame while traps move on*.

Les tests 7 et 10 emploient `arsenalWorld`. Dans le `world` du test, Continuer après une mort lève `Invalid economy`, parce que `copyLoadout` ajoute toujours une économie. Cette limite du monde de test existait déjà et n'a pas été touchée.

**Mutations : [`mutations.py`](mutations.py), sortie [`mutations.txt`](mutations.txt).** Onze fautes sont injectées dans `src/game.js` :

| Faute | Tests qui échouent |
| --- | --- |
| écriture dans l'image, le code d'avant | 8 |
| `clearSave` sans annulation | 1 |
| sans `pagehide` | 1 |
| sans `visibilitychange` | 1 |
| `resumeSaved` sans vidage | 1 |
| `preserveRefusedSave` retiré de l'écriture | 2, dont le test LOAD-01 existant |
| une écriture par appel, sans fusion | 5 |
| échec ignoré (`saveAvailable` reste vrai) | 1 |
| instantané lui aussi différé | 9 |
| `setTimeout` seul | 39 (8 neufs, et 31 anciens qui lisent le stockage juste après `frame()`) |
| sans `timeout:500` | 1 |

Chacune est détectée, alors que l'arbre intact passe les 61 tests.

**Suite complète.**

- `npm test`, lancé sur le Spark sur l'arbre du commit : 486 tests, 478 réussis et 8 échecs, en 136 s. Ce sont les 8 échecs admis de `checks/campaign-world.test.mjs` : six *legacy seed 1 / 96, sector 0 à 2: exact pre-campaign world fingerprint*, puis *campaign mode is strictly opt-in…* et *the first three campaign worlds preserve historical geometry…*. La base T2 était à 467/475 : les onze tests neufs passent, et il n'y a aucun échec de plus. `checkpoint.test.mjs` donne 61 sur 61 (50 anciens et 11 neufs). Journal : [`npm-test.log.gz`](npm-test.log.gz), chemins remplacés par `<arbre>`.
- `npm test` s'arrête avant `build.test.mjs`, à cause des 8 échecs admis. `python3 tools/build.py`, puis `node checks/build.test.mjs`, donnent PASS, sans ressource externe : 822 198 octets, sha256 `5f30929c…`.

## À confirmer par David

1. **Pas d'échéance au report « en l'air »** (décision 5 du plan). Un point pris en vol attend l'atterrissage, comme avant, et même quand la page se cache aucun instantané n'est pris en vol (test 8). Le délai sera borné au lot 09 avec le saut tamponné (SAUT-05). **Valeur par défaut : garder.**
2. **Fenêtre de perte** (décision 6 du plan). Si la page plante, ou si l'onglet est tué sans `pagehide` ni `visibilitychange`, entre l'instantané et l'écriture, ce point est perdu, et la reprise se fait au point précédent. La fenêtre mesurée est de 3,6 à 4,3 ms en médiane, 7,9 ms au plus en marche et 16,4 ms au plus en téléportation. Sous forte charge, le délai de 500 ms la borne. Une fermeture normale, un passage en arrière-plan ou Continuer écrivent le point. **Valeur par défaut : accepter.**
3. **Le message « Sauvegarde locale active »** est mis à jour à l'écriture, quelques millisecondes après la prise, et non plus dans l'image de prise. Le joueur ne voit pas la différence. **Valeur par défaut : accepter.**

## À vérifier sur du vrai matériel

Seuls Chrome sans tête et Node, sur un Mac M5, ont été mesurés. En sans-tête, il n'y a ni vrai affichage ni composition : les durées d'image sont celles du JavaScript du rappel `frame`. Restent à vérifier :

- Safari (macOS et iOS). Selon la version, `requestIdleCallback` peut y manquer : le jeu suit alors la branche `setTimeout(0)`, qui n'a été mesurée que sous Chrome. iOS peut aussi tuer un onglet en arrière-plan : `visibilitychange` doit écrire le point avant.
- Firefox, qui a `requestIdleCallback` avec son propre ordonnancement.
- Un téléphone (Chrome Android, Safari iOS). `stringify` et `setItem` de 200 000 à 280 000 caractères y coûtent plusieurs fois plus qu'ici : le gain par point y est plus grand, et le délai avant écriture aussi.
- Un PC Windows avec carte NVIDIA.

## Notes pour la suite

- **Lot 07 (boucle, FLoop).** `writeSave()` est le seul endroit qui sérialise et écrit. Il peut être appelé depuis une tranche de repos de la boucle, ou envoyer `stringify` à un worker. `localStorage` reste réservé au fil principal : sortir aussi `setItem` demanderait un autre stockage (IndexedDB), à décider avec le lot 12.
- **Lot 09 (saut).** Le report `checkpointPending` est inchangé. C'est là qu'il faudra borner le délai (SAUT-05).
- **Lot 12 (format).** La clé et le format sont inchangés : rien à reporter.
- **Indépendance de l'instantané.** Différer `stringify` suppose que rien d'atteignable depuis l'instantané n'est modifié en place après la prise. Aujourd'hui, seules les boîtes des pièges sont partagées, et elles sont remplacées à chaque pas. Un lot qui modifierait en place un objet repris tel quel par `snapshot()` (pièges, portes, gravats) devra le copier dans `snapshot()`. Il pourra relancer `snap-shared.mjs`, et le test 11 garde les pièges.
- **Image de prise.** Après T4, elle dépasse encore 5 ms dans 13 cas sur 54 en sans-tête. L'instantané (1,0 à 1,55 ms en médiane, 2,7 au plus) en est la plus grosse part liée au point de reprise. Le reste, le traitement du relais et le dessin, ne dépend pas de T4.
- `game.js` est un point chaud de fusion (lots 05, 07, 08 et 09). Le diff tient en un bloc de 15 lignes après `preserveRefusedSave`, plus trois lignes : `saveCheckpoint`, `clearSave` et `resumeSaved`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `v03-roots.mjs`, `v03-roots.txt` | banc de départ : instantané après une brèche, 71eca61 contre l'arbre |
| `snap-shared.mjs`, `snap-shared.json` | partage d'objets entre instantané et état vivant ; texte après 120 pas |
| `chrome-sonde-approche.js` | sonde de la mesure principale (approche à pied) |
| `chrome-sonde-teleport.js` | première sonde (téléportation sur le relais), et repli `setTimeout` |
| `chrome-drive.mjs` | pilote Chrome sans tête (CDP sur tube, sans port), A et B alternés |
| `chrome-sauvegarde.mjs`, `chrome-pages.py` | vraies sauvegardes et pages de mesure |
| `chrome-resume-approche.mjs`, `chrome-resume-teleport.mjs` | résumés |
| `chrome-approche.json`, `chrome-teleport.json`, `chrome-sans-idle.json` | résumés des passages |
| `chrome-brut.json.gz` | mesures brutes des sept passages |
| `mutations.py`, `mutations.txt` | tests de mutation |
| `npm-test.log.gz` | journal de `npm test` (Spark) |

## Commandes

Elles se lancent depuis la racine de l'arbre. `T` est un dossier temporaire, `BASE71=$T/base-71eca61` vaut `git archive 71eca61 src`, et `P=docs/chantier-moteur/preuves/lot-02/t4`.

```sh
W='--import=data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'; R=$PWD
SC10=legacy-s0,legacy-s2,legacy-s2:2,campaign-w10,campaign-w16,campaign2-w1,campaign2-w7,campaign2-w10,campaign2-w13,campaign2-w18
# Banc de départ et indépendance de l'instantané
ROOT_A=$BASE71 ROOT_B=. node $P/v03-roots.mjs l:0 7
node $W $P/snap-shared.mjs . $SC10 300,900,1500 120
# Chrome : pages A (4a06bbf) et B (arbre), vraies sauvegardes
mkdir -p $T/pages && git show 4a06bbf:dist/index.html > $T/dist-A.html && cp dist/index.html $T/dist-B.html
node $W $P/chrome-sauvegarde.mjs . $T/pages/save-legacy-s2.js legacy-s2 2 900
node $W $P/chrome-sauvegarde.mjs . $T/pages/save-campaign2-w18.js campaign2-w18 '' 1500
python3 -I $P/chrome-pages.py $T/dist-A.html $T/dist-B.html $T/pages $P
for m in legacy w18 neuf; do node $P/chrome-drive.mjs $T/pages/A2-$m.html $T/pages/B2-$m.html 6 $T/approche-$m.json; done
for m in legacy w18 neuf; do node $P/chrome-drive.mjs $T/pages/A-$m.html $T/pages/B-$m.html 6 $T/teleport-$m.json; done
node $P/chrome-drive.mjs $T/pages/A-legacy.html $T/pages/C-legacy.html 5 $T/sans-idle-legacy.json
(cd $T && node $R/$P/chrome-resume-approche.mjs approche-legacy.json approche-w18.json approche-neuf.json)
(cd $T && node $R/$P/chrome-resume-teleport.mjs teleport-legacy.json teleport-w18.json teleport-neuf.json)
(cd $T && node $R/$P/chrome-resume-teleport.mjs sans-idle-legacy.json)
# Mutations, puis la suite
python3 -I $P/mutations.py . $T/mutations
/Users/david/claude/metal-chantier/outils/npm-test-spark.sh . $T/npm-test.log
python3 tools/build.py && node checks/build.test.mjs
```

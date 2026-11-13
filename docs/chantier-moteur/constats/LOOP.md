# Axe LOOP — LOOP — boucle, latence, caméra et interface

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Axe LOOP, commit 673d6b2 (v0.8.0). Les mesures tournent dans un harnais node:vm qui exécute le vrai game.js et tous ses modules dans l'ordre du build, avec DOM, WebGL et AudioContext factices (compteurs d'écritures et d'appels) et une horloge virtuelle. La simulation est 100 % déterministe (aucun Math.random), donc les variantes se comparent par rejeu. Les temps absolus sont bruités parce que d'autres agents tournent en même temps ; les ratios et les comptes sont fiables.

Ce qui est sain : l'ordre entrée → simulation → rendu est correct. Le delta souris est cumulé puis appliqué au premier sous-pas, et la caméra est construite après la simulation. FMotion ne lisse que l'arme et le FOV, pas le lacet ni le tangage. La chaîne souris → image n'ajoute donc aucune image de retard (au plus une image plus la composition). Les sauts de caméra en montée de marche sont rares (0 à 3 en 2 min, au plus 0,13 m) : non retenus.

D'où viennent les saccades : de la simulation, pas du GC (scavenge au plus 0,83 ms, mark-compact au plus 1,12 ms) ni du HUD (0,49 ms par tic) :
- LOOP-02 : des recherches A* qui échouent font des pas de 97 à 175 ms, 5 en 30 s sur campaign-9.
- LOOP-03 : un point de reprise qui termine d'un coup le recalcul de navigation coûte 42 à 155 ms.
- LOOP-04 : chaque révision de destruction reconstruit tout le rendu (24 à 31 ms) et toute la navigation (36 000 à 44 000 cellules remises en file, cache d'arêtes vidé).

Bogue critique LOOP-01 : les points de reprise pris après une destruction sont refusés par restore() dans 13 mondes sur 13. La cause est prouvée : des débris se posent déjà interpénétrés dans un solide. Le joueur est alors renvoyé à l'entrée du secteur.

Schéma de pas : ceil(dt*60) fait 2 sous-pas par image à 59,94 Hz et avec des horodatages arrondis, soit +37 à 39 % de CPU de simulation. Je recommande un pas variable borné à 1/40 s (LOOP-05). Un 120 Hz fixe avec interpolation coûterait autant et ajouterait environ 8 ms de retard.

Entrées et ressenti :
- Le tir n'est pas verrouillé : 20 à 27 % des clics perdus à 20–30 fps.
- Aucune prise en charge de la manette.
- Le verrouillage du pointeur ne demande pas unadjustedMovement ; sans verrou, glisser pour regarder tire aussi ; la molette n'a pas de seuil.
- La cadence des armes est arrondie au pas (75 tirs au lieu de 80 à 60 Hz).
- Le limiteur d'images est faux hors multiples exacts (37,5 fps au lieu de 60 sur un écran 75 Hz).

Coûts annexes : rendu complet sous un flou CSS en pause et dans les menus, gouverneur de résolution trompé par l'intervalle rAF, 97 % d'écritures DOM redondantes, 34 automations audio par image, environ 1,5 Mo alloués par image.

Ordre conseillé : LOOP-01, 02, 03, 05 et 06 (efforts S ou M, gros effets), puis 04 (L), 07, puis 08 à 15.

## Mesures

- **Sous-pas de simulation par image (game.js:690)** : 1,409 à 60 Hz exact (erreurs flottantes) ; 1,667 à 60 Hz avec horodatages arrondis à 0,1 ms (400 images à 1 pas, 800 à 2) ; 2,0 à 59,94 Hz ; 2,59 à 30 Hz _(méthode : bench/loop/play.mjs <ferro> 20 <60|q60|59.94|30> 9 (vrai game.js, horloge virtuelle) et steps.mjs)_
- **Coût CPU : 2 sous-pas de 1/120 contre 1 pas de 1/60** : x1,37 à x1,39 (127,8→177,9 et 92,0→125,9 ms par seconde simulée) ; un pas de 1/40 : x0,78 à x0,93 ; coût fixe par pas ≈ 38 % d'un pas de 60 Hz _(méthode : splitcost2.mjs : rejeu déterministe depuis zéro, 8 départs x 2 ordres alternés, legacy-s0 et campaign-9)_
- **Coût par image dans la boucle réelle (rendu factice), campagne 9, q60, 1 200 images** : moyenne 5,12 ms, p50 2,93, p95 15,4, p99 34,6, max 96,5 ; sim.step 3,67 ms par image (72 %) ; models 1,01 ; FEffects.build 0,29 ; FActors.build 0,17 ; soundscape.sample 0,13 (max 15,5) ; renderHUD 0,49 par tic (0,08 par image) ; drawRadar 0,06 par tic ; audio.tick 0,016 ; events 0,015 par pas _(méthode : play.mjs <ferro> 20 q60 9 ; sondes posées en renommant les fonctions dans le source chargé en mémoire)_
- **Distribution des pas de simulation en combat** : campaign-9 : p50 1,1 ms, p95 4,6, p99 8,3, max 174,6 ; 20 pas au-dessus de 8 ms et 9 au-dessus de 16 ms en 30 s ; les 5 pires (97,7 à 174,6 ms) sont tous updateEnemies → plan → route _(méthode : spikes.mjs <ferro> campaign-9 30 : sondes inclusives sur 29 fonctions internes de simulation/destruction, JIT chauffé 600 pas sur un autre exemplaire)_
- **Recherches A* route() (simulation.js:1402-1430)** : campaign-9 : 26 recherches, 18 échecs = 707 des 755 ms, 7 au plafond de 2 400 nœuds, 5 au-dessus de 50 ms ; legacy-s0 : 24 recherches, 16 échecs = 425 des 488 ms, 3 au-dessus de 90 ms ; campaign-10 : aucune. Échec à froid : 4 078 à 4 390 appels segmentFree, 97 à 142 ms ; même échec à chaud : 295 à 486 appels, 13 à 21 ms _(méthode : routes.mjs <ferro> <monde> 30 (compteurs injectés dans route et segmentFree))_
- **Coût d'un point de reprise (game.js:94-100)** : snapshot 0,76 à 2,89 ms + JSON.stringify 0,26 à 1,14 ms (82 000 à 274 000 caractères) ; juste après une explosion, file de navigation pleine : 92 à 155 ms ; en combat, file partiellement consommée : 41,8 à 49,0 ms ; à la reprise : restore 177 à 531 ms + création 208 à 416 ms _(méthode : snapshot.mjs <ferro> sur 6 mondes (classic-0, classic-2, campaign-0/9/15/17), deux exécutions)_
- **File de navigation après une destruction (refreshNav)** : 36 192 à 43 172 cellules en attente sur 36 960 à 43 940 (toute la grille), traitées à 768 par pas, soit 48 à 57 pas (environ 0,9 s) ; navPending > 0 sur 17 à 41 % des pas de combat _(méthode : snapshot.mjs (navPendingAfterBlast) et compteur navPending par pas dans le harnais de combat (combat.mjs))_
- **Points de reprise refusés par restore()** : 13 mondes sur 13 ; 5 à 10 refus sur 11 essais ; premier refus après 6 à 21 s ; 100 % des refus à simulation.js:2081 ; repris 28 fois sur 28 en vidant rubble ou en écrivant resting:false _(méthode : restorescan.mjs <ferro> 30 (point de reprise toutes les 3 s, joueur au sol comme game.js:94-98), complet puis QUICK=1)_
- **Débris posés en interpénétration** : classic-0 : 10 sur 208 ; campaign-10 : 17 sur 165 ; 100 % l'étaient dès la pose, aucun après ; profondeur 0,001 à 0,547 m, toujours contre un solide, aucune porte _(méthode : rubblecause.mjs <ferro> 30 <monde> (contrôle toutes les 0,05 s contre destruction.colliders et les portes))_
- **Bout en bout dans le vrai game.js** : sauvegarde de 186 299 caractères avec 96 débris ; après une mort puis « continuer » : « Point de reprise illisible. Reprise à l’entrée de ce secteur. » _(méthode : e2e-restore.mjs (roquettes pendant 12 s, point de reprise, mort simulée))_
- **renderer.updateWorld par révision de destruction** : 23,8 à 30,7 ms, dont spatialIndex 7,7 à 12,2 ms ; re-pack du lot statique 4,5 à 8,4 ms pour 0,89 à 1,11 Mo de sommets ; 8 à 28 révisions par 20 à 30 s de combat _(méthode : worldupdate.mjs (vrai renderer.js, contexte GL factice))_
- **Pas de simulation contenant une révision de destruction** : 18,1 ms en moyenne (6,7 ms sans le pas qui cumule une A* échouée) contre 1,84 ms sans révision ; updateDebris 34,9 ms par seconde simulée, jusqu'à 19,9 ms dans un pas ; pumpNav 20,9 ms par seconde simulée, jusqu'à 5,6 ms par pas _(méthode : spikes.mjs campaign-9 30)_
- **Clics perdus au pistolet (délai 0,32 s)** : à 20–30 fps, 20 à 27 % des clics arrivés arme prête ne tirent pas (0 % avec un verrou d'appui) ; clics trop tôt finalement servis : 4 à 34 % aujourd'hui, 46 à 56 % avec un tampon de 150 ms _(méthode : clicks.mjs : 60 s de clics pseudo-aléatoires reproductibles, 5 couples cadence/durée d'appui x 2 rythmes)_
- **Cadence de la mitraillette (nominal : 80 tirs en 10 s)** : 67 au pas des tests (25 ms), 72 à 20 ms, 75 à 16,7, 8,3 et 33,3 ms, 80 à 6,94 ms _(méthode : firerate2.mjs (pas constants))_
- **Limiteur d'images (game.js:676)** : limite 60 : 37,5 fps à 75 Hz, 45 à 90, 50 à 100, 48 à 144, 55 à 165 ; limite 120 : 72 à 144, 82,5 à 165 ; limite 30 : 25 à 75 et 100 Hz, 28,8 à 144 ; avec une échéance cumulée, la moyenne demandée est atteinte _(méthode : fpslimit.mjs (vsync arrondies à 0,1 ms, 20 s simulées))_
- **Gouverneur de résolution (renderer.js:746-763)** : rAF plafonné à 30 Hz, GPU au repos : échelle 0,65 en 12,3 s ; une image sur 3 manquée : bloqué à 0,9 _(méthode : governor.mjs (vrai renderer.js, intervalles synthétiques))_
- **Rendu hors jeu** : renderer.draw appelé 120 fois sur 120 images en pause, menu, boutique et résultat, avec 121 à 179 maillages _(méthode : modes.mjs)_
- **preparePlay** : environ 458 ms de CPU (sonde load) ; 0,5 à 1,7 s en temps mur selon le harnais _(méthode : prep.mjs et modes.mjs)_
- **Écritures DOM du HUD** : 141,5 écritures par tic (toutes les 90 ms), dont 3,8 changent une valeur (97,3 % redondantes) ; radar 104 opérations canvas par tic ; opacité de #damage écrite à chaque image _(méthode : play.mjs, DOM factice qui distingue écriture identique et écriture différente)_
- **Automatisation audio** : 34,1 appels d'automatisation AudioParam par image (gain 12,9, filter.frequency 11, pan 10) ; 0,63 nœud créé par image _(méthode : play.mjs, AudioContext factice avec compteur d'appels)_
- **Allocation mémoire et GC** : environ 1,5 Mo alloués par image ; sim.step environ 845 Ko par pas (74 %) ; models environ 357 Ko par image ; scavenge 0,12 à 0,28 ms en moyenne, 0,38 à 0,83 ms au plus ; un mark-compact de 0,79 à 1,12 ms par 30 s _(méthode : alloc.mjs (écarts de used_heap_size), simalloc.mjs, node --trace-gc dépouillé par gcsum.cjs (gc-c9.txt, gc-c9-16.txt))_
- **Sauts de caméra en montée de marche** : 0 à 3 par 2 min, au plus 0,13 m : non retenu _(méthode : steps.mjs)_
- **Chaîne entrée → image** : delta souris cumulé (lookDX) appliqué au premier sous-pas, caméra construite après la simulation, lacet et tangage non lissés : aucune image de retard ajoutée _(méthode : lecture de game.js:685-722 et motion.js, confirmée dans le harnais)_

## Scripts de banc

- bancs/loop/harness.mjs — harnais node:vm du vrai game.js (DOM, GL et audio factices, horloge virtuelle, sondes)
- bancs/loop/play.mjs — node play.mjs <ferro> [s] [60|q60|59.94|144|120|30|jitter60] [monde] : coûts par fonction, sous-pas, DOM, audio
- bancs/loop/splitcost2.mjs — node splitcost2.mjs <ferro> [legacy-s0|campaign-9] [départs] : coût de 1 pas de 1/60, 2 de 1/120 ou 1 de 1/40 par rejeu
- bancs/loop/steps.mjs — sous-pas et sauts de caméra en montée de marche
- bancs/loop/spikes.mjs — node spikes.mjs <ferro> [monde] [s] : attribution des pas les plus longs
- bancs/loop/routes.mjs — node routes.mjs <ferro> [monde] [s] : recherches A* (succès, échecs, froid ou chaud)
- bancs/loop/snapshot.mjs — coût des points de reprise avec et sans file de navigation en attente
- bancs/loop/restorescan.mjs — node restorescan.mjs <ferro> 30 (QUICK=1 pour 3 mondes) : points de reprise refusés et sauvetages
- bancs/loop/restorefail.mjs — diagnostic de la ligne et de la boîte qui font échouer restore
- bancs/loop/rubblecause.mjs — node rubblecause.mjs <ferro> 30 <monde> : instant où un débris posé commence à recouvrir un solide
- bancs/loop/e2e-restore.mjs — bout en bout game.js : sauvegarde, mort, « continuer »
- bancs/loop/worldupdate.mjs — coût de renderer.updateWorld par révision de destruction
- bancs/loop/combat.mjs — combat scripté selon le schéma de pas (current, fixed60, fixed120, bounded)
- bancs/loop/clicks.mjs — clics perdus : actuel, verrou, tampon 150 ms
- bancs/loop/firerate2.mjs — cadence des armes selon le pas
- bancs/loop/fpslimit.mjs — limiteur d'images, algorithme actuel contre échéance cumulée
- bancs/loop/governor.mjs — gouverneur de résolution face au plafond 30 Hz et aux images manquées
- bancs/loop/modes.mjs — travail en pause, menu, boutique et résultat
- bancs/loop/prep.mjs — temps CPU de preparePlay
- bancs/loop/radar.mjs — opérations canvas du radar
- bancs/loop/alloc.mjs — node --max-semi-space-size=128 alloc.mjs <ferro> [monde] [s] : octets alloués par fonction
- bancs/loop/simalloc.mjs — points chauds d'allocation dans la simulation
- bancs/loop/gcsum.cjs — dépouillement des sorties node --trace-gc

## Constats

### LOOP-01 — Les points de reprise pris après une destruction sont refusés par restore() : la progression du secteur est perdue
- sévérité critique · catégorie bug · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:1000; src/simulation.js:1034; src/simulation.js:1040-1045; src/simulation.js:1058-1060; src/simulation.js:1941-1959; src/simulation.js:2078-2081; src/game.js:94-100; src/game.js:105-123

**Preuve.** 1) restore(), simulation.js:2078-2081 : un débris posé (resting) doit reposer à ±0,03 m d'un sol ou d'un support, et `require(!supportBoxes.some(box=>debrisOverlaps(q,h,box)))` refuse tout recouvrement au-delà de 0,2 mm (tolérance de debrisOverlaps, simulation.js:1000). 2) updateDebris : la pose (resting=true après 0,18 s, simulation.js:1059-1060) teste le support, la vitesse et l'orientation, jamais l'interpénétration. La dépénétration se limite à 4 passes (1040-1044), les recalages sur le plancher (1045, 1058) ignorent les boîtes, et une fois le débris posé seul le support est revérifié (1034). 3) restorescan.mjs : 13 mondes sur 13 (classic-0 à 2, campagne 0 à 17) refusent 5 à 10 points de reprise sur 11, dès 6 à 21 s de combat, et 100 % des refus viennent de la ligne 2081. Les 28 refus de la série QUICK passent si l'on vide rubble ou si l'on écrit resting:false. 4) rubblecause.mjs : 10 débris posés sur 208 recouvrent un solide en classic-0, 17 sur 165 en campaign-10. Tous le faisaient dès l'instant de la pose, aucun après ; profondeur 0,001 à 0,547 m (exemple : decor-room-0:-17,-1,28:dressing, 0,547 m). 5) e2e-restore.mjs dans le vrai game.js : sauvegarde de 186 299 caractères avec 96 débris ; après une mort, game.js:121 affiche « Point de reprise illisible. Reprise à l’entrée de ce secteur. » 6) Les tests de reprise des débris (checks/simulation.test.mjs:1927-1996) ne portent que sur des mondes synthétiques.

**Cause.** Rien ne garantit qu'un point de reprise pris par snapshot() soit accepté par restore(). La physique laisse se poser un débris interpénétré (débris de décor ou de meuble pris dans un solide, 4 passes de dépénétration insuffisantes), alors que restore applique un prédicat plus strict. Comme la validation est atomique, tout le point de reprise est rejeté.

**Proposition.** 1) Extraire le prédicat de restore dans une fonction partagée restingRubbleValid(q,h,supportBoxes,traps), mêmes tolérances (.03 / .002 / .0002). L'appeler dans snapshot() sur la copie sérialisée : un débris posé qui échoue y est écrit resting:false, settleTime:0. Ne jamais modifier l'état vivant. 2) Physique : ajouter &&!boxes.some(b=>debrisOverlaps(q,h,b)) à la condition de pose (1060). Si le recouvrement persiste après les 4 passes, poser le débris sur la boîte recouverte (q.y=box.maxY+h[1]+skin) : déterministe et sans nouveau champ. 3) Filet dans game.js (restoreRun et resumeSaved) : en cas de refus, réessayer une fois avec state.rubble=[] avant de renvoyer à l'entrée du secteur. 4) Test de non-régression sur mondes réels (classic-0, campaign-0, campaign-10) : 30 s de combat scripté, et toutes les 3 s un aller-retour snapshot → JSON → restore qui doit réussir 11 fois sur 11.

**Gain attendu.** Plus aucun point de reprise refusé (aujourd'hui 5 à 10 sur 11 dès 6 à 21 s de combat, dans 13 mondes sur 13). Plus de retour forcé à l'entrée du secteur après une mort.

**Risques.** Le format ne change pas (rubbleVersion 1, resting:false est déjà valide) et la validation atomique est conservée. snapshot() ne doit pas modifier l'état vivant, sinon sauvegarder change la suite de la partie. Le correctif physique déplace certains débris (toujours de façon déterministe) : revoir les attentes de simulation.test.mjs:1927-1996, les tests de collision étant obligatoires (AGENTS.md). Taille ajoutée négligeable par rapport au budget de 1 400 000 octets.

**Vérifier par.** node bench/loop/restorescan.mjs <ferro> 30 : zéro refus sur les 13 mondes. node bench/loop/rubblecause.mjs <ferro> 30 classic-0 puis campaign-10 : zéro débris posé en recouvrement. node bench/loop/e2e-restore.mjs <ferro> : plus de message « illisible ». Plus le nouveau test dans checks/.

**Contre-vérification.** Preuve indépendante dans le domaine principal de Node, avec un autre pilote que celui du premier tour (bench/loop-verif2/restore.mjs, motif b : tir continu, changement d'arme toutes les 5 s) : 4 mondes sur 4 refusent des points de reprise (classic-0 3/11, campaign-0 3/11, campaign-9 1/11, campaign-10 10/11), 100 % à simulation.js:2081, même résultat avec le même objet monde et avec un monde régénéré ; tous sont repris en vidant rubble ou en écrivant resting:false. MAIS la cause annoncée (« toujours un solide, aucune porte ») est incomplète : dans 3 mondes sur 4 la boîte fautive est une boîte de piège mobile (lame ou presse, savedTrapBoxes, simulation.js:2054 et 2069) qui traverse un débris déjà posé, profondeur 0,37 à 0,44 m, refus intermittent (t=24, 27, 33 s mais pas 30). Seul campaign-10 échoue sur des solides (1 à 8 débris fautifs, 0,001 à 0,204 m). Conséquence : le point 2 de la proposition (interdire la pose en interpénétration) ne corrige pas le cas des pièges ; le point 1 (resting:false à la sérialisation) le corrige mais crée un écart entre partie continuée et partie restaurée ; voir LOOP-V2 pour le correctif côté restore. Les tests de corruption (checks/simulation.test.mjs:1933-1940) ne portent pas sur le recouvrement : assouplir la ligne 2081 ne les casse pas tant que 2080 reste stricte.

**Preuve corrigée.** restore.mjs et restore2.mjs (bench/loop-verif2) : refus 3, 3, 1, 10 sur 11 ; lignes {2081} ; boîte fautive = piège (0,370 / 0,374 / 0,445 m) dans classic-0, campaign-0, campaign-9 ; solide (0,001 à 0,204 m, jusqu'à 8 débris) dans campaign-10.

**Gain corrigé.** Inchangé sur le fond (plus aucun refus), à condition de traiter aussi les boîtes de piège ; taux de refus selon le pilote : 1 à 10 sur 11 (et non 5 à 10).

### LOOP-02 — Des recherches A* vouées à l'échec bloquent un pas de simulation 97 à 175 ms
- sévérité critique · catégorie saccade · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité identique · jeu
- lieux : src/simulation.js:1389; src/simulation.js:1402-1430; src/simulation.js:1529-1531; src/simulation.js:1742

**Preuve.** 1) spikes.mjs (campaign-9, 30 s, JIT chaud) : p50 1,1 ms, p99 8,3 ms, max 174,6 ms. Les 5 pires pas (97,7, 103,9, 119,8, 120,5 et 174,6 ms) passent tous par updateEnemies → plan → route, qui prend à lui seul 88 à 164 ms. 2) routes.mjs : campaign-9 fait 26 recherches A*, dont 18 échouent ; ces échecs coûtent 707 des 755 ms (94 %), et 7 recherches touchent le plafond de 2 400 nœuds. legacy-s0 : 16 échecs sur 24, soit 425 des 488 ms (87 %), dont 3 au-dessus de 90 ms. Un échec à froid explore 2 323 à 2 400 nœuds et appelle 4 078 à 4 390 fois segmentFree, pour 97 à 142 ms ; le même échec avec le cache d'arêtes rempli ne fait que 295 à 486 appels, pour 13 à 21 ms. 3) Dans la boucle réelle (play.mjs q60, campagne 9) : sim.step au plus 90,4 ms, image au plus 96,5 ms, p99 des images 34,6 ms. 4) Code : route() (simulation.js:1402-1430) plafonne l'exploration à 2 400 nœuds (1414) et teste les arêtes paresseusement avec segmentFree (1420) ; pour un rayon > 0,4 ce test n'est jamais mis en cache (1421). refreshNav vide tout le cache (edgeKnown.fill(0), 1389) et remet planWait=0 à tous les ennemis. Le budget routeBudget vaut advanced?2:Infinity (1742). Un ennemi bloqué depuis plus de 1,1 s relance une recherche, sans recul après un échec (1529-1531).

**Cause.** Quand la cible est hors de la composante connexe du départ (joueur sur un relief ou une caisse, cellule cible isolée), l'A* explore toute la composante, environ 2 330 nœuds, avant d'échouer. Après une destruction le cache d'arêtes est vide, donc chaque nœud exploré coûte jusqu'à 4 segmentFree d'environ 0,03 ms. Rien ne mémorise l'échec et rien ne borne le temps passé par pas.

**Proposition.** 1) Mémo d'inaccessibilité, exact. Quand le tas se vide sans trouver end (explored<2400, rayon ≤ 0,4), donner aux nœuds fermés (routeClosed===stamp) un identifiant de composante dans un Int32Array routeComp, avec un numéro de génération. À la recherche suivante, si routeComp[start] porte une composante valide et que routeComp[end] en diffère, renvoyer null tout de suite tout en décrémentant routeBudget comme avant. Invalider le mémo dans refreshNav, quand pumpNav modifie nav, et dans restore ; n'en créer que si navPending===0. 2) Recul après échec : e.planWait=.8+(e.id%5)*.1, et viser la cellule explorée la plus proche de la cible (heuristique minimale, connue à la fin de la recherche) plutôt que rester immobile. 3) Invalidation ciblée : refreshNav ne remet à zéro edgeKnown et edgeOpen que dans l'AABB des colliders modifiés, élargie de 0,4 m et d'une cellule (voir LOOP-04). 4) Plafond par pas : un budget global d'expansions (par exemple 600 par pas) et un tas typé (Int32Array et Float32Array) sans allocation de [i,cost] à chaque push.

**Gain attendu.** Disparition des pics A* de 97 à 175 ms ; cible : pas maximal sous 10 ms sur campaign-9 et legacy-s0. Le temps passé dans route() baisse de 85 à 94 % (part des échecs). L'invalidation ciblée seule rend un échec 6 à 8 fois moins cher.

**Risques.** Le mémo (point 1) donne exactement les mêmes résultats si routeBudget est décrémenté de la même façon. Les points 2 et 4 changent le comportement de l'IA, de façon déterministe : revoir les tests IA et navigation, et se coordonner avec l'axe IA. Les grands rayons ont un graphe plus restreint, d'où le mémo limité aux recherches à rayon ≤ 0,4. Aucun impact sur le format de sauvegarde (cache non sérialisé).

**Vérifier par.** node bench/loop/routes.mjs <ferro> campaign-9 30 puis legacy-s0 : aucune recherche au-dessus de 50 ms. node bench/loop/spikes.mjs <ferro> campaign-9 30 : max et nombre de pas au-dessus de 16 ms. Plus les tests de navigation et d'IA de checks/.

**Contre-vérification.** Mécanisme et comptes confirmés à l'identique dans le domaine principal (bench/loop-verif2/routes.mjs) : campaign-9 motif a = 26 A*, 18 échecs, 7 au plafond, 4 078 à 4 390 segmentFree à froid ; classic-0 = 40 A*, 31 échecs. En revanche les durées du premier tour sont gonflées par node:vm d'un facteur 3 à 4 : un échec à froid coûte 22 à 40 ms (une fois 69 ms sous charge), pas 97 à 175 ms ; à chaud 1,1 à 4,4 ms. Les pas longs sont déterministes (10,97 s, 11,28 s, 19,75 s, 24,33 s, 28,78 s : 23 à 40 ms chacun, retrouvés sur 3 exécutions) ; les autres pics observés (47 à 63 ms sans route) ne se reproduisent pas : bruit de machine. Sévérité ramenée de critique à haute, mais reste la première cause de saccade de la simulation (1 à 2 images perdues à 60 Hz, 3 à 6 à 144 Hz, bien plus sur mobile). Limite de la proposition : le mémo d'inaccessibilité (point 1) ne couvre que les échecs par tas vide (11/18, 24/31) ; les échecs au plafond de 2 400 nœuds n'en profitent pas (7/18, 7/31, et 7/7 avec le motif b). Il faut donc aussi le recul après échec (un même ennemi échoue 11 à 24 fois en 30 s) et surtout ne plus vider edgeKnown globalement (un échec à chaud coûte 6 à 20 fois moins). Qualité « identique » pour les points 1 et 3 seulement (cache pur : état de simulation égal à prouver par rejeu) ; les points 2 et 4 modifient les décisions de l'IA et se valident à part.

**Preuve corrigée.** Domaine principal, 30 s : campaign-9 a : A* 228,8 ms dont échecs 216,9 ms (95 %), 17 % du CPU de simulation, 7 pas > 16 ms, max 40 ms hors bruit ; classic-0 a : 224,5 ms dont 214,4 ms d'échecs, 19,2 % ; campaign-9 b : 70,7 ms dont 68 ms d'échecs (7 sur 7 au plafond). Pas de simulation : p50 0,32 à 0,41 ms, p99 3,9 à 6,4 ms.

**Gain corrigé.** Suppression de 5 à 7 pas de 23 à 40 ms par 30 s (et non 97 à 175 ms) ; −15 à −19 % de CPU de simulation moyen. Critère d'acceptation à recaler : aucun pas > 8 ms et ≤ 500 segmentFree par recherche échouée.

### LOOP-03 — Un point de reprise pendant un recalcul de navigation fige le jeu 42 à 155 ms
- sévérité haute · catégorie saccade · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:1379-1390; src/simulation.js:1941-1959; src/game.js:94-100; src/game.js:238

**Preuve.** 1) snapshot() contient `if(navPending)pumpNav(nav.length);syncArmor();` (simulation.js:1944), puis invalidateBrain() (1945) : il termine d'un coup toute la file de navigation. game.js:98-100 enchaîne ensuite snapshot, JSON.stringify et localStorage.setItem dans la même image. 2) snapshot.mjs : un point de reprise normal coûte 0,76 à 2,89 ms de snapshot plus 0,26 à 1,14 ms de stringify (82 000 à 274 000 caractères). Juste après une explosion, avec la file pleine : 92 à 155 ms (classic-0 132,5 ; campaign-9 92,1 ; campaign-17 107,2 à 154,6). En combat, file partiellement consommée : 41,8 à 49,0 ms. 3) refreshNav (1383-1390) remet en file toute la grille (36 192 à 43 172 cellules), traitée à 768 cellules par pas (1379-1382). Il faut donc environ 0,9 s après chaque destruction pour vider la file ; navPending est non nul sur 17 à 41 % des pas de combat. 4) Les sauvegardes se déclenchent en pleine action (game.js:238 : checkpointDue, ou atterrissage après checkpointPending).

**Cause.** La file de navigation n'est pas sérialisée, donc snapshot() la matérialise de façon synchrone. saveCheckpoint ne diffère la sauvegarde que pour airborne, pas quand une navigation est en attente.

**Proposition.** 1) Dans saveCheckpoint, différer la sauvegarde tant que la navigation est en attente, comme on le fait pour airborne, avec une échéance de 1,5 s au-delà de laquelle on force. Il faut exposer navPending dans l'API publique (simulation.js:2219). 2) Sortir la sérialisation de l'image : prendre checkpoint=sim.snapshot() tout de suite, puis faire JSON.stringify et setItem dans setTimeout(…,0) ou requestIdleCallback(…,{timeout:500}), en regroupant les demandes rapprochées. 3) Avec le rafraîchissement ciblé de LOOP-04, la file tombe de 37 000–44 000 à quelques centaines de cellules et la matérialisation passe sous 1 ms. 4) En option, une version suivante du format qui sérialise la file (navHead, navTail, indices) au lieu de la vider, seulement si les points 1 à 3 ne suffisent pas.

**Gain attendu.** Plus de blocs de 42 à 155 ms aux points de reprise. Il ne reste que 1 à 4 ms de snapshot et de stringify, hors de l'image.

**Risques.** snapshot() a des effets de bord sur la partie en cours (fin du calcul de navigation, invalidateBrain) : en différer le moment change les trajectoires de l'IA, de façon déterministe. Garder checkpoint en mémoire avant l'écriture différée. L'échec de setItem (quota) est déjà géré par saveAvailable. Le format ne change pas pour les points 1 à 3.

**Vérifier par.** node bench/loop/snapshot.mjs <ferro> (champ snapshotWithPendingNavMs et coût dans l'image) ; MARK=1 node bench/loop/play.mjs <ferro> 30 q60 9 : aucune image au-dessus de 33 ms qui contienne sim.snapshot ; tests de progression et de reprise existants.

**Contre-vérification.** Code confirmé (simulation.js:1944 : if(navPending)pumpNav(nav.length)) et comptes confirmés (bench/loop-verif2/snap.mjs, campaign-9 : navPending max 36 192, 48 pas pour vider, 18,2 % des pas avec file non vide). Durées gonflées par node:vm : avec 26 208 cellules en attente snapshot coûte 15,9 à 31,9 ms (médiane 17,6 ms, 7 mesures par rejeu), soit environ 24 ms file pleine, et non 92 à 155 ms ; sans file 1,7 à 3,3 ms plus 0,7 à 1,4 ms de JSON. C'est une image perdue à 60 Hz à certains points de reprise : sévérité ramenée à moyenne. Le point 1 (différer tant que navPending, échéance 1,5 s) suffit et coûte peu ; exposer navPending existe déjà via state.aiStats.navPending (simulation.js:1381), inutile d'élargir l'API. Écarter le point 2 (stringify et setItem hors image) : gain ≤ 1,4 ms et risque de perdre le point de reprise si l'onglet se ferme entre-temps. Image et son inchangés ; l'instant du point de reprise se décale de façon déterministe.

**Preuve corrigée.** snap.mjs : navPending 26 208 → snapshot 15,9 / 17,1 / 17,6 / 18,0 / 21,3 / 31,9 ms ; navPending 7 008 → 5,7 à 8,0 ms ; navPending 0 → 1,7 à 3,3 ms.

**Gain corrigé.** Suppression d'un blocage de 16 à 32 ms (et non 42 à 155 ms) aux points de reprise pris dans les 0,8 s qui suivent une destruction.

### LOOP-04 — Chaque révision de destruction reconstruit tout : 24 à 31 ms côté rendu, toute la navigation côté simulation
- sévérité haute · catégorie saccade · effort L · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur et jeu
- lieux : src/game.js:152-156; src/game.js:716; src/renderer.js:768; src/renderer.js:1373-1381; src/simulation.js:229-231; src/simulation.js:995-999; src/simulation.js:1379-1390

**Preuve.** 1) syncDestruction (game.js:152-156 et 716) appelle renderer.updateWorld (renderer.js:1373-1381). Celui-ci recalcule spatialIndex sur tous les maillages (renderer.js:768, avec des clés chaîne floor(x/8)+','+floor(z/8)) et vide les caches statiques, ce qui force un re-pack complet. 2) worldupdate.mjs : updateWorld coûte 23,8 à 30,7 ms par révision, dont 7,7 à 12,2 ms pour spatialIndex. Le re-pack statique ajoute 4,5 à 8,4 ms et renvoie 0,89 à 1,11 Mo de sommets. On compte 8 à 28 révisions par 20 à 30 s de combat. 3) Côté simulation, simulation.js:229-231 enchaîne rebuildCollision, navDirty puis refreshNav (1383-1390). Toute la grille est remise en file (36 000 à 44 000 cellules, soit environ 92 à 137 ms de pumpNav étalés sur environ 0,9 s ; pumpNav pèse 20,9 ms par seconde simulée, jusqu'à 5,6 ms par pas). edgeKnown est vidé et tous les ennemis perdent leur chemin (planWait=0), ce qui déclenche les A* à froid de LOOP-02. 4) spikes.mjs (campaign-9) : un pas qui contient une révision coûte 18,1 ms en moyenne (6,7 ms sans celui qui cumule une A* échouée), contre 1,84 ms sans révision. updateDebris monte jusqu'à 13 à 20 ms dans un pas juste après une explosion.

**Cause.** La destruction ne fournit pas de delta : le rendu comme la simulation traitent chaque révision comme un monde entièrement nouveau.

**Proposition.** 1) FDestruction expose le delta de chaque révision : identifiants retirés et ajoutés, et AABB sale (union des boîtes avant et après). 2) Rendu : index spatial incrémental (Map à clé numérique (ix+512)*1024+(iz+512), ou grille typée) dans lequel on ne retire et n'ajoute que les maillages touchés ; découper le lot statique en tronçons de 8 x 8 m et ne re-packer que ceux qui croisent l'AABB sale. 3) Simulation : refreshNav(aabb) ne remet en file que les cellules de l'AABB élargie (0,4 m de rayon plus une cellule), n'efface edgeKnown et edgeOpen que là, et ne remet planWait=0 qu'aux ennemis dont le chemin ou la cible traverse cette zone. 4) Débris : réutiliser la liste de boîtes d'un sous-pas à l'autre dans debrisBoxes (995-999) au lieu de recréer un Set et un filter à chaque fois.

**Gain attendu.** Une révision coûterait environ 2 à 5 ms au lieu de 24–31 ms de rendu plus 5–10 ms de simulation. Pour un rayon d'explosion de 3,2 à 3,4 m et des cellules de 0,5 m, la file de navigation passe de 37 000–44 000 à environ 300–1 000 cellules, soit 1 à 2 pas d'attente au lieu d'environ 0,9 s. LOOP-02 et LOOP-03 en profitent aussi.

**Risques.** Le delta doit être exact : une cellule oubliée donne une navigation fausse. Il faut donc un test d'équivalence : après N explosions, nav et edgeOpen calculés de façon ciblée doivent être identiques à un recalcul complet (les tests de collision sont obligatoires selon AGENTS.md). snapshot et restore ne changent pas tant que la navigation reste dérivée. À coordonner avec l'axe 3D (lots statiques, repli Canvas2D) et l'axe IA. Taille ajoutée d'environ 2 à 4 Ko.

**Vérifier par.** node bench/loop/worldupdate.mjs <ferro> (ms par révision) ; node bench/loop/spikes.mjs <ferro> campaign-9 30 (pas contenant une révision) ; nouveau test d'équivalence entre navigation ciblée et complète dans checks/simulation.test.mjs.

**Contre-vérification.** Structure confirmée (révision = index spatial complet + caches statiques vidés côté rendu, grille de navigation entière remise en file côté simulation : 36 192 cellules mesurées). Les 24 à 31 ms côté rendu sont réfutés : dans le domaine principal (bench/rcpu/destr.mjs rejoué, charge modérée) updateWorld vaut 2,9 à 4,0 ms en p50 et 5,1 à 6,4 ms au pire, le dessin de l'image suivante +0,4 à 0,6 ms, et le pas de simulation de l'image de révision 3,9 à 6,8 ms en moyenne (12,3 ms au pire) contre 0,44 à 0,72 ms en p50 ailleurs. Une image de révision coûte donc 8 à 12 ms au lieu d'environ 1,5 ms : sous le budget à 60 Hz sur ce Mac, au-dessus à 144 Hz et sur machine lente. Sévérité ramenée à moyenne. Doublon de RCPU-02 pour la partie rendu (index incrémental : 2,3-2,8 → 0,53-0,75 ms) : fusionner, partie rendu dans FERRO (renderer.js), priorité P2. La partie navigation (refreshNav ciblé sur l'AABB sale, edgeKnown non vidé globalement) va dans METAL et mérite P1 car elle supprime à la source les A* à froid de LOOP-02 et la file de LOOP-03. Le test d'équivalence nav ciblée contre nav complète est indispensable ; le delta doit rester optionnel dans FERRO (updateWorld sans delta = comportement v0.2).

**Preuve corrigée.** destr.mjs camp:9 : updateWorld p50 2,92 ms, max 5,06 ; classic:0 : p50 4,03, max 6,35 ; sim.step en image de révision : moyenne 3,89 et 6,82 ms, max 5,48 et 12,3 ms. Le chiffre de 24 à 31 ms venait du contexte node:vm.

**Gain corrigé.** Image de révision : environ 8 à 12 ms → 1,5 à 3 ms (estimé) ; file de navigation 36 192 → quelques centaines de cellules (estimé, inchangé).

### LOOP-05 — ceil(dt*60) fait 2 sous-pas par image à 59,94 Hz ou avec des horodatages arrondis : +37 à 39 % de CPU de simulation
- sévérité haute · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/game.js:677; src/game.js:690-696; src/simulation.js:432; src/simulation.js:1035; src/simulation.js:1068; src/simulation.js:1902

**Preuve.** 1) game.js:690 : `const steps=Math.max(1,Math.ceil(dt*60)),part=dt/steps;`, avec dt plafonné à 0,12 s (677). 2) play.mjs et steps.mjs : on fait en moyenne 1,409 sous-pas par image à 60 Hz exact (erreurs flottantes), 1,667 à 60 Hz avec des horodatages arrondis à 0,1 ms comme dans les navigateurs (400 images à 1 pas, 800 à 2), 2,0 à 59,94 Hz et 2,59 à 30 Hz. 3) splitcost2.mjs, par rejeu déterministe : 2 pas de 1/120 coûtent 1,37 à 1,39 fois un pas de 1/60 (127,8→177,9 et 92,0→125,9 ms par seconde simulée), et un pas de 1/40 en coûte 0,78 à 0,93 fois. 4) La simulation découpe déjà en interne ce qui en a besoin : locomotion à 120 Hz (simulation.js:432), projectiles à 120 Hz (1068), débris à 80 Hz (1035), et dt est borné à 0,05 (1902). Les tests appellent step(.025) (148 appels) et progression.test.mjs:136-142 vérifie le comportement à 20, 60 et 120 Hz.

**Cause.** Le découpage à 1/60 coupe en deux toute image à peine plus longue que 16,667 ms. Le coût fixe d'un pas (IA, 768 cellules de navigation, rencontres, événements), environ 38 % d'un pas, est alors payé deux fois sans rien gagner, puisque la simulation sous-échantillonne déjà en interne.

**Proposition.** Passer à un pas variable borné, aligné sur celui des tests : `const MAX_STEP=1/40;const steps=Math.max(1,Math.ceil(dt/MAX_STEP-1e-6)),part=dt/steps;`. Je déconseille le 120 Hz fixe avec interpolation : il coûte autant que le cas B (+37 à 39 %) et retarde l'affichage du mouvement de 8,3 ms. Un 60 Hz fixe avec interpolation (+16,7 ms de retard) n'aurait d'intérêt que pour des replays, du multijoueur, ou pour plafonner le CPU sur les écrans 144–240 Hz (environ x1,5 à x2,1 de CPU de simulation par seconde d'après le coût fixe mesuré). Exprimer aussi pumpNav en cellules par seconde (ceil(46080*dt)) pour qu'il ne dépende plus du nombre de pas.

**Gain attendu.** CPU de simulation : −28 % à 59,94 Hz, −20 % à 60 Hz avec horodatages arrondis, −13 % à 60 Hz exact. À 30 fps, 2 pas de 16,7 ms au lieu de 2 ou 3 ; au pire 5 pas au lieu de 8 pour dt=0,12, ce qui éloigne la spirale de ralentissement. Aucune latence ajoutée.

**Risques.** À cadence égale, les trajectoires changent, mais restent déterministes pour une suite de dt donnée. La robustesse aux grands pas est déjà assurée par les sous-pas internes. Les tests en .025 et progression.test.mjs:136-142 ne changent pas. À 144 Hz rien ne bouge : un pas par image dans les deux schémas. Aucun impact sur le format de sauvegarde.

**Vérifier par.** node bench/loop/play.mjs <ferro> 20 59.94 9, puis q60 et 30 (steps.perFrame et p95 des images) ; node bench/loop/splitcost2.mjs <ferro> campaign-9 8 ; npm test, dont la progression à 20, 60 et 120 Hz.

**Contre-vérification.** Arithmétique reproduite : avec game.js:690, 1,667 sous-pas par image à 60 Hz avec horodatages arrondis à 0,1 ms, 1,83 à 2,0 à 59,94 Hz, 2,0 à 50 Hz, 2,33 à 2,45 à 30 Hz ; avec ceil(dt*40−1e-6) : 1,000 à 50, 59,94, 60 et 75 Hz, 2,0 à 30 Hz. Coût mesuré dans le domaine principal par tranches appariées de 0,1 s simulée, trois simulations en parallèle (bench/loop-verif2/split2.mjs, charge 20) : 2 pas de 1/120 coûtent ×1,49 à ×1,73 un pas de 1/60 (médianes ; ×1,06 à ×1,9 en temps CPU sur rejeux entiers, bruité), soit au moins le ×1,37-1,39 annoncé. En valeur absolue le gain reste petit sur ordinateur (pas médian 0,17 à 0,4 ms : 0,1 à 0,3 ms par image), sensible sur mobile : sévérité moyenne. Le rapport « 1/40 = ×0,78 à 0,93 » n'est pas reproduit (×1,03 à 1,24, trajectoires différentes, bruit) mais ne conditionne pas le gain à 60 Hz. RISQUE non signalé : exprimer pumpNav en ceil(46080*dt) donne 1 152 cellules au pas des tests (0,025) et casse checks/simulation.test.mjs:1866 (navUpdates <= 768) ; ne pas toucher à pumpNav, ou borner par min(768, ceil(30720*dt)). Image et son identiques ; trajectoires différentes à cadence égale mais déterministes, comme déjà d'un écran à l'autre.

**Preuve corrigée.** split2.mjs : campaign-9 2x120 / 1x60 = 1,49 (médianes), 1,66 (ratio médian par tranche) ; classic-0 = 1,73 et 1,70.

**Gain corrigé.** CPU de simulation à 60 Hz arrondi : environ −29 à −33 % (1,667 → 1 sous-pas avec un surcoût de ×1,5 à 1,7 par dédoublement) ; à 50 et 59,94 Hz : −33 à −41 %.

### LOOP-06 — Le tir n'est pas verrouillé : un clic court entre deux images, ou pendant le délai de l'arme, est perdu
- sévérité haute · catégorie entrées · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/game.js:686; src/game.js:805; src/game.js:816; src/game.js:830-831; src/game.js:834-837; src/simulation.js:1114-1115; src/simulation.js:1917

**Preuve.** 1) game.js:686 : `input.fire=mouseFire||touchFire||held('fire')` échantillonne un état tenu une fois par image. mousedown met mouseFire à true (816), et le relâchement le remet à false avant l'image suivante. À l'inverse, l'esquive, l'impulsion, la mêlée et l'interaction sont verrouillées (variables *Queued, game.js:805 et 834-837). 2) La simulation tire par `if(input.fire)fire(input.assist)` (simulation.js:1917), avec un délai de 0,32 s au pistolet (1114). 3) clicks.mjs (60 s de clics, écart moyen 250 ou 330 ms, appui de 25 à 80 ms) : à 20–30 fps, 20 à 27 % des clics arrivés arme prête ne tirent jamais, contre 0 % avec un verrou d'appui. Avec un tampon d'intention de 150 ms, la part des clics trop tôt finalement servis passe de 4–34 % à 46–56 %.

**Cause.** Le tir est le seul ordre ponctuel traité comme un état tenu. Un appui suivi d'un relâchement plus court qu'une image n'existe tout simplement pas pour la simulation.

**Proposition.** 1) Ajouter firePressed (et fireLeftPressed), mis à true par mousedown, touchstart et keydown (hors répétition), et consommé dans frame() : input.fire=held||firePressed pour le premier sous-pas seulement. 2) Tampon de 150 ms côté jeu : garder l'appui tant que sim.state.shots n'a pas augmenté et que now−pressT<150 ms, sans transmettre d'horodatage à la simulation ; l'effacer quand shots augmente ou quand l'arme change.

**Gain attendu.** Plus aucun clic perdu arme prête (20 à 27 % aujourd'hui à 20–30 fps) et 12 à 52 points de plus de clics précoces servis. Pour le joueur, l'arme répond toujours.

**Risques.** La simulation ne change pas : l'entrée reste un booléen par pas, donc aucun impact sur le déterminisme ni sur la sauvegarde. Il faut consommer l'appui après le premier sous-pas pour qu'un clic ne tire pas deux fois. Sans effet sur les armes automatiques tenues. À appliquer aussi au tactile et au clavier AZERTY/QWERTY (AGENTS.md).

**Vérifier par.** Reporter la logique dans game.js, puis node bench/loop/clicks.mjs <ferro>. Test de frame() dans le harnais : un mousedown suivi d'un mouseup entre deux rAF doit donner shots+1.

**Contre-vérification.** Code relu : game.js:686 échantillonne mouseFire une fois par image, 816 et 823 l'arment et le désarment, alors que dash, pulse, melee et interact sont verrouillés (805, 834-837). La perte se démontre sans banc : un appui de durée p dans une image de durée T est perdu avec la probabilité max(0, 1−p/T). Les 20 à 27 % du premier tour valent pour des appuis de 25 à 40 ms à 20-30 fps ; à 60 fps un clic souris normal (60 à 120 ms) n'est jamais perdu. Le vrai cas fréquent n'était pas cité : le toucher-pour-cliquer d'un pavé tactile et un tap bref sur #fire-button (830-831) envoient appui et relâchement dans la même image et sont perdus à toute cadence. Le verrou d'appui ne touche pas la simulation (booléen par pas). Le tampon de 150 ms est un choix de ressenti (répond à « pas assez vif ») : à livrer avec une constante réglable. Ne pas armer le verrou sur le clic qui reprend le pointeur (voir LOOP-10).

**Gain corrigé.** 0 clic perdu arme prête ; gain réel surtout sur pavé tactile, tactile et sous 40 fps (à 60 fps souris : déjà 0 %).

### LOOP-07 — Aucune prise en charge de la manette
- sévérité haute · catégorie entrées · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : src/game.js:675-700; src/game.js:805-837; src/options.js; src/simulation.js:1917

**Preuve.** Aucune occurrence de getGamepads ni de gamepad dans src/*.js. options.js ne propose aucune liaison manette. frame() (game.js:675-700) ne lit que le clavier, la souris et le tactile, alors que l'assistance de visée existe déjà côté simulation (input.assist, simulation.js:1917). Les retours joueurs demandent explicitement de pouvoir jouer à la manette.

**Cause.** L'entrée manette n'a jamais été implémentée.

**Proposition.** Créer une fonction pure et testable sans DOM, padInput(pad,prev,prefs,dt), appelée en tête de frame() sur navigator.getGamepads() avec le mapping standard. Sticks : zone morte radiale de 0,18 à gauche et 0,12 à droite avec remise à l'échelle, courbe r^2,2, lacet 4,2 rad/s et tangage 2,6 rad/s, accélération jusqu'à 7 rad/s après 0,25 s au-delà de r=0,95. Gâchettes : RT pour le tir, LT pour la main gauche, hystérésis 0,35/0,20 et front montant verrouillé comme en LOOP-06. Boutons : A esquive, B mêlée, X interagir, Y ou RB arme suivante, LB impulsion, L3 sprint, Start pause, Back carte, croix pour les armes. Mettre input.assist=true quand la manette est active, vibrer avec vibrationActuator.playEffect('dual-rumble') sur les tirs lourds et les dégâts, afficher un toast à gamepadconnected, et rendre les menus navigables au focus (croix, A, B). Options : sensibilité, inversion, zone morte.

**Gain attendu.** Le jeu devient jouable de bout en bout à la manette, comme demandé par les joueurs, avec une visée contrôlée par la courbe et l'assistance existante.

**Risques.** L'API est en lecture seule : aucun effet sur la simulation ni sur le format de sauvegarde. Safari et Firefox n'exposent la manette qu'après un appui. Les règles AZERTY/QWERTY et tactile ne sont pas touchées. Environ 4 à 6 Ko sur le budget de 1 400 000 octets.

**Vérifier par.** Test node de padInput avec axes et boutons synthétiques : entrée attendue, hystérésis, zone morte, front montant. Puis essai réel avec une manette standard sous Chrome et Firefox.

**Contre-vérification.** Confirmé : aucune occurrence de gamepad ni getGamepads dans METAL src/*.js. Demande explicite de David, donc P0. Doublon de FEEL-10 et FEEL-11 : fusionner en un seul lot. Élément manqué : BITUME a déjà une manette (bitume/src/jeu.js:219-246 : zone morte 0,12, courbe puissance 1,6, fronts montants via pad.precedent, navigation des menus à la croix, sortie de démo au premier geste). La lecture générique (interrogation, zones mortes radiales, hystérésis des gâchettes, fronts montants, vibration, branchement à chaud) sert donc deux jeux et va dans FERRO ; le mappage FPS (visée, courbe, accélération de rotation, assistance) reste dans METAL. Vérifier que input.assist est bien lu (simulation.js:1917) et que l'assistance n'est active que lorsque la manette est la dernière source d'entrée. La pause sur blur (game.js:838) ne gêne pas la manette.

### LOOP-08 — La cadence des armes est arrondie au pas : 6 à 16 % de tirs en moins, et des dégâts par seconde qui dépendent des fps
- sévérité moyenne · catégorie ressenti · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:1114-1115; src/simulation.js:1904-1905; src/simulation.js:2008; src/simulation.js:2100

**Preuve.** 1) Le minuteur est remis à la valeur du délai, sans reliquat : `weaponWait[weapon]=delay;fireWait=Math.max(fireWait,delay);` (simulation.js:1115). Les décréments sont planchés à zéro, `Math.max(0,x-dt)` (1904-1905). Le reliquat inférieur au pas est donc jeté, et chaque tir attend un nombre entier de pas. 2) firerate2.mjs, mitraillette (délai 0,125 s, soit 80 tirs en 10 s nominal) : 67 tirs au pas des tests (25 ms), 72 à 20 ms, 75 à 16,7, 8,3 et 33,3 ms, 80 à 6,94 ms (144 Hz). 3) restore exige weaponWait dans [0, délai] et fireWait dans [0 ; 1,25] (simulation.js:2008 et 2100).

**Cause.** Le minuteur repart de delay au lieu de delay plus le reliquat du pas. Le concept de report du reliquat vient de Quake 3 ; aucun code n'en est repris.

**Proposition.** Dans fire(), écrire weaponWait[w]+=delay au lieu de =delay, et fireWait=Math.max(fireWait,weaponWait[w]). Pendant l'appui, décrémenter sans plancher (x-=dt), puis en fin de pas faire `if(!input.fire||x<-dt)x=Math.max(0,x)`. Les valeurs restent ainsi positives ou nulles à chaque fin de pas, donc snapshot et restore ne changent pas.

**Gain attendu.** Une cadence exacte (80 tirs en 10 s) quelle que soit la cadence d'image. Pour la mitraillette, 6,7 % de tirs en plus à 60 Hz et 19 % au pas des tests, et la même puissance de feu à 60 qu'à 144 Hz. Cela répond aussi au retour « gameplay rigide ».

**Risques.** Les dégâts par seconde réels augmentent : l'équilibrage peut demander d'allonger certains délais. Les tests qui comptent les tirs au pas de 0,025 changent de valeur attendue (les tests de combat sont obligatoires, AGENTS.md). Il faut garantir le plancher à zéro avant tout snapshot, la validation imposant des valeurs positives ou nulles. Le déterminisme est préservé.

**Vérifier par.** node bench/loop/firerate2.mjs <ferro> : 80 tirs en 10 s à tous les pas. Mettre à jour les tests de combat de checks/ et lancer npm test.

**Contre-vérification.** Confirmé par lecture et arithmétique : weaponWait[w]=delay (simulation.js:1115) et planchers à zéro (1904-1905) arrondissent chaque intervalle au pas supérieur ; 0,125 s / (1/60) = 7,5 → 8 pas → 75 tirs en 10 s au lieu de 80. DÉFAUT dans la mise en œuvre proposée : quand le tir est tenu mais que fire() sort avant la ligne 1115 (surchauffe ligne 1113, plus de munitions ligne 1110), weaponWait reste négatif en fin de pas (il oscille entre 0 et −dt), et un point de reprise pris à ce moment est refusé par restore (simulation.js:2008 exige ≥ 0). Variante sûre : garder les planchers et mémoriser pour le pas courant le reliquat carry[i]=max(0, dt−ancienneValeur) uniquement si ancienneValeur>0, puis dans fire() écrire weaponWait[w]=max(0, delay−carry[w]) ; l'état reste ≥ 0, non sérialisé, format inchangé. Effet de jeu : +6,7 % de cadence à 60 Hz pour la mitraillette, donc rééquilibrage et tests de combat à revoir ; c'est une mise en cohérence (144 Hz tire déjà à 80).

**Gain corrigé.** Cadence nominale à toute fréquence (75 → 80 tirs en 10 s à 60 Hz ; 67 → 80 au pas des tests).

### LOOP-09 — Le limiteur d'images se trompe hors multiples exacts : 37,5 fps pour une limite à 60 sur un écran 75 Hz
- sévérité moyenne · catégorie latence · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · moteur et jeu
- lieux : src/game.js:676-677; src/game.js:722; src/options.js

**Preuve.** 1) game.js:676 : `if(prefs.fpsLimit&&now-last<1000/prefs.fpsLimit-.5)return;`, puis last=now (677). 2) fpslimit.mjs (vsync arrondies à 0,1 ms, 20 s) : avec une limite de 60, on obtient 37,5 fps à 75 Hz, 45 à 90 Hz, 50 à 100 Hz, 48 à 144 Hz et 55 à 165 Hz. Avec une limite de 120 : 72 fps à 144 Hz et 82,5 à 165 Hz. Avec une limite de 30 : 25 fps à 75 et 100 Hz, 28,8 à 144 Hz. Une échéance cumulée atteint la moyenne demandée. 3) options.js n'offre que fpsLimit ∈ {0,30,60,120}, et game.js:722 coupe le gouverneur adaptatif sous 60.

**Cause.** L'intervalle est comparé à une période fixe, sans échéance cumulée. Une image arrivée 0,1 à 3 ms trop tôt est sautée, et la suivante n'arrive qu'à la vsync d'après.

**Proposition.** Mesurer la période d'affichage (médiane glissante des 30 derniers intervalles rAF). Si la limite atteint 95 % de la fréquence, ne rien limiter. Sinon calculer N=max(1,round(fréquence/limite)) et n'afficher qu'une vsync sur N, avec un compteur, pour une cadence régulière. À défaut, utiliser une échéance cumulée (due+=1000/limit, tolérance d'une demi-période) : moyenne exacte, mais écarts irréguliers. Afficher dans l'option la cadence réellement obtenue.

**Gain attendu.** La cadence demandée est respectée : par exemple 60 fps au lieu de 37,5 sur un écran 75 Hz, soit environ 10 ms de moins par image de latence d'entrée. Fin des alternances 13,9/20,8 ms.

**Risques.** Aucun impact sur la simulation ni sur la sauvegarde. Si la fréquence est mal estimée au démarrage, il faut la recalculer périodiquement.

**Vérifier par.** node bench/loop/fpslimit.mjs avec le nouvel algorithme (fps et écarts) ; test unitaire du limiteur sur horodatages synthétiques.

**Contre-vérification.** Confirmé par l'arithmétique de game.js:676-677 (seuil 1000/limite−0,5 ms puis last=now) : limite 60 sur 75 Hz = 1 image sur 2 = 37,5 fps ; sur 144 Hz = 1 sur 3 = 48 fps ; sur 165 Hz = 55 fps ; limite 120 sur 144 Hz = 72 fps. Portée à préciser : fpsLimit vaut 0 par défaut (options.js:6), seuls les joueurs qui activent la limite sont touchés, mais 144 et 165 Hz sont les écrans des PC NVIDIA visés par David. La proposition « une vsync sur N » avec round donne 72 fps pour une limite de 60 sur 144 Hz : acceptable si l'option affiche la cadence réelle. Le limiteur est générique (options.js est dans FERRO) : petite fonction pure FOptions.frameGate ou équivalent dans FERRO, branchée dans game.js. Aucun effet sur l'image ; latence d'entrée réduite.

### LOOP-10 — Verrouillage du pointeur fragile, glisser pour regarder qui tire aussi, molette sans seuil
- sévérité moyenne · catégorie entrées · effort S · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/game.js:157-162; src/game.js:811; src/game.js:813; src/game.js:816-821

**Preuve.** 1) game.js:159 appelle canvas.requestPointerLock?.() sans {unadjustedMovement:true}, donc l'accélération du système s'applique à la visée. 2) lock() n'est appelé qu'après la préparation asynchrone (game.js:162 et 166-177, environ 458 ms de CPU d'après prep.mjs, 0,5 à 1,7 s en temps mur), alors que WebKit refuse le verrouillage hors d'un geste utilisateur. 3) Sans verrou, pointerdown démarre dragLook (game.js:819) pendant que mousedown met mouseFire=true (816) : regarder en glissant tire en continu, et un clic ne redemande pas le verrouillage. 4) game.js:811 appelle switchWeapon à chaque événement wheel : un pavé tactile ou une molette à inertie en envoie des dizaines, d'où des changements d'arme en rafale.

**Cause.** La gestion du pointeur a été pensée pour Chrome avec une souris à crans.

**Proposition.** 1) Appeler canvas.requestPointerLock({unadjustedMovement:true}), avec repli sans option sur NotSupportedError. 2) Sur un pointerdown souris sans verrou en mode jeu, redemander le verrouillage et ne pas compter ce clic comme un tir : mouseFire ne s'arme pas tant que pointerLockElement≠canvas, sauf mode glisser explicitement choisi. 3) Molette : cumuler deltaY (x33 si deltaMode=1, x innerHeight si deltaMode=2), changer d'arme une fois au-delà de 100 px, puis attendre 150 ms ; remettre l'accumulateur à zéro à chaque changement de sens.

**Gain attendu.** Une visée 1:1 sans accélération du système, plus de tir involontaire en regardant à la souris, et un seul changement d'arme par cran de molette.

**Risques.** unadjustedMovement n'existe pas dans Safari et Firefox (d'où le repli). Ignorer le clic qui verrouille peut surprendre : prévenir par un toast. Aucun impact sur la simulation ni sur la sauvegarde. Le comportement tactile ne change pas (AGENTS.md mobile et tactile).

**Vérifier par.** Dans harness.mjs : 30 événements wheel de deltaY=4 doivent donner un seul changement d'arme ; un pointerdown sans verrou doit appeler requestPointerLock sans changer shots. Puis essai réel sous Safari et Chrome.

**Contre-vérification.** Code relu : requestPointerLock sans option (game.js:159) ; lock() appelé seulement par start() (162) et à la reprise (731), aucun clic sur le canvas ne le redemande ; sans verrou pointerdown lance dragLook (819) pendant que mousedown arme mouseFire (816), donc regarder en glissant tire ; wheel appelle switchWeapon à chaque événement (811). Le refus du verrou par WebKit après la préparation asynchrone n'a pas été testé : plausible seulement. unadjustedMovement est le point le plus utile pour la demande « déplacements à la Quake 3 » (sous Windows l'accélération du pointeur s'applique aujourd'hui à la visée) ; à livrer activé par défaut avec une option « accélération du système », car la sensibilité ressentie change pour les joueurs actuels. Les navigateurs qui ignorent l'option ne rejettent pas ; prévoir quand même le repli sur NotSupportedError. Le seuil de molette est sans risque.

### LOOP-11 — Rendu complet à chaque image en pause, dans les menus, la boutique et l'écran de fin, sous un flou d'arrière-plan
- sévérité moyenne · catégorie perf-gpu · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/game.js:190; src/game.js:675-730; src/style.css:1; src/index.html:47; src/index.html:65; src/index.html:67-68

**Preuve.** 1) modes.mjs : renderer.draw est appelé 120 fois sur 120 images en pause, menu, boutique et résultat, avec 121 à 179 maillages. 2) `.modal-screen{…backdrop-filter:blur(10px)}` (style.css:1) s'applique à #pause, #shop, #result et #error (index.html:47, 65, 67, 68) : le flou est recalculé tant que le canvas en dessous change. 3) result() (game.js:190) prépare le secteur suivant sur le fil principal, et preparePlay coûte environ 458 ms de CPU (prep.mjs).

**Cause.** frame() dessine la scène quel que soit le mode.

**Proposition.** 1) Hors du mode playing, dessiner une seule fois à l'entrée dans le mode et après un redimensionnement ou un changement d'option, puis plus rien (ou au plus 10 fps si l'on veut une animation de fond) ; rAF ne sert plus qu'à l'interface. 2) Une fois le canvas figé, le navigateur peut garder le flou en cache. 3) Découper la préparation par des yields entre étapes pour garder l'écran de chargement animé.

**Gain attendu.** GPU quasi nul en pause et dans les menus, au lieu d'une image complète et d'un flou plein écran à chaque vsync ; moins de batterie et de chauffe sur portable et mobile.

**Risques.** Les menus perdent leur animation de fond. Redessiner une fois après un changement de qualité ou de luminosité en pause et après un redimensionnement. Le repli Canvas2D doit suivre la même règle. Aucun impact sur la simulation.

**Vérifier par.** node bench/loop/modes.mjs <ferro> : un seul draw par mode ; mesure GPU réelle dans le navigateur, hors des bancs node.

**Contre-vérification.** Code relu : frame() dessine dans tous les modes sauf loading (game.js:679 puis 722) et .modal-screen porte backdrop-filter:blur(10px) (style.css:1 ; #pause, #shop, #result, #error dans index.html:47, 65, 67, 68). Restriction nécessaire pour ne rien perdre : dans menu et options la caméra oscille (game.js:721, softMotion) et le temps avance (t=clock, ligne 717) ; y figer le rendu serait une perte de qualité. À limiter aux modes où t=sim.state.time et la caméra sont figés (paused, shop, result, dead, cleared) : l'image y est identique d'une vsync à l'autre, donc ne dessiner qu'à l'entrée dans le mode, au redimensionnement et à chaque changement d'option visible (qualité, ombres, bloom, champ de vision, luminosité). Le gouverneur est déjà inactif hors playing (adaptive, ligne 722). Gain non chiffré (GPU) : à mesurer dans Chrome avec le banc rgpu.

**Gain corrigé.** GPU quasi nul en pause, boutique et écrans de fin uniquement ; menus et options inchangés pour garder le fond animé.

### LOOP-12 — Le gouverneur de résolution est trompé par l'intervalle rAF
- sévérité moyenne · catégorie perf-gpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:746-763; src/game.js:677; src/game.js:722

**Preuve.** 1) renderer.js:746-763 : le gouverneur baisse l'échelle de 0,1 (jusqu'à 0,65) quand l'intervalle moyen dépasse 25 ms pendant 1,3 s, et la remonte de 0,05 quand il reste sous 18,5 ms pendant 5 s. Il est nourri par frameMs, c'est-à-dire l'intervalle rAF (game.js:677 et 722). 2) governor.mjs : avec rAF plafonné à 30 Hz (mode économie d'énergie, onglet ralenti, écran 30 Hz), l'échelle tombe à 0,65 en 12,3 s alors que le GPU est au repos. Avec une image sur 3 manquée, elle reste bloquée à 0,9. Les pics CPU de LOOP-02 à LOOP-04 font eux aussi baisser la résolution pour rien.

**Cause.** L'intervalle rAF mesure la cadence d'affichage et le travail CPU, pas le temps GPU.

**Proposition.** Nourrir le gouverneur avec le temps GPU mesuré par EXT_disjoint_timer_query_webgl2 quand l'extension existe (requêtes asynchrones, une image sur 4). À défaut, utiliser le temps CPU de draw plus l'estimation intervalle moins travail CPU. Ignorer les images où le CPU dépasse le budget, et celles où l'intervalle colle à une période vsync stable (signe d'un plafond). Viser 85 % de la période mesurée et garder l'hystérésis actuelle.

**Gain attendu.** Plus de résolution dégradée à tort (0,65 → 1,0 dans le cas 30 Hz) : l'image reste nette sur portable en économie d'énergie.

**Risques.** L'extension manque sur certains GPU et navigateurs (repli b). Adapter les tests existants du gouverneur. Aucun impact sur la simulation.

**Vérifier par.** node bench/loop/governor.mjs <ferro> (échelle finale par scénario) ; test unitaire du gouverneur avec des temps GPU synthétiques.

**Contre-vérification.** Code relu (renderer.js:746-763) et calcul refait à la main : à 33,3 ms d'intervalle la moyenne dépasse 25 ms, d'où une baisse toutes les 3,3 s après 1 s d'attente : 1 → 0,9 → 0,8 → 0,7 → 0,65 en environ 12,2 s, sans remontée possible (il faudrait < 18,5 ms). Vaut aussi pour un écran 50 Hz (20 ms : ni baisse ni remontée, l'échelle reste où elle est). quality vaut 'auto' par défaut (options.js:6) : le défaut touche tous les joueurs dont le rAF est plafonné (économie d'énergie macOS et iOS, onglets ralentis). C'est une perte de netteté injustifiée, donc prioritaire au regard de l'exigence « sans perdre la moindre qualité ». Le gouverneur est dans renderer.js, donc FERRO ; à fusionner avec les constats RCPU et RGPU sur le gouverneur (bench/rcpu-verif/v-gov.mjs). Le temps GPU par EXT_disjoint_timer_query_webgl2 n'existe pas partout : le repli « intervalle collé à une période stable = plafond, ne pas baisser » doit être le chemin par défaut et rester compatible avec un jeu v0.2 qui ne fournit que frameMs.

### LOOP-13 — HUD : 97 % d'écritures DOM inutiles, barres animées par width, surcouches plein écran en double
- sévérité basse · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité visuellement identique · jeu
- lieux : src/game.js:61; src/game.js:587-674; src/game.js:713-714; src/style.css:1; src/style.css:10; src/style.css:106; src/renderer.js:371-374; src/renderer.js:1573

**Preuve.** 1) play.mjs (campagne 9, q60, DOM factice qui compte les écritures) : chaque tic du HUD (toutes les 90 ms, game.js:713) fait 141,5 écritures, dont 3,8 seulement changent une valeur, soit 97,3 % de redondance. Les écritures identiques se répartissent en 48,7 textContent, 20,5 classes, 17,8 hidden, 15 attributs, 14 propriétés, 13 dataset et 8,7 styles. 2) renderHUD coûte 0,49 ms par tic, et drawRadar 104 opérations canvas par tic (game.js:660-674). game.js:714 réécrit l'opacité de #damage à chaque image. 3) `.bar i`, `#boss-bar` et `.armor-track i` sont animés par transition:width (style.css:1, 10 et 106) : chaque image de transition déclenche une mise en page. 4) #vignette (box-shadow inset 20vw) et #damage (inset 18vw 5vw) doublonnent le vignettage et le voile de dégâts déjà faits par le shader (renderer.js:371-374). 5) game.js:61 applique un filtre CSS brightness au canvas.

**Cause.** Les écritures DOM ne passent par aucun cache, et les effets plein écran sont faits deux fois (CSS et shader).

**Proposition.** 1) Petites fonctions setText(el,v), setStyle(el,k,v) et toggle(el,c,b) qui gardent la dernière valeur écrite et n'écrivent que si elle change. 2) Barres en transform:scaleX(v) avec transform-origin:left, et transition sur transform. 3) En mode WebGL, supprimer #vignette et #damage au profit des uniformes du shader (uEffects, renderer.js:1573), mais les garder pour le repli Canvas2D ; passer aussi la luminosité dans le shader. 4) Radar : dessiner la couche statique une fois dans un canvas hors écran et ne redessiner que les marqueurs. 5) Rafraîchir munitions et points de vie à l'événement (tir, dégât) plutôt qu'au tic de 90 ms.

**Gain attendu.** 97 % d'écritures en moins, plus de mise en page pendant les transitions, deux surcouches plein écran en moins (coût de remplissage sur mobile), et munitions et vie affichées sans les 0 à 90 ms de retard actuels.

**Risques.** Accessibilité (AGENTS.md) : ne pas réécrire une valeur inchangée est même préférable pour les régions aria-live. Le repli Canvas2D doit garder les surcouches CSS. Aucun impact sur la simulation.

**Vérifier par.** play.mjs : domPerHudTick, les compteurs textSame, clsSame, etc. doivent tomber à environ 0 ; enregistrement Performance de Chrome (mise en page pendant les transitions), hors des bancs node.

**Contre-vérification.** Comptes non remesurés (ils viennent d'un DOM factice). Gain réel surestimé : Blink ne fait rien quand textContent, une classe ou un style reçoivent la valeur déjà en place ; il ne reste que le coût JavaScript de renderHUD (0,49 ms par tic dans node:vm, donc bien moins en réalité, toutes les 90 ms). Les points 1, 2 et 4 (écritures filtrées, barres en scaleX, radar en deux couches) sont sans risque. Le point 3 est à ÉCARTER en l'état : le shader applique déjà un vignettage et un voile de dégâts (renderer.js:371-374) et les surcouches CSS #vignette et #damage (style.css:1) s'y ajoutent ; les supprimer change l'image (coins plus clairs, voile moins rouge). Il ne passe que si les uniformes du shader sont recalés et l'égalité prouvée par différence d'images, repli Canvas 2D compris. Passer la luminosité dans le shader n'est pas non plus identique à filter:brightness() appliqué après la courbe de tons.

### LOOP-14 — 34 automations AudioParam par image, dont la moitié en double
- sévérité basse · catégorie audio · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/audio.js:180-197; src/audio.js:379-397; src/audio.js:475-476

**Preuve.** 1) play.mjs (AudioContext factice) : 34,1 appels d'automatisation par image (gain.gain 12,9, filter.frequency 11, panner.pan 10). 2) updateSteam (audio.js:180-187, 3 setTargetAtTime) et updateMachinery (188-197, 4 moteurs x 3 appels) sont appelés par setSteam et setMachinery (475-476), puis une seconde fois par tick (379-397) dans la même image.

**Cause.** Les cibles ne sont pas mémorisées, et chaque setter comme tick déclenche une mise à jour.

**Proposition.** Les setters ne font que mémoriser la valeur ; tick fait une seule mise à jour par image. N'appeler setTargetAtTime que si l'écart dépasse un seuil (gain 0,003, fréquence 1 %, pan 0,01), ou au plus toutes les 100 ms.

**Gain attendu.** 80 à 90 % de messages en moins vers le fil audio (environ 2 000 par seconde → 200) ; moins de risque de craquements sur mobile.

**Risques.** Le lissage change légèrement, à constantes de temps inchangées. Aucun impact sur la simulation. Ne touche pas au travail sur la puissance sonore des armes, que les joueurs trouvent trop légères.

**Vérifier par.** play.mjs : audioParamPerFrame sous 5 ; écoute comparative.

**Contre-vérification.** Code relu : setMachinery et setSteam appellent updateMachinery et updateSteam (audio.js:475-476), puis tick() les rappelle dans la même image (382-383) : 15 automations en double sur 30, plus 3 dans tick (393-396), ce qui recoupe les 34,1 mesurés. La suppression du double appel et l'élimination des appels dont la cible et la constante de temps sont inchangées donnent un son strictement identique (setTargetAtTime est une approche exponentielle sans mémoire : la relancer vers la même cible ne change pas la courbe). La variante à seuil (gain 0,003, fréquence 1 %) modifie légèrement le lissage : à garder en option. Tenir une mémoire par paramètre et l'invalider quand un autre code programme ce paramètre (atténuation d'ambiance). audio.js est dans FERRO v0.2 : destination FERRO. Gain non audible sur ordinateur ; utile surtout sur mobile.

**Gain corrigé.** Environ −45 % d'automations avec la seule suppression des doublons (identique) ; −80 à −90 % seulement avec la variante à seuil.

### LOOP-15 — Environ 1,5 Mo alloués par image, dont 74 % dans sim.step : GC encore discret, mais peu de marge sur mobile
- sévérité basse · catégorie mémoire · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · moteur et jeu
- lieux : src/simulation.js:679; src/simulation.js:995-999; src/simulation.js:1410; src/simulation.js:1416; src/destruction.js:160; src/game.js:722

**Preuve.** 1) alloc.mjs (campagne 9, 60 Hz, écarts de used_heap_size) : environ 1,5 Mo par image ; sim.step environ 845 Ko par pas (74 %), models environ 357 Ko par image. 2) simalloc.mjs : rebuild de destruction.js:160 pèse 18 à 20 % et updateEncounters (simulation.js:679) 7 %. route() alloue un tableau [i,cost] à chaque push (simulation.js:1410) et un tableau neighbors à chaque nœud exploré (1416). 3) node --trace-gc (gc-c9.txt, gc-c9-16.txt, gcsum.cjs) : scavenge de 0,12 à 0,28 ms en moyenne, au plus 0,38 à 0,83 ms, et un mark-compact de 0,79 à 1,12 ms par 30 s. Le GC n'explique donc pas les pics de 40 à 175 ms (LOOP-02 à LOOP-04).

**Cause.** Beaucoup d'objets temporaires par pas et par image : listes filtrées, décompositions [...a,...b], maillages recréés dans models().

**Proposition.** Réutiliser les objets maillage de models() (réserve par clé) ; utiliser un tas A* typé et un voisinage sans tableau ; éviter les décompositions et les filter dans les boucles chaudes (debrisBoxes 995-999, updateDebris) ; rendre incrémental le rebuild de destruction (voir LOOP-04).

**Gain attendu.** 30 à 50 % d'allocation en moins (estimation) et des scavenges plus rares sur mobile, où la jeune génération est plus petite.

**Risques.** Réutiliser des objets expose à des alias d'une image à l'autre. Aucun impact sur la sauvegarde ; le déterminisme est préservé si l'ordre des itérations reste le même.

**Vérifier par.** node --max-semi-space-size=128 bench/loop/alloc.mjs <ferro> 9 10 ; node --trace-gc bench/loop/play.mjs <ferro> 30 q60 9 dépouillé par gcsum.cjs.

**Contre-vérification.** Ordres de grandeur cohérents avec la référence du domaine principal (534 à 864 Ko par pas, environ 1 Mo par image pour draw), non remesurés ici. Le code cité existe bien : tas A* en tableaux [i,cost] (simulation.js:1410), voisinage alloué par nœud (1416), Set et filter dans debrisBoxes (995-999). Le GC n'explique pas les saccades (confirmé indirectement : les pas longs sont déterministes et attribués à route()). Doublon des constats d'allocation des axes SIM et RCPU : fusionner. Le gain de 30 à 50 % est une estimation sans prototype. Partie rendu (models, draw) dans FERRO, partie simulation dans METAL.

## Constats ajoutés par le contre-vérificateur

### LOOP-V1 — Aucun mode démo dans METAL, et rien dans la boucle ne permet une démo qui dure
- sévérité haute · catégorie démo · effort L · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/game.js:94-100; src/game.js:165; src/game.js:178; src/game.js:675-722; src/game.js:838; src/simulation.js:2219; point-de-rupture/Jeu/src/interface/titre.js:50-52; point-de-rupture/Jeu/src/interface/titre.js:184-229; bitume/src/jeu.js:114-140; bitume/src/jeu.js:208-230

**Preuve.** 1) Aucune occurrence de demo ni attract dans METAL src/game.js ; le menu montre seulement le monde avec une caméra qui oscille (game.js:721). 2) Les deux autres jeux ont le même mécanisme, écrit deux fois : Point de rupture (Jeu/src/interface/titre.js:50-52 : démo après 5 s sans geste, plans de 7 s, clic avalé 600 ms ; 184-229 : lancerDemo et sortirDemo ; fin de partie en démo = retour au titre, ligne 38) et BITUME (src/jeu.js:114-140 séances vitrine et démo, 208-230 gestes clavier, souris, molette et manette qui ramènent au titre). 3) Obstacles dans la boucle de METAL : l'entrée est construite en dur depuis clavier et souris (game.js:681-688) ; newRun et saveCheckpoint écrivent SAVE_KEY (game.js:94-100 et 165), donc une démo lancée par ce chemin écraserait la sauvegarde du joueur ; la mort ou la victoire quittent le mode playing (result, game.js:178). 4) Mesure (bench/loop-verif2/demo.mjs, vraie simulation, 180 s, sans tricher sur les points de vie) : sur 16 essais (4 mondes x 4 pilotes automatiques, dont un pilote minimal bâti sur l'API publique), 9 meurent entre 84,5 et 164,4 s, 0 gagne, 0 à 8 ennemis tués sur 66 à 120. Une démo naïve s'arrête donc en 1 min 30 à 2 min 45. 5) L'API publique suffit pour un pilote hors simulation : state, sight, ray, nav.cells, nav.dist, nav.coord, nearestInteraction (simulation.js:2219).

**Cause.** La boucle de METAL n'a pas de source d'entrée interchangeable ni de mode sans sauvegarde, et le déclencheur d'inactivité est réécrit dans chaque jeu au lieu d'être dans FERRO.

**Proposition.** FERRO (générique, 3 jeux) : module attract d'environ 1,5 Ko, FAttract.create({idleMs:5000, swallowMs:600, onStart, onStop}) avec note(geste) et tick(now) ; gestes = pointerdown, keydown hors touches mortes, wheel, bouton ou manche de manette ; le premier geste arrête la démo et le clic qui suit est avalé. METAL : 1) mode 'demo' dans game.js ; frame() prend input=demoPilot(sim,clock) au lieu du clavier (branche aux lignes 681-688), sans verrouillage du pointeur. 2) demoPilot, fonction pure de l'état : cible = ennemi déployé le plus proche avec sim.sight ; déplacement par nav.dist vers la prochaine rencontre, le prochain noyau puis la sortie ; lacet borné à 3,5 rad/s avec lissage ; rafales ; garde du bouclier sur les attaques annoncées ; esquive sous 45 PV. 3) « Qui dure » sans toucher la simulation : en démo le jeu maintient les PV à 40 au minimum et recharge les munitions après chaque pas ; sur victoire, enchaîner load(stage+1 modulo 18) derrière l'écran de chargement existant ; sur mort résiduelle, recharger le même monde ; changer de monde au plus tard toutes les 4 minutes. 4) Aucune écriture : en démo saveCheckpoint, clearSave et runStats ne font rien ; savedRun et checkpoint du joueur restent intacts (passer par load, jamais par newRun). 5) Sortie : tout geste ramène au menu ; frame() s'arrête déjà quand document.hidden (ligne 678) ; ne pas mettre la démo en pause sur blur. 6) Affichage : HUD réduit et bandeau « DÉMO · appuyez sur une touche » ; vue subjective d'abord, plans extérieurs de 7 à 12 s ensuite (réalisateur, comme camera.js de Point de rupture). 7) Variante ?demo=bench : même pilote, journal p50, p99 et maximum des images par monde, pour servir de banc d'endurance et de stabilité des images par seconde.

**Gain attendu.** Démo sans fin après 5 s d'inactivité au menu (aujourd'hui : aucune ; un pilote naïf meurt en 85 à 165 s). Le même pilote fournit un banc d'endurance reproductible pour la stabilité des images par seconde.

**Risques.** Le pilote doit rester hors de simulation.js pour ne toucher ni au déterminisme ni au format de sauvegarde ; le maintien des PV modifie l'état vivant, ce qui est admis puisque la démo n'est jamais sauvegardée. Vérifier qu'aucun chemin de démo n'appelle localStorage.setItem(SAVE_KEY). Taille : environ 3 à 5 Ko dans METAL et 1,5 Ko dans FERRO, sur 1 400 000 octets. Lisibilité mobile : le bandeau ne doit pas couvrir les commandes tactiles. FERRO : module nouveau et optionnel, un jeu de la v0.2 continue de marcher sans lui. Les pics de LOOP-02 se verront en démo tant qu'ils ne sont pas corrigés.

**Vérifier par.** Test node checks/demo.test.mjs : deux exécutions de demoPilot sur 60 s donnent le même snapshot JSON. Harnais de boucle (bench/loop/harness.mjs porté dans le domaine principal) : 30 minutes simulées en mode démo, le mode ne quitte jamais 'demo', zéro setItem sur SAVE_KEY, au moins 3 mondes visités, au moins 4 ennemis tués par minute. Essai réel : 5 s au menu, la démo part ; un geste ramène au menu et la sauvegarde du joueur est intacte.

### LOOP-V2 — Deuxième cause des points de reprise refusés : une lame ou une presse qui traverse un débris posé ; et la sauvegarde refusée est écrasée
- sévérité haute · catégorie bug · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/simulation.js:1034; src/simulation.js:2054; src/simulation.js:2069; src/simulation.js:2080-2081; src/game.js:118-120; checks/simulation.test.mjs:1933-1940

**Preuve.** 1) bench/loop-verif2/restore2.mjs (domaine principal, motif b, point de reprise toutes les 3 s, la boîte fautive est identifiée dans restore) : classic-0 refuse à t=24, 27 et 33 s (pas à 30 s), un seul débris fautif, boîte de type piège, profondeur 0,370 m ; campaign-0 : même schéma, 0,374 m ; campaign-9 : t=33 s, piège, 0,445 m ; seul campaign-10 échoue sur des solides (1 à 8 débris, 0,001 à 0,204 m). 2) Code : supportBoxes contient savedTrapBoxes (simulation.js:2069), remplies pour les lames et les presses (2054) ; en jeu un débris posé ne revérifie que son support (1034), donc la lame le traverse sans le réveiller ; un point de reprise pris pendant ce passage échoue à la ligne 2081. 3) Le premier tour affirmait « toujours contre un solide » : son correctif physique (ne pas poser en interpénétration) ne couvre pas ce cas. 4) Après un refus, resumeSaved appelle saveCheckpoint() à l'entrée du secteur (game.js:120), ce qui écrase SAVE_KEY ; la copie de secours '-before-ascension' n'est écrite que si elle n'existe pas déjà (game.js:118). Les sauvegardes déjà cassées chez les joueurs sont donc perdues avant tout correctif. 5) Les corruptions testées (checks/simulation.test.mjs:1933-1938 : y+=5, y=-1, vitesses, tailles) échouent à la ligne 2080 ou avant, jamais sur le seul recouvrement de 2081.

**Cause.** Le prédicat de restore traite une boîte de piège mobile comme un solide statique, alors que la physique en jeu autorise une lame à traverser un débris au repos. Et le chemin d'échec écrase la sauvegarde au lieu de la conserver.

**Proposition.** 1) simulation.js:2081 : tester le recouvrement contre savedSolids, savedDoors et les ascenseurs seulement ; exclure savedTrapBoxes (elles restent admises comme support à la ligne 2080). 2) Pour un recouvrement avec un solide : au lieu de refuser tout le point de reprise, charger ce débris avec resting:false et settleTime:0 (la dépénétration en 4 passes de updateDebris le ressort) ; la ligne 2080 et toutes les autres validations restent atomiques. Cela répare aussi les sauvegardes existantes, ce que le correctif côté snapshot de LOOP-01 ne fait pas. 3) Garder en complément le correctif physique de LOOP-01 (ne pas poser un débris qui recouvre un solide) pour que le cas ne se produise plus. 4) game.js:118 : avant saveCheckpoint(), toujours écrire la sauvegarde refusée dans SAVE_KEY+'-refuse' (emplacement écrasable). 5) Test sur mondes réels avec pièges (classic-0, campaign-0, campaign-9) et sans (campaign-10) : 33 s de combat, aller-retour snapshot → JSON → restore toutes les 3 s, 11 réussites sur 11.

**Gain attendu.** Zéro refus dans les 4 mondes mesurés (aujourd'hui 1 à 10 sur 11) ; les sauvegardes déjà enregistrées redeviennent chargeables ; plus de perte irréversible en cas de refus.

**Risques.** Un débris repassé en mouvement à la reprise peut bouger de quelques centimètres : écart visuel mineur et déterministe entre partie continuée et partie restaurée (aujourd'hui la reprise échoue entièrement). Le test d'aller-retour exact (simulation.test.mjs:1930) ne porte que sur des états valides et ne change pas. Format inchangé (rubbleVersion 1). Les tests de collision et de reprise sont obligatoires (AGENTS.md) : ajouter le test du point 5.

**Vérifier par.** node bench/loop-verif2/restore.mjs 30 classic-0,campaign-0,campaign-9,campaign-10 b puis motif a : colonne refus à 0 ; node bench/loop-verif2/restore2.mjs : aucune boîte fautive ; npm test.

### LOOP-V3 — Les durées de l'axe LOOP sont gonflées 3 à 8 fois par node:vm : les seuils d'acceptation en millisecondes sont à refaire
- sévérité moyenne · catégorie outillage · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · moteur et jeu
- lieux : bench/loop/harness.mjs; bench/loop/routes.mjs; bench/loop/snapshot.mjs; bench/loop/worldupdate.mjs; bench/loop-verif2/fast.mjs; checks/

**Preuve.** Tous les bancs de bench/loop chargent le code par vm.createContext (harness.mjs, routes.mjs, snapshot.mjs, worldupdate.mjs). Mêmes scénarios rejoués dans le domaine principal (bench/loop-verif2, bench/rcpu/destr.mjs) : comptes identiques (26 recherches A*, 18 échecs, 7 plafonds, 4 078 à 4 390 segmentFree ; file de navigation de 36 192 cellules) mais durées très différentes : échec A* à froid 97-142 ms → 22-40 ms ; pas maximal 174,6 ms → 40 ms ; snapshot avec file en attente 92-155 ms → 16-32 ms ; updateWorld 23,8-30,7 ms → 2,9-6,4 ms ; pas p50 1,1 ms → 0,32-0,41 ms ; p99 8,3 ms → 3,9-6,4 ms. Les critères de vérification du premier tour (« aucune recherche au-dessus de 50 ms », « aucune image au-dessus de 33 ms ») sont déjà satisfaits avant tout correctif dans le domaine principal : ils ne prouveraient rien. En outre la charge de la machine a varié de 12 à 177 pendant cette vérification : une même mesure d'updateWorld a donné 2,9 ms puis 102 ms.

**Cause.** Dans un contexte node:vm chaque accès à un global passe par un intercepteur, ce qui gonfle surtout les fonctions courtes et chaudes (segmentFree, ground, blocked). Des seuils absolus en millisecondes ne sont pas reproductibles sur une machine chargée.

**Proposition.** 1) Chargeur domaine principal partagé (vm.runInThisContext, modèle bench/loop-verif2/fast.mjs et bench/rcpu/harness.mjs) livré dans tools/ de METAL, et sa version générique dans FERRO pour les trois jeux. 2) Critères d'acceptation exprimés d'abord en comptes déterministes : segmentFree par recherche échouée ≤ 500 ; expansions A* par pas ≤ 600 ; cellules de navigation remises en file par révision ≤ 1 500 ; sous-pas par image = 1,000 à 60 Hz arrondi ; points de reprise refusés = 0 sur 11. 3) Durées seulement en rapport apparié et alterné dans un même processus (avant et après), jamais en seuil absolu ; seuils indicatifs recalés : aucun pas de simulation > 8 ms, snapshot < 4 ms, image de révision < 3 ms sur Apple M5. 4) Porter le harnais de boucle complet (vrai game.js, DOM factice) dans le domaine principal pour mesurer les images de bout en bout.

**Gain attendu.** Des critères d'acceptation qui échouent réellement avant correctif et passent après, insensibles à la charge de la machine ; plus de priorités faussées par des durées gonflées (LOOP-03 et LOOP-04 passent de haute à moyenne).

**Risques.** Le domaine principal partage les globaux entre modules : charger chaque jeu dans une fonction enveloppe pour ne pas polluer globalThis. Les compteurs se posent par réécriture du source en mémoire, jamais dans le dépôt. Aucun effet sur le jeu livré ni sur la taille de la page.

**Vérifier par.** node bench/loop-verif2/routes.mjs campaign-9 30 a exécuté deux fois : mêmes comptes, mêmes instants des pas longs (10,97 s, 11,28 s, 19,75 s, 24,33 s, 28,78 s) ; comparer aux sorties de bench/loop/routes.mjs pour le facteur de gonflement.

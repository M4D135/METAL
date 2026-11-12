# Axe SIM — SIM : cœur de simulation, coût CPU de FSimulation.step hors planification IA (commit 673d6b2, v0.8.0)

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Mesures faites dans le domaine principal de Node 24.18 (V8 13.6), comme dans un navigateur, avec fast.mjs. Les comparaisons sont des A/B appariés en lockstep (ab2.mjs), parce que le bac à sable node:vm des tests multiplie le coût de ground par 8 à 9 et celui du pas par 5 environ (SIM-11). La machine était chargée (charge moyenne 5 à 16) : les ratios sont fiables, les temps absolus sont gonflés.

Le pas d'origine coûte en moyenne 0,16 à 0,28 ms, avec un p99 de 0,8 à 1,4 ms et des pointes de 8 à 32 ms, presque toutes dues à route. Il alloue 534 à 864 Ko par pas.

J'ai prototypé six correctifs exacts, appliqués en mémoire seulement : le dépôt n'a pas bougé (git status vide, HEAD 673d6b2). La simulation reste identique bit à bit. La preuve est double : une empreinte FNV des Float64 du joueur, des ennemis et des débris plus les noms des événements, prise à chaque pas, et un hash du snapshot final.

Effet des six correctifs combinés :
- temps total −60 à −70 %, ratio médian des pas 0,30 à 0,39 ;
- pointe maximale 24,2→10,1, 11,1→5,5, 15,6→3,8 et 31,8→8,3 ms selon le scénario ;
- −70 % aux roquettes sur legacy-s2 ;
- allocations −74 % (133 à 224 Ko par pas) ;
- +10,6 Ko bruts sur simulation.js (dist 789 111 o pour un budget de 1 400 000).

Tests du dépôt, lancés en lecture seule avec un préchargement qui sert la source patchée :
- original : 301/301 ;
- tout sauf la nav locale : 301/301 ;
- avec la nav locale : 300/301. Le test simulation.test.mjs:1867 exige navPending>0, un détail d'implémentation qu'il faut réécrire avec l'accord de David.

TOP 10 CHIFFRÉ
1. SIM-01, nav locale par rectangles sales : −22 à −31 %. Les pointes après destruction disparaissent (17,6→0,8, 22,5→1,7 et 23,8→0,9 ms). Aujourd'hui, seules 4 à 6 cellules changent pour 37 000 à 44 000 recalculées.
2. SIM-02, ground en SoA avec sous-grille de 2 m : ×3,2 à ×7,5 par appel, 0 écart sur 21 millions de points, −19 à −32 % sur le total.
3. SIM-03, débris (sommeil, mémo, miroir, feuillage réduit à 38 points) : −18 à −29 %, et −63 % du pas aux roquettes.
4. SIM-04, blocked avec un miroir CSR en Float64 : −10 à −16 %, pointe max 40→28 et 31,5→14,8 ms.
5. SIM-06, boucles sur toutes les identités : −10 à −14 % une fois 1 à 4 appliqués. Après eux, encounterCounts devient la première fonction en temps propre (10,9 %).
6. SIM-05, formes cachées mégamorphes (5 formes de sols, 4 à 5 d'ennemis) : 534 à 864 Ko par pas, à 80 % des HeapNumber, réduits de 74 %.
7. SIM-07, rayons en DDA : ray ×5,6 à ×7,3, castProjectile ×2,7 à ×3,7, 0 écart sur 240 000 rayons. Le gain se voit surtout en rafale.
8. SIM-08, révision de destruction : 1,6 à 2,3 ms par impact, parce que tout est reconstruit. Gain estimé seulement.
9. SIM-09, segmentFree : −1 à −8 %.
10. SIM-10, Math.hypot : 13 à 33 ns par appel contre 1,4 ns pour sqrt, plus 48 à 100 o alloués, sur 213 à 377 appels par pas. Mais 35 % des résultats diffèrent de 1 à 2 ulp : seules des réécritures exactes sont possibles (déplacement nul dans 99,6 à 100 % des cas en 1804).

Reste à traiter, avec l'axe IA : les pointes de route en début de vague (10 à 16 ms même après correctifs), amplifiées par les jusqu'à 8 sous-pas de game.js (SIM-12). Les tableaux ne fuient pas (SIM-13). Les fonctions de world.js (nearBox, distance, demolitionMetadata) ne servent qu'à la génération.

## Mesures

- **Pas de simulation d'origine, domaine principal** : moyenne 0,157 à 0,283 ms ; p99 0,81 à 1,41 ms ; max 8,5 à 20,6 ms (premier passage, JIT compris) ; création du monde et de la simulation 57 à 114 ms _(méthode : steps.mjs et fast.mjs (vm.runInThisContext, window neuf par chargement) ; 4 scénarios (legacy-s0, legacy-s2, campaign-w10, campaign-w16) × 1800 pas de 1/60 s ; joueur scripté de lib.mjs ; Node 24.18)_
- **Même pas dans le bac à sable node:vm (comme checks/*.test.mjs)** : moyenne 0,85 à 1,42 ms ; p99 3,5 à 4,7 ms ; max 44,7 à 53,6 ms ; création 278 à 358 ms ; ground = 52,1 % du temps propre _(méthode : profile-steps.mjs (vm.createContext) comparé à profile-fast.mjs)_
- **Coût de ground() par appel, vm contre domaine principal** : 700 à 880 ns contre 83 à 96 ns, même checksum _(méthode : realm-check.mjs, ground-micro.mjs, ground-micro-fast.mjs)_
- **Profil CPU, temps propre (domaine principal)** : ground 11,4 % ; debrisFloor 9,9 ; pumpNav 8,8 ; blocked 8,0 ; step 5,7 ; segmentFree 4,7 ; debrisBoxes 4,4 ; encounterCounts 4,0 ; updateEnemies 3,8 ; updateDebris 2,9 ; ray 2,4 ; GC 1,9 ; destruction.rebuild 1,7 _(méthode : profile-fast.mjs (CPU profile de node:inspector, surcoût de l'inspecteur ≈ 10 %))_
- **Profil CPU, temps inclusif** : updateDebris 28,1 % ; updateEnemies 24,1 ; pumpNav 17,3 ; setGoal/plan 11 ; fire 5,3 ; encounterCounts 5,1 ; sous-arbre route = 9,9 % (dont segmentFree 39,7 %, blocked 24,5, ground 11,2) ; sous-arbre updateDebris = 31,6 % (dont debrisFloor 34,3 %, ground 26,1, debrisBoxes 16,6) _(méthode : profile-fast.mjs et subtree.mjs)_
- **Phases par pas (ms)** : legacy-s0 : pas 0,160, updateEnemies 0,057, updateDebris 0,048, pumpNav 0,018, route 0,025, encounterCounts 0,011 ; legacy-s2 : pas 0,255, updateDebris 0,109, pumpNav 0,053 ; campaign-w10 : pas 0,185, updateDebris 0,051, pumpNav 0,042 ; campaign-w16 : pas 0,190, updateDebris 0,053, pumpNav 0,044, route 0,034 _(méthode : phases.mjs (enveloppes performance.now dans le domaine principal))_
- **Appels par pas (moyenne / p99 / max)** : ground 561/3313/34367 (legacy-s0) à 1276/4526/33642 (legacy-s2), appelée par debrisFloor 54 à 72 %, pumpNav 23 à 30 %, segmentFree 3 à 10 % ; blocked 177 à 336 en moyenne, max ≈ 24 000, appelée par pumpNav 73 à 88 % ; ray 0,15 à 1,7, max 8 ; segmentFree max ≈ 4 700 _(méthode : count-calls.mjs et instrument.mjs (enveloppes de comptage avec attribution à l'appelant))_
- **Origine des pointes > 8 ms** : 100 % dans route : legacy-s0 pas 620 (waveStart) 19,7 ms, pas 684 9,9 ms (navPending 17 146) ; legacy-s2 pas 1440 14,0 ms ; campaign-w10 pas 1081 9,75 ms ; campaign-w16 pas 1728 9,0 ms _(méthode : spike-fast.mjs (sous-arbres des pas lents))_
- **Formes cachées V8** : sols (world.walkable) 26 à 28 objets, 5 formes ; solides (destruction.colliders) 448 à 504 objets, 2 formes ; ennemis 84 à 170, 4 à 5 formes ; portes 1 forme _(méthode : box-shapes.mjs et floors-stats.mjs (node --allow-natives-syntax, %HaveSameMap))_
- **Densité des sols** : 1,64 à 1,69 sol par seau de 8 m (max 4) ; 1,41 à 1,43 par case de 2 m ; 21-22 sols plats, 3 à 6 rampes, 1 substrat qui couvre tout le niveau _(méthode : floors-stats.mjs)_
- **ground v2 (SoA + sous-grille 2 m + gTop) : exactitude et vitesse** : 0 écart (Object.is) sur ≈ 21 millions de points et 300 000 listes de pièges ; 81-95 → 20,6-26,2 ns par appel sur points uniformes (×3,2 à ×3,9) ; 87-99 → 11,6-19,8 ns sur points de trace (×4,5 à ×7,5) _(méthode : ground-equiv.mjs (points aléatoires, bords ±1e-7, ±ulp, ±1e-9, ±1e-12, ±1e-6, frontières de cases, NaN, ±Infinity, −0, 1e300) et ground-variants.mjs)_
- **Navigation : utilité des recalculs complets** : 8 à 15 recalculs complets par 30 s, chacun mettant en file 37 000 à 44 000 cellules ; 300 à 680 pas sur 1800 avec du travail en attente ; 4 à 6 cellules réellement modifiées (99 sur 262 000 avec roquettes), toutes dans les rectangles des boîtes changées ; travail utile 0,00 à 0,06 % _(méthode : nav-refresh.mjs (diffs accumulées par révision, comparées à une nav ombre recalculée en entier))_
- **Coût du diff de collisionneurs par révision** : 924 µs avec des clés chaînes, 77 µs avec un hash numérique FNV, contre 220 µs pour remettre toute la grille en file _(méthode : revision-cost.mjs)_
- **Coût d'une révision de destruction** : damageScenery 1,6 à 2,3 ms par impact ; explode 2,1 ms _(méthode : phases.mjs et revision-cost.mjs)_
- **Coût des débris** : au repos 0,94 à 1,10 µs par pièce et par pas (33 à 49 % de updateDebris) ; en mouvement 8,2 à 9,2 µs ; feuillage en mouvement 61 µs ; roquettes 117,8 pièces/pas = 345 µs/pas ; feuillage 216 points dont 38 uniques et 18 extrêmes, 5,96 → 0,46 µs par axe _(méthode : debris-cost.mjs et foliage.mjs)_
- **ray v2 / castProjectile v2 (DDA)** : 0 écart sur 240 000 rayons (distance par Object.is, normale exacte) ; ray 14,5-21,9 → 2,1-3,0 µs (×5,6 à ×7,3) ; cast 25-30 → 7,9-10,5 µs (×2,7 à ×3,7) _(méthode : ray-equiv.mjs et ray-micro.mjs)_
- **A/B apparié de chaque correctif seul (total sur 4 scénarios × 1800 pas, REPS=2)** : tous identiques bit à bit ; ground −19 à −32 % (ratio médian 0,67 à 0,80) ; blocked −10 à −16 % (max 40→28, 31,5→14,8, 24,7→15,6, 21,3→13,6 ms) ; segmentFree −1 à −8 % ; debris −18 à −29 % (ratio 0,68 à 0,74), legacy-s2 aux roquettes 0,450→0,165 ms (−63 %) ; nav-local −22 à −31 % ; identity −1 à −6 % seul et −10 à −14 % après all-v2 (ratio 0,81 à 0,85) ; ray +2/−2/−13/+6 % (bruit), roquettes −4 %, max 8,0→6,2 ms _(méthode : ab2.mjs : les deux simulations avancent pas à pas en alternant l'ordre ; empreinte FNV par pas + hash du snapshot final ; ratio médian des pas)_
- **Combinaison all-v2 (ground, blocked, segment, debris, nav)** : legacy-s0 526→278 ms (−47 %, max 27,9→10,4) ; legacy-s2 581→204 (−65 %, max 12,3→4,8) ; campaign-w10 663→269 (−59 %, max 18,0→4,7) ; campaign-w16 798→304 (−62 %, max 21,7→5,4) ; pointes post-destruction 17,6→0,8, 22,5→1,7, 23,8→0,9 ms _(méthode : REPS=2 node ab2.mjs all-v2.mjs allPatch)_
- **Combinaison complète full-v2 (all-v2 + identity + ray)** : tous identiques ; total −60 % / −70 % / −68 % / −65 % ; ratio médian 0,36 / 0,30 / 0,36 / 0,39 ; moyenne 0,272→0,108, 0,276→0,083, 0,358→0,116, 0,537→0,185 ms ; p99 1,47→0,98, 1,34→0,47, 1,79→1,24, 4,37→1,55 ms ; max 24,2→10,1, 11,1→5,5, 15,6→3,8, 31,8→8,3 ms ; pas > 4 ms 4→1, 3→1, 4→0, 19→8 ; roquettes legacy-s2 1049→309 ms (−70 %, max 5,6→3,9 ms, pas > 4 ms 3→0) _(méthode : REPS=2 node ab2.mjs full-v2.mjs fullPatch, et WEAPON=2 SCEN=legacy-s2 (les roquettes ne sont effectives qu'en legacy-s2, d'après door-events.mjs))_
- **Octets alloués par pas (passe chaude)** : original 534 / 864 / 632 / 687 Ko ; all-v2 211 / 297 / 212 / 229 Ko ; full-v2 133 / 224 / 146 / 184 Ko (−74 %) ; scavenges par 30 s : 14 à 23 (8,7 à 29 ms cumulés) → 3 à 6 (3,1 à 5,9 ms) _(méthode : gc-harness.mjs + alloc-steps.mjs : somme des compteurs V8 allocated= de --trace-gc-nvp entre des marqueurs, gc() forcé aux bornes)_
- **Répartition des allocations par fonction (original)** : ground 36,4 % (206 Ko/pas) ; blocked 21,1 % (119 Ko) ; ray 5,9 % ; pumpNav 3,3 % ; debrisBoxes 3,2 % ; updateDebris 3,0 % ; updateEnemies 3,0 % ; debrisHalf 2,8 % ; segmentFree 2,5 % ; route 1,8 % ; debrisSupport 1,7 % ; destruction.rebuild 1,4 % ; coord 0,9 %. Après full-v2 restent surtout updateDebris, debrisHalf, destruction.rebuild, route et rebuildNeighbors _(méthode : alloc.mjs (HeapProfiler.startSampling, intervalle 256 o, objets ramassés inclus))_
- **Microbanc mégamorphe (boucle de type ground, 2 sols par seau)** : monomorphe 2,5 o/appel (for-of inliné) à 48 o/appel (indexé, non inliné) et 108 à 153 ns ; 5 formes 105 à 148 o/appel et 518 à 921 ns _(méthode : gc-harness.mjs mega-alloc.mjs)_
- **Math.hypot dans la simulation** : 213 à 377 appels par pas en moyenne, p99 455 à 708, max ≈ 4 900 ; 73,4 % à 2 arguments, 26,6 % à 3 ; appelants : updateEnemies:1804 55 %, updateDebris:1033 15 %, checkPad:370 8 %, segmentFree:1368 5 %, collectSupplies:599 4 % _(méthode : hypot-bench.mjs (Math.hypot enveloppé pendant les 4 scénarios, résultats inchangés ; pile échantillonnée 1 appel sur 1024))_
- **Math.hypot contre Math.sqrt (coût)** : hypot(a,b) 13,2 ns contre sqrt(a*a+b*b) 1,44 ns (×9) ; hypot(a,b,c) 22,8 contre 1,74 ns (×13) ; hypot(...v) 32,7 ns ; hypot(...[a,b,c]) 22,3 ns ; allocations 48 / 64 / ≈ 100 o par appel contre 0 _(méthode : hypot-bench.mjs : boucles monomorphes sur Float64Array de 4 millions d'entrées, médiane de 5 passes, octets via gc-harness)_
- **Math.hypot contre Math.sqrt (exactitude)** : 35,0 à 37,0 % des résultats à 2 arguments et 30,7 à 36,6 % à 3 arguments diffèrent, de 1 à 2 ulp au plus _(méthode : hypot-bench.mjs : 2 millions de tirages par plage (|v|<200, |v|<1, échelles mixtes), distance en ulp par BigInt64Array)_
- **Déplacement nul en simulation.js:1804 (moveSpeed)** : 99,6 à 100 % des 84 à 170 ennemis par pas _(méthode : movespeed-zero.mjs (ligne 1804 patchée en mémoire pour compter))_
- **Tests du dépôt contre la source patchée (dépôt inchangé)** : original 301/301 ; full-v2 300/301 (échec : simulation.test.mjs:1862-1872, assertion 1867) ; tout sauf la nav (nonav) 301/301 ; nav seule 181/182 sur 4 fichiers _(méthode : run-checks.sh et test-preload.mjs (NODE_OPTIONS --import qui remplace fs.readFileSync pour src/simulation.js) sur les 14 fichiers qui chargent la simulation)_
- **Couverture des scénarios de banc** : révisions de destruction par 30 s : 8 / 15 / 13 / 13 ; doorOpen 0, sauf legacy-s2 aux roquettes (1 porte détruite) ; aux roquettes, legacy-s2 passe de 16 à 35 materialBreak _(méthode : door-events.mjs)_
- **Taille ajoutée** : full-v2 +10 553 o bruts sur simulation.js (ground 1 915, blocked+miroir 1 519, segment 81, debris+miroir 2 643, nav 1 917, identity 808, ray+miroir 3 568) ; dist 789 111 → ≈ 799 700 o pour un budget de 1 400 000 _(méthode : longueur de la source patchée moins l'originale ; SIZE.json pour dist)_
- **Charge de la machine pendant les mesures** : charge moyenne 5 à 16 (autres agents) _(méthode : uptime ; d'où l'A/B apparié en lockstep et les ratios médians plutôt que les temps absolus)_

## Scripts de banc

- bancs/sim/lib.mjs
- bancs/sim/fast.mjs
- bancs/sim/ab2.mjs
- bancs/sim/ab.mjs
- bancs/sim/instrument.mjs
- bancs/sim/count-calls.mjs
- bancs/sim/profile-steps.mjs
- bancs/sim/profile-fast.mjs
- bancs/sim/profile-patched.mjs
- bancs/sim/phases.mjs
- bancs/sim/subtree.mjs
- bancs/sim/spike-fast.mjs
- bancs/sim/steps.mjs
- bancs/sim/realm-check.mjs
- bancs/sim/fastprops.mjs
- bancs/sim/floors-stats.mjs
- bancs/sim/box-shapes.mjs
- bancs/sim/ground-micro.mjs
- bancs/sim/ground-micro-fast.mjs
- bancs/sim/ground-dissect.mjs
- bancs/sim/ground-v2.mjs
- bancs/sim/ground-equiv.mjs
- bancs/sim/ground-variants.mjs
- bancs/sim/mirror.mjs
- bancs/sim/blocked-v2.mjs
- bancs/sim/debris-v2.mjs
- bancs/sim/debris-cost.mjs
- bancs/sim/foliage.mjs
- bancs/sim/nav-local.mjs
- bancs/sim/nav-refresh.mjs
- bancs/sim/revision-cost.mjs
- bancs/sim/identity-v2.mjs
- bancs/sim/ray-v2.mjs
- bancs/sim/ray-equiv.mjs
- bancs/sim/ray-micro.mjs
- bancs/sim/ray-steps.mjs
- bancs/sim/all-v2.mjs
- bancs/sim/full-v2.mjs
- bancs/sim/gc-harness.mjs
- bancs/sim/alloc-steps.mjs
- bancs/sim/alloc.mjs
- bancs/sim/mega-alloc.mjs
- bancs/sim/hypot-bench.mjs
- bancs/sim/movespeed-zero.mjs
- bancs/sim/door-events.mjs
- bancs/sim/test-preload.mjs
- bancs/sim/run-checks.sh

## Constats

### SIM-01 — Navigation : chaque révision de destruction ou de porte invalide toute la grille et tout le cache d'arêtes
- sévérité haute · catégorie saccade · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:229-235; src/simulation.js:300; src/simulation.js:316; src/simulation.js:912; src/simulation.js:1379-1391; src/simulation.js:1420

**Preuve.** src/simulation.js:231 (syncDestruction) : 'solids=destruction.colliders;...rebuildCollision();navDirty=terrainDirty=true;'. L'ouverture de porte (300) et la porte détruite (912) font aussi navDirty=true. La ligne 316 appelle refreshNav. La ligne 1387 remet en file TOUTES les cellules (37 000 à 44 000). La ligne 1389 fait edgeKnown.fill(0) et edgeOpen.fill(0), ce qui vide le cache d'arêtes lu par route en 1420, puis réinitialise les chemins de tous les ennemis. Mesuré avec nav-refresh.mjs, qui compare à une nav ombre recalculée en entier : 8 à 15 recalculs complets par 30 s, et 300 à 680 pas sur 1800 portent du travail de nav en attente. Or seules 4 à 6 cellules changent réellement par recalcul (99 sur 262 000 aux roquettes), toutes dans les rectangles des boîtes modifiées : travail utile 0,00 à 0,06 %. pumpNav pèse 17,3 % du temps inclusif et produit 73 à 88 % des appels de blocked et 23 à 30 % de ceux de ground. Toutes les pointes > 8 ms viennent de route. A/B apparié de nav-local seul : identique bit à bit, −22 à −31 %. Dans all-v2, pointes post-destruction : legacy-s2 pas 1644 17,6→0,8 ms, campaign-w10 pas 1081 22,5→1,7 ms, campaign-w16 pas 1728 23,8→0,9 ms.

**Cause.** L'invalidation est globale et binaire (navDirty), même quand une révision ne change aucune boîte. Le recalcul est bien amorti à 768 cellules par pas, mais il occupe des centaines de pas et refroidit le cache d'arêtes, que route reconstruit à coups de segmentFree, d'où les pointes.

**Proposition.** Rendre l'invalidation locale.
1) Dans syncDestruction, faire 'const old=solids; solids=destruction.colliders;' puis un diff de multiensembles entre old et solids. Clé : hash numérique FNV sur une vue Uint32 des 6 Float64 (minX..maxZ), puis égalité champ par champ. Coût 77 µs, contre 924 µs avec des clés chaînes et 220 µs pour la mise en file complète.
2) Chaque boîte ajoutée ou retirée pousse son rectangle dans navRects. Porte ouverte (300) ou détruite (912) : navMark(doorBoxes[i]).
3) refreshNav en mode avancé met en file seulement les cellules dont le centre est à 0,4 m + 1e-6 ou moins d'un rectangle, et n'efface edgeKnown et edgeOpen qu'à 1,2 m + 1e-6 ou moins. Diff vide : rien en file. La création et restore gardent le recalcul complet.
4) Garder la réinitialisation des chemins de tous les ennemis (1389) pour rester bit à bit. La supprimer relève de l'axe IA.
Prototype : bench/sim/nav-local.mjs (+1,9 Ko).

**Gain attendu.** −22 à −31 % du temps total de simulation pour ce seul correctif. Les pointes de route qui suivent une destruction disparaissent (17,6→0,8, 22,5→1,7 et 23,8→0,9 ms).

**Risques.** Déterminisme : identique bit à bit sur 4 scénarios × 1800 pas et aux roquettes (1 porte détruite). L'ouverture de porte par progression (300) n'est couverte par aucun banc (doorOpen = 0) : ajouter un test qui compare la grille locale à un recalcul complet après ouverture.
Tests : 300/301. simulation.test.mjs:1862-1872 échoue à l'assertion 1867 « Large-grid maintenance must actually be amortised » (navPending>0), parce que le travail local tient dans un seul pas. C'est un détail d'implémentation : le réécrire (navUpdates ≤ 768 et carte correcte après restore) avec l'accord de David, puisque AGENTS.md impose de passer les vérifications de simulation.
Snapshots inchangés : snapshot pompe la nav en attente (1941), restore recalcule tout (2215). Taille +1,9 Ko.

**Vérifier par.** cd bench/sim ; REPS=2 node ab2.mjs nav-local.mjs navLocalPatch (attendu : identical=true et un ratio apparié < 0,8) ; node nav-refresh.mjs (0 cellule modifiée hors rectangle) ; bash run-checks.sh nav

**Contre-vérification.** Code relu : lignes 231, 300, 316, 912, 1387-1389, 1420 exactes. Preuve indépendante (probe.mjs, compteurs insensibles à la charge) : 8/15/13/13 révisions par 30 s, dont 7/8, 13/15, 11/13 et 11/13 ne changent AUCUN collider (2 à 3 boîtes sinon) ; 300/680/532/560 pas avec nav en attente (identique au premier tour). Mécanisme de pointe confirmé : une recherche A* plafonnée coûte 4 422 segmentFree à cache froid (pas 1440, 1644, 1664 de legacy-s2 : 25 à 47 ms CPU sur cette machine lente) contre 37 segmentFree et 1,5 à 1,8 ms à cache chaud (pas 1607, 1706) : le vidage global du cache d'arêtes multiplie par ~15 le coût d'une recherche. Lockstep nav-local, mon pilote : état identique sur 10 scénarios (0, 1, 2, 3, c3, c9, c12, c15 ; armes 2,0,3,1 et 2,3). CORRECTION 1, l'identité bit à bit est empirique, pas structurelle (stale.mjs) : les grilles nav diffèrent entre original et nav-local pendant 9 pas (4 cellules) en legacy-s0 et campaign-w10, 139 pas (24 cellules) en legacy-s2 aux roquettes (la variante locale est à jour plus tôt) ; et le cache d'arêtes local garde jusqu'à 19 arêtes « ouvertes » qu'un recalcul donne fermées (moyenne 0,9 par contrôle contre 0 pour l'original en legacy-s2), car segmentFree lit trapBoxes (lames et presses mobiles, lignes 242, 1350, 1840-1862) : voir SIM-V1, à traiter en même temps. Annoncer « meilleure » (nav à jour plus tôt), pas « identique » ; critère d'acceptation : grille et arêtes égales à un recalcul complet au repos, et état égal sur le banc. CORRECTION 2, gain : −20, −8, −24, −20 % (et −4, −4, −13, −33 % sur 4 autres mondes) du temps CPU avec mon pilote, JIT compris ; le −22 à −31 % du premier tour est le haut de la fourchette. Sous-ensemble de 10 lignes à faire d'abord : diff vide (85 à 88 % des révisions) = aucune invalidation. Le test simulation.test.mjs:1862-1872 (navPending>0) doit être réécrit, comme annoncé ; l'ouverture de porte par progression (ligne 300) reste non couverte (doorOpen=0 dans tous mes passages aussi) : test obligatoire avant fusion.

**Preuve corrigée.** État identique sur 14 passages (2 pilotes), mais grilles nav différentes pendant 9 à 139 pas sur 1800 et jusqu'à 19 arêtes périmées près des pièges mobiles : l'exactitude n'est pas garantie par construction.

**Gain corrigé.** −4 à −33 % du temps CPU de simulation selon le monde et le pilote (médiane ≈ −20 %) ; pointes de replanification après destruction divisées par ~15 (4 422 → 37 segmentFree par recherche plafonnée).

### SIM-02 — ground() : 5 formes cachées lues objet par objet ; SoA et sous-grille de 2 m aux résultats exacts
- sévérité haute · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/simulation.js:122-137; src/simulation.js:153; src/simulation.js:992-994

**Preuve.** src/simulation.js:126-137 : boucle sur les sols du seau de 8 m avec f.w/2+1e-7, f.y||0, f.slopeX||0 et priorité plat > rampe > substrat. La ligne 135 parcourt tous les pièges actifs pour t.kind==='floor', un type absent des mondes actuels. Les 26 à 28 sols ont 5 formes V8 (box-shapes.mjs) : les sites de lecture sont mégamorphes. Appels par pas : 561 à 1276 en moyenne, p99 3313 à 4526, max 33 642 à 34 367. Coût 83 à 96 ns par appel, 11,4 % du temps propre, et 36,4 % des octets alloués (206 Ko/pas). Densité : 1,64 à 1,69 sol par seau de 8 m, 1,41 à 1,43 par case de 2 m. ground v2 : 0 écart (Object.is) sur environ 21 millions de points (bords ±1e-7, ±ulp, ±1e-12, frontières de cases, NaN, ±Infinity, −0, 1e300) et sur 300 000 listes de pièges. Il coûte 20,6 à 26,2 ns (×3,2 à ×3,9) sur des points uniformes et 11,6 à 19,8 ns (×4,5 à ×7,5) sur les points de trace réels. A/B apparié : −19 à −32 % du total, ratio médian 0,67 à 0,80 ; en séquentiel −26 à −39 %, max 21,7→12,2 ms.

**Cause.** Les sols sont des objets hétérogènes à 5 formes, lus champ par champ en for-of. Le seau de 8 m est trop grossier : la plupart des requêtes tombent sur un seul sol plat qui couvre toute la case, mais on reteste tous les candidats et on reparcourt les pièges.

**Proposition.** 1) À la création, construire des Float64Array gFX, gFZ, gHW (=w/2+1e-7), gHD, gFY (=y||0), gSX, gSZ et un Uint8Array gFK (0 plat, 1 rampe, 2 substrat ou secours).
2) Sous-grille de 2 m alignée sur les seaux de 8 m, stockée en CSR (gStart, gCells). Les candidats d'une case sont les sols du seau parent dont la boîte élargie de 1e-6 la touche.
3) gTop[c] vaut la hauteur d'un sol plat qui couvre toute la case (marge 1e-6) et domine les plats candidats, sinon NaN. Quand gTop est défini, sortie immédiate.
4) groundScan(x,z,from,to) reprend la même arithmétique et le même ordre de priorité. Hors grille, balayage complet.
5) Pièges : mettre en cache la liste filtrée kind==='floor' selon l'identité et la longueur du tableau reçu, puis garder la boucle d'origine.
6) floorBuckets reste pour fallbackLanding (138) et beneathTerrain (145).
Prototype : bench/sim/ground-v2.mjs (+1,9 Ko).

**Gain attendu.** ×3,2 à ×7,5 par appel. −19 à −32 % du temps total en A/B apparié. Seul correctif avec une telle couverture d'appelants : debrisFloor, pumpNav, segmentFree.

**Risques.** Exactitude prouvée sur 21 millions de points et simulation identique bit à bit. 301/301 tests avec les autres correctifs, hors nav. Hypothèse : les sols ne changent pas après create (vrai en 0.8.0). Si un futur code modifie world.walkable, reconstruire les tableaux au moment où terrainDirty est posé. Aucun effet sur les snapshots ni sur la génération. Mémoire : quelques Ko.

**Vérifier par.** node ground-equiv.mjs 2 (0 écart) ; node ground-micro-fast.mjs ; REPS=2 node ab2.mjs ground-v2.mjs groundPatch 2

**Contre-vérification.** Code relu (122-137, 153, 992-994) : exact. Aucun piège de type 'floor' n'est généré (world.js:1299 : blade, press, spikes) ; floors n'est jamais modifié après create (seules lectures : 86, 154, 2087). Lockstep indépendant de ground-v2 seul : état identique, −29 % (legacy-s2 roquettes) et −14 % (campaign-w10) en CPU à chaud, ratio médian 0,72 et 0,80. Le gain par appel (×3,2 à ×7,5) et les 21 millions de points n'ont pas été rejoués (plausibles). Nuance de priorité : le pas moyen ne pèse que 1 à 2 % d'une image sur bureau ; l'intérêt réel est mobile et les images à 8 sous-pas. Recoupe SIM-01 et SIM-03 (moins d'appels à ground une fois ceux-ci faits) : les gains ne s'additionnent pas.

**Gain corrigé.** −14 à −29 % du temps CPU de simulation, seul.

### SIM-03 — Débris : chaque pièce au repos est revalidée à chaque pas, avec 5 appels à ground, un Set et 216 points de feuillage
- sévérité haute · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/simulation.js:68-83; src/simulation.js:992-1005; src/simulation.js:1028-1065

**Preuve.** src/simulation.js:1028-1065 : updateDebris pèse 28,1 % du temps inclusif. Dans son sous-arbre : debrisFloor 34,3 %, ground 26,1 %, debrisBoxes 16,6 %, debrisHalf 6,8 %.
- 1029 recrée dynamic à chaque pas ([...doorBoxes,...trapBoxes,...s.lifts.map(...)]).
- 1034 : une pièce au repos refait debrisSupport, soit 0,94 à 1,10 µs par pièce et par pas, 33 à 49 % de updateDebris.
- 992-994 : debrisFloor fait 5 appels à ground.
- 995-999 : debrisBoxes passe par un Set, Array.from et filter.
- 77-79 : la branche feuillage parcourt 216 points avec map et reduce, alors que 38 seulement sont uniques (5,96 → 0,46 µs par axe).
- 1064 refait un filter à chaque pas.
Pièce en mouvement 8,2 à 9,2 µs, feuillage en mouvement 61 µs. Aux roquettes : 117,8 pièces par pas, 345 µs par pas (debris-cost.mjs, foliage.mjs). debris v2 : identique, −18 à −29 % (ratio médian 0,68 à 0,74). legacy-s2 aux roquettes : pas moyen 0,450→0,165 ms (−63 %).

**Cause.** Les débris n'ont pas de sommeil : le repos est revalidé contre les boîtes et 5 sols à chaque pas. Des structures temporaires sont créées par pièce et par pas. L'enveloppe du feuillage est recalculée sur des points redondants.

**Proposition.** 1) Sommeil indexé sur la révision. Juste après le test d'expiration : 'if(q.resting&&debrisSleep.get(q)===seenDestructionRevision)continue;'. La révision est inscrite quand le test de repos réussit et que le support statique seul suffit (debrisStaticSupport : sols et solides, sans portes, pièges ni lifts). Au réveil, debrisSleep.delete(q). debrisSleep est une WeakMap, désactivée si le monde contient des pièges kind==='floor'. C'est exact : les boîtes dynamiques ne peuvent qu'ajouter du support, et la branche d'origine fait 'continue' dès qu'un support existe.
2) debrisFloor : mémo à 2 entrées, remis à NaN au début de updateDebris.
3) debrisBoxes : d'abord les boîtes dynamiques filtrées, puis les indices du miroir de collision avec des estampilles. Même ordre et mêmes prédicats, sans Set ni Array.from.
4) Feuillage : 38 points uniques, maximum calculé en boucle avec la même arithmétique Math.abs(0+p[0]*v[0]+p[1]*v[1]+p[2]*v[2]).
5) Ensuite, non prototypé : indexer le cache de debrisHalf (69) sur les valeurs de rotation plutôt que sur l'identité du tableau, qui change à chaque pas pour une pièce en rotation.
Prototype : bench/sim/debris-v2.mjs et mirror.mjs (+2,6 Ko).

**Gain attendu.** −18 à −29 % du temps total en A/B apparié. −63 % du pas moyen en combat aux roquettes, où updateDebris dominait (345 µs/pas).

**Risques.** Identique bit à bit. 301/301 tests, y compris les débris persistants, la restauration de gravats et la destruction. Le sommeil doit tomber à toute modification statique : seenDestructionRevision s'en charge. Toute future source de support mobile capable de retirer un support (plateforme qui descend sous une pièce) devra réveiller les pièces. Snapshot inchangé : la WeakMap est vide après restore, ce qui coûte une revalidation.

**Vérifier par.** REPS=2 node ab2.mjs debris-v2.mjs debrisPatch ; WEAPON=2 SCEN=legacy-s2 REPS=2 node ab2.mjs debris-v2.mjs debrisPatch ; node debris-cost.mjs ; node foliage.mjs

**Contre-vérification.** Code relu (68-83, 992-1005, 1028-1065) : exact. Le sommeil est sûr à la lecture : seuls 1034 et 1060/1085 touchent resting, et un support statique ne change qu'avec une révision (ground figé, solids remplacé en 231). Lockstep indépendant avec empreinte incluant rotation, repos et âge des débris : identique ; −32 à −34 % en legacy-s2 aux roquettes (47 materialBreak, ratio médian 0,50 à 0,55), mais seulement −5 à −11 % en campaign-w10 (14 materialBreak). Le gain dépend donc du nombre de pièces : le « −18 à −29 % partout » est optimiste hors combat destructeur. Risque à écrire dans le code : tout futur support mobile capable de se retirer doit réveiller les pièces.

**Gain corrigé.** −5 à −11 % en combat ordinaire, −32 à −34 % en combat aux roquettes (CPU, apparié).

### SIM-04 — blocked() : un tableau alloué par appel, ground recalculé par défaut et un site de lecture mégamorphe
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **plausible**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:214-227; src/simulation.js:242-251

**Preuve.** src/simulation.js:242 : 'function blocked(x,z,r=.28,y=ground(x,z),...)'. La ligne 245 fait 'for(const list of [boxes,doors,traps])for(const q of list)' : un tableau est alloué à chaque appel, et le même site lit minY, maxY, minX, maxX, minZ et maxZ sur des solides (2 formes), des portes et des pièges. Seaux de 8 m avec bucketRadius 1,05 (214-227). Appels par pas : 177 à 336, max environ 24 000, dont 73 à 88 % depuis pumpNav. 8,0 % du temps propre et 21,1 % des octets alloués (119 Ko/pas). blocked v2 : identique, −10 à −16 %. Pointe max 40→28, 31,5→14,8, 24,7→15,6 et 21,3→13,6 ms.

**Cause.** Une allocation à chaque appel, des lectures polymorphes d'objets et un ground recalculé même quand l'appelant le connaît déjà.

**Proposition.** 1) Construire un miroir CSR paresseux, recalculé quand solids change d'identité : mirrorStart, mirrorIdx et mirrorBox (Float64Array, 6 doubles par entrée). Il est partagé avec les débris et les rayons.
2) Écrire blockedList(list,x,z,rr,top,bottom) avec top=y+height-1e-7, bottom=y+.06 et rr=r*r.
3) Si staticBoxes===solids, 0≤r≤bucketRadius et seau dans les bornes : lire les boîtes du seau dans mirrorBox. Sinon : blockedList(staticBoxes). Puis les portes, puis les pièges.
4) Les appelants qui connaissent le sol le passent (segmentFree, pumpNav).
Prototype : bench/sim/blocked-v2.mjs et mirror.mjs (+1,5 Ko).

**Gain attendu.** −10 à −16 % du temps total en A/B apparié ; pointes max −30 à −53 %.

**Risques.** Le résultat est un booléen, donc indépendant de l'ordre de parcours. Identique bit à bit, 301/301 tests. Le miroir doit suivre chaque remplacement de solids (syncDestruction 231, restore) : la garde par identité du tableau le garantit. Le gain recoupe en partie SIM-01, puisque les appels viennent surtout de pumpNav. Taille +1,5 Ko.

**Vérifier par.** REPS=2 node ab2.mjs blocked-v2.mjs blockedPatch

**Contre-vérification.** Code relu (214-227, 242-251) : exact. Lockstep indépendant : état identique, mais gain instable : 0 % en legacy-s2, −22 % à chaud en campaign-w10, ratio médian par pas 0,92 à 0,97. Le gain vient surtout des pas où pumpNav recalcule la grille (73 à 88 % des appels) : une fois SIM-01 appliqué, ces appels disparaissent presque et le gain résiduel se limite aux rafales de route. Les baisses de pointe annoncées (40→28 ms…) ne sont pas vérifiables sous cette charge. À faire après SIM-01, avec le miroir CSR partagé (SIM-03, SIM-07).

**Gain corrigé.** 0 à −22 % seul (médiane par pas −3 à −8 %) ; faible après SIM-01.

### SIM-05 — Allocations : 534 à 864 Ko par pas, surtout des HeapNumber créées par des lectures mégamorphes
- sévérité moyenne · catégorie mémoire · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:126-137; src/simulation.js:242-251; src/simulation.js:260-271; src/simulation.js:514; src/simulation.js:1361; src/simulation.js:1420; src/simulation.js:1742; src/destruction.js:174-176

**Preuve.** Les compteurs V8 'allocated=' (--trace-gc-nvp, gc-harness.mjs et alloc-steps.mjs, passe chaude de 1800 pas) donnent 534, 864, 632 et 687 Ko par pas, soit 32 à 52 Mo/s à 60 Hz. Cela fait 14 à 23 scavenges par 30 s, 8,7 à 29 ms cumulés.
Profil d'échantillonnage du tas (alloc.mjs) : ground 36,4 %, blocked 21,1 %, ray 5,9 %, pumpNav 3,3 %, debrisBoxes 3,2 %, updateDebris 3,0 %, updateEnemies 3,0 %, debrisHalf 2,8 %, segmentFree 2,5 %, coord (514) 0,9 %.
Formes cachées : 5 pour les sols, 4 à 5 pour les ennemis, 2 pour les solides (box-shapes.mjs). Microbanc mega-alloc.mjs sur une boucle de type ground : monomorphe 2,5 à 48 o par appel et 108 à 153 ns ; à 5 formes, 105 à 148 o par appel et 518 à 921 ns.
Après correctifs : 211 à 297 Ko par pas avec all-v2, 133 à 224 Ko avec full-v2 (−74 %), 3 à 6 scavenges par 30 s. Sur bureau, le GC ne pèse que 1,5 à 1,9 % du CPU.

**Cause.** V8 ne déballe plus les champs double : une lecture mégamorphe (5 formes ou plus au même site) renvoie une nouvelle HeapNumber, de 16 o sous Node et 12 o sous Chrome avec compression de pointeurs. S'y ajoutent la mise en boîte des arguments et des retours double aux appels non inlinés, et des tableaux littéraux créés par appel : [x,z] de coord (514), [[...],[...]] de segmentFree (1361), [boxes,doors,traps] (245), spreads ...coord(i) (1420), starts (1742), flatMap et filter (676, 687, 724, 1805), closure free de move (260-271).

**Proposition.** 1) Formes fixes : une fabrique par type (sol, ennemi, boîte de collision) qui crée toutes les propriétés dans le même ordre, avec des valeurs numériques initialisées en double (slopeX:0, slopeZ:0…). Elle s'applique aussi à restore() et à destruction.js:174-176, où les spreads {...e.solid.bounds,mesh,destructibleId} et {...c,mesh} produisent 2 formes.
2) Miroirs SoA pour les boucles chaudes, déjà prototypés en SIM-02, 03, 04 et 07.
3) Remplacer coord(i) par des scalaires coordX(i) et coordZ(i), et appeler segmentFree(cx(i),cz(i),cx(j),cz(j)) en 1420.
4) Supprimer les tableaux littéraux créés par appel et garder les fonctions chaudes assez petites pour être inlinées.

**Gain attendu.** −74 % d'octets alloués, mesuré avec les prototypes ; scavenges divisés par 3 à 5. Le gain CPU direct sur bureau est faible (GC 1,5 à 1,9 %). L'intérêt est sur mobile, où le jeune espace est plus petit et les scavenges plus fréquents (estimé).

**Risques.** Changer l'ordre des propriétés des ennemis change l'ordre des clés du JSON de snapshot, puisque JSON.stringify suit l'ordre d'insertion. Les tests comparent deux snapshots de la même version et restent valides, et les anciennes sauvegardes se restaurent, mais toute empreinte d'octets de snapshot enregistrée ailleurs changerait. Ne pas modifier l'ordre des tirages aléatoires de world.js. Taille des fabriques : moins de 1 Ko.

**Vérifier par.** node gc-harness.mjs alloc-steps.mjs full-v2.mjs fullPatch ; node gc-harness.mjs mega-alloc.mjs ; node --allow-natives-syntax box-shapes.mjs ; node --expose-gc alloc.mjs full-v2.mjs fullPatch

**Contre-vérification.** Preuve indépendante par une autre méthode (alloc.mjs : delta de heapUsed sur des fenêtres de 25 pas, jeune génération de 256 Mo, gc() avant chaque fenêtre, aucune fenêtre rejetée, pilote du premier tour) : original 531 / 874 / 685 / 733 Ko par pas (premier tour : 534 / 864 / 632 / 687) ; all-v2 225 / 311 / 267 / 246 ; full-v2 148 / 239 / 193 / 196, soit −72 à −73 % (annoncé −74 %). La cause (HeapNumber sur lectures mégamorphes) n'a pas été re-prouvée, elle est cohérente. Gain CPU faible sur bureau, comme annoncé. Réserve sur la fabrique à forme fixe : elle change l'ordre des clés JSON des snapshots ; inoffensif pour restore, mais à ne faire que si l'empreinte fingerprint (ligne 237-241, calculée sur world.*) n'en dépend pas : elle sérialise world.enemies et world.walkable, donc la fabrique doit s'appliquer aux copies de la simulation, jamais aux objets du monde, sous peine d'invalider toutes les sauvegardes.

**Gain corrigé.** −72 à −73 % d'octets alloués par pas (531-874 → 148-239 Ko).

### SIM-06 — Boucles sur toutes les identités ennemies à chaque pas, rencontres comptées deux fois
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:675-678; src/simulation.js:684-688; src/simulation.js:724-737; src/simulation.js:1279-1290; src/simulation.js:1742; src/simulation.js:1763; src/simulation.js:1803-1805

**Preuve.** src/simulation.js:
- 675-678 : encounterCounts fait un flatMap et deux filter par rencontre, et elle est appelée deux fois par pas (736 et 1805).
- 687 : flatMap des vagues.
- 724-729 : filter sur tous les ennemis, puis tri avec Math.hypot dans le comparateur.
- 1279-1290 : rebuildNeighbors, appelée deux fois par pas (1742 et 1803), utilise des clés chaînes.
- 1742 : 'starts=s.enemies.map(e=>[e.x,e.z])'.
- 1763 : boucle sur 6 noms de minuteries, avec des accès indexés par chaîne.
- 1804 : Math.hypot pour les 84 à 170 ennemis, alors que 99,6 à 100 % ont un déplacement nul (movespeed-zero.mjs).
- 1805 : Object.assign avec un filter.
Avant correctifs, encounterCounts pèse 4,0 % en temps propre et 5,1 % en inclusif. Après all-v2, elle devient la première fonction en temps propre (10,9 %, plus 3,6 % de closures). identity v2 : identique ; −1 à −6 % seul, −10 à −14 % par-dessus all-v2 (ratio médian 0,81 à 0,85).

**Cause.** Les listes d'identifiants des rencontres sont statiques mais reconstruites deux fois par pas. Chaque boucle crée des tableaux et des closures, et elle parcourt les 84 à 170 identités même dormantes.

**Proposition.** 1) Précalculer encounterIds une fois, à côté d'encounterMap (182).
2) encounterCounts : boucles de comptage sans tableau ; aiStats affecté champ par champ.
3) Trier les candidats par indices, sur des clés précalculées, avec le même comparateur : le tri est stable et la suite des comparaisons est la même.
4) Clés de voisinage numériques : (Math.floor(x/8)+32768)*65536+(Math.floor(z/8)+32768).
5) starts dans un Float64Array réutilisé ; les 6 minuteries décrémentées explicitement.
6) moveSpeed en 1804, non prototypé mais exact : 'const dx=...,dz=...; e.moveSpeed=dx===0&&dz===0?0:Math.hypot(dx,dz)/dt;', puisque hypot(±0,±0)=+0.
7) Pour l'axe IA : une liste des ennemis actifs pour ne plus parcourir les dormants.
Prototype : bench/sim/identity-v2.mjs (+0,8 Ko).

**Gain attendu.** −10 à −14 % du temps total une fois SIM-01 à SIM-04 appliqués (mesuré). Le saut de hypot en 1804 retire environ 170 appels par pas, soit à peu près 2 µs et 8 Ko par pas (estimé).

**Risques.** Hypothèse : les enemyIds des vagues ne changent pas après create (vrai en 0.8.0) ; sinon, recalculer à la modification. Les clés numériques restent valides tant que |x| et |z| sont sous 262 km. Identique bit à bit, 301/301 tests.

**Vérifier par.** BASE=all-v2.mjs:allPatch REPS=2 node ab2.mjs identity-v2.mjs identityPatch ; node movespeed-zero.mjs

**Contre-vérification.** Code relu : 675-678, 687, 724-737 (hors du bloc encounterWait, donc à chaque pas), 1279-1290, 1742, 1763, 1803-1805 exacts ; encounterCounts est bien appelée deux fois par pas en mode progression. Lockstep indépendant de identity-v2 par-dessus all-v2 : identique, −14 % et −9 % à chaud, ratio médian 0,86 et 0,83 (annoncé −10 à −14 %, 0,81 à 0,85). Le tri par clés précalculées est exact (comparateur pur, même ordre d'appels) ; hypot(±0,±0)=+0 vérifié (hypot.mjs).

**Gain corrigé.** −9 à −14 % après SIM-01 à SIM-04.

### SIM-07 — ray() et castProjectile() balaient toutes les boîtes et tous les sols du niveau à chaque rayon
- sévérité moyenne · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:474-511; src/simulation.js:956-979; src/simulation.js:1921-1931

**Preuve.** src/simulation.js:474-510 : chaque rayon teste les quelque 450 à 500 solides, les portes, les pièges, les lifts et tous les sols, avec un échange par destructuration et 'for(const k of [0,2])' pour chaque sol. 956-979 : castProjectile recrée le tableau lifts et 'n=[0,1,0]' pour chaque boîte. Fréquence : 0,15 à 1,7 rayon par pas, au plus 8 (balles en 1921-1931, hitRay, sight). Coût par appel (ray-micro.mjs) : ray 14,5 à 21,9 µs → 2,1 à 3,0 µs (×5,6 à ×7,3) ; castProjectile 25 à 30 → 7,9 à 10,5 µs (×2,7 à ×3,7). ray-equiv.mjs : 0 écart sur 240 000 rayons. Simulation identique, mais le gain moyen se perd dans le bruit (+2/−2/−13/+6 %). Aux roquettes en legacy-s2 : −4 %, max 8,0→6,2 ms, pas > 4 ms de 8 à 4. Après all-v2, ray pèse 6,3 % du temps propre et 5,9 % des allocations d'origine.

**Cause.** Les rayons n'utilisent aucune structure spatiale, alors que les seaux de collision de 8 m existent déjà.

**Proposition.** 1) Parcourir les seaux de 8 m existants par DDA d'Amanatides-Woo, avec une garde de 4096 itérations.
2) Estampilles pour ne tester chaque boîte qu'une fois ; arrêt dès que l'entrée de la case suivante dépasse le meilleur impact.
3) Repli sur le balayage complet si l'origine est hors grille ou si d n'est pas fini.
4) castProjectile : collecter les boîtes des cases traversées jusqu'à far, trier leurs indices et les tester dans l'ordre d'origine, ce qui conserve le départage des normales à égalité.
5) Dérouler la boucle des sols.
Prototype : bench/sim/ray-v2.mjs (+3,6 Ko avec le miroir).

**Gain attendu.** ×5,6 à ×7,3 par rayon (mesuré). Le gain moyen est faible aujourd'hui (8 rayons par pas au plus). Il devient utile en rafale (tirs multiples, explosions, vue des ennemis) : aux roquettes, les pas > 4 ms sont divisés par 2.

**Risques.** L'ordre de test et le départage des égalités sont préservés par le tri des indices. Une boîte plus grande qu'un seau est insérée dans tous les seaux qu'elle touche (bucketRadius 1,05) : garder ce remplissage. Identique bit à bit, 301/301 tests. __castProjectile n'est exposé que dans le banc (exposeCast).

**Vérifier par.** node ray-equiv.mjs ; node ray-micro.mjs ; WEAPON=2 SCEN=legacy-s2 REPS=2 node ab2.mjs ray-v2.mjs rayPatch

**Contre-vérification.** Code relu (474-510, 956-979) : exact ; le résultat de ray est un minimum d'entrées, donc indépendant de l'ordre, et le tri des indices préserve le départage des normales de castProjectile. Lockstep indépendant (rayPatch, legacy-s2 aux roquettes, 5 roquettes, 47 materialBreak) : identique, −7 % au total et −12 % à chaud, ratio médian 0,92. Les gains par appel (×5,6 à ×7,3) et les 240 000 rayons n'ont pas été rejoués. Réserves : rayV2 seul ne se charge pas sans le miroir (ReferenceError ensureMirror ; utiliser rayPatch) ; un collider hors de world.bounds, rangé par écrêtage dans un seau de bord, serait manqué par un DDA qui sort de la grille : ajouter une assertion à la création (tous les colliders dans les bornes) ou garder le balayage complet pour ces boîtes. +3,6 Ko pour un gain moyen faible : après SIM-01 à 03.

**Gain corrigé.** −7 à −12 % en combat aux roquettes ; bruit ailleurs.

### SIM-08 — Une révision de destruction reconstruit tout : 1,6 à 2,3 ms par impact
- sévérité moyenne · catégorie saccade · effort L · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité identique · jeu
- lieux : src/destruction.js:160-178; src/simulation.js:229-235; src/simulation.js:903-926; src/simulation.js:932

**Preuve.** Coût mesuré (revision-cost.mjs, phases.mjs) : damageScenery 1,6 à 2,3 ms par impact, explode 2,1 ms.
- src/destruction.js:160-178 : rebuild repasse sur les 14 000 à 17 000 meshes d'origine et recrée chaque boîte par spread ({...e.solid.bounds,…} et {...c,…}).
- src/simulation.js:231 : enchaîne rebuildCollision() complet (vider puis remplir tous les seaux), navDirty=terrainDirty=true et unsupportedBodies().
Beaucoup de révisions ne changent aucune boîte (nav-refresh.mjs). Diff de collisionneurs : 924 µs avec des clés chaînes, 77 µs avec un hash numérique. Le rebuild de destruction pèse 1,7 % du temps propre, 3,7 % après all-v2. Après all-v2, fire représente 13,7 % en inclusif, dont 6 % de dégâts de destruction.

**Cause.** Le cache par groupe évite de recompiler les groupes inchangés, mais les sorties (meshes, colliders) et les structures de la simulation (seaux, nav, terrain) sont refaites en entier à chaque révision.

**Proposition.** 1) Dans destruction.rebuild, réutiliser les objets boîte des groupes inchangés, dont l'identité est alors conservée, et ne reconstruire que les tranches des groupes modifiés (offsets firstIndex). Séparer la liste de rendu, produite à la demande pour le renderer, des collisionneurs.
2) Dans syncDestruction, faire le diff numérique de SIM-01. S'il est vide, ne toucher ni aux seaux, ni à la nav, ni au terrain. Sinon, retirer et ajouter seulement les boîtes changées, dans les seaux concernés et dans le miroir CSR.

**Gain attendu.** Estimé : la part simulation d'une révision passe de l'ordre de la milliseconde à quelques dizaines de µs quand peu de boîtes changent. Avec SIM-01, les pointes d'impact baisseraient d'environ moitié (à mesurer).

**Risques.** Le renderer dépend de l'ordre des meshes (commentaire destruction.js:169-170) : la mise à jour par tranches doit le conserver. Si l'identité des boîtes devient stable, le miroir et les caches devront s'invalider sur la révision et non plus sur l'identité du tableau. Tests destruction, renderer-destruction et checkpoint obligatoires. Effort L à cause du couplage avec le renderer.

**Vérifier par.** node revision-cost.mjs ; node phases.mjs (damageScenery et explode par impact) ; WEAPON=2 SCEN=legacy-s2 REPS=2 node ab2.mjs <module> <export> (identical=true)

**Contre-vérification.** Code relu (destruction.js:160-178, simulation.js:229-235, 903-926) : exact. Mesure indépendante (probe.mjs, CPU) : damageScenery coûte 41 à 82 ms cumulés par 30 s pour 48 à 81 appels et 8 à 15 révisions, soit au plus 5 à 7 ms par révision sur cette machine lente (≈ 1,1 à 1,9 ms ramené aux conditions du premier tour : cohérent avec 1,6 à 2,3 ms). CORRECTION : la part simulation de syncDestruction (rebuildCollision + unsupportedBodies) ne coûte que 1,7 à 2,7 ms cumulés, soit ~4 % du coût d'une révision : le point 2 de la proposition (ne pas refaire les seaux quand le diff est vide) rapporte peu ; le gain est dans destruction.rebuild (point 1) et côté rendu (24 à 31 ms par révision, axe RCPU), ainsi que dans SIM-01. Fait utile confirmé : 85 à 88 % des révisions ne changent aucun collider. Second rang de pointes confirmé hors route : pas 80 de legacy-s2 (materialBreak, 28 ms CPU ici, route 0) et pas 840 de campaign-w10 : l'affirmation « 100 % des pointes dans route » du premier tour ne vaut que pour le premier rang. Risque réel : l'ordre des meshes dont dépend le renderer.

**Gain corrigé.** Part simulation : ~0,05 à 0,1 ms par révision seulement ; l'essentiel du gain est dans destruction.rebuild et le rendu (non mesuré ici).

### SIM-09 — segmentFree : sol calculé deux fois par extrémité, trois tableaux alloués par boîte
- sévérité basse · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:1349-1377; src/simulation.js:1420

**Preuve.** src/simulation.js:1349-1377.
- 1350 : 'if(blocked(ax,az,r)||blocked(bx,bz,r))return false;' sans y, donc ground passe par le paramètre par défaut, puis par groundAt (153) pour les mêmes points.
- 1361 : 'for(const [origin,delta,min,max] of [[ax,dx,...],[az,dz,...]])' alloue 3 tableaux par boîte.
- 1368 : hypot.
- 1420 : appel avec ...coord(i),...coord(j).
Jusqu'à environ 4 700 appels par pas pendant les rafales de route. 4,7 % du temps propre et 39,7 % du sous-arbre route. segmentFree v2 : identique, −1 à −8 %.

**Cause.** Le sol déjà connu n'est pas transmis, et un test de dalles écrit de façon générique alloue à chaque boîte.

**Proposition.** 'ga=ground(ax,az); if(blocked(ax,az,r,ga))return false;' puis de même pour gb, et 'ay=Number.isFinite(ga)?ga:0', qui reproduit groundAt. Dérouler le test de dalles sur les deux axes avec un échange manuel, calculer low et high une fois, ne créer aucun tableau littéral. Depuis route, passer 4 scalaires au lieu des spreads de coord.

**Gain attendu.** −1 à −8 % du total (mesuré). Davantage dans les pointes de route en début de vague (SIM-12), où segmentFree domine.

**Risques.** Identique bit à bit. ay doit garder exactement le repli de groundAt (0 si non fini). Taille +0,1 Ko.

**Vérifier par.** REPS=2 node ab2.mjs blocked-v2.mjs segmentPatch

**Contre-vérification.** Code relu (1349-1377, 1420) : exact, avec une précision : les 3 tableaux de la ligne 1361 ne sont alloués que pour les boîtes qui passent les rejets 1356 et 1359, pas pour chaque boîte. Lockstep indépendant (segmentV2 seul) : identique, −7 à −10 % en legacy-s2, −2 à −8 % en campaign-w10, ratio médian 1,00 et 0,97 : le gain est concentré dans les rafales de route (jusqu'à 4 700 appels par pas, confirmé : 4 245 à 4 703 dans mes compteurs). Effort S, sans risque : à livrer avec SIM-01.

**Gain corrigé.** −2 à −10 % au total, concentré sur les pas de replanification.

### SIM-10 — Math.hypot coûte 9 à 13 fois sqrt et alloue, mais ne lui est pas interchangeable
- sévérité basse · catégorie perf-cpu · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P3 · qualité identique · jeu
- lieux : src/simulation.js:1804; src/simulation.js:1033; src/simulation.js:1060; src/simulation.js:370; src/simulation.js:599; src/simulation.js:1368

**Preuve.** simulation.js contient 138 appels à Math.hypot, dont 20 avec spread. hypot-bench.mjs enveloppe Math.hypot pendant la simulation sans changer les résultats.
- Fréquence : 213 à 377 appels par pas en moyenne, p99 455 à 708, max environ 4 900 ; 73,4 % à 2 arguments, 26,6 % à 3.
- Appelants : updateEnemies:1804 55 %, updateDebris:1033 15 %, checkPad:370 8 %, segmentFree:1368 5 %, collectSupplies:599 4 %.
- Coût : hypot(a,b) 13,2 ns contre 1,44 ns pour sqrt(a*a+b*b) ; hypot(a,b,c) 22,8 contre 1,74 ns ; hypot(...v) 32,7 ns.
- Allocation : 48, 64 et environ 100 o par appel, 0 pour sqrt.
- Exactitude : 35 à 37 % des résultats à 2 arguments et 31 à 37 % à 3 arguments diffèrent de sqrt de 1 à 2 ulp.
En 1804, 99,6 à 100 % des déplacements sont nuls.

**Cause.** Le builtin V8 de Math.hypot alloue un tableau de doubles, divise par le maximum puis fait une somme de Kahan. L'optimiseur ne le réduit pas à une instruction.

**Proposition.** 1) Pas de remplacement global : 35 % des résultats et donc les trajectoires changeraient.
2) Réécritures exactes :
- en 1804, sauter hypot si dx===0&&dz===0 (+0 identique) ;
- devant les tests de seuil à 2 arguments hypot(dx,dz)>r, ajouter le rejet exact Math.abs(dx)>r||Math.abs(dz)>r. Dans V8, hypot ≥ max(|dx|,|dz|) est garanti, car la somme contient exactement 1 ;
- 1033 et 1060 n'opèrent plus que sur les pièces éveillées grâce à SIM-03.
3) Si l'équipe accepte un nouveau point de référence : sqrt est correctement arrondie en pratique dans tous les moteurs, alors que la spécification laisse la précision de hypot à l'implémentation. Passer à sqrt rendrait les trajectoires identiques d'un moteur à l'autre.

**Gain attendu.** Estimé : 2 à 3 % du pas d'origine (environ 250 appels × 13 à 23 ns ≈ 4 µs), 4 à 6 % une fois les autres correctifs appliqués. 12 à 19 Ko alloués en moins par pas, jusqu'à 75 µs gagnés dans les pas en rafale.

**Risques.** Les réécritures exactes ne changent aucun résultat. Un remplacement global casserait la reproductibilité avec les sauvegardes et les tests qui figent des valeurs : à éviter sans décision explicite. Ne pas toucher aux 40 appels de world.js, qui servent à la génération des niveaux.

**Vérifier par.** node gc-harness.mjs hypot-bench.mjs ; node movespeed-zero.mjs ; REPS=2 node ab2.mjs <module> <export> (identical=true)

**Contre-vérification.** Mesure indépendante (hypot.mjs, 2 millions de tirages, temps CPU) : hypot à 2 arguments ×13,5 plus lent que sqrt, à 3 arguments ×13,6 ; 38,1 % et 39,7 % de résultats différents ; écart maximal de 3 ulp dans mon échantillon (annoncé 1 à 2 ulp : corriger en « jusqu'à 3 ulp ») ; hypot ≥ max(|a|,|b|) sans exception sur 2 millions ; hypot(±0,±0)=+0. La conclusion tient : pas de remplacement global, seulement les réécritures exactes. Le rejet par |dx|>r repose sur une propriété de l'implémentation V8 (vraie aussi pour fdlibm), pas sur la spécification : gain minime, à ne faire que pour 1804 (déplacement nul), déjà couvert par SIM-06.

**Preuve corrigée.** Écart hypot/sqrt jusqu'à 3 ulp (et non 2).

**Gain corrigé.** ≈ 2 à 3 % du pas d'origine, pour l'essentiel via le saut de la ligne 1804 (SIM-06).

### SIM-11 — Méthode : le bac à sable node:vm fausse les profils (ground ×8 à ×9, pas ×5)
- sévérité haute · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité sans objet · moteur et jeu
- lieux : checks/simulation.test.mjs:7-11; src/world.js:1340-1390

**Preuve.** Les tests du dépôt (par exemple checks/simulation.test.mjs:7-11) et les bancs habituels chargent le jeu par vm.createContext et runInContext. Chaque accès à Math, Number ou Infinity y passe par un intercepteur. Comparaison vm / domaine principal :
- ground : 700 à 880 ns par appel contre 83 à 96 ns, même checksum (realm-check.mjs) ;
- pas moyen : 0,85 à 1,42 ms contre 0,157 à 0,283 ms ;
- création : 278 à 358 ms contre 57 à 114 ms ;
- part de ground : 52,1 % du temps propre contre 11,4 %.
Sous une charge de 5 à 16, même l'A/B apparié montre ±13 % de bruit pour un correctif à effet moyen faible (ray v2 : +2/−2/−13/+6 %). Les fonctions de world.js (demolitionMetadata 1340-1388, distance 1345, nearBox 1390) n'apparaissent dans aucun profil de pas : elles ne coûtent qu'à la génération.

**Cause.** Un contexte vm contextifié intercepte toutes les lectures de globales. Les petites fonctions chaudes comme ground en sont les plus pénalisées.

**Proposition.** Mesurer avec fast.mjs (vm.runInThisContext et window neuf) et décider par A/B apparié avec ab2.mjs : empreinte FNV par pas des Float64 du joueur, des ennemis et des débris, hash du snapshot final, ratio médian des pas. Garder vm pour les tests fonctionnels. Ajouter au dépôt un script de banc équivalent, sous tools/, hors de npm test.

**Gain attendu.** Qualitatif : évite de surprioriser ground (52 % en vm contre 11 % en réalité) et de se tromper d'un facteur 5 sur les gains absolus.

**Risques.** Aucun pour le jeu ; un banc sous tools/ ne change pas dist/index.html.

**Vérifier par.** node realm-check.mjs ; comparer node profile-steps.mjs (vm) et node profile-fast.mjs (domaine principal)

**Contre-vérification.** Mesure indépendante (realm.mjs, temps CPU, alternance main/vm, 3 répétitions) : pas ×3,7 (legacy-s0) et ×5,2 (campaign-w10) plus lent en bac à sable ; ground ×8,6 et ×14,0 ; même checksum. Confirme les ordres de grandeur (×5 et ×8 à ×9). Ajout tiré de cette contre-vérification : sous forte charge, même performance.now en lockstep est inutilisable (pas moyen 1,5 à 22 ms au lieu de 0,2) ; le banc à verser sous tools/ doit mesurer en temps CPU (process.cpuUsage par pas), rejeter le premier passage (JIT) et publier des compteurs indépendants de la charge (segmentFree, nœuds A*, révisions, octets). Le chargeur main-realm et le lockstep à empreinte sont génériques : à mettre dans FERRO (tools/), chaque jeu fournissant son pilote.

### SIM-12 — Pointes restantes : route en début de vague (10 à 16 ms après correctifs), amplifiée par les sous-pas
- sévérité haute · catégorie saccade · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:1402-1420; src/simulation.js:1742; src/simulation.js:86; src/game.js:677; src/game.js:690-692

**Preuve.** spike-fast.mjs : toutes les pointes > 8 ms viennent de route (1402). Au pas 620 (waveStart, legacy-s0) : 19,7 ms, et 27,9 à 41,7 ms dans les A/B sous charge. Au pas 1440 (legacy-s2) : 14,0 ms. Après full-v2 : 27,9→10,4 et 41,7→15,7 ms au pas 620, 21,6→8,9 ms au pas 1440. Le max par scénario reste à 10,1, 5,5, 3,8 et 8,3 ms, avec 0 à 8 pas > 4 ms par 30 s. 'routeBudget=advanced?2:Infinity' (1742), et advanced vaut vrai dès world.generation≥5 (86) : 2 recherches A* par pas, avec jusqu'à environ 4 700 segmentFree par pas sur un cache d'arêtes froid (1420). Côté boucle, src/game.js:677 plafonne dt à 0,12 s et 690-692 enchaîne jusqu'à ceil(dt*60)=8 sous-pas par image : une image lente se paie en plusieurs pas.

**Cause.** Le budget limite le nombre de recherches par pas, pas leur coût. Le cache d'arêtes de la zone est vide quand la vague démarre.

**Proposition.** Pour l'axe IA, au choix ou en combinaison :
- borner le travail par pas en nœuds développés ou en arêtes testées, par exemple 400 arêtes, avec un A* incrémental repris au pas suivant ;
- préremplir edgeKnown et edgeOpen autour du déclencheur de rencontre pendant les pas calmes, le trigger étant connu d'avance.
SIM-09 et SIM-04 baissent déjà le coût de chaque arête. Côté boucle, à décider avec l'axe latence : un budget de temps par image, par exemple ne pas dépasser 4 sous-pas quand dt est plafonné.

**Gain attendu.** Estimé : pointes de début de vague sous 4 ms sur bureau. Sur mobile, avec un facteur estimé de 3 à 5, de 30 à 80 ms vers moins de 15 ms.

**Risques.** Un A* incrémental change le moment où les ennemis reçoivent leur chemin : ce n'est pas bit à bit et le comportement change. Les tests d'IA (brain, natural-spawn, campaign-simulation, boss-progression) doivent passer. La décision revient à l'axe IA. Plafonner les sous-pas ralentit le temps de jeu sur les appareils lents.

**Vérifier par.** node spike-fast.mjs ; BASE=full-v2.mjs:fullPatch REPS=2 node ab2.mjs <module IA> <export> (max et nombre de pas > 4 ms)

**Contre-vérification.** Code relu : 1402-1420, 1742 (routeBudget=2), 86, game.js:677 (dt ≤ 0,12) et 690-692 (ceil(0,12×60)=8 sous-pas) exacts. Compteurs indépendants (probe.mjs, pilote du premier tour) : les pas les plus coûteux sont bien des recherches plafonnées à cache froid : pas 620 waveStart (4 245 à 4 348 segmentFree, 2 355 à 2 391 nœuds), pas 1440 de legacy-s2 (4 422 / 2 401), pas 682-684 (4 620 à 4 703 segmentFree, deux recherches plafonnées dans le même pas). route pèse 6 à 15 % du CPU total mais domine les 3 à 5 pires pas de chaque scénario. PRÉCISION : la même recherche vouée à l'échec est rejouée à l'identique (legacy-s2 : pas 1440, 1644, 1664 avec exactement 4 422 segmentFree et 2 401 nœuds ; pas 1607 et 1706 à cache chaud) : il manque une mémoire des échecs, voir SIM-V2, exacte et bien moins risquée qu'un A* incrémental. Les valeurs absolues (10 à 16 ms après correctifs) ne sont pas revérifiables sous cette charge. Le plafonnement des sous-pas change la vitesse du jeu sur machine lente : à trancher avec l'axe LOOP, pas ici. Qualité : un budget par nœuds change l'instant où un chemin arrive (non bit à bit) ; le préremplissage du cache et la mémoire des échecs sont exacts.

**Gain corrigé.** Pointes de début de vague et de replanification : de ~4 400 à quelques dizaines de segmentFree par recherche plafonnée avec cache chaud ou mémoire des échecs (facteur ~15 mesuré en CPU).

### SIM-13 — Croissance des tableaux : aucune fuite, seul s.loot grossit et il reste borné
- sévérité basse · catégorie mémoire · effort S · gain qualitatif
- contre-vérification : **confirmé**, priorité P3 · qualité sans objet · jeu
- lieux : src/game.js:236; src/simulation.js:2211; src/simulation.js:876-893

**Preuve.** src/game.js:236 vide sim.state.events (length=0) après chaque sous-pas, et restore remet s.events=[] (src/simulation.js:2211). Les autres tableaux sont plafonnés : particules 180, explosions 24, projectiles 48, débris 128 + 64 (MAX_RUBBLE et MAX_CHIPS, appendDebris 876-893). s.loot reçoit une entrée par ennemi tué et garde les entrées ramassées, donc reste borné par le nombre d'identités (170 au plus). Sans game.js (tests, bancs), s.events grossit sans fin : les tests s'appuient dessus (helper events() de simulation.test.mjs), et les bancs le vident à la main comme game.js:236.

**Cause.** Aucune : le cycle de vie de s.events relève de l'hôte, c'est voulu.

**Proposition.** Rien d'urgent. Option : compacter s.loot quand une entrée est prise, ou la retirer au checkpoint. Documenter dans CONTRACT.md que l'hôte doit vider s.events à chaque pas.

**Gain attendu.** Qualitatif : aucun gain de performance attendu, l'absence de fuite est confirmée.

**Risques.** Compacter s.loot change le contenu des snapshots : à vérifier avec checkpoint.test.mjs.

**Vérifier par.** Boucle de 10 000 pas qui relève les longueurs de s.loot, s.debris, s.particles et s.projectiles en vidant s.events comme game.js:236 (même boucle que alloc-steps.mjs)

**Contre-vérification.** Code relu : game.js:236 vide bien les événements ; s.loot n'a qu'un push (ligne 641) gardé par un test d'unicité par ennemi (636), donc borné par le nombre d'identités. Mesure indépendante sur 4 scénarios × 1800 pas : débris 54 à 135 au plus (plafond 192), particules 28, explosions 1, projectiles 0, loot 0 (aucun kill dans ce pilote : la borne de s.loot n'est prouvée que par lecture). Aucune action nécessaire ; documenter dans CONTRACT.md que l'hôte vide s.events.

## Constats ajoutés par le contre-vérificateur

### SIM-V1 — Le cache d'arêtes de navigation dépend des boîtes de pièges mobiles : arêtes périmées, aggravées par l'invalidation locale de SIM-01
- sévérité moyenne · catégorie ia · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/simulation.js:242; src/simulation.js:1350; src/simulation.js:1371; src/simulation.js:1380; src/simulation.js:1420; src/simulation.js:1840-1862; src/simulation.js:201-203

**Preuve.** src/simulation.js:1420 met en cache segmentFree(...,.4) dans edgeKnown/edgeOpen ; segmentFree (1350, 1371) appelle blocked() dont le paramètre par défaut est traps=trapBoxes (242), tableau vidé et rempli à chaque pas avec la pose courante des lames et presses (1840, 1862, trapShape 1810-1815). pumpNav, lui, passe explicitement [] pour les pièges (1380) : cellules et arêtes ne suivent pas la même règle. Mesuré avec stale.mjs (toutes les 30 étapes, chaque arête en cache est comparée à un recalcul) : dans l'original, jusqu'à 19 arêtes « ouvertes » en cache qu'un recalcul donne fermées en campaign-w10 (moyenne 0,6 par contrôle) ; avec nav-local, moyenne 0,9 et maximum 19 en campaign-w10 ET en legacy-s2, où l'original est à 0 parce que ses vidages globaux (15 révisions par 30 s) masquent le défaut. Tous les mondes testés ont les trois pièges [blade, press, spikes]. Les portes en cours d'ouverture (minY qui monte en continu, 202, navDirty seulement à progress=1, 300) ont le même défaut ; non observé ici (doorOpen=0). Attribution aux pièges par élimination : ce sont les seules entrées dynamiques de segmentFree dans ces passages.

**Cause.** Une valeur mise en cache dépend d'un état qui bouge à chaque pas sans jamais invalider le cache ; seul le vidage global à chaque révision de destruction la corrige aujourd'hui, par accident.

**Proposition.** Avec SIM-01, au choix : (a) calculer les arêtes en cache sur le statique seul : segmentFreeStatic(ax,az,bx,bz) = segmentFree avec traps=[] aux trois appels de blocked, comme pumpNav le fait déjà pour les cellules, les pièges restant gérés par le déplacement et les dégâts ; ou (b) conserver la sémantique actuelle et appeler navMark(rectangle balayé du piège) quand t.hot change d'état (2 à 3 pièges, quelques dizaines d'arêtes). Même traitement pour une porte : navMark(doorBoxes[i]) dès que minY franchit sol+1,8, et pas seulement à progress=1. Critère d'acceptation : stale.mjs rend 0 arête périmée à chaque contrôle sur les 4 scénarios, pièges actifs.

**Gain attendu.** Aucun gain de temps ; supprime jusqu'à 19 arêtes fausses près des pièges (chemins planifiés à travers une lame ou une presse en position) et rend l'invalidation locale de SIM-01 correcte par construction.

**Risques.** Change le comportement des ennemis près des pièges : non bit à bit par rapport à 0.8.0 (les 14 passages de lockstep restent identiques aujourd'hui, donc l'effet est rare). Tests brain, natural-spawn et campaign-simulation à repasser. L'option (a) laisse des ennemis planifier à travers un piège actif : vérifier qu'ils ne restent pas bloqués (compteur stuck).

**Vérifier par.** cd bench/sim-verif2 ; SCEN=2 node stale.mjs ; SCEN=c9 node stale.mjs (attendu : stale = 0 pour la variante corrigée) ; lockstep ab.mjs contre l'original pour chiffrer les divergences.

### SIM-V2 — La même recherche A* vouée à l'échec est rejouée à l'identique après chaque révision : aucune mémoire des échecs
- sévérité haute · catégorie saccade · effort S · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · jeu
- lieux : src/simulation.js:1402-1426; src/simulation.js:1389; src/simulation.js:1742

**Preuve.** probe.mjs (compteurs par pas, code d'origine instrumenté en mémoire, pilote du premier tour) : en legacy-s2, les pas 1440, 1644 et 1664 exécutent chacun exactement 4 422 segmentFree et 2 401 nœuds (plafond explored++<2400, ligne 1414), et les pas 1607 et 1706 refont 2 401 nœuds avec 37 segmentFree ; en campaign-w16, les pas 1460 et 1728 donnent 4 388 / 2 401 deux fois ; en campaign-w10, les pas 682, 1064 et 1081 donnent 4 444 à 4 703 segmentFree pour ~4 600 nœuds (deux recherches plafonnées dans le même pas). Coût CPU sur cette machine lente : 21 à 47 ms à cache froid, 1,5 à 1,8 ms à cache chaud. La ligne 1389 remet path=[] et planWait=0 pour tous les ennemis à chaque révision, alors que 85 à 88 % des révisions ne changent aucun collider (7/8, 13/15, 11/13, 11/13) : la recherche impossible est relancée telle quelle.

**Cause.** route() ne retient pas qu'un couple (cellule de départ, cellule d'arrivée) est inatteignable tant que la carte n'a pas changé ; chaque échec explore 2 400 nœuds.

**Proposition.** 1) navEpoch, entier incrémenté seulement quand le diff de colliders de SIM-01 est non vide ou qu'une porte s'ouvre. 2) Table des échecs : Map dont la clé est start*nav.length+end (plus un bit pour r>.4), valeur navEpoch ; dans route, après nearestNode et après le décompte routeBudget--/routeSearches++ (inchangé, pour garder le même budget), retourner null si la clé porte l'époque courante ; l'inscrire quand la boucle se termine sans found. Table vidée quand navEpoch change, taille plafonnée à 4 096 entrées. 3) Ensuite seulement, pour l'axe IA : étiquettes de composantes connexes pour répondre en O(1). Exact à condition que les arêtes en cache ne dépendent que du statique (SIM-V1, option a) : le résultat d'une recherche ne dépend alors que de (start, end, r, carte).

**Gain attendu.** Estimé à partir des compteurs : les pas 1644, 1664, 1728 et équivalents passent de ~4 400 segmentFree et 2 401 nœuds à 0 ; les premières occurrences (waveStart) restent à traiter par SIM-12. Un à trois des cinq pires pas de chaque scénario disparaissent.

**Risques.** Déterminisme : identique si le décompte du budget est conservé et si SIM-V1 (a) est appliqué ; sinon une arête dépendante d'un piège peut rendre possible une recherche mémorisée comme impossible : à prouver par lockstep. Recoupe l'axe IA (plafond de 2 400 nœuds) : à coordonner pour ne pas l'implémenter deux fois. Aucune incidence sur les sauvegardes (table non sérialisée, vide après restore). +0,4 Ko.

**Vérifier par.** cd bench/sim-verif2 ; node probe.mjs (attendu : plus aucune répétition du couple 4 422 / 2 401 après la première) ; node ab.mjs <module> <export> avec SCEN=0,2,c9,c15 (identical=true, cpuMax en baisse).

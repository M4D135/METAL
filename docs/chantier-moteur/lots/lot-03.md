# Lot 03 — Destruction : un seul delta par révision
## But
Fournir un delta unique par révision de destruction (ajoutés, retirés, AABB sale, numéro) consommé par le rendu et la simulation. Remplacer les reconstructions complètes (index spatial, seaux, grille de navigation) par des mises à jour incrémentales ciblées. Éliminer les saccades de 8 à 12 ms sur l'image de révision.
## Tâches, dans l'ordre

### T1 — Identité stable des maillages + rebuild incrémental + interface delta [SIM-08, LOAD-10]
- Où : src/destruction.js:160-178 ; src/simulation.js:229-235 ; src/simulation.js:903-926 ; src/simulation.js:932
- Quoi : Dans `rebuild`, réutiliser les objets boîte des groupes inchangés (identité conservée) et ne reconstruire que les tranches modifiées (offsets `firstIndex`). Séparer la liste de rendu (produite à la demande) des collisionneurs. Dans `syncDestruction`, diff numérique (style SIM-01) : si vide, ne toucher ni seaux, ni nav, ni terrain. Exposer l'interface unique `{added, removed, dirtyAABB, revision}`.
- Preuve exigée : `node revision-cost.mjs` ; `node phases.mjs` (damageScenery et explode par impact) ; `WEAPON=2 SCEN=legacy-s2 REPS=2 node ab2.mjs <module> <export>` → `identical=true`.
- Qualité : identique.
- Garde-fous : le renderer dépend de l'ordre des meshes (commentaire destruction.js:169-170) — le tri par tranches doit le conserver. Les caches s'invalident sur la révision, non sur l'identité du tableau. Tests destruction, renderer-destruction, checkpoint obligatoires.
- Dépend de : rien.

### T2 — Grille dense par cellules (A3) pour l'index spatial [RCPU-05]
- Où : src/renderer.js:768-792 ; src/renderer.js:779-786 ; src/renderer.js:1545 ; src/renderer.js:1454 ; src/renderer.js:1436
- Quoi : Remplacer les clés chaîne `x+','+z` + `Map.get` par une grille dense par niveau (bornes AABB monde, cellules 8 m, `nx·nz`). Structure : `cellStart` Int32Array(nx·nz+1), `items` Int32Array, coordonnées `px,py,pz,rad` en Float64Array, `entries[]` pour l'identité. `query` teste d² ≤ (range+rad)² sur tableaux séparés, écrit dans un buffer réutilisé. Pour l'intégration RCPU-02 : listes par cellule (variante A3), pas CSR pleine (coût 1,6 ms vs 1,2 ms).
- Preuve exigée : `node bancs/rcpu/alt.mjs <ferro> camp:17 1500` (A0, A1, A3 + ligne `identical order: true`) ; `node bancs/rcpu/ab.mjs <ferro> 3000 camp:6 auto grid`.
- Qualité : identique (image identique au bit près en Chrome).
- Garde-fous : ordre de sortie = ordre d'insertion par cellule (contrôlé, conditionne le dessin des coplanaires). Entrées hors bornes → cellules de bord. Reconstruction coûte 1,6 ms : à coupler avec T3. Mémoire : quelques dizaines de Ko/niveau.
- Dépend de : T1 (identité stable des maillages).

### T3 — updateWorld incrémental par cellules touchées [RCPU-02]
- Où : src/renderer.js:1373-1382 ; src/renderer.js:768-792 ; src/renderer.js:961-973 ; src/game.js:152-156 ; src/destruction.js:160-178
- Quoi : (1) Diff par identité avec génération : marquer `e.gen=g`, non-marquées = retirées. (2) Reconstruire uniquement les cellules des entrées ajoutées/retirées/déplacées, tri par index de mesh dans la cellule. (3) N'invalider que les sélections en cache (RCPU-01) et les `lampCasters` dont la AABB touche une cellule changée (rayon lampes 32 m) — livrer avec RCPU-01. (4) Canvas2D : n'invalider `e.software` que pour les meshes à portée des lumières touchées. (5) Écarter l'étalement sur 2 images (interdit par le test « aucun mur détruit référencé par une vue d'ombre »). Prévoir 4 cellules de marge ou repli global si un morceau tombe hors bornes.
- Preuve exigée : `node bancs/rcpu/destr.mjs <ferro> 3000 camp:17` et `camp:6` (temps + `identical query results+order: true`) ; `npm test`.
- Qualité : identique.
- Garde-fous : ordre interne d'une cellule conservé (z-fighting coplanaires). Ajouter un test « requête incrémentale identique à la reconstruction ». Le vidage des 4 caches ne coûte rien aujourd'hui (3/4 listes déjà repaquées sur 85-99 % des images) ; l'invalidation ciblée (point 3) ne devient rentable qu'après RCPU-01.
- Dépend de : T1, T2.

### T4 — Invalidation navigation ciblée sur l'AABB sale [BOSS-08, LOOP-04]
- Où : src/simulation.js:229-235 ; src/simulation.js:316 ; src/simulation.js:1379-1390 ; src/world.js:1226-1228 ; src/world.js:1364
- Quoi : (1) Dans `syncDestruction`, consommer le delta de T1. Si aucun collider solide n'a changé (casse décorative, 4/6 à 5/6 des révisions), ne pas toucher à la navigation. (2) Sinon, remettre en file uniquement les cellules de `dirtyAABB` élargie de 1 m (rayon plus gros agent), effacer `edgeKnown`/`edgeOpen` que sur ces cellules + voisines, ne réinitialiser `planWait` qu'aux ennemis dont le chemin traverse la zone. (3) Repli global si la boîte dépasse 25 % de la grille. (4) Réécrire une seule fois `checks/simulation.test.mjs:1862-1872`.
- Preuve exigée : `PATCHED=1 node bancs/fight.mjs $PWD 2 60 skilled 1` → `edgeWipes=0`, < 40 pas pumpNav/min. Nouveau test d'équivalence : après N explosions, nav ciblée = recalcul complet. Suite `checks/` (destruction, navigation).
- Qualité : visuellement identique. **Attention** : l'empreinte des ennemis diverge (chemins non remis à zéro) ; déterministe mais les tests à trace figée sont à rejouer.
- Garde-fous : un mur porteur qui tombe doit être capté (rejouer tests destruction/navigation). Ordre de pompe modifié mais déterministe. Vérifier qu'une restauration force une reconstruction complète (nav non sauvegardée).
- Dépend de : T1 (interface delta).

### T5 — Vérification du pas de première casse [BOSS-V3]
- Où : src/simulation.js:229-235 ; src/simulation.js:932-950 ; src/simulation.js:1028-1064 ; src/simulation.js:316
- Quoi : (1) Confirmer que SIM-01 + SIM-03 (lot voisin) réduisent ce pas de 34 à 40 %. (2) Déplacer `refreshNav` au pas suivant la révision (la nav est déjà pompée par tranches). (3) Profiler le pas précis avec `PROFILE_STEP=<n>` pour attribuer le reste (damage hors rebuild, updateDebris des 48 morceaux nés). Critère : pas de casse < 8 ms CPU dans le domaine principal sur les 3 espèces.
- Preuve exigée : `GOD=1 BOUNDED=1 node bancs/boss-verif2/vfight.mjs <racine> {0,1,2} 60 skilled 0` → ligne CPU à t≈10,97 ; comparer aux variantes `SLEEP=1` et `SOLIDONLY=1`.
- Qualité : identique.
- Garde-fous : ne PAS différer `rebuildCollision` (projectile traverserait un mur détruit). Décaler `refreshNav` d'un pas change l'ordre de mise à jour : déterministe, mais tests de destruction et navigation à rejouer.
- Dépend de : T1, T4.

## Options désactivées par défaut
- Aucune. Aucun constat du lot n'a la qualité « dégradée ».

## Écartés ou absorbés
- [LOAD-09] — Absorbé par T2 + T3 (arbitrage 3 : même code renderer.js:1373-1382, mêmes clés chaîne, mêmes caches vidés ; RCPU-02/RCPU-05 couvrent l'intégralité).
- [LOAD-10] — Absorbé par T1 (rebuild incrémental = SIM-08 point 1). `rebuildCollision` négligeable (445 colliders, 0,12-0,21 ms, contre-vérification LOAD-10) ; `compile` par groupe modifié déjà implémenté (cache destruction.js:164).
- [LOOP-04 — partie rendu] — Absorbé par T2 + T3 (arbitrage 3 : abandon du découpage en lots statiques 8×8 m, incompatible avec les sélections en cache RCPU-01).
- [LOOP-04 — point 4 débris] — Absorbé par SIM-03 point 3 (arbitrage 2 : réutilisation de `debrisBoxes` déjà couverte).

## Décisions à confirmer par David
- T4 : l'invalidation navigation ciblée fait diverger l'empreinte des ennemis (chemins non remis à zéro). Accepte-t-on une nouvelle référence d'empreinte pour les tests à trace figée ? — Valeur par défaut : oui, rejouer les traces et figer la nouvelle empreinte.
- T3 : le vidage des 4 caches statiques ne coûte rien tant que RCPU-01 n'est pas livré. Livrer l'invalidation ciblée (point 3) en même temps que RCPU-01 (lot voisin) ou en stub inactif ici ? — Valeur par défaut : stub inactif, activation conditionnée à RCPU-01.
- T5 : décaler `refreshNav` d'un pas après la révision est-il acceptable (un ennemi garde son ancien chemin une image de plus) ? — Valeur par défaut : oui, sous réserve que le test d'équivalence T4 passe.

## Gains attendus du lot
Image de révision : de 8-12 ms (M5 calme, domaine principal) à 1,5-3 ms estimé. `updateWorld` p50 : 2,5 → 0,6-0,75 ms (×3, rapport reproduit sous charge). Requête spatiale : −60 à −72 % ; `draw()` CPU : −15 à −27 %. pumpNav en combat de boss : 263→114 et 201→57 pas/min (−57 à −72 %), CPU moyen par pas −25 à −31 %. `damageScenery` par impact : de 1,6-2,3 ms à quelques dizaines de µs quand 85-88 % des révisions ne changent aucun collider. Gains non additifs : le delta unique (T1) est le multiplicateur qui rend les gains T2-T4 atteignables ensemble.

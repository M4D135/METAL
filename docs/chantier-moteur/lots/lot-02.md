# Lot 02 — Simulation : mêmes résultats, moins de calcul
## But
Réduire le temps CPU de simulation de 40 à 60 % en éliminant les invalidations globales, les revalidations inutiles et les allocations mégamorphes. Image, son et jeu identiques ou meilleurs, prouvés par empreinte d'état à pas fixe. Une seule révision de format de sauvegarde, en fin de lot.

## Tâches, dans l'ordre

### T1 — Invalidation locale de la navigation + cache d'arêtes [SIM-01, SIM-V1]
- Où : src/simulation.js:229-235, :300, :316, :912, :1379-1391, :1420, :1840-1862, :201-203
- Quoi : Dans syncDestruction, diff de multiensembles (hash FNV sur Uint32 des 6 Float64, puis égalité champ par champ, 77 µs). Boîtes ajoutées/retirées → navRects. refreshNav met en file les cellules à ≤ 0,4 m + 1e-6 d'un rectangle ; efface edgeKnown/edgeOpen à ≤ 1,2 m + 1e-6. Diff vide : rien en file. Garder la réinitialisation des chemins (1389). SIM-V1 : calculer les arêtes en cache sur le statique seul (segmentFree avec traps=[] aux trois appels de blocked, comme pumpNav le fait en 1380) ; navMark(doorBoxes[i]) dès que minY franchit sol+1,8.
- Preuve exigée : `REPS=2 node ab2.mjs nav-local.mjs navLocalPatch` → identical=true, ratio < 0,8. `node nav-refresh.mjs` → 0 cellule modifiée hors rectangle. `SCEN=2 node stale.mjs` → stale = 0. Grille et arêtes égales à un recalcul complet au repos.
- Qualité : meilleure (nav à jour plus tôt, pas d'arêtes périmées près des pièges).
- Garde-fous : test obligatoire pour l'ouverture de porte par progression (ligne 300, doorOpen=0 non couvert). Réécrire checks/simulation.test.mjs:1862-1872 (navPending>0 → navUpdates ≤ 768 + carte correcte après restore). Repli global au-delà de 25 % de la grille (BOSS-08). Taille +1,9 Ko.
- Dépend de : rien.

### T2 — ground() : SoA + sous-grille 2 m [SIM-02]
- Où : src/simulation.js:122-137, :153, :992-994
- Quoi : Float64Array gFX, gFZ, gHW, gHD, gFY, gSX, gSZ + Uint8Array gFK (0 plat, 1 rampe, 2 substrat). Sous-grille CSR 2 m (gStart, gCells) alignée sur les seaux de 8 m. gTop[c] = hauteur d'un sol plat couvrant la case (marge 1e-6), sortie immédiate. groundScan(x,z,from,to) garde l'arithmétique et la priorité d'origine. Cache de la liste pièges kind==='floor' (absente des mondes actuels). floorBuckets conservé pour fallbackLanding (138) et beneathTerrain (145).
- Preuve exigée : `node ground-equiv.mjs 2` → 0 écart (Object.is) sur ~21 M points. Lockstep : état identique. A/B : −14 à −29 % CPU simulation (ratio médian 0,72 à 0,80).
- Qualité : identique.
- Garde-fous : hypothèse sols figés après create (vrai 0.8.0) ; reconstruire les tableaux si terrainDirty posé. Aucun effet snapshot. Mémoire quelques Ko. Gains non cumulables avec SIM-01/03 (moins d'appels ground une fois T1/T3 faits).
- Dépend de : rien (mais gains réduits après T1 et T3).

### T3 — Sommeil des débris indexé sur la révision [SIM-03, LOAD-05]
- Où : src/simulation.js:68-83, :992-1005, :1028-1065
- Quoi : WeakMap debrisSleep : pièce au repos + support statique seul (debrisStaticSupport) → continue tant que seenDestructionRevision inchangé. Réveil : delete(q). Désactivée si pièges kind==='floor'. Drapeau dynamicSupport par morceau (zones fixes XZ, pas un compteur global incluant les pièges mobiles). debrisFloor : mémo 2 entrées, NaN en début de updateDebris. debrisBoxes : boîtes dynamiques filtrées + miroir CSR avec estampilles, sans Set/Array.from. Feuillage : 38 points uniques, max en boucle. LOAD-05 points 3-4 intégrés (tableau réutilisé, un seul parcours de sol).
- Preuve exigée : Lockstep avec empreinte (rotation, repos, âge) : état identique. `REPS=2 node ab2.mjs debris-v2.mjs debrisPatch`. legacy-s2 roquettes : −32 à −34 % ; campaign-w10 : −5 à −11 %.
- Qualité : identique.
- Garde-fous : tout futur support mobile capable de retirer un support doit réveiller les pièces (à écrire en commentaire). Snapshot inchangé (WeakMap vide après restore). 301/301 tests.
- Dépend de : T1 (moins d'appels ground).

### T4 — Point de reprise : écriture différée [LOAD-03]
- Où : src/game.js:94-103, :193-237 ; src/simulation.js:1941-1944
- Quoi : snapshot() reste synchrone dans la frame (nécessaire pour l'identité vivante/restaurée). stringify + setItem dans requestIdleCallback ou setTimeout(0), fusion des événements d'une même frame en une écriture. Secours synchrone sur pagehide/visibilitychange. Ajouter l'échéance du report « en l'air » de src/game.js:96 (nécessaire dès que le saut existe, lacune SAUT).
- Preuve exigée : `save-after-blast.mjs` : 33-35 ms → 2,0-2,8 ms (avec T1). Chrome file:// Performance : pas de tâche longue > 5 ms à la prise d'un noyau post-explosion.
- Qualité : identique.
- Garde-fous : perte du dernier point couverte par pagehide. Étendre checks/checkpoint.test.mjs (écriture différée, fusion). Ne pas différer l'instantané (arbitrage).
- Dépend de : T1 (file nav réduite).

### T5 — Génération du monde : grille spatiale au lieu de tri [LOAD-06]
- Où : src/world.js:1340-1389, :1373, :1419-1446, :1447-1470
- Quoi : Grille 2D de 4 m (clé x*65536+z) des groupes. nearest en minimum linéaire. choose : grille de base par pièce, masque = base.slice() + effacement en fenêtre. nearest(p,mask) limité ±0,6 m. covers déroulé. maskFor avec bornes hors boucle.
- Preuve exigée : `gen-identity.mjs` → 46/46 mondes identiques octet pour octet (FNV JSON). `gen-ab.mjs` → −34 à −50 % (−70 à −100 ms par monde). `node checks/world.test.mjs` PASS.
- Qualité : identique.
- Garde-fous : test de digest sur 8 × 18 graines avant fusion (empreinte sauvegardes). Préalable : corriger les 8/46 échecs de checks/campaign-world.test.mjs sur main. Taille +1,5 Ko.
- Dépend de : rien.

### T6 — blocked() + segmentFree : miroir CSR, pas d'allocation [SIM-04, SIM-09]
- Où : src/simulation.js:214-227, :242-251, :1349-1377, :1420
- Quoi : Miroir CSR paresseux (mirrorStart, mirrorIdx, mirrorBox Float64Array 6 doubles) recalculé à changement d'identité de solids, partagé avec débris et rayons. blockedList(list,x,z,rr,top,bottom) sans tableau littéral. Appelants passent le sol connu (segmentFree, pumpNav). segmentFree : ga=ground(ax,az) passé à blocked ; dérouler le test de dalles sur deux axes, aucun tableau littéral ; 4 scalaires depuis route au lieu des spreads coord.
- Preuve exigée : `REPS=2 node ab2.mjs blocked-v2.mjs blockedPatch` → identique. `REPS=2 node ab2.mjs blocked-v2.mjs segmentPatch` → identique. Gain résiduel après T1 : −3 à −8 % médiane par pas.
- Qualité : identique.
- Garde-fous : garde par identité du tableau (syncDestruction 231, restore). Résultat booléen indépendant de l'ordre. Taille +1,5 Ko.
- Dépend de : T1.

### T7 — Boucles ennemies : précalcul, clés numériques, saut hypot [SIM-06]
- Où : src/simulation.js:675-678, :684-688, :724-737, :1279-1290, :1742, :1763, :1803-1805
- Quoi : encounterIds précalculé à côté d'encounterMap (182). Comptage sans tableau, aiStats champ par champ. Tri par indices sur clés précalculées (comparateur pur, même ordre). Clés voisinage numériques (Math.floor(x/8)+32768)*65536+(Math.floor(z/8)+32768). starts en Float64Array réutilisé. 6 minuteries décrémentées explicitement. moveSpeed : dx===0&&dz===0 → 0, sinon hypot/dt.
- Preuve exigée : `BASE=all-v2.mjs:allPatch REPS=2 node ab2.mjs identity-v2.mjs identityPatch` → identique, ratio médian 0,83-0,86. `node movespeed-zero.mjs`.
- Qualité : identique.
- Garde-fous : hypothèse enemyIds statiques après create (vrai 0.8.0). Clés valides |x|,|z| < 262 km. 301/301 tests.
- Dépend de : T1 à T6.

### T8 — Rayons : DDA sur les seaux de 8 m [SIM-07]
- Où : src/simulation.js:474-511, :956-979, :1921-1931
- Quoi : DDA Amanatides-Woo sur les seaux existants, garde 4096 itérations. Estampilles (chaque boîte testée une fois). Arrêt dès que l'entrée de la case suivante dépasse le meilleur impact. castProjectile : collecter boîtes des cases traversées, trier indices, tester dans l'ordre d'origine (départage des normales). Dérouler la boucle des sols. Repli balayage complet si origine hors grille ou d non fini.
- Preuve exigée : `node ray-equiv.mjs` → 0 écart sur 240 000 rayons. `WEAPON=2 SCEN=legacy-s2 REPS=2 node ab2.mjs ray-v2.mjs rayPatch` → identique, −7 à −12 % en combat roquettes.
- Qualité : identique.
- Garde-fous : assertion à la création (tous les colliders dans world.bounds). Boîte > seau insérée dans tous les seaux touchés. Taille +3,6 Ko.
- Dépend de : T1 à T3.

### T9 — Fabriques à forme fixe ; morceaux coincés reportés au lot 12 [SIM-05, LOAD-05 (pt 2)]
- Où : src/simulation.js:126-137, :242-251, :260-271, :514, :1361, :1420, :1742 ; src/destruction.js:174-176 ; src/simulation.js:1028-1065 (wedged)
- Quoi : Fabriques à forme fixe (sol, ennemi, boîte collision) créant toutes les propriétés dans le même ordre, valeurs numériques initialisées en double. S'applique aux copies de la simulation, jamais aux objets du monde (protection fingerprint lignes 237-241). coord(i) → coordX(i), coordZ(i). Supprimer tableaux littéraux par appel. LOAD-05 point 2 : morceau coincé (|v|<0,25 m/s pendant 1 s ou >6 s éveillé) → resting + wedged=true ; validateur (2080) accepte sans appui ; rubbleVersion 2 lisant la v1. Migration atomique dans restore. **Le changement de format (rubbleVersion 2, morceaux coincés) ne se fait pas ici : il part dans la révision unique du lot 12. Dans ce lot, ne livre que les fabriques, qui ne changent pas le format.**
- Preuve exigée : `node gc-harness.mjs alloc-steps.mjs full-v2.mjs fullPatch` → 148-239 Ko/pas (−72 à −73 %). Un seul lot de tests dans checks/checkpoint.test.mjs couvrant v1→v2, wedged, fabriques.
- Qualité : identique (fabriques) ; visuellement identique à démontrer (wedged).
- Garde-fous : ordre des clés JSON change → empreintes octets de snapshot changent (inoffensif pour restore, à ne pas faire sur les objets du monde). Ne pas modifier l'ordre des tirages aléatoires de world.js. Une seule révision, en fin de lot.
- Dépend de : T1 à T8 (tout le code chaud est stabilisé).

### T10 — Passes ennemies : sélection sans allocation, voisinage réutilisé [RESTE-04]
- Où : src/simulation.js:724-737, :675-678, :746-750, :1279-1281, :1802, :1804, :1938, :367
- Quoi : if(s.jumpPads.length) devant checkPad. moveSpeed : dx===0&&dz===0 → 0. dangerCount, activeMechanisms, bossAliveNow sans filter().length/some(). rebuildNeighbors : vider et réutiliser les listes de la Map. Sélection rencontres : tableau persistant, clés Float64Array, tri insertion (clé,id), drapeaux Uint8Array, compteur Int32Array.
- Preuve exigée : `STEPS=900 REPS=2 node ab.mjs r1 r1+simloops:simLoops` → identical=true, ratio < 0,95 sur campaign-w10 et camp2-w6. −7 à −9 % du pas.
- Qualité : identique.
- Garde-fous : tri insertion = Array.sort si comparateur ordre total (ids uniques, clés finies, repli NaN). Rejeu 3600 pas sur 18 mondes avant fusion. Format sauvegardes inchangé.
- Dépend de : T7.

### T11 — debrisHalf scalaire exact [RESTE-05]
- Où : src/simulation.js:68-83, :1028-1065, :1046, :1064
- Quoi : Lire r[0],r[1],r[2] directement. debrisExtent(shape,v0,v1,v2) avec les mêmes formules et le même ordre d'addition, sans tableau ni closure. Étapes suivantes (non prototypées) : wrap/flat au niveau module ; deux tableaux de 3 valeurs alternés par pièce pour la rotation (préserver test d'identité du cache et snapshot) ; filter de 1064 seulement si pièce expirée ou hors bornes.
- Preuve exigée : `WEAPON=3 STEPS=900 REPS=2 node ab.mjs r1 r1+debrisfast:debrisFast` → identical=true, ratio < 0,95. −6 à −10 % du pas en combat roquettes.
- Qualité : identique.
- Garde-fous : wrap=atan2(sin,cos) ne pas remplacer par modulo (change les bits). Cache d'étendue compare rotation par identité : toute réutilisation de tableau doit préserver snapshot/restore.
- Dépend de : T3.

### T12 — Destruction : suppression de la double compilation [RESTE-06]
- Où : src/destruction.js:160-178, :228-262 ; src/simulation.js:1106, :229-235
- Quoi : (a) Dans damage, poser g.cacheRecord=record, g.cacheCount, g.cacheRemoved et rafraîchir renderSlots avec le built déjà calculé ; rebuild ne recompile plus ce groupe. (b) Sortie incrémentale : garder par maillage d'origine son segment (début, longueur) ; à une révision, réécrire seulement le suffixe à partir du premier maillage modifié ; réutiliser les objets colliders du préfixe. (c) Coupler avec T1 pour que rebuildCollision et updateWorld ne traitent que le suffixe.
- Preuve exigée : hash JSON de destruction.meshes et destruction.colliders identique après chaque révision d'un rejeu. phases.mjs : phase tir < 25 µs/pas (de 71). −15 à −20 % du pas moyen en tir soutenu.
- Qualité : identique.
- Garde-fous : compile doit être pure de (groupe, enregistrement) (à vérifier). Conserver la sémantique de nouvel objet tableau à chaque révision (navDiff de T1 compare ancien/nouveau). Ordre des maillages et indices mesh préservés (rendu, raycast).
- Dépend de : T1.



### T15 — Sources périodiques : cadence, GC, HUD [STAB-10]
- Où : src/game.js:94-103, :699-703, :713, :587-674
- Quoi : (1) HUD : reporter le tic d'une image si travail déjà fait > moitié du budget (donnée FLoop/FTrace) ; jamais dans une image avec révision ou point de reprise. (2) Point de reprise : sérialisation et écriture par l'ordonnanceur (T4). (3) Travail non visuel cadencé par le temps : soundscape.sample et réglages audio à 30 Hz au plus (complète LOOP-14). (4) Objectif : ≤ 30 scavenges/min à 60 Hz, ≤ 60 à 144 Hz ; part d'images longues avec collecte ramenée à la part générale.
- Preuve exigée : Banc STAB-01 : gc.perMinute, gc.medianExcessMs, part images longues avec collecte. census.mjs à 144 Hz avant/après.
- Qualité : identique.
- Garde-fous : son d'ambiance ≤ 33 ms de retard (inaudible pour niveaux continus). Événements ponctuels immédiats. Durées de collecte en temps mur : seuls les comptes CPU sont fiables.
- Dépend de : T9 (réductions d'allocation).

### T16 — Math.hypot : saut du déplacement nul [SIM-10]
- Où : src/simulation.js:1804, :1033, :1060, :370, :599, :1368
- Quoi : Pas de remplacement global (35-40 % des résultats diffèrent de sqrt, jusqu'à 3 ulp). Réécritures exactes : en 1804, sauter hypot si dx===0&&dz===0 (+0 identique) ; devant les seuils à 2 arguments, rejeter par Math.abs(dx)>r||Math.abs(dz)>r (propriété V8/fdlibm, pas la spécification). 1033 et 1060 n'opèrent plus que sur les pièces éveillées (T3). Ne pas toucher aux 40 appels de world.js.
- Preuve exigée : `node hypot.mjs` → hypot(±0,±0)=+0 vérifié. `REPS=2 node ab2.mjs <module> <export>` → identical=true. Gain ≈ 2-3 % du pas, essentiellement via le saut 1804 (déjà couvert par T7).
- Qualité : identique.
- Garde-fous : ne pas remplacer globalement (casse reproductibilité et sauvegardes). Gain minime, à ne faire que pour 1804.
- Dépend de : T7 (le saut est déjà intégré dans identity-v2).

### T17 — Croissance des tableaux : documentation [SIM-13]
- Où : src/game.js:236 ; src/simulation.js:2211, :876-893
- Quoi : Aucune fuite confirmée (s.events vidé par game.js:236, s.loot borné par le nombre d'identités ≤ 170, débris ≤ 192, particules ≤ 180, projectiles ≤ 48). Documenter dans CONTRACT.md que l'hôte doit vider s.events à chaque pas. Option future : compacter s.loot au checkpoint (change le contenu des snapshots, à vérifier avec checkpoint.test.mjs).
- Preuve exigée : Boucle de 10 000 pas relevant les longueurs (s.loot, s.debris, s.particles, s.projectiles) en vidant s.events comme game.js:236.
- Qualité : sans objet (aucune action de performance).
- Garde-fous : compacter s.loot change les snapshots → vérifier checkpoint.test.mjs.
- Dépend de : rien.

## Options désactivées par défaut
- Aucun constat de ce lot n'a la qualité « dégradée ». LOAD-05 point 2 (morceaux coincés wedged) est intégré à T9 avec la mention « visuellement identique à démontrer » ; s'il échoue à la démonstration, il basculera ici.

## Écartés ou absorbés
- [RESTE-10] — Réfuté par la contre-vérification : ce n'est pas une dérive (le butin est borné, l'écart vient du trajet du pilote et des débris au plafond). Tâche supprimée. Le critère d'endurance est repris par le lot 13.
- [STAB-02] — Réfuté par la contre-vérification : la « dérive après 50 s » est un artefact du banc (passage à 2 sous-pas). Tâche supprimée ; la vraie cause est traitée par STAB-V1 (lot 01) et STAB-06 (lot 07).
- [BOSS-09] — Abandonné par arbitrage : doublon de SIM-03 (sommeil gravats). La variante par seuil de vitesse + tourniquet 1/8 modifie le comportement ; SIM-03 est exact et prouvé identique.
- [LOAD-12] — Aucun gain démontré. Traces de désoptimisation prises en contexte vm, non transposables à Chrome. La « route factice » est remplacée par la suppression de la recherche à froid (T1). À ne pas inscrire sans nouvelle mesure dans Chrome.
- [LOAD-14] — Gain négligeable (0,5 ms sur stringify pour 143-168 K caractères). La compaction change le format pour un bénéfice inférieur au risque. Rien à faire.
- [LOAD-11] — Absorbé dans T9 (SIM-05) : les sites d'allocation (coord, tas A*, Set debrisBoxes, tableaux littéraux) sont traités par les fabriques, les miroirs CSR et la suppression des tableaux par appel. Référence croisée : 534-864 Ko/pas (domaine principal).
- [LOOP-15] — Absorbé dans T9 (SIM-05) : doublon des constats d'allocation des axes SIM et RCPU. Le tas A* typé et le voisinage sans tableau sont couverts par les miroirs CSR (T6) et les fabriques (T9).

## Décisions à confirmer par David
- T1 : le test simulation.test.mjs:1862-1872 (navPending>0) doit être réécrit (navUpdates ≤ 768 + carte correcte après restore). AGENTS.md impose de passer les vérifications. **Valeur par défaut : réécrire, accord implicite.**
- T1 : SIM-01 est « meilleure » (nav à jour plus tôt) et non strictement « identique » (grilles diffèrent 9-139 pas sur 1800, jusqu'à 19 arêtes périmées corrigées par SIM-V1). **Valeur par défaut : accepter « meilleure », critère = grille et arêtes égales à un recalcul complet au repos.**
- T9 : la fabrique à forme fixe change l'ordre des clés JSON des snapshots (fingerprint lignes 237-241 sérialise world.enemies et world.walkable). **Valeur par défaut : appliquer aux copies de la simulation uniquement, jamais aux objets du monde.**
- T1 : l'ouverture de porte par progression (ligne 300) n'est couverte par aucun banc (doorOpen=0). **Valeur par défaut : test obligatoire avant fusion, valeur par défaut du test = comparer la grille locale à un recalcul complet après ouverture.**

## Gains attendus du lot
Temps CPU de simulation : −40 à −60 % en combat destructeur (roquettes, boss), −20 à −35 % en jeu ordinaire, mesurés par lockstep apparié sur les 14 scénarios. Pointes de replanification après destruction divisées par ~15 (4 422 → 37 segmentFree par recherche). Allocations par pas : 531-874 Ko → 148-239 Ko (−72 à −73 %). Scavenges : 14-23/30 s → 3-6/30 s. Génération du monde : −34 à −50 % (−70 à −100 ms). Image, son et jeu identiques ou meilleurs, empreinte d'état à pas fixe sur tous les scénarios.

## Mise à jour après contre-vérification

Cette fiche a été rédigée avant la contre-vérification des axes STAB, DRAW, RESTE et PARA. Les verdicts ci-dessous priment sur le texte des tâches.

- **RESTE-04 — confirmé, priorité P1, qualité identique.** Gain corrigé : -4 à -6 % du pas pour les boucles seules (et non -7 à -9 %) ; environ -10 % cumulé avec RESTE-05 (et non -12 à -14 %).
- **RESTE-05 — confirmé, priorité P2, qualité identique.** Gain corrigé : Environ -3 % du pas en vrai combat aux roquettes, -2 à -9 % dans les autres scénarios, après correction du biais (et non -6 à -10 %).
- **RESTE-06 — plausible, priorité P1, qualité identique.** Gain corrigé : (a) : gain nul. (b) : -3 à -8 % du pas moyen en tir soutenu (et non -15 à -20 %), et surtout suppression d'un blocage de plusieurs millisecondes par révision côté simulation.
- **RESTE-10 — RÉFUTÉ.** Ne fais pas la tâche qui s'appuie sur ce constat. Le chiffre brut se reproduit (1 075,9 contre 1 399,5 Ko/image, +30 %), mais la cause est fausse et ce n'est pas une dérive. Sur la fenêtre de 400 images il n'y a aucun ennemi tué et aucun butin. L'écart vient de l'endroit où passe le pilote (objets statiques du monde) et des débris qui atteignent leur plafond. Le butin est borné à un objet par ennemi (simulation.js:636 et 2164). La proposition (3), expiration du butin en démo, est sans objet. Restent utiles : le critère d'endurance (4) et le harnais dans FERRO (5),…
- **STAB-02 — RÉFUTÉ.** Ne fais pas la tâche qui s'appuie sur ce constat. La « dérive après 50 s » est un artefact du banc, pas un effet de durée de session. Preuves : (1) drift.py sur ses propres fichiers : dans les 4 sessions examinées (c0, c9, c13, arène c5) la première image à 2 sous-pas est l'image 2914, à 48,583 s simulées, et 100 % des images suivantes font 2 sous-pas ; le saut de médiane (c0 : 3,3 puis 6,2 ms) coïncide exactement avec ce basculement, qu'il décrit lui-même dans STAB-06 (horloge partie de 1e6 ms, franchissement de 2^20). Le coût d'updateDebris PAR PAS atteint son p…
- **STAB-10 — plausible, priorité P3, qualité visuellement identique.** Gain corrigé : Au plus 0,1 à 0,3 ms par image à 144 Hz ; aucun effet mesurable sur le nombre d'images longues tant que STAB-01 n'est pas traité.


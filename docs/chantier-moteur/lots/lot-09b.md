# Lot 09b — Saut libre et élan (complément)
## But
Livrer le saut moderne (apex 0,961 m, portée 4,69 m à 7,6 m/s) sans sortie, sans raccourci gratuit, sans mort sur dénivelé < 1,5 m.
Clip joueur sans plafond lié au muret debout, règle de chute par hauteur d'appel, reprise en bunny-hop < 0,2 s.
Profil legacy identique bit à bit ; tests de non-sortie, non-raccourci et invariance de cadence en place.
## Tâches, dans l'ordre

### T1 — Clip joueur sans plafond, lié au destructibleId du muret [SAUT-01]
- Où : src/simulation.js:242-251, :258-262, :317-323, :334-357 ; src/world.js:112-116, :477, :1212-1221, :1272-1291 ; src/destruction.js:174-176.
- Quoi : à la création, clipIds = Set des destructibleId des meshes de world.outdoorBoundaries. Dans actorBlocked(e,x,z,r,y), si e===p et q.destructibleId ∈ clipIds et q.minY < y+1,8 et discBox(x,z,r,q) → true. Pas de test sur q.maxY (hauteur illimitée). Ne pas modifier landingAt. Les morceaux restants gardent leur destructibleId (destruction.js:175) : seule la partie debout bloque.
- Preuve exigée : `node bancs/saut/explore.mjs v2-01 J clip=1000000 fast=1 limit=280` → outside 0, onBoundary 0, crossingCount 0, deadEnds 0. Contre-épreuve clip=2,4 doit montrer des sorties.
- Qualité : meilleure (0 sortie vs 42 217 états hors zone avec clip 2,4 m ; 0 raccourci sans tir).
- Garde-fous : sauvegarde 0.8.0 avec joueur sur crête → ignorer le clip tant que le disque chevauche une boîte de clip. Mur invisible au-dessus d'un muret de 0,72 m : retour visuel/sonore au contact obligatoire (arbitrage David, voir Décisions). Taille ≈ 0,3 Ko. Ennemis non concernés (e===p).
- Dépend de : rien.

### T2 — Chute mortelle par hauteur d'appel, pas par vitesse d'impact [SAUT-03]
- Où : src/simulation.js:324-333, :138-144, :385-390, :6-8.
- Quoi : profil moderne seulement. Mémoriser fallFrom = y des pieds à l'instant du départ (rebord, saut, perte d'appui). Dans land() : mort si atterrissage sur substrat et fallFrom − y > 1,5 m. Aucun champ nouveau : y₀ = y − airVY·airTime − g·airTime²/2 (airTime remis à 0 à chaque saut). Contact de tête → airTime = 0, la hauteur du choc sert de référence. Vol de propulseur : règle actuelle conservée.
- Preuve exigée : fatal.mjs adapté → 5 cas vivants (saut sur place, par-dessus muret 0,72 m, pas dans le vide 1,0 m, depuis caisse 1,0 m, depuis terrasse 3,2 m vivant) ; chute de 3,2 m sur substrat = mort.
- Qualité : meilleure (plus de mort sur dénivelé < 1,5 m ; 117 637 vols mortels mesurés disparaissent avec T1).
- Garde-fous : pas de physicsVersion 2, pas de changement de format. Tests de chute existants (simulation.test.mjs:1642-1669) utilisent fixture() sans generation → profil legacy, non touchés. Profil legacy garde impact > 6.
- Dépend de : rien (indépendant de T1, mais T1 supprime la crête ; la règle couvre la brèche).

### T3 — Saut tamponné au pas suivant ; pas de rebond dans land() [SAUT-05]
- Où : src/game.js:94-97, :238, :690-695 ; src/simulation.js:324-333, :336, :403-407, :2088-2093, :1946.
- Quoi : dans land(), poser le joueur, garder velocityX/Z **et** les champs de locomotion (locomotion.speed non remis à 0), ne pas relancer le saut. Consommer le reste du pas au sol (sans friction si saut en tampon). Déclencher le saut tamponné au début du locomote suivant, avant toute friction. Garder game.js:94-97 tel quel (pas d'échéance, pas d'instantané en vol). Ne pas toucher à validAir ni à physicsVersion.
- Preuve exigée : checkpoint.mjs, ligne « bhop » → saves = dues, maxDelay ≤ 0,7 s (mesuré 0,13 s), pendingAtEnd false. Test à 20, 60 et 120 images/s : écart < 0,05 m.
- Qualité : meilleure (retard 0,13 s au lieu de 10,4 s ; ~4 % de temps de bond récupéré).
- Garde-fous : tampon de saut et délai de grâce = états nouveaux → remis à zéro à la restauration. Déterminisme : consommation du reste du pas à livrer avec le test multi-fréquence. Mesure sur un seul monde, un seul trajet.
- Dépend de : T1 (le clip empêche l'atterrissage sur crête qui rendait le rebond nécessaire).

### T4 — Suite de tests de non-régression du saut [SAUT-10]
- Où : checks/jump.test.mjs (nouveau) ; src/simulation.js:95 ; checks/simulation.test.mjs:546-606 ; checks/world.test.mjs:130-134 ; checks/checkpoint.test.mjs:446-478 ; src/simulation.js:2088-2093.
- Quoi : 8 tests. (1) Identité legacy : digests 3f029a37 / a4f9cfdf et e7ee46f7 / 37d7fff5 égaux sur 3 600 pas, saut pressé 3/45. (2) Non-sortie : 1 monde par stade (3 mondes), états < 7 m d'un muret + chaque quai haut, sauts 7,6 et 10,5 m/s × 16 directions. (3) Brèche : passage et retour après démolition. (4) Non-blocage : blocked() faux à chaque atterrissage. (5) Chute mortelle : 5 cas + 3,2 m. (6) Bunny-hop : 60 s, reprise < 0,7 s. (7) Rebond sur crête puis chute (SAUT-03) ; brèche avec lamelle (SAUT-V2) ; sortie par brèche au pistolet (SAUT-V1). (8) Invariance de cadence 20/60/120 Hz.
- Preuve exigée : `node bancs/saut/legacy.mjs` → colonne « identique » true pour les 2 mondes legacy. npm test vert.
- Qualité : identique (tests, pas de changement de comportement).
- Garde-fous : tests 2 et 4 sous 10 s dans node:vm (limiter aux états proches des murets). Retirer le test d'instantané en montée (physicsVersion 2) : aucun appelant hors game.js:98 derrière la garde airborne.
- Dépend de : T1, T2, T3, T5.

### T5 — Supprimer les lamelles de collision < 0,12 m issues d'une coupe [SAUT-V2]
- Où : src/destruction.js:36-46, :142-144, :243-244 ; src/world.js:113 ; src/simulation.js:242-251.
- Quoi : dans compile(), boucle g.colliders (:141-144), après les subtract : écarter tout morceau dont une dimension horizontale < 0,12 m alors que la même dimension du collider d'origine ≥ 0,12 m. Les tôles et rails fins d'origine (dimension d'origine < 0,12 m) sont conservés. Le rendu suit (meshes reconstruits depuis ces morceaux, :147-149). Dans le clip de T1, ignorer aussi les morceaux < 0,12 m d'épaisseur.
- Preuve exigée : `node bancs/saut-verif/sliver.mjs` → plus aucun reste d'épaisseur 0,04 dans « restes ». `node bancs/saut-verif/breach2.mjs` mode balayage 6 s v2-00 → sortie non nulle.
- Qualité : meilleure (brèche visible = brèche franchissable ; supprime le mur invisible créé par le clip sur une lamelle).
- Garde-fous : sauvegarde 0.8.0 se recharge avec lamelles en moins (collision plus permissive, jamais plus stricte). Tests destruction.test.mjs (15) et renderer-destruction.test.mjs (15) à rejouer, notamment façade fine :204. Linteau 9 cm × 0,52 m reste (vraie barre visible). Déterminisme inchangé.
- Dépend de : T1 (le clip rend la lamelle infinie sans cette correction).

### T6 — Outil de garde-fou non-raccourci par stades [SAUT-02]
- Où : src/simulation.js:317-323, :334-357, :179-180, :1931-1937 ; src/world.js:1272-1291.
- Quoi : tools/jump-reach.mjs (repris de explore.mjs) : charge src/*.js dans le domaine principal, calcule les stades à pied confinés puis avec sauts, échoue si un objet (salle, relais, commande, ascenseur, sortie, atelier) descend d'un stade **sans tir**. Coût 60-190 s/monde → hors npm test. Dans npm test, version courte : 3 mondes (index 0,1,2), sauts depuis états < 7 m d'un muret, critère « aucun état hors zone ».
- Preuve exigée : explore.mjs <monde> WC puis J clip=1000000 → dictionnaires « objects » identiques. Sans clip (mode J) : la différence liste les 12 objets (v2-00) et 6 (v2-01) au stade 0.
- Qualité : meilleure (0 raccourci sans tir au lieu de 12 + 6).
- Garde-fous : le contournement par le substrat existe déjà en 0.8.0 (2-6 s de pistolet, SAUT-V1) ; le critère doit préciser « sans tir ». Ascenseurs modélisés par téléportation. Les rencontres et le boss ne sont pas des verrous.
- Dépend de : T1.

### T7 — Plafond 10,5 m/s validé ; dimensionner le reste pour cette vitesse [SAUT-11]
- Où : src/simulation.js:95, :334-341, :1322.
- Quoi : garder le plafond à 10,5 m/s (atteint en 1 s avec strafe à 1,2 rad/s, pas en 10 sauts). Dimensionner pour 10,5 m/s en régime permanent : distance de garde des pièges/télégraphes, borne de vitesse observée ±11, marges du cache. Borner la vitesse apportée par une explosion ou un propulseur enchaîné (non mesuré). Option de ressenti : accél. aérienne 0,7 pour exiger 3 bonds → à trancher en jeu.
- Preuve exigée : `node bancs/saut/t0.mjs` → lignes « bhop turn », 10,5 m/s dès la 1ʳᵉ seconde à 1,2 rad/s ; 8,7 puis 10,4 à 3 rad/s ; 7,6 sans strafe.
- Qualité : sans objet (validation, pas de changement de comportement).
- Garde-fous : un seul pilote de strafe ; recul d'explosion et propulseur+saut non mesurés. locomotion.speed = 0 à la fin du pas d'atterrissage (corrigé par T3).
- Dépend de : rien.

### T8 — Vérification : la portée verticale de la ruée reste à 0,9 / 0,65 m [SAUT-06]
- Où : src/simulation.js:1260-1269, :1266, :1782, :1402-1405, :1434-1439.
- Quoi : ne pas modifier la portée verticale (touche 0,9 m, départ 0,65 m). La parade à 1,7 m prototypée n'apporte aucun gain mesurable (dégâts 260-444 vs 364-398 en strafe). Vérifier que dans perch3.mjs, dégâts perchés ≥ 85 % des dégâts au sol pour toutes les hauteurs. Points 2-4 (attente, grenade de débusquage, projectiles de repli) renvoient à IA-08, IA-10, T9.
- Preuve exigée : perch2.mjs et perch3.mjs (colonnes base) avant/après inchangés. perch.mjs v2-00,v2-04,v2-08 20 20 → au plus 3 perchoirs sur 20 sous 70 %.
- Qualité : sans objet (décision de non-changement).
- Garde-fous : 20 perchoirs réels au total (pas 20/monde) ; joueur passif ; aucune ruée observée en monde réel. Base mince.
- Dépend de : rien.

### T9 — Précision ennemie : la borne ±11 est inutile ; l'interception reste un réglage d'équilibrage [SAUT-07]
- Où : src/simulation.js:1322, :1795-1796, :1242-1259, :1263-1267.
- Quoi : retirer la proposition d'élargir la borne à ±11 (mesuré : 13,4/11,3/6,4 % vs 13,4/11,1/8,6 % → aucun gain). L'interception (second degré, t ≤ 2,5 s, vitesse ±11, viser le point de chute si cible en l'air) est un réglage d'équilibrage à trancher en jeu, pas une amélioration de fluidité. Ne pas l'implémenter dans ce lot.
- Preuve exigée : aim.mjs tableau avant/après identique (0 touche sur 119-127 tirs en cercle à 5,4/7,6/10,5 m/s). Si l'interception est livrée plus tard : 8-15 % de touches contre le cercle à 7,6 m/s.
- Qualité : sans objet (conclusion négative mesurée).
- Garde-fous : le défaut existe déjà en 0.8.0 (0 touche à 5,4 m/s) ; le saut ne l'aggrave pas. David trouve déjà le bouclier insuffisant → durcir l'IA sans son accord est risqué. Rejouer tools/campaign-balance.mjs si l'interception est livrée.
- Dépend de : rien.

### T10 — Marge angulaire adaptative du cache RCPU-01 [SAUT-08]
- Où : src/renderer.js:1545-1547, :1408-1413, :1435-1436.
- Quoi : mesurer le lacet lissé sur 4 images. À chaque reconstruction : θ = clamp(0,08 s × |ω|, 8°, 24°). Garder D = 1 m. Exposer renderer.configure({cacheTurnMax}) avec 24° par défaut. Image identique (sur-ensemble conservateur, découpé par le GPU).
- Preuve exigée : `node bancs/saut/cache.mjs 900 6` → ≤ 20 reconstructions/s sur pilotes 300°/s (vs 26,7-29,3) ; ≤ 18,5/s sur le pilote de référence. bench/rcpu/ab.mjs : 0 entrée manquante.
- Qualité : identique (image identique, sur-ensemble conservateur).
- Garde-fous : le cache n'existe pas encore (prototype bench/rcpu/proto.mjs). Le plancher de 17-18 reconstructions/s vient des révisions de destruction, pas de θ. +24 % d'instances pendant les rotations rapides : coût GPU à vérifier avec bench/rgpu. Un seul monde mesuré.
- Dépend de : rien.

### T11 — Vérification physique 2,5D : aucun blocage, aucune traversée sous le terrain [SAUT-09]
- Où : src/simulation.js:126-137, :317-323, :343-354, :145-152, :391-394.
- Quoi : ne rien changer aux lignes :343-354. Pas de montée de marche en vol (82 cas sur 7,76 M vols ne la justifient pas). Conserver les compteurs comme test de non-régression (intégré à T4) : 0 état coincé, 0 mort « beneath », 0 mort « void », frozenNear < 30. Le gel au premier contact avec un sol plus haut (vitesse d'un axe → 0) est un point de ressenti à juger en jeu, pas un blocage.
- Preuve exigée : explore.mjs <monde> JC → stuck 0, deaths.beneath 0, deaths.void 0, frozenNear < 30.
- Qualité : sans objet (décision de non-changement).
- Garde-fous : 20/21 explorations coupées à mi-parcours. Sans destruction ni gravats, sans ascenseur en mouvement ni piège à dalle. Le gel contre un rebord oblique annule tout l'élan (ressenti).
- Dépend de : rien.
## Options désactivées par défaut
- (aucune : aucun constat de qualité « dégradée » dans ce lot)
## Écartés ou absorbés
- [SAUT-04] — Absorbé par T1 : le clip sans plafond donne 0 franchissement à pied dans les 3 explorations complètes. Le cas « départ sur quai haut, sprint, strafe en l'air » est ajouté au test de non-sortie de T4. Aucun chantier séparé.
## Décisions à confirmer par David
- Le clip de T1 crée un mur invisible au-dessus d'un muret de 0,72 m (joueur perché à 2 m voit par-dessus sans pouvoir sauter). La 0.8.0 écrit « rather than an invisible wall » (world.js:1280-1281) et le test world.test.mjs:132 rejette « invisible/unphysical boundary ». Retour visuel et sonore discret au contact : suffisant, ou le clip ne s'applique qu'au-dessus de 1,2 m ? — valeur par défaut proposée : clip complet + retour visuel/sonore au contact.
- La sortie par brèche au pistolet (2-6 s, munitions infinies) existe déjà en 0.8.0 et le clip de T1 ne la ferme pas. Voie A : assumer la brèche comme mécanique (critères « sans tir »). Voie B : les murets de bordure ne cèdent qu'aux explosifs (drapeau category === 'boundary', calcul à l'exécution, format inchangé). — valeur par défaut proposée : Voie A (assumer), car la Voie B change une mécanique livrée et dépend de T1 pour le retour.
- Accélération aérienne : 1,1 (plafond atteint en 1 s, 10,5 m/s = vitesse de croisière) ou 0,7 (3 bonds pour passer 10 m/s, courbe d'apprentissage) ? — valeur par défaut proposée : 1,1 (cohérent avec toutes les mesures de l'axe).
## Gains attendus du lot
0 sortie au lieu de 42 217 états hors zone (v2-01) et 0 mort par saut sur muret intact (3 familles de tracé, mesuré verifA.mjs). Reprise en bunny-hop < 0,2 s au lieu de 10,4 s (mesuré). 0 raccourci sans tir au lieu de 18 objets (v2-00 + v2-01). Brèche visible = brèche franchissable (lamelle 4 cm supprimée). Profil legacy identique bit à bit (digest 3f029a37 / a4f9cfdf, 3 600 pas). Cache : −34 % de reconstructions pendant les lacets à 300°/s (−9/s, effet limité à 0,6 s de rotation).

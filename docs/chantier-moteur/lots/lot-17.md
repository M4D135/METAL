# Lot 17 — Physique de corps rigides

> **Décision de David (12 novembre) — elle prime sur les valeurs par défaut de cette fiche.** Pas de saisie ni de lancer d'objets pour le moment : retire-les de l'étape D. Tout le reste est voulu : objets qui réagissent aux tirs et aux explosions, décor cassé qui devient des débris physiques, machines détruites qui se disloquent ou s'effondrent sur leurs articulations. Ordre : noyau, étape A (accessoires), étape B (gravats), étape C (machines détruites), puis ce qu'il reste de l'étape D (pousser les objets, monter dessus) et l'étape E.

## But
Introduire un noyau de corps rigides (FPhys) dans METAL et l'intégrer en cinq étapes : accessoires poussables, gravats physiques, épaves de machines, contrôleur de personnage, articulations. Les objets réagissent aux tirs, explosions et au joueur ; les empilements tiennent puis s'écroulent ; les points de reprise passent sans refus.

## Tâches, dans l'ordre

### T1 — Vérifier le diagnostic et figer le plan en cinq étapes [PHYS-01]
- Où : src/simulation.js:242-273, 876-893, 933-958, 992-1065, 1083-1085, 2070-2084 ; src/actors.js:17 ; src/world.js:1350-1353
- Quoi : confirmer par lecture que s.debris n'apparaît dans aucun chemin de ray, blocked ou explode (grep -n 's.debris' src/simulation.js → 7 sites, aucun dans les trois) ; vérifier MAX_RUBBLE=128 (ligne 64) ; exécuter node bancs/phys/worldstats.mjs pour le compte d'accessoires (211 à 285 par monde, 40 à 48 taille caisse, 0 dynamique) ; noter les 26 rectangles de sol sur 6 hauteurs (−0,25 ; 0 ; 1,6 ; 3,2 ; 4,8 ; 6,4 m) et les 102 paires coplanaires jointives.
- Preuve exigée : état identique (lecture seule, aucune modification de code).
- Qualité : identique.
- Garde-fous : aucune écriture ; si un écart est trouvé entre le constat et le code 0.8.1, le signaler avant de lancer T2.
- Dépend de : rien.

### T2 — Noyau FPhys : boîtes orientées, grille, impulsions séquentielles, sommeil [PHYS-02]
- Où : src/physics.js (nouveau, ~60 Ko) ; bancs/phys/fphys.mjs (365 lignes, référence) ; src/simulation.js:220-235 (point d'intégration)
- Quoi : créer src/physics.js, global FPhys, sans DOM ni rendu. API : create({bounds, gravity:−12, capacity:384, cell:2, tick:1/120, iterations:2, relax:1}), setStatics, updateStatics, addBody, removeBody, setKinematic, step, impulse, blast, wakeBox, ray, sweepCapsule, events, joints, snapshot, restore, hash, stats. Structures en tableaux typés en colonnes ; corps 0 = monde immobile ; contacts en colonnes avec réponses angulaires précalculées. Matières : métal μ=0,45 e=0,24 ; pierre 0,70/0,16 ; bois 0,55/0,22 ; verre 0,35/0,16 ; terre 0,80/0,05. Ajouter sphère, capsule (segment le plus proche), plans bornés en pente, boîtes cinématiques, couches de collision. Exposer matrice 3×3 et pose précédente pour l'interpolation de rendu.
- Preuve exigée : node bancs/phys/drift.mjs → pile de 10 sous 30 mm à 10 s, pyramide sous 20 mm, 0 corps sous le sol ; node bancs/phys/bench.mjs 4 120 1 → tas de 300 sous 2,4 ms médian par pas ; hachage identique dans les 5 modes de determinism.mjs ; 0 octet par pas (alloc2.mjs) ; source < 60 Ko.
- Qualité : meilleure.
- Garde-fous : le prototype n'a que des boîtes (sphère, capsule, articulations non mesurés) ; temps sous charge 27-114 → refaire sur machine calme avant de fixer les seuils ; le coût fixe est 45-50 µs par pas à l'échelle METAL (6 901 cellules), pas 35 µs ; aucun code GPL.
- Dépend de : rien.

### T3 — Cadence 120 Hz, accumulateur interne et marge spéculative [PHYS-03]
- Où : src/simulation.js:432, 1068 ; src/game.js:677, 690-696 ; src/simulation.js:1083-1085 (grenade)
- Quoi : dans sim.step(dt), acc += dt ; tant que acc ≥ 1/120, phys.step(1/120). L'accumulateur est sérialisé. Marge spéculative : enveloppe élargie |v|×dt + 2 cm ; marge de paire = 2 cm + (|vA|+|vB|)×dt. Grenade : sphère de 0,17 m (rayon aux lignes 1119 et 2061, pas 1005), rebond 0,42, roule au lieu de se figer au 3e rebond. Roquettes : rayon balayé inchangé (959-979). L'interpolation de pose au rendu est obligatoire (dt variable, 1 à 3 pas par image), alignée sur la boucle STAB-06 (lot 07).
- Preuve exigée : node bancs/phys/tunnel.mjs → 0 traversée sur 960 (160 + 800, vitesses 14-40 m/s) ; node bancs/phys/drift.mjs → pile sous 30 mm ; grenade à 24 m/s contre mur de 12 cm : 0 traversée sur 1 000 tirs semés.
- Qualité : meilleure.
- Garde-fous : changer la trajectoire des grenades modifie l'équilibrage et les tests de projectiles ; si LOOP-05 change le découpage, l'accumulateur reste la seule source de cadence ; 60 Hz × 1 est exclu (pile s'écroule à 90°).
- Dépend de : T2 ; boucle STAB-06 (lot 07).

### T4 — Règles de déterminisme : cinq contraintes d'écriture [PHYS-04]
- Où : src/physics.js (en-tête) ; bancs/phys/determinism.mjs ; bancs/phys/restore2.mjs ; src/simulation.js:1946
- Quoi : (1) dans step, aucune fonction Math sauf sqrt, abs, floor, imul, min, max ; remplacer l'opérateur ** par x*x (fphys.mjs:11) ; (2) ordre fixe : corps par indice croissant, cellules z puis x, statiques par ordre d'insertion, contacts par ordre d'émission ; (3) grandeurs dérivées canoniques recalculées par la même fonction à la création, fin de pas et restauration, à partir de la masse inverse sérialisée (pas 1/(1/m)) ; (4) physicsVersion 2 inclut taille de cellule, itérations, tolérances, marge ; (5) normaliser −0 par x+0 en fin de pas ; hash() couvre minuteries de sommeil, numéros d'île et cache d'impulsions.
- Preuve exigée : node determinism.mjs > a.txt && node --no-opt determinism.mjs > b.txt && cmp a.txt b.txt → hachages stack10 37d0ca59, pyramid55 56c8b99b, rubble300 170702f6, blast200 fe961b81 identiques ; node restore2.mjs → première différence : aucune.
- Qualité : identique.
- Garde-fous : égalité entre navigateurs attendue par construction mais vérifiée uniquement sous V8 ; la simulation METAL reste dépendante de Math.sin/cos/atan2 (420-421, 437, 1048) ; figer les hachages de référence dans checks/physics.test.mjs.
- Dépend de : T2.

### T5 — Masques de face interne : supprimer les accroches sur les joints coplanaires [PHYS-V1]
- Où : src/physics.js (setStatics, updateStatics, test boîte contre statique) ; bancs/phys/fphys.mjs:124-156, 205-212 ; src/world.js:1350-1353 ; src/simulation.js:220-235
- Quoi : à setStatics et updateStatics (hors pas) : (1) fusionner les boîtes alignées dont l'union est exactement une boîte (coplanaires à 1 mm) ; (2) marquer chaque face « interne » si une voisine la recouvre ou la prolonge coplanaires à moins de 6 mm ; (3) dans le test boîte-statique, si l'axe retenu est une face interne et le point le plus profond est à moins de 3 cm du plan coplanaire voisin, écarter cet axe ; un contact spéculatif sur une face interne est toujours écarté ; (4) sols : chaque rectangle walkable devient une dalle épaisse de 0,5 m (boîte orientée pour les pentes), pas un plan borné testé par sommets seuls ; (5) updateStatics recalcule les masques des seules voisines.
- Preuve exigée : node bancs/phys-verif/seams.mjs → sur 24 dalles jointives, distance égale à une dalle unique à 5 % près, saut sous 5 mm, inclinaison sous 1° à 1,5/4/9 m/s ; mur en 12 boîtes : 0 coup d'arrêt ; pile de 10 sur un joint sous 30 mm à 10 s.
- Qualité : meilleure.
- Garde-fous : change les trajectoires → à faire avant de figer les hachages (T4) ; un masque trop large laisse traverser un vrai rebord → tester une marche de 5 cm qui doit bloquer ; après destruction, les masques doivent suivre.
- Dépend de : T2.

### T6 — Épaisseur de collision minimale et tolérance par corps [PHYS-V4]
- Où : src/physics.js (addBody, tolérance d'appui) ; bancs/phys/fphys.mjs:9, 262 ; src/destruction.js:216-223
- Quoi : (1) épaisseur de collision minimale 4 cm (demi-taille 2 cm) pour tout corps, accessoires compris ; le maillage garde son épaisseur réelle posée sur le bas de la boîte ; (2) tolérance d'appui par contact = min(5 mm, 12 % de la plus petite demi-taille des deux corps), stockée par corps à la création (grandeur dérivée canonique, règle 3 de T4) ; (3) rendu : remonter chaque corps de la moitié de sa tolérance ; (4) dans PHYS-07, tôle de 4 cm minimum ou traitée comme décor non empilable.
- Preuve exigée : node bancs/phys-verif/robust.mjs (T4) → centre de tôle au repos à moins de 2 mm de la position idéale ; pile de 5 tôles à au moins 90 % de sa hauteur ; pendant le choc, aucun point à plus de 3 mm sous le sol.
- Qualité : meilleure.
- Garde-fous : ne pas réduire la tolérance globalement (97 mm d'écart transitoire sur pile de 10 à 2 mm) ; change les trajectoires → avant figeage des hachages.
- Dépend de : T2.

### T7 — Étape A : accessoires physiques, barils explosifs, tirs et explosions [PHYS-07]
- Où : src/world.js:1207, 1340, 1390, 1732-1766 ; src/simulation.js:220-241, 838, 933-958, 1137 ; src/effects.js:169-199
- Quoi : world.js : fonction physicsProps(w) avant demolitionMetadata (1340) ; types : caisse bois 0,8 m/30 kg, métal 0,6/45, baril 0,6×0,9/25 (explosif hp 10), palette 1,2×0,14×1,0/15, tuyau 2 m/12, tôle 1,2×0,04×0,8/8, béton 0,4/60. Placement en grappes de 4 à 8 objets à moins de 3 m, le long des murs et angles, jamais à moins de 1,5 m d'une porte/liaison/ascenseur/tremplin/piège/relais, barils à plus de 6 m du départ. Densité 8-12 par salle (80-120 par monde), moitié en qualité basse. Simulation : phys = FPhys.create(capacity:384) ; statiques = solids (updateStatics dans syncDestruction 229-235) ; sols = walkable ; portes/pièges/ascenseurs = cinématiques. Tirs : phys.ray après hitRay, impulsion pistolet 30-45, mitraillette 20-25, plomb 12-15. Explosions : phys.blast rayon 3,2 m, puissance terrain×22, plafond 14 m/s. Barils : explosion à 0,15+(id%5)×0,05 s, rayon 3,2 m, dégâts 24.
- Preuve exigée : une pile de 3 tient 10 s ; 2-3 balles de pistolet font tomber la caisse du haut ; une grenade en grappe de 6 projette les objets à moins de 3,2 m ; chaîne de 3 barils ; aller-retour sauvegarde identique ; relais/sortie/objets atteignables sur 18 mondes ; coût moyen sous 0,3 ms par image en combat, sous 1 ms au pire ; 262 tests verts.
- Qualité : meilleure.
- Garde-fous : l'empreinte du monde change (points de reprise antérieurs invalides) ; clearLane (1336) doit interroger phys.ray dès cette étape (sinon ennemis tirent à travers les caisses) ; budget de primitives : 100 objets via instanciation statique tant qu'ils dorment ; mobile : densité ÷2.
- Dépend de : T2, T3, T4, T5, T6, T9 (sauvegarde).

### T8 — Zéro allocation par pas : tampon typé pour les paramètres flottants [PHYS-05]
- Où : src/physics.js (fonctions internes collide, face, clip, emit, solve) ; bancs/phys/fphys.v1-boxed-args.mjs ; bancs/phys/alloc2.mjs
- Quoi : aucune fonction interne appelée par paire ou par contact ne reçoit ni ne renvoie de double. Paramètres flottants via Float64Array SCR[0] marge, SCR[1-2] limites clip, SCR[3-4] frottement/rebond, SCR[5-8] constantes solveur. Variables de fermeture modifiées par pas dans un tableau typé. Entiers (indices, compteurs) restent en arguments.
- Preuve exigée : node --expose-gc alloc2.mjs → moins de 64 octets par pas sur 600 pas (référence : 57 084 octets avant correction, 6-7 après) ; node allocsame.mjs → hachages identiques (85c09f4b, b93c7502, 6d172292).
- Qualité : identique.
- Garde-fous : lisibilité réduite → commenter chaque index SCR ; comportement propre à V8, sans coût ailleurs ; test d'outillage hors npm test.
- Dépend de : T2.

### T9 — Sauvegarde physicsVersion 2 : cache d'impulsions, bornes, conversion v1 [PHYS-06]
- Où : src/simulation.js:64-66, 1941-1959, 1962, 2070-2084 ; src/game.js:94-121 ; src/physics.js (snapshot, restore)
- Quoi : format physicsVersion 2 dans state.phys : par corps (id, pos×3, quat×4, drapeaux ; éveillés : vel×6, minuterie ; endormis : île) ; cache d'impulsions des contacts courants (clé paire, id point, 3 impulsions) ; accumulateur. Ne pas sérialiser matrices, inerties, enveloppes, grilles, formes/masse/matière des accessoires générés. Encodage : tableaux de nombres en clair ; option base64 Float64 (−40 %). Restauration : validation par bornes (finis, pos dans monde ±80 m, quat norme 1±1e-6, vel sous 40 m/s et 30 rad/s, ids uniques, clés de cache valides). Supprimer la règle de chevauchement (2081) et la règle d'appui (2080). Accepter rubbleVersion 1 (gravat → corps endormi, même pose, angles→quaternion) et physicsVersion 1/absent.
- Preuve exigée : node bancs/phys/restore.mjs → hachage identique avec cache (17089485, 3fa55997, 6d172292) ; sur 3 mondes, 30 s de combat, aller-retour toutes les 3 s : 11/11 réussites, hachage FPhys identique 300 pas plus loin ; taille typique 25-35 K caractères (55-70 K si cache endormis conservé).
- Qualité : identique.
- Garde-fous : point de reprise en plein éboulement jusqu'à 194 K caractères (limite 2 000 000 tenue) ; reporter la sauvegarde si plus de 150 corps éveillés ; ne jamais muter l'état vivant dans snapshot() ; passer par numéro de version, pas par compte de clés (2071).
- Dépend de : T2, T4.

### T10 — Réveil par propagation au lieu du réveil d'île [PHYS-V2]
- Où : src/physics.js (wakeIsland, wake, collide, cache) ; bancs/phys/fphys.mjs:184-185, 199-221, 300-304 ; bancs/phys-verif/wake.mjs
- Quoi : (1) un corps endormi touché par un éveillé n'est réveillé que si vitesse d'approche > 0,25 m/s ou impulsion normale > 0,25×sa masse ; en dessous, traité comme statique pour ce contact ; propagation par couche de voisins tant que le seuil est dépassé ; réveils explicites (explosion, statique retiré, saisie) immédiats ; (2) cache d'impulsions persistant pour les contacts endormis, sérialisé (~53 caractères/point) ; (3) un corps réveillé pendant la détection n'est ni intégré ni soumis à la gravité dans ce pas (effet au pas suivant) ; (4) sommeil par corps avec repli : éveillé plus de 6 s avec moins de 2 mm de déplacement sur la dernière seconde → endormi ; scinder une île quand un sous-groupe est immobile depuis 1 s.
- Preuve exigée : node bancs/phys-verif/wake.mjs → impulsion de 6 sur tas de 300 : au plus 16 corps réveillés, rendormis en moins de 2 s, moins de 60 ms CPU cumulées, aucune autre pièce déplacée de plus de 2 mm ; pile de 10 réveillée par 0,001 : vitesse verticale sous 20 mm/s.
- Qualité : meilleure.
- Garde-fous : seuil trop haut → objet posé glisse lentement (garder réveil immédiat si support retiré ou déplacé de plus de 5 mm) ; cache persistant grossit l'instantané (30-35 K pour 128 gravats) ; change les trajectoires → avant figeage des hachages ; purement fonction de l'état simulé.
- Dépend de : T2.

### T11 — Rapports de masses : clamp 3-120 et couches par classe [PHYS-V3]
- Où : src/physics.js (addBody, masques) ; src/destruction.js:223 ; bancs/phys/scenes.mjs ; bancs/phys-verif/ratio.mjs, seams.mjs
- Quoi : (1) masse physique = clamp(masse, 3, 120) à l'entrée dans FPhys (rapport max 40) ; la masse d'origine reste pour sons et dégâts ; (2) éclats de moins de 1 kg : couche qui ne heurte que le décor et les corps de moins de 20× leur masse ; (3) accessoires PHYS-07 : rapport d'au plus 8 entre objets empilables (8 à 60) ; jamais un objet de plus de 4× la masse de celui qui le porte ; (4) ne pas répondre par plus d'itérations partout (+51 %) ; réserver 4+2 aux îles avec articulation (PHYS-11).
- Preuve exigée : node bancs/phys-verif/ratio.mjs → dessous de dalle à au moins 85 mm ou éclats chassés sans passer de plus de 5 mm sous le sol ; pile 8-8-8-8-150 sous 40 mm à 10 s.
- Qualité : meilleure.
- Garde-fous : masse bornée modifie la réaction aux explosions des très petites pièces (elles volent moins loin) → compenser par le plafond de vitesse du souffle ; masque par classe déterministe et sérialisé.
- Dépend de : T2.

### T12 — Étape B : gravats en corps rigides, suppression d'updateDebris [PHYS-08]
- Où : src/simulation.js:68-83, 876-893, 992-1065, 2070-2084 ; src/destruction.js:210-227 ; src/effects.js:169-199
- Quoi : appendDebris (876-893) crée un corps FPhys (boîte/sphère/capsule selon forme, angles→quaternion, masse/matière/graine/sourceId conservés). Naissance : réduire la forme de 4 %, 8 passes de dégagement par l'axe de moindre pénétration contre les statiques ; si pénétration > moitié de la plus petite demi-taille, ne heurte que le sol pendant 0,25 s ; vitesse de dégagement plafonnée à 3 m/s. Éclats cosmétiques (64 max, sous 1,5 s) hors FPhys ou couche décor. Supprimer debrisHalf, debrisFloor, debrisBoxes, debrisSupport, debrisSweep, debrisContact, updateDebris (−8,2 Ko). s.debris reste la liste lue par le rendu (id du corps, pose relue depuis FPhys). Sommeil : repli par corps (6 s, 2 mm) + scission d'île (1 s immobile). Destruction : updateStatics réveille les corps dont l'enveloppe touche une boîte retirée. Sons : debrisLand alimenté par les chocs FPhys. Plafond 128 et politique de retrait (881-887) inchangés.
- Preuve exigée : node bancs/loop/restorescan.mjs <metal> 30 → zéro refus sur 13 mondes ; aucune paire au repos qui se pénètre de plus de 2 cm ; 128 gravats au repos sous 10 µs par pas (si réveil corrigé par T10) ; roquette dans un mur : moins de 1,5 ms au pire pas ; tous dorment en moins de 6 s (avec repli T10).
- Qualité : meilleure.
- Garde-fous : l'allure des éboulements change → revoir checks/simulation.test.mjs:1927-1996 et renderer-destruction ; pièces élancées (cylindre 14 m, plaque 2 cm) : épaisseur collision 4 cm min, longueur plafonnée (destruction.js:216-220) ; 48 gravats d'un coup : pic de contacts, borner par gouverneur T14 ; le coût par pièce en mouvement est du même ordre qu'aujourd'hui (6,4-9,1 µs vs 8,2-9,2 µs), le gain est la qualité.
- Dépend de : T2, T3, T9, T10, T11.

### T13 — Étape D : contrôleur capsule, pousser, monter, saisir, lancer, bouclier [PHYS-10]
- Où : src/simulation.js:208-213, 260-273, 274-297, 336-360, 403-472, 785-797 ; src/physics.js (sweepCapsule, character)
- Quoi : FPhys.character({radius:0.28, height:1.8, step:0.42, slope:0.7}) avec move(pos, déplacement) → position, normale, corps d'appui, vitesse. Algorithme : balayage de capsule contre statiques et corps, glissement sur normale (3 itérations), montée de marche (essai haut-avant-bas), appui par balayage court vers le bas. Poussée bornée : impulsion min(m×v, 60) par pas ; le joueur perd de la vitesse (0 % sous m=15, 40 % entre 15-60, arrêt au-delà). On monte sur un corps si dessus à moins de 0,42 m ; on hérite de sa vitesse. La capsule est un obstacle cinématique pour les corps. move() et airMove() appellent le contrôleur ; lois de vitesse (FEEL-08/09) restent dans locomote. Ennemis : même contrôleur (rayon 0,38 ou 1,05 m). Saisir : E vise un corps à moins de 2,2 m, masse ≤ 40 ; contrainte souple 8 Hz, amortissement 1, point à 1,3 m devant caméra ; tir = lancer à 12 m/s ; E repose. Bouclier : phys.blast cône 45°, 2,15 m, impulsion 220.
- Preuve exigée : le joueur pousse une caisse de 30 sur 2 m en 1 s ; monte sur une caisse puis une pile de 2 ; ne traverse jamais un corps endormi ; caisse lancée à 12 m/s tue une machine légère ; ascenseur transporte joueur et caisse ; rejeu d'entrées identique ; aucun blocage par un objet de masse sous 60 ; coût sous 20 µs par acteur et par pas.
- Qualité : meilleure.
- Garde-fous : remplace le déplacement → tous les tests de collision, chute, ascenseur, tremplin à revoir (AGENTS.md) ; fusionner avec FEEL-08 et FEEL-09 en une seule réécriture ; un objet tenu ne sert jamais d'appui (anti-exploit) ; ennemis qui poussent peuvent se coincer → poussée bornée + repli navigation (T17) ; non prototypé (conception seule) ; PHYS-V1 est un prérequis strict (caisse poussée sur dalles jointives culbute à 90°).
- Dépend de : T2, T3, T5, T9.

### T14 — Budget CPU : coût fixe, détection spécialisée, gouverneur de réveil [PHYS-14]
- Où : src/physics.js (boucles de grille, test de paires, gouverneur) ; bancs/phys/micro.mjs, phases.mjs
- Quoi : (1) ne remettre à zéro que les cellules touchées au pas précédent (liste d'occupation) ; table de hachage dimensionnée sur les contacts du pas précédent ; sortie immédiate si 0 corps éveillé (5 µs) ; (2) tableaux du noyau en constantes de module ; (3) test boîte orientée contre boîte alignée spécialisé (9 produits en moins, axes de face directs) ; (4) déroulage des boucles sur 3 axes dans le test de paires. (5-6) Cellule 1 m pour corps sous 1 m ; données partagées par paire (optionnel, change le résultat). (7) Gouverneur : plafond 160 corps éveillés, les îles les plus lentes et éloignées sont endormies d'office (critère vitesse puis indice, jamais temps réel) ; n'endormir que des corps en contact. (8) Budget de naissance : 24 corps par pas max, les autres en file. (9) Compteurs exposés (éveillés, contacts, tests, temps par phase).
- Preuve exigée : node micro.mjs 400 120 1 → coût fixe sous 5 µs par pas (référence actuelle : 45-50 µs à l'échelle METAL) ; node phases.mjs rubble300 900 → tas de 300 sous 1,2 ms par pas sur machine calme ; jamais plus de 1,5 ms de physique par image en jeu avec le gouverneur ; hachages de determinism.mjs inchangés pour les points 1-4.
- Qualité : identique (points 1-4) ; meilleure (gouverneur).
- Garde-fous : points 5-8 changent les trajectoires → décider avant figeage des hachages ; gouverneur = filet de sécurité, la vraie borne est le réveil partiel (T10) ; mesures sous charge → refaire sur machine calme ; endormir d'office peut figer un objet en l'air → n'endormir que des corps en contact.
- Dépend de : T2.

### T15 — Étape C : les machines détruites se disloquent en pièces physiques [PHYS-09]
- Où : src/actors.js:16-17, 44-46 ; src/simulation.js:812-828, 881-887 ; src/effects.js:169-199
- Quoi : à la mort (damageEnemy, 818-824) : appeler FActors.build sur une copie vivante au LOD le plus bas ; garder les 6-10 pièces les plus volumineuses (16-24 pour un boss), fusionner les autres dans la plus proche ; chaque pièce → boîte FPhys (taille s, rotation→quaternion, matière métal, masse = volume×65 bornée 2-120). Vitesse initiale : vitesse ennemie + impulsion du coup fatal (direction tir×8 pour balle, souffle radial pour explosion) + 1-2 m/s vers l'extérieur (tiré de l'id) ; ω de 2-6 rad/s. Pièces rejoignent s.debris avec sourceId 'enemy:<id>'. Plafond 48 pièces d'épave, retrait des plus lointaines endormies. Boss : les 12 explosions appliquent phys.blast sur les pièces. Butin et score inchangés. Passer la liste de pièces par une fonction pure (pas de dépendance FActors depuis la simulation).
- Preuve exigée : une machine tuée produit N pièces dont le centre de masse part dans le sens du tir ; pièces dorment en moins de 5 s ; aller-retour sauvegarde identique ; kills et butin inchangés sur un scénario rejoué ; coût d'une mort sous 0,3 ms au pas de création ; jamais plus de 48 pièces ; aucune pièce dans un mur après 2 s.
- Qualité : meilleure.
- Garde-fous : pièces peuvent gêner le joueur ou l'IA → règle de masse de T11 ; 12 ennemis tués d'une roquette → 96 pièces demandées, d'où le plafond 48 et la fusion ; rendu : couleur et matière de l'acteur, sans émissif ; taille 4-6 Ko ; ne pas fusionner les épaves dans l'île d'un tas de gravats (réveil global, T10).
- Dépend de : T2, T12.

### T16 — Dégâts cinétiques et sons d'impact par matière [PHYS-12]
- Où : src/simulation.js:771-784, 812-828, 1018-1024 ; src/audio.js:483, 717 ; src/physics.js (events)
- Quoi : dans FPhys, après résolution, pour chaque paire avec vitesse d'approche > 1,2 m/s et cMax strictement positif (pas les contacts spéculatifs) : pousser {a, b, point, normale, impulsion, énergie = 0,5×masse réduite×v², matières} dans une liste bornée à 16 par pas, triée par énergie décroissante. Dans METAL : sons → debrisLand ou physImpact avec matière, masse, énergie, power = min(100, √énergie×2) ; timbre par paire de matières (métal/pierre clair, bois mat, baril résonant 90-140 Hz) ; limites : 1 son/corps/0,16 s, 6 par pas. Dégâts : choc corps-acteur, E > 150 → dégâts = min(60, √(E−150)×1,2) ennemi ; min(25, …) joueur avec 0,5 s d'immunité post-poussée/lâcher ; écrasement : corps ≥ 60 kg tombant à plus de 4 m/s tue une machine légère. Stun 0,25 s sur ennemi touché. Crédit kill au joueur s'il a tiré/poussé/lancé dans les 3 s.
- Preuve exigée : caisse de 30 lancée à 12 m/s inflige des dégâts à une machine légère (énergie 2 160 → 54 points) ; à 2 m/s (énergie 60) aucun dégât ; le joueur ne se blesse pas en poussant ; jamais plus de 6 sons par pas ; événements identiques d'une exécution à l'autre.
- Qualité : meilleure.
- Garde-fous : équilibrage → commencer bas, régler sur bancs de combat ; injustice possible (objet projeté par explosion ennemie) → plafond 25 ; mixage sous les priorités audio.js:717 ; synthèse des timbres 4-6 Ko côté audio.
- Dépend de : T7, T12.

### T17 — IA et navigation : obstacles, couverts et poussée par les ennemis [PHYS-13]
- Où : src/simulation.js:512-516, 1336, 1349-1377, 1383-1391, 1402-1433, 1445-1471
- Quoi : trois classes par masse/hauteur : légers (masse < 15 ou hauteur < 0,43 m) ignorés par la navigation, poussés en marchant ; moyens (15-60) → surcoût ×3 dans A* à l'endormissement, l'ennemi passe ailleurs ou pousse ; lourds (≥ 60 et ≥ 0,43 m) → cellules bloquées à l'endormissement, libérées au réveil. Mise à jour locale : seules les cellules de l'enveloppe et les arêtes croisées sont invalidées (prérequis : invalidation locale SIM-01/IA-02/LOAD-02). Un corps éveillé n'est jamais dans la grille ; évitement au contact + test phys.queryBox devant l'ennemi toutes les 0,2 s. Budget : 4 mises à jour locales par pas max. clearLane (1336) et sight interrogent phys.ray (objets cachent le joueur). cover() (1445-1461) peut retenir un corps lourd endormi. Baril explosif à moins de 3 m d'un ennemi en combat baisse la note de position.
- Preuve exigée : un ennemi contourne une pile de 3 caisses lourdes dans un couloir de 4 m ; traverse un tas de petits gravats en les poussant ; aucun ennemi immobile plus de 2 s contre un objet sur 60 s de combat scripté ; coût de navigation par pas inchangé à ±10 % avec 200 corps endormis.
- Qualité : meilleure.
- Garde-fous : dépend de l'invalidation locale (sans elle, chaque objet lourd qui s'endort relance toute la grille 37 000-44 000 cellules) ; le joueur peut enfermer les ennemis → ils poussent tout objet sous 60 kg et tirent sur les autres ; l'état de la grille se reconstruit à la restauration à partir des poses endormies, sans rien sérialiser de plus ; non prototypé.
- Dépend de : T7, T12, T13.

### T18 — Étape E : articulations, charges suspendues, passerelles, bascules [PHYS-11]
- Où : src/simulation.js:27, 298-316, 361-366 ; src/world.js:1340 ; src/physics.js (joints)
- Quoi : quatre articulations dans la même boucle que les contacts (contrainte souple) : rotule (3 lignes), charnière (5 lignes, limites par produits scalaires sans trig), câble (1 ligne, longueur min/max, inactive si détendu), soudure cassable (6 lignes). Chacune a une impulsion de rupture → suppression + événement. Sérialisation : liste des articulations vivantes et impulsions accumulées. Éléments générés (world.js) : charge suspendue (caisse 150 kg, câble 2-4 m, rupture à 40), passerelle (4-6 planches charnières, rupture 400), bascule, porte battante (−95° à +95°), pile retenue par cale destructible. Au plus 6 par monde, jamais sur le chemin obligatoire. Machines : rotules à rupture pour l'effondrement articulé (T15).
- Preuve exigée : pendule de 2 m garde sa longueur à 1 mm près sur 30 s ; chaîne de 6 maillons stable 10 s ; charge tombe quand le câble casse ; aller-retour sauvegarde identique ; coût d'une articulation inférieur à 3 points de contact ; aucune explosion numérique sur 60 s avec rapport de masses 10.
- Qualité : meilleure.
- Garde-fous : le critère « rapport 10 » n'est pas acquis (150 sur 4 caisses de 8 s'écroule à 2+1 itérations, tient à 4+2 ou 2 sous-pas, mais 4+2 coûte +51 %) → réserver les itérations supplémentaires aux îles avec articulation ; limiter à 6 maillons et rapport 10 ; toute modification de génération garde relais/sortie/objets accessibles ; IA ignore ces éléments au départ → placer hors chemins de patrouille ; non prototypé.
- Dépend de : T2, T15.

## Options désactivées par défaut
- *(aucune : aucun constat de ce lot n'a la qualité « dégradée »)*

## Écartés ou absorbés
- [PHYS-15] — Réutilisation BITUME/Point de rupture : les spécificités BITUME et Point de rupture sont exclues par l'arbitrage (« ignore ce qui parle de BITUME ou de Point de rupture, sauf comme source d'inspiration ») ; le dossier FERRO est absent de la machine ; les exigences génériques (worker, monde non borné, couches, Float32 optionnel) sont déjà intégrées dans la conception de T2 (PHYS-02). Le constat reste une liste de vérification pour une future session BITUME/Point de rupture, pas une tâche de ce lot.

## Décisions à confirmer par David
- Cadence 120 Hz × 1 vs 60 Hz × 2 : le contre-vérificateur mesure que 60 Hz × 2 endort le tas de 300 en 4,6 s contre 11,9 s (−71 % de CPU total), mais la pile de 10 reste à 85 mm/s à 5 s (contre 0,5 mm/s à 120 Hz) et 4 traversées sur 960 à 40 m/s. Valeur par défaut proposée : 120 Hz × 1 (stabilité de la pile et 0 traversée), réviser après correction du sommeil (T10).
- Densité d'accessoires physiques : 80-120 par monde (recommandé) ou 40-60 (prudent) ou 200+ (à vérifier sur mobile). Valeur par défaut proposée : 80-120, moitié en qualité basse.
- Épaves de machines : 48 pièces persistantes (recommandé) ou 96 sur ordinateur. Valeur par défaut proposée : 48, retrait des plus lointaines endormies.
- FPhys en module optionnel src/physics.js (aucun jeu ne le charge par défaut) vs incubation dans METAL sans export. Valeur par défaut proposée : module optionnel, API stabilisée après T7 et T12.

## Gains attendus du lot
Les objets réagissent aux tirs, explosions, au joueur et aux ennemis (demande « physique digne de Half-Life 2 », absente à 100 % aujourd'hui). Les empilements tiennent puis s'écroulent ; les gravats roulent, s'entassent et s'endorment sans se traverser ; les machines laissent une épave au sol. Mesuré sur prototype : 80-110 corps éveillés pour 1 ms par image en tas dense, 165 en objets épars ; monde endormi 5 µs par pas ; 0 traversée sur 960 tirs à 120 Hz ; restauration exacte (hachage identique). Le coût fixe de 45-50 µs par pas est ramené sous 5 µs (T14 point 1) ; le réveil par propagation (T10) borne le pire cas de 2 392 ms cumulées à moins de 60 ms par tir dans un tas. Taille nette estimée : +60 Ko de noyau, −8,2 Ko de code gravats supprimé, +12-18 Ko d'intégration (étape A), soit environ +65 Ko sur les 1 400 000 octets autorisés.

# Axe SAUT — SAUT — saut libre et élan (FEEL-08, FEEL-09) face aux niveaux générés, aux colliders, à l'IA et aux points de reprise

Origine : complément. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Prototype FEEL-08 + FEEL-09 appliqué en mémoire à src/simulation.js (dépôt METAL intact : git status vide, HEAD 673d6b2), chargé dans le domaine principal de Node. Saut mesuré : apex 0,961 m, 0,617 s en l'air, 4,69 m à 7,6 m/s ; arrêt 0,242 s sur 0,67 m.

Méthode. Un explorateur (bench/saut/explore.mjs) pilote les vraies fonctions du joueur (move, locomote, airMove, land, checkPad, checkPlayerBounds) : parcours en largeur d'états debout réels (cellules de 0,6 m), 16 directions, marche, chutes de rebord, propulseurs, ascenseurs, et sauts à 0 / 3,8 / 7,6 / 10,5 m/s. Les portes et ascenseurs s'ouvrent par stades de commandes activées ; un « raccourci » est un objet atteint à un stade plus bas qu'à pied.

Limites à connaître. Machine très chargée (charge 18 à 94). Les 21 mondes (18 v2 + 3 legacy) ont été explorés en mode confiné, mais chaque exécution a été coupée à 170 s : ce sont des bornes basses. Explorations complètes : 3 mondes, un par famille de décor (v2-00, v2-01, v2-02). Sans clip, les explorations sont coupées à 285 s : le nombre de culs-de-sac sans clip n'est pas établi. Seuls 20 perchoirs réels au total (6 + 9 + 5) ont pu être testés, pas 20 par monde. Le budget de 45 minutes a été largement dépassé.

Livrables.
- Hauteur de clip : aucune hauteur finie n'est fiable. Le clip de 2,4 m laisse sortir dans 14 mondes sur 21 (5 076 vols passent à 2,34 m ou plus au-dessus de la base du muret ; maximum 2,64 m). Avec un vrai clip, le joueur touche le mur jusqu'à 4,16 m au-dessus de la base (saut depuis une terrasse supérieure). Un mur réservé au joueur, sans plafond et lié au muret encore debout, donne 0 sortie, 0 raccourci, 0 cul-de-sac et 0 mort par saut sur les 3 mondes complets. Un plafond de zone n'est pas nécessaire.
- Portée verticale de la ruée : la laisser à 0,9 m (touche) et 0,65 m (départ). La parade verticale prototypée (1,7 m) n'apporte rien de mesurable ; les rusheurs tirent déjà à la place.
- Plafond de vitesse : garder 10,5 m/s. Il est atteint en 1 s environ, pas en 10 sauts. La vitesse seule ne dégrade ni le cache RCPU-01 ni la précision ennemie, qui est déjà nulle contre une cible en cercle dès 5,4 m/s.
- Profil legacy : identique bit à bit (digest par pas et hash d'instantané égaux sur 3 600 pas, sauts pressés dans les entrées).
- Tests à ajouter : non-sortie, non-raccourci, non-blocage, chute mortelle, reprise en bunny-hop, instantané en vol, identité legacy (SAUT-10).

Découverte hors saut : la 0.8.0 laisse déjà sortir à pied par les quais d'ascenseur, puis marcher sur les crêtes de murets (reproduit avec sim.step seul).

## Mesures

- **Saut du prototype (profil moderne)** : apex 0,961 m ; 0,617 s en l'air ; 4,69 m à 7,6 m/s ; impact 6,30 m/s ; arrêt au sol 0,242 s sur 0,67 m _(méthode : bench/saut/t0.mjs, sim.step à 60 Hz sur monde plat génération 6, prototype phys.mjs)_
- **Montée en vitesse en bunny-hop** : 10,5 m/s atteint en 1 s avec un strafe à 1,2 rad/s ; 8,7 m/s à 1 s puis 10,4 à 2 s à 3 rad/s ; période d'un bond 0,645 s (31 bonds en 20 s) _(méthode : t0.mjs, pilote strafe + lacet alterné à chaque atterrissage)_
- **Franchissements de murets, 21 mondes, mode confiné (bornes basses, coupé à 170 s)** : 1 120 574 vols franchissants sur 7 762 152 vols simulés ; 5 076 à 2,34 m ou plus au-dessus de la base du muret, dans 14 mondes sur 21 ; hauteur maximale 2,51 m (famille 0), 2,64 m (famille 1), 1,87 m (famille 2) _(méthode : explore.mjs <monde> JC limit=170, 7 processus ; out/log-*-JC.txt)_
- **Explorations confinées complètes (clip idéal)** : v2-00 : 23 090 états, 110 280 franchissements par saut, max 2,51 m ; v2-01 : 23 304 états, 30 986, max 2,64 m ; v2-02 : 26 030 états, 97 547, max 1,66 m. Partout : 0 cul-de-sac, 0 état coincé, stades de progression identiques à la marche confinée _(méthode : explore.mjs JC et WC (physique 0.8.0 confinée), comparaison des stades par objet)_
- **Sans clip (bornes basses, coupé à 285 s)** : états hors zone : v2-00 44 654 (41 012 sur le substrat) + 3 470 sur crêtes ; v2-01 47 430 (45 168) + 3 834 ; v2-02 31 720 (29 133). Raccourcis : 12 objets dans v2-00, 6 dans v2-01, 0 dans v2-02 _(méthode : explore.mjs J limit=285 fast=1 ; out/*-J-full.json)_
- **Clip réel de 2,4 m, monde v2-01 (coupé à 235 s)** : 3 502 franchissements par saut, au moins 42 217 états hors zone, 7 objets atteints au stade 1 au lieu de 2 (dont sortie et relais 0), 192 atterrissages en chevauchement d'un solide _(méthode : explore.mjs v2-01 J clip=2.4 ; out/v2-01-J-clip24.json)_
- **Clip réel sans plafond (explorations complètes)** : v2-00, v2-01, v2-02 : 0 état hors zone, 0 franchissement (saut ou marche), 0 cul-de-sac, 0 mort par saut, 0 état coincé, stades identiques à la marche confinée ; contacts du clip jusqu'à 4,16 m au-dessus de la base _(méthode : explore.mjs J clip=1000000 ; out/*-J-clipinf.json (134 s, 134 s, 193 s))_
- **Morts par saut, 21 mondes confinés** : 119 401 chutes mortelles, toutes sur le substrat (117 637 par saut) au seuil 7,75 ; 84 541 atterrissages de plus entre 6 et 7,75 m/s (mortels au seuil actuel) ; 0 mort sous le terrain, 0 chute dans le vide _(méthode : compteurs de explore.mjs (land, fatalFall, checkPlayerBounds réels))_
- **Règle de chute mortelle face au saut** : seuil 6 : saut sur place sur le substrat = mort, saut par-dessus le muret de 0,72 m depuis le sol = mort, pas dans le vide depuis 1,0 m = mort ; seuil 7,75 : ces trois cas survivent, saut depuis une caisse de 1,0 m = mort _(méthode : fatal.mjs, sim.step, prototype avec fatal=6 puis 7,75)_
- **Mouvement gelé sous un sol plus haut** : 100 966 / 95 991 / 84 379 gels par monde complet, tous contre un dénivelé de 1,1 m ou plus ; 82 gels à 0,42 m ou moins sur 7,76 M de vols ; contacts de tête 139 / 7 / 134 _(méthode : instrumentation de airMove dans phys.mjs, histogramme freezeHist)_
- **Sortie à pied dans la 0.8.0 non modifiée** : 39 à 65 franchissements à pied par monde (v2-01 : 39, v2-00 : 57, v2-02 : 65) ; 41 923 / 44 762 / 7 745 états hors zone dont 41 008 / 44 691 / 7 411 sans retour à pied ; reproduit : quai haut (2,7 ; 3,2 ; 18) vers crête (2,74 ; 1,0 ; 25,67) puis substrat (6,43 ; −0,25 ; 25,67), vivant _(méthode : explore.mjs W (physique d'origine) ; repro-wall2.mjs avec sim.step seul, 168 essais)_
- **Points de reprise, 60 s, monde v2-00** : course : 3 dus, 3 pris, retard 0 ; bonds avec saut au pas suivant : 3 pris, retard max 0,13 s ; bonds avec rebond dans land() : relais pris en vol à 13,2 s, sauvé à 23,6 s (10,4 s de retard), 6 fins de pas au sol sur 3 600 _(méthode : checkpoint.mjs, règle de game.js:94-97 et :238 rejouée sur les événements)_
- **Instantané pris en vol avec validAir de la 0.8.0** : en montée (airVY 4,2) : restore renvoie false ; en descente (airVY −4,13) : true _(méthode : checkpoint.mjs, snapshot puis restore sur une simulation neuve)_
- **IA contre joueur perché, mondes réels** : dégâts perché / sol : 0,98 (v2-00, 6 perchoirs), 0,85 (v2-04, 9), 0,93 (v2-08, 5) ; 3 perchoirs sur 20 réduisent les dégâts de plus de 30 % ; attente 27 / 20 / 26 % perché contre 22 / 17 / 21 % au sol ; 0 ruée dans les deux cas _(méthode : perch.mjs, 20 s par perchoir, joueur passif, simulations appariées perchoir / pied du perchoir)_
- **IA contre joueur perché, test contrôlé (4 rusheurs purs + 2 tireurs, 30 s)** : immobile : 564 dégâts au sol (32 ruées, 28 touches) contre 584 à 590 perché (0 ruée, 70 tirs) ; en strafe : 462 au sol contre 364 à 398 perché (−14 à −21 %) ; attente 44-46 % au sol, 57-61 % perché _(méthode : perch2.mjs et perch3.mjs, boîtes de 1,2 et 2,4 m, hauteurs 0,72 à 2,1 m)_
- **Parade prototypée (portée verticale 1,7 m + but ramené au pied)** : boîte de 1,2 m : 8 ruées, 4 touches (32 / 28 au sol) ; boîte de 2,4 m : 0 ruée ; en strafe : 3 ruées, 0 à 1 touche, dégâts 260 à 444 contre 364 à 398 sans parade _(méthode : perch2.mjs et perch3.mjs, colonnes « parade »)_
- **Précision ennemie selon la vitesse du joueur (6 ennemis, cercle de 14 m, 60 s)** : cercle continu : 0 touche sur 119 à 127 tirs à 5,4 / 7,6 / 10,5 m/s, avec ou sans saut ; zigzag au sol : 13,4 / 11,1 / 8,6 % ; zigzag en sautant : 5,8 / 7,0 / 6,7 % ; avec la borne ±11 d'IA-11 : 13,4 / 11,3 / 6,4 % _(méthode : aim.mjs, joueur déplacé cinématiquement, A/B borne ±6 contre ±11)_
- **Cache RCPU-01 (D = 1 m, θ = 8°) à haute vitesse** : reconstructions par seconde : 18,3 à 7 m/s, 17,9 à 7,6, 17,4 à 10,5 ; 26,7 à 29,3 à 300°/s ; upload 61,3 Ko/image contre 85,8 à 92,5 _(méthode : cache.mjs sur bench/rcpu/harness.mjs et proto.mjs, 900 images, monde camp:6, changement d'identité de la liste principale)_
- **Cache RCPU-01 avec marges élargies** : θ = 24° : 17,7 à 19,5 reconstructions/s à 300°/s, 1 411 statiques visibles contre 1 135 (+24 %) ; D = 2 m, θ = 16° : 17,9 à 19,7/s, 1 333 à 1 349 visibles _(méthode : cache.mjs, mêmes pilotes)_
- **Identité du profil legacy** : génération 5 : digest 3f029a37 des deux côtés, instantané a4f9cfdf ; génération 3 : e7ee46f7 et 37d7fff5 ; 0 saut exécuté ; témoin génération 6 : écart dès le pas 0, 80 sauts _(méthode : legacy.mjs, original et prototype en lockstep, 3 600 pas, saut pressé 3 pas sur 45)_

## Scripts de banc

- bancs/saut/lib.mjs
- bancs/saut/phys.mjs
- bancs/saut/t0.mjs
- bancs/saut/explore.mjs
- bancs/saut/explore2.mjs
- bancs/saut/runall.sh
- bancs/saut/batch2.sh
- bancs/saut/repro-wall2.mjs
- bancs/saut/fatal.mjs
- bancs/saut/checkpoint.mjs
- bancs/saut/perch.mjs
- bancs/saut/perch2.mjs
- bancs/saut/perch3.mjs
- bancs/saut/aim.mjs
- bancs/saut/cache.mjs
- bancs/saut/legacy.mjs
- bancs/saut/out

## Constats

### SAUT-01 — Le clip de 2,4 m laisse sortir dans 14 mondes sur 21 ; un mur joueur sans plafond, lié au muret debout, donne 0 sortie, 0 raccourci et 0 cul-de-sac
- sévérité critique · catégorie bug · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:242-251; src/simulation.js:258-262; src/simulation.js:317-323; src/simulation.js:334-357; src/world.js:112-116; src/world.js:477; src/world.js:1212-1221; src/world.js:1272-1291; src/destruction.js:174-176; checks/world.test.mjs:130-134

**Preuve.** Explorateur sur la vraie physique (bench/saut/explore.mjs).
- 21 mondes, mode confiné, coupé à 170 s (bornes basses) : 1 120 574 vols franchissent un muret sur 7 762 152 vols simulés. 5 076 passent à 2,34 m ou plus au-dessus de la base du muret, dans 14 mondes sur 21. Hauteur maximale : 2,51 m (v2-00, 03, 09, 12, 15, legacy-0), 2,64 m (v2-01, 04, 07, 10, 13, 16, legacy-1), 1,87 m (famille 2).
- Exemple v2-00 : sol 6,4 m, caisse à 7,1 m, perchoir à 8,0 m, saut à 10,5 m/s, passage à +2,51 m, atterrissage sur le rebord de roche (1,75 m) à 11,6 m.
- Clip réel de 2,4 m dans v2-01 (coupé à 235 s) : 3 502 franchissements par saut, au moins 42 217 états hors zone, 7 objets atteints un stade trop tôt (dont sortie et relais 0), 192 atterrissages en chevauchement d'un solide sur des crêtes.
- Clip réel sans plafond, explorations complètes de v2-00, v2-01 et v2-02 : 0 état hors zone, 0 franchissement, 0 cul-de-sac, 0 mort par saut, 0 état coincé, stades identiques à la marche confinée. Propulseurs et ascenseurs restent utilisables (aucun objet perdu).
- Avec ce clip, le joueur touche le mur jusqu'à 4,16 m au-dessus de la base du muret (saut depuis la terrasse à 6,4 m près d'un muret posé à 3,2 m).
- Perchoirs trouvés : 1 070 / 855 / 977 états debout à 0,6 m ou plus par monde complet, jusqu'à 2,1 / 2,0 / 2,2 m.

**Cause.** landingAt accepte le dessus de n'importe quel collider (:320) et blocked ignore toute boîte dont le dessus est sous les pieds + 0,06 m (:246). Les caisses, rochers et murets de 0,6 à 2,2 m forment des chaînes de perchoirs, et les terrasses à 3,2 et 6,4 m dominent les murets des niveaux inférieurs. Une hauteur de clip comptée depuis la base du muret ne peut couvrir ni l'un ni l'autre. La 0.8.0 veut de plus qu'un muret démoli soit une ouverture utilisable (world.js:1272) : un clip figé au chargement contredirait cette règle.

**Proposition.** Profil moderne seulement (Q défini), dans src/simulation.js.
1. À la création : clipIds = Set des destructibleId des meshes de world.outdoorBoundaries (world.meshes[b.mesh].destructibleId).
2. Dans actorBlocked(e,x,z,r,y), appelé par move() et airMove() : si e===p, pour chaque q de localSolids(x,z), si clipIds.has(q.destructibleId) et q.minY < y+1,8 et discBox(x,z,r,q), renvoyer true. Pas de test sur q.maxY : la hauteur est illimitée.
3. Ne pas modifier landingAt : le joueur ne peut plus entrer dans l'emprise, donc plus d'atterrissage sur une crête.
4. Les morceaux restants d'un muret entamé gardent leur destructibleId (destruction.js:175) : seule la partie debout bloque, la brèche reste ouverte comme en 0.8.0.
5. Aucune donnée de monde ni d'instantané ne change : empreinte et sauvegardes intactes.
Critère d'acceptation : sur les mondes v2 0, 1, 2 et legacy 0, 1, 2, l'explorateur avec sauts rend 0 état hors zone, 0 état sur crête, 0 cul-de-sac, et les mêmes stades que la marche confinée.

**Gain attendu.** 0 sortie au lieu de 31 720 à 47 430 états hors zone sans clip, et au lieu d'au moins 42 217 avec le clip de 2,4 m (v2-01). 0 raccourci, 0 cul-de-sac, 0 mort par saut. Mesuré sur 3 mondes complets, un par famille de décor.

**Risques.** - Une sauvegarde 0.8.0 où le joueur est déjà perché sur une crête le placerait dans le clip : à la restauration, ignorer le clip tant que le disque du joueur chevauche une boîte de clip.
- Mur invisible au-dessus d'un muret bas : un joueur perché à 2 m voit par-dessus sans pouvoir sauter. Prévoir un retour visuel ou sonore discret au contact.
- L'exploration est échantillonnée (cellules de 0,6 m, 16 directions, 4 vitesses d'appel) et complète sur 3 mondes seulement.
- Les ennemis ne sont pas concernés (e===p).
- Taille : environ 0,3 Ko.

**Vérifier par.** node bancs/saut/explore.mjs v2-01 J clip=1000000 fast=1 limit=280, puis comparer « objects » à la sortie du mode WC. Attendu : outside 0, onBoundary 0, crossingCount 0, deadEnds 0. Contre-épreuve : clip=2.4 doit montrer des sorties.

**Contre-vérification.** Preuve indépendante. J'ai implémenté la proposition réelle (clip par destructibleId via localSolids dans actorBlocked), alors que le prototype de l'agent mesurait des boîtes statiques : bench/saut-verif/verifA.mjs C. Sauts enchaînés vers un muret depuis le sol, 3 mondes : sans clip 82 sorties et 228 morts sur 350 essais (v2-00, muret 0,72 m), 340 morts sur 340 (v2-02, 0,94 m), 0 franchissement sur 310 (v2-01, 1,55 m) ; avec le clip 0 sortie, 0 mort, 0 fin sur crête partout. La brèche reste utilisable : sortie en 1,9 à 4,4 s de tir au pistolet et retour en 1,1 à 1,25 s, identiques avec et sans clip. Faisabilité vérifiée (verifA.mjs A, 9 mondes) : chaque muret a un destructibleId, exactement 1 collider par groupe, aucune emprise ne recouvre un sol praticable plus haut ; aucun vol de propulseur ne coupe un clip (marge mini 2,58 m, pads.mjs).

Corrections.
1. « 14 mondes sur 21 » = 2 familles de tracé sur 3 : le nombre de murets ne dépend que du stade (119 / 154 / 197, y compris pour les graines 7 et 1234). 20 des 21 explorations confinées sont coupées (11 500 à 16 000 états sur 23 000 à 26 000).
2. « 0 raccourci » n'est vrai que sans tirer : le clip suit le muret debout et le pistolet à munitions infinies l'ouvre en quelques secondes (voir SAUT-V1).
3. Une lamelle de 4 cm laissée par une coupe de balle garde le destructibleId et devient un mur infini (sliver.mjs : traversée en sautant sans clip, bloquée avec). À traiter avec SAUT-V2, ou n'appliquer le clip qu'aux morceaux d'au moins 0,12 m d'épaisseur.
4. Réserve de qualité : un mur invisible au-dessus d'un muret de 0,72 m contredit l'intention écrite de la 0.8.0 (world.js:1280-1281 « rather than an invisible wall », world.test.mjs:132 « invisible/unphysical boundary »). Retour visuel et sonore au contact obligatoire, et arbitrage de David souhaitable.
5. Sévérité : prérequis du saut plutôt que bug de la 0.8.0. P0 seulement parce que le saut est une demande explicite.

**Preuve corrigée.** verifA.mjs C (sim.step, proposition réelle) : v2-00 82 sorties + 228 morts / 350 sans clip, 0 / 0 avec ; v2-02 340 morts / 340 sans clip, 0 avec ; v2-01 0 franchissement / 310. Brèche au pistolet : sortie 1,87 à 4,4 s, retour 1,08 à 1,25 s, avec ou sans clip.

**Gain corrigé.** 0 sortie et 0 mort par saut contre un muret intact (3 familles de tracé). Ne ferme pas la sortie par brèche (2 à 6 s de pistolet).

### SAUT-02 — Sans confinement, le saut ouvre des raccourcis : 12 objets de progression atteints un stade trop tôt dans v2-00, 6 dans v2-01
- sévérité haute · catégorie bug · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:317-323; src/simulation.js:334-357; src/simulation.js:179-180; src/simulation.js:1931-1937; src/world.js:1272-1291

**Preuve.** Stade = ensemble des commandes activées ; un objet est classé au premier stade où il est atteignable.
- Référence (marche confinée, physique 0.8.0), v2-00 : stade 0 = salles 0, 3, 6, commandes 0 et 1, relais 2 ; tout le reste au stade 1.
- Sauts sans clip, v2-00 (coupé à 285 s, borne basse) : salles 1, 2, 4, 5 et 9 (arène du boss), relais 0 et 1, commande 2, ascenseur 0 (plateforme et deux appels) et atelier 2 sont atteints au stade 0. Tous passent par le substrat.
- v2-01 : salle 1 et ascenseur 0 au stade 0 au lieu de 1 ; haut de l'ascenseur 0, salle 7 et sortie au stade 1 au lieu de 2.
- v2-02 : aucun (ce monde n'a aucun verrou : tout est au stade 0 à pied).
- Sauts confinés ou clip sans plafond : 0 raccourci dans les 3 mondes.
- Le nombre de culs-de-sac sans clip n'a pas pu être établi (explorations coupées). Depuis le substrat, les murets de 0,94 m et 1,55 m ne se sautent pas (dessus à 1,19 m et 1,80 m au-dessus du substrat, pour 1,02 m franchissable).

**Cause.** Le substrat à −0,25 m couvre toute la carte et relie les cours à y = 0 entre elles. Une fois le muret sauté, les portes et ascenseurs entre ces cours ne conditionnent plus rien. En 0.8.0, ce contournement coûte une démolition ; avec le saut, il est gratuit dès le premier monde.

**Proposition.** 1. Appliquer SAUT-01 : c'est la seule variante mesurée sans raccourci.
2. Ajouter un outil tools/jump-reach.mjs repris de explore.mjs : il charge src/*.js dans le domaine principal, calcule les stades à pied confinés puis avec sauts, et échoue si un objet (salle, relais, commande, appel ou plateforme d'ascenseur, sortie, atelier) descend d'un stade. Coût mesuré : 60 à 190 s par monde sous forte charge, donc hors npm test.
3. Dans npm test, garder une version courte : 3 mondes (index 0, 1, 2), sauts lancés seulement depuis les états situés à moins de 7 m d'un muret, critère « aucun état hors zone ».

**Gain attendu.** 0 raccourci au lieu de 12 (v2-00) et 6 (v2-01). Le garde-fou reste valable quand le générateur change.

**Risques.** - Les ascenseurs sont modélisés par téléportation entre les deux niveaux, pas par un trajet réel.
- Les rencontres, épreuves de trophée et le boss ne sont pas modélisés comme verrous.
- Le test court ne couvre pas les chaînes de perchoirs loin des murets.

**Vérifier par.** explore.mjs <monde> WC puis J clip=1000000 : dictionnaires « objects » identiques. Sans clip (mode J) : la différence doit lister les objets cités.

**Contre-vérification.** Les sorties par saut sont confirmées (SAUT-01), et les fichiers out/*-J-full.json contiennent bien les objets au stade 0. Je n'ai pas rejoué le classement par stades.

La prémisse est surestimée. « En 0.8.0 ce contournement coûte une démolition » : cette démolition coûte 9 à 18 balles du pistolet de départ, à munitions infinies. Mesure sur la 0.8.0 non modifiée (bench/saut-verif/breach2.mjs, sim.step seul) : sortie vivante sur le substrat après 3 s de tir (v2-00 et v2-02) ou 6 s (v2-01, muret de 1,55 m). Le raccourci par le substrat existe donc déjà, et le clip de SAUT-01 ne le ferme pas.

Conséquences pour la proposition.
- Le critère « aucun objet ne descend d'un stade » doit préciser « sans tir », ou être accompagné d'une décision sur la brèche (SAUT-V1).
- L'outil tools/jump-reach.mjs reste utile comme garde-fou du générateur, hors npm test.
- Dans J-clip24 (v2-01), l'agent n'a pas relevé 46 culs-de-sac intérieurs (deadEndsInside) : argument de plus contre un clip de hauteur finie.

**Gain corrigé.** 0 raccourci sans tir. Avec tir, le contournement existe déjà en 0.8.0 pour 2 à 6 s de pistolet.

### SAUT-03 — La règle de chute mortelle sur le substrat se déclenche sur de simples sauts : la fonder sur la hauteur de chute, pas sur la vitesse d'impact
- sévérité haute · catégorie bug · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:324-333; src/simulation.js:138-144; src/simulation.js:385-390; src/simulation.js:6-8

**Preuve.** Code : land() tue si impact > 6 et que l'atterrissage se fait sur le substrat (src/simulation.js:328). Le commentaire :325-327 vise une chute de 1,5 m.
Mesures (fatal.mjs, sim.step, gravité 20 du prototype) :
- Seuil 6 conservé : saut sur place sur le substrat = mort (impact 6,30) ; saut par-dessus le muret de 0,72 m depuis le sol = mort ; pas dans le vide depuis 1,0 m = mort (7,07 m/s). La hauteur mortelle tombe de 1,5 m à 0,9 m.
- Seuil 7,75 proposé par FEEL-09 : ces trois cas survivent, mais sauter le muret depuis une caisse de 1,0 m tue. Par le calcul : mortel dès un appel situé à plus de 0,54 m au-dessus du substrat, soit une caisse de 0,3 m dans une cour à y = 0.
- Explorateur, 21 mondes confinés : 117 637 vols mortels par saut au seuil 7,75, plus 84 541 atterrissages entre 6 et 7,75 m/s.
- Aucune autre cause de mort : 0 sous le terrain, 0 chute dans le vide.

**Cause.** La vitesse d'impact additionne l'élan du saut (6,2 m/s) et la chute. Le seuil a été réglé pour une chute sans élan vertical. Se laisser tomber du mur de 0,72 m est sans danger ; sauter 30 cm plus haut tue.

**Proposition.** Profil moderne seulement.
1. Mémoriser fallFrom = hauteur des pieds à l'instant où le joueur quitte le sol (rebord, saut, perte d'appui). Pour un vol de propulseur, garder la règle actuelle.
2. Dans land() : mort si atterrissage sur le substrat et fallFrom − y > 1,5 m.
3. Ajouter fallFrom aux champs AIR de l'instantané sous physicsVersion 2 ; à la lecture d'un instantané v1 en vol, prendre fallFrom = y courant.
Résultats attendus : saut du muret depuis le sol (0,25 m) = vivant ; depuis une caisse de 1,0 m (1,25 m) = vivant ; chute d'une terrasse à 3,2 m = mort comme aujourd'hui.

**Gain attendu.** Plus aucune mort sur un saut de moins de 1,5 m de dénivelé. Avec SAUT-01, les 117 637 vols mortels mesurés disparaissent déjà (0 mort par saut dans les 3 explorations à clip sans plafond) ; cette règle couvre le cas restant, le saut à travers une brèche.

**Risques.** - La règle par hauteur n'a pas été prototypée : seul le défaut est mesuré.
- Format de sauvegarde : champ en plus sous physicsVersion 2.
- Tests existants de chute (checks/simulation.test.mjs:1642-1669) : à rejouer, la hauteur de 1,5 m est conservée.
- Le profil legacy garde impact > 6.

**Vérifier par.** fatal.mjs adapté : les cinq cas doivent donner vivant, vivant, vivant, vivant, vivant, et une chute de 3,2 m sur le substrat doit rester mortelle.

**Contre-vérification.** fatal.mjs rejoué : même tableau. Le défaut est plus grave qu'annoncé. Même au seuil 7,75, 65 % des enchaînements de sauts par-dessus le muret de 0,72 m tuent (228 / 350) et 100 % sur celui de 0,94 m (340 / 340) : le joueur se pose sur la crête, rebondit, puis tombe de 1,9 à 2,2 m sur le substrat (verifA.mjs C, sans clip).

Corrections à la proposition.
1. Aucun champ nouveau n'est nécessaire. La hauteur d'appel se déduit de l'état déjà sauvegardé : y0 = y − airVY·airTime − g·airTime²/2, puisque airTime est remis à 0 à chaque saut et à chaque départ de rebord. En cas de contact de tête, remettre airTime à 0 (la hauteur du choc sert alors de référence, plus sévère). Pas de physicsVersion 2, pas de changement de format.
2. Les tests de chute existants (simulation.test.mjs:1642-1669) utilisent fixture() sans generation, donc le profil legacy : non touchés.
3. Avec SAUT-01 la crête n'est plus atteignable, mais la règle reste nécessaire pour les sauts à travers une brèche et sur le substrat.
4. La règle par hauteur n'est pas prototypée : gain estimé, comme l'agent l'indique.

**Preuve corrigée.** Seuil 7,75, sauts enchaînés depuis le sol : 228 morts / 350 (0,72 m), 340 / 340 (0,94 m).

**Gain corrigé.** Plus de mort pour un dénivelé d'appel inférieur à 1,5 m, sans champ de sauvegarde supplémentaire.

### SAUT-04 — La 0.8.0 laisse déjà sortir à pied : chute du quai haut d'un ascenseur sur la crête d'un mur de quai, puis marche sur les murets
- sévérité moyenne · catégorie bug · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:317-323; src/simulation.js:209-214; src/world.js:470-499; src/world.js:112-116

**Preuve.** Physique d'origine, sans aucun saut (explore.mjs mode W, explorations complètes) :
- v2-00 : 57 franchissements à pied, 41 923 états hors zone, dont 41 008 sans retour à pied.
- v2-01 : 39 franchissements, 44 762 états hors zone, 44 691 sans retour.
- v2-02 : 65 franchissements, 7 745 états hors zone, 7 411 sans retour.
- Mode confiné avec le prototype : 4 à 443 franchissements à pied dans chacun des 21 mondes.
Reproduction avec sim.step seul (repro-wall2.mjs, monde v2-02) : départ sur le quai haut de l'ascenseur 0 en (2,7 ; 3,2 ; 18), sprint vers +z, strafe vers le mur après 24 pas en l'air. Le joueur se pose sur le mur de quai de 1 m en (2,74 ; 1,0 ; 25,67), puis marche jusqu'au substrat en (6,43 ; −0,25 ; 25,67), vivant et hors de toute zone dessinée.
Dans v2-00, le chemin trouvé descend les murs latéraux d'une rampe par paliers : 4,0, 3,3, 2,6, 2,0, 0,7 puis −0,25 m.
Les stades de progression restent identiques à la marche confinée dans les 3 mondes : pas de raccourci constaté par cette voie.

**Cause.** landingAt pose le joueur sur tout collider dont le disque de 0,28 m déborde, même de 1 cm. support() enchaîne ensuite les dessus de boîtes espacés de 0,43 m ou moins. Le bord du quai haut est ouvert quand la plateforme est en bas.

**Proposition.** SAUT-01 suffit : avec le clip sans plafond, les 3 explorations complètes donnent 0 franchissement à pied. Aucun changement supplémentaire. Ajouter ce cas au test de non-sortie (départ sur chaque quai haut, sprint vers la cage, strafe en l'air des deux côtés).

**Gain attendu.** 0 sortie à pied au lieu de 39 à 65 franchissements par monde. Les 7 411 à 44 691 états sans retour ne sont plus accessibles sans démolition.

**Risques.** - Le clip n'existe que pour le profil moderne ; tous les mondes générés l'utilisent (génération 6).
- Après démolition d'un muret, le substrat reste accessible : c'est voulu, et la brèche sert de retour.

**Vérifier par.** repro-wall2.mjs avec le correctif : aucun essai ne doit finir hors zone. explore.mjs <monde> W avec clip : walkCrossings 0.

**Contre-vérification.** repro-wall2.mjs rejoué sur la 0.8.0 non modifiée : quai haut (2,7 ; 3,2 ; 18), crête (2,74 ; 1,0 ; 25,67), substrat (6,43 ; −0,25 ; 25,67), vivant. La fenêtre est étroite : 1 réussite sur 168 essais du script, mais l'explorateur en trouve 39 à 65 par monde.

Nuances.
- « Sans retour à pied » n'est pas un blocage définitif : le pistolet rouvre un muret en 2 à 6 s (breach2.mjs).
- Aucun raccourci par cette voie (stades identiques) : gêne faible aujourd'hui.
- Corrigé gratuitement par SAUT-01 (walkCrossings 0 dans les trois out/*-J-clipinf.json). Ne pas en faire un chantier séparé ; ajouter seulement le cas au test de non-sortie.
- Risque confirmé : une sauvegarde 0.8.0 prise debout sur une crête place le joueur dans le clip. Ignorer le clip tant que le disque du joueur chevauche une boîte de clip.

### SAUT-05 — Points de reprise : faire partir le saut tamponné au pas suivant ; un rebond dans land() retarde la reprise de 10,4 s et un instantané en montée est illisible
- sévérité haute · catégorie bug · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/game.js:94-97; src/game.js:238; src/game.js:690-695; src/simulation.js:324-333; src/simulation.js:336; src/simulation.js:403-407; src/simulation.js:2088-2093; src/simulation.js:1946

**Preuve.** Règle rejouée telle quelle (game.js:94-97 et :238) sur 60 s dans v2-00, même trajet (checkpoint.mjs) :
- Course : 3 reprises dues (2 commandes, 1 relais), 3 prises, retard 0.
- Bonds, saut tamponné déclenché au début du pas suivant : 3 prises ; le relais pris en vol à 13,2 s est sauvé à 13,33 s (0,13 s). 99 fins de pas au sol pour 96 sauts.
- Bonds, rebond exécuté dans land() : le même relais n'est sauvé qu'à 23,6 s, soit 10,4 s de retard. 6 fins de pas au sol sur 3 600. Le retard n'a pas de borne tant que la chaîne de bonds continue.
- Avec une échéance de 1,5 s et un instantané forcé en vol : sauvé à 14,7 s, mais restore() refuse un instantané pris en montée (airVY 4,2 : false) et accepte en descente (−4,13 : true).
Code : validAir exige airVY ≤ 0,001 hors propulseur (src/simulation.js:2092).
Par ailleurs, la boucle d'airMove s'arrête à l'atterrissage et le reste du pas est perdu : un bond dure 0,645 s pour 0,617 s de vol (31 bonds en 20 s), soit 4,3 % du temps.

**Cause.** game.js ne regarde l'état du joueur qu'en fin de pas. Si le rebond se fait dans le sous-pas d'atterrissage, le joueur n'est jamais vu au sol. Un instantané pris en vol au-dessus d'une chute mortelle créerait en plus une boucle de mort à la reprise.

**Proposition.** 1. Dans land() : poser le joueur, garder la vitesse horizontale, ne pas relancer le saut.
2. Consommer le reste du pas au sol, sans friction si un saut est en tampon (aujourd'hui ce reste est perdu).
3. Déclencher le saut tamponné au début du locomote suivant, avant toute friction : le joueur est au sol à chaque fin de pas d'atterrissage.
4. Garder game.js:94-97 tel quel : pas d'échéance, pas d'instantané en vol.
5. physicsVersion 2 : accepter 0 < airVY ≤ 6,2 avec padId null dans validAir, uniquement pour qu'un instantané pris par un autre chemin (achat en boutique, fin de monde) reste lisible ; remettre tampon et délai de grâce à zéro à la restauration.
Critère : en 60 s de bonds continus, chaque reprise due est prise en moins de 0,7 s.

**Gain attendu.** Retard de reprise en bunny-hop : 0,13 s au lieu de 10,4 s (mesuré). Environ 4 % de temps de bond récupéré en consommant le reste du pas (estimé d'après la période mesurée).

**Risques.** - Mesure sur un seul monde et un seul trajet ; le pilote saute sans strafe (7,6 m/s).
- La consommation du reste du pas n'a pas été prototypée.
- Tests checkpoint existants : ajouter le cas en bunny-hop, ne pas modifier les autres.
- Déterminisme : le tampon de saut et le délai de grâce sont des états nouveaux ; les remettre à zéro à la restauration.

**Vérifier par.** checkpoint.mjs : la ligne « bhop » doit donner saves = dues, maxDelay ≤ 0,7, pendingAtEnd false. Test d'instantané : snapshot en montée puis restore doit renvoyer true sous physicsVersion 2.

**Contre-vérification.** checkpoint.mjs rejoué : chiffres identiques (retard 0,13 s contre 10,4 s, 99 contre 6 fins de pas au sol, restore false en montée et true en descente). Code relu : events() est appelé après chaque sim.step (game.js:692-693) et le test de :238 est donc fait à chaque pas, même à 30 images par seconde. Le reste du pas est bien perdu à l'atterrissage (break de la boucle d'airMove).

Corrections.
1. Sévérité moyenne, pas haute : le retard de 10,4 s concerne une variante d'implémentation (rebond dans land()) que ni la 0.8.0 ni le texte de FEEL-09 n'imposent. C'est une consigne de conception à donner à Codex.
2. Le point 5 est à retirer. sim.snapshot() n'a qu'un seul appelant dans game.js (:98), derrière la garde airborne (:96) : il n'existe pas d'« autre chemin » (boutique, fin de monde). Aucun instantané en vol n'est jamais pris par le jeu. Ne pas toucher à validAir ni à physicsVersion : les sauvegardes restent compatibles.
3. Le prototype garde velocityX/Z à l'atterrissage mais stopMotion() remet locomotion.speed à 0 (visible dans t0.mjs : échantillon à 0,0). Caméra, pas et son verraient une vitesse nulle à chaque bond : conserver aussi les champs de locomotion.
4. La consommation du reste du pas (environ 4 %) n'est pas prototypée et touche l'invariance de cadence : à livrer avec le test à 20, 60 et 120 images par seconde.

**Gain corrigé.** Reprise en moins de 0,2 s en bunny-hop avec le saut déclenché au pas suivant (mesuré 0,13 s), sans changement du format de sauvegarde.

### SAUT-06 — IA contre joueur perché : la ruée est annulée dès 0,72 m, mais les dégâts ne baissent que de 0 à 21 % ; ne pas toucher à la portée verticale
- sévérité moyenne · catégorie ia · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P3 · qualité sans objet · jeu
- lieux : src/simulation.js:1260-1269; src/simulation.js:1266; src/simulation.js:1782; src/simulation.js:1402-1405; src/simulation.js:1434-1439

**Preuve.** Mondes réels (perch.mjs, 20 s, joueur passif, perchoir contre pied du perchoir) : dégâts perché / sol = 0,98 (v2-00, 6 perchoirs), 0,85 (v2-04, 9), 0,93 (v2-08, 5). 3 perchoirs sur 20 réduisent les dégâts de plus de 30 %. Part d'attente des ennemis : 27 / 20 / 26 % perché contre 22 / 17 / 21 % au sol. Aucune ruée, ni perché ni au sol : les 17 à 56 rusheurs purs par monde arrivent tous en renfort, aucun n'est déployé au départ.
Test contrôlé (perch2.mjs, 4 rusheurs purs + 2 tireurs, 30 s) :
- Joueur immobile : 564 dégâts au sol (32 ruées, 28 touches, 31 tirs) contre 584 à 590 sur une boîte de 0,72 à 2,1 m (0 ruée, 70 tirs).
- Joueur en strafe (±0,8 m, période 1,2 s, perch3.mjs) : 462 au sol contre 364 à 398 perché, soit −14 à −21 %.
- Attente : 44-46 % au sol, 57-61 % perché.
Parade prototypée (départ et touche jusqu'à 1,7 m, but ramené au pied) : 8 ruées et 4 touches sur une boîte de 1,2 m, 0 sur 2,4 m ; en strafe 3 ruées, 0 à 1 touche, dégâts 260 à 444 contre 364 à 398. Aucun gain mesurable.

**Cause.** La ruée ne part que si la cible est à moins de 0,65 m de dénivelé (:1266) et que le segment jusqu'à elle est libre ; un perchoir bloque les deux. Le rusheur tire alors un projectile de 14 points à 5,5 m/s. route() refuse d'emblée un but situé dans un collider (:1404) : les ennemis restent sur place.

**Proposition.** 1. Laisser la portée verticale à 0,9 m (touche) et 0,65 m (départ) : l'élargir n'apporte rien.
2. Appliquer IA-08 (but ramené à la cellule libre la plus proche) pour faire baisser la part d'attente : cible 45 % au lieu de 57-61 % dans perch2.mjs.
3. Traiter les perchoirs larges par la grenade de débusquage d'IA-10 : déclenchement quand le joueur reste plus de 3 s à 0,65 m ou plus au-dessus du sol de l'ennemi qui le voit.
4. Rendre les projectiles de repli crédibles avec SAUT-07.
Critère : dans perch3.mjs, dégâts perchés ≥ 85 % des dégâts au sol pour toutes les hauteurs.

**Gain attendu.** Objectif « aucun perchoir ne réduit les dégâts de plus de 30 % » : déjà tenu dans le test contrôlé (−21 % au pire) et sur 17 perchoirs réels sur 20. Le gain attendu porte sur l'attente (57-61 % vers 45 %), non mesuré.

**Risques.** - 20 perchoirs réels au total, et non 20 par monde : peu de perchoirs sont à 5-18 m d'ennemis déployés.
- Joueur passif ou déplacé cinématiquement ; un joueur qui tire depuis le perchoir n'a pas été mesuré.
- Les rusheurs réels n'ont été vus qu'en test contrôlé.
- La grenade d'IA-10 n'a pas été prototypée.

**Vérifier par.** perch2.mjs et perch3.mjs (colonnes base) avant et après ; perch.mjs v2-00,v2-04,v2-08 20 20 : au plus 3 perchoirs sur 20 sous 70 %.

**Contre-vérification.** perch2.mjs rejoué : chiffres identiques. Code vérifié : départ de ruée à moins de 0,65 m de dénivelé (:1266), touche à moins de 0,9 m (:1782), route() refuse un but dans un collider (:1404).

Précision : immobile, le joueur perché prend plus de dégâts qu'au sol (584 à 590 contre 564), parce que les rusheurs tirent 70 fois au lieu de 31. Le perchoir n'est donc pas une faille.

La partie utile du constat est « ne rien changer à la portée verticale ». Les points 2 à 4 renvoient à IA-08, IA-10 et SAUT-07, non prototypés ici : leur priorité est celle de ces constats. La base réelle est mince (20 perchoirs, joueur passif, aucune ruée observée en monde réel).

### SAUT-07 — Précision ennemie : 0 touche contre une cible en cercle dès 5,4 m/s ; élargir la borne de vitesse (IA-11) ne change rien, il faut un calcul d'interception
- sévérité moyenne · catégorie ia · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P3 · qualité sans objet · jeu
- lieux : src/simulation.js:1322; src/simulation.js:1795-1796; src/simulation.js:1242-1259; src/simulation.js:1263-1267

**Preuve.** aim.mjs : 6 ennemis (3 tireurs, 2 rafaleurs, 1 rusheur), joueur déplacé sur un cercle de 14 m, 60 s.
- Cercle continu : 0 touche sur 127 / 121 / 119 tirs à 5,4 / 7,6 / 10,5 m/s, au sol comme en sautant.
- Zigzag (demi-tour toutes les 1,2 s), au sol : 13,4 / 11,1 / 8,6 % de touches ; en sautant : 5,8 / 7,0 / 6,7 %.
- Borne de vitesse observée portée de ±6 à ±11 (proposition IA-11) : 13,4 / 11,3 / 6,4 % au sol, 5,8 / 5,2 / 6,3 % en sautant. Pas mieux, parfois pire.
Code : projectiles à 7,2 m/s (tireur), 5,5 (rusheur), 7,7 (rafale) (src/simulation.js:1263-1267 et :1257) ; avance = min(0,65 ; d/14) seconde (:1795).

**Cause.** Les projectiles sont plus lents que le joueur (5,5 à 7,7 m/s contre 7,6 à 10,5). À 14 m, le temps de vol est de 1,8 à 2,5 s, alors que l'avance est plafonnée à 0,65 s. Le défaut existe déjà à la vitesse de marche de la 0.8.0 : le saut et le bunny-hop ne l'aggravent pas contre un strafe continu.

**Proposition.** 1. Remplacer l'avance fixe par une interception : résoudre |P + V·t − S| = v·t (second degré), t borné à 2,5 s, avec la vitesse observée bornée à ±11.
2. Si t dépasse 1,2 s, l'ennemi se rapproche au lieu de tirer (but de navigation vers la cible).
3. Si la cible est en l'air, viser le point de chute : gravité 20, sol sous la trajectoire.
4. Régler ensuite la vitesse des projectiles de rafale (12 à 14 m/s) comme option d'équilibrage.
Critère : dans aim.mjs, 8 à 15 % de touches contre le cercle à 7,6 m/s, et pas plus de touches qu'aujourd'hui contre une cible immobile.

**Gain attendu.** De 0 % à environ 10 % de touches contre un joueur en strafe continu (cible de réglage, non prototypée). Les tirs redeviennent une menace à esquiver.

**Risques.** - Équilibrage : les tests de campagne (tools/campaign-balance.mjs, checks/boss-progression.test.mjs) devront être rejoués.
- L'interception n'a pas été prototypée ; seule l'inefficacité de la borne ±11 est mesurée.
- Monde plat sans couvert : en niveau réel, les murs réduisent encore les touches.
- Déterminisme inchangé (calcul fermé).

**Vérifier par.** aim.mjs : tableau avant et après, mêmes 12 lignes.

**Contre-vérification.** aim.mjs rejoué : tableau identique (0 touche sur 119 à 127 tirs en cercle, aux trois vitesses). Code vérifié : borne ±6 (:1322), avance min(0,65 ; d/14) (:1795), projectiles à 7,2 et 5,5 m/s (:1263, :1267).

Résultat utile et solide : élargir la borne à ±11 (dernière puce de FEEL-08, IA-11) n'apporte rien (13,4 / 11,3 / 6,4 % contre 13,4 / 11,1 / 8,6 %). Cette puce peut être retirée du lot.

Réserves.
- Le défaut existe déjà en 0.8.0 (0 touche à 5,4 m/s) : le saut ne l'aggrave pas.
- Le cercle de 14 m sur terrain plat est le pire cas ; en zigzag les ennemis touchent 6 à 13 %.
- L'interception n'est pas prototypée et durcit le jeu, alors que David trouve déjà que le bouclier protège mal. C'est un réglage d'équilibrage à trancher en jeu, avec rejeu de tools/campaign-balance.mjs, pas une amélioration de fluidité.

**Gain corrigé.** Aucun gain mesuré. La seule conclusion ferme est négative : la borne ±11 est inutile.

### SAUT-08 — Cache à marge RCPU-01 : sans effet à 10,5 m/s, mais +46 à +60 % de reconstructions à 300°/s ; marge angulaire adaptative
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1545-1547; src/renderer.js:1408-1413; src/renderer.js:1435-1436

**Preuve.** cache.mjs sur la vraie chaîne FRender.create / setWorld / draw (WebGL2 factice, bench/rcpu/harness.mjs, prototype proto.mjs), 900 images, monde camp:6, pilote « tour ». Comptage déterministe des changements d'identité de la liste statique principale (le pilote tire et détruit : les révisions de destruction sont comprises).
- D = 1 m, θ = 8° : 18,3 reconstructions/s à 7 m/s, 17,9 à 7,6 m/s, 17,4 à 10,5 m/s (lacet 69°/s en crête).
- Même réglage, lacet 300°/s en crête : 26,7/s ; 300°/s en moyenne : 29,3/s. Upload 61,3 Ko/image contre 85,8 et 92,5.
- θ = 24° : 17,7 et 19,5/s à 300°/s ; upload 76,1 et 82,0 Ko ; 1 411 statiques visibles contre 1 135 (+24 %).
- D = 2 m, θ = 16° : 17,9 et 19,7/s ; 1 349 et 1 333 visibles (+18 %).
Les temps de draw relevés sont inexploitables (charge machine).

**Cause.** La liste en cache reste valable tant que l'œil a bougé de moins de D et tourné de moins de θ. À 300°/s, 8° sont consommés en 27 ms, soit moins de 2 images à 60 Hz. La translation à 10,5 m/s ne compte pas : la rotation et les révisions de destruction dominent déjà.

**Proposition.** Dans le cache de RCPU-01 (FERRO, renderer.js) :
1. Mesurer la vitesse de lacet lissée sur 4 images.
2. À chaque reconstruction, choisir θ = clamp(0,08 s × |ω|, 8°, 24°) : 8° sous 100°/s, 24° à 300°/s.
3. Garder D = 1 m.
4. Exposer la marge par renderer.configure({cacheTurnMax}) avec 24° par défaut, pour BITUME (rotations lentes) et Point de rupture (caméra RTS).
L'image reste identique : la liste en cache est un sur-ensemble conservateur, découpé ensuite par le GPU ; le contrôle de sur-ensemble d'ab.mjs s'applique à toute valeur de θ.

**Gain attendu.** À 300°/s : 17,7 à 19,5 reconstructions/s au lieu de 26,7 à 29,3 (−34 %), upload −11 %. Coût : +24 % d'instances statiques soumises pendant les rotations rapides seulement.

**Risques.** - La variante adaptative elle-même n'a pas été prototypée : les deux extrêmes (8° et 24°) sont mesurés.
- +24 % d'instances pendant les rotations rapides : coût GPU à vérifier avec bench/rgpu.
- Un seul monde mesuré.
- Compatibilité FERRO : option avec valeur par défaut, un jeu v0.2 marche sans réglage.

**Vérifier par.** node bancs/saut/cache.mjs 900 6 avec la variante adaptative : au plus 20 reconstructions/s sur les pilotes à 300°/s, et au plus 18,5/s sur le pilote de référence. bench/rcpu/ab.mjs : 0 entrée manquante.

**Contre-vérification.** cache.mjs rejoué (900 images, monde 6) : comptages identiques au dixième près (18,3 / 17,9 / 17,4 puis 26,7 / 29,3 par seconde ; 17,7 / 19,5 avec θ = 24°).

Réserves.
1. Le cache RCPU-01 n'existe pas encore dans FERRO ni dans METAL : c'est un prototype (bench/rcpu/proto.mjs). Les lignes citées de renderer.js sont l'endroit où il irait. Ce constat règle une optimisation non livrée.
2. Le plancher d'environ 17 à 18 reconstructions par seconde ne dépend ni de θ ni de D au pilote de référence (18,3 avec θ = 8°, 18,2 avec θ = 24°). Autre chose invalide le cache 18 fois par seconde, sans doute les révisions de destruction du pilote qui tire. Le levier principal est là, pas dans la marge angulaire.
3. La marge adaptative ne ramène que le cas 300°/s au plancher (−9 reconstructions par seconde). Un lacet de 300°/s ne dure qu'un demi-tour, soit 0,6 s. La variante adaptative n'est pas prototypée.
4. +24 % d'instances statiques soumises pendant les rotations rapides : coût GPU non mesuré, au moment où la stabilité compte le plus.
5. Image identique : plausible (sur-ensemble conservateur), non vérifiée par différence d'images.

**Gain corrigé.** −34 % de reconstructions pendant les lacets soutenus à 300°/s seulement ; aucun effet au pilote de référence.

### SAUT-09 — Physique 2,5D : aucun blocage, aucune traversée ni chute sous le terrain sur 7,76 millions de vols ; pas de marche d'escalier aérienne à ajouter
- sévérité basse · catégorie ressenti · effort S · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité sans objet · jeu
- lieux : src/simulation.js:126-137; src/simulation.js:317-323; src/simulation.js:343-354; src/simulation.js:145-152; src/simulation.js:391-394

**Preuve.** Explorateur, 21 mondes confinés plus 3 explorations à clip sans plafond :
- 0 atterrissage en chevauchement d'un solide, 0 mort « sous le terrain », 0 chute dans le vide, 0 vol sans fin.
- Mouvement horizontal annulé par un sol plus haut (src/simulation.js:353-354) : 100 966 / 95 991 / 84 379 fois par monde complet, toujours contre un dénivelé de 1,1 m ou plus (terrasses, rampes vues de côté). 82 cas seulement à 0,42 m ou moins sur 7 762 152 vols.
- Contacts de tête : 139 / 7 / 134 par monde complet, tous traités par le test des solides, portes, pièges et ascenseurs (:345-346).
- Le joueur ne peut pas se trouver sous une dalle : ground() rend le sol plat le plus haut et l'entrée dans son emprise est refusée tant que les pieds sont plus bas. La caméra ne traverse donc aucune dalle par ce chemin.
Seule exception relevée : 192 atterrissages en chevauchement d'un solide avec le clip de 2,4 m, sur des crêtes de murets (voir SAUT-01).

**Cause.** Le modèle garde un invariant simple : le centre du joueur est toujours au niveau du sol le plus haut ou au-dessus. Le saut ne le rompt pas. Les dénivelés générés sont soit des marches de 0,42 m ou moins, soit des terrasses de 1,6 m ou plus : presque rien entre les deux.

**Proposition.** Ne rien changer aux lignes :343-354. Ne pas ajouter de montée de marche en vol : 82 cas sur 7,76 millions ne la justifient pas. Conserver ces compteurs comme test de non-régression (SAUT-10) : 0 état coincé, 0 mort hors chute sur substrat.

**Gain attendu.** Aucun gain attendu : le risque annoncé (déplacement gelé, caméra dans une dalle) est écarté par la mesure.

**Risques.** - Exploration échantillonnée, sans destruction ni gravats : un tas de gravats peut créer d'autres perchoirs et d'autres dénivelés.
- Pièges à dalle mobile et ascenseurs en mouvement non explorés (ascenseur modélisé à l'arrêt, aux deux niveaux).

**Vérifier par.** explore.mjs <monde> JC : stat.stuck 0, stat.deaths.beneath 0, stat.deaths.void 0, stat.frozenNear inférieur à 30.

**Contre-vérification.** Agrégats recalculés depuis les 21 fichiers out/*-JC.json : stuck 0, morts « beneath » 0, « void » 0, frozenNear 82. Je n'ai pas refait d'exploration. Mes 1 000 essais de sauts contre des murets (verifA.mjs C) n'ont montré aucune anomalie de collision.

Réserves.
- 20 explorations sur 21 sont coupées, à peu près à mi-parcours.
- Sans destruction ni gravats, sans ascenseur en mouvement ni piège à dalle : limites déjà signalées par l'agent.
- Le gel met la vitesse d'un axe à 0 au premier contact avec un sol plus haut (:353-354). Contre un rebord oblique, le joueur perd tout son élan au lieu de glisser. Ce n'est pas un blocage, mais c'est un point de ressenti à juger en jeu.

Conclusion « ne rien changer » acceptable.

### SAUT-10 — Tests à ajouter avant de livrer le saut, et preuve que le profil legacy reste identique
- sévérité haute · catégorie outillage · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/simulation.js:95; checks/simulation.test.mjs:546-606; checks/world.test.mjs:130-134; checks/checkpoint.test.mjs:446-478; src/simulation.js:2088-2093

**Preuve.** Identité legacy (legacy.mjs) : simulation d'origine et prototype en lockstep sur 3 600 pas, avec le saut pressé 3 pas sur 45, des esquives et des tirs.
- Monde génération 5 (profil legacy, mode avancé) : digest par pas 3f029a37 des deux côtés, hash d'instantané a4f9cfdf des deux côtés, 0 saut exécuté.
- Monde génération 3 : e7ee46f7 et 37d7fff5 des deux côtés.
- Témoin génération 6 (profil moderne) : écart dès le pas 0, 80 sauts.
Le digest couvre position, lacet, vie, vitesses en l'air, esquive, chaleur, ennemis, balles, vitesse de locomotion et noms d'événements.
Aucun test actuel ne couvre le saut : checks/world.test.mjs:130-134 exige seulement des murets de 0,7 m ou plus.

**Cause.** Le prototype n'agit que si motionProfile.q existe, donc seulement pour le profil moderne. Les tests existants ont été écrits pour un jeu sans saut.

**Proposition.** Tests à écrire (checks/jump.test.mjs, chargés comme les tests actuels) :
1. Identité legacy : reprise de legacy.mjs, digests et hash égaux sur 3 600 pas avec saut pressé.
2. Non-sortie : mondes v2 0, 1, 2 ; depuis les états à moins de 7 m d'un muret et depuis chaque quai haut, sauts à 7,6 et 10,5 m/s dans 16 directions ; aucun état hors des sols dessinés, aucun état sur une crête.
3. Brèche : après démolition d'un muret, le passage au substrat et le retour doivent réussir.
4. Non-blocage : après chaque atterrissage, blocked() est faux à la position du joueur ; aucune mort autre qu'une chute de plus de 1,5 m sur le substrat.
5. Chute mortelle : les cinq cas de fatal.mjs plus la chute de 3,2 m.
6. Reprise en bunny-hop : 60 s de bonds, chaque reprise due prise en moins de 0,7 s.
7. Instantané en vol : snapshot en montée puis restore renvoie true (physicsVersion 2) ; un instantané v1 reste lisible.
8. Invariance de cadence : même trajet sauté à 20, 60 et 120 images par seconde, écart inférieur à 0,05 m.
Hors npm test : tools/jump-reach.mjs (SAUT-02) pour le non-raccourci par stades.

**Gain attendu.** Le changement le plus risqué du premier tour devient vérifiable à chaque modification du générateur ou de la physique.

**Risques.** - Durée : les tests 2 et 4 doivent rester sous 10 s chacun dans le bac à sable node:vm des tests (4,5 à 9 fois plus lent que le domaine principal) ; limiter aux états proches des murets.
- Le test 8 dépend de la consommation du reste du pas (SAUT-05).

**Vérifier par.** node bancs/saut/legacy.mjs : colonne « identique » à true pour les deux mondes legacy.

**Contre-vérification.** legacy.mjs rejoué : digests et hash identiques (3f029a37 / a4f9cfdf, e7ee46f7 / 37d7fff5), témoin divergent dès le pas 0.

La preuve est vraie mais presque tautologique, et elle ne protège pas ce qu'on croit.
- Tous les patchs sont conditionnés par motionProfile.q : l'identité legacy découle de la construction.
- Tous les mondes générés sont en generation 6 (world.js:653). Le profil legacy ne sert qu'aux fixtures écrites à la main (fixture() de simulation.test.mjs, sans generation). Les « legacy-0/1/2 » de l'agent sont des mondes hors campagne, donc en profil moderne.
- Les tests sur mondes générés ou avec progression (campaign-simulation 16, progression 23, checkpoint 37, boss-progression 7, armor 12) tournent en profil moderne. Marche 5,4 vers 4,2, friction et gravité 20 les toucheront. Cet impact n'est pas chiffré : il faut rejouer la suite complète sur une copie avec le prototype avant de livrer.

Liste de tests à corriger.
- Retirer le test 7 (instantané en montée, physicsVersion 2) : voir SAUT-05.
- Ajouter : rebond sur crête puis chute (SAUT-03), brèche avec lamelle (SAUT-V2), sortie par brèche au pistolet (SAUT-V1).
- Le test 2 doit tourner sur un monde par stade : 3 mondes suffisent, les tracés ne dépendent que du stade.

### SAUT-11 — Plafond de vitesse : 10,5 m/s est atteint en 1 s environ, pas en 10 sauts ; le garder, mais le traiter comme la vitesse normale de déplacement
- sévérité moyenne · catégorie ressenti · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité sans objet · jeu
- lieux : src/simulation.js:95; src/simulation.js:334-341; src/simulation.js:1322

**Preuve.** t0.mjs, monde plat, prototype (accélération en l'air 1,1, vitesse voulue 7,6 m/s) :
- Strafe avec lacet de 1,2 rad/s alterné à chaque bond : 10,5 m/s dès la première seconde, puis tenu 20 s.
- Lacet de 3 rad/s : 8,7 m/s à 1 s, 10,4 à 2 s.
- Sans strafe : 7,6 m/s constants.
FEEL-09 annonçait « 10 sauts optimaux » pour atteindre le plafond.
Conséquences mesurées à 10,5 m/s : portée d'un bond 6,5 m ; franchissement record à +2,51 m et 11,6 m de vol (SAUT-01) ; cache de rendu inchangé (17,4 reconstructions/s contre 18,3, SAUT-08) ; précision ennemie déjà nulle en cercle dès 5,4 m/s (SAUT-07).

**Cause.** Avec une accélération aérienne de 8,4 m/s² (1,1 × 7,6) et une vitesse voulue de 7,6 m/s, un strafe à 45° gagne environ 5 m/s par seconde. Le plafond borne donc la vitesse presque tout de suite.

**Proposition.** 1. Garder le plafond à 10,5 m/s : toutes les mesures de confinement, de cache et d'IA de cet axe ont été faites à cette vitesse.
2. Dimensionner le reste pour 10,5 m/s en régime permanent : distance de garde des pièges et des télégraphes, borne de vitesse observée par l'IA (±11), marges du cache.
3. Si l'on veut que la vitesse se mérite, baisser l'accélération aérienne à 0,7 et vérifier avec t0.mjs qu'il faut au moins 3 bonds pour passer 10 m/s. C'est un réglage de ressenti, à trancher en jeu.
4. Borner aussi la vitesse apportée par une explosion ou un propulseur enchaîné avec un saut (non mesuré).

**Gain attendu.** Pas de gain chiffré : la valeur de 10,5 m/s est validée par les autres mesures, et l'hypothèse « 10 sauts » est corrigée.

**Risques.** - Un seul pilote de strafe, sans recherche de l'angle optimal : un joueur expert atteint le plafond au moins aussi vite.
- Le recul d'explosion et l'enchaînement propulseur + saut n'ont pas été mesurés.

**Vérifier par.** node bancs/saut/t0.mjs : lignes « bhop turn », vitesse par seconde.

**Contre-vérification.** t0.mjs rejoué : sortie identique (10,5 m/s dès la première seconde à 1,2 rad/s ; 8,7 puis 10,4 à 3 rad/s ; 7,6 sans strafe ; 31 bonds en 20 s ; arrêt 0,242 s sur 0,67 m). L'hypothèse « 10 sauts optimaux » de FEEL-09 est bien fausse.

Remarques.
- Le plafond est atteint dès le premier bond avec un pilote naïf : il n'y a pas de courbe d'apprentissage, 10,5 m/s devient la vitesse de croisière de tout joueur qui saute. Baisser l'accélération aérienne à 0,7 est un réglage à trancher en jeu, non mesuré.
- Garder 10,5 m/s est cohérent : toutes les mesures de l'axe ont été faites à cette vitesse.
- Le point 4 (recul d'explosion, propulseur + saut) n'est pas mesuré.
- Détail du prototype : locomotion.speed vaut 0 à la fin du pas d'atterrissage (voir SAUT-05).

## Constats ajoutés par le contre-vérificateur

### SAUT-V1 — La sortie et les raccourcis existent déjà en 0.8.0 : le pistolet à munitions infinies ouvre n'importe quel muret en 2 à 6 s, et le clip de SAUT-01 ne ferme pas cette voie
- sévérité moyenne · catégorie bug · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/world.js:1356-1358; src/destruction.js:228-246; src/simulation.js:1129-1132; src/simulation.js:1159; src/world.js:1272-1273; src/game.js:612

**Preuve.** 0.8.0 non modifiée, sim.step seul (bench/saut-verif/breach2.mjs). Arme de départ : pistolet, inventaire ammo [0,0,0,0,1] inchangé après 18 tirs (munitions infinies, game.js:612 « ∞ BALLES »).
- v2-00 (muret 0,72 m) : sortie vivante sur le substrat après 3 s de tir en avançant, 9 balles.
- v2-02 (0,94 m) : 3 s, 9 balles.
- v2-01 (1,55 m, épaisseur 0,8 m) : 6 s, 18 balles.
Avec le prototype et le clip de SAUT-01 (verifA.mjs C) : sortie par la brèche en 1,87 à 4,4 s, retour en 1,08 à 1,25 s, identiques avec et sans clip.
Code : chaque muret est un groupe « prop » de résistance 6 (world.js:1356-1358 ; 119 / 118 / 197 murets par famille, plus 36 « wall » de résistance 18 en stade 1). Une balle vaut 2 points (simulation.js:1132, :1159), donc 3 balles par coupe (destruction.js:240-245).
L'agent écrit « en 0.8.0 ce contournement coûte une démolition » sans en mesurer le coût. Ses critères « 0 raccourci » et « 0 cul-de-sac » ne tiennent que si le joueur ne tire pas.

**Cause.** La 0.8.0 fait d'un muret démoli une ouverture utilisable (world.js:1272) et relie toutes les cours par le substrat. Les murets ont la résistance la plus basse (6) et les balles du pistolet gratuit s'additionnent sans limite. Les portes et ascenseurs conditionnés par des commandes ne verrouillent donc rien pour un joueur qui tire sur un muret.

**Proposition.** Décision à faire trancher par David, puis l'une des deux voies.
A. Assumer : la brèche est une mécanique voulue. Alors reformuler les critères de SAUT-01 et SAUT-02 en « sans tir », et ne pas présenter le clip comme une protection de la progression.
B. Verrouiller : les murets de bordure ne cèdent qu'aux explosifs.
- Dans FDestruction.create, marquer les groupes dont le mesh d'origine a category === 'boundary' (drapeau calculé à l'exécution : world.destructibles ne change pas, donc ni l'empreinte ni les sauvegardes).
- Dans damage(), si bullet est vrai et que le groupe est marqué : émettre materialImpact et les éclats, sans cumuler de dégâts.
- Roquettes et grenades (munitions limitées) continuent d'ouvrir.
Dans les deux cas, ajouter à tools/jump-reach.mjs un mode « avec brèche au pistolet » pour savoir ce que la progression garantit réellement.

**Gain attendu.** Voie B : 0 sortie en 6 s de pistolet au lieu d'une sortie en 2 à 6 s ; les verrous de progression tiennent tant que le joueur n'a pas d'explosif. Voie A : aucun changement de jeu, critères de test honnêtes.

**Risques.** - Voie B : change une mécanique livrée en 0.8.0 (commit « remove obstacle walls ») : arbitrage de David obligatoire.
- Tests de destruction et de checkpoint à rejouer (checkpoint.test.mjs:604, simulation.test.mjs:1489 utilisent une roquette : a priori non touchés).
- Un joueur sorti par SAUT-04 dépendrait d'un explosif pour rentrer : livrer la voie B seulement avec SAUT-01.
- Sauvegardes : drapeau calculé à l'exécution, format inchangé.

**Vérifier par.** node bancs/saut-verif/breach2.mjs : voie B, aucune ligne « sortie » non nulle en 6 s de pistolet sur v2-00, v2-01, v2-02 ; test existant de brèche à la roquette toujours vert.

### SAUT-V2 — Une coupe de balle laisse une lamelle de collision de 4 cm qui bouche une brèche visiblement ouverte ; avec le clip de SAUT-01 elle devient un mur infini
- sévérité moyenne · catégorie bug · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/destruction.js:36-46; src/destruction.js:142-144; src/destruction.js:243-244; src/world.js:113; src/simulation.js:242-251

**Preuve.** bench/saut-verif/sliver.mjs, visée basse fixe pendant 3 s au pistolet, mondes v2-00 et v2-02.
- Morceaux restants dans la brèche de 0,97 m : une lamelle de 0,97 × 0,63 × 0,04 m sur la face arrière et un linteau de 0,97 × 0,09 × 0,52 m (0,63 à 0,72 m de haut).
- 0.8.0 à pied : ne traverse pas. Prototype à pied : ne traverse pas.
- Prototype en sautant, sans clip : traverse (puis meurt de la règle de chute).
- Prototype en sautant, avec le clip de SAUT-01 : ne traverse pas.
Même résultat avec un tir en balayage de 6 s sur v2-00 (breach2.mjs) : reste une barre de 0,97 × 0,10 × 0,04 m, joueur arrêté à z = 53,01 dans un muret qui va de 52,81 à 53,33.
Calcul : rayon de coupe d'une balle = clamp(0,30 + √2 × 0,13 ; 0,40 ; 0,85) = 0,484 m (destruction.js:243) ; épaisseur du muret 0,52 m (world.js:113) ; reste 0,036 m, juste au-dessus du minimum de 0,035 m passé à subtract (destruction.js:142).

**Cause.** Le cube de coupe est centré sur le point d'impact de la face avant : sa profondeur (0,484 m) est inférieure à l'épaisseur du muret (0,52 m). Le reliquat de 3,6 cm dépasse de 1 mm le seuil d'élimination des morceaux de collision. blocked() le traite comme un mur plein, et le clip de SAUT-01 étend ce reliquat à une hauteur illimitée.

**Proposition.** Dans compile() de destruction.js, pour les morceaux de collision seulement (boucle g.colliders, :141-144) :
1. Après les subtract, écarter tout morceau dont une dimension horizontale est inférieure à 0,12 m alors que la même dimension du collider d'origine est d'au moins 0,12 m (morceau produit par une coupe, pas une tôle fine d'origine). Les tôles et rails fins d'origine restent protégés (commentaire :39-40, test destruction.test.mjs:204).
2. Le rendu suit, puisque les meshes des groupes à collider sont reconstruits depuis ces mêmes morceaux (:147-149).
3. Dans le clip de SAUT-01, par sécurité, ignorer aussi les morceaux de moins de 0,12 m d'épaisseur.
Les coupes enregistrées ne changent pas : une sauvegarde 0.8.0 se recharge, avec des lamelles en moins.

**Gain attendu.** Une brèche ouverte à l'écran est franchissable : traversée à pied après 3 s de tir bas, au lieu d'un blocage par 4 cm de pierre. Supprime le cas où le clip de SAUT-01 transforme un débris en mur invisible.

**Risques.** - Géométrie recalculée différemment pour une même liste de coupes : un monde sauvegardé en 0.8.0 perd ses lamelles au rechargement (collision plus permissive, jamais plus stricte).
- Tests destruction.test.mjs (15) et renderer-destruction.test.mjs (15) à rejouer, notamment la façade fine de :204.
- Le linteau de 9 cm × 0,52 m reste et bloque encore à pied : c'est une vraie barre visible, à laisser.
- Déterminisme inchangé (calcul pur).

**Vérifier par.** node bancs/saut-verif/sliver.mjs : plus aucun reste d'épaisseur 0,04 dans la colonne « restes » ; breach2.mjs, mode balayage 6 s sur v2-00 : sortie non nulle.

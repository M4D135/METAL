# Axe PHYS — PHYS — physique de corps rigides digne de Half-Life 2 (noyau FPhys générique dans FERRO, intégration par étapes dans METAL)

Origine : axe ajouté. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

METAL 0.8 (673d6b2) n'a aucun corps rigide : le joueur est un cylindre sur des boîtes alignées, les gravats sont des boîtes alignées qui ne se voient pas entre elles, ne sont ni poussables ni touchées par les tirs ou les explosions, les accessoires sont des colliders statiques, les machines tuées disparaissent (actors.js:17) et la grenade est un point qui se fige au 3e rebond.

J'ai écrit et mesuré un noyau maison, bancs/phys/fphys.mjs (365 lignes, environ 26 Ko en style dense, aucun code tiers) : boîtes orientées, monde statique en boîtes alignées plus un plan de sol, grille uniforme, axes séparateurs avec découpage de face, impulsions séquentielles souples avec démarrage à chaud et sous-pas, îles et sommeil, marge spéculative pour les objets rapides, instantané et restauration.

Résultats mesurés (Node 24.18, domaine principal, machine très chargée : charge moyenne 27 à 114 sur 10 coeurs, donc temps absolus gonflés ; minimum par pas sur répétitions alternées) :
- pile de 10 caisses, 10 s sans sommeil : 12,6 mm d'écart horizontal, vitesse résiduelle 0,5 mm/s ; pyramide de 55 : 14,7 mm ; les deux s'endorment en 0,8 à 1,0 s ;
- 300 gravats lâchés : 1,7 ms médian par pas de 1/120 s avec 289 corps éveillés et 1 460 points de contact, aucun corps sous le sol ni hors des murs ;
- 200 objets soufflés : 0,42 ms moyen par pas, 0,76 ms au p95 ;
- par image à 60 fps : 5 à 9 µs par corps éveillé, soit 110 à 200 corps éveillés pour 1 ms et 220 à 400 pour 2 ms ; un monde entièrement endormi coûte 5 µs par pas ;
- déterminisme : chaînes de hachage identiques entre processus et entre niveaux de JIT (TurboFan, --no-opt, sans Sparkplug ni Maglev, --jitless) ;
- restauration exacte par texte JSON dans un monde neuf, à condition de sérialiser le cache d'impulsions ; sans lui l'écart atteint 0,18 à 3,3 m ;
- 0 octet alloué par pas après correction (57 Ko par pas avant : doubles passés en argument).

Trois pièges trouvés en prototypant, à transmettre à Codex : le pas à 60 Hz sans sous-pas fait s'écrouler la pile de 10 ; recalculer une grandeur dérivée par une autre formule à la restauration (1/(1/m)) fait diverger dès le premier pas ; un double passé à une fonction non intégrée est mis en boîte par V8.

Limites du prototype, à ne pas surinterpréter : boîtes seules (ni sphère, ni capsule, ni articulation, ni contrôleur de personnage : conçus mais non prototypés), sol plan sans pente, coût fixe de 30 à 60 µs par pas non optimisé, critère de sommeil trop lent sur un gros tas (11,9 s pour 300 gravats). Le dossier FERRO v0.2 annoncé (~/Projects/ferro) est absent de cette machine : les emplacements FERRO sont donnés par nom de module. Aucun dépôt n'a été modifié (METAL : git status vide, HEAD 673d6b2).

Le plan tient en cinq étapes livrables seules : A accessoires poussables et barils, B gravats en corps rigides (supprime la cause des points de reprise refusés), C dislocation des machines, D contrôleur de personnage et objets saisis, E articulations et éléments de niveau.

## Mesures

- **Pile de 10 caisses (0,8 m, 30 kg), 10 s simulées, sommeil coupé, 120 Hz × 1 (2 itérations + 1 de relâchement)** : Écart horizontal max 12,6 mm ; tassement vertical 83,7 mm au sommet (dont 50 mm voulus : 10 interfaces × 5 mm de tolérance d'appui) ; inclinaison 0,05° ; vitesse résiduelle 0,5 mm/s à 10 s (24,0 mm et 28,8 mm/s à 1 s : la pile se pose puis se stabilise, elle ne dérive pas) _(méthode : node drift.mjs (pose comparée à la pile idéale à 1, 5 et 10 s))_
- **Même pile avec le sommeil actif** : Endormie à 1,02 s (pas 123), figée à 24,3 mm horizontal, 84,9 mm vertical, 0,156° _(méthode : node bench.mjs 4 120 1 ; node drift.mjs)_
- **Pile de 10 selon la cadence (sommeil coupé, 10 s)** : 60 Hz × 2 sous-pas : stable, 26,6 mm ; 60 Hz × 1 : la pile s'écroule (inclinaison 90°, 5,8 m d'écart à 5 s) ; tolérance d'appui 2 mm : tassement réduit à 54 mm mais 97 mm d'écart transitoire à 1 s _(méthode : node drift.mjs (6 configurations))_
- **Pyramide de 55 caisses (base 10), 10 s, sommeil coupé** : 120 Hz × 1 : 14,7 mm horizontal, 64,5 mm vertical, 0,44°, vitesse résiduelle 0,05 mm/s ; 60 Hz × 2 : 14,5 mm ; 60 Hz × 1 : 49 mm et encore 8,8 mm/s à 10 s ; avec sommeil : endormie à 0,77 s _(méthode : node drift.mjs ; node bench.mjs 4 120 1)_
- **Pyramide de 55 : coût du pas à 120 Hz** : 409 à 433 µs par pas pour 55 corps, 518 à 544 points de contact, 135 tests de paires _(méthode : node micro.mjs 400 120 1 (minimum de 400 pas identiques) et node bench.mjs 4 120 1 (minimum par pas sur 4 répétitions))_
- **Tas de 300 gravats lâchés (tailles 0,12 à 1,1 m, 5 matières, cour murée de 7 m)** : Par pas de 1/120 s : moyenne 1,83 ms, médiane 1,72 ms, p95 2,75 ms ; 289 corps éveillés, 1 460 points de contact (max 1 590), 1 055 tests de paires ; tout endormi à 11,9 s ; 0 corps sous le sol ou hors des murs _(méthode : node bench.mjs 4 120 1 (1 800 pas, minimum par pas sur 4 répétitions alternées ; pointes au-delà de 3 ms = bruit de charge))_
- **200 objets soufflés par une explosion (piles de 3 caisses et barils, rayon 14 m)** : Par pas de 1/120 s : moyenne 0,42 ms, p95 0,76 ms ; 200 corps éveillés au pic, 813 points de contact au pic ; tout rendormi 5,1 s après l'explosion ; 0 traversée des murs (hauteur 30 m) _(méthode : node bench.mjs 4 120 1)_
- **Coût d'un pas dans un état figé (même instantané restauré 400 fois, minimum)** : Chute libre 300 corps sans contact : 134 à 161 µs (0,45 à 0,54 µs par corps) ; premiers impacts 300 corps, 566 points : 462 à 540 µs ; tas 280 à 286 corps éveillés, 1 544 à 1 565 points, 1 139 à 1 205 tests : 1,25 à 1,43 ms ; juste après l'explosion 198 corps, 541 points : 410 à 415 µs _(méthode : node micro.mjs 400 120 1, deux passes)_
- **Modèle de coût du pas (moindres carrés sur les minima)** : µs par pas ≈ 0,39 à 0,49 × corps éveillés + 0,51 à 0,52 × points de contact + 0,28 à 0,43 × tests de paires, plus 30 à 60 µs de coût fixe (remise à zéro des grilles et de la table de hachage) _(méthode : node micro.mjs (ajustement sur 8 états))_
- **Coût par image à 60 fps, 120 Hz × 1 contre 60 Hz × 2 sous-pas (apparié, alterné)** : Tas de 292 corps : 2,65 ms contre 1,87 ms par image (−29 %) ; explosion, 149 corps éveillés en moyenne : 0,92 contre 0,75 ms (−18 %). Par corps éveillé et par image : 9,1 et 6,1 µs à 120 Hz × 1 ; 6,4 et 5,0 µs à 60 Hz × 2 _(méthode : node variants.mjs rubble300 4 6 '[...]' et blast200 (minimum par pas sur 4 répétitions alternées))_
- **Corps éveillés tenables par budget (60 fps, sur cette machine chargée)** : 1 ms : 110 (tas dense) à 165 (objets épars) à 120 Hz × 1 ; 155 à 200 à 60 Hz × 2. 2 ms : 220 à 325, ou 310 à 400. Corps endormis : gratuits _(méthode : Dérivé des coûts par corps et par image ci-dessus ; estimation mobile : 3 à 5 fois moins)_
- **Coût d'un monde entièrement endormi** : 5,0 µs par pas pour 300 corps endormis _(méthode : node micro.mjs 300 60 2 (état « tas » déjà endormi))_
- **Allocations par pas** : Version initiale : 57 032 octets par pas (tas) et 11 637 (explosion), 21 ramasse-miettes en 600 pas ; après passage des doubles par un tampon typé : 7 et 3 octets par pas (bruit du profileur), simulation identique bit à bit _(méthode : node --expose-gc alloc2.mjs (profileur d'allocation par échantillonnage de V8) ; node allocsame.mjs (hachages identiques entre les deux versions))_
- **Déterminisme** : Chaîne de hachages (toutes les 50 pas) identique pour les 4 scènes entre : deux processus, --no-opt, --max-lazy --no-sparkplug --no-maglev, et --jitless (100 et 200 pas) ; 4 à 5 répétitions dans un même processus : un seul hachage par scène _(méthode : node determinism.mjs dans 5 modes, fichiers d1.txt à d6.txt comparés par cmp ; bench.mjs)_
- **Restauration exacte** : Instantané au pas 300 → texte JSON → monde neuf → suite : hachage identique à la partie ininterrompue au pas 1 100 (tas), 900 (explosion), 300 (pyramide). Sans le cache d'impulsions : écart de position de 182 mm, 3,3 m et 5,6 mm _(méthode : node restore.mjs ; node restore2.mjs (première différence au pas −1, c'est-à-dire aucune))_
- **Taille d'un instantané (pire cas, tout éveillé)** : 300 gravats éveillés : 194 420 caractères, dont 84 271 pour 1 578 points de contact en cache (53 par point) et 110 153 pour les corps (367 par corps, doubles en clair) ; 200 objets : 85 957 dont 17 903 de cache _(méthode : node restore.mjs (JSON.stringify sans compaction))_
- **Objets rapides contre murs minces (boîtes de 10 à 18 cm, rotation rapide)** : 120 Hz × 1 : 0 traversée sur 160 (20 et 40 m/s, murs de 5 et 20 cm) ; détection à 60 Hz : 1 sur 40 à 40 m/s, 0 sur 40 à 20 m/s _(méthode : node tunnel.mjs)_
- **Mondes générés de METAL** : 191 à 206 × 122 à 134 m ; 448 à 504 colliders statiques ; 26 à 28 rectangles de sol dont 3 à 6 en pente ; 10 salles, 7 000 à 7 800 m² ; groupes destructibles : 211 à 285 « prop », 48 à 54 murs, 664 à 786 décors ; 40 à 48 accessoires de la taille d'une caisse (18 abris de combat de 1,35 × 1,2 × 1,55 m, 10 rochers, 9 socles de ventilation), tous statiques _(méthode : node worldstats.mjs ; node propcats.mjs (chargeur en lecture seule de bench/sim/fast.mjs))_
- **Taille du prototype et du code remplacé** : fphys.mjs : 38 674 octets formatés, environ 26 Ko en style dense ; code de gravats actuel remplaçable : 8,2 Ko (simulation.js:68-83 et 992-1065) ; page actuelle 789 111 octets sur un budget de 1 400 000 _(méthode : wc -c ; awk sur simulation.js ; SIZE.json)_
- **Référence actuelle des gravats (premier tour, non remesurée)** : 8,2 à 9,2 µs par gravat en mouvement et par pas de 1/60 s ; 0,94 à 1,10 µs par gravat au repos ; 128 gravats au repos : 0,9 à 2,1 ms par pas ; 5 à 10 points de reprise refusés sur 11 _(méthode : Constats SIM-03, LOAD-05, LOOP-01 (audit/round1))_

## Scripts de banc

- bancs/phys/fphys.mjs
- bancs/phys/fphys.v1-boxed-args.mjs
- bancs/phys/scenes.mjs
- bancs/phys/bench.mjs
- bancs/phys/micro.mjs
- bancs/phys/variants.mjs
- bancs/phys/drift.mjs
- bancs/phys/determinism.mjs
- bancs/phys/restore.mjs
- bancs/phys/restore2.mjs
- bancs/phys/alloc2.mjs
- bancs/phys/allocsame.mjs
- bancs/phys/tunnel.mjs
- bancs/phys/worldstats.mjs
- bancs/phys/propcats.mjs
- bancs/phys/phases.mjs
- bancs/phys/worst.mjs
- bancs/phys/sanity.mjs

## Décisions pour David

- **Saisir et lancer les objets avec la touche d'interaction (comme dans Half-Life 2) ?** — recommandé : Oui, à l'étape D, en version simple : E saisit l'objet visé à moins de 2,2 m et de masse inférieure ou égale à 40, il est porté devant soi par une contrainte souple, le tir le lance à 12 m/s, E le repose. Une main reste libre pour le pistolet. ; autres choix : Non (les objets ne réagissent qu'aux tirs, aux explosions et à la poussée du corps) ; ou seulement la frappe de bouclier comme moyen de projeter.
- **La frappe de bouclier propulse-t-elle les objets ?** — recommandé : Oui : impulsion de 220 unités dans le cône de 45° et à 2,15 m, les mêmes valeurs de cône et de portée que la frappe actuelle (simulation.js:785-797), sans coût d'énergie supplémentaire. ; autres choix : Non ; ou seulement les objets de masse inférieure à 30.
- **Densité d'accessoires physiques par monde** — recommandé : 80 à 120 corps par monde (8 à 12 par salle, piles de 1 à 3), dont 12 à 20 barils explosifs ; moitié moins en qualité basse et sur mobile. Capacité du noyau : 384 corps avec 128 gravats et 48 pièces d'épave. ; autres choix : 40 à 60 partout (prudent) ; 200 et plus (nécessite de vérifier le budget sur mobile).
- **Les 18 abris de combat et autres accessoires statiques de la taille d'une caisse deviennent-ils poussables ?** — recommandé : Non : ils restent statiques et destructibles, car l'IA s'en sert comme couverts et la navigation les compte comme murs. Les accessoires physiques sont des objets nouveaux, posés à côté. ; autres choix : Les rendre très lourds (masse 400), déplaçables seulement par une explosion ; ou tout rendre dynamique (refonte de la recherche de couvert).
- **Barils explosifs en chaîne** — recommandé : Oui : 10 points de vie, explosion 0,15 à 0,35 s après la rupture (délai tiré de l'identifiant, donc déterministe), mêmes valeurs que la grenade (rayon 3,2 m, dégâts 24). Jamais à moins de 6 m du départ, d'un atelier ou d'un relais. ; autres choix : Pas de barils explosifs ; ou barils sans réaction en chaîne.
- **Dégâts cinétiques sur le joueur** — recommandé : Oui mais plafonnés à 25 par choc, avec 0,5 s d'immunité pour un objet que le joueur vient de pousser ou de lâcher ; plein effet sur les ennemis (un objet lancé peut tuer une machine légère, une charge qui tombe écrase). ; autres choix : Dégâts cinétiques uniquement sur les ennemis ; ou aucun.
- **Les gravats et les épaves gênent-ils le déplacement ?** — recommandé : Petits (masse inférieure à 15) : poussés sans ralentir. Moyens (15 à 60) : poussés avec ralentissement, on peut monter dessus. Gros (plus de 60 et plus de 0,43 m de haut) : obstacles, que l'IA contourne. Rien ne bloque jamais définitivement un passage : une explosion ou la frappe de bouclier dégage. ; autres choix : Purement décoratifs comme aujourd'hui (plus simple, mais on traverse les gravats) ; ou tout est obstacle (risque de passages bouchés).
- **Cadence de la physique (elle fixe les sauvegardes et les rejeux de la démo, donc une seule valeur pour tous)** — recommandé : 120 Hz, une détection de collision par pas : 0 traversée sur 160 dans le test de murs minces, même cadence que BITUME et Point de rupture. Coût : 6 à 9 µs par corps éveillé et par image. ; autres choix : 60 Hz avec 2 sous-pas : 18 à 29 % moins cher, mais 1 traversée sur 40 à 40 m/s, donc balayage obligatoire pour les objets rapides. 60 Hz sans sous-pas est exclu : la pile de 10 s'écroule.
- **Anciens points de reprise (gravats au format rubbleVersion 1)** — recommandé : Les convertir à la restauration : même pose, corps endormi, sans contrôle de chevauchement. Aucun joueur ne perd sa progression. ; autres choix : Jeter les gravats des anciens points de reprise ; ou refuser les anciens points (retour à l'entrée du secteur).
- **Épaves de machines : combien et combien de temps ?** — recommandé : 48 pièces au plus, persistantes ; au-delà, on retire les plus lointaines déjà endormies, comme pour les gravats (simulation.js:881-887). 6 à 10 pièces par machine, 16 à 24 pour un boss. ; autres choix : Disparition après 20 s (moins de mémoire, moins de décor) ; ou 96 pièces sur ordinateur.
- **FPhys entre-t-il dans FERRO dès maintenant ?** — recommandé : Oui, comme module optionnel que rien ne charge par défaut : il est générique (aucune notion de jeu), et BITUME (débris, cônes, barrières) et Point de rupture (débris, épaves) en ont l'usage. Le rapport FERRO précédent classait les collisions « pas maintenant » : cette demande change la priorité. ; autres choix : L'incuber dans METAL (src/physics.js) et le remonter dans FERRO une fois stabilisé par les étapes A et B.

## Constats

### PHYS-01 — État actuel : METAL 0.8 n'a aucun corps rigide — gravats qui s'ignorent, accessoires statiques, machines qui disparaissent
- sévérité haute · catégorie physique · effort XL · gain qualitatif
- contre-vérification : **confirmé**, priorité P0 · qualité sans objet · jeu
- lieux : src/simulation.js:242-273; src/simulation.js:876-893; src/simulation.js:933-958; src/simulation.js:992-1065; src/simulation.js:1083-1085; src/simulation.js:2070-2084; src/actors.js:17; src/world.js:1350-1353

**Preuve.** Inventaire de ce qui tient lieu de physique (METAL 673d6b2) :
- Joueur et ennemis : cylindre (rayon 0,28 m, hauteur 1,8 m) contre des boîtes alignées, simulation.js:242-251 (blocked) et 260-273 (move : pas de 0,12 m, axe X puis Z, marche de 0,42 m). Chute et tremplins balistiques : 336-360, 361-366. Pas de saut (FEEL-09).
- Gravats : appendDebris 876-893 ; balayage de boîte alignée 1005-1017 ; rebond 0,16 à 0,24 et frottement 0,64 ou 0,82 en dur, 1018-1024 ; updateDebris 1028-1065. La rotation est décorative : au sol elle est ramenée vers une pose à plat (1047-1049). Les gravats ne se testent jamais entre eux et ne sont pas dans solids : s.debris n'apparaît qu'aux lignes 881-898, 1030, 1064, 1956 et 2210.
- Conséquences vérifiées par lecture : ray() (474-511) et blocked() ignorent les gravats, donc les balles et le joueur les traversent ; explode() (933-958) ne leur donne aucune impulsion.
- Grenade : un point, vitesse × 0,42 à chaque rebond, figée après 3 rebonds ou sous 1,4 m/s (1083-1085).
- Recul : seule la frappe de bouclier déplace un ennemi, de 1,25 m par move (795) ; l'explosion pousse le joueur de 0,42 m (939-940).
- Mort d'une machine : FActors.build renvoie [] dès hp<=0 (actors.js:17) ; il ne reste que des particules (simulation.js:824), et 12 explosions scénarisées pour un boss (819).
- Accessoires : tous des colliders statiques (world.js:58, 1207, 1278), classés « prop » de résistance 6 (world.js:1350-1353). worldstats.mjs : 211 à 285 par monde, dont 40 à 48 de la taille d'une caisse, aucun dynamique.
- Portes, ascenseurs, pièges : boîtes animées (205-207, 298-316).
- Sauvegarde : physicsVersion 1 ne couvre que les champs de chute (1946, 2089).
Coûts et défauts déjà mesurés au premier tour : 8,2 à 9,2 µs par gravat en mouvement et 0,94 à 1,10 µs par gravat au repos (SIM-03), 128 gravats au repos = 0,9 à 2,1 ms par pas (LOAD-05), points de reprise refusés à cause de la règle de chevauchement de simulation.js:2081 (LOAD-01, LOOP-01).

**Cause.** La simulation a été construite pour le combat : des volumes alignés sur les axes, un cylindre pour les corps, et des gravats ajoutés après coup comme décor animé. Il n'y a ni masse utile, ni contact entre objets, ni impulsion, ni empilement.

**Proposition.** Introduire un vrai noyau de corps rigides (FPhys, PHYS-02) et l'intégrer en cinq étapes livrables seules :
A) accessoires poussables et barils (PHYS-07) ;
B) gravats convertis en corps rigides, updateDebris supprimé (PHYS-08) ;
C) dislocation des machines (PHYS-09) ;
D) contrôleur de personnage, objets saisis, frappe de bouclier (PHYS-10) ;
E) articulations et éléments de niveau (PHYS-11).
Chaque étape garde les tests existants verts et ajoute les siens dans checks/physics.test.mjs. Le code actuel des gravats (8,2 Ko, lignes 68-83 et 992-1065) disparaît à l'étape B.

**Gain attendu.** Les objets réagissent aux tirs, aux explosions, au joueur et aux ennemis ; les empilements tiennent puis s'écroulent ; les gravats roulent, s'entassent et s'endorment sans se traverser. C'est la demande « physique digne de Half-Life 2 », aujourd'hui absente à 100 %.

**Risques.** Chantier large, qui touche le combat, l'IA, les sauvegardes et le rendu des débris : d'où le découpage en étapes. Tests de simulation obligatoires pour toute modification de collision (AGENTS.md). Les valeurs de masse actuelles des gravats (destruction.js:223, bornées de 0,035 à 160) sont arbitraires : à garder comme unité de masse du jeu pour ne pas casser les sauvegardes.

**Vérifier par.** Lecture : grep -n 's.debris' src/simulation.js (7 sites, aucun dans ray, blocked, explode). node bancs/phys/worldstats.mjs pour le compte des accessoires.

**Contre-vérification.** Relu sur METAL 673d6b2 : simulation.js:242 (blocked), 260 (move), 474 (ray), 785 (shieldBash), 876 (appendDebris), 933-958 (explode : aucune impulsion vers s.debris), 1028 (updateDebris), 1084-1085 (grenade x0,42, figée à 3 rebonds ou sous 1,4 m/s), actors.js:17 (return [] si hp<=0), world.js:1350-1353 (classement prop, résistance 6), MAX_RUBBLE=128 (ligne 64). grep s.debris : lignes 881, 886, 889, 891, 892, 1030, 1064, 1956, 2210, aucune dans ray, blocked ni explode. Constat exact. C'est la demande explicite de David, d'où P0 pour le chantier, à livrer par étapes. Deux précisions utiles à Codex, mesurées par mon script worldgeo.mjs : les sols de METAL sont 26 rectangles sur 6 hauteurs (-0,25 ; 0 ; 1,6 ; 3,2 ; 4,8 ; 6,4 m), pas un plan unique ; et le décor compte 102 paires de boîtes à dessus coplanaires jointifs et 163 paires de faces verticales bout à bout (voir PHYS-V1).

**Preuve corrigée.** Le rayon 0,17 m de la grenade est aux lignes 1119 et 2061, pas 1005. Épaisseur minimale des colliders : 0,12 à 0,16 m (aucun mur de 5 cm).

### PHYS-02 — Noyau FPhys : un prototype maison de 365 lignes tient les piles et coûte 5 à 9 µs par corps éveillé et par image
- sévérité haute · catégorie physique · effort XL · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur (dans METAL)
- lieux : FERRO : src/physics.js (nouveau module ; dossier ~/Projects/ferro absent de cette machine); bancs/phys/fphys.mjs; METAL : tools/build.py (liste des modules), src/simulation.js:220-235

**Preuve.** Prototype écrit pour cet audit, sans code tiers : bancs/phys/fphys.mjs.
Contenu : boîtes orientées ; monde statique en boîtes alignées rangées dans une grille de 2 m, plus un plan de sol ; grille des corps éveillés refaite à chaque pas, grille des endormis refaite seulement quand l'ensemble change ; axes séparateurs (15 axes) puis découpage de la face incidente, 4 points au plus, identifiants de points stables ; impulsions séquentielles à contrainte souple (30 Hz, amortissement 10, vitesse de dégagement plafonnée à 3 m/s), démarrage à chaud par identifiant, 2 itérations plus 1 de relâchement ; frottement de Coulomb sur deux tangentes ; restitution au-delà de 1 m/s ; îles par union-find et sommeil après 0,5 s sous 0,08 m/s et 0,12 rad/s.
Mesures (détail dans measurements) :
- pile de 10 : 12,6 mm d'écart horizontal après 10 s sans sommeil ; pyramide de 55 : 14,7 mm ;
- 300 gravats : 1,72 ms médian par pas de 1/120 s pour 289 corps éveillés et 1 460 points de contact ;
- 200 objets soufflés : 0,42 ms moyen, 0,76 ms au p95 ;
- modèle : 0,39 à 0,49 µs par corps éveillé + 0,51 µs par point de contact + 0,28 à 0,43 µs par test de paire ;
- monde endormi : 5 µs par pas.
Comparaison avec l'existant : un gravat en mouvement coûte aujourd'hui 8,2 à 9,2 µs par pas de 1/60 s (SIM-03) sans voir les autres ; un corps FPhys coûte 5,0 à 9,1 µs par image avec contacts complets, et 0 une fois endormi (1 µs aujourd'hui).

**Cause.** FERRO n'a aucun module de collision ni de dynamique ; chaque jeu a ses tests de volumes ad hoc (METAL simulation.js:242, BITUME src/course.js:182). Le rapport FERRO précédent avait classé le sujet « pas maintenant ».

**Proposition.** Créer FERRO src/physics.js, global FPhys, sans DOM ni rendu, utilisable dans un worker.
API proposée :
- FPhys.create({bounds, gravity:-12, capacity:384, cell:2, tick:1/120, iterations:2, relax:1}) ;
- setStatics(boîtes, sols) et updateStatics(boîtes changées), qui réveille les corps dont l'enveloppe touche une boîte changée ;
- addBody({shape:'box'|'sphere'|'capsule', size, pos, quat, vel, mass, material, layer, mask}) renvoie un identifiant (indice plus génération) ; removeBody ;
- setKinematic(id, pos, quat) pour portes, ascenseurs, pièges ;
- step(dt) ; impulse(id, point, j) ; blast(point, rayon, force, plafondDeVitesse) ; wakeBox(boîte) ;
- ray(o, d, portée, masque) et sweepCapsule pour le personnage ;
- events : liste des chocs au-dessus d'un seuil {a, b, point, normale, impulsion, énergie, matières} ;
- joints (PHYS-11) ; snapshot(), restore(), hash() ; stats {awake, contacts, tests}.
Structures : tableaux typés en colonnes (position, quaternion, vitesses, demi-tailles, matrice de rotation, inertie inverse monde, enveloppe), corps 0 = monde immobile, contacts en colonnes avec réponses angulaires précalculées.
Matières (valeurs reprises de simulation.js:1019 et destruction.js:223) : métal frottement 0,45 rebond 0,24 ; pierre 0,70 et 0,16 ; bois 0,55 et 0,22 ; verre 0,35 et 0,16 ; terre 0,80 et 0,05 ; combinaison : racine du produit des frottements, maximum des rebonds.
À ajouter au prototype : sphère et capsule (sphère contre boîte, capsule contre boîte par segment le plus proche), sols en pente comme plans bornés (METAL a 3 à 6 rectangles en pente par monde), boîtes cinématiques, couches de collision, rayon par parcours de grille.
Rendu : exposer la matrice 3 × 3 et la pose précédente de chaque corps pour que FRender dessine les instances sans angles d'Euler et interpole entre deux pas.
Critères d'acceptation : les 4 scènes de scenes.mjs dans les tolérances mesurées (pile de 10 sous 30 mm d'écart horizontal à 10 s, pyramide sous 20 mm, 0 corps sous le sol), hachage identique dans les 5 modes de determinism.mjs, 0 octet par pas, moins de 60 Ko de source.

**Gain attendu.** Mesuré sur le prototype : piles stables, 110 à 200 corps éveillés pour 1 ms par image et 220 à 400 pour 2 ms sur cette machine chargée ; corps endormis gratuits. Estimé : 45 à 60 Ko de source pour le noyau complet, soit 4 % du budget de 1 400 000 octets (page actuelle : 789 111).

**Risques.** - Prototype limité aux boîtes : sphères, capsules, articulations et contrôleur ne sont pas mesurés.
- Temps mesurés sous une charge de 27 à 114 : ordre de grandeur fiable, valeurs absolues pessimistes.
- Le tassement de 5 mm par interface est voulu (tolérance d'appui) ; 2 mm réduit le tassement mais ajoute du tremblement au départ.
- Le résultat dépend de la taille de cellule et de l'ordre des paires : ces réglages font partie de la version de physique (PHYS-04).
- Compatibilité de FERRO : module nouveau et optionnel, un jeu de la v0.2 qui ne l'appelle pas ne change pas.
- Aucune copie de code sous GPL : algorithmes classiques réécrits, à maintenir ainsi.

**Vérifier par.** cd bancs/phys && node bench.mjs 4 120 1 && node micro.mjs 400 120 1 && node drift.mjs

**Contre-vérification.** Rejoué : drift.mjs donne exactement les mêmes chiffres (pile de 10 : 12,57 mm à 10 s ; pyramide : 14,70 mm), bench.mjs 3 répétitions : tas de 300 à 1,74 ms médian par pas, 289 éveillés, 1 460 points, 0 corps sous le sol. Le noyau tient donc ses scènes. En revanche il est nettement moins robuste hors de ces 4 scènes, ce que le rapport ne dit pas (mes scripts robust.mjs, seams.mjs, ratio.mjs, wake.mjs dans bench/phys-verif) : (1) arêtes internes : une caisse qui glisse sur des boîtes statiques jointives bute et culbute (PHYS-V1) ; (2) réveil : une impulsion de 6 sur un tas endormi réveille 286 corps pendant 13,8 s (PHYS-V2) ; (3) rapports de masses réels des gravats non tenus (PHYS-V3) ; (4) objets minces enfoncés par la tolérance d'appui (PHYS-V4). La pile de 10 posée sur une boîte statique tient (24 mm à 10 s), sur un joint entre deux boîtes elle dérive de 89 mm et bouge encore à 10 mm/s. Le sol du prototype est un plan unique à y=0 : METAL a 6 hauteurs de sol. Les critères d'acceptation doivent inclure ces cas, sinon Codex livrera un noyau qui passe les 4 scènes et accroche en jeu. FERRO introuvable sur cette machine (~/Projects/ferro absent) : destination non vérifiable, incubation dans METAL src/physics.js acceptable tant que l'API n'est pas stabilisée par les étapes A et B.

**Preuve corrigée.** Coût du tas de 300 par image à 60 i/s : 2,4 ms (machine plus calme, variants.mjs 12 s) à 3,7 ms (bench.mjs sous charge, 2 x 1,83 ms), pire image 3,8 à 5,5 ms ; le 2,65 ms annoncé est une moyenne qui inclut la chute libre. Les coefficients du modèle linéaire ne sont pas stables : mon ajustement donne 1,09 x éveillés + 0,43 x points + 0,98 x tests avec 25 % d'erreur ; seul l'agrégat (4 à 8 µs par corps éveillé et par pas) est fiable. Coût fixe à l'échelle d'un monde METAL (206 x 134 m, 6 901 cellules) : 50 µs par pas dès qu'un seul corps est éveillé, contre 35 µs sur la grille de 128 m du banc.

**Gain corrigé.** 80 à 110 corps éveillés pour 1 ms par image en tas dense (au lieu de 110), 165 en objets épars ; plus 0,1 ms par image de coût fixe à 120 Hz tant que rien n'est optimisé.

### PHYS-03 — Cadence et objets rapides : 60 Hz sans sous-pas fait s'écrouler la pile de 10 ; 120 Hz ne laisse rien traverser
- sévérité haute · catégorie physique · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : src/game.js:677; src/game.js:690-696; src/simulation.js:432; src/simulation.js:1068; src/simulation.js:1083-1085

**Preuve.** drift.mjs, sommeil coupé, 10 s :
- 120 Hz × 1 : pile de 10 stable (12,6 mm, 0,5 mm/s résiduel) ;
- 60 Hz × 2 sous-pas : stable (26,6 mm) ;
- 60 Hz × 1 : la pile s'écroule (90° d'inclinaison, 5,8 m d'écart dès 5 s) ; la pyramide tient mais glisse encore à 8,8 mm/s après 10 s.
tunnel.mjs, petites boîtes en rotation lancées contre un mur de 5 ou 20 cm :
- détection à 120 Hz : 0 traversée sur 160, jusqu'à 40 m/s (33 cm par pas) ;
- détection à 60 Hz : 1 traversée sur 40 à 40 m/s, 0 sur 40 à 20 m/s.
variants.mjs, coût par image à 60 fps : 60 Hz × 2 coûte 18 à 29 % de moins que deux pas de 120 Hz (une seule détection par image).
Contexte : la boucle de METAL découpe par ceil(dt*60) (game.js:677, constat LOOP-05) ; le déplacement et les projectiles se resubdivisent déjà à 120 Hz (simulation.js:432 et 1068) ; BITUME et Point de rupture tournent à 1/120 s (rapport FERRO-09).

**Cause.** Un solveur itératif à peu d'itérations ne transmet pas la charge sur 10 étages en un seul pas de 16,7 ms. La marge spéculative (enveloppe élargie de vitesse × dt, contact anticipé résolu à vitesse d'approche s/h) couvre un déplacement de 33 cm par pas, pas de 67 cm avec rotation rapide.

**Proposition.** 1) Pas de physique fixe de 1/120 s, piloté par un accumulateur interne à la simulation : dans sim.step(dt), acc += dt ; tant que acc >= 1/120, phys.step(1/120). L'accumulateur est sérialisé dans l'instantané. Aucune option utilisateur ne change cette cadence, sinon sauvegardes et rejeux de démo divergent.
2) Marge spéculative conservée : enveloppe élargie de |v| × dt + 2 cm, marge de paire = 2 cm + (|vA| + |vB|) × dt.
3) Grenades : sphère de 0,17 m (le rayon actuel, simulation.js:1005) simulée par FPhys, rebond 0,42 comme aujourd'hui, mèche inchangée ; elle roule au lieu de se figer au 3e rebond. Les roquettes restent un rayon balayé (castProjectile, 959-979).
4) Si l'on préfère 60 Hz × 2 pour le coût : balayage obligatoire pour les corps marqués rapides (grenade, objet lancé) : avancée conservative le long de la vitesse jusqu'au premier contact, puis pas normal.
Critères : node tunnel.mjs donne 0 traversée sur 160 ; node drift.mjs garde la pile de 10 sous 30 mm ; une grenade lancée à 24 m/s contre un mur de 20 cm ne le traverse jamais sur 1 000 tirs semés.

**Gain attendu.** Mesuré : piles stables et 0 traversée sur 160 à 120 Hz. Mesuré : 18 à 29 % de coût en moins par image avec 60 Hz × 2, au prix d'un balayage à écrire. La grenade qui roule et rebondit sur les objets est un gain de ressenti (qualitatif).

**Risques.** - Deux pas de physique par image à 60 fps : coût doublé par rapport à 60 Hz × 1, d'où l'importance du sommeil.
- Changer la trajectoire des grenades modifie l'équilibrage et les tests de projectiles : à livrer avec l'étape A, avec ses propres tests.
- Si LOOP-05 change le découpage de la boucle, l'accumulateur de physique doit rester la seule source de cadence.

**Vérifier par.** node bancs/phys/drift.mjs ; node .../bench/phys/tunnel.mjs ; node .../bench/phys/variants.mjs rubble300 4 6 '[{"label":"120x1","hz":120,"sub":1},{"label":"60x2","hz":60,"sub":2}]'

**Contre-vérification.** Rejoué drift.mjs et tunnel.mjs : résultats identiques (60 Hz x 1 : pile à 90° et 5,8 m ; 120 Hz : 0 sur 160). Mesure indépendante (tunnel2.mjs, mur de 12 cm = épaisseur minimale réelle de METAL, 200 tirs par cas, vitesse latérale ajoutée) : 120 Hz x 1 = 0 traversée sur 800 (14, 24, 30, 40 m/s) ; 60 Hz x 2 = 1 sur 200 à 24 m/s (la vitesse de la grenade), 0 à 30, 2 sur 200 à 40. Le choix de 120 Hz est donc justifié pour la grenade. Objet de 5 kg contre une tôle dynamique de 2 cm : 0 sur 120 jusqu'à 40 m/s. Nuances : (a) 60 Hz x 2 n'est pas aussi stable qu'annoncé : pile de 10 encore à 85 mm/s à 5 s et 18,5 mm/s à 10 s, calme seulement vers 30 s (25 mm), contre 0,5 mm/s à 10 s en 120 Hz ; (b) en contrepartie 60 Hz x 2 endort le tas de 300 en 4,6 s au lieu de 11,9 s : coût total de la scène 495 ms contre 1 723 ms, soit -71 %, bien plus que les -25 % par image ; la décision mérite d'être revue une fois le sommeil corrigé (PHYS-V2) ; (c) sim.step reçoit un dt variable (game.js:677 borne dt à 0,12 s, 692 appelle sim.step(part)) : l'accumulateur donnera 1, 2 ou 3 pas de physique par image, donc l'interpolation de pose au rendu est obligatoire, pas optionnelle, et doit être alignée avec LOOP-05 ; (d) la grenade en sphère n'est pas prototypée (le noyau n'a que des boîtes) : cette partie reste plausible.

**Preuve corrigée.** 120 Hz x 1 : 0 traversée sur 960 au total (160 de l'auteur + 800). 60 Hz x 2 : 4 sur 960, dont 1 à 24 m/s.

**Gain corrigé.** -25 % par image mesuré pour 60 Hz x 2 (2,41 contre 1,80 ms, tas ; 0,90 contre 0,75 ms, explosion).

### PHYS-04 — Déterminisme : état identique entre processus et niveaux de JIT, à condition de trois règles d'écriture
- sévérité haute · catégorie architecture · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité identique · moteur (dans METAL)
- lieux : FERRO : src/physics.js (nouveau); bancs/phys/determinism.mjs; bancs/phys/restore2.mjs; src/simulation.js:1946

**Preuve.** determinism.mjs hache la position, le quaternion, les vitesses et les drapeaux de tous les corps toutes les 50 pas, sur les 4 scènes. Les lignes obtenues sont identiques (cmp) entre : deux processus par défaut, --no-opt, --max-lazy --no-sparkplug --no-maglev (300 et 500 pas), et --jitless contre défaut (100 et 200 pas). bench.mjs : un seul hachage par scène sur 4 à 5 répétitions.
Le noyau n'utilise dans son pas que + − × ÷, Math.sqrt, Math.abs, Math.floor, Math.imul et des comparaisons : toutes exactes selon IEEE 754, donc identiques d'un moteur JavaScript à l'autre. La simulation de METAL, elle, appelle Math.sin, cos, atan2, exp, log et hypot (par exemple simulation.js:420-421, 437, 1048), dont le résultat peut différer entre navigateurs.
Piège réel trouvé : restore2.mjs montrait une divergence dès le premier pas après restauration dans un monde neuf. Cause : l'inertie était recalculée par 3/(m × (hy² + hz²)) avec m = 1/(1/masse), qui diffère de la masse d'un bit. Corrigé en dérivant partout l'inertie de la masse inverse sérialisée ; depuis, première différence : aucune.
Autre constat : changer la taille de cellule de la grille change l'ordre des paires, donc le résultat (variants.mjs : endormissement à 8,87 s avec 2 m, 7,17 s avec 1 m), toujours de façon déterministe.

**Cause.** Un solveur itératif amplifie le moindre bit d'écart : sans cache d'impulsions, l'écart atteint 3,3 m en 5 s (restore.mjs). Le déterminisme ne tient donc que si chaque opération, chaque ordre de parcours et chaque grandeur dérivée sont fixés.

**Proposition.** Règles à écrire en tête de src/physics.js et à tester :
1) Dans step : aucune fonction Math autre que sqrt, abs, floor, imul, min, max. Les sinus et cosinus ne servent qu'à la création d'un corps (conversion d'angles en quaternion), jamais dans le solveur.
2) Ordre fixe : corps par indice croissant, cellules par balayage z puis x, statiques par ordre d'insertion, contacts dans l'ordre d'émission ; pas de Map, de Set ni de tri instable.
3) Grandeurs dérivées canoniques : matrice de rotation, inertie monde et enveloppe sont recalculées par la même fonction à la création, en fin de pas et à la restauration, à partir des seules grandeurs sérialisées (position, quaternion, masse inverse, demi-tailles).
4) Version de physique : taille de cellule, nombre d'itérations, tolérances et marge entrent dans physicsVersion (2 dans METAL) et dans l'empreinte ; les changer invalide proprement les anciens instantanés.
5) Sérialiser les nombres tels quels (JSON donne le plus court décimal exact ; aucun zéro négatif rencontré dans les instantanés, mais normaliser par x + 0 si un hachage par bits est utilisé).
Tests à ajouter (checks/physics.test.mjs) : hachage attendu figé pour pile, pyramide, tas et explosion ; même hachage avec node --no-opt.

**Gain attendu.** Rejeux de démo et points de reprise exacts avec la physique. Mesuré : chaînes de hachage identiques dans 5 modes d'exécution.

**Risques.** - L'égalité entre navigateurs (Chrome, Firefox, Safari) est attendue par construction mais n'a été vérifiée que sous V8.
- La simulation de METAL reste dépendante de Math.sin et consorts : la physique ne rend pas le jeu entier identique entre moteurs, elle ne l'empire pas.
- Tout changement de réglage du noyau change les trajectoires : figer les hachages de référence dans les tests rend ces changements visibles et volontaires.

**Vérifier par.** cd bancs/phys && node determinism.mjs > a.txt && node --no-opt determinism.mjs > b.txt && cmp a.txt b.txt && node restore2.mjs

**Contre-vérification.** Rejoué : determinism.mjs identique (cmp) entre défaut et --no-opt, et entre défaut et --jitless (100 et 200 pas). Recensement des fonctions Math du noyau : abs, sqrt, floor, imul dans le pas ; ceil, log2, min à la création. Écarts à corriger avant de figer les hachages : (1) fphys.mjs:11 utilise l'opérateur ** pour les seuils de sommeil, ce qui viole la règle 1 ; égal à x*x sur 2 millions de valeurs sous V8, mais non garanti ailleurs : écrire x*x ; (2) vérifié : JSON.stringify(-0) rend "0", le signe est perdu à la restauration ; normaliser par x+0 en fin de pas, pas seulement pour le hachage ; (3) hash() ne couvre ni les minuteries de sommeil, ni les numéros d'île, ni le cache d'impulsions : les y ajouter ; (4) restore.mjs restaure dans un monde dont les corps ont été créés dans le même ordre : la stabilité des indices après removeBody (liste libre, génération) n'est pas testée et doit être sérialisée ; (5) le déterminisme vaut pour une suite de dt donnée, la boucle étant à pas variable ; (6) égalité entre navigateurs non vérifiée, et la simulation de METAL reste dépendante de Math.sin et consorts : un rejeu de démo n'est exact que sur le même moteur JavaScript.

**Preuve corrigée.** Chaînes obtenues : stack10 37d0ca59, pyramid55 56c8b99b, rubble300 170702f6, blast200 fe961b81, identiques dans mes 3 modes.

### PHYS-05 — Allocations : un double passé en argument est mis en boîte par V8 — 57 Ko par pas, ramenés à 0 par un tampon typé
- sévérité moyenne · catégorie mémoire · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : FERRO : src/physics.js (nouveau); bancs/phys/fphys.v1-boxed-args.mjs; bancs/phys/alloc2.mjs

**Preuve.** alloc2.mjs (profileur d'allocation de V8, objets déjà collectés inclus), 600 pas après échauffement :
- première version (fphys.v1-boxed-args.mjs) : 57 032 octets par pas sur le tas de 300 gravats (43 666 dans collide, 13 312 dans face), 21 ramasse-miettes ; 11 637 octets par pas après l'explosion ;
- version corrigée : 7 et 3 octets par pas, qui viennent du profileur lui-même.
Les sites fautifs : la marge passée à boxBox, boxGround et face ; la limite passée à clip (4 fois par face) ; frottement et rebond passés à emit ; les 4 constantes passées à solve ; les coordonnées passées aux fonctions de cellule.
allocsame.mjs : les deux versions donnent les mêmes hachages après 700 pas (tas : 85c09f4b ; explosion : b93c7502 ; pyramide : 6d172292). Le correctif ne change donc rien à la simulation.
Rappel : la simulation actuelle alloue 534 à 864 Ko par pas (SIM-05).

**Cause.** Dans V8, les arguments d'un appel non intégré sont des valeurs étiquetées : un double qui n'est pas un petit entier devient un objet HeapNumber de 12 à 16 octets. Le code sans objet ni tableau alloue quand même.

**Proposition.** Règle d'écriture du noyau : aucune fonction interne appelée par paire ou par contact ne reçoit ni ne renvoie de double. Les paramètres flottants passent par un Float64Array de travail (SCR[0] marge, SCR[1..2] limites de découpage, SCR[3..4] frottement et rebond, SCR[5..8] constantes du solveur) ; les fonctions prennent un tableau et un indice au lieu d'une valeur. Les entiers (indices, compteurs) peuvent rester en arguments.
Même règle pour les variables de fermeture modifiées à chaque pas : les garder dans un tableau typé plutôt qu'en let flottant.
Test à ajouter dans l'outillage (pas dans npm test, trop lent) : script qui échoue au-delà de 64 octets par pas sur 600 pas.

**Gain attendu.** Mesuré : 57 Ko par pas → 0, 21 collectes → 0 sur 600 pas. Aucune pause de ramasse-miettes due à la physique, même avec 300 corps éveillés.

**Risques.** Lisibilité : les paramètres par tampon sont moins clairs, à documenter par un commentaire d'index. Un moteur autre que V8 peut se comporter différemment, mais la règle ne coûte rien ailleurs. Aucun effet sur le jeu : hachages identiques.

**Vérifier par.** cd bancs/phys && node --expose-gc alloc2.mjs && node allocsame.mjs

**Contre-vérification.** Mesure refaite avec le profileur d'allocation de V8 (session d'inspection interne au processus, aucun port) : noyau à doubles en arguments 57 084 octets par pas sur le tas (43 727 dans collide, 13 302 dans face) et 20 collectes en 600 pas, 11 567 octets par pas après l'explosion ; noyau corrigé 6 et 2 octets par pas, 1 collecte. allocsame.mjs : hachages identiques (85c09f4b, b93c7502, 6d172292). Constat et correctif exacts. Portée : comportement propre à V8, sans coût ailleurs. À garder comme test d'outillage, hors npm test.

### PHYS-06 — Sauvegardes : restauration exacte seulement avec le cache d'impulsions ; format compact et validation par bornes
- sévérité haute · catégorie architecture · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur et jeu
- lieux : src/simulation.js:64-66; src/simulation.js:1941-1959; src/simulation.js:1962; src/simulation.js:2070-2084; src/game.js:94-121; FERRO : src/physics.js (snapshot, restore)

**Preuve.** restore.mjs : instantané au pas 300, passage par JSON.stringify puis JSON.parse, restauration dans un monde neuf, poursuite :
- avec le cache d'impulsions : hachage identique à la partie ininterrompue (tas au pas 1 100 : 17089485 ; explosion au pas 900 : 3fa55997 ; pyramide au pas 300 : 6d172292) ;
- sans le cache : écart de position de 182 mm (tas), 3,3 m (explosion), 5,6 mm (pyramide).
Taille brute dans le pire cas (300 gravats tous éveillés) : 194 420 caractères, dont 84 271 pour 1 578 points de contact en cache et 367 par corps. Les points de reprise actuels font 82 à 274 K caractères (LOAD-14), avec une limite à 2 000 000 (simulation.js:1962).
Aujourd'hui : snapshot écrit les gravats par rubbleCopy (simulation.js:64-66, 1956) et restore refuse tout le point si un gravat au repos chevauche une boîte (2081) ; 5 à 10 points refusés sur 11 (LOOP-01). Avec de vrais contacts, un corps au repos ne chevauche plus rien au-delà de la tolérance de 5 mm : la règle n'a plus d'objet.

**Cause.** Le démarrage à chaud fait dépendre le pas suivant des impulsions du pas précédent : c'est un état caché. Et snapshot() ne peut pas le remettre à zéro dans la partie vivante, sinon sauvegarder changerait la suite de la partie (risque déjà noté par LOOP-01).

**Proposition.** Format physicsVersion 2, produit par FPhys.snapshot() et rangé dans state.phys :
- par corps : identifiant, position (3), quaternion (4), drapeaux ; pour les seuls corps éveillés : vitesses (6), minuterie de sommeil ; pour les endormis : numéro d'île ;
- cache d'impulsions des seuls contacts courants : clé de paire, identifiant de point, 3 impulsions ;
- accumulateur de pas.
Ne pas sérialiser ce qui se recalcule : matrices, inerties, enveloppes, grilles, et pour les accessoires générés leur forme, leur masse et leur matière (déduites de la graine du monde).
Encodage : tableaux de nombres en clair d'abord (simple, exact) ; si la taille gêne, base64 des octets Float64 (10,7 caractères par nombre au lieu de 17 environ, soit −40 %).
Estimation pour une partie typique (128 gravats, 100 accessoires, 48 pièces d'épave, 90 % endormis) : environ 25 à 35 K caractères.
Restauration : valider des bornes seulement (nombres finis, position dans les limites du monde ± 80 m, quaternion de norme 1 ± 1e-6, vitesses sous 40 m/s et 30 rad/s, identifiants uniques, clés de cache désignant des corps existants). Supprimer la règle de chevauchement de la ligne 2081 et la règle d'appui de la ligne 2080. Validation atomique conservée (candidat puis validation).
Compatibilité : accepter rubbleVersion 1 en convertissant chaque gravat en corps (au repos → endormi, même pose, angles convertis en quaternion) ; accepter physicsVersion 1 ou absent sans accessoires déplacés.
Test : sur 3 mondes générés, 30 s de combat, un aller-retour snapshot → JSON → restore toutes les 3 s : 11 réussites sur 11 et hachage FPhys identique à la partie ininterrompue 300 pas plus loin.

**Gain attendu.** Plus aucun point de reprise refusé pour cause de gravats (aujourd'hui 5 à 10 sur 11). Mesuré sur le prototype : suite identique bit à bit après restauration. Estimé : 25 à 35 K caractères de plus par point de reprise typique.

**Risques.** - Un point de reprise pris en plein éboulement grossit (jusqu'à 194 K caractères dans le pire cas mesuré) : rester sous la limite de 2 000 000 et, si besoin, reporter la sauvegarde de quelques images quand plus de 150 corps sont éveillés.
- Une sauvegarde forgée peut poser un corps dans un mur : le solveur le dégage à 3 m/s au plus, effet borné.
- Le nombre de champs contrôlé à la restauration (simulation.js:2071) change : passer par un numéro de version, pas par un compte de clés.
- Ne jamais muter l'état vivant dans snapshot().

**Vérifier par.** node bancs/phys/restore.mjs ; puis, une fois intégré : node bancs/loop/restorescan.mjs <metal> 30 (zéro refus sur 13 mondes) et le nouveau test de checks/.

**Contre-vérification.** Rejoué restore.mjs : hachages identiques avec le cache (17089485, 3fa55997, 6d172292), écarts de 182 mm, 3,3 m et 5,6 mm sans ; tailles 194 420, 85 957 et 44 304 caractères. Lignes 1946, 1956, 1962, 2071, 2080, 2081 vérifiées. Trois corrections : (1) le gain « plus aucun point de reprise refusé » n'appartient pas à FPhys : LOAD-01 (effort S) fait déjà passer 2 sur 55 à 55 sur 55 ; ce correctif critique doit être livré tout de suite et ne pas attendre un chantier XL ; (2) si l'on corrige le réveil (PHYS-V2) en conservant le cache des contacts endormis, il faut le sérialiser : environ 53 caractères par point, soit 30 à 35 K de plus pour 128 gravats, à ajouter à l'estimation ; (3) -0 perdu par JSON (PHYS-04) et indices de corps à stabiliser. La limite de 2 000 000 caractères reste tenue (274 K + 194 K au pire).

**Gain corrigé.** Restauration exacte : mesurée. Zéro refus de point de reprise : acquis par LOAD-01 indépendamment de la physique. Taille : 25 à 35 K caractères par point typique, 55 à 70 K si le cache des contacts endormis est conservé.

### PHYS-07 — Étape A — accessoires physiques : caisses, barils, palettes, tuyaux et tôles qui réagissent aux tirs, aux explosions et aux corps
- sévérité haute · catégorie physique · effort L · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/world.js:1207; src/world.js:1340; src/world.js:1390; src/world.js:1732-1766; src/simulation.js:220-241; src/simulation.js:838; src/simulation.js:933-958; src/simulation.js:1137; src/effects.js:169-199

**Preuve.** Aucun accessoire n'est dynamique aujourd'hui : world.js crée chaque boîte solide comme collider statique (58, 1207, 1278) et demolitionMetadata les classe « prop » (1350-1353). worldstats.mjs : 10 salles et 7 000 à 7 800 m² de sol par monde, 448 à 504 colliders pour un plafond de 512 (world.js:1760). Les tirs passent par hitRay (simulation.js:838) et ray (474-511), les explosions par explode (933-958) : aucun des deux ne connaît d'objet mobile.
Le prototype montre le comportement visé : blast200 (200 caisses et barils, piles de 3) : les piles tiennent, l'explosion réveille 198 corps, les projette sans traversée de mur, tout se rendort en 5,1 s ; coût moyen 0,42 ms par pas de 1/120 s, 0,76 ms au p95.

**Cause.** La génération ne connaît que des volumes statiques, et la simulation n'a pas de monde physique où les poser.

**Proposition.** Génération (world.js) : nouvelle fonction physicsProps(w), appelée avant demolitionMetadata (ligne 1340) pour que ces objets ne deviennent ni colliders statiques ni groupes destructibles. Sortie : w.physProps = [{id, kind, p, s, yaw, material, mass, hp, explosive}].
- Types et valeurs : caisse bois 0,8 m masse 30 ; caisse métal 0,6 m masse 45 ; baril 0,6 × 0,9 m masse 25 (explosif : hp 10) ; palette 1,2 × 0,14 × 1,0 m masse 15 ; tuyau 2 m masse 12 ; tôle 1,2 × 0,02 × 0,8 m masse 8 ; bloc béton 0,4 m masse 60.
- Placement : le long des murs et dans les angles des salles, piles de 1 à 3, grappes de 2 à 3 barils dans les salles de combat ; jamais à moins de 1,5 m d'une porte, d'une liaison, d'un ascenseur, d'un tremplin, d'un piège, d'un relais, d'un objet ou d'une baie de renforts, ni à moins de 6 m du départ pour les barils ; réutiliser safeSupply (world.js:1390).
- Densité : 8 à 12 par salle, soit 80 à 120 par monde ; moitié en qualité basse.
- Accessibilité (AGENTS.md) : les accessoires étant poussables, validate (world.js:1732-1766) les ignore ; la règle des 1,5 m autour des passages évite tout bouchon.
Simulation : créer phys = FPhys.create({bounds: world.bounds, gravity: -GRAVITY, capacity: 384}) ; statiques = solids, mis à jour dans syncDestruction (229-235) par updateStatics ; sols = rectangles de world.walkable ; portes, pièges et ascenseurs = boîtes cinématiques. Ajouter world.physProps à l'identité de l'empreinte (237-241). Nouveau updatePhysics(dt) appelé à la place de updateDebris.
- Tirs : dans fire, après hitRay, phys.ray(origine, direction, distance) ; si un corps est touché avant le mur ou la victime, la balle s'arrête dessus, impulsion au point d'impact (pistolet 6, mitraillette 4, plomb de fusil 3), événement materialImpact existant. Les objets servent donc de couvert mobile.
- Explosions : dans explode, phys.blast(point, rayon, puissance de terrain × 22, plafond 14 m/s).
- Barils : dégâts des balles et des souffles sur hp ; à 0, explosion après 0,15 + (id % 5) × 0,05 s avec les valeurs de la grenade.
Rendu : chaque corps produit un maillage dans FEffects.build comme les gravats structurels (effects.js:169-199), à partir de la matrice du corps.
Tests (checks/physics.test.mjs) : une pile de 3 tient 10 s ; une balle déplace une caisse dans le sens du tir ; une grenade projette les objets à moins de 3,2 m et pas ceux derrière un mur ; chaîne de 3 barils ; aller-retour de sauvegarde identique ; relais, sortie et objets toujours atteignables sur 18 mondes.
Critères : coût moyen de la physique sous 0,3 ms par image en combat ordinaire sur ordinateur, sous 1 ms au pire ; 262 tests existants verts.

**Gain attendu.** Les salles cessent d'être figées : on tire dans une pile et elle s'écroule, une grenade balaie une salle, les barils se répondent. Mesuré sur le prototype : 200 objets soufflés pour 0,42 ms moyen par pas. Estimé : 12 à 18 Ko de source côté METAL.

**Risques.** - L'empreinte du monde change : les points de reprise antérieurs à la version sont invalides (reprise à l'entrée du secteur, à annoncer).
- Équilibrage : des objets qui arrêtent les balles changent les lignes de tir du joueur et des ennemis (clearLane, simulation.js:1336, doit interroger phys.ray).
- Budget de primitives de rendu : 100 objets de plus à dessiner, à passer par l'instanciation statique tant qu'ils dorment.
- Mobile : diviser la densité par deux.
- Dépend de PHYS-02, 03, 04 et 06.

**Vérifier par.** Prototype : node bancs/phys/bench.mjs 4 120 1 (scène blast200). Intégré : npm test avec checks/physics.test.mjs ; banc bench/sim/ab2.mjs avant et après sur les 4 scénarios pour le coût du pas.

**Contre-vérification.** Diagnostic vérifié (world.js:1350-1353, plafond de 512 colliders à world.js:1760, 448 à 454 colliders mesurés). C'est la première étape visible de la demande de David. Mais plusieurs valeurs de la proposition sont réfutées par mesure (robust.mjs) : (1) impulsions des balles : 6, 4 et 3 sur une caisse de 30 en haut d'une pile de 3 donnent -0,7 mm, 0,1 mm et 0,3 mm ; le test d'acceptation « une balle déplace une caisse dans le sens du tir » échouerait et « on tire dans une pile et elle s'écroule » est faux ; il faut 30 pour 19 mm et 60 pour faire tomber la caisse ; même au sol, un pistolet à 6 déplace un baril de 25 de 0,1 mm et une tôle de 8 de 6 mm ; (2) tôle de 2 cm : au repos son centre est à 2,2 mm au lieu de 10 (8 mm sur 20 sous le sol), une pile de 5 tôles fait 60 % de sa hauteur, et une caisse lâchée dessus l'enfonce entièrement sous le sol pendant le choc (PHYS-V4) ; (3) la scène blast200 utilise un rayon de 14 m et une force de 900, pas la grenade du jeu (3,2 m) : avec 8 à 12 objets pour une salle de 700 m², une grenade en touche 0 à 3 ; « une grenade balaie une salle » n'est vrai que si les objets sont posés en grappes serrées ; (4) les objets reposeront sur des sols à 6 hauteurs et sur 102 joints coplanaires : PHYS-V1 est un prérequis, sinon une caisse poussée culbute au premier joint.

**Preuve corrigée.** Impulsions à retenir : pistolet 30 à 45, mitraillette 20 à 25 par balle, plomb de fusil 12 à 15 (soit 1 à 1,5 m/s sur une caisse de 30 ; 2 à 3 balles de pistolet font tomber la caisse du haut). Tôle : épaisseur de collision d'au moins 4 cm. Placement en grappes de 4 à 8 objets à moins de 3 m les uns des autres plutôt qu'uniforme le long des murs.

**Gain corrigé.** Coût de 200 objets soufflés rejoué : 0,46 ms moyen et 0,94 ms au p95 par pas sous charge (0,42 et 0,76 annoncés), cohérent.

### PHYS-08 — Étape B — gravats en vrais corps rigides : ils roulent, s'entassent, s'endorment, et les points de reprise passent
- sévérité haute · catégorie physique · effort L · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/simulation.js:68-83; src/simulation.js:876-893; src/simulation.js:992-1065; src/simulation.js:2070-2084; src/destruction.js:210-227; src/effects.js:169-199

**Preuve.** Aujourd'hui (simulation.js:1028-1065) : chaque gravat est une boîte alignée qui ne voit que le décor ; la rotation est ramenée à plat par interpolation (1047-1049) ; 4 passes de dépénétration au plus (1040-1044) ; les gravats naissent dans la géométrie restante (destruction.js:210-227) avec des pénétrations relevées jusqu'à 5,2 m (LOAD-01) ; des pièces coincées ne s'endorment jamais (LOAD-05 : 8 sur 128 après 70 s) ; chaque pièce au repos est revalidée à chaque pas (SIM-03).
Prototype, scène rubble300 (300 pièces de 5 matières, plaques comprises, lâchées dans une cour murée) : aucune pièce sous le sol ni hors des murs ; tas de 1,47 m de haut ; 1,72 ms médian par pas avec 289 pièces éveillées ; 0 µs une fois endormies. Défaut observé : il faut 11,9 s pour que tout dorme, le critère d'île attend la pièce la plus agitée.
Coût comparé par pièce en mouvement et par image : 8,2 à 9,2 µs aujourd'hui sans contact entre pièces, 6,4 à 9,1 µs avec FPhys et contacts complets.

**Cause.** Les gravats ont été conçus comme décor animé : pas de contact mutuel, pas de vraie rotation, et un invariant de repos que la simulation ne garantit pas mais que la restauration exige.

**Proposition.** 1) appendDebris (876-893) crée un corps FPhys pour chaque gravat structurel : boîte de demi-taille size/2 pour box et bevel ; sphère pour sphere ; capsule pour un cylindre allongé (rapport supérieur à 3), boîte englobante sinon ; boîte englobante réduite de 15 % pour octa, ring et foliage. Angles convertis en quaternion à la création. Masse, matière, graine et sourceId conservés.
2) Naissance dans la géométrie : réduire la forme de 4 %, puis 8 passes de dégagement par l'axe de moindre pénétration contre les statiques avant le premier pas ; si la pénétration dépasse encore la moitié de la plus petite demi-taille, le gravat ne heurte que le sol pendant 0,25 s. La vitesse de dégagement plafonnée à 3 m/s empêche toute éjection.
3) Éclats cosmétiques (64 au plus, durée sous 1,5 s) : hors FPhys, ou dans une couche qui ne heurte que le décor.
4) Supprimer debrisHalf, debrisFloor, debrisBoxes, debrisSupport, debrisSweep, debrisContact et updateDebris (8,2 Ko). s.debris reste la liste lue par le rendu : chaque entrée porte l'identifiant du corps, la position et la matrice sont relues depuis FPhys.
5) Sommeil : ajouter au critère d'île un repli par corps : éveillé depuis plus de 6 s avec moins de 2 mm de déplacement sur la dernière seconde → endormi d'office ; et scinder une île quand un sous-groupe est immobile depuis 1 s.
6) Destruction : à chaque révision, updateStatics réveille seulement les corps dont l'enveloppe touche une boîte retirée.
7) Sons : garder l'événement debrisLand (simulation.js:1020, audio.js:483) alimenté par les chocs de FPhys (PHYS-12).
8) Sauvegarde : voir PHYS-06 (rubbleVersion 2, conversion de la version 1).
9) Plafond de 128 gravats et politique de retrait inchangés (881-887).
Critères : zéro refus sur le banc restorescan (13 mondes) ; aucune paire de gravats au repos qui se pénètre de plus de 2 cm ; 128 gravats au repos coûtent moins de 10 µs par pas (0,9 à 2,1 ms aujourd'hui) ; une roquette dans un mur : moins de 1,5 ms de physique au pire pas sur ordinateur ; tous dorment en moins de 6 s.

**Gain attendu.** Les éboulis deviennent crédibles (pièces qui pivotent, glissent les unes sur les autres, forment un tas). Mesuré au premier tour : la revalidation au repos coûte 0,9 à 2,1 ms par pas pour 128 gravats ; avec le sommeil par île elle tombe à environ 5 µs (mesuré sur le prototype). Les refus de points de reprise liés aux gravats disparaissent par construction. Bilan de taille : −8,2 Ko, +6 à 8 Ko d'intégration.

**Risques.** - L'allure de tous les éboulements change : revoir les attentes de checks/simulation.test.mjs:1927-1996 et de checks/renderer-destruction.
- Pièces très élancées (cylindre de 14 m, plaque de 2 cm relevés par LOAD-05) : épaisseur minimale de 4 cm pour la collision, longueur plafonnée par la découpe existante (destruction.js:216-220).
- 48 gravats créés d'un coup dans un mur : pic de contacts, à borner par le gouverneur de PHYS-14.
- Le critère de sommeil actuel du prototype est trop lent (11,9 s) : le repli du point 5 est indispensable.
- Dépend de PHYS-02, 03 et 06.

**Vérifier par.** Prototype : node bancs/phys/bench.mjs 4 120 1 (scène rubble300). Intégré : node bancs/loop/restorescan.mjs <metal> 30 ; node .../bench/sim/debris-cost.mjs ; nouveau test « une roquette sur 3 murs, 300 pas, restore identique ».

**Contre-vérification.** Scène rubble300 rejouée : 0 corps sous le sol, endormissement à 11,93 s, 1,74 ms médian. Lignes 1028-1065, 1040, 1047 et destruction.js:223 vérifiées. Quatre réserves mesurées : (1) la scène borne les masses à 0,5 au minimum alors que destruction.js:223 les borne de 0,035 à 160 : une dalle de 160 lâchée sur 6 éclats de 0,035 finit posée au sol, les éclats entièrement à l'intérieur (dessous de dalle à -5 mm au lieu de 100), et ni 8 itérations ni 4 sous-pas n'y changent rien (PHYS-V3) ; (2) le critère « 128 gravats au repos coûtent moins de 10 µs » ne tient que tant que rien ne touche le tas : une seule impulsion de 6 réveille 286 corps sur 300 pendant 13,8 s, 2,9 ms par image, et 183 pièces se déplacent de plus de 2 mm (PHYS-V2) ; (3) le critère « tous dorment en moins de 6 s » n'est pas atteint par le prototype à 120 Hz (11,9 s) ; (4) la disparition des refus de points de reprise relève de LOAD-01, à livrer avant. Le coût par pièce en mouvement est du même ordre qu'aujourd'hui, pas inférieur : le gain est la qualité, pas le temps.

**Gain corrigé.** Qualité : mesurée sur prototype (tas sans traversée). Coût au repos : environ 5 µs par pas seulement si le réveil par île est corrigé ; sinon chaque tir dans un tas coûte 2,4 s de CPU cumulées sur 14 s.

### PHYS-09 — Étape C — les machines détruites se disloquent en pièces physiques au lieu de disparaître
- sévérité moyenne · catégorie physique · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/actors.js:16-17; src/actors.js:44-46; src/simulation.js:812-828; src/simulation.js:881-887; src/effects.js:169-199

**Preuve.** FActors.build renvoie une liste vide dès que hp<=0 (actors.js:17) : la machine s'efface en une image, remplacée par 18 à 32 particules (simulation.js:824). Un boss enchaîne 12 explosions scénarisées (819) puis disparaît aussi. Or le modèle est déjà une liste de pièces nommées avec forme, position, taille, rotation et couleur (fonction piece, actors.js:44-46, champ actorPart) : tout ce qu'il faut pour créer des corps. FEEL-14 note par ailleurs que les ennemis ne réagissent pas aux impacts.

**Cause.** La mort n'a pas d'état : aucun objet ne survit à l'ennemi, donc rien à simuler ni à dessiner.

**Proposition.** À la mort (damageEnemy, 818-824) :
1) Appeler une fois FActors.build sur une copie vivante de l'ennemi, au niveau de détail le plus bas, pour obtenir ses pièces.
2) Garder les 6 à 10 pièces les plus volumineuses (16 à 24 pour un boss), fusionner les autres dans la plus proche ; chaque pièce devient une boîte FPhys (taille s, rotation convertie en quaternion), matière métal, masse = volume × 65 bornée de 2 à 120.
3) Vitesse initiale : vitesse de l'ennemi, plus impulsion du coup fatal (direction du tir × 8 pour une balle, souffle radial pour une explosion), plus 1 à 2 m/s vers l'extérieur tirés de l'identifiant ; vitesse angulaire de 2 à 6 rad/s.
4) Les pièces rejoignent s.debris avec sourceId 'enemy:<id>' pour le rendu et la sauvegarde ; plafond de 48 pièces d'épave, retrait des plus lointaines endormies.
5) Variante « effondrement articulé » (après l'étape E) : relier torse, bassin et jambes par 3 à 5 rotules à rupture ; la machine s'affaisse puis se disloque au premier choc fort.
6) Boss : les 12 explosions existantes appliquent chacune phys.blast sur les pièces, la carcasse s'effondre par étages.
Le butin (dropLoot) et le score ne changent pas.
Tests : une machine tuée produit N pièces dont le centre de masse part dans le sens du tir ; les pièces dorment en moins de 5 s ; aller-retour de sauvegarde identique ; le compte de kills et le butin sont inchangés sur un scénario rejoué.
Critères : coût d'une mort sous 0,3 ms au pas de création ; jamais plus de 48 pièces ; aucune pièce dans un mur après 2 s.

**Gain attendu.** Chaque destruction laisse une épave qui tombe, roule et reste au sol : sensation de puissance et lisibilité des kills. Qualitatif. Coût estimé d'après le modèle du prototype : 8 pièces éveillées ≈ 60 µs par image pendant 2 à 4 s.

**Risques.** - Les pièces d'épave peuvent gêner le joueur ou l'IA : appliquer la règle de masse de la décision « gravats et épaves ».
- 12 ennemis tués d'une roquette : 96 pièces demandées, d'où le plafond de 48 et la fusion des petites pièces.
- Rendu : les pièces doivent reprendre couleur et matière de l'acteur, sans émissif.
- Taille : 4 à 6 Ko.
- La dépendance à FActors depuis la simulation est nouvelle : passer la liste de pièces par une fonction pure, sans état de rendu.

**Vérifier par.** Nouveau test dans checks/physics.test.mjs ; banc bench/feel (pilote de combat) avant et après : mêmes kills, mêmes dégâts, coût du pas comparé par bench/sim/ab2.mjs.

**Contre-vérification.** actors.js:17 vérifié (return [] si hp<=0), simulation.js:819-824 vérifiés. Conception non prototypée. Cohérente avec le noyau, coût estimé crédible (8 pièces éveillées, environ 60 µs par image) à condition de borner le rapport de masses des pièces (2 à 120 proposé : acceptable) et de ne pas fusionner les épaves dans l'île d'un tas de gravats (réveil global, PHYS-V2). Dépendance nouvelle de la simulation envers FActors : à passer par une fonction pure, comme le dit l'auteur, sinon les tests de simulation qui chargent simulation.js seul cassent.

### PHYS-10 — Étape D — contrôleur de personnage en capsule : pousser, monter sur les objets, saisir, lancer, frapper au bouclier
- sévérité haute · catégorie physique · effort XL · gain qualitatif
- contre-vérification : **plausible**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/simulation.js:208-213; src/simulation.js:260-273; src/simulation.js:274-297; src/simulation.js:336-360; src/simulation.js:403-472; src/simulation.js:785-797; FERRO : src/physics.js (sweepCapsule, corps cinématique)

**Preuve.** Le déplacement actuel teste un disque contre des boîtes alignées, axe par axe, par pas de 0,12 m (simulation.js:260-273) ; l'appui ne connaît que le sol, les ascenseurs et le dessus des boîtes statiques (208-213) ; pas de saut (FEEL-09) ; un obstacle arrête net la composante de vitesse (459-461). Rien ne permet de pousser un objet, de monter dessus ou d'être porté par lui. La touche d'interaction existe déjà (game.js:18, simulation.js:274-297) et la frappe de bouclier ne vise que les ennemis (785-797). FEEL-08 demande un déplacement inspiré de Quake 3 (accélération, frottement, contrôle en l'air) : le contrôleur doit en être la base commune.

**Cause.** Le corps du joueur n'existe pas dans un monde physique : il n'a ni masse apparente, ni contact avec autre chose que le décor fixe.

**Proposition.** Contrôleur cinématique, non simulé comme un corps libre (pas de glissade ni de basculement), en deux parties.
Dans FERRO (générique) : FPhys.character({radius:0.28, height:1.8, step:0.42, slope:0.7}) avec move(pos, déplacement) qui renvoie la position atteinte, la normale de contact, le corps d'appui et sa vitesse. Algorithme : balayage de capsule contre statiques et corps, glissement le long de la normale (3 itérations), montée de marche par essai haut puis avant puis bas, appui par balayage court vers le bas.
Interaction avec les corps :
- poussée bornée : un corps de masse m touché à vitesse v reçoit l'impulsion min(m × v, 60) par pas dans le sens du déplacement ; le joueur perd de la vitesse en proportion (aucune pour m sous 15, 40 % entre 15 et 60, arrêt au-delà) ;
- on monte sur un corps endormi ou lent si son dessus est à moins de 0,42 m, et l'on hérite de sa vitesse (plateformes mobiles, ascenseurs) ;
- la capsule du joueur est vue par les corps comme un obstacle cinématique : ils rebondissent dessus, ils ne le déplacent pas ; le choc alimente les dégâts cinétiques (PHYS-12).
Dans METAL : move() et airMove() appellent le contrôleur ; les lois de vitesse (accélération, frottement, saut de FEEL-08 et FEEL-09) restent dans locomote. Les ennemis utilisent le même contrôleur avec leur rayon (0,38 ou 1,05 m).
Saisir et lancer (décision de David) : nearestInteraction (274-285) ajoute un choix « Saisir » pour un corps visé à moins de 2,2 m et de masse au plus 40 ; l'objet tenu suit un point à 1,3 m devant la caméra par une contrainte souple (8 Hz, amortissement 1) et se lâche si l'écart dépasse 0,8 m ; tir = lancer à 12 m/s ; E = reposer.
Frappe de bouclier : dans shieldBash, phys.blast en cône (45°, 2,15 m) avec une impulsion de 220.
Tests : le joueur pousse une caisse de 30 sur 2 m en 1 s environ ; il monte sur une caisse puis sur une pile de 2 ; il ne traverse jamais un corps endormi ; une caisse lancée à 12 m/s tue une machine légère ; un ascenseur transporte joueur et caisse ; rejeu d'entrées identique.
Critères : aucun blocage du joueur par un objet de masse inférieure à 60 ; coût du contrôleur sous 20 µs par acteur et par pas.

**Gain attendu.** Le monde devient manipulable : on se fraie un chemin, on construit un escalier de caisses, on lance un baril sur un groupe. C'est le coeur de la sensation Half-Life 2. Qualitatif ; coût estimé de 10 à 20 µs par acteur.

**Risques.** - Étape la plus délicate : elle remplace le déplacement, donc tous les tests de collision, de chute, d'ascenseur et de tremplin (AGENTS.md).
- À coordonner avec FEEL-08 et FEEL-09 pour ne modifier le déplacement qu'une fois.
- Exploits possibles (se propulser en marchant sur l'objet qu'on porte) : un objet tenu ne sert jamais d'appui.
- Les ennemis qui poussent des objets peuvent se coincer : poussée bornée et repli sur la navigation (PHYS-13).
- Manette et tactile : la saisie réutilise l'action d'interaction existante, aucune touche nouvelle.
- Non prototypé : conception seulement.

**Vérifier par.** Tests de simulation nouveaux (pousser, monter, saisir, lancer, ascenseur) ; bancs bench/feel (déplacement, mêmes mesures d'arrêt et d'inversion que FEEL-08) et bench/sim/ab2.mjs pour le coût.

**Contre-vérification.** Lignes 260 (move) et 785 (shieldBash) vérifiées. Rien n'est prototypé : ni balayage de capsule, ni poussée, ni saisie. C'est le coeur du ressenti Half-Life 2 mais aussi l'étape la plus risquée (elle remplace le déplacement, donc tous les tests de collision, AGENTS.md). Deux alertes mesurées : une caisse poussée à 1,5, 2,5 ou 4 m/s sur des dalles jointives fait un saut de 16 à 19 cm et bascule à 90° (ratio.mjs), donc PHYS-V1 est un prérequis strict de la poussée ; le pas variable de la simulation face au pas fixe de 1/120 s impose de définir la pose de la capsule vue par les corps à chaque pas de physique. À fusionner avec FEEL-08 et FEEL-09 en une seule réécriture du déplacement.

### PHYS-11 — Étape E — articulations et éléments de niveau : charges suspendues, passerelles, bascules, portes battantes
- sévérité moyenne · catégorie physique · effort L · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · moteur et jeu
- lieux : src/simulation.js:27; src/simulation.js:298-316; src/simulation.js:361-366; src/world.js:1340; FERRO : src/physics.js (joints)

**Preuve.** Les mécanismes actuels sont des animations : portes par progression (simulation.js:298-302), ascenseurs à vitesse imposée (303-316), pièges à cycle (TRAP, ligne 27), tremplins balistiques (361-366). Aucun n'a de masse ni ne réagit à un choc. Le solveur du prototype traite déjà chaque point de contact comme une contrainte souple à impulsion accumulée et démarrage à chaud (fonction solve de fphys.mjs) : une articulation est la même mécanique avec une ou plusieurs lignes de plus.

**Cause.** Pas de contraintes entre corps : rien ne peut pendre, pivoter ou céder.

**Proposition.** Dans FPhys, quatre articulations résolues dans la même boucle que les contacts, avec la même contrainte souple :
- rotule (3 lignes) ;
- charnière (5 lignes, limites d'angle, frottement d'axe) ;
- distance ou câble (1 ligne, longueur minimale et maximale, inactive quand le câble est détendu) ;
- soudure cassable (6 lignes).
Chacune a une impulsion de rupture : au-delà, l'articulation est supprimée et un événement est émis. Les angles limites se testent par produits scalaires d'axes, sans fonction trigonométrique dans le solveur.
Sérialisation : liste des articulations vivantes et de leurs impulsions accumulées.
Éléments de niveau générés par world.js, chacun avec un test d'accessibilité :
- charge suspendue : caisse de masse 150 pendue par un câble de 2 à 4 m, que l'on décroche d'une balle (rupture à 40) pour écraser ce qui est dessous ;
- passerelle : 4 à 6 planches en charnières, rupture à 400 ;
- bascule : planche sur pivot ;
- porte battante ou trappe : charnière limitée de −95° à 95° ;
- pile retenue par une cale destructible.
Au plus 6 éléments par monde, jamais sur le chemin obligatoire tant que l'accessibilité n'est pas prouvée sans eux.
Machines : rotules à rupture pour l'effondrement articulé de l'étape C.
Tests : un pendule de 2 m garde sa longueur à 1 mm près sur 30 s ; une chaîne de 6 maillons reste stable 10 s ; la charge tombe quand le câble casse ; aller-retour de sauvegarde identique.
Critères : coût d'une articulation inférieur à celui de 3 points de contact ; aucune explosion numérique sur 60 s avec un rapport de masses de 10.

**Gain attendu.** Des situations de jeu nouvelles : faire tomber une charge sur un groupe, couper une passerelle derrière soi, pièges physiques lisibles. Qualitatif ; estimation de taille : 8 à 12 Ko dans FERRO, 6 à 10 Ko de génération dans METAL.

**Risques.** - Les chaînes longues et les forts rapports de masses sont le point faible des solveurs itératifs : limiter à 6 maillons et à un rapport de 10, ou ajouter des itérations locales.
- Toute modification de génération doit garder relais, sortie et objets accessibles (AGENTS.md).
- L'IA ignore ces éléments au départ : les placer hors des chemins de patrouille, puis les déclarer comme dangers.
- Non prototypé : conception seulement.

**Vérifier par.** Tests de simulation nouveaux (pendule, chaîne, rupture, sauvegarde) ; scène de banc à ajouter dans bench/phys/scenes.mjs une fois les articulations écrites.

**Contre-vérification.** Conception seule. Le critère « aucune explosion numérique avec un rapport de masses de 10 » n'est pas acquis avec les réglages du noyau : en simple empilement, 150 posé sur quatre caisses de 8 s'écroule à 2+1 itérations (3,7 m d'écart à 10 s) et tient à 4+2 itérations ou 2 sous-pas (35 mm) ; or 4+2 itérations coûte +51 % par image sur le tas (2,08 contre 3,14 ms, mesuré). La charge suspendue de 150 et les chaînes demanderont donc des itérations locales ou des sous-pas, à chiffrer avant de promettre « moins de 3 points de contact par articulation ». À faire en dernier.

### PHYS-12 — Dégâts cinétiques et sons d'impact par matière, tirés des impulsions de contact
- sévérité moyenne · catégorie audio · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · moteur et jeu
- lieux : src/simulation.js:771-784; src/simulation.js:812-828; src/simulation.js:1018-1024; src/audio.js:483; src/audio.js:717; FERRO : src/physics.js (events)

**Preuve.** Le solveur calcule déjà, pour chaque point de contact, la vitesse normale d'approche avant résolution et l'impulsion normale maximale (tableaux cV0 et cMax de fphys.mjs) : l'énergie d'un choc est disponible sans calcul supplémentaire. Côté jeu, un seul son de gravat existe : l'événement debrisLand, émis au-delà de 1,2 m/s avec matière, masse et énergie (simulation.js:1020), joué par materialCue (audio.js:483), limité à un par 0,16 s et par pièce. Aucun dégât ne vient d'un objet : hurt et damageEnemy ne sont appelés que par les armes, les souffles, les pièges et les boss.

**Cause.** Sans contact entre objets et acteurs, il n'y a ni énergie de choc à convertir en dégâts, ni variété d'impacts à sonoriser.

**Proposition.** Dans FPhys : après la résolution, pour chaque paire dont la vitesse d'approche dépasse 1,2 m/s et l'impulsion un seuil, pousser un événement {a, b, point, normale, impulsion, énergie = 0,5 × masse réduite × v², matières} dans une liste bornée à 16 par pas, triée par énergie décroissante. Aucune fonction de rappel dans le solveur.
Dans METAL :
- Sons : chaque événement devient debrisLand (gravat) ou physImpact (accessoire), avec matière, masse, énergie et power = min(100, racine(énergie) × 2), la formule actuelle. Limites : un son par corps toutes les 0,16 s, 6 par pas. Timbre par paire de matières (métal sur pierre : clair et court ; bois : mat ; baril vide : résonant, 90 à 140 Hz), volume et grave selon l'énergie ; frottement prolongé d'un objet poussé : bruit filtré proportionnel à la vitesse de glissement.
- Dégâts : choc entre un corps et un acteur d'énergie E au-dessus de 150 : dégâts = min(60, racine(E − 150) × 1,2) pour un ennemi, plafonnés à 25 pour le joueur, avec 0,5 s d'immunité envers un objet qu'il vient de pousser ou de lâcher. Écrasement : un corps de masse au moins 60 qui tombe sur un acteur à plus de 4 m/s tue une machine légère. Le crédit du kill va au joueur s'il a tiré, poussé ou lancé l'objet dans les 3 s.
- Les ennemis touchés par un objet reçoivent stun 0,25 s, comme pour un souffle (simulation.js:951).
Tests : une caisse de 30 lancée à 12 m/s inflige des dégâts à une machine légère et aucun à 2 m/s ; le joueur ne se blesse pas en poussant ; jamais plus de 6 sons par pas ; les événements sont identiques d'une exécution à l'autre.

**Gain attendu.** Les objets deviennent des armes et le monde sonne : chaque choc a un son lié à sa matière et à sa violence, ce qui répond aussi à la demande de sons moins « légers ». Qualitatif ; coût CPU négligeable (lecture de tableaux déjà calculés).

**Risques.** - Équilibrage : des dégâts cinétiques trop forts rendent les armes secondaires ; commencer bas et régler sur les bancs de combat.
- Injustice possible pour le joueur (objet projeté par une explosion ennemie) : d'où le plafond de 25.
- Mixage : rester sous les priorités existantes (audio.js:717) pour ne pas couvrir les tirs.
- La synthèse des timbres est du ressort de l'audio (4 à 6 Ko).

**Vérifier par.** Tests de simulation nouveaux ; mesure du nombre d'événements par pas sur les scènes blast200 et rubble300 du banc ; écoute sur appareil réel à documenter (AGENTS.md).

**Contre-vérification.** cV0 (vitesse d'approche, fonction prepare) et cMax (impulsion maximale, fonction solve) existent bien dans fphys.mjs. Précaution : avec les contacts spéculatifs, cV0 est aussi renseigné pour des points qui ne se touchent pas encore ; un événement ne doit être émis que si cMax est strictement positif, comme le fait déjà restitution(). La formule de dégâts est cohérente : caisse de 30 à 12 m/s, énergie 2 160, soit 54 points de dégâts ; à 2 m/s, énergie 60, aucun dégât. Répond aussi à la demande de sons moins légers, mais la synthèse reste à écrire.

### PHYS-13 — IA et navigation : les objets dynamiques doivent être vus comme obstacles, couverts ou choses à pousser
- sévérité moyenne · catégorie ia · effort L · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:512-516; src/simulation.js:1336; src/simulation.js:1349-1377; src/simulation.js:1383-1391; src/simulation.js:1402-1433; src/simulation.js:1445-1471

**Preuve.** La navigation est une grille de 0,8 m calculée sur le décor statique (simulation.js:512-516), des arêtes testées par segmentFree contre les boîtes statiques et les portes (1349-1377), et un rafraîchissement global à chaque révision de destruction (refreshNav, 1383-1391 ; constats SIM-01, IA-02, LOAD-02 : toute la grille et tout le cache d'arêtes). Aucun de ces chemins ne connaît d'objet mobile. Avec 100 accessoires, 128 gravats et 48 pièces d'épave, un ennemi butera sur une pile de caisses sans la contourner, et un rafraîchissement global à chaque objet qui s'endort serait ruineux (10 à 32 ms par recherche selon IA-01).

**Cause.** La navigation suppose un monde qui ne change que par destruction. Des obstacles qui se déplacent, s'endorment et se réveillent n'ont pas de place dans ce modèle.

**Proposition.** Trois classes d'objets, décidées par la masse et la hauteur :
1) Légers (masse sous 15, ou moins de 0,43 m de haut) : ignorés par la navigation ; les ennemis les poussent en marchant, avec la poussée bornée du contrôleur (PHYS-10).
2) Moyens (15 à 60) : coût de passage. Quand un tel corps s'endort, les cellules sous son enveloppe reçoivent un surcoût (× 3) dans A* ; l'ennemi passe ailleurs s'il le peut, sinon il pousse.
3) Lourds (plus de 60 et au moins 0,43 m de haut) : obstacles. À l'endormissement, les cellules couvertes sont marquées bloquées ; au réveil, elles sont libérées. La mise à jour est locale : seules les cellules de l'enveloppe et les arêtes qui les croisent sont invalidées. Cela exige l'invalidation locale proposée par SIM-01, IA-02 et LOAD-02, qui devient un prérequis.
Un corps éveillé n'est jamais dans la grille : l'évitement se fait au contact (glissement du contrôleur) et par un test phys.queryBox devant l'ennemi, toutes les 0,2 s, qui déclenche un pas de côté.
Budget : au plus 4 mises à jour locales de navigation par pas ; les autres attendent dans une file.
Lignes de tir : clearLane (1336) et sight interrogent aussi phys.ray, les objets cachent donc le joueur.
Couverts : cover() (1445-1461) peut retenir un corps lourd endormi comme abri candidat.
Danger : un baril explosif à moins de 3 m d'un ennemi en combat baisse la note de la position.
Tests : un ennemi contourne une pile de 3 caisses lourdes posée dans un couloir de 4 m ; il traverse un tas de petits gravats en les poussant ; aucun ennemi immobile plus de 2 s contre un objet sur 60 s de combat scripté ; coût de navigation par pas inchangé à ± 10 % avec 200 corps endormis.

**Gain attendu.** Les ennemis restent crédibles dans un monde encombré, et le joueur peut se barricader ou couper une ligne de tir avec des objets. Qualitatif ; coût estimé : une mise à jour locale touche 4 à 30 cellules au lieu de 37 000 à 44 000 (taille de grille relevée par BOSS-08).

**Risques.** - Dépend de l'invalidation locale de la navigation (premier tour) : sans elle, chaque objet lourd qui s'endort relance toute la grille.
- Un joueur peut tenter d'enfermer les ennemis : ils poussent tout objet de masse inférieure à 60 et tirent sur les autres (les accessoires sont destructibles).
- L'état de la grille devient dépendant des corps endormis : il se reconstruit à la restauration à partir de leurs poses, sans rien sérialiser de plus.
- Non prototypé.

**Vérifier par.** Tests de simulation nouveaux ; bancs bench/ia (pilotes de combat, mesure des arrêts et des recherches) avant et après, avec 200 corps endormis ajoutés.

**Contre-vérification.** Lignes 1336 (clearLane), 1349 (segmentFree), 1383 (refreshNav), 1445 (cover) vérifiées. Non prototypé. Dépend de l'invalidation locale de la navigation du premier tour (SIM-01, IA-02, LOAD-02), prérequis réel. La partie lignes de tir (clearLane et sight interrogeant phys.ray) est nécessaire dès l'étape A, sinon les ennemis tirent à travers les caisses qui arrêtent les balles du joueur : à sortir de ce constat et à livrer avec PHYS-07. Le marquage des cellules à l'endormissement dépend d'un sommeil fiable : avec le réveil global actuel, un tas réveillé libérerait puis rebloquerait des dizaines de cellules à chaque tir.

### PHYS-14 — Budget CPU : coût fixe et test de paires à optimiser, et un gouverneur de réveil pour borner le pire cas
- sévérité moyenne · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : FERRO : src/physics.js (nouveau); bancs/phys/fphys.mjs; bancs/phys/micro.mjs

**Preuve.** Modèle mesuré (micro.mjs, minimum de 400 pas identiques) : 0,39 à 0,49 µs par corps éveillé + 0,51 µs par point de contact + 0,28 à 0,43 µs par test de paire, plus un coût fixe.
- Coût fixe : pile de 10 mesurée à 46 à 59 µs pour 27 à 29 µs prévus par le modèle, soit 20 à 30 µs par pas dus à la remise à zéro de 3 tableaux de 4 096 cellules et d'une table de hachage de 32 768 entrées, quel que soit le nombre de corps.
- Tas dense : 1 139 à 1 205 tests de paires pour 280 corps (4 par corps) ; phases.mjs attribue environ 49 % du pas à la détection, 10 % à la préparation, 34 % au solveur, 7 % à la finition.
- Pire cas observé : 300 gravats tous éveillés = 2,65 ms par image à 120 Hz × 1 ; 200 objets soufflés = 0,92 ms par image.
- Régime courant attendu : 20 à 60 corps éveillés à la fois, soit 0,1 à 0,5 ms par image.
Références du premier tour : pas de simulation de 0,16 à 0,28 ms en moyenne, pointes de 8 à 32 ms dues à route().

**Cause.** Le prototype vise la justesse : grilles denses remises à zéro en entier, test générique boîte orientée contre boîte orientée même quand l'une est alignée, données de contact dupliquées par point. Et rien ne limite le nombre de corps réveillés d'un coup.

**Proposition.** Optimisations sans effet sur le résultat (à prouver par hachage identique, comme allocsame.mjs) :
1) Coût fixe : ne remettre à zéro que les cellules touchées au pas précédent (liste des cellules occupées) ; table de hachage dimensionnée sur le nombre de contacts du pas précédent ; sortie immédiate si aucun corps n'est éveillé (déjà 5 µs).
2) Tableaux du noyau en constantes de module quand le jeu n'a qu'un monde : V8 les traite comme constantes au lieu de les relire dans la fermeture.
3) Test boîte orientée contre boîte alignée spécialisé (matrice identité : 9 produits en moins, axes de face directs) : tous les contacts avec le décor en profitent.
4) Déroulage des boucles sur 3 axes dans le test de paires.
Optimisations qui changent le résultat (donc la version de physique) :
5) Cellule de 1 m pour les corps de moins de 1 m.
6) Données partagées par paire (normale, corps, masses) au lieu de par point.
Gouverneur de pire cas, déterministe :
7) Plafond de 160 corps éveillés : au-delà, les îles les plus lentes et les plus éloignées du joueur sont endormies d'office (critère : vitesse puis indice, jamais le temps réel).
8) Budget de naissance : au plus 24 corps créés par pas, les autres en file (48 gravats d'une roquette étalés sur 2 pas).
9) Compteurs exposés (corps éveillés, contacts, tests, temps par phase) pour l'instrumentation demandée par RGPU-11.
Critères : coût fixe sous 5 µs par pas ; tas de 300 sous 1,2 ms par pas de 1/120 s sur ordinateur non chargé ; jamais plus de 1,5 ms de physique par image en jeu avec le gouverneur.

**Gain attendu.** Estimé : −20 à −30 µs de coût fixe par pas, −20 à −35 % sur la détection contre le décor, −10 à −20 % sur le pas total d'un tas. Le gouverneur borne le pire cas à environ 1,5 ms par image au lieu de 2,65 ms mesurés.

**Risques.** - Les points 5 à 8 changent les trajectoires : à décider avant de figer les hachages de référence.
- Le gouverneur ne doit dépendre que de l'état simulé, jamais du temps mesuré, sinon rejeux et sauvegardes divergent.
- Endormir d'office peut figer un objet en l'air : n'endormir que des corps en contact.
- Mesures prises sous forte charge : refaire les bancs sur machine calme avant de fixer les seuils.

**Vérifier par.** cd bancs/phys && node micro.mjs 400 120 1 && node phases.mjs rubble300 900 ; pour les points 1 à 4 : hachages de determinism.mjs inchangés.

**Contre-vérification.** Coût fixe confirmé et plus lourd à l'échelle de METAL (seams.mjs, T8, meilleure moyenne de 5) : monde entièrement endormi 4,7 µs par pas ; un seul corps éveillé 50,3 µs par pas sur une grille de 206 x 134 m (6 901 cellules) contre 35,3 µs sur la grille du banc (4 096 cellules). À 120 Hz cela fait 0,1 ms par image dès qu'un objet bouge, soit 35 à 60 % du pas de simulation moyen actuel (0,16 à 0,28 ms) : le point 1 (remise à zéro limitée aux cellules touchées, table dimensionnée) est important pour la fluidité, pas un détail. La qualité « identique » ne vaut que pour les points 1 à 4, à prouver par hachage ; les points 5 à 8 changent les trajectoires, et le gouverneur (point 7) fige visiblement des objets : il doit rester un filet de sécurité. La vraie borne du pire cas est le réveil partiel des îles (PHYS-V2), plus efficace que le plafond de 160. Les parts par phase (49 % détection, 34 % solveur) n'ont pas été remesurées.

**Preuve corrigée.** Coût fixe : 45 à 50 µs par pas dans un monde de la taille de METAL (30 à 60 annoncés sur la petite grille). Pire cas du tas : 2,4 à 3,7 ms par image, pire image 3,8 à 5,5 ms.

**Gain corrigé.** Point 1 : -40 à -45 µs par pas en jeu (estimé), soit environ -0,09 ms par image à 120 Hz dès qu'un corps est éveillé.

### PHYS-15 — Réutilisation : ce que BITUME et Point de rupture attendent du même noyau
- sévérité basse · catégorie architecture · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité sans objet · moteur (dans METAL)
- lieux : BITUME : src/course.js:181-200; BITUME : src/conduite.js; Point de rupture : Jeu/src/sim/travailleur.js; FERRO : src/physics.js (nouveau)

**Preuve.** BITUME : les contacts entre voitures sont des rectangles de 4,5 × 1,9 m séparés dans le repère curviligne de la piste, avec des coefficients en dur (src/course.js:181-200) ; la conduite est dans src/conduite.js (14 Ko) ; aucun débris ni objet de bord de piste mobile. Point de rupture : la simulation tourne dans un worker (Jeu/src/sim/travailleur.js) avec monde.js, nav.js, regles.js ; aucune recherche de « débris » ou « épave » n'y trouve de physique. Les deux jeux tournent à 1/120 s (rapport wf2 FERRO-09). Le rapport FERRO précédent classait collisions et rayons « pas maintenant : besoins trop propres à chaque genre ». Lecture seule, aucun fichier touché.

**Cause.** Chaque jeu a écrit le minimum de collision nécessaire à son genre ; aucun n'a de dynamique d'objets, donc aucun effet d'accident ou de destruction physique.

**Proposition.** Exigences à inscrire dans la conception de FPhys pour qu'il serve aux trois jeux sans réglage propre :
1) Aucune notion de jeu, aucun DOM, aucun accès au rendu : le module fonctionne tel quel dans un worker (Point de rupture) ; ses tableaux typés peuvent être transférés ou partagés pour le rendu.
2) Monde non borné ou très grand : grille hachée en option au lieu de la grille dense (un circuit fait plusieurs kilomètres, une ville aussi).
3) Gravité et axe vertical paramétrables ; échelle de tolérances (marge, tolérance d'appui) proportionnelle à une taille de référence.
4) Corps cinématiques pilotés par le jeu : les voitures de BITUME gardent leur modèle de conduite et sont vues par FPhys comme des boîtes cinématiques qui poussent cônes, barrières, pneus et débris ; plus tard, châssis en corps rigide avec roues par rayons (ray existe déjà dans l'API).
5) Contacts voiture contre voiture : une boîte orientée par voiture et le même test de paires remplacent les rectangles curvilignes, avec impulsion au point de contact (tête-à-queue réaliste).
6) Couches et masques de collision (débris qui ne gênent pas les voitures au-delà de quelques secondes, foule de Point de rupture ignorée).
7) Budget et gouverneur (PHYS-14) réglables par jeu : Point de rupture a beaucoup d'objets lointains, donc sommeil agressif et simulation seulement près de la caméra.
8) Instantané et hachage identiques pour les rejeux (BITUME enregistre des courses, Point de rupture a un protocole de simulation).
9) Stockage en Float32 en option pour diviser la mémoire et la taille des instantanés quand le monde est petit ; Float64 par défaut.
Ordre conseillé : METAL étapes A et B d'abord (elles stabilisent l'API), puis débris d'accident et objets de bord de piste dans BITUME, puis débris et épaves dans Point de rupture.

**Gain attendu.** Un seul noyau testé pour trois jeux : accidents et objets de piste physiques dans BITUME, débris et épaves dans Point de rupture, sans réécrire la détection ni le solveur. Qualitatif.

**Risques.** - Une autre session travaille sur BITUME (arbre physique/conduite verrouillé) et sur Point de rupture : ne rien y intégrer sans coordination.
- La règle de FERRO (« sert à au moins deux jeux ou générique ») est respectée par le caractère générique, mais le second usage réel n'existe pas encore : d'où la décision laissée à David.
- Les besoins de conduite (pneus, suspension) restent propres à BITUME et ne doivent pas entrer dans le noyau.

**Vérifier par.** Revue de l'API de src/physics.js contre cette liste ; essai dans un worker (node:worker_threads) de la scène rubble300 avec hachage identique au fil principal.

**Contre-vérification.** BITUME src/course.js:181 vérifié (contacts en rectangles de 4,5 x 1,9 m dans le repère de la piste) ; Point de rupture Jeu/src/sim contient bien travailleur.js, monde.js, nav.js, regles.js. Aucun des deux n'a d'usage réel aujourd'hui : c'est une liste d'exigences de conception, utile mais sans urgence. Le dossier FERRO est absent de cette machine, donc rien n'est vérifiable côté moteur. La grille hachée (point 2) recoupe le coût fixe mesuré en PHYS-14 : à faire une seule fois. Ne rien intégrer dans BITUME ni Point de rupture, d'autres sessions y travaillent.

## Constats ajoutés par le contre-vérificateur

### PHYS-V1 — Arêtes internes : une caisse qui glisse ou qu'on pousse sur des boîtes statiques jointives bute, saute de 16 à 45 cm et culbute
- sévérité haute · catégorie physique · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : bancs/phys/fphys.mjs:124-156 (boxBox : choix de l'axe de moindre pénétration); bancs/phys/fphys.mjs:205-212 (collide : test contre chaque statique isolément); src/world.js:1350-1353; src/simulation.js:220-235; FERRO : src/physics.js (setStatics, updateStatics)

**Preuve.** Scripts bancs/phys-verif/robust.mjs, seams.mjs et ratio.mjs, sur le noyau fphys.mjs inchangé.
- Glissade à 9 m/s, caisse de 0,8 m et 30 kg : sur une seule boîte de 24 m, 5,10 m parcourus, saut 0 mm, inclinaison 0,05° ; sur 24 boîtes jointives de 1 m au même niveau, 3,09 m, saut de 445 mm, vitesse verticale 3,3 m/s, bascule à 90°.
- Indépendant de la tolérance d'appui : mêmes sauts (161 à 401 mm) avec 5 mm, 2 mm et 0 mm, à 6 et 9 m/s.
- Poussée lente (vitesse plafonnée à 1,5, 2,5 et 4 m/s, le cas du joueur qui pousse) : sur une dalle, aucun saut ; sur 24 dalles, saut de 159 à 194 mm et bascule à 90° dans les trois cas.
- Caisse poussée le long d'un mur : mur en une boîte, 0 arrêt, rotation 0,1° ; mur en 12 boîtes bout à bout, 4 coups d'arrêt, rotation 90°, distance divisée par deux.
- Pile de 10 posée à cheval sur un joint : 89 mm d'écart à 10 s et encore 10 mm/s, contre 24 mm sur une boîte unique.
- Le décor de METAL est concerné (worldgeo.mjs, 3 mondes) : 102 paires de colliders à dessus coplanaires jointifs sous 3 m, 163 paires de faces verticales coplanaires bout à bout, 26 rectangles de sol sur 6 hauteurs (-0,25 ; 0 ; 1,6 ; 3,2 ; 4,8 ; 6,4 m). La destruction découpe en plus les murs en morceaux, donc multiplie les joints.

**Cause.** Chaque boîte statique est testée seule. À l'approche d'un joint, l'axe séparateur retenu est la face latérale de la boîte suivante (séparation positive, donc contact spéculatif) : le solveur interdit de franchir ce plan alors que la face est enterrée contre la boîte voisine. Le prototype n'a été validé que sur un plan de sol unique et des murs isolés, cas où le défaut ne peut pas apparaître.

**Proposition.** Dans FPhys, à setStatics et updateStatics (hors du pas, donc sans coût par image) :
1) Fusion, pour la physique seulement, des boîtes alignées dont l'union est exactement une boîte (dessus et côtés coplanaires à 1 mm).
2) Pour chaque face de chaque boîte statique, un masque « face interne » : vrai si une boîte voisine la recouvre ou la prolonge de façon coplanaire à moins de 6 mm sur la zone de contact.
3) Dans le test boîte contre statique : si l'axe retenu est une face marquée interne et que le point le plus profond est à moins de 3 cm du plan de la face coplanaire voisine, écarter cet axe et reprendre la face coplanaire (le dessus pour un sol, la face du mur pour un mur) ; un contact spéculatif (séparation positive) sur une face interne est toujours écarté.
4) Sols : chaque rectangle de world.walkable devient une dalle statique épaisse de 0,5 m sous la surface (boîte orientée pour les 3 à 6 pentes), avec le même masque ; pas un « plan borné » testé par les seuls sommets, qui laisserait une boîte s'enfoncer au bord d'un palier.
5) updateStatics recalcule les masques des seules boîtes voisines d'une boîte changée.
Critères d'acceptation (scripts fournis) : sur 24 dalles, distance égale à celle d'une dalle unique à 5 % près, saut sous 5 mm, inclinaison sous 1°, à 1,5, 4 et 9 m/s ; mur en 12 boîtes : 0 coup d'arrêt ; pile de 10 sur un joint sous 30 mm à 10 s.

**Gain attendu.** Supprime le défaut le plus visible d'un moteur physique dans un décor fait de boîtes : objets qui accrochent des arêtes invisibles. Prérequis de la poussée par le joueur (PHYS-10) et des accessoires (PHYS-07). Problème mesuré, correctif estimé.

**Risques.** Change les trajectoires : à faire avant de figer les hachages de référence (PHYS-04). Un masque trop large laisserait un objet traverser un vrai rebord : limiter l'écart à 3 cm et tester une marche de 5 cm, qui doit toujours bloquer. Après destruction, les masques doivent suivre, sinon un morceau de mur isolé garderait une face marquée interne.

**Vérifier par.** node bancs/phys-verif/seams.mjs ; node bancs/phys-verif/ratio.mjs (lignes « poussee ») ; node bancs/phys-verif/robust.mjs (lignes T1 et T5)

### PHYS-V2 — Réveil par île entière : une seule balle dans un tas endormi réveille 286 corps pendant 14 s (2,9 ms par image) et le tas se réarrange
- sévérité haute · catégorie perf-cpu · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur (dans METAL)
- lieux : bancs/phys/fphys.mjs:184-185 (wakeIsland, wake); bancs/phys/fphys.mjs:199-221 (collide : corps réveillés non traités); bancs/phys/fphys.mjs:300-304 (cache réécrit à chaque pas); FERRO : src/physics.js (sommeil, cache, snapshot)

**Preuve.** Script bancs/phys-verif/wake.mjs : tas de 300 gravats endormi, puis une impulsion de 6 (la valeur proposée pour le pistolet) sur la pièce du haut.
- 120 Hz x 1 : 286 corps réveillés, 13,83 s avant rendormissement, 2 392 ms de CPU cumulées, soit 2,88 ms par image pendant 13,8 s ; 183 autres pièces déplacées de plus de 2 mm, jusqu'à 540 mm.
- Impulsion de 45 : 286 corps, 16,0 s, 2 500 ms.
- 60 Hz x 2 : 287 corps, 14,6 s, 1,81 ms par image.
Sur une pile (robust.mjs, T3) : pile de 10 endormie réveillée par une impulsion de 0,001 : vitesse verticale jusqu'à 252 mm/s et 6,3 mm de déplacement des autres caisses, sans cause physique ; pile de 3 : 0,4 mm, invisible.
Causes lues dans fphys.mjs : wakeIsland réveille tous les corps de même numéro d'île (ligne 184) ; le cache d'impulsions est écrasé à chaque pas par les seuls contacts courants (pn = nc, ligne 302), donc celui d'une île endormie est perdu et le démarrage à chaud repart de zéro ; les corps réveillés pendant la détection sont ajoutés après la borne first (lignes 199 et 221) : ils subissent la gravité un pas entier sans aucun contact.

**Cause.** Le sommeil est décidé et levé par île de contact. Un tas de gravats est une seule île : tout contact, même infime, réveille tout le tas, qui a perdu ses impulsions mémorisées et doit retrouver son équilibre, lentement puisque le critère d'île attend la pièce la plus agitée. Le rapport d'origine a mesuré le coût d'un tas qui s'endort, jamais celui d'un tas qu'on touche.

**Proposition.** 1) Réveil par propagation au lieu du réveil d'île : un corps endormi touché par un corps éveillé n'est réveillé que si la vitesse d'approche au contact dépasse 0,25 m/s ou si l'impulsion normale dépasse 0,25 x sa masse ; en dessous, il est traité comme statique pour ce contact. Le réveil se propage d'une couche de voisins par pas tant que le seuil est dépassé. Les réveils explicites (explosion, statique retiré sous le corps, saisie) restent immédiats.
2) Cache d'impulsions persistant pour les contacts des corps endormis : rangé à l'endormissement, rendu au réveil, sérialisé dans l'instantané (environ 53 caractères par point en clair).
3) Un corps réveillé pendant la détection n'est ni intégré ni soumis à la gravité dans ce pas : son réveil prend effet au pas suivant, avec détection complète.
4) Sommeil par corps avec repli (déjà proposé en PHYS-08, point 5), pour que le tas se rendorme en moins de 2 s.
Critères d'acceptation : wake.mjs : au plus 16 corps réveillés par une impulsion de 6, rendormis en moins de 2 s, moins de 60 ms de CPU cumulées, aucune autre pièce déplacée de plus de 2 mm ; pile de 10 réveillée par 0,001 : vitesse verticale sous 20 mm/s.

**Gain attendu.** Estimé : de 2 392 ms cumulées sur 13,8 s à moins de 60 ms par tir dans un tas. C'est la borne de pire cas la plus efficace pour la fluidité, avant le gouverneur de PHYS-14. Avec le plafond de 128 gravats de METAL, le défaut actuel représenterait environ 1,2 ms par image pendant une dizaine de secondes à chaque balle perdue dans un éboulis.

**Risques.** Un seuil de réveil trop haut laisse un objet posé sur un support qui glisse lentement : garder le réveil immédiat quand le support est retiré ou déplacé de plus de 5 mm. Le cache persistant grossit l'instantané (30 à 35 K caractères pour 128 gravats). Change les trajectoires : à décider avant de figer les hachages. Doit rester purement fonction de l'état simulé pour le déterminisme.

**Vérifier par.** node bancs/phys-verif/wake.mjs ; node bancs/phys-verif/robust.mjs (lignes T3)

### PHYS-V3 — Rapports de masses réels des gravats (0,035 à 160) non tenus : une dalle lourde avale les éclats, une pile lourd-sur-léger s'écroule
- sévérité moyenne · catégorie physique · effort S · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/destruction.js:223; src/simulation.js:876-893; bancs/phys/scenes.mjs (rubble300 : masse minimale 0,5); FERRO : src/physics.js (addBody, masques de collision)

**Preuve.** destruction.js:223 borne la masse d'un gravat de 0,035 à 160, soit un rapport de 4 500 ; la scène rubble300 du banc la borne à 0,5 au minimum.
Scripts bancs/phys-verif/seams.mjs (T2b), robust.mjs (T2) et ratio.mjs :
- Dalle de 160 (1 x 0,2 x 1 m) lâchée de 0,5 m sur 6 éclats de 10 cm : avec des éclats de 0,035, le dessous de la dalle finit à -5 mm au lieu de 100 (éclats entièrement dans la dalle), endormi ainsi en 0,83 s ; éclats de 0,5 : 52 mm ; éclats de 2 : 80 mm. Pendant le choc, le dessous des éclats descend à 38 à 76 mm sous le sol.
- Rien n'y fait côté solveur : 4+2 itérations, 8+2 itérations, 2 ou 4 sous-pas donnent toujours -5 mm et 54 mm.
- Pile 8, 8, 8, 8, 150 : écroulée à 2+1 itérations (3 665 mm d'écart à 10 s) ; 35 mm à 4+2 itérations, 36 mm avec 2 sous-pas, 3 mm avec 4 sous-pas. Alternance 8 et 60 sur 6 étages : 129 mm et encore 44 mm/s à 10 s.
- Coût de 4+2 itérations sur le tas de 300 : 3,14 contre 2,08 ms par image, soit +51 % (variants.mjs apparié).

**Cause.** Un solveur à impulsions séquentielles converge mal quand un corps lourd repose sur un corps bien plus léger : la contrainte souple et 2 itérations ne transmettent pas la charge. Le rapport d'origine n'a testé que des piles de masses égales.

**Proposition.** 1) Masse physique distincte de la masse de jeu : à l'entrée dans FPhys, masse = clamp(masse, 3, 120), soit un rapport maximal de 40 ; la masse d'origine reste celle des sons et des dégâts.
2) Éclats de moins de 1 kg : couche qui ne heurte que le décor et les corps de moins de 20 fois leur masse ; ils ne peuvent pas soutenir une dalle, elle les écarte.
3) Accessoires de PHYS-07 : garder un rapport d'au plus 8 entre objets empilables (8 à 60 proposé : limite), et ne jamais générer un objet de plus de 4 fois la masse de celui qui le porte.
4) Ne pas répondre par plus d'itérations partout (+51 %) ; réserver 4+2 aux îles qui contiennent une articulation (PHYS-11).
Critères d'acceptation : ratio.mjs : dessous de dalle à au moins 85 mm ou éclats chassés sans passer de plus de 5 mm sous le sol ; pile 8, 8, 8, 8, 150 sous 40 mm à 10 s avec le réglage retenu.

**Gain attendu.** Des éboulis sans pièces encastrées les unes dans les autres ni petites pièces enfoncées dans le sol. Problème mesuré, correctif estimé.

**Risques.** La masse bornée modifie légèrement la réaction aux explosions des très petites pièces (elles volent moins loin) : compenser par le plafond de vitesse du souffle. Le masque par classe de masse doit être déterministe et sérialisé avec le corps.

**Vérifier par.** node bancs/phys-verif/ratio.mjs ; node bancs/phys-verif/seams.mjs (lignes T2b)

### PHYS-V4 — Objets minces : la tolérance d'appui de 5 mm enterre 40 % d'une tôle de 2 cm, et un choc la fait passer entièrement sous le sol
- sévérité moyenne · catégorie physique · effort S · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : bancs/phys/fphys.mjs:9 (slop 0,005, marge 0,02); bancs/phys/fphys.mjs:262 (séparation + slop); src/destruction.js:216-223; FERRO : src/physics.js (addBody)

**Preuve.** Script bancs/phys-verif/robust.mjs (T4), avec la tôle de 1,2 x 0,02 x 0,8 m et de masse 8 proposée en PHYS-07 :
- tôle au sol sous une caisse de 30 lâchée à 8 m/s : centre de la tôle à -10,1 mm au pire (tôle entièrement sous le plan du sol), dessous de la caisse à -5,1 mm ; au repos, centre à 2,2 mm au lieu de 10 (8 mm sur 20 dans le sol) et dessous de la caisse à 4,6 mm au lieu de 20 ;
- pile de 5 tôles au repos : centres à 2,0 ; 12,3 ; 23,8 ; 36,4 ; 50,2 mm au lieu de 10, 30, 50, 70, 90, soit une pile de 60 mm au lieu de 100.
Par comparaison, la pile de 10 caisses de 0,8 m se tasse de 84 mm sur 8 m (1 %), invisible. Le premier tour (LOAD-05) relevait des gravats en plaques de 2 cm : le cas existe déjà dans le jeu.

**Cause.** La tolérance d'appui (5 mm) et la marge (2 cm) sont des constantes absolues, réglées pour des caisses de 0,8 m. Pour un corps dont la demi-épaisseur (1 cm) est inférieure à la marge, la tolérance représente un quart de l'épaisseur par interface et la contrainte souple laisse passer le reste sous charge.

**Proposition.** 1) Épaisseur de collision minimale de 4 cm (demi-taille 2 cm) pour tout corps, accessoires compris et pas seulement les gravats ; le maillage garde son épaisseur réelle, posé sur le bas de la boîte de collision.
2) Tolérance d'appui par contact : min(5 mm, 12 % de la plus petite demi-taille des deux corps), valeur stockée par corps à la création (grandeur dérivée canonique, règle 3 de PHYS-04).
3) Rendu : remonter chaque corps de la moitié de sa tolérance pour que l'appui paraisse exact.
4) Dans la spécification de PHYS-07, remplacer la tôle de 2 cm par une tôle de 4 cm, ou la traiter comme décor non empilable.
Critères d'acceptation (robust.mjs, T4) : centre de la tôle au repos à moins de 2 mm de sa position idéale ; pile de 5 tôles à au moins 90 % de sa hauteur ; pendant le choc, aucun point à plus de 3 mm sous le sol.

**Gain attendu.** Plaques, tôles et palettes posées net sur le sol et les unes sur les autres, au lieu de s'y enfoncer à moitié. Problème mesuré, correctif estimé.

**Risques.** Une tolérance plus petite ajoute du tremblement à la pose (mesuré par l'auteur : 97 mm d'écart transitoire sur la pile de 10 avec 2 mm) : ne la réduire que pour les corps minces, pas globalement. Change les trajectoires : à décider avant de figer les hachages de référence.

**Vérifier par.** node bancs/phys-verif/robust.mjs (lignes T4 et T4b)

# Axe RESTE — RESTE — profil résiduel après les correctifs du premier tour (METAL 673d6b2, moteur FERRO)

Origine : second tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Axe RESTE. Tout est dans bancs/reste/ ; les dépôts n'ont pas été modifiés (git status de METAL vide, correctifs appliqués en mémoire). Les tests npm n'ont pas été lancés (interdit sur place) : l'exactitude repose sur le rejeu.

INCIDENT À CONNAÎTRE. Le dossier ~/Projects/ferro était lisible à 18:34 (HEAD 248043a) et n'existe plus depuis 18:35 (date de modification de ~/Projects). Je n'y ai fait que des lectures. Les mesures audio, musique et motion portent donc sur les copies de METAL 673d6b2, dont les tailles étaient identiques à celles de FERRO à 18:34 (audio.js 729 lignes / 45 997 octets, music.js 314 / 20 526, motion.js 87 / 5 280).

1) VERSION CUMULÉE « R1 » (build.mjs). Simulation : les sept correctifs exacts de bench/sim (ground SoA, miroir CSR, blocked, segmentFree, sommeil des débris, navigation par rectangles sales, boucles d'identités, rayons DDA) + tas typé, nearestNode trié et étiquettes de composantes de bench/ia, plus le balayage long fusionné à la main avec segmentV2. Rendu : prototype RCPU (grille, soleil, caches, pools). Rejeu en lockstep, 6 scénarios x 1200 pas, empreinte par pas + hash du snapshot : état identique dans les trois variantes (SIM seul, R1 sans étiquettes, R1 complet).

2) OÙ PART LE TEMPS APRÈS R1 (profil CPU de la chaîne complète, 3 mondes x 2400 images). Présentation 69,8 % du JS de l'image, simulation 29,5 %. Le premier poste n'est plus ni la navigation ni draw() : c'est game.js models(), 40,3 % en inclusif, contre 24,0 % pour draw().

Top 15 résiduel (part du JS de l'image, sauf mention) :
1. models() et objets maillage : 40,3 % inclusif -> RESTE-01
2. FEffects.build : 11,9 % (7,7 % en propre, première fonction) -> RESTE-07
3. FMotion place/vector/mount/basis : 10,4 % -> RESTE-02 (mesuré)
4. supplyModel et part : 11,4 % inclusif -> RESTE-02, RESTE-10
5. FActors.build : 7,3 % -> RESTE-08
6. draw() en propre : 6,8 % -> RESTE-03
7. pack : 6,1 % -> RESTE-03 (mesuré)
8. coneSelect 3,6 % + packIndexed 2,6 % (coût propre du cache RCPU-01) : non traité ici
9. tir -> destruction.damage -> rebuild : 30,7 % du pas en tir soutenu -> RESTE-06
10. updateDebris : 18,3 % du pas -> RESTE-05 (mesuré)
11. updateEncounters + encounterCounts : 12,8 % du pas -> RESTE-04 (mesuré)
12. autres passes sur tous les ennemis : environ 14 % du pas -> RESTE-04
13. updateEnvironment : 4,0 % du pas, non analysé
14. pumpNav + cuisson + labelNav : 3,0 % du pas -> RESTE-11
15. spatialIndex dans updateWorld : 1,8 à 2,4 % -> déjà RCPU-02

Résultats négatifs utiles. La réflexion des ennemis ne coûte rien (plan 1,35 µs/pas, perceive 0,77, navigate 0,76) : inutile de réduire sa fréquence. Le cache de pose d'acteurs entre images ne vaut pas le coup (16,5 % de modèles identiques). Le JS audio est négligeable (0,7 à 3,5 µs par image).

3) ALLOCATIONS (camp:6, 400 images). Origine 2 829 Ko/image, 5,25 scavenges/s ; R1 1 073 Ko, 2,10/s ; R1 + mes deux prototypes 892 Ko, 0,90/s. Dans R1, models() pèse 644 Ko, soit 60 %. Chemin vers zéro : RESTE-01.

4) NOUVEAUX PROTOTYPES EXACTS, en A/B apparié :
- FMotion sans allocation (FERRO) : liste de maillages identique bit à bit, models() -27,5 %.
- forme d'objet unique des maillages : pack -26 %, lignes empaquetées identiques.
- boucles par pas : état identique, -7 à -9 % du pas en campagne.
- debrisHalf scalaire : état identique, -6 à -10 % en combat aux roquettes.
- cumul simulation : ratio médian 0,86 à 0,88. Cumul image sur camp:12 : models 0,79, draw 0,92, sim 0,93.

5) DÉMO QUI DURE. Le coût par image dérive avec le butin accumulé : +31 % d'allocations entre une fenêtre de 400 et de 1800 images (RESTE-10).

LIMITES. Charge machine de 14 à 94 pendant les mesures : les temps absolus sont gonflés, parfois de 18 fois. Seuls les ratios médians appariés, les minima sur rejeux, les octets et les compteurs sont fiables. Sont estimés et non prototypés : RESTE-01, 06, 07, 08, 09.

## Mesures

- **Exactitude de la version cumulée R1 contre l'origine** : identical=true sur 6 scénarios x 1200 pas, pour les trois variantes : SIM seul, R1 sans étiquettes, R1 complet _(méthode : ab.mjs : deux simulations en lockstep dans le domaine principal, empreinte FNV par pas (joueur, ennemis x/z/hp/baseY/yaw/temps d'attaque, débris, projectiles, noms d'événements) + hash du snapshot final)_
- **Répartition du JS de l'image après R1** : présentation 69,8 % (models 40,3 %, draw 24,0 %), simulation 29,5 % _(méthode : node --cpu-prof (intervalle 80 µs) sur prof.mjs frame r1 2400, mondes camp:6, camp:12, legacy:0 ; profsum.mjs restreint aux sous-arbres simPhase et viewPhase)_
- **Fonctions en temps propre après R1 (part du JS de l'image)** : FEffects.build 7,74 % ; FMotion.place 6,98 % ; draw 6,80 % ; pack 6,13 % ; models 4,79 % ; coneSelect 3,58 % ; updateDebris 2,86 % ; updateEnemies 2,67 % ; packIndexed 2,61 % ; FActors.build 2,14 % _(méthode : même profil CPU, temps propre par fonction)_
- **Phases du pas de simulation après R1** : pas moyen 267 µs (somme des phases 231 µs) ; tir 70,9 µs (30,7 %) ; updateDebris 42,2 (18,3 %) ; updateEncounters 21,8 (9,5 %) ; boucle ennemis 10,6 ; updateEnvironment 9,2 ; moveSpeed+stats 8,6 ; encounterCounts 7,7 ; pumpNav+cuisson 6,8 ; updateDirector 5,7 ; checkPad 5,3 ; rebuildNeighbors 4,3 + 3,9 _(méthode : phases.mjs : marques séquentielles dans la source patchée, 6 scénarios x 1800 pas mesurés, minimum par (phase, pas) sur 3 rejeux)_
- **Coût de la réflexion des ennemis après R1** : plan 0,02 appel/pas = 1,35 µs/pas ; perceive 0,09 appel/pas = 0,77 µs/pas ; navigate 0,66 appel/pas = 0,76 µs/pas _(méthode : phases.mjs, marques autour des appels)_
- **Débit d'allocation par image, camp:6, 400 images après 240 de chauffe** : origine 2 829,0 Ko (35 scavenges, 5,25/s à 60 i/s) ; R1 1 072,9 Ko (14, 2,10/s) ; R1 + FMotion exact + boucles 891,8 Ko (6, 0,90/s) _(méthode : alloc.mjs : profileur de tas V8 par échantillonnage (512 octets, objets déjà collectés inclus) + PerformanceObserver gc)_
- **Répartition des allocations de R1** : sim.step 280,0 Ko/image ; supplyModel 243,4 ; FActors.build 180,5 ; models hors sous-postes 126,5 ; draw 122,4 ; FEffects.build 53,3 ; machinery/systems 40,5 ; updateWorld 17,5. Sites : place 128,9 Ko ; itérateurs (next) 126,5 ; map 103,5 ; limb 42,8 _(méthode : alloc.mjs, catégorie par ancêtre dans l'arbre d'allocation)_
- **Dérive des allocations avec la durée, même scénario R1** : 1 072,9 Ko/image sur 400 images contre 1 409,8 sur 1800 (+31 %) ; place 128,9 -> 204,5 Ko/image (+59 %) ; supplyModel en propre 33,2 -> 91,5 _(méthode : alloc.mjs r1 400 et r1 1800 sur camp:6)_
- **FMotion exact sans allocation contre R1** : liste dynamique identique (620 images, 411 maillages/image) ; models() médiane 866 -> 584 µs, ratio médian 0,725 ; draw() 0,798 (inattendu, non expliqué avec certitude) ; sim 1,000 _(méthode : ab-frame.mjs r1 contre r1+motionfast, camp:6, 500 images mesurées, ordre alterné, hash champ par champ de la liste)_
- **FMotion exact + boucles par pas, image complète** : liste identique (540 images) ; ratios médians models 0,792, draw 0,921, sim.step 0,928 _(méthode : ab-frame.mjs r1 contre r1+allfast, camp:12, 420 images)_
- **Classes cachées des maillages dynamiques et coût dans pack()** : 5,6 classes distinctes en moyenne pour 333 maillages ordinaires ; pack 91,5 -> 63,4 µs en médiane (p10 61,4 -> 45,3), ratio médian 0,742, n=2625, lignes empaquetées identiques _(méthode : shapes.mjs avec --allow-natives-syntax (%HaveSameMap), pack du renderer R1 exposé, listes capturées contre clones à forme unique, mesures alternées)_
- **Boucles par pas réécrites (exactes) contre R1** : identical=true ; ratio médian par pas 0,931 (campaign-w10), 0,912 (camp2-w6), 0,981 (legacy-s0) _(méthode : ab.mjs r1 contre r1+simloops, 2 x 900 pas en lockstep)_
- **debrisHalf scalaire (exact) contre R1, arme 3 (roquettes)** : identical=true ; ratio médian 0,903 (legacy-s0), 0,937 (camp2-w6) _(méthode : ab.mjs avec WEAPON=3, 2 x 900 pas)_
- **Cumul boucles + debrisHalf contre R1** : identical=true ; ratio médian 0,863 (campaign-w10), 0,880 (camp2-w6), 0,859 (camp2-w12) _(méthode : ab.mjs r1 contre r1+simloops+debrisfast, 2 x 900 pas)_
- **Réutilisation possible des modèles d'acteurs entre images** : 3,7 appels FActors.build/image, 131 maillages sur 432 ; sortie identique à l'image précédente pour 16,5 % des appels ; indépendante du temps pour 33,7 % _(méthode : actors-reuse.mjs : FActors.build enveloppé, hash de la sortie par ennemi, 300 images camp:6)_
- **Désoptimisations en régime établi (R1, images 600 à 1500)** : 177 bailouts : labelNav sortie d'OSR 36 ; wrong map anonymes 24 ; updateDebris 8 ; spatialIndex 7 ; bakeEdges 7 ; updateEnemies 7 _(méthode : node --trace-deopt deopt.mjs, agrégé par deoptsum.mjs)_
- **Audio côté fil principal (JS seul, Web Audio factice)** : image audio médiane 0,71 µs sans musique, 3,50 µs avec (p10 2,04) ; 34,2 appels AudioParam/image ; 29,9 nœuds créés/s par la musique (898 sources + 898 gains en 60 s) ; 463 images sur 3600 planifient des notes (médiane 7,4 µs) ; 5 tampons créés en jeu quand l'étape n'a pas été préparée _(méthode : audio.mjs : audio.js + music.js de METAL 673d6b2 dans le domaine principal, séquence de game.js:702 répétée 3600 fois)_
- **Bruit de mesure de la machine** : charge moyenne 14 à 94 ; pas moyen brut 4 874 µs contre 267 µs en minimum de 3 rejeux _(méthode : uptime ; phases.mjs (dernier rejeu brut contre minimum par pas))_

## Scripts de banc

- bancs/reste/build.mjs
- bancs/reste/scene.mjs
- bancs/reste/ab.mjs
- bancs/reste/ab-frame.mjs
- bancs/reste/phases.mjs
- bancs/reste/prof.mjs
- bancs/reste/profsum.mjs
- bancs/reste/proflines.mjs
- bancs/reste/alloc.mjs
- bancs/reste/motionfast.mjs
- bancs/reste/simloops.mjs
- bancs/reste/debrisfast.mjs
- bancs/reste/allfast.mjs
- bancs/reste/shapes.mjs
- bancs/reste/actors-reuse.mjs
- bancs/reste/audio.mjs
- bancs/reste/deopt.mjs
- bancs/reste/deoptsum.mjs
- bancs/reste/dump.mjs

## Constats

### RESTE-01 — Après R1, models() est le premier poste (40 % du JS, 60 % des allocations) : écrire les instances directement dans le tampon
- sévérité haute · catégorie mémoire · effort L · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur et jeu
- lieux : src/game.js:240; src/game.js:418-586; src/renderer.js:678-696; src/renderer.js:1555; src/actors.js:39-41; src/effects.js:10-11

**Preuve.** Profil CPU R1 (3 mondes x 2400 images) : models() 40,3 % inclusif du JS de l'image, draw() 24,0 %, sim.step 29,5 %. Allocations R1 (alloc.mjs, camp:6, 400 images) : 1 072,9 Ko/image dont supplyModel 243,4, FActors.build 180,5, models hors sous-postes 126,5, FEffects.build 53,3, machinery/systems 40,5, soit 644 Ko pour models(). Origine : 2 829 Ko/image et 5,25 scavenges/s ; R1 : 2,10/s ; R1 + RESTE-02 + RESTE-04 : 891,8 Ko et 0,90/s. Cause visible dans le code : game.js:240 crée un objet et jusqu'à 3 tableaux par maillage, 411 à 432 maillages par image, que renderer.js:678-696 relit pour écrire 16 flottants.

**Cause.** Chaîne en mode immédiat : chaque image recrée tous les objets maillage puis les recopie dans un Float32Array. Une fois les caches statiques de R1 en place, cette double écriture domine le temps et les allocations.

**Proposition.** FERRO : ajouter un écrivain d'instances au renderer, sans retirer draw(camera,liste,fx). API : w=renderer.frameWriter() ; w.begin() ; w.put(codeForme,px,py,pz,sx,sy,sz,mat,rx,ry,rz,emissive,drapeaux,cr,cg,cb,aCouleur) qui écrit 16 flottants dans un tampon croissant par forme (7 formes) ; w.putFx(...) pour les translucides ; w.end() concatène par set() dans le Float32Array mutualisé de RCPU-04 puis bufferSubData. draw accepte une liste, un écrivain, ou les deux : un jeu v0.2 marche sans changement. METAL : migrer les producteurs par allocation décroissante : butin (243 Ko), acteurs (180 Ko), particules, balles et débris, machinerie. Côté simulation (272 à 280 Ko/pas restants) : remplacer const [x,z]=coord(i) et ...coord(i) par deux fonctions scalaires (les itérateurs coûtent 126 Ko/image), supprimer {...input,dash:false} dans step, sortir lifts.map de castProjectile. Critère : alloc.mjs sous 50 Ko/image et sous 0,1 scavenge/s en régime établi ; octets du tampon dynamique identiques à ceux du chemin liste sur 600 images.

**Gain attendu.** Allocation par image de 892 Ko à moins de 50 Ko ; scavenges de 0,9/s à moins de 0,1/s (5,25/s à l'origine). Temps : suppression de pack (6,1 % du JS) et d'une part des 4,8 % propres à models(). Gain surtout sensible sur mobile.

**Risques.** Refonte large de game.js models(), actors.js et effects.js : à faire producteur par producteur, avec comparaison d'octets à chaque étape. Le tri des translucides et le filtre des projeteurs d'ombre lisent aujourd'hui les objets : il faut leur donner les mêmes champs depuis le tampon. API FERRO additive. Budget de taille : environ +2 à 3 Ko. Aucun effet sur le déterminisme ni sur les sauvegardes.

**Vérifier par.** alloc.mjs r1 400 camp:6 avant et après (Ko/image, scavenges/s) ; ab-frame.mjs étendu pour comparer les octets du tampon dynamique entre chemin liste et chemin écrivain.

**Contre-vérification.** Constat confirmé par rejeu d'alloc.mjs : R1 1 075,9 Ko/image (annoncé 1 072,9), origine 2 823,3 (2 829), models() = 241,3 + 180,5 + 127,4 + 53,4 + 41,2 = 643,8 Ko, soit 60 %. Part de temps cohérente : sur mon A/A d'ab-frame (médianes) models 396 µs, draw 181, sim 207, soit models environ 50 % du JS de l'image. Code relu : game.js:240 (un objet et 1 à 3 tableaux par maillage), renderer.js:678-696 (pack relit tout et alloue un tableau de 16 valeurs par maillage). Trois réserves. (a) La cible « moins de 50 Ko/image » n'est pas démontrée : sim.step pèse à lui seul 273 à 356 Ko/image et les trois retouches citées ne sont pas prototypées. (b) Risque non signalé : le secours Canvas 2D consomme aussi la liste d'objets (renderer.js:1007, 1066, 1083) ; l'écrivain doit l'alimenter, sinon la règle AGENTS.md du secours Canvas 2D casse. (c) draw() répartit la liste en 4 familles (ordinary, overlay, particles, overlayParticles, renderer.js:1555) et surfaceFlags appelle outdoorAt(p) : l'écrivain doit refaire ces deux calculs à l'identique. Effort plutôt L à XL. À faire après RESTE-02, producteur par producteur.

**Preuve corrigée.** Scavenges avec R1 + prototypes : 11 sur 400 images dans mon rejeu, soit 1,65/s, contre 0,90/s annoncé (6 scavenges) : ce compteur est trop bruité sur 400 images pour servir de critère. Les Ko/image, eux, se reproduisent à 0,3 % près (894,3 contre 891,8).

**Gain corrigé.** Certain : suppression des 644 Ko/image de models() et de pack. La cible de 50 Ko/image reste à prouver ; viser d'abord moins de 350 Ko/image (reste = simulation), puis traiter la simulation séparément.

### RESTE-02 — FMotion.place, mount et vector : réécriture exacte sans allocation, avec mémo des angles par repère
- sévérité haute · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité identique · moteur (dans METAL)
- lieux : src/motion.js:15; src/motion.js:16-19; src/motion.js:20-26; src/game.js:381; src/game.js:477-479; src/game.js:578-579

**Preuve.** Profil R1 : place 6,98 % en propre (9,0 % inclusif), vector 1,91 %, mount 0,97 %, basis 0,54 %, soit environ 10,4 % du JS de l'image. place est aussi le premier site d'allocation : 128,9 Ko/image. A/B apparié (ab-frame.mjs, camp:6, 500 images) : liste dynamique identique bit à bit sur 620 images (hash de shape, p, s, r, color, mat, emissive, alpha et drapeaux, 411 maillages/image) ; models() médiane 866 -> 584 µs, ratio médian 0,725. Sur camp:12 avec RESTE-04 : models 0,792, draw 0,921. Allocations : supplyModel 243,4 -> 118,9 Ko/image, place 128,9 -> 33,0 Ko. Le ratio draw 0,798 sur camp:6 est inattendu puisque draw n'est pas modifié ; hypothèse non vérifiée : moins de pression mémoire, ou tableaux p mieux typés.

**Cause.** place() alloue une douzaine d'objets par pièce (littéraux [0,1,2], map, closures) et recalcule asin, cos et deux atan2 alors que deux des trois angles ne dépendent que du repère, pas de rx. Chaque pièce de butin, d'arme en main et de bouclier passe par là, soit plusieurs centaines d'appels par image.

**Proposition.** Reprendre tel quel le texte de bench/reste/motionfast.mjs. vector : trois sommes scalaires dans le même ordre. mount : rotation(angles[0],angles[1],angles[2]), pos en littéral, et retour {pos,axes,ry:NaN,rz:0,regular:false,rx:NaN,r0:0}. place : au premier appel sur un repère, calculer ry=asin(clamp(-a0[2],-1,1)), regular, rz=atan2(a0[1],a0[0]) ; si rx diffère du dernier rx vu, r0=atan2(a1[2]*c+a2[2]*s, a2[2]*c-a1[2]*s) (ou la branche dégénérée) ; retourner p en littéral et r=[r0,ry,rz]. Même arithmétique, même ordre. Étape suivante, non prototypée : écrire ces lignes directement via l'écrivain de RESTE-01.

**Gain attendu.** models() -27,5 % en ratio médian, soit environ -10 % du JS de l'image ; -181 Ko/image d'allocations avec RESTE-04.

**Risques.** L'objet repère gagne 5 champs ; un repère construit à la main fonctionne grâce à l'initialisation paresseuse. Un repère dont on modifierait axes après mount garderait un mémo périmé : aucun cas dans METAL, mais BITUME et Point de rupture sont à vérifier par grep. Preuve par rejeu sur 2 mondes seulement.

**Vérifier par.** node ab-frame.mjs r1 r1+motionfast:motionFast 500 camp:6 : liste identique et ratio models() inférieur à 0,8. Ajouter dans FERRO un test comparant ancienne et nouvelle version sur 10 000 poses aléatoires à graine fixe, égalité stricte.

**Contre-vérification.** Rejoué dans les deux ordres. Liste dynamique identique sur 520 images x 2 (404 maillages par image). Arithmétique relue ligne à ligne contre motion.js:15-26 : mêmes produits, même ordre d'addition, mêmes branches (régulière et dégénérée). Les repères sont créés par mount à chaque appel (game.js:381, 477, 578) et jamais modifiés ensuite : le mémo par repère est sûr. Risque de compatibilité levé : BITUME et Point de rupture n'utilisent pas FMotion (grep : 0 occurrence ; Point de rupture n'a pas de motion.js dans src/moteur). La copie FERRO n'a pas pu être relue (dossier absent) : Codex doit comparer motion.js de FERRO à celui de METAL avant d'appliquer le patch.

**Preuve corrigée.** ab-frame r1 contre r1+motionfast, camp:6, 400 images : models() ratio médian 0,798 ; ordre inversé 1,254 (soit 0,797) ; A/A 1,012. Allocations reproduites : supplyModel 241,3 -> 118,9 Ko/image, place 128,5 -> 34,6 Ko.

**Gain corrigé.** models() -20 % (et non -27,5 %), soit environ -8 à -10 % du JS de l'image. Effet sur draw() : ratio 0,91 dans un sens, 0,97 dans l'autre ; le 0,798 annoncé ne se reproduit pas.

### RESTE-03 — Maillages dynamiques : 5,6 classes cachées par liste, pack() devient mégamorphe ; une forme d'objet unique
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · moteur et jeu
- lieux : src/game.js:240; src/game.js:381; src/game.js:479; src/game.js:579; src/actors.js:41; src/effects.js:10; src/effects.js:198; src/renderer.js:674-696; src/renderer.js:1555

**Preuve.** shapes.mjs (R1, camp:6) : 5,6 classes cachées distinctes en moyenne parmi 333 maillages ordinaires par image (%HaveSameMap). pack sur les listes telles que construites contre des clones à forme unique : médiane 91,5 -> 63,4 µs (p10 61,4 -> 45,3), ratio médian 0,742 sur 2625 mesures alternées, lignes empaquetées identiques. Régime établi : 177 désoptimisations en 900 images, dont wrong map dans des fonctions anonymes (24), updateDebris (8), spatialIndex (7), limb (3), debrisContact (3), castProjectile (3). Origine des formes : game.js:240 crée {shape,p,s,mat,r,emissive} puis les appelants ajoutent surface, overlay, fx, alpha (game.js:381, 479, 579) ; actors.js:41 crée {shape,p,s,r,mat,color,emissive,surface,actorPart,actorLod} dans un autre ordre ; effects.js ajoute structural, debrisId, sourceId, material après coup (effects.js:198).

**Cause.** Les objets maillage sont créés par plusieurs littéraux aux champs différents, et des propriétés sont ajoutées après création. Au-delà de 4 formes, les lectures de pack, de surfaceFlags et du tri de draw deviennent mégamorphes.

**Proposition.** FERRO : exporter FRender.mesh(shape,p,s,mat,r,emissive), qui retourne toujours le même littéral dans le même ordre, tous champs présents : {shape,p,s,mat,r,emissive,color:undefined,surface:undefined,overlay:false,fx:false,alpha:undefined,additive:undefined,outdoor:undefined,actorPart:undefined,actorLod:0,structural:false,debrisId:undefined,sourceId:undefined,material:undefined}. METAL : m() (game.js:240), piece() (actors.js:39-41), mesh() et solid() (effects.js) passent par ce constructeur et affectent les champs existants au lieu d'en ajouter. Garde-fou de test : sur une image de référence, toutes les entrées de la liste ont la même signature de clés.

**Gain attendu.** pack -26 % en ratio médian, soit environ -1,6 % du JS de l'image ; gain du même ordre attendu sur la boucle de tri de draw (renderer.js:1555) et le filtre des projeteurs d'ombre, non mesuré. Rendu sans objet si RESTE-01 est mené au bout, mais 20 fois moins cher à faire.

**Risques.** Tout code qui teste la présence d'un champ ('alpha' in m, hasOwnProperty) changerait de comportement : n'utiliser que des valeurs par défaut neutres (undefined, false) et chercher ces tests par grep. Les listes d'objets libres restent acceptées. Environ 0,3 Ko de plus.

**Vérifier par.** node --allow-natives-syntax shapes.mjs 420 camp:6 : 1,0 classe par liste et ratio pack proche de 1 ; ab-frame.mjs : liste identique.

**Contre-vérification.** Les 5,6 classes cachées par liste se reproduisent exactement, et les lignes empaquetées sont identiques. Le gain est en revanche surestimé d'un facteur 2 à 4. La mesure mélange aussi deux effets : les clones « canoniques » sont forcés en éléments double et viennent d'être alloués à la suite (meilleure localité). Sans objet si RESTE-01 aboutit ; à garder comme garde-fou peu coûteux. Le constructeur FRender.mesh doit rester facultatif pour les jeux v0.2.

**Preuve corrigée.** Trois rejeux de shapes.mjs 420 camp:6 : pack 59,7 -> 57,3 µs (ratio médian 0,944), 58,2 -> 52,5 (0,899), 51,8 -> 45,0 (0,864).

**Gain corrigé.** pack -6 à -14 % (et non -26 %), soit -0,4 à -0,9 % du JS de l'image.

### RESTE-04 — Passes par pas sur tous les ennemis : sélection des rencontres sans allocation, voisinage réutilisé, sauts exacts
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/simulation.js:724-737; src/simulation.js:675-678; src/simulation.js:746-750; src/simulation.js:1279-1281; src/simulation.js:1802; src/simulation.js:1804; src/simulation.js:1938; src/simulation.js:367

**Preuve.** phases.mjs (R1, minimum de 3 rejeux, 6 scénarios x 1800 pas, pas moyen 267 µs) : updateEncounters 21,8 µs/pas (9,5 %), moveSpeed+stats 8,6, encounterCounts 7,7, updateDirector 5,7, boucle checkPad 5,3, rebuildNeighbors 4,3 + 3,9, copie des positions 3,5, fin de step 2,6 : environ 63 µs/pas, soit 27 % du pas, en parcours de tout s.enemies. La réflexion elle-même est marginale : plan 1,35 µs/pas, perceive 0,77, navigate 0,76. A/B lockstep r1 contre r1+simloops (2 x 900 pas) : identical=true ; ratio médian par pas 0,931 (campaign-w10), 0,912 (camp2-w6), 0,981 (legacy-s0, sans progression).

**Cause.** Après SIM-06, il reste à chaque pas : un filter avec closure, deux map, un sort, un Set et une Map pour choisir les combattants (724-737) ; filter().length pour le danger du directeur (750) ; some() pour bossAlive (1938) ; Map.clear et tableaux neufs deux fois par pas pour le voisinage (1280) ; checkPad sur chaque ennemi même sans tremplin (1802) ; Math.hypot pour chaque ennemi même immobile (1804).

**Proposition.** Reprendre les six réécritures de bench/reste/simloops.mjs, toutes exactes. (1) if(s.jumpPads.length) devant la boucle checkPad. (2) moveSpeed : si dx===0 et dz===0 alors 0, sinon hypot/dt. (3) fonctions de comptage dangerCount, activeMechanisms, bossAliveNow à la place de filter().length et some(). (4) rebuildNeighbors : vider et réutiliser les listes de la Map via une liste des listes touchées. (5) sélection des rencontres : candidats dans un tableau persistant, clés en Float64Array calculées après la passe de filtre, tri par insertion sur (clé, id) avec repli sur le sort d'origine si une clé est NaN, drapeaux Uint8Array par id à la place du Set, compteur Int32Array par rencontre à la place de la Map. Étape suivante, non prototypée : liste compacte des identités vivantes et déployées, tenue à jour à la mort et au déploiement.

**Gain attendu.** -7 à -9 % du pas sur les mondes à progression, -2 % sur les mondes hérités ; -12 à -14 % cumulé avec RESTE-05. Moins de closures et de tableaux temporaires par pas.

**Risques.** Le tri par insertion n'égale Array.sort que si le comparateur est un ordre total : vrai avec des ids uniques et des clés finies, repli conservé pour NaN. La réécriture suppose que e.id est l'indice dans s.enemies. Preuve par rejeu sur 3 à 6 mondes seulement : lancer npm test et un rejeu de 3600 pas sur les 18 mondes avant fusion. Format des sauvegardes inchangé.

**Vérifier par.** STEPS=900 REPS=2 node ab.mjs r1 r1+simloops:simLoops : identical=true et ratio médian inférieur à 0,95 sur campaign-w10 et camp2-w6.

**Contre-vérification.** État identique sur 6 scénarios x 900 pas x 3 rejeux. Le risque « ordre total » annoncé n'existe pas : le tri par insertion est stable comme Array.sort, donc le résultat est le même y compris en cas d'égalité. Les effets de bord du filtre (remember, returning) restent exécutés dans l'ordre des ennemis avant le calcul des clés. Réserve : dans ces scénarios le pilote ne tue presque personne ; lancer npm test et un rejeu avec de vraies vagues avant fusion.

**Preuve corrigée.** ab.mjs r1 contre r1+simloops : ratios médians bruts 0,916, 0,928, 0,935, 0,937, 0,941, 0,883, mais l'A/A r1 contre r1 donne 0,969 à 0,978 (biais de position). Cumul avec RESTE-05 mesuré dans les deux ordres : 0,897 / 0,876 / 0,847 puis 1,124 / 1,087 / 1,062 inversé, soit une moyenne géométrique de 0,89 à 0,90.

**Gain corrigé.** -4 à -6 % du pas pour les boucles seules (et non -7 à -9 %) ; environ -10 % cumulé avec RESTE-05 (et non -12 à -14 %).

### RESTE-05 — updateDebris reste le deuxième poste du pas (18 %) : debrisHalf scalaire exact, puis rotation et closures hors boucle
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:68-83; src/simulation.js:1028-1065; src/simulation.js:1046; src/simulation.js:1064

**Preuve.** phases.mjs : updateDebris 42,2 µs/pas, 18,3 % du pas, malgré le sommeil des pièces de SIM-03. Profil du pas : updateDebris 6,0 % en propre, debrisSweep 2,1 %, closures map de debrisHalf 1,9 %, debrisHalf 1,4 %, wrap 0,9 %, debrisBoxes 0,7 %, debrisContact 0,5 %, debrisFloor 0,5 %, filter de 1064 0,5 %. Allocations (fenêtre de 1800 images) : updateDebris 46 Ko/image, closures de debrisHalf 28 Ko, debrisHalf 23 Ko, debrisSweep 19 Ko. A/B r1 contre r1+debrisfast (WEAPON=3, 2 x 900 pas) : identical=true, ratio médian 0,903 (legacy-s0) et 0,937 (camp2-w6). Avec RESTE-04 : 0,863, 0,880 et 0,859 sur campaign-w10, camp2-w6 et camp2-w12.

**Cause.** Chaque pièce en mouvement appelle debrisHalf avec une rotation neuve à chaque pas : déstructuration par itérateur, matrice de 9 valeurs, quatre littéraux [0,1,2] avec map et closures, objet de cache. La ligne 1046 crée deux closures par pièce et par pas, la ligne 1064 refait un filter de s.debris à chaque pas.

**Proposition.** Étape exacte prototypée (bench/reste/debrisfast.mjs) : lire r[0], r[1], r[2] ; calculer les trois demi-étendues par debrisExtent(shape,v0,v1,v2) avec les mêmes formules et le même ordre d'addition, sans tableau ni closure. Étapes suivantes, non prototypées : sortir wrap et flat au niveau du module ; remplacer q.rotation.map par deux tableaux de 3 valeurs alternés par pièce, pour garder le test d'identité du cache ; ne refaire le filter de 1064 que si une pièce a expiré ou est sortie des bornes ; à terme, tableaux typés par emplacement pour position, vitesse, rotation et demi-étendues, les objets de s.debris restant la vue pour snapshot et effets.

**Gain attendu.** -6 à -10 % du pas en combat aux roquettes pour l'étape prototypée. Étapes suivantes estimées à -30 à -40 % supplémentaires sur updateDebris.

**Risques.** Le cache d'étendue compare la rotation par identité de tableau (simulation.js:69) et snapshot/restore sérialisent q.rotation : toute réutilisation de tableau doit préserver ces deux usages (voir LOOP-01 et LOAD-01). Seule l'étape scalaire est prouvée exacte. wrap=atan2(sin,cos) ne peut pas être remplacé par un modulo sans changer les bits : ne pas y toucher.

**Vérifier par.** WEAPON=3 STEPS=900 REPS=2 node ab.mjs r1 r1+debrisfast:debrisFast : identical=true et ratio médian inférieur à 0,95.

**Contre-vérification.** L'exactitude de debrisHalf scalaire est confirmée (état identique). Le scénario annoncé est faux : WEAPON=3 est refusé par selectWeapon (simulation.js:550) car l'arme n'est pas possédée (campagne : pistolet seul ; legacy-s0 : arme 0 seule), et l'arme 3 est le lance-grenades, pas le lance-roquettes (game.js:476). Mon weap.mjs le prouve : avec ou sans WEAPON=3, mêmes 43 à 45 tirs, 10 à 15 débris en moyenne, mêmes révisions. Le seul vrai test aux roquettes possible est legacy-s2 avec WEAPON=2 (107 débris en moyenne). Les étapes suivantes (-30 à -40 %) restent des estimations non prototypées. À mesurer en régime saturé, voir RESTE-V3.

**Preuve corrigée.** Arme par défaut : ratios bruts 0,884 à 0,954 (A/A : 0,97). Vraies roquettes (legacy-s2, WEAPON=2, 1500 pas x 3) : identical=true, ratio médian 0,944.

**Gain corrigé.** Environ -3 % du pas en vrai combat aux roquettes, -2 à -9 % dans les autres scénarios, après correction du biais (et non -6 à -10 %).

### RESTE-06 — En tir soutenu, tir -> destruction.damage -> rebuild pèse 31 % du pas, avec une double compilation par fracture
- sévérité haute · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité identique · jeu
- lieux : src/destruction.js:160-178; src/destruction.js:228-262; src/simulation.js:1106; src/simulation.js:229-235

**Preuve.** phases.mjs (R1) : phase tir 70,9 µs/pas, 30,7 % du pas, premier poste de la simulation avec un pilote qui tient la gâchette 6 pas sur 20. Profil du pas : fireArsenal 14,5 % inclusif, destruction.damage 8,5 % inclusif, destruction.rebuild 6,25 % en propre, raycast 2,0 %. Code : destruction.js:160-178 régénère output et boxes pour tous les maillages et colliders d'origine à chaque révision, avec un objet neuf par collider ({...e.solid.bounds,...} et {...c,mesh:...}). damage compile le groupe touché (let built=compile(g,record), vers destruction.js:246) puis rebuild le recompile, car g.cacheRecord!==record (160-165). Mesure nouvelle qui approfondit SIM-08 et LOAD-10 ; le coût de la double compilation seule n'a pas été isolé.

**Cause.** Une révision coûte en proportion de la taille du monde et non de la taille du trou, et le groupe touché est compilé deux fois. Une fois la navigation et les débris corrigés par R1, ce coût devient dominant pendant les fusillades.

**Proposition.** (a) Dans damage, quand un groupe change, poser g.cacheRecord=record, g.cacheCount, g.cacheRemoved et rafraîchir renderSlots pour ses maillages avec le built déjà calculé ; rebuild ne recompile alors plus ce groupe. (b) Sortie incrémentale : garder par maillage d'origine son segment (début, longueur) dans meshes et ses colliders ; à une révision, ne réécrire que le suffixe à partir du premier maillage modifié et réutiliser les objets colliders du préfixe au lieu de les recréer. (c) Coupler avec SIM-01 et RCPU-02 pour que rebuildCollision et updateWorld ne traitent que ce suffixe. Critère : hash JSON de destruction.meshes et destruction.colliders identique après chaque révision d'un rejeu ; phase tir sous 25 µs/pas dans phases.mjs.

**Gain attendu.** Phase tir de 71 à environ 20 à 25 µs/pas, soit -15 à -20 % du pas moyen en tir soutenu, et pointes d'impact réduites (voir SIM-08).

**Risques.** L'ordre des maillages et les indices mesh des colliders servent au rendu et au raycast : la variante incrémentale doit produire exactement les mêmes tableaux. La proposition (a) suppose que compile est une fonction pure de (groupe, enregistrement) : à vérifier. Des appelants peuvent garder l'ancien tableau colliders : conserver la sémantique de nouvel objet tableau à chaque révision si navDiff de SIM-01 compare ancien et nouveau.

**Vérifier par.** phases.mjs avant et après (ligne tir) ; ab.mjs avec empreinte étendue aux colliders ; npm test sur destruction et collision.

**Contre-vérification.** La double compilation existe bien dans le code (destruction.js:249 puis 165, cacheRecord n'étant pas posé par damage), mais elle ne coûte rien : la proposition (a) est réfutée par la mesure. Le chiffre de 31 % du pas est celui de toute la phase fire (lancers de rayons, syncDestruction, rebuildCollision), pas de la destruction. Le vrai problème est la saccade : rebuild() parcourt les 13 927 maillages d'origine (un Map.get par maillage) et recrée 439 à 517 objets collider à chaque révision, dans du code froid (6 à 12 appels en 25 s, jamais optimisé). Seule la proposition (b), sortie incrémentale par segments, a de la valeur ; elle doit être menée avec SIM-01 et RCPU-02, la part rendu d'une révision (24 à 31 ms) étant plus lourde. Le risque sur l'ordre des maillages et les indices mesh des colliders est bien identifié.

**Preuve corrigée.** destmeasure.mjs (R1, pilote d'ab.mjs, 6 scénarios, meilleur de 3 rejeux, machine chargée) : damage() inclusif 3,6 à 17,8 % du pas (médiane environ 8 %), dont rebuild() 2,9 à 16,8 %, soit 2,7 à 12,7 ms par révision ; compile dans rebuild 0,0 à 0,1 % du pas (16 à 43 appels) ; compile dans damage 0,0 à 0,1 %.

**Gain corrigé.** (a) : gain nul. (b) : -3 à -8 % du pas moyen en tir soutenu (et non -15 à -20 %), et surtout suppression d'un blocage de plusieurs millisecondes par révision côté simulation.

### RESTE-07 — FEffects.build, première fonction en temps propre (7,7 %) : enregistrements retenus pour les gravats au repos et sélection des K meilleurs
- sévérité moyenne · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité identique · jeu
- lieux : src/effects.js:172-181; src/effects.js:183-192; src/effects.js:193-199; src/game.js:420

**Preuve.** Profil R1 : effects.js build 7,74 % en propre et 11,9 % inclusif du JS de l'image ; mesh 1,37 %, order 0,98 % ; 53 à 81 Ko/image. Code effects.js:172-199, pour chaque débris et chaque image : [q.x,q.y,q.z].every(Number.isFinite), tableau raw, raw.some, slice ou map, Math.hypot(...s), point(q), p.reduce avec closure, objet wreckage ; puis deux tris à 6 clés et un Set de clés chaînes (RCPU-06 couvre ce tri) ; puis rotation.slice, color.slice et solid() pour les pièces retenues. Les pièces structurelles au repos ne bougent plus, comme le montre le sommeil de SIM-03, mais sont revalidées et recopiées à chaque image.

**Cause.** build repart de l'état brut à chaque image pour tous les débris, alors que seules la distance, la bande et le drapeau arrière dépendent de la caméra.

**Proposition.** WeakMap par pièce contenant validité, p, s, rayon, raw, couleur, rotation, forme et clé sourceId, valable tant que q.resting, que q.rotation est le même tableau et que x, y, z, size n'ont pas changé. Par image, ne recalculer que d, band, rear et score : une distance et un produit scalaire. Remplacer les deux tris complets par une sélection des debrisBudget meilleurs selon le même comparateur, puis trier seulement ces K éléments. Garder le calcul de repeat par sourceId, avec une clé numérique (band*2+rear) et l'identité de sourceId. Avec RESTE-01, écrire ensuite les lignes directement.

**Gain attendu.** -50 à -70 % de FEffects.build en plus de RCPU-06, soit environ -4 à -6 % du JS de l'image quand beaucoup de gravats reposent ; environ -40 Ko/image.

**Risques.** L'ordre final de la liste doit rester identique : il conditionne le budget de débris affichés et l'ordre de dessin. La validité du cache repose sur l'identité de q.rotation : à coordonner avec RESTE-05 si la rotation passe en tableaux réutilisés. Les pièces non structurelles dépendent de l'âge : ne jamais les mettre en cache.

**Vérifier par.** ab-frame.mjs r1 contre r1+correctif sur camp:6 et legacy:0 en combat aux roquettes : liste identique et temps de FEffects.build ; bench/rcpu/effects-ab.mjs pour l'isoler.

**Contre-vérification.** Code relu (effects.js:172-199) : every, some, slice ou map, hypot avec spread, reduce, un objet par débris et deux tris complets à chaque image. Je relève la priorité : dès 1 200 images le nombre de débris sature à 124-138 et y reste (endurance sur 9 000 et 12 000 images) ; c'est l'état permanent d'une démo qui dure. Deux oublis dans la proposition. (1) fade(p,radius) dépend aussi de la caméra et doit être recalculé à chaque image. (2) La sélection des K meilleurs doit reproduire le calcul de repeat en deux passes : d'abord le minimum par clé (rear, band, sourceId) selon le comparateur, puis la sélection, avec départage des égalités par l'indice d'origine pour imiter la stabilité de sort. Gain non prototypé.

**Preuve corrigée.** Allocations de FEffects.build : 53,4 Ko/image sur la fenêtre de 400 images, 197,2 Ko/image sur celle de 1 800 (x 3,7), quand la moyenne passe de 8,6 à 102,8 débris.

**Gain corrigé.** Estimation inchangée (-50 à -70 % de build), mais elle porte sur un poste environ 3,7 fois plus gros en régime saturé que dans la fenêtre de 400 images.

### RESTE-08 — FActors.build : le cache de pose entre images ne rapporte que 16,5 % ; il faut un calcul scalaire sans map ni spread
- sévérité moyenne · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité identique · jeu
- lieux : src/actors.js:8-15; src/actors.js:39-46; src/actors.js:48; src/actors.js:153; src/actors.js:191; src/actors.js:249; src/game.js:436-438

**Preuve.** actors-reuse.mjs (R1, camp:6, 300 images) : 3,7 appels FActors.build par image, 131 maillages sur 432 ; sortie identique à celle de l'image précédente pour 16,5 % des appels (17,8 % des maillages) ; indépendante du temps pour 33,7 %. Un cache entre images est donc peu rentable en combat. Allocations R1 : FActors.build 180,5 Ko/image, soit 16,8 % du total et 20,2 % après RESTE-02 : limb 42,8 Ko (c.map, Math.hypot(...dy)), piece 25 Ko, drone 19 à 23 Ko, build 17 Ko, sentinel 15 Ko, custodian 13 Ko, point, angles, rotation. Profil : 7,3 % inclusif du JS de l'image. Approfondit RCPU-11 avec une mesure de réutilisation et la liste des sites.

**Cause.** Chaque pièce alloue une matrice (new Array(9)), un tableau d'angles, un point, et rotation(...r) passe par un spread ; cinq closures (box, armor, cyl, ring, eye) et piece sont recréées à chaque appel de build ; limb utilise map et hypot avec spread.

**Proposition.** Ne pas mettre les modèles en cache entre images. À la place : (1) product et rotation écrivent dans une pile de matrices Float64Array propre au module, avec la même arithmétique ; (2) angles écrit 3 scalaires ; (3) limb en scalaires, Math.hypot(dx,dy,dz) donnant le même résultat que Math.hypot(...dy) ; (4) remonter piece, box, armor, cyl, ring et eye au niveau du module avec un contexte explicite (out, root, lod, palette) ; (5) sortie par le constructeur de RESTE-03, puis par l'écrivain de RESTE-01.

**Gain attendu.** Environ -50 % des allocations de FActors.build (environ -90 Ko/image) et -30 à -40 % de son temps, soit -2 à -3 % du JS de l'image ; davantage en combat de boss avec des renforts.

**Risques.** Les tableaux p, s, r des maillages ne doivent pas être partagés entre pièces si un consommateur les modifie (game.js atténue emissive et scale après build : vérifier qu'il ne touche pas p, s, r). Les tests d'acteurs comparent probablement des sorties : elles doivent rester identiques au bit près.

**Vérifier par.** ab-frame.mjs : liste identique ; alloc.mjs : catégorie models>FActors.build sous 90 Ko/image ; bench/rcpu/actors-cost.mjs pour le temps par primitive.

**Contre-vérification.** Code relu (actors.js:8-15, 39-48) : new Array(9) par produit, rotation(...r), cinq closures recréées par build, limb avec map et hypot(...dy). Math.hypot(dx,dy,dz) reçoit les mêmes arguments que le spread : identique. Les 180,5 Ko/image se reproduisent. Le risque de partage de tableaux existe déjà dans le code actuel : les pièces d'un même repère partagent f.r et les couleurs de palette (actors.js:40-41), donc aucun consommateur ne les modifie aujourd'hui. Le résultat négatif (cache de pose entre images inutile, 16,5 %) n'a pas été rejoué. Gain estimé, non prototypé.

### RESTE-09 — Audio côté fil principal : JS négligeable (0,7 à 3,5 µs par image) ; le travail restant est côté navigateur (30 nœuds/s, 34 automations par image)
- sévérité basse · catégorie audio · effort S · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/audio.js:180-197; src/audio.js:281-299; src/audio.js:379-398; src/music.js:257-261; src/music.js:262-271; src/music.js:272-287; src/music.js:289-295; src/game.js:702

**Preuve.** audio.mjs (audio.js et music.js de METAL 673d6b2, de mêmes tailles que ceux de FERRO 248043a à 18:34 ; Web Audio factice ; séquence de game.js:702 répétée 3600 fois) : médiane 0,71 µs par image sans musique, 3,50 µs avec (p10 2,04) ; 463 images sur 3600 planifient des notes, médiane 7,4 µs. 34,2 appels AudioParam par image, ce qui confirme LOOP-14. La musique crée 898 AudioBufferSourceNode et 898 GainNode en 60 s, soit 29,9 nœuds/s. music.js:292 fait Array.from(voices) à chaque tick ; music.js:272-279 alloue events et 4 objets par ligne. Aucune synthèse à la volée : les 64 tampons d'effets viennent de warmBank (audio.js:281-299). En revanche les tampons d'instruments sont créés à la première note (music.js:257-261) si l'étape n'a pas été préparée : 5 tampons créés en jeu, puis 7 tampons et 84 170 échantillons convertis à un changement d'étape. Le coût réel côté navigateur n'est pas mesurable sous Node.

**Cause.** Le JS de tick est déjà minimal. Ce qui reste est du travail délégué au navigateur à chaque image (automations redondantes) et à chaque note (deux nœuds créés puis collectés), plus une conversion PCM paresseuse possible en cours de jeu.

**Proposition.** Ne pas optimiser le JS de tick. (1) Dans FMusic.create, deux GainNode persistants par piste, alternés pour le fondu de 8 ms de note() ; seul l'AudioBufferSourceNode, à usage unique, est créé par note : 15 nœuds/s au lieu de 30. (2) voices en tableau avec retrait par échange au lieu de Array.from(Set) par tick. (3) schedule décode la ligne dans 4 enregistrements préalloués. (4) music.prepare() appelé pour les 3 étapes pendant l'écran de chargement, par tranches (voir LOAD-13), pour qu'aucun createBuffer ne survienne en jeu. (5) Appliquer LOOP-14 dans FERRO : ne réémettre setTargetAtTime que si la cible change de plus de 1e-3, une seule fois par image.

**Gain attendu.** Aucun gain JS mesurable. Côté navigateur : nœuds audio créés par la musique divisés par 2, environ 2 000 -> 200 messages d'automation par seconde (LOOP-14), plus aucune conversion de tampon en cours de jeu.

**Risques.** Réutiliser un GainNode par piste change l'ordre des automations : garder exactement les mêmes instants et valeurs (setValueAtTime(0,t), rampe à t+0,0015, coupure à t+0,008) et vérifier l'absence de clic au recouvrement. Le seuil de 1e-3 ne doit pas supprimer la mise à zéro du vent. Mesures faites sur les copies de METAL, le dossier FERRO ayant disparu pendant l'audit.

**Vérifier par.** audio.mjs étendu pour journaliser (paramètre, instant, valeur) : journaux identiques hors doublons supprimés ; compteur de nœuds/s ; écoute dans Chrome et capture OfflineAudioContext de 10 s comparée échantillon par échantillon.

**Contre-vérification.** Lignes exactes (music.js:257-261 tampon paresseux, 262-271 deux nœuds par note, 292 Array.from par tick). audio.mjs n'a pas été rejoué. Le constat dit lui-même qu'il n'y a rien à gagner côté JS. Le point (1), GainNode persistants alternés, est à écarter : 30 nœuds par seconde sont insignifiants pour Web Audio, et réutiliser un gain qui porte encore des automations planifiées (setTargetAtTime à time, arrêt à time+0,008, effet 12 sur t.voice.gain) peut produire des clics, ce qui est une perte de qualité possible. Garder (2), (3), (4) et LOOP-14. Pour la démo : music.tick ne fait rien tant que ctx.state n'est pas running (music.js:290), donc une démo lancée sans geste est muette, ce qui est le comportement voulu.

### RESTE-10 — Démo qui dure : le coût par image dérive avec le butin accumulé (+31 % d'allocations entre 400 et 1800 images)
- sévérité haute · catégorie démo · effort M · gain mesuré
- contre-vérification : **réfuté**, priorité P2 · qualité sans objet · moteur et jeu
- lieux : src/game.js:452; src/game.js:379-417; src/motion.js:20-26; src/game.js:236; src/simulation.js:2211

**Preuve.** alloc.mjs, même scénario déterministe R1 sur camp:6 : 1 072,9 Ko/image sur une fenêtre de 400 images, 1 409,8 Ko/image sur 1800 images, soit +31 %. FMotion.place passe de 128,9 à 204,5 Ko/image (+59 %), supplyModel en propre de 33,2 à 91,5 Ko. La cause est le butin laissé par les ennemis tués : s.loot grossit (SIM-13 le dit borné), chaque objet proche est modélisé à chaque image sans test de vue (game.js:452, RCPU-07) et chaque pièce passe par FMotion.place. Scavenges : 1,8/s sur la fenêtre longue. Je n'ai pas mesuré au-delà de 1800 images (30 s de jeu) : la dérive sur 10 minutes ou plus reste à établir.

**Cause.** Une démo automatique accumule butin et gravats sans jamais vider le secteur. Le coût de models() est proportionnel au nombre d'objets proches, pas à ceux qui sont visibles.

**Proposition.** (1) Appliquer RESTE-02 et RCPU-07 avant d'écrire le mode démo. (2) Pilote de démo déterministe : la simulation n'utilise aucun Math.random, donc une démo rejouable peut partir du pilote tour de bench/reste/scene.mjs (trajet glouton, balayage de lacet), avec redémarrage périodique du secteur pour borner l'état. (3) Option propre à la démo, désactivée en jeu : au-delà de 24 objets de butin, le pilote ramasse ou fait expirer les plus anciens. (4) Critère d'endurance à ajouter aux bancs : sur 36 000 images de démo, Ko/image et temps médian de models() des 10 derniers pour cent inférieurs ou égaux à 1,1 fois ceux des 10 premiers ; heapUsed après gc() stable à 5 % près ; taux de scavenges stable. (5) FERRO : y loger le harnais d'endurance (chargeur dans le domaine principal, WebGL factice compteur, hash de liste), utile aux démos de BITUME et de Point de rupture.

**Gain attendu.** Coût par image stable sur la durée de la démo au lieu de +31 % en 30 s. Avec RESTE-02 seul, les allocations liées au butin sont déjà divisées par 2 (243 -> 119 Ko/image mesurés).

**Risques.** L'expiration du butin ne doit exister qu'en mode démo, sinon elle modifie l'équilibrage. Le pilote ne doit pas écrire dans la sauvegarde du joueur : ni localStorage ni point de reprise. Le pilote des bancs déplace le joueur directement : la démo réelle doit passer par les entrées (input.moveX, moveY, lookX) pour rester physique et déterministe.

**Vérifier par.** node --expose-gc alloc.mjs r1 400 camp:6 puis r1 1800 camp:6 : écart sous 10 % après correctifs ; rejeu d'endurance de 36 000 images avec le critère ci-dessus.

**Contre-vérification.** Le chiffre brut se reproduit (1 075,9 contre 1 399,5 Ko/image, +30 %), mais la cause est fausse et ce n'est pas une dérive. Sur la fenêtre de 400 images il n'y a aucun ennemi tué et aucun butin. L'écart vient de l'endroit où passe le pilote (objets statiques du monde) et des débris qui atteignent leur plafond. Le butin est borné à un objet par ennemi (simulation.js:636 et 2164). La proposition (3), expiration du butin en démo, est sans objet. Restent utiles : le critère d'endurance (4) et le harnais dans FERRO (5), à fusionner avec RESTE-11, et l'exigence que la démo passe par les entrées. Les vrais obstacles à une démo qui dure sont ailleurs : voir RESTE-V1 et RESTE-V2.

**Preuve corrigée.** supply.mjs : fenêtre 240-640 : 0 tué, s.loot vide, 21,0 objets de ramassage du monde proches par image, 8,6 débris. Fenêtre 240-2040 : 6 tués, 1,6 butin proche par image contre 26,9 objets du monde, 102,8 débris. Hausse par poste : FEffects.build +144 Ko, supplyModel +98, sim.step +74, FActors.build +48. endure.mjs (R1 camp:6 sur 9 000 images ; origine camp:6 et R1 legacy:0 sur 12 000) : médiane de models() entre 402 et 906 µs sans tendance, liste de 384 à 775 maillages, tas après GC entre 34,7 et 36,6 Mo, débris plafonnés à 124-138, butin au plus 7.

**Gain corrigé.** Aucune dérive à corriger. Le coût dépend du lieu et de la saturation des débris, atteinte en 20 secondes.

### RESTE-11 — Outillage : attribution par minimum de rejeux, A/B d'image avec hash de liste, budgets d'allocation et de désoptimisations
- sévérité moyenne · catégorie outillage · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité sans objet · moteur et jeu
- lieux : bancs/reste/phases.mjs; bancs/reste/ab-frame.mjs; bancs/reste/alloc.mjs; bancs/reste/deopt.mjs; bancs/ia/proto.mjs

**Preuve.** Sous une charge de 14 à 94, le pas moyen brut d'un rejeu est de 4 874 µs contre 267 µs en gardant le minimum par pas sur 3 rejeux déterministes (phases.mjs) : un facteur 18 de bruit, qui rend inutilisable toute mesure non appariée. Les grandeurs stables d'un lancement à l'autre sont les ratios médians appariés (ab.mjs, ab-frame.mjs) et les compteurs : Ko/image (alloc.mjs), classes cachées (shapes.mjs), désoptimisations (deopt.mjs : 177 en 900 images). Le profil par ligne (positionTicks) est inexploitable sur du code optimisé : tout est attribué à la première ligne des grandes fonctions (updateEnemies 6,35 %, step 5,92 % sur la ligne function). Les 36 sorties d'OSR de labelNav montrent que le prototype d'étiquettes de bench/ia refait un parcours complet après chaque rafraîchissement local.

**Cause.** Les tests actuels tournent en node:vm (SIM-11) et ne surveillent ni allocations, ni formes d'objets, ni désoptimisations. Une régression de fluidité passe inaperçue, et les mesures de temps sont faussées par la charge.

**Proposition.** FERRO : dossier tools/perf/ avec le chargeur dans le domaine principal (vm.runInThisContext enveloppé, une fenêtre par variante), le WebGL factice compteur, le hash de liste, alloc et deopt. METAL : tools/perf-budget.mjs, lancé par npm run perf, hors de npm test car les temps sont bruités. Seuils sur des grandeurs déterministes : Ko/image au plus 1 100 aujourd'hui, à abaisser à chaque correctif (cible 50) ; 1 classe cachée par liste dynamique ; au plus 20 désoptimisations sur 900 images en régime établi ; ratios médians appariés contre le commit précédent pour le pas et pour models(). Pour l'implémentation d'IA-01 : réétiqueter par union-find incrémental (variante local de bench/ia/proto.mjs), jamais par parcours complet à chaque rafraîchissement.

**Gain attendu.** Chaque correctif des deux tours devient vérifiable et protégé contre les régressions ; les priorités ne sont plus faussées par la charge machine ni par node:vm.

**Risques.** --allow-natives-syntax et --trace-deopt dépendent de la version de V8 : épingler la version de Node dans le script et tolérer leur absence. Ne pas mettre de seuils de temps absolus en CI. Outils hors de la page livrée : aucun effet sur le budget de 1,4 Mo.

**Vérifier par.** npm run perf rend les mêmes compteurs deux fois de suite sur la même machine (octets à l'échantillonnage près, classes et désoptimisations identiques), et échoue si l'on réintroduit une allocation par maillage ou une forme d'objet supplémentaire.

**Contre-vérification.** Les compteurs sont bien reproductibles : Ko/image à 0,3 % près, 5,6 classes cachées à l'identique. Deux défauts des bancs sont à corriger avant d'en faire un outil de référence. (1) ab.mjs a un biais de position de 2 à 3 % en faveur de B : le protocole doit inclure un A/A et un passage inversé, et publier la moyenne géométrique ; un ratio entre 0,95 et 1,0 est dans le bruit. (2) Un réglage de scénario refusé passe sous silence (WEAPON=3) : le harnais doit vérifier s.weapon===WEAPON et échouer sinon. S'y ajoutent : fixer les budgets en régime saturé (RESTE-V3) ; ne pas mettre de seuil sur les scavenges par seconde (6 contre 11 d'un lancement à l'autre) ; le pilote des bancs ne tue que 6 ennemis sur 102 en 150 s et finit sans munitions, il ne représente pas un combat. Le compte de 177 désoptimisations n'a pas été rejoué.

**Preuve corrigée.** A/A ab.mjs r1 contre r1 (900 pas x 3) : ratios médians 0,969, 0,978, 0,976, 0,978, 0,976, 0,936. A/A ab-frame r1 contre r1 : 1,012 (models), 1,000 (draw), 1,006 (sim).

## Constats ajoutés par le contre-vérificateur

### RESTE-V1 — Démo qui dure : dans game.js actuel, une démo s'arrêterait au premier onglet masqué, à la première mort ou fin de secteur, et écraserait la sauvegarde du joueur
- sévérité haute · catégorie démo · effort L · gain qualitatif
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · moteur et jeu
- lieux : src/game.js:94-104; src/game.js:125-131; src/game.js:683-690; src/game.js:720-722; src/game.js:838; ~/Projects/point-de-rupture/Jeu/src/interface/titre.js:50-52; ~/Projects/point-de-rupture/Jeu/src/interface/titre.js:184-229

**Preuve.** Lecture de game.js (673d6b2). Ligne 838 : visibilitychange met le jeu en pause dès que le document est masqué, et rien ne le relance. Ligne 125 : les modes dead, cleared, complete et shop affichent un écran qui attend un clic. Lignes 94-104 : saveCheckpoint écrit localStorage SAVE_KEY et clearSave l'efface ; une démo jouée par le vrai moteur remplacerait donc la partie du joueur. Lignes 683-687 : l'entrée n'est composée que du clavier, de la souris et du stick, sans point d'injection pour un pilote. Ligne 690 : steps=ceil(dt*60), part=dt/steps, donc la taille du pas dépend du temps réel de l'image et une démo enregistrée (entrées rejouées) ne serait pas reproductible. Ligne 722 : la résolution adaptative exige mode playing et document.hasFocus(), elle serait coupée sur une borne sans focus. Ligne 720 : le menu affiche déjà le monde avec une caméra fixe, sans avancer la simulation. Référence Point de rupture (arbre de travail) : src/interface/titre.js:50-52 (départ après 5 s sans geste, plans de 7 s, clic de sortie avalé pendant 600 ms), 221 (un geste ramène au titre), ui.fin (retour au titre en fin de démo). Mesure d'endurance : 12 000 images sans fuite (tas 35 à 36,6 Mo), mais le pilote des bancs vide ses munitions en 200 s.

**Cause.** game.js n'a aucun état de démo : toutes les transitions (pause, mort, victoire, boutique, sauvegarde) supposent un joueur présent.

**Proposition.** FERRO : module générique FDemo.create({idleMs:5000, onStart, onStop}), utile aux trois jeux : minuterie d'inactivité sur l'écran titre, sortie au premier geste avec clic avalé pendant 600 ms, reprise automatique quand le document redevient visible, plafond d'images par seconde propre à la démo, et un rotate(minutes) qui demande au jeu un changement de scène. METAL : (1) un drapeau demo dans game.js ; (2) un pilote appelé après la ligne 687 qui ne remplit que input (moveX, moveY, lookX, lookY, fire, dash, weapon) à partir de sim.state, sans jamais écrire la position ; (3) en démo, pas fixe de 1/60 avec accumulateur au lieu de dt/steps ; (4) saveCheckpoint, clearSave et toute écriture localStorage neutralisés, la partie sauvegardée restant intacte ; (5) transitions automatiques : mort -> même secteur relancé après 2 s, secteur terminé ou 4 minutes écoulées -> secteur suivant de la rotation avec un fondu, boutique sautée ; (6) à la pause par visibilitychange, retour en playing quand le document est de nouveau visible ; (7) munitions et points de vie regarnis à chaque secteur de démo, jamais en jeu ; (8) adaptative active en démo même sans focus. Critère : dans bench/loop/harness.mjs (vrai game.js, horloge virtuelle), 60 minutes de démo avec un masquage toutes les 5 minutes : mode playing au moins 99 % du temps visible, au moins 12 changements de secteur, 0 appel localStorage.setItem ou removeItem sur SAVE_KEY, tas après GC stable à 5 % près, médiane de models() des 10 dernières minutes au plus 1,1 fois celle des 10 premières.

**Gain attendu.** Une démo qui tourne indéfiniment au lieu de s'arrêter à la première mort, à la fin du premier secteur ou au premier changement d'onglet, sans toucher à la sauvegarde.

**Risques.** Le drapeau demo ne doit jamais entrer dans snapshot ni dans les sauvegardes. Le pilote ne doit rien changer hors démo (tests de simulation inchangés). Sans geste préalable, l'audio reste muet (politique de lecture automatique des navigateurs) : ne pas tenter de le forcer. Taille : environ 3 à 5 Ko. Le FDemo de FERRO doit rester inactif par défaut pour les jeux v0.2. Le changement de secteur passe par le chargement existant : appliquer d'abord les correctifs LOAD pour éviter un blocage à chaque rotation.

**Vérifier par.** Banc d'endurance sur bench/loop/harness.mjs avec le critère ci-dessus ; test unitaire : après 10 minutes de démo simulée, localStorage est identique octet pour octet à son état initial.

### RESTE-V2 — Temps envoyé aux shaders en flottant 32 bits sans repli : les animations saccadent après quelques heures d'écran titre ou de démo
- sévérité moyenne · catégorie saccade · effort M · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/renderer.js:1416; src/renderer.js:1418; src/renderer.js:1453; src/renderer.js:1465; src/game.js:677; src/game.js:717

**Preuve.** renderer.js:1416, 1418, 1453 et 1465 envoient time tel quel dans des uniformes flottants (uWindTime, uTime, vent de la passe d'ombre, uSkyMotion). game.js:717 prend t=clock en mode menu (temps depuis l'ouverture de la page, jamais remis à zéro) et sim.state.time en jeu. Calcul avec Math.fround sur 600 images à 60 i/s : à 1 h le pas vu par le shader vaut 16,60 à 16,85 ms (idéal 16,67) ; à 4,6 h, 15,63 à 17,58 ms ; à 18,2 h, 15,63 à 23,44 ms ; à 36,4 h, 15,63 ou 31,25 ms ; à 72,8 h, 280 images sur 600 n'avancent plus du tout.

**Cause.** Un float32 n'a plus qu'une résolution de 2 ms à 16 384 s et de 16 ms à 131 072 s ; le temps de présentation grandit sans borne sur l'écran titre et grandirait de même dans une démo qui garde la même horloge.

**Proposition.** FERRO : le renderer garde le temps en double et calcule côté JS, pour chaque fréquence utilisée par un shader, la phase (t*f) modulo 2π, envoyée dans un petit tableau d'uniformes ; les shaders remplacent sin(x+uTime*f) par sin(x+uPhase[k]). Les fréquences sont peu nombreuses (0,65 et 0,41 à renderer.js:409, vent, ciel) : les recenser par grep sur uTime, uWindTime et uSkyMotion. Résultat égal à l'arrondi flottant près sur les premières minutes et exact ensuite. En attendant, côté METAL : la démo remet l'horloge de présentation à zéro à chaque changement de secteur, sous le fondu.

**Gain attendu.** Animations de vent, de ciel et d'effets régulières quelle que soit la durée ; aujourd'hui la gigue du pas d'animation atteint 6 % à 4,6 h et 40 % à 18 h.

**Risques.** Les termes qui multiplient le temps par une coordonnée (dérive de bruit, défilement de nuages) ne se replient pas par une phase : il leur faut une période de repli choisie comme multiple de la période du motif, à vérifier terme par terme. Comparer des captures aux instants 10 s et 100 s avant et après. Ajoute quelques uniformes ; compatible v0.2 puisque fx.time reste l'entrée.

**Vérifier par.** Page file:// de bench/rgpu : rendre deux images à t=10 s avec l'ancien et le nouveau shader (différence nulle ou d'un niveau au plus), puis une série à t=131 072 s + k/60 : l'ancien montre des pas de 0 ou 2 images, le nouveau des pas réguliers.

### RESTE-V3 — Le régime permanent d'une longue session (débris au plafond) n'est pas celui des fenêtres de mesure : budgets et gains à établir en état saturé
- sévérité moyenne · catégorie outillage · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · moteur et jeu
- lieux : bancs/reste-verif/endure.mjs; bancs/reste/alloc.mjs; src/effects.js:172-199; src/simulation.js:1028-1065; src/destruction.js:269

**Preuve.** endure.mjs : le nombre de débris passe de 48 à l'image 600 à 133 à l'image 1 200, puis reste entre 124 et 138 jusqu'à l'image 12 000. La plupart des mesures du tour portent sur 400 images après 240 de chauffe, avec 8,6 débris en moyenne. Entre la fenêtre de 400 et celle de 1 800 images : R1 passe de 1 075,9 à 1 399,5 Ko/image, FEffects.build de 53,4 à 197,2 Ko/image, updateDebris de 17,2 à 45,7 Ko/image, sim.step de 282 à 356 Ko/image. Les destructions s'accumulent aussi lentement : 13 927 -> 11 953 maillages, 439 -> 517 colliders et 54 révisions en 12 000 images, bornés par le plafond de destruction.js:269.

**Cause.** Les bancs mesurent le début de partie ; une démo ou une longue session vit en permanence avec le plafond de débris atteint, où FEffects.build et updateDebris pèsent 3 à 4 fois plus.

**Proposition.** Ajouter aux bancs une scène saturée déterministe : 1 500 images de chauffe avec tir, puis mesure sur 600 images, en vérifiant que s.debris.length dépasse 120 pendant toute la mesure. Fixer deux budgets d'allocation distincts (début : 1 100 Ko/image aujourd'hui ; saturé : 1 400). Mesurer RESTE-05 et RESTE-07 dans cette scène, où leur gain est le plus grand. Pour la démo : la rotation de secteur de RESTE-V1 borne aussi les destructions accumulées.

**Gain attendu.** Priorités justes pour la fluidité des longues sessions : FEffects.build et updateDebris remontent dans le classement en état saturé.

**Risques.** Aucun pour le jeu (outillage hors de la page livrée). Garder des scénarios déterministes pour pouvoir comparer par rejeu.

**Vérifier par.** node --expose-gc endure.mjs r1 9000 camp:6 600 : débris stables entre 120 et 140 à partir de l'image 1 200 ; alloc.mjs sur la scène saturée donne les mêmes Ko/image à 1 % près d'un lancement à l'autre.

# Axe IA — IA : ennemis et navigation (hors boss)

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Cause des pointes : tous les pas de plus de 8 ms viennent de route(), qui pèse 85 à 95 % du pas. Cela arrive quand une recherche A* vise une autre composante connexe du graphe de navigation (28 à 39 composantes par carte ; 100 % des échecs sont de ce type). A* ignore que la cible est inaccessible : il épuise son plafond de 2400 nœuds en testant chaque arête de façon paresseuse avec segmentFree (environ 7 appels ground et 5 appels blocked par arête). Le budget compte des recherches et non du travail, si bien que deux échecs, soit 4802 nœuds, peuvent tomber dans un même pas. Un échec coûte environ 5 ms dans le realm principal, et les pas de pointe atteignent 47 à 59 ms sous node:vm. Déclencheurs : les replanifications sur début de vague ou alerte (setGoal appelé depuis plan et neuralPlan), les sondes d'entrées naturelles des renforts (ligne 711, 36 à 48 m) et les refreshNav globaux. Ces derniers surviennent 6 à 15 fois par 30 s ; 79 à 87 % d'entre eux (pilote circle) ne changent aucun collider, et chacun vide les caches d'arêtes puis replanifie tous les ennemis.

Architecture sans pointes, prototypée en mémoire (dépôt intact) :
- étiquettes de composantes et union-find, avec rejet en O(1) ;
- prédicat d'arête statique, cuit une seule fois ;
- rafraîchissement local après destruction ;
- sentinelle DEFER pour distinguer un report de budget d'un échec ;
- tas typé, nearestNode trié et balayage par seaux.

Gain mesuré sur 5 cartes v2 (pilote tour, 3 × 60 s entrelacés) :
- max 13 à 22 ms → 2,5 à 8,6 ms ;
- pas de plus de 8 ms : 5 à 7 par minute → 0 à 1 ;
- p99,9 : 11,7–12,9 ms → 2,4–4,0 ms ; moyenne −12 à −23 % ;
- travail maximal par pas : ground 33k–44k → 6k, segmentFree 4,4k–6,1k → 318 au plus.
Les parties neutres (tas, nearest, seaux) donnent un état final au hash identique à la base.

Perception et décision sont bon marché dans le realm principal : sight 3,4 µs, perceive 0,1 à 0,4 ms/s, réseau tactique 13,4 µs par lot de 16. Sous node:vm, ces coûts sont gonflés de 5 à 28 fois ; c'est un avertissement de méthode valable pour tous les axes.

Qualité de l'IA :
- l'ennemi se fige quand la cible est inaccessible (100 % du temps en attente sur 2 cartes) ;
- les reports de budget sont pris pour des échecs (48 à 201 par minute) ;
- les décisions sont lentes (0,45 à 0,8 plan par ennemi et par seconde, délai vu → visée au p90 de 1,3 à 1,9 s) ;
- il n'y a ni tir de suppression ni flanc choisi selon l'orientation du joueur ;
- la visée ne prédit ni la vitesse réelle ni la gravité du saut.
Aucun blocage d'ennemi mesuré (0 par minute).

Ordre conseillé : IA-04 (neutre), puis IA-05 et IA-01, IA-02, IA-03, IA-08, IA-07, enfin IA-09, IA-10 et IA-11. Tout ajout d'état sauvegardé passe par aiVersion 4 avec les défauts de v3 et une validation atomique.

Réserve : la machine était chargée (load average 6 à 12,5, autres processus node). Les conclusions reposent sur des compteurs déterministes et sur des médianes de runs entrelacés ; l'A/B en pilote circle est inexploitable.

Variables utilisées dans verifyBy : B=bancs/ia et R=le dépôt METAL (commit 673d6b2). Jeu de flags du prototype complet : heap,nearest,long,labels,static,local,free,defer.

## Mesures

- **Coût des primitives, node:vm contre realm principal (campagne v2, monde 10)** : ground 656 → 74 ns (8,9×) ; blocked 872 → 131 ns (6,7×) ; segmentFree sur une arête de 0,8 m 7,14 → 0,848 µs (8,4×) ; segmentFree 3 m 45,2 → 3,37 µs (13×) ; 25 m 50,5 → 3,58 µs (14×) ; sight 95,7 → 3,43 µs (28×). Part des segments aléatoires libres : 82 % à 3 m, 65 % à 8 m, 44 % à 15 m, 24 % à 25 m. _(méthode : $B/prims2.mjs : boucles chaudes après échauffement, mêmes entrées dans les deux realms ; le realm principal charge les sources par eval indirect ($B/loadmain.mjs).)_
- **Temps de pas de la simulation non modifiée (1800 pas, pilote circle, cartes legacy-s0, legacy-s2 et v2-w01)** : Realm principal : moyenne 0,142–0,273 ms, p99 0,59–1,28 ms, max 9,65–21,9 ms. vm : moyenne 0,84–1,57 ms, p99 3,1–4,9 ms, max 47,5–59,1 ms. Les pointes tombent aux mêmes pas dans les deux realms (620/684/1001 ; 1440/1644/1664 ; 669/1211/1460/1728/1754). Génération du monde 45–75 ms contre 208–434 ms ; création de la simulation 22–39 ms contre 108–150 ms. _(méthode : $B/realm.mjs : performance.now() autour de sim.step(1/60) ; pilote déterministe drive() de $B/load.mjs (moveX=sin(i/90), tir 6 pas sur 20, dash tous les 240 pas, yaw +0,01).)_
- **Attribution des pointes de pas** : Tout pas de plus de 8 ms : route.astar pèse 85–95 % du pas. Dans ce pas : 2401 ou 4802 nœuds explorés (1 ou 2 recherches plafonnées), 4,3k–6,1k segmentFree, 30k–44k ground, 21k–31k blocked. Environ 2,3–2,5 µs par test d'arête et 5 ms par recherche échouée (realm principal instrumenté). Appelants : setGoal (1437) depuis plan (1559, 1580, 1601), neuralPlan (1513, 1516) et entrées naturelles (711, 36–48 m). Les pointes coïncident avec les événements waveStart et alerted ; 1 à 2 ennemis éveillés. _(méthode : $B/routeprof.mjs, qui utilise $B/instr.mjs (temps exclusif par catégorie, compteurs d'appels, échantillon de pile pour les route() lents), en REALM=main et en vm.)_
- **Cause des recherches A* échouées** : 100 % des échecs relient deux composantes connexes différentes ; aucun plafond atteint à l'intérieur d'une même composante. Composantes : 31 / 28 / 31 / 39 / 30 selon la carte (legacy-s0 : 14 665, 7 064, 5 325, 2 291 et 1 760 cellules, plus 24 singletons). Échecs / paires uniques : 35/19, 8/1, 21/15, 18/12, 35/20 ; la même paire revient jusqu'à 8 fois. Étiquetage complet en vm : 277–324 ms pour 32,7k–38,8k tests. _(méthode : $B/failcause.mjs : pour chaque échec, BFS non plafonné sur le même prédicat (cellule de navigation + segmentFree(.4)) depuis le départ et depuis l'arrivée.)_
- **Rafraîchissements de navigation après destruction ou porte** : Base : 6 à 15 refreshNav globaux par 30 s ; pumpNav cumulé 47–554 ms par 30 s ; navPending de 17k à 43k aux pas de pointe. Prototype local sur 60 s : 79–87 % (circle) et 33–60 % (tour) des révisions ne changent aucun collider. Les rafraîchissements réels touchent 56–500 cellules et 125–842 tests d'arêtes au total. splitFallback = 0 partout ; 3 à 14 unions ; la cuisson initiale (63k–76k tests) est le seul relabel complet. _(méthode : $B/routeprof.mjs et $B/variant.mjs, avec les compteurs navStats exposés par __navProbe (prototype de $B/proto.mjs appliqué en mémoire).)_
- **Coût d'un appel route() (monde v2-w10, realm principal, µs par appel)** : Base : froid même composante 250 µs (max 5 761) ; chaud 114 (p95 209) ; chaud inaccessible 408 (max 5 254). +heap : 225 / 107 / 270. +nearest : 135 / 41 / 156. +long : 114 / 23 (p95 45) / 152. Prototype complet : 70 (max 2 461) / 27 (max 690) / 7 (max 57). _(méthode : $B/routebench.mjs : 1500 paires de 6 à 30 m sans ligne libre, classées en accessibles ou non par un BFS exact, budget illimité, puis 120 pas pour laisser finir la cuisson avant les mesures à chaud.)_
- **Neutralité des optimisations (hash de l'état final)** : heap, nearest et long : hash identique à la base sur les 7 scénarios. labels avec prédicat exact et budget consommé : hash identique aussi, mais chaque refresh global relance la cuisson (45 à 258 pas de plus de 4 ms, moyenne multipliée par 2 à 4), donc IA-02 est un prérequis. Prototype complet : hash différent de la base (changement de comportement voulu), identique d'une répétition à l'autre. _(méthode : $B/variant.mjs : SHA-1 de (position et points de vie du joueur, kills, position/hp/tactique/longueur de chemin de chaque ennemi) après N pas, pilotes circle et tour.)_
- **A/B en pilote tour, base contre prototype complet (5 cartes v2, 3 × 3600 pas entrelacés, médianes)** : max 13,2–21,9 → 2,5–8,6 ms (pire 18–31,5 → 4,3–9,9 ms) ; pas de plus de 8 ms 5–7 → 0–1 par minute ; p99,9 11,7–12,9 → 2,4–4,0 ms ; p99 1,62–2,82 → 1,0–2,16 ms ; moyenne 0,338/0,266/0,271/0,307/0,366 → 0,285/0,224/0,239/0,237/0,319 ms ; recherches A* 139/118/219/274/314 → 54/81/67/112/242 par minute ; reports de budget 173/48/158/201/169 → 0/1/0/0/5 par minute ; hash stable entre répétitions. _(méthode : sh $B/abrun.sh $R heap,nearest,long,labels,static,local,free,defer tour 3600 3 v2 ; résultats bruts dans $B/ab-tour-heap_nearest_long_labels_static_local_fr.jsonl. L'A/B en pilote circle ($B/ab-circle-summary.txt) est trop bruité par la charge machine.)_
- **Travail déterministe par pas (insensible à la charge machine)** : Maximum par pas en base : ground 33,3k–44,5k, blocked 22,6k–31,4k, segmentFree 4,4k–6,1k, nœuds explorés 2,4k–4,8k. Prototype : ground environ 6,0k–6,1k (la tranche de cuisson), blocked 674 au plus, segmentFree 318 au plus, nœuds 675 au plus. Pas à plus de 20k ground en base : 3–17 (circle) et 3–7 (tour) ; pas à plus de 10k ground avec le prototype : 0. ground moyen par pas : 415–1 379 → 352–1 108. _(méthode : $B/workcount.mjs : compteurs d'appels injectés en mémoire, realm principal, base contre flags du prototype.)_
- **Coûts de perception et de décision en combat (pilote tour, 60 s, realm principal)** : Rayons 119–362/s (safeEntry 33–152, autres dont les balles 65–193, perceive 5–12, updateBrain 4–32). perceive 32–73 appels/s à 2,1–5,9 µs ; updateBrain 4–7,7 µs/pas (220 lots/min, 1 081–2 455 acteurs/min, 0 accéléré) ; safeEntry 183–273 µs/appel (0,45–1,4 ms/s) ; updateEncounters 21–31,5 µs/pas (1,3–1,9 ms/s) ; navigate 1,6–1,9 µs/appel ; separate 3,4–10,8 µs/pas ; rebuildNeighbors 3,3–4,8 µs, 2 fois par pas ; plan 2–5 appels/s ; cover 292–503 µs et peek 431 µs par appel ; canShoot 13–21 µs. _(méthode : $B/percep.mjs : temps exclusif et compteurs de $B/instr.mjs, rayons attribués par appelant.)_
- **Inférence du réseau tactique sur CPU** : FBrain.cpu : 13,4 µs par lot de 16 lignes (evaluate() en mode cpu 13,7 µs), soit 0,86 µs par acteur ; à 220 lots/min, environ 3 ms par minute. _(méthode : node, realm principal, src/brain.js chargé par eval indirect : 2 000 itérations d'échauffement puis 20 000 mesurées (commande node -e ad hoc).)_
- **Indicateurs de qualité de l'IA (pilote tour, 5 cartes v2, 60 s)** : Ennemis engagés en moyenne 3,7–11 ; 0,45–0,80 plan par ennemi engagé et par seconde ; blocages 0/min ; joueur vu 12–25 % du temps engagé ; en visée ou rafale 3,5–7,3 % ; attente immobile 1,4–10,3 % ; en mouvement 81–95 % ; tireurs simultanés max 2–5 (moyenne 1,3–1,55) ; tirs ennemis 0,28–0,97/s ; dégâts au joueur 0–0,88 hp/s ; délai vu → visée au p90 1,33–1,92 s. Base et prototype sont quasi identiques. _(méthode : $B/aiq.mjs : compteurs dans plan() et dans la branche de blocage, états échantillonnés à chaque pas, téléportation du joueur sur les déclencheurs de rencontre toutes les 420 pas.)_
- **Ennemis figés devant une cible inaccessible (pilote circle)** : legacy-s0 : attente 60,4 % → 17–19 %, mouvement 19 % → 62–67 % avec le prototype ; legacy-s2 et v2-w06 : attente 100 % en base comme avec le prototype ; v2-w16 : 50 % → 21 %. _(méthode : $B/variant.mjs : holdPct (tactique hold hors visée) et movePct (moveSpeed > 0,3) sur les ennemis éveillés ayant une mémoire.)_
- **Coût de cover() et de peek() (120 appels, cible vue entre 9 et 14 m)** : Realm principal : cover p50 0,275 ms, moyenne 1,01 ms, max 19,4 ms (setGoal suivi d'un A* échoué), 23 rayons en moyenne (max 44), 107 réussites sur 120 ; peek p50 0,39 ms, moyenne 0,83 ms, max 9,8 ms, 33–36 rayons, 64 réussites sur 120. vm : p50 3,66 ms et 4,68 ms. _(méthode : $B/coverbench.mjs (budget de route illimité, état de l'ennemi restauré après chaque appel).)_
- **Cuisson initiale des arêtes (prototype avec prédicat statique)** : 63k–76k arêtes, 20–45 ms répartis sur 20–25 pas (1 à 2 ms par pas) ; l'étiquetage final labelNav prend 2,3–7,4 ms en un seul pas ; environ 0,35 µs par arête. _(méthode : $B/variant.mjs : firstBakeMs et labelsReadyAt, runs circle peu chargés.)_
- **Données du monde et conditions de mesure** : Grille de 0,8 m : 37 114 cellules (legacy-s0 et v2) à 43 771 (legacy-s2) ; 24–28 sols, 421–504 colliders, 54–170 ennemis ; pièges lame, presse et pics (boîtes reconstruites à chaque pas, ligne 1840), 3 portes, 2 ascenseurs, 3 jump pads. Load average 6 à 12,5 pendant les runs (autres processus node concurrents). _(méthode : Inspection de l'état après FSimulation.create et uptime pendant les runs. Conclusions fondées sur les compteurs déterministes et sur les médianes de runs entrelacés.)_

## Scripts de banc

- bancs/ia/load.mjs
- bancs/ia/loadmain.mjs
- bancs/ia/instr.mjs
- bancs/ia/proto.mjs
- bancs/ia/routeprof.mjs
- bancs/ia/failcause.mjs
- bancs/ia/prims.mjs
- bancs/ia/prims2.mjs
- bancs/ia/realm.mjs
- bancs/ia/variant.mjs
- bancs/ia/abrun.sh
- bancs/ia/routebench.mjs
- bancs/ia/workcount.mjs
- bancs/ia/percep.mjs
- bancs/ia/aiq.mjs
- bancs/ia/coverbench.mjs

## Constats

### IA-01 — Pointes de 10 à 31 ms (47 à 59 ms sous vm) : A* plafonné à 2400 nœuds vers une composante inaccessible
- sévérité critique · catégorie saccade · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:1402-1433; src/simulation.js:1406; src/simulation.js:1414; src/simulation.js:1420; src/simulation.js:1742; src/simulation.js:1437; src/simulation.js:1513-1516; src/simulation.js:1559; src/simulation.js:1580; src/simulation.js:1601; src/simulation.js:711; src/simulation.js:1389

**Preuve.** Code :
- src/simulation.js:1742 `routeBudget=advanced?2:Infinity` : le budget compte des recherches, pas du travail ; il est consommé en 1406.
- 1414 `while(heap.length&&explored++<2400)`.
- 1420 : chaque arête est testée paresseusement par `segmentFree(...coord(i),...coord(j),.4)`, soit environ 7 ground et 5 blocked par arête de 0,8 m (848 ns dans le realm principal).

Mesures :
- routeprof.mjs : tout pas de plus de 8 ms est dominé par route.astar (85–95 %), avec 2401 ou 4802 nœuds explorés, 4,3k–6,1k segmentFree, 30k–44k ground et 21k–31k blocked ; environ 5 ms par recherche échouée (realm principal instrumenté).
- failcause.mjs : 100 % des échecs relient deux composantes différentes (28 à 39 composantes par carte) ; aucun plafond atteint à l'intérieur d'une composante ; la même paire est recherchée jusqu'à 8 fois.

Déclencheurs observés :
- setGoal (1437) appelé par plan en 1559 (avance vers lastSeen), 1580 (flanc du type 0) et 1601 (type 2) ;
- neuralPlan (1513, 1516) ;
- entrées naturelles (711, 36–48 m) ;
- branche de blocage (1530).
Les pointes s'alignent sur waveStart et alerted, et sur les refreshNav : la ligne 1389 remet à zéro path, planWait et thinkWait de tous les ennemis.

**Cause.** route() ne sait pas qu'une cible est hors de la composante de départ. Il épuise 2400 pops, chacun avec jusqu'à 4 tests d'arête segmentFree, avant de rendre null, et ne mémorise pas l'échec. Comme le budget compte des recherches et non du travail, deux échecs (4802 nœuds) peuvent tomber dans le même pas. Les buts (points autour de lastSeen, entrées de renfort) tombent souvent dans une autre composante : le graphe est mesuré fragmenté (24 singletons sur legacy-s0) ; la cause probable est une plate-forme, une zone derrière une porte fermée ou un dénivelé de plus de 0,42 m, à confirmer composante par composante.

**Proposition.** Étiqueter les composantes connexes de la grille de navigation.
1) `navComp=new Int32Array(nav.length).fill(-1)` et `compParent=new Int32Array(nav.length)` (union-find avec compression par moitié). BFS à 4 voisins sur les bits d'arête, en réutilisant `queue` (ligne 513, inutilisé en mode avancé).
2) Cuire toutes les arêtes une fois avec le prédicat statique d'IA-05 (environ 0,35 µs par arête, 63k–76k arêtes). Recommandé : de façon synchrone dans FSimulation.create() et dans restore(). Sinon : par tranches de 3000 arêtes par pas dans le créneau de pumpNav quand navPending vaut 0, avec labelNav en fin de cuisson.
3) Dans route(), juste après les deux nearestNode : `if(labelsReady&&navComp[start]>=0&&navComp[end]>=0&&findComp(navComp[start])!==findComp(navComp[end]))return null;`.
4) Deux variantes :
- strictement neutre : rejet placé après `routeBudget--` (résultat identique bit à bit, mesuré) ;
- recommandée : nearestNode et rejet avant la consommation du budget, qui ne sert alors qu'aux recherches utiles.
5) Alternatives écartées :
- recherche reprenable sur plusieurs pas : l'état du tas devrait être sérialisé ou terminé dans snapshot(), et après étiquetage le maximum mesuré n'est que de 675 nœuds par pas ;
- champ de flux partagé vers le joueur : à reconstruire à chaque cellule franchie (0,5 à 1 ms estimés), et inutile pour les buts de flanc et de couverture.
Prérequis : IA-02, sinon chaque refreshNav global relance toute la cuisson.

**Gain attendu.** Mesuré avec le prototype complet (5 cartes v2, pilote tour, 3 × 3600 pas entrelacés) :
- max par run 13,2–21,9 → 2,5–8,6 ms en médiane, pire cas 18–31,5 → 4,3–9,9 ms ;
- pas de plus de 8 ms : 5–7 → 0–1 par minute ;
- p99,9 11,7–12,9 → 2,4–4,0 ms ;
- moyenne −12 à −23 %.
Travail maximal par pas : ground 33,3k–44,5k → environ 6,1k, segmentFree 4,4k–6,1k → 318 au plus, nœuds 2,4k–4,8k → 675 au plus. route() vers une cible inaccessible, à chaud : 408 µs en moyenne et 5 254 µs au max → 7 et 57 µs.

**Risques.** Déterminisme :
- le rejet placé après la consommation du budget est neutre (hash identique sur 7 scénarios) ;
- le rejet gratuit change le comportement (voulu) et exige les mêmes étiquettes à chaque pas dans la simulation vivante et dans la simulation restaurée. Il faut donc une cuisson synchrone dans restore() juste avant `return true` (2215), ou consommer le budget tant que labelsReady est faux.

Autres points :
- Sauvegardes : données dérivées, rien à sérialiser, aiVersion inchangé.
- Mémoire : 8 octets par cellule, soit 0,30 à 0,35 Mo.
- Chargement : +22 à 27 ms si la cuisson est synchrone.
- Tests : checks/simulation.test.mjs:1184 et checks/brain.test.mjs:120 (pathSearches ≤ 2) restent vrais. Ajouter un test « route()===null si et seulement si les composantes diffèrent » sur des paires aléatoires (budget illimité) et un aller-retour snapshot/restore qui compare les étiquettes.
- AGENTS.md : tests de simulation obligatoires ; environ +3 à 5 Ko de source pour un budget de 1 400 000 octets (environ 0,69 Mo utilisés).

**Vérifier par.** - `sh $B/abrun.sh $R heap,nearest,long,labels,static,local,free,defer tour 3600 3 v2` : médianes de max, over8 et p999.
- `node $B/workcount.mjs $R <flags> tour 3600 v2` : maximum par pas de ground, segmentFree et nœuds (déterministe).
- `node $B/routebench.mjs $R <flags>`.
- `REALM=main PROTO=<flags> node $B/routeprof.mjs $R 1800 tour v2` : plus aucun pas de plus de 8 ms imputé à route.astar.

**Contre-vérification.** Code relu (simulation.js:1402-1433, 1406, 1414, 1420, 1742) : exact. Preuve indépendante (V2/spikes.mjs ... check : BFS non plafonné sur le graphe vu par A* à l'instant de l'échec) : 100 % des A* échoués sont réellement inaccessibles, dans tous mes scénarios (11/11, 68/68, 67/67 en pilote tour ; 162/162, 221/221, 9/9, 34/34, 15/15, 17/17 avec des états de portes légitimes). 31 à 32 pas par minute contiennent 2 échecs (4802 nœuds). Le prototype complet (PROTO=heap,nearest,long,labels,static,local,free,defer) donne : échecs -> 0, reports -> 0, refresh globaux -> 0, nœuds explorés par minute 136 887 -> 3 699, 272 525 -> 6 762, 34 837 -> 11 608, 92 846 -> 12 332 (-67 à -97 %), part de route() dans le temps de pas 9-35 % -> 0,8-1,8 % (rapport dans le même processus).

Deux corrections importantes.
1) Le pilote « tour » gonfle le constat. Il téléporte le joueur dans des salles dont la porte est fermée : 75 à 91 % des échecs v2 du pilote tour (62/68 et 51/67) viennent de la ligne 711 pour encounter-4, dont le déclencheur (hub, composante de 389 cellules) est séparé de ses 8 entrées par door-1 (V2/topo.mjs). Joueur immobile sur ce déclencheur (V2/streak.mjs) : 1384 sondes nulles, 173 ticks consécutifs à 2 A* plafonnés, vague jamais déployée (0/3 après 39 s). À pied cette situation exige door-1 ouverte ; elle reste atteignable par jump pad (voir IA-V2), non vérifié avec un joueur. Avec des portes dans un état légitime : 9 à 34 échecs plafonnés par minute (toutes portes ouvertes), 15 à 17 (door-2 fermée), et 162 à 221 portes fermées (boucle returnToPost, IA-V2).
2) La cause « à confirmer composante par composante » est maintenant établie : portes ouvertes, 100 % des échecs visent le substrat hors carte (IA-V1) ; sinon portes fermées et jump pads à sens unique.

Coût d'un échec plafonné, minimum observé sous charge : 0,7 à 0,9 ms à chaud (arêtes en cache), 8 à 11 ms à froid après un refreshNav qui vide les caches. Le chiffre « 5 ms par échec » ne vaut donc que pour le premier échec après un refresh.

Faisabilité : le rejet par étiquette est sûr pour les gros gabarits (rayon 1,05 et géants) car les composantes à r=0,4 sont un sur-ensemble. Destination METAL : FERRO v0.2 n'a pas de simulation.

**Preuve corrigée.** Appelants des échecs en états de portes légitimes : plan:1580, neuralPlan:1513/1516, cover:1459, plan:1594/1601 et returnToPost:740 ; la ligne 711 n'y apparaît pas (0 échec dans les scénarios B et C). Les critères d'acceptation doivent utiliser des pilotes légitimes (IA-V3), pas « tour » seul.

**Gain corrigé.** Gain déterministe confirmé : -67 à -97 % de nœuds explorés, 0 échec, 0 report, part de route() de 9-35 % à 0,8-1,8 % du pas. Gains en ms non re-mesurables (charge 40-65). En jeu réel la fréquence des pointes froides est plus basse que ne le suggère le pilote tour : 9 à 34 A* plafonnés par minute au lieu de 67-68, dont seuls ceux qui suivent un refreshNav coûtent 8 ms ou plus.

### IA-02 — refreshNav global à chaque révision de destruction : file complète, caches vidés, tous les plans jetés
- sévérité haute · catégorie saccade · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:229-231; src/simulation.js:300; src/simulation.js:316; src/simulation.js:912; src/simulation.js:1379-1391; src/destruction.js:160-178; checks/simulation.test.mjs:1862-1871

**Preuve.** Code :
- src/simulation.js:231 : syncDestruction met navDirty à vrai à chaque destruction.revision ; 300 à l'ouverture d'une porte ; 912 quand une porte est détruite.
- 316 : `if(navDirty){refreshNav();...}`.
- 1383-1391, refreshNav(true) : remet en file les 37k–44k cellules (pompées 768 par pas en 1379, soit 49 à 57 pas), exécute `edgeKnown.fill(0);edgeOpen.fill(0)`, puis met pour chaque ennemi path=[], planWait=0 et thinkWait=(id%8)*.06. Il en résulte une rafale de replanifications à froid sur 0,42 s.

Mesures en base : 6 à 15 refresh globaux par 30 s ; pumpNav cumulé 47–554 ms par 30 s ; navPending de 17k à 43k aux pas de pointe.

Mesures du prototype (60 s) :
- 79–87 % (circle) et 33–60 % (tour) des révisions ne changent aucun collider ;
- skippedRefresh 7–22 contre 1–5 rafraîchissements réels en circle, 2–7 contre 4–6 en tour ;
- les rafraîchissements réels touchent 56–500 cellules et 125–842 tests d'arêtes au total ;
- splitFallback = 0 ; 3 à 14 unions.

**Cause.** Le signal de changement est un booléen global. destruction.js rebuild() recrée les boîtes de tous les groupes, même pour une découpe décorative, et ne transmet aucune région. Les découpes ne font que retirer du volume, donc n'ouvrent que des passages, mais tout est recalculé et tous les chemins sont jetés.

**Proposition.** 1) Dans destruction.js rebuild(), exposer `changedBounds` : l'union des g.bounds des groupes dont la liste de boîtes a vraiment changé (comparaison des boîtes, ou signature par destructibleId : nombre de boîtes + somme pondérée des coordonnées). Si l'union est vide, ne pas lever navDirty et incrémenter un compteur skippedRefresh.
2) Portes (lignes 300 et 912) : marquer la boîte de la porte via markDirty.
3) Ligne 316 : `if(advanced&&dirtyAny)refreshLocal();else if(navDirty)refreshNav();`.
4) refreshLocal :
- élargir la région de 0,4 + cell + 0,05 m ;
- recalculer nav[] dans la région, immédiatement si elle compte au plus 768 cellules, sinon via navQueue ;
- donner un nouvel id de composante à toute cellule devenue marchable ;
- réinitialiser et retester les arêtes de [x0−1..x1]×[z0−1..z1] ;
- fusionner par union-find à chaque arête ouverte ;
- relabel complet seulement si une arête se ferme (porte refermée, sol détruit : splitFallback).
5) N'invalider que les ennemis dont le chemin restant traverse la région (test AABB sur les cellules restantes), sans toucher au thinkWait des autres.

**Gain attendu.** Mesuré :
- de 63k–76k tests d'arêtes par rafraîchissement (cuisson relancée) à 125–842 tests au total par minute ;
- 33 à 87 % des rafraîchissements supprimés ;
- fin des rafales globales de replanification : recherches A* en pilote tour 118–314 → 54–242 par minute avec l'ensemble.
La part qui touche aux pointes est comptée dans le gain d'IA-01.

**Risques.** Déterminisme : la région ne doit dépendre que de l'état de simulation (parcourir les groupes dans l'ordre des ids). refreshLocal doit produire exactement la même partition qu'un relabel complet ; à prouver par un test d'équivalence après destructions aléatoires.
Sauvegardes : restore() garde son refreshNav(false) complet (2215), suivi de l'étiquetage synchrone ; rien de nouveau à sérialiser.
Tests : checks/simulation.test.mjs:1862-1871 exige navPending>0 au moins une fois (« Large-grid maintenance must actually be amortised »). Il faut le réécrire en gardant navUpdates ≤ 768, le passage physique immédiat, la cellule (0,−8) marchable après N pas et le checkpoint matérialisé, ou bien conserver la file pour les régions de plus de 768 cellules.
Comportement : les ennemis non concernés ne replanifient plus après chaque explosion (hash différent, voulu).

**Vérifier par.** - `node $B/variant.mjs $R heap,nearest,long,labels,static,local,free,defer tour 3600 v2` : compteurs nav (skippedRefresh, localRefresh, localCells, localTests, splitFallback).
- Nouveau test : après 50 destructions aléatoires, la partition locale est égale à la partition recalculée de zéro.
- checks/simulation.test.mjs adapté.

**Contre-vérification.** Code relu (231, 300, 316, 912, 1379-1391) : exact. Preuve indépendante (V2/refresh.mjs : signature de la liste de colliders avant et après chaque révision) : révisions sans aucun changement de collider = 7/8, 10/11, 6/7 en pilote circle (86 à 91 %, un peu plus que les 79-87 % annoncés) et 4/8, 7/13, 6/10, 7/12 en pilote tour (50 à 60 %). 8 à 19 refreshNav globaux par minute, 0 dû aux portes dans ces runs ; 290 à 501 pas sur 3600 ont une file de navigation non vide. Avec le prototype : 0 refresh global dans mes 4 runs.

Correction de la cause : destruction.js:164 met déjà en cache la compilation par groupe (cacheRecord, cacheCount, cacheRemoved). rebuild() ne « recrée pas les boîtes de tous les groupes » : il reconstruit seulement le tableau colliders. La région changée est donc triviale à obtenir : c'est l'union des bornes des groupes qui ne passent pas le `continue` de la ligne 164 (anciennes et nouvelles g.solids).

À ajouter : 66 à 67 % des cellules remises en file sont du substrat hors carte (IA-V1).

Réserve : l'affirmation « les découpes ne font qu'ouvrir des passages » n'est pas prouvée pour tous les cas ; garder le repli splitFallback et le test d'équivalence partition locale = partition complète. Le test checks/simulation.test.mjs:1862-1871 exige navPending>0 : à adapter comme indiqué.

**Preuve corrigée.** destruction.js:164-165 : le cache par groupe existe déjà ; seul le signal (booléen global) et la reconstruction du tableau sont globaux.

**Gain corrigé.** 50 à 91 % des refresh supprimés sans aucun calcul (mesuré). Le reste devient local.

### IA-03 — Un report de budget est traité comme une absence de chemin : arrêts, chemins effacés, renforts sautés
- sévérité haute · catégorie bug · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:1406; src/simulation.js:1437-1438; src/simulation.js:1529-1531; src/simulation.js:1609; src/simulation.js:711; src/simulation.js:740; src/simulation.js:1776; src/simulation.js:1791

**Preuve.** src/simulation.js:1406 `if(routeBudget<=0){routeDeferred++;return null;}` renvoie le même null que « aucun chemin ». Conséquences :
- setGoal (1437) renvoie false, plan() épuise ses options puis passe en `e.tactic='hold'` (1609) jusqu'au plan suivant (thinkWait de 0,65 à 0,75 s, ligne 1791) ;
- branche de blocage (1530) : `e.path=path||[]` efface le chemin d'un ennemi bloqué ;
- ligne 711 : `if(approachPath===null)continue;` saute une entrée naturelle valide et gaspille l'une des 8 sondes du tick (684) ;
- lignes 740 et 1776 : `if(!setGoal(...))` vide le chemin du retour au poste ou pose planWait=.4.

Mesure (variant.mjs, pilote tour, 60 s) : en base, 48 à 201 reports par minute (pathDeferred 173/48/158/201/169), chacun converti en échec. Avec le prototype (DEFER + rejet gratuit) : 0 à 5 par minute, deferKeep de 0 à 5. Aucun blocage d'ennemi n'a été mesuré (aiq.mjs : 0 par minute) ; le seul défaut de l'anti-blocage est donc l'effacement du chemin sur report.

**Cause.** Le contrat de route() mélange deux états, « pas de chemin » et « pas de budget dans ce pas ». Le budget compte des recherches, pas du travail.

**Proposition.** 1) Déclarer `const DEFER=false;` ; route() renvoie DEFER quand le budget est épuisé.
2) Dans setGoal : `if(path===false){e.thinkWait=Math.min(e.thinkWait,.1);return true;}`. Le but et le chemin courants sont conservés et la planification est retentée dans 0,1 s au plus. cover() et peek() lisent true comme un nouveau but et posent holdTime ou coverWait : leur renvoyer un tri-état ('defer'), ou tester path===false avant d'écrire holdTime et coverWait.
3) Dans updateEncounters (711) : `if(approachPath===false){approachPath=null;probes=0;break;}` pour arrêter les sondes de ce tick et reprendre au suivant.
4) Branche de blocage (1530) : sur DEFER, garder l'ancien chemin et laisser e.stuck pour retenter.
5) Filet optionnel : budget en unités de travail (pop = 1, test d'arête = 8, environ 6000 unités par pas), en gardant routeSearches ≤ 2.

**Gain attendu.** Mesuré : reports 48–201 → 0–5 par minute (prototype complet). Attente en pilote circle : legacy-s0 60,4 → 17–19 %, v2-w16 50 → 21 % ; c'est un effet combiné avec IA-01 et IA-08. Qualitatif : plus d'arrêts de 0,65 s ni de renforts sautés.

**Risques.** Déterminisme conservé : le résultat ne dépend que de l'ordre des appels.
Sauvegardes : thinkWait reste dans [-0,05 ; 0,75], la plage validée par restore ; aucun champ nouveau.
Tests : checks/simulation.test.mjs:1184-1185 et checks/brain.test.mjs:120 exigent pathSearches ≤ 2 ; garder ce plafond si un budget de travail est ajouté.
Comportement : hash différent (voulu).

**Vérifier par.** - `node $B/variant.mjs $R free,defer tour 3600 v2`, comparé à base : deferred, holdPct, movePct.
- Test unitaire : avec un budget forcé à 0, setGoal conserve goalX, goalZ et path, et l'ennemi ne passe pas en 'hold'.

**Contre-vérification.** Le défaut de contrat est réel (1406 renvoie le même null qu'un échec) et les comptes sont reproduits à l'unité : 15, 173 et 158 reports par minute (legacy-s0, v2-w01, v2-w10).

Mais l'effet sur le comportement est très surestimé (V2/defer.mjs) : 92 à 98 % des reports sont des sondes d'entrées naturelles de la ligne 711 (170/173 et 146/158), en majorité pour encounter-4, artefact du pilote. Seuls 1 à 6 plans par minute ont subi un report, et 1 à 4 passages en 'hold' par minute en découlent, sur 44 à 59 'hold' par minute (2 à 7 %). Chemins effacés sur blocage : 0. Retours au poste et renforts reportés : 0 à 1. La baisse d'attente 60 -> 17-19 % citée n'est pas attribuable à DEFER : elle vient du rejet gratuit d'IA-01. Avec IA-01, les reports tombent à 0 dans mes runs.

Proposition faisable. Attention à `DEFER=false` : `[]` est vrai et `false` est faux, donc chaque appelant doit tester `===false` avant `!path` ; en 711 un `false` non traité serait pris pour un chemin (`approachPath!==null`) et écrirait e.path=false. Sévérité à ramener à moyenne.

**Gain corrigé.** 1 à 4 arrêts injustifiés par minute supprimés (mesuré), et non 48 à 201. À faire après IA-01, qui supprime déjà la quasi-totalité des reports.

### IA-04 — Micro-optimisations neutres de route() : tas typé, nearestNode trié, balayage long par seaux
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/simulation.js:1392-1401; src/simulation.js:1410-1411; src/simulation.js:1354; src/simulation.js:1405; src/simulation.js:1430

**Preuve.** Code :
- src/simulation.js:1410-1411 : tas binaire de tableaux `[i,cost]` (une allocation par push) et un tableau de voisins alloué à chaque expansion.
- 1392-1401 : nearestNode parcourt un carré 7×7 en ordre ligne et appelle segmentFree pour chaque candidat plus proche que le meilleur courant, soit jusqu'à 49 balayages.
- 1354 : un segment long (plus grand que bucketRadius : test direct en 1405, string-pulling en 1430 jusqu'à 14 cellules, nearestNode) balaie les 421 à 504 solids.

Mesures (routebench.mjs, monde w10, µs par route()) :

| Variante | Froid | Chaud | Inaccessible |
|---|---|---|---|
| base | 250 | 114 (p95 209) | 408 |
| +heap | 225 | 107 | 270 |
| +nearest | 135 | 41 | 156 |
| +long | 114 | 23 (p95 45) | 152 |

variant.mjs : hash identique à la base sur les 7 scénarios pour heap, nearest et long.

**Cause.** Allocations dans la boucle chaude, ordre de test non trié et balayage linéaire de tous les solides pour les segments longs.

**Proposition.** heap : `heapNode=new Int32Array(9608)` et `heapKey=new Float64Array(9608)`, où 9608 = 2400 × 4 + 8. hpush et hpop reprennent exactement les règles de tamisage actuelles : `<=` à l'insertion, `<` strict pour choisir l'enfant, `>=` pour l'arrêt. hn=0 à chaque recherche. Voisins déroulés : `k===0?(ix?i-1:-1):k===1?(ix<nx-1?i+1:-1):k===2?i-nx:i+nx`.

nearest : collecter les 49 candidats au plus, les trier par insertion stable sur (d, ordre ligne) avec `>` strict, tester segmentFree dans cet ordre et renvoyer le premier succès. Le résultat est le même que l'original, qui compare avec `<` strict.

long : pour `!short && r<=bucketRadius`, parcourir les seaux de collision qui couvrent l'AABB du segment, plus doorBoxes ; une boîte vue deux fois ne fait que refaire un test idempotent. Repli sur solids si r > 1,05.

**Gain attendu.** Mesuré : route() réussi à chaud 114 → 23 µs (−80 %), à froid 250 → 114 µs, vers une cible inaccessible 408 → 152 µs, avec un hash identique à la base.

**Risques.** Neutre seulement si l'ordre exact du tas est respecté, y compris pour les coûts égaux : test de hash obligatoire. Mémoire +115 Ko. Taille +1 à 2 Ko. Aucun effet sur les sauvegardes.

**Vérifier par.** - `node $B/variant.mjs $R heap,nearest,long circle 1800` puis `tour 3600` : hash identique à base sur les 7 scénarios.
- `node $B/routebench.mjs $R heap,nearest,long`.

**Contre-vérification.** Code relu (1392-1401, 1410-1411, 1354) : exact. Preuve indépendante de neutralité (V2/diffroute.mjs, base et variante dans le même processus) : 0 écart de nearestNode et 0 écart de route() sur 2000 requêtes (legacy-s0) et 3000 (v2-w10) ; snapshot() identique octet pour octet après 1800 pas pilotés (legacy-s0 circle, 166 623 octets ; v2-w10 tour, 164 422 octets).

Vitesse, appariée sous charge : p50 30 -> 22 µs et 39 -> 24 µs ; moyenne 1012 -> 481 µs et 1366 -> 547 µs (-52 à -60 %), sur un jeu de requêtes dont 56 à 57 % rendent null. Le -80 % annoncé pour les routes réussies à chaud n'est pas retrouvé tel quel mais le sens et l'ordre de grandeur tiennent. Garder le test de hash dans la suite de tests : l'ordre du tas pour les coûts égaux est la seule chose fragile.

**Gain corrigé.** -27 à -38 % sur la médiane et -52 à -60 % sur la moyenne de route(), état de simulation prouvé égal.

### IA-05 — Prédicat d'arête statique avec cache de hauteur navY : cuisson rapide et arêtes indépendantes de la pose des pièges
- sévérité moyenne · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/simulation.js:1349-1375; src/simulation.js:1420; src/simulation.js:242; src/simulation.js:126; src/simulation.js:516; src/simulation.js:1840

**Preuve.** Coût actuel :
- src/simulation.js:1420 : chaque arête est testée par segmentFree(.4) (1349-1375) : 2 blocked aux extrémités, 2 groundAt, un balayage, puis un échantillon tous les 0,3 m (ground + blocked). Pour 0,8 m : 848 ns dans le realm principal, 7,14 µs sous vm.
- Les corps de rayon r > 0,4 retestent chaque arête.

Dépendance aux pièges :
- blocked et ground prennent par défaut les pièges courants (242 `traps=trapBoxes`, 126 `activeTraps=trapStates`), et trapBoxes est reconstruit à chaque pas (1840).
- nav[] exclut au contraire les pièges (ligne 516, argument `[]`).
- Un bit d'arête mis en cache dépend donc de la pose du piège au moment du test. Une simulation restaurée qui reteste plus tard peut diverger : plausible, non démontré.

Mesures : prototype complet à froid 70 µs (max 2 461) contre 114 µs avec heap+nearest+long ; cuisson environ 0,35 µs par arête.

**Cause.** Le prédicat d'arête réutilise la primitive générale segmentFree, dynamique et sensible aux pièges, au lieu d'un test spécialisé pour une arête de grille de 0,8 m.

**Proposition.** - `navY=new Float64Array(nav.length)`, rempli avec `ground(x,z,[])` à l'initialisation et à chaque recalcul de cellule.
- `edgeTest(i,j)` :
  - balayage du seau du milieu + doorBoxes, avec le même test de dalle que segmentFree ;
  - échantillons intérieurs à k/3 avec `ground(...,[])` et une marche de 0,42 m au plus ;
  - `blocked()` sur les échantillons intérieurs seulement quand y sort de [min(ay,by), max(ay,by)] ;
  - bits symétriques : setEdge écrit les deux bits miroirs ;
  - aucun piège.
- Option : ajouter l'empreinte statique des presses et des lames (boîte englobante de leur course) comme obstacle de navigation, pour ne pas planifier à travers.

**Gain attendu.** Mesuré : cuisson complète de 63k–76k arêtes en 20–45 ms (1 à 2 ms par pas sur 20 à 25 pas) ; route() à froid 114 → 70 µs. Les arêtes en cache ne dépendent plus du moment du test, ce qui rend la simulation vivante et la simulation restaurée cohérentes.

**Risques.** Change le comportement (hash différent) : les pièges ne bloquent plus la planification, et un ennemi peut traverser une presse active ; l'évitement local et les dégâts existants restent. La marche de 0,42 m doit être conservée. Tests de pièges et d'IA à rejouer (checks/simulation.test.mjs). Mémoire +0,30 à 0,35 Mo (rester en Float64 pour la précision des hauteurs). Taille +1,5 Ko. Aucun effet sur les sauvegardes.

**Vérifier par.** - `node $B/routebench.mjs $R heap,nearest,long,labels,static`.
- `node $B/variant.mjs` : bakeTests et firstBakeMs.
- Nouveau test : sur toutes les arêtes, edgeTest est égal à segmentFree(.4) sans pièges, avec 0 écart.

**Contre-vérification.** La dépendance aux pièges, laissée « plausible, non démontrée », est maintenant démontrée (V2/stale.mjs, v2-w01, pilote tour, 120 balayages) : des bits d'arête en cache contredisent un segmentFree refait à l'instant, 141 au total, dont 117 (83 %) à moins de 1,4 m d'une boîte de piège ; jusqu'à 21 bits périmés à la fois sur environ 5 700 connus. Une simulation restaurée (refreshNav(false) en 2215 vide les caches) reteste donc avec une autre pose de piège que la simulation vivante.

Code relu (242 traps=trapBoxes par défaut, 126 activeTraps=trapStates, 516 nav sans pièges) : exact. Le coût de cuisson (0,35 µs par arête) n'a pas été re-mesuré.

Réserve de qualité : sans l'option « empreinte statique des presses et lames », les ennemis planifient à travers un piège actif. Cette option doit être activée par défaut, sinon c'est une régression de comportement. Le test « edgeTest == segmentFree(.4) sans pièges sur toutes les arêtes, 0 écart » est indispensable. Prérequis de l'exactitude des étiquettes d'IA-01.

**Preuve corrigée.** 141 bits d'arête périmés en 60 s, 83 % près des pièges (mesuré) ; les 17 % restants sont probablement dus au retard de pumpNav après destruction.

### IA-06 — Méthode : node:vm gonfle les coûts CPU de 5 à 28 fois ; les 40–56 ms rapportés valent environ 10–30 ms en navigateur
- sévérité haute · catégorie perf-cpu · effort S · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité sans objet · moteur et jeu
- lieux : tools/campaign-profiles.mjs:2-9; tools/campaign-balance.mjs:5-7; tools/boss-profiles.mjs:3-4; src/game.js:675-695

**Preuve.** Mesures, sous vm puis dans le realm principal :
- prims2.mjs : ground 656 et 74 ns ; blocked 872 et 131 ns ; segmentFree sur 3 m 45,2 et 3,37 µs ; sight 95,7 et 3,43 µs.
- realm.mjs : max 47,5–59,1 ms et 9,65–21,9 ms aux mêmes indices de pas ; génération du monde 208–434 et 45–75 ms.

Outillage du dépôt : les checks (checks/*.test.mjs) et les outils tools/campaign-profiles.mjs:2-9, tools/campaign-balance.mjs:5-7 et tools/boss-profiles.mjs:3-4 chargent le code par vm.createContext. La boucle du jeu (src/game.js:675-695) fait `steps=ceil(dt*60)` avec dt borné à 0,12 s : un pas lent pousse deux pas dans l'image suivante.

**Cause.** Dans un contexte vm, chaque accès global (Math, Number, Infinity…) passe par l'intercepteur contextify, alors que le jeu s'exécute en navigateur dans un realm normal.

**Proposition.** - Pour toute mesure de performance, charger les sources dans le realm principal : `globalThis.window={}; (0,eval)(src+'\n//# sourceURL='+name+'.js')`, comme dans $B/loadmain.mjs, ou utiliser Chrome headless en file://. Garder vm pour isoler les tests fonctionnels.
- Publier des compteurs déterministes par pas (appels ground, blocked et segmentFree, nœuds explorés) en plus des millisecondes : ils résistent à la charge machine.
- Rapporter les pointes en ms du realm principal. 10 à 30 ms reste 1 à 2 images perdues à 60 Hz (16,7 ms), et davantage à 120 ou 144 Hz.

**Gain attendu.** Qualitatif : priorités correctes entre axes. La perception paraît chère sous vm (sight 28 fois plus lent) mais ne coûte en réalité que 0,1 à 0,4 ms/s. Les chiffres des agents deviennent comparables.

**Risques.** Aucun pour le jeu : c'est de l'outillage. L'eval indirect pollue globalThis, donc un processus par mesure. Ne pas modifier les checks fonctionnels.

**Vérifier par.** `node $B/prims2.mjs $R`, puis `node $B/realm.mjs $R vm 1800` et `node $B/realm.mjs $R main 1800` : mêmes pas de pointe, avec un rapport de 3 à 5 sur le max.

**Contre-vérification.** Outils relus : tools/campaign-profiles.mjs:2-9 utilise bien vm.createContext ; game.js:675-695 : dt borné à 0,12 et steps=ceil(dt*60).

Mesure indépendante appariée et alternée dans un même processus (V2/realm2.mjs, minimum de 9 passes, charge 47) : ground 266 ns contre 7 573 ns (28 fois), blocked 1,29 contre 12,9 µs (10 fois), arête de 0,8 m 8,8 contre 94 µs (10,7 fois). Les valeurs absolues sont gonflées par la charge, le rapport est du même ordre ou pire que celui annoncé.

Complément de méthode : sous charge, même le realm principal donne des durées fausses (mes pas « de plus de 8 ms » restent 212 à 417 par minute avec le prototype alors que route() ne pèse plus que 1 %). Les critères d'acceptation remis à Codex doivent donc être des compteurs déterministes par pas (nœuds explorés, tests d'arête, appels ground), exposés dans s.aiStats, avec un plafond vérifié par test. Générique : le chargeur de banc et la règle valent pour les trois jeux.

**Gain corrigé.** Rapport vm / realm principal mesuré de 10 à 28 fois sur les primitives de navigation.

### IA-07 — Déploiement des renforts : recomptages à chaque pas, rafales de rayons dans safeEntry, route() de 36 à 48 m sans cache
- sévérité moyenne · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:659-674; src/simulation.js:675-678; src/simulation.js:684; src/simulation.js:700; src/simulation.js:707-711; src/simulation.js:736; src/simulation.js:513; src/simulation.js:2218

**Preuve.** Code :
- src/simulation.js:675-678 : encounterCounts (appelé en 736) exécute pour chaque rencontre `q.waves.flatMap(...)` et deux filter, puis deux filter sur tous les ennemis (54 à 170) ; un autre filter par vague en 700, et un en 1805.
- 684 : `encounterWait=.2;let probes=8;` autorise jusqu'à 8 safeEntry par tick à 5 Hz.
- safeEntry (659-674) tire 3 hauteurs × 9 ou 10 échantillons, soit 27 à 30 rayons par candidat, d'où des rafales jusqu'à environ 250 rayons en un pas ; elle fait aussi `s.enemies.some(...)` (662).
- 711 : route() depuis l'entrée jusqu'au déclencheur (36 à 48 m), avec un objet `{...e,...}` alloué ; c'est un appelant majeur des pointes selon routeprof.

Mesures (percep.mjs) : updateEncounters 21–31,5 µs par pas (1,3–1,9 ms/s) ; safeEntry 183–273 µs par appel (0,45–1,4 ms/s) ; rayons de safeEntry 33–152/s sur 119–362/s au total.

**Cause.** Les comptages sont recalculés de zéro. Aucun cache entrée → déclencheur n'existe alors que les deux points sont statiques. Les sondes ne sont pas bornées en nombre de rayons.

**Proposition.** 1) Précalculer `q.ids` (Int32Array des enemyIds des vagues) dans create() et restore(), puis compter remaining et active en une seule passe ; le résultat est identique.
2) safeEntry : tester d'abord les échantillons les plus souvent visibles (h = 1,1 au centre, puis ±0,9). Le résultat ne change pas : la fonction est pure et sort au premier rayon visible. Ajouter un budget de 64 rayons par pas, avec un curseur de sonde reporté au tick suivant (comme probes).
3) Entrées naturelles : rejet en O(1) par composante (IA-01), puis cache `approach[q.id][entryIndex]={rev,path}` invalidé par refreshLocal quand la région touche le chemin. Variante : un champ de distance BFS par rencontre depuis le déclencheur, en réutilisant `dist` et `queue` (513 ; inutilisés en mode avancé, voir 2218 `dist.fill(-1)`). Calculé à l'activation de la rencontre (environ 44k cellules, ~1 ms estimé), il donne l'accessibilité de toutes les entrées et leur chemin, par descente de gradient puis string-pulling.

**Gain attendu.** Estimé :
- updateEncounters −50 %, soit 0,7 à 1 ms/s gagnées ;
- rayons de safeEntry divisés par 2 à 3 en moyenne, et au plus 64 par pas (environ 0,2 ms dans le realm principal) ;
- suppression des route() de 36 à 48 m vers les entrées, principal déclencheur de pointes au déploiement.

**Risques.** Le cache d'approche doit être invalidé exactement, sinon un chemin peut traverser un mur : clé = révision de navigation locale. Le budget de rayons change l'ordre de déploiement (hash différent) ; seul le réordonnancement des échantillons est neutre. Sauvegardes : caches dérivés, non sérialisés ; q.ids recalculé au restore. Tests à rejouer : checks/campaign-simulation.test.mjs (déploiement, pendingWave en 284) et checks/boss-progression.test.mjs.

**Vérifier par.** - `node $B/percep.mjs $R 3600 v2` : µs par pas d'updateEncounters, appels et rayons de safeEntry.
- `node $B/variant.mjs` : hash identique pour la variante neutre.
- `node $B/routeprof.mjs` : plus de pointe imputée à l'appelant 711.

**Contre-vérification.** Code relu (659-674, 675-678, 684, 700, 711, 736) : exact ; encounterCounts tourne bien à chaque pas avec flatMap et filter.

La partie la plus forte est en grande partie un artefact de pilote. La ligne 711 produit 62/68 et 51/67 des échecs du pilote tour, mais presque tous pour encounter-4 (joueur téléporté derrière door-1 fermée). Avec des portes en état légitime (toutes ouvertes, ou door-2 fermée), la ligne 711 ne produit aucun échec dans mes runs. Elle reste coûteuse dans le cas « joueur entré dans une salle par jump pad ou brèche, porte fermée » (173 ticks consécutifs, voir IA-V2), que le rejet O(1) d'IA-01 règle.

Le reste pèse peu : updateEncounters 1,3 à 1,9 ms par seconde, soit moins de 0,2 % du temps. Le réordonnancement des échantillons de safeEntry est bien neutre (fonction pure, sortie au premier rayon visible). Le budget de 64 rayons change l'ordre de déploiement : à ne faire que si une pointe de rayons est mesurée. Le cache d'approche devient inutile une fois le rejet O(1) en place. Sévérité à ramener à basse.

**Gain corrigé.** 0,7 à 1 ms par seconde au mieux sur les comptages (estimé). La « suppression du principal déclencheur de pointes au déploiement » est déjà obtenue par IA-01 et ne concerne en jeu légitime que l'entrée dans une salle par un chemin sans porte.

### IA-08 — Cible inaccessible : l'ennemi se fige faute de meilleur point atteignable
- sévérité haute · catégorie ia · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · jeu
- lieux : src/simulation.js:1559; src/simulation.js:1580; src/simulation.js:1601; src/simulation.js:1516; src/simulation.js:1609; src/simulation.js:740; src/simulation.js:1776

**Preuve.** variant.mjs, pilote circle :
- legacy-s2 et v2-w06 : 100 % d'attente et 0 % de mouvement, en base comme avec le prototype (le joueur est dans une autre composante) ;
- legacy-s0 : 60,4 % d'attente en base.

Code :
- plan avance vers lastSeen par nearestNode puis setGoal (1559) ;
- les flancs (1580, 1601) et neuralPlan (1516) visent des points à angle fixe autour de lastSeen (13 m en 1601) sans vérifier la composante ;
- si tout échoue, `e.tactic='hold'` (1609) ;
- en 740 et 1776, planWait=.4 puis la même tentative recommence : la même paire est recherchée jusqu'à 8 fois (failcause.mjs).

**Cause.** Les buts sont des points géométriques autour du joueur, pas des cellules de la composante de l'ennemi. Il n'existe aucune notion de « meilleur point atteignable ».

**Proposition.** Ajouter `proxyGoal(e,tx,tz)`, qui s'appuie sur les étiquettes d'IA-01. Si la cible n'est pas dans la composante de l'ennemi :
- parcourir en spirale les cellules autour de la cible, jusqu'à 14 cellules de rayon (841 cellules au plus) ;
- ne garder que celles de la composante de l'ennemi ;
- score = distance à la cible, + 4 si |Δy| > 1,5 m, − 3 si la cellule voit lastSeen ;
- ne tester sight que sur les 6 meilleures, puis appeler setGoal sur la meilleure.
À défaut, prendre une position de tir avec ligne de vue dans la composante, sinon cover(). Pour les types à distance (type 2, ordnance), viser une cellule avec ligne de vue entre 9 et 20 m. Ne pas recalculer de but proxy avant 1,5 s, en réutilisant planWait.

**Gain attendu.** Estimé : environ 25 µs par appel (841 lectures + 6 rayons à 3,4 µs). Attente sur les cartes figées : 100 % → 30 % au plus, d'après la baisse obtenue sur legacy-s0 (60 → 17–19 %) par le seul rejet. Qualitatif : les ennemis se placent au bord des plates-formes ou sous les passerelles au lieu d'attendre.

**Risques.** Déterminisme : spirale en ordre fixe, égalités départagées par l'indice. Pas de nouvel état persistant si le délai de 1,5 s réutilise planWait (au plus 2,6, déjà validé au restore). Comportement : hash différent ; vérifier que les sentinelles (type 2, retour au poste) ne quittent pas leur position. Taille +1 Ko.

**Vérifier par.** - `node $B/variant.mjs $R <flags>+proxy circle 1800 legacy-s2` et `... v2-w06` : holdPct et movePct.
- `node $B/aiq.mjs` : idleHoldPct et seenPct.

**Contre-vérification.** La preuve principale ne tient pas. V2/hold.mjs (pilote circle, 1800 pas) : sur legacy-s2 et v2-w06, les « 100 % d'attente » portent sur un seul ennemi (id 1), 10 échantillons, situé à 37-42 m derrière une porte fermée (0 porte ouverte sur 3), qui ne voit pas le joueur. Attendre derrière une porte verrouillée est le comportement prévu ; un but de repli le collerait seulement contre la porte.

Sur legacy-s0, les 60 % d'attente viennent d'ennemis de la même composante que le joueur et qui le voient (26 échantillons sur 40) : leurs buts de flanc tombent sur le substrat hors carte (IA-V1), échouent, épuisent le budget de 2 recherches, puis `e.tactic='hold'` (1609). C'est IA-01 et IA-V1 qui corrigent cela (d'où le 60 -> 17-19 % « par le seul rejet »), pas proxyGoal. L'extrapolation « 100 % -> 30 % » n'a aucun fondement.

Le mécanisme existe bien dans le code (1559, 1580, 1601, 1609) et proxyGoal reste utile pour un joueur perché sur une plate-forme sans accès à pied, cas non mesuré. À ne faire qu'après IA-01 et IA-V1, en excluant les cellules de substrat. Sévérité à ramener à moyenne ou basse.

**Preuve corrigée.** « 100 % d'attente sur 2 cartes » = 1 ennemi derrière une porte verrouillée pendant 5 s. Le vrai cas de gel mesuré est celui d'IA-V2 (ennemi piégé après un jump pad).

**Gain corrigé.** Non établi.

### IA-09 — Cadence de décision lente et purement temporisée : réaction p90 de 1,3 à 1,9 s
- sévérité moyenne · catégorie ia · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · jeu
- lieux : src/simulation.js:1791; src/simulation.js:1765; src/simulation.js:1316-1330; src/simulation.js:816; src/simulation.js:1297; src/simulation.js:15-16; src/simulation.js:1968; src/simulation.js:2120-2149

**Preuve.** Code :
- src/simulation.js:1791 `if(e.thinkWait<=0){e.thinkWait+=.65+(e.id%3)*.05;plan(e);}` : un nouveau plan toutes les 0,65 à 0,75 s.
- Les engagements setGoal(..., commit) durent de 1,1 à 2,6 s (1513, 1580, 1586, 1601) ; la perception tourne à 6,7 Hz (1765, senseWait = 0,15).
- Seuls trois événements forcent déjà un plan : les dégâts (816, thinkWait = 0), une nouvelle mémoire (1297) et la fin d'esquive (1787).

Mesures (aiq.mjs, pilote tour) :
- 0,45 à 0,80 plan par ennemi et par seconde ;
- joueur vu 12 à 25 % du temps engagé, ennemi en visée 3,5 à 7,3 % ;
- délai vu → visée au p90 de 1,33 à 1,92 s.

**Cause.** La replanification ne dépend que d'une minuterie. Aucune réaction au changement de visibilité, aux déplacements du joueur, ni à ses dashs et sauts.

**Proposition.** Replanifier sur événement (thinkWait = min(thinkWait, 0)), sans nouvel état persistant, quand :
- e.seen bascule (perceive, 1316-1330, connaît l'ancienne valeur) ;
- le joueur fait un dash, saute ou prend un jump pad (transition de p.airborne ou événement dash) à moins de 20 m ;
- un allié est tué à moins de 8 m.
Cadence en combat : 0,35 à 0,45 s, plus (id%3)*0,05. Anti-rafale : au plus 3 replans événementiels par pas, dans l'ordre des ids.
Option « joueur déplacé de plus de 4 m depuis le dernier plan » : nouveaux champs planRefX et planRefZ, donc aiVersion 4 (voir risques).

**Gain attendu.** Estimé :
- 0,45–0,8 → environ 1,5 à 2 plans par ennemi et par seconde ;
- coût : 10 à 22 plans/s × 50 à 150 µs, soit 0,5 à 3 ms/s avec IA-01 et IA-04 ;
- délai de réaction au p90 : 1,3–1,9 s → moins de 0,9 s.

**Risques.** Charge : à n'activer qu'avec IA-01, sinon les pointes se multiplient.
Sauvegardes : thinkWait reste dans [-0,05 ; 0,75]. L'option planRefX/planRefZ impose :
- aiVersion 4 ;
- un tableau AI4 sur le modèle d'AI2 et AI3 (lignes 15-16) ;
- les valeurs par défaut lastSeenX et lastSeenZ pour les sauvegardes v1 à v3 ;
- une validation atomique dans le bloc require (2120-2149), avec les bornes du monde ;
- l'acceptation de la version 4 en 1968.
Tests : checks/simulation.test.mjs:894/907/914/1095 (qui attendent aiVersion 3) à mettre à jour.
Ressenti : risque d'une IA trop nerveuse ; régler la cadence selon la difficulté.

**Vérifier par.** - `node $B/aiq.mjs $R <flags> 3600` : plansPerEnemyPerS, reactionP90S, seenPct.
- `node $B/percep.mjs` : ms/s consacrées à plan.
- `node $B/workcount.mjs` : le maximum par pas ne doit pas augmenter.

**Contre-vérification.** Code relu (1791, 1765, 816, 1297, 1787) : exact. Mais le lien de cause annoncé est faux : la décision de tir (1794) est évaluée à chaque pas, hors de thinkWait. Le délai « vu -> visée » dépend de senseWait (0,15 s), de e.cooldown (porté à 1,35 s au déploiement, ligne 718), de `tactic!=='cover'` et de canShoot, pas de la cadence de plan(). Accélérer plan() ne ramènera donc pas le p90 de 1,3-1,9 s sous 0,9 s ; le cooldown de déploiement est en plus une marge d'équité voulue.

Ce qui reste vrai : le repositionnement (flanc, couverture) ne réagit que toutes les 0,65 à 0,75 s et ignore dash et sauts. Les replans sur événement sont faisables sans nouvel état. Écarter l'option planRefX/planRefZ : elle impose aiVersion 4 pour un bénéfice non démontré. Mesures aiq.mjs non rejouées. Rend le jeu plus dur : à régler par difficulté et à valider avec tools/campaign-balance.mjs.

**Gain corrigé.** Repositionnement plus réactif (qualitatif). Le gain annoncé sur le délai de réaction au tir n'est pas fondé.

### IA-10 — Coordination d'escouade : jetons d'attaque, suppression, grenades de débusquage, flanc vers l'angle mort, déplacement latéral pendant la visée
- sévérité moyenne · catégorie ia · effort L · gain qualitatif
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:1515; src/simulation.js:1572; src/simulation.js:1589; src/simulation.js:1598; src/simulation.js:1790; src/simulation.js:1794-1796; src/simulation.js:1204-1225; src/simulation.js:1227-1233; src/simulation.js:1296

**Preuve.** Code :
- Flanc : le côté est fixé par la parité d'escouade, `side=e.squad%2?-1:1` (1515, 1572, 1589, 1598). Toute l'escouade part du même côté, quelle que soit l'orientation du joueur.
- Tir : la condition de 1794 exige e.seen, donc le feu cesse dès que le joueur se cache ; pas de tir de suppression. Les grenadiers, qui disposent pourtant d'un arc balistique vérifié en 12 segments (ordnanceSolution, 1204-1225), ne tirent eux aussi que s'ils voient le joueur.
- Visée : 1790 `if(e.windup>0){...;continue;}` laisse l'ennemi immobile pendant toute la préparation du tir.

Mesures (aiq.mjs) : tireurs simultanés jusqu'à 2 à 5 (moyenne 1,3 à 1,55) ; tirs ennemis 0,28 à 0,97/s ; dégâts au joueur 0 à 0,88 hp/s ; ennemis en mouvement 81 à 95 % du temps.

**Cause.** Les décisions sont individuelles : aucune ressource partagée, aucun rôle défini par rapport au joueur.

**Proposition.** Six comportements, tous sans nouvel état persistant :
1) Jetons d'attaque : N = 2 + difficulté, recalculés à chaque pas et attribués dans l'ordre (distance, id) aux ennemis qui voient le joueur. Sans jeton, l'ennemi se déplace latéralement ou se met à couvert.
2) Suppression : si e.seen est faux et que `s.time-e.observedAt<1.2`, un détenteur de jeton tire sur lastSeen avec une dispersion ×1,6 et une cadence ×0,6. observedAt existe déjà et est validé au restore.
3) Débusquage : un grenadier dont le joueur est caché depuis 1,5 à 4 s, avec lastSeen entre 6 et 24 m, appelle `ordnanceSolution(e,e.lastSeenX,e.lastSeenY,e.lastSeenZ)` (arc déjà vérifié). Au plus un grenadier par escouade, en réutilisant e.cooldown (4,8 × cadence).
4) Flanc : côté = signe de cross(avant du joueur, vecteur joueur → ennemi), pour gagner l'angle mort ; pince par parité du rang dans l'escouade.
5) Type 0 en préparation de tir : déplacement latéral à 35–40 % de la vitesse, via move() avec collision ; direction tirée de la parité de l'id et du temps.
6) Retraite : hp < 35 % et aucun allié à moins de 8 m → cover().

**Gain attendu.** Qualitatif : combats plus lisibles (2 à 4 tireurs au lieu de pics à 5), pression quand le joueur se cache, flancs crédibles. Coût estimé sous 0,2 ms/s (tri de 12 ennemis au plus, quelques rayons).

**Risques.** Équilibrage (dégâts reçus, temps pour tuer) à revalider avec tools/campaign-balance.mjs. Sauvegardes : sans nouveau champ, aiVersion 3 inchangé. Un minuteur d'escouade dédié imposerait aiVersion 4, avec les défauts v3 et une validation atomique. Déterminisme : tout dérive de s.time et des ids, jamais de Math.random. remember() remet observedAt à -1 hors engagement (1296) : il faut le prendre en compte pour la suppression. Tests : rejouer tous les checks de combat et d'IA ; AGENTS.md impose des tests de simulation pour le combat.

**Vérifier par.** - `node $B/aiq.mjs $R <flags> 3600` : maxSimultaneousAimers, enemyShotsPerS, playerDamagePerS.
- Nouveaux compteurs : tirs de suppression et grenades de débusquage.
- Test : snapshot, restore, puis même hash au pas N.

**Contre-vérification.** Code relu : côté de flanc par parité d'escouade (1515, 1572, 1589, 1598), tir conditionné à e.seen (1794), immobilité pendant la préparation (1790), remise à -1 d'observedAt hors engagement (1296) : exact. Les six comportements sont réalisables sans nouvel état sauvegardé. Mesures aiq.mjs non rejouées ; gain purement qualitatif.

Points d'attention :
- les jetons d'attaque plafonnent les tireurs simultanés, ce qui va dans le sens de « bouclier protège pas bien » ; la suppression et les grenades de débusquage augmentent au contraire la pression. À livrer séparément, chacun derrière un réglage de difficulté, avec une passe d'équilibrage ;
- dépend d'IA-01 : plus de déplacements signifie plus de route() ;
- AGENTS.md impose un test de simulation par comportement de combat ajouté.
À découper en lots : jetons et flanc vers l'angle mort d'abord (effort S à M), le reste ensuite.

### IA-11 — Visée inadaptée à un mouvement « Quake » : vitesse plafonnée sous le sprint, saut extrapolé sans gravité ni sol
- sévérité moyenne · catégorie ia · effort S · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · jeu
- lieux : src/simulation.js:95; src/simulation.js:1322; src/simulation.js:1795-1796; src/simulation.js:8; src/simulation.js:2139

**Preuve.** Code :
- src/simulation.js:1322 : observedVX et observedVZ sont plafonnés à ±6 m/s, alors que le sprint atteint 7,6 m/s et le dash 15,2 m/s (ligne 95) ; observedVY est plafonné à ±18.
- 1795-1796 : `lead=Math.min(.65,d/14)` et `aimY=lastSeenY+observedVY*lead*.45`. C'est une extrapolation linéaire, sans gravité (GRAVITY=12, ligne 8) et sans borne au sol.
- restore valide observedVX dans ±6 (2139).

Conséquences : un joueur qui retombe à −10 m/s fait viser 2,9 m sous son œil, donc sous le sol ; au sommet du saut (vy ≈ 0), aucune chute n'est prédite.

**Cause.** Le modèle de visée est calibré pour un déplacement au sol lent.

**Proposition.** 1) Filtrer la vitesse dans observedVX/VZ eux-mêmes (α = 0,5) et la borner à ±9 m/s (sprint + gain de strafe), sans prédire le dash, qui reste une vraie esquive.
2) Hauteur balistique : si le joueur est en l'air, y(t) = y0 + vy·t − 6·t², bornée à ground(aimX,aimZ) + 1,45 ; au sol, aimY = lastSeenY.
3) Multiplier lead par 0,6 / 0,8 / 1,0 selon la difficulté (enemyCadence et enemySpeed existent déjà). En difficulté maximale, réajuster la visée à mi-préparation.
Partager les constantes de vitesse avec l'axe mouvement.

**Gain attendu.** Qualitatif : fini les tirs dans le sol à la réception d'un saut ; prédiction juste au sprint ; le dash reste un outil d'esquive.

**Risques.** Sauvegardes : la borne ±9 change la validation de 2139. Passer à aiVersion 4 (borne ±9) ; les sauvegardes v1 à v3 restent validées à ±6 ; la validation reste atomique ; les anciens builds rejettent proprement la version 4. Déterminisme : calcul pur. Tests : esquive et visée dans checks/simulation.test.mjs, et assertions sur aiVersion (1095). À coordonner avec l'axe mouvement si la vitesse maximale change.

**Vérifier par.** - Nouveau test déterministe : joueur scripté en saut parabolique ; mesurer l'erreur verticale du point visé au moment du tir, base contre nouvelle version.
- `node $B/aiq.mjs` : playerDamagePerS par difficulté.

**Contre-vérification.** Faits de code confirmés : borne ±6 m/s (1322) contre un sprint à 7,6 et un dash à 15,2 (95) ; aimY linéaire sans gravité ni sol (1796) ; validation ±6 au restore (2139). Le calcul est juste : -10 m/s x 0,65 x 0,45 = -2,9 m, dès 9,1 m de distance.

Mais ce n'est pas un défaut de fluidité, c'est un réglage de difficulté. Une prédiction sous-estimée au sprint est ce qui permet d'esquiver en se déplaçant, donc le ressenti « Quake » que David demande ; la porter à ±9 augmente les dégâts reçus alors qu'il trouve déjà que le bouclier protège mal. Elle impose aussi aiVersion 4 et la mise à jour des tests 894, 907, 914 et 1095.

À retenir seulement : la borne au sol de la hauteur visée (aimY >= ground(aimX,aimZ)+0,3) et le terme de gravité en vol. Cela ne touche ni la borne ±6 ni le format de sauvegarde et supprime les tirs dans le sol visuellement absurdes. Le reste est à décider avec l'axe mouvement, par difficulté.

**Gain corrigé.** Partie verticale seule : plus de tirs sous le sol à la réception d'un saut, sans changement de sauvegarde. La partie horizontale est un durcissement du jeu, pas un gain.

### IA-12 — Réseau tactique : coût CPU négligeable, mais avec WebNN le pas d'application des conseils dépend du GPU
- sévérité basse · catégorie ia · effort S · gain mesuré
- contre-vérification : **plausible**, priorité P2 · qualité identique · jeu
- lieux : src/brain.js:7; src/brain.js:52; src/brain.js:87; src/brain.js:93-101; src/simulation.js:1489-1506; src/simulation.js:1472

**Preuve.** Coût :
- src/brain.js:7 : réseau 16-20-8, lots de 16 (BATCH).
- Sur CPU : 13,4 µs par lot de 16, soit 0,86 µs par acteur (node, realm principal).
- percep.mjs : updateBrain 4 à 7,7 µs par pas, 220 lots par minute, 0 accéléré, soit environ 3 ms par minute.
- La construction des lignes (simulation.js:1494-1496) tire 4 à 32 rayons sight par seconde pour le calcul de foule.

Chemin WebNN :
- création limitée à 2,5 s (brain.js:87) ; `deadline(run(q,input),120)` (99) ;
- simulation.js:1500-1505 : le résultat asynchrone est appliqué au premier consumeBrain() qui suit la résolution de la promesse. Le pas d'application dépend donc de la latence du GPU ou du NPU, et l'IA se comporte différemment selon la machine.
- invalidateBrain() (1472), appelé au snapshot, protège seulement les sauvegardes.

**Cause.** Accélération matérielle appliquée à un réseau minuscule, pour lequel le transfert et la synchronisation coûtent plus que le calcul.

**Proposition.** Mode 'cpu' par défaut (synchrone, déterministe) ; WebNN en option expérimentale. Si WebNN est conservé, appliquer les conseils à un délai fixe en temps de simulation (request.time + 0,25 s, soit brainWait) et les rejeter s'ils ne sont pas prêts. CPU et WebNN donnent alors le même comportement tant que le résultat arrive à temps.

**Gain attendu.** Mesuré : le CPU coûte environ 0,05 ms/s, donc rien à gagner à accélérer. Qualitatif : comportement de l'IA reproductible d'une machine à l'autre.

**Risques.** checks/brain.test.mjs (modes, invalidation) à adapter, ainsi que l'étiquette « WebNN accéléré » de l'interface (brain.js:48). Aucun effet sur les sauvegardes.

**Vérifier par.** - Micro-banc de FBrain.cpu (commande donnée dans les mesures) et checks/brain.test.mjs.
- Nouveau test : même graine, mode cpu contre un WebNN simulé dont la promesse se résout à des pas différents ; avec l'application à délai fixe, le hash doit être le même.

**Contre-vérification.** Code relu : brain.js:7 (16-20-8, lots de 16), brain.js:87 et 99 (délais de 2500 et 120 ms), simulation.js:1500-1505 (résultat asynchrone appliqué au premier consumeBrain après résolution) : exact. Le réglage par défaut est bien 'auto' (options.js:6 aiAcceleration:'auto') : la proposition n'est pas déjà en place. Le coût CPU de 13,4 µs par lot n'a pas été re-mesuré.

Conséquence à souligner : la « simulation 100 % déterministe » des leçons du premier tour n'est vraie qu'en mode cpu. Avec WebNN, le pas d'application des conseils dépend de la machine. Tous les bancs utilisent mode:'cpu' ; un mode démo rejoué (demande 6 de David) ou une comparaison par rejeu divergerait donc sur un PC où WebNN est actif. Si le mode démo repose sur un rejeu déterministe, cette correction devient P1.

L'application à échéance fixe en temps de simulation (request.time + 0,25 s, rejet si le résultat n'est pas prêt) est faisable et garde WebNN utilisable.

**Gain corrigé.** Aucun gain de performance (CPU déjà négligeable) ; gain de reproductibilité entre machines.

### IA-13 — cover() et peek() testent la ligne de vue de tous les candidats avant d'en retenir un
- sévérité basse · catégorie perf-cpu · effort S · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · jeu
- lieux : src/simulation.js:1445-1461; src/simulation.js:1462-1471

**Preuve.** Code :
- src/simulation.js:1445-1460 : cover() parcourt tous les solids (1447 ; 421 à 504) et, pour chaque candidat, appelle blocked, sight et protects avant le tri (1458). Seuls les 7 premiers sont ensuite essayés.
- peek() (1462-1471) : 36 candidats, tous testés en sight avant le premier setGoal.

Mesures (coverbench.mjs, 120 appels, realm principal) :
- cover : p50 0,275 ms, moyenne 1,01 ms, max 19,4 ms (setGoal suivi d'un A* échoué), 23 rayons en moyenne (max 44), 107 réussites sur 120 ;
- peek : p50 0,39 ms, moyenne 0,83 ms, max 9,8 ms, 33 à 36 rayons, 64 réussites sur 120 ;
- sous vm : p50 de 3,66 et 4,68 ms.

**Cause.** Le filtre coûteux est évalué pour tous les candidats alors qu'un seul est retenu.

**Proposition.** cover() :
- construire les candidats avec les filtres bon marché (distance, plus de 3 m de lastSeen, blocked) ;
- calculer le score (d + 8 si la place est occupée) et trier, de façon stable ;
- tester sight et protects dans cet ordre, et essayer setGoal sur les 7 premiers qui passent ;
- présélectionner les solids par les seaux de collision dans un rayon de 10 m autour de l'ennemi.

peek() : tester sight dans l'ordre de génération et appeler setGoal dès le premier candidat qui passe.

Le résultat est identique si sight, protects et blocked sont purs (à vérifier pour protects) et si le tri reste stable.

**Gain attendu.** Estimé : rayons divisés par 3 à 5 (cover 23 → 5 à 8, peek 36 → 7 à 12) ; coût moyen environ 1 → 0,3 ms par appel. Avec IA-01, le max dû à l'A* échoué disparaît.

**Risques.** Neutre seulement si protects() n'a pas d'effet de bord et si l'ordre des égalités est conservé (le tri de V8 est stable) : test de hash obligatoire. Aucun effet sur les sauvegardes.

**Vérifier par.** - `node $B/coverbench.mjs $R main` : rayons et ms.
- `node $B/variant.mjs` : hash identique à la base.

**Contre-vérification.** Code relu (1445-1471) : exact. L'équivalence tient : sight, protects (1441-1443 : ray et groundAt seulement) et blocked sont purs ; trier le sur-ensemble des candidats bon marché avec un tri stable puis filtrer paresseusement donne les mêmes 7 premiers dans le même ordre ; les effets de bord de setGoal (budget, cache d'arêtes) n'influencent pas les rayons. Pour peek, tester dans l'ordre de génération et sortir au premier setGoal réussi est strictement identique.

Enjeu faible : plan() tourne 2 à 5 fois par seconde au total et cover()/peek() n'en sont qu'une fraction ; le maximum de 19,4 ms vient de l'A* échoué, réglé par IA-01. Non re-mesuré ; test de hash obligatoire.

**Gain corrigé.** Quelques dixièmes de ms par seconde au plus (estimé).

### IA-14 — rebuildNeighbors et nearby() fabriquent des clés chaînes et des tableaux à chaque appel
- sévérité basse · catégorie perf-cpu · effort S · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · jeu
- lieux : src/simulation.js:1279-1290; src/simulation.js:1742

**Preuve.** Code :
- src/simulation.js:1279-1290 : rebuildNeighbors construit la clé `Math.floor(e.x/8)+','+Math.floor(e.z/8)` pour chaque ennemi vivant. Elle est appelée en 1742 et une seconde fois dans le pas (2 appels par pas mesurés).
- nearby() construit une chaîne par seau visité et alloue un tableau résultat.
- nearby() est appelé par cover (1454, pour chaque candidat), updateBrain (1495), perceive (1331) et ordnanceSolution (1211).

Mesures (percep.mjs) : rebuildNeighbors 3,3 à 4,8 µs, 2 fois par pas ; separate 3,4 à 10,8 µs par pas.

**Cause.** Concaténation de chaînes et hachage dans une boucle chaude.

**Proposition.** - Remplacer la clé par l'entier `(ix+32768)*65536+(iz+32768)` dans la même Map : l'ordre d'insertion, donc le résultat, est conservé.
- Variante : grille plate sur les bornes du monde (cellules de 8 m), avec des listes chaînées tête/queue dans des Int32Array qui préservent l'ordre d'insertion.
- nearby() : réutiliser un tableau résultat, avec une pile de tampons pour les appels imbriqués.

**Gain attendu.** Estimé : −50 à −70 % sur rebuildNeighbors et nearby, soit 0,3 à 0,6 ms/s, et moins d'allocations (pression du ramasse-miettes réduite).

**Risques.** Neutre si l'ordre d'itération par seau est préservé. Un tampon partagé pour nearby() est dangereux si un appelant garde le tableau : vérifier chaque appelant (le `.some` immédiat de cover en 1454 ne pose pas de problème). Test de hash obligatoire.

**Vérifier par.** - `node $B/percep.mjs` : µs de rebuildNeighbors et de separate.
- `node $B/variant.mjs` : hash identique à la base.

**Contre-vérification.** Code relu (1279-1290, 1742) : clés chaînes et tableau alloué par appel, exact. Gain légèrement surestimé : rebuildNeighbors coûte 3,3 à 4,8 µs deux fois par pas, soit 0,4 à 0,58 ms par seconde au total ; -50 à -70 % donne 0,2 à 0,4 ms par seconde, moins de 0,05 % du temps. L'intérêt est surtout de réduire les allocations (534 à 864 Ko par pas selon l'axe SIM), à traiter avec ce chantier. La clé entière dans la même Map préserve l'ordre d'insertion, donc le résultat. Le tampon partagé pour nearby() est risqué (appels imbriqués cover -> nearby) : à ne faire qu'avec le test de hash.

**Gain corrigé.** 0,2 à 0,4 ms par seconde (estimé), plus une baisse d'allocations non chiffrée.

## Constats ajoutés par le contre-vérificateur

### IA-V1 — Deux tiers de la grille de navigation sont du substrat hors carte, et 100 % des A* échoués en jeu légitime le visent
- sévérité haute · catégorie ia · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/world.js:1280; src/simulation.js:128-134; src/simulation.js:151; src/simulation.js:516; src/simulation.js:1380; src/simulation.js:1404; src/simulation.js:1516; src/simulation.js:1580; src/simulation.js:1591; src/simulation.js:1601

**Preuve.** Mesures :
- V2/labels.mjs (composantes à t=0, classées par sol porteur) : cellules marchables portées uniquement par le substrat = 21 750 / 32 660 (67 %) sur legacy-s0, 25 901 / 38 661 (67 %) sur legacy-s2, 21 750 / 32 744 (66 %) sur v2-w01, 25 864 / 38 714 (67 %) sur v2-w06, 21 606 / 32 542 (66 %) sur v2-w10. Elles forment 3 à 6 composantes de substrat pur (jusqu'à 17 710 cellules), sans aucun ennemi et sans aucune composante mixte.
- V2/spikes.mjs avec check, états de portes légitimes : toutes portes ouvertes, 9/9 (v2-w01) et 34/34 (v2-w10) des A* échoués ont leur cellule d'arrivée sur le substrat ; door-2 fermée, 12/15 et 17/17 ; legacy-s0 en pilote tour, 11/11. Tous atteignent le plafond de 2400 nœuds. Appelants : plan:1580 (flanc du type 0), neuralPlan:1513/1516, cover:1459, plan:1594/1601.
- V2/comps.mjs : pour ces échecs, aucun relâchement (rayon 0,3, sans portes, marche de 1 m, sans pièges, liens pad et ascenseur) ne relie départ et arrivée ; l'ennemi est à y=3,2 ou 0, le but à y=-0,25.
- V2/hold.mjs, legacy-s0 : 26 échantillons sur 40 sont des ennemis de la composante du joueur, qui le voient, et restent en 'hold'.

Code :
- world.js:1280 pose un sol substrate:true, fallback:true à y=-0,25 sur toute l'emprise du monde.
- simulation.js:516 et 1380 marquent nav[i]=1 dès que ground() est fini et la cellule non bloquée, substrat compris.
- Les buts de flanc sont des points géométriques autour de lastSeen (1516, 1580, 1586, 1591, 1601), sans contrôle du sol.
- route() ne rejette en 1404 que les points bloqués.

**Cause.** Le sol de secours qui rattrape les sorties par brèche est indexé comme terrain marchable ordinaire. Un but de flanc qui sort de la salle tombe dessus, passe le test blocked(), puis coûte une recherche A* plafonnée (2401 nœuds) pour découvrir qu'il est inaccessible. Deux échecs épuisent le budget du pas et l'ennemi passe en 'hold' alors qu'il voit le joueur.

**Proposition.** 1) Masque statique `navSub=new Uint8Array(nav.length)`, calculé une fois à la création : 1 si aucun sol non substrate et non fallback ne couvre le centre de la cellule (même test que simulation.js:151). Les sols ne changent jamais (commentaire en 121-122), donc aucune invalidation.
2) Dans setGoal, avant route() : si `navSub[idx(x,z)]` et `!navSub[idx(e.x,e.z)]`, ramener le but vers lastSeen par pas de 0,8 m (16 pas au plus) jusqu'à une cellule hors substrat et non bloquée ; sinon renvoyer false sans consommer routeBudget. L'offset suivant est alors essayé avec un vrai budget.
3) Dans la cuisson des arêtes et l'étiquetage d'IA-01, et dans la file de refreshNav : ignorer les cellules de substrat à plus de 2 cellules d'une cellule intérieure (frange précalculée). La file passe d'environ 37-44k à 11-13k cellules, soit un rafraîchissement amorti sur environ 17 pas au lieu de 49 à 57, et la cuisson d'environ 63-76k arêtes à un tiers.
4) Critères : sur V2/spikes.mjs avec OPEN=0,1,2 ENC=0..7 en pilote tourx, 0 échec dont l'arrivée est sur le substrat ; part des ennemis qui voient le joueur et restent en 'hold' en baisse sur legacy-s0 (V2/hold.mjs).

**Gain attendu.** Supprime 100 % des A* plafonnés mesurés en jeu portes ouvertes (9 à 34 par minute, 2401 nœuds chacun, 8 à 11 ms pour ceux qui suivent un refresh), même sans les étiquettes d'IA-01. Les flancs retombent dans la salle au lieu d'être abandonnés. Environ deux tiers du travail de pumpNav et de cuisson évités (estimé à partir des 66-67 % mesurés).

**Risques.** Comportement modifié (hash différent, voulu). Après une brèche dans un mur extérieur, le substrat devient accessible (marche de 0,25 m) : aujourd'hui un ennemi peut sortir de la carte, il ne le fera plus ; si un ennemi se retrouve quand même sur le substrat, la frange de 2 cellules doit lui permettre de revenir, sinon garder nav[] complet et n'appliquer que les points 1 et 2. Sauvegardes : donnée dérivée, rien à sérialiser. Mémoire : 37 à 44 Ko. Tests de simulation à ajouter (AGENTS.md) : but de flanc hors salle ramené dans la salle ; ennemi posé sur le substrat qui retrouve un chemin.

**Vérifier par.** `node V2/labels.mjs R legacy-s0,v2-w01,v2-w10` (part de substrat) ; `OPEN=0,1,2 ENC=0,1,2,3,4,5,6,7 node V2/spikes.mjs R tourx 3600 v2-w01,v2-w10 check` (lignes fails et endOnSubstrate, avant et après) ; `node V2/hold.mjs R legacy-s0 1800 circle`.

### IA-V2 — Jump pads à sens unique ignorés par la navigation : ennemi piégé qui relance un A* perdu toutes les 0,47 s, et vague qui ne se déploie jamais
- sévérité haute · catégorie bug · effort M · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/simulation.js:1523-1527; src/simulation.js:363; src/simulation.js:371; src/simulation.js:738-741; src/simulation.js:727; src/simulation.js:709-714; src/simulation.js:1776

**Preuve.** Mesures :
- V2/e1.mjs (v2-w01, portes fermées, joueur dans la composante de départ) : l'ennemi 1 (poste en (-4,8 ; 0 ; 41,6), encounter-1) est en vol au pas 540 (y=5,0 en (-0,1 ; 12,8)) et atterrit dans le hub en (0 ; 3,2 ; 5,4), composante de 389 cellules fermée par door-1. Au pas 560 il passe en returning=true.
- V2/retpost.mjs : il échoue ensuite setGoal(poste) 127 fois en 60 s sur v2-w01 et 128 fois sur v2-w10, chaque fois par une inondation complète de sa composante (49 784 et 48 128 nœuds par minute), sans fin. C'est l'appelant returnToPost:740 de V2/spikes.mjs (maxRepeat 127 et 128 ; 162 et 221 échecs par minute dans ce scénario).
- V2/topo.mjs : encounter-4 a son déclencheur dans le hub et ses 8 entrées dans la composante voisine, derrière door-1.
- V2/streak.mjs, joueur posé sur ce déclencheur porte fermée : 1384 sondes d'entrée, toutes nulles ; 173 ticks consécutifs (toutes les 0,2 s) avec 2 A* plafonnés (4802 nœuds) ; vague jamais déployée (0/3 après 39 s). Le joueur y a été téléporté ; le pad qu'a pris l'ennemi 1 mène au même endroit, mais l'accès par un joueur réel n'a pas été rejoué.

Code :
- simulation.js:1525 choisit un pad sur la seule distance euclidienne de sa cible à lastSeen.
- 740 : en cas d'échec, planWait=.4 puis la même recherche, sans mémoire de l'échec.
- 727 : un ennemi en retour est exclu du combat sauf si le joueur passe à moins de 12 m avec ligne de vue.
- 711 : une entrée sans chemin est sautée ; si toutes le sont, la vague reste en 'waiting'.

**Cause.** Les jump pads sont des liens à sens unique absents du graphe de navigation. plan() y envoie un ennemi sans vérifier que la zone d'arrivée communique avec sa cible ni qu'il pourra en revenir. Les boucles de retour au poste et de renfort (740, 1776) rejouent la même recherche perdue toutes les 0,4 s. Le déploiement par entrées naturelles n'a pas de repli quand le déclencheur est isolé des entrées.

**Proposition.** S'appuie sur les étiquettes d'IA-01.
1) Ligne 1525 : n'emprunter un pad que si la composante de la cellule de pad.target est celle de la cible (nearestNode de lastSeen), ou si un pad de retour existe dans cette composante.
2) returnToPost (740) : si la composante du poste diffère de celle de l'ennemi, chercher un pad de la composante de l'ennemi dont la cible est dans celle du poste ; à défaut, `e.returning=false;clearEvidence(e);` et garder la position courante comme poste provisoire, sans relancer de recherche. Sans étiquettes, solution minimale : planWait=2,4 au lieu de 0,4 (borne déjà validée au restore, 2,6 au plus).
3) Ligne 1776 : même garde.
4) Ligne 711 : classer les entrées par composante avant safeEntry. Si aucune n'est dans la composante du déclencheur, ne lancer aucune recherche ni aucun rayon pour cette rencontre tant que la révision de navigation n'a pas changé, et accepter les entrées de la composante d'un pad dont la cible est dans celle du déclencheur.
5) Critères : retpost.mjs donne 0 recherche échouée ; e1.mjs : l'ennemi 1 ne prend plus le pad ; streak.mjs : 0 A* plafonné par tick.

**Gain attendu.** Supprime 127 à 128 inondations A* par minute et par ennemi piégé (environ 49 000 nœuds par minute, sans fin) et, dans le cas du déclencheur isolé, 2 A* plafonnés toutes les 0,2 s (1,4 à 1,9 ms à chaud, 16 à 22 ms après chaque refreshNav, minimum observé sous charge). Un ennemi ne sort plus définitivement du combat et la vague n'est plus bloquée.

**Risques.** Comportement modifié (hash différent, voulu). Le point 2 ne crée pas d'état sauvegardé si le poste provisoire est simplement la position courante avec returning=false ; vérifier que quietTime et combatEnabled ne le renvoient pas aussitôt en retour. Le point 4 change l'ordre de déploiement : rejouer checks/campaign-simulation.test.mjs et checks/boss-progression.test.mjs. Ajouter un test de simulation : pad vers une salle fermée, l'ennemi ne le prend pas. L'accès du joueur au hub par ce pad, porte fermée, reste à confirmer par un parcours réel.

**Vérifier par.** `ENC=2,5 node V2/retpost.mjs R v2-w01,v2-w10 3600` ; `ENC=2,5 node V2/e1.mjs R` ; `node V2/streak.mjs R v2-w01 3 2400` (base, puis avec les flags du prototype en 5e argument).

### IA-V3 — Le pilote « tour » des bancs téléporte le joueur derrière des portes fermées : critères d'acceptation à refaire sur des états de portes légitimes
- sévérité moyenne · catégorie outillage · effort S · gain qualitatif
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · jeu
- lieux : bench/ia/load.mjs; bench/ia/abrun.sh; bench/ia-verif2/lib.mjs; src/simulation.js:649; src/simulation.js:298-300

**Preuve.** Mesures :
- V2/topo.mjs (v2-w01 et v2-w10) : 3 portes, chacune liée à un mécanisme, séparent l'intérieur en 4 composantes (2319, 7092, 389 et 1171 cellules sur v2-w01). Le pilote tour (bench/ia/load.mjs, repris dans V2/lib.mjs) pose le joueur sur chaque déclencheur toutes les 420 pas sans ouvrir aucune porte.
- V2/spikes.mjs avec check, v2-w01 : pilote tour, 68 échecs dont 62 par la ligne 711 ; mêmes rencontres avec toutes les portes ouvertes, 9 échecs, aucun par 711 ; door-2 seule fermée, 15 échecs, aucun par 711 ; portes fermées et rencontres de la composante de départ seulement, 162 échecs dont 127 par returnToPost.
- v2-w10 : 67, puis 34, 17 et 221.
- V2/defer.mjs : 170 des 173 reports de budget du pilote tour sont des sondes de la ligne 711.

Les chiffres « 5 à 7 pas de plus de 8 ms par minute », « 48 à 201 reports par minute » et « la ligne 711, appelant majeur » dépendent donc du pilote. Les commandes verifyBy d'IA-01, IA-02, IA-03 et IA-07 utilisent toutes `tour`.

**Cause.** Le pilote de banc saute la progression (mécanismes puis portes) et crée un état que le jeu n'atteint à pied qu'exceptionnellement. Le poids relatif des causes de pointes en est déformé, et le gain mesuré du prototype dépend surtout d'un cas artificiel.

**Proposition.** Ajouter au banc trois scénarios à états de portes légitimes (pilote `tourx` de V2/lib.mjs, variables ENC et OPEN) et en faire les critères d'acceptation de Codex :
- A : portes fermées, rencontres de la composante de départ (ENC=2,5) ;
- B : toutes portes ouvertes, tour complet (OPEN=0,1,2 ENC=0..7) ;
- C : door-0 et door-1 ouvertes, door-2 fermée (OPEN=0,1 ENC=0,1,3,4).
Critères déterministes par scénario : 0 A* échoué par épuisement ou plafond, nœuds explorés par minute inférieurs ou égaux à ceux du prototype (3 699 à 12 332), 0 report, 0 refresh global sans changement de collider.
Garder `tour` comme test de robustesse (joueur entré par pad ou brèche). À terme, un pilote qui marche, actionne les mécanismes et franchit les portes ; il servirait aussi de base au mode démo demandé par David.

**Gain attendu.** Qualitatif : des priorités et des critères d'acceptation fondés sur des situations que le joueur rencontre, et des compteurs insensibles à la charge machine.

**Risques.** Aucun pour le jeu (outillage hors dépôt ou dans tools/). Forcer d.progress=1 court-circuite les mécanismes : à réserver aux bancs, jamais aux tests fonctionnels.

**Vérifier par.** `ENC=2,5 node V2/spikes.mjs R tourx 3600 v2-w01,v2-w10 check` ; `OPEN=0,1,2 ENC=0,1,2,3,4,5,6,7 node V2/spikes.mjs R tourx 3600 v2-w01,v2-w10 check` ; `OPEN=0,1 ENC=0,1,3,4 node V2/spikes.mjs R tourx 3600 v2-w01,v2-w10 check` ; mêmes commandes préfixées de `PROTO=heap,nearest,long,labels,static,local,free,defer`.

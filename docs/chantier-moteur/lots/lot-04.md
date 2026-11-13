# Lot 04 — Navigation et IA des ennemis
## But
Supprimer les pointes de 23 à 67 ms causées par les A* voués à l'échec vers le substrat et les composantes inaccessibles. Rendre la navigation locale, déterministe et indépendante de la pose des pièges. Poser les fondations (arêtes statiques, étiquettes de composantes, cache préchauffé) sur lesquelles les tâches P2–P3 s'appuient.

## Tâches, dans l'ordre

### T1 — Prédicat d'arête statique avec navY et bits symétriques [IA-05]
- Où : src/simulation.js:1349-1375 ; src/simulation.js:1420 ; src/simulation.js:242 ; src/simulation.js:126 ; src/simulation.js:516 ; src/simulation.js:1840
- Quoi : créer `navY=new Float64Array(nav.length)` rempli par `ground(x,z,[])` à l'init et au recalcul. Écrire `edgeTest(i,j)` : balayage seau milieu + doorBoxes, échantillons à k/3 avec `ground(...,[])`, marche ≤ 0,42 m, `blocked()` uniquement si y sort de [min(ay,by),max(ay,by)]. Bits symétriques (setEdge écrit les deux miroirs). Aucun piège. Activer par défaut l'empreinte statique des presses et lames (boîte englobante de leur course) comme obstacle de navigation.
- Preuve exigée : `node $B/routebench.mjs $R heap,nearest,long,labels,static` → route() à froid 114 → 70 µs ; cuisson 63k–76k arêtes en 20–45 ms. Nouveau test : edgeTest == segmentFree(.4) sans pièges sur toutes les arêtes, 0 écart.
- Qualité : meilleure (arêtes indépendantes de la pose des pièges, simulation restaurée cohérente).
- Garde-fous : comportement modifié (hash différent, voulu) ; pièges ne bloquent plus la planification, l'évitement local reste. +0,30–0,35 Mo (Float64). +1,5 Ko. Tests pièges et IA à rejouer (checks/simulation.test.mjs).
- Dépend de : rien.

### T2 — Masque de substrat hors carte et rejet des buts de flanc [IA-V1]
- Où : src/world.js:1280 ; src/simulation.js:128-134 ; src/simulation.js:151 ; src/simulation.js:516 ; src/simulation.js:1380 ; src/simulation.js:1404 ; src/simulation.js:1516 ; src/simulation.js:1580 ; src/simulation.js:1591 ; src/simulation.js:1601
- Quoi : créer `navSub=new Uint8Array(nav.length)` (1 si aucun sol non-substrate non-fallback couvre le centre). Dans setGoal, avant route() : si navSub(but) et !navSub(ennemi), ramener le but vers lastSeen par pas de 0,8 m (16 max) ; sinon renvoyer false sans consommer routeBudget. Dans la cuisson et l'étiquetage, ignorer les cellules de substrat à plus de 2 cellules d'une cellule intérieure (frange précalculée). File pumpNav : 37–44k → 11–13k cellules.
- Preuve exigée : `OPEN=0,1,2 ENC=0..7 node V2/spikes.mjs R tourx 3600 v2-w01,v2-w10 check` → 0 échec dont l'arrivée est sur le substrat. `node V2/hold.mjs R legacy-s0 1800 circle` → part d'ennemis en hold en baisse.
- Qualité : meilleure (supprime 100 % des A* plafonnés mesurés en jeu portes ouvertes, 9 à 34/min).
- Garde-fous : après brèche extérieure, le substrat reste accessible via la frange de 2 cellules ; si un ennemi y est posé, il doit pouvoir revenir. +37–44 Ko. Tests : but de flanc hors salle ramené ; ennemi sur substrat qui retrouve un chemin.
- Dépend de : T1 (arêtes statiques pour la cuisson).

### T3 — refreshNav local par région changée [IA-02]
- Où : src/simulation.js:229-231 ; src/simulation.js:300 ; src/simulation.js:316 ; src/simulation.js:912 ; src/simulation.js:1379-1391 ; src/destruction.js:160-178 ; checks/simulation.test.mjs:1862-1871
- Quoi : dans destruction.js rebuild(), exposer `changedBounds` (union des g.bounds des groupes dont la liste de boîtes a changé, via la signature déjà en cache ligne 164). Ligne 316 : `if(advanced&&dirtyAny)refreshLocal();else if(navDirty)refreshNav();`. refreshLocal : élargir de 0,4+cell+0,05 m, recalculer nav[] (≤768 cellules immédiat, sinon navQueue), nouveau id de composante pour toute cellule devenue marchable, retester arêtes de [x0−1..x1]×[z0−1..z1], union-find à chaque arête ouverte. Repli global (splitFallback) au-delà de 25 % de la grille. N'invalider que les ennemis dont le chemin traverse la région (AABB sur cellules restantes).
- Preuve exigée : `node $B/variant.mjs $R heap,nearest,long,labels,static,local,free,defer tour 3600 v2` → skippedRefresh 50–91 %, 0 refresh global. Nouveau test : après 50 destructions aléatoires, partition locale == partition complète.
- Qualité : meilleure (fin des rafales de replanification, −22 à −31 % du temps de simulation).
- Garde-fous : déterminisme (parcourir les groupes dans l'ordre des ids). Réécrire checks/simulation.test.mjs:1862-1872 une seule fois (navUpdates ≤ 768, passage physique immédiat, cellule (0,−8) marchable après N pas). Hash différent (voulu).
- Dépend de : T1 (edgeTest statique).

### T4 — Étiquettes de composantes connexes et rejet O(1) dans route() [IA-01]
- Où : src/simulation.js:1402-1433 ; src/simulation.js:1406 ; src/simulation.js:1414 ; src/simulation.js:1420 ; src/simulation.js:1742 ; src/simulation.js:1437 ; src/simulation.js:1513-1516 ; src/simulation.js:1559 ; src/simulation.js:1580 ; src/simulation.js:1601 ; src/simulation.js:711 ; src/simulation.js:1389
- Quoi : `navComp=new Int32Array(nav.length).fill(-1)` + `compParent=new Int32Array(nav.length)` (union-find, compression par moitié). BFS à 4 voisins sur bits d'arête, en réutilisant `queue` (ligne 513). Cuisson synchrone dans FSimulation.create() et dans restore() (avant `return true` ligne 2215). Dans route(), après les deux nearestNode : `if(labelsReady&&findComp(navComp[start])!==findComp(navComp[end]))return null;`. Rejet avant la consommation du budget (variante recommandée).
- Preuve exigée : `sh $B/abrun.sh $R heap,nearest,long,labels,static,local,free,defer tour 3600 3 v2` → max médian 2,5–8,6 ms, pas >8 ms : 0–1/min, p99,9 2,4–4,0 ms. `node $B/workcount.mjs` → nœuds ≤ 675, segmentFree ≤ 318 par pas. Test : route()===null ssi composantes diffèrent ; aller-retour snapshot/restore compare les étiquettes.
- Qualité : meilleure (−67 à −97 % de nœuds explorés, part de route() 9–35 % → 0,8–1,8 %).
- Garde-fous : cuisson synchrone dans restore() obligatoire (sinon divergence vivante/restaurée). +0,30–0,35 Mo. +22–27 ms au chargement. +3–5 Ko. aiVersion inchangé.
- Dépend de : T1, T2, T3.

### T5 — Mémoire des échecs A* par époque de navigation [SIM-V2]
- Où : src/simulation.js:1402-1426 ; src/simulation.js:1389 ; src/simulation.js:1742
- Quoi : `navEpoch` (entier, incrémenté quand le diff de colliders est non vide ou qu'une porte s'ouvre). Map clé `start*nav.length+end` (+ bit r>0,4), valeur navEpoch ; dans route(), après nearestNode et après `routeBudget--/routeSearches++`, retourner null si la clé porte l'époque courante ; inscrire quand la boucle se termine sans found. Table vidée quand navEpoch change, taille ≤ 4 096.
- Preuve exigée : `node probe.mjs` → plus aucune répétition du couple 4 422/2 401 après la première occurrence. `node ab.mjs <module> <export>` avec SCEN=0,2,c9,c15 → identical=true, cpuMax en baisse.
- Qualité : identique (état de simulation égal, budget inchangé).
- Garde-fous : exact si T1 appliqué (arêtes indépendantes des pièges). Table non sérialisée, vide après restore. +0,4 Ko. À coordonner avec T4 pour ne pas dupliquer le rejet.
- Dépend de : T1, T4.

### T6 — Filtre de niveau et de composante dans cover() et peek() [BOSS-V1]
- Où : src/simulation.js:1445-1460 ; src/simulation.js:1402-1414 ; src/world.js:1247-1252 ; src/world.js:1722
- Quoi : dans cover(), avant setGoal : rejeter le candidat si |groundAt(cx,cz) − e.baseY| > 0,6 m ; puis si navComp[nearestNode(cx,cz)] ≠ navComp[nœud du garde]. Même filtre dans peek() et dans flank/strafe. Garde-fou : borne locale `min(2400, 64+8·Manhattan)` pour cover/flank/strafe uniquement (poursuites longues gardent 2400).
- Preuve exigée : `GOD=1 node vfight.mjs <racine> 1 60 skilled 0 {96,7,2026}` → 0 route en échec à plus de 200 nœuds, pas maximal < 15 ms de CPU.
- Qualité : identique (filtre pur, empreinte d'état égale sur graines 96 et 7).
- Garde-fous : seuil de 0,6 m à ne pas resserrer (rampe courte). Aucun champ sauvegardé. Tests IA de checks/simulation.test.mjs et checks/natural-spawn.test.mjs à rejouer.
- Dépend de : T4 (navComp).

### T7 — Jump pads à sens unique : garde de composante et repli de retour au poste [IA-V2]
- Où : src/simulation.js:1523-1527 ; src/simulation.js:363 ; src/simulation.js:371 ; src/simulation.js:738-741 ; src/simulation.js:727 ; src/simulation.js:709-714 ; src/simulation.js:1776
- Quoi : ligne 1525 : n'emprunter un pad que si la composante de pad.target est celle de la cible ou si un pad de retour existe. returnToPost (740) : si composante du poste ≠ composante de l'ennemi, chercher un pad de la composante de l'ennemi dont la cible est dans celle du poste ; à défaut `e.returning=false;clearEvidence(e);` et garder la position courante comme poste provisoire. Ligne 1776 : même garde. Ligne 711 : classer les entrées par composante avant safeEntry ; si aucune dans la composante du déclencheur, ne lancer aucune recherche ni rayon tant que la révision de navigation n'a pas changé.
- Preuve exigée : `ENC=2,5 node V2/retpost.mjs R v2-w01,v2-w10 3600` → 0 recherche échouée. `node V2/streak.mjs R v2-w01 3 2400` → 0 A* plafonné par tick.
- Qualité : meilleure (supprime 127–128 inondations A*/min par ennemi piégé, vague non bloquée).
- Garde-fous : vérifier que quietTime et combatEnabled ne renvoient pas aussitôt en retour. Rejouer checks/campaign-simulation.test.mjs et checks/boss-progression.test.mjs. Test : pad vers salle fermée, l'ennemi ne le prend pas.
- Dépend de : T4 (navComp).

### T8 — Budget de travail par pas et préremplissage du cache autour du déclencheur [SIM-12]
- Où : src/simulation.js:1402-1420 ; src/simulation.js:1742 ; src/simulation.js:86 ; src/game.js:677 ; src/game.js:690-692
- Quoi : remplacer `routeBudget=advanced?2:Infinity` (ligne 1742) par un budget en unités de travail (pop = 1, test d'arête = 8, plafond ≈ 6 000 unités par pas, en gardant routeSearches ≤ 2). Préremplir edgeKnown/edgeOpen autour du déclencheur de rencontre pendant les pas calmes (le trigger est connu d'avance). Ne pas dépasser 4 sous-pas quand dt est plafonné à 0,12 s (game.js:677, 690-692).
- Preuve exigée : `node spike-fast.mjs` → pointes de début de vague < 4 ms sur bureau. `BASE=full-v2.mjs:fullPatch REPS=2 node ab2.mjs` → max < 4 ms, 0 pas > 4 ms par 30 s.
- Qualité : meilleure (pointes de 10–16 ms → < 4 ms).
- Garde-fous : le budget en unités de travail change l'instant où un chemin arrive (non bit à bit) ; tests brain, natural-spawn, campaign-simulation, boss-progression à rejouer. Plafonner les sous-pas ralentit le temps de jeu sur machine lente : à trancher avec l'axe LOOP.
- Dépend de : T1, T4.

### T9 — Tas typé, nearestNode trié, balayage long par seaux [IA-04]
- Où : src/simulation.js:1392-1401 ; src/simulation.js:1410-1411 ; src/simulation.js:1354 ; src/simulation.js:1405 ; src/simulation.js:1430
- Quoi : `heapNode=new Int32Array(9608)` et `heapKey=new Float64Array(9608)` (9608 = 2400×4+8), hpush/hpop avec tamisage identique (`<=` insertion, `<` enfant, `>=` arrêt), hn=0 par recherche. Voisins déroulés sans allocation. nearestNode : collecter ≤ 49 candidats, tri par insertion stable sur (d, ordre ligne) avec `>` strict, tester segmentFree dans cet ordre. Segment long : parcourir les seaux de collision couvrant l'AABB + doorBoxes ; repli sur solids si r > 1,05.
- Preuve exigée : `node $B/variant.mjs $R heap,nearest,long circle 1800` puis `tour 3600` → hash identique à base sur les 7 scénarios. `node $B/routebench.mjs $R heap,nearest,long` → route() chaud 114 → 23 µs.
- Qualité : identique (état de simulation prouvé égal, snapshot octet pour octet).
- Garde-fous : l'ordre du tas pour les coûts égaux est la seule chose fragile → test de hash obligatoire dans la suite. +115 Ko. +1–2 Ko.
- Dépend de : T4.

### T10 — Préchauffage amorti du cache d'arêtes hors de route() [LOAD-V1]
- Où : src/simulation.js:1377-1378 ; src/simulation.js:1379-1382 ; src/simulation.js:1389 ; src/simulation.js:1418-1421 ; src/simulation.js:1349-1376
- Quoi : dans pumpNav, une fois la file de cellules vide, évaluer au plus N = 96 arêtes par pas (≈ 0,3–0,6 ms ; 0 si le pas dépasse déjà 4 ms) en balayant la grille par anneaux autour du joueur (curseur). Pour chaque cellule franchissable : arêtes +x et +z, poser les deux sens (bit k sur i, bit k^1 sur j). Pendant l'écran de chargement, préchauffer par tranches de 8 ms jusqu'à un rayon de 40 m. L'invalidation locale remet seulement les cellules touchées dans le balayage. Évaluer les arêtes sans trapBoxes.
- Preuve exigée : `node bancs/load-verif2/vV1.mjs c:9 3` puis `l:0 3` → astarMsMax < 5 ms, localEqualsLocalPre true. Critère en jeu : aucun pas > 8 ms dû à route() sur c:5, c:9, l:0, l:2.
- Qualité : identique (FNV du snapshot égal entre variante locale et préchauffée).
- Garde-fous : borner N et couper si le pas est long. +0,2–0,4 s au chargement si préchauffage complet (d'où la limite de rayon). Vérifier l'égalité de snapshot sur 6 mondes.
- Dépend de : T1, T3.

### T11 — Différer la sauvegarde pendant la navigation en attente [LOOP-03]
- Où : src/simulation.js:1379-1390 ; src/simulation.js:1941-1959 ; src/game.js:94-100 ; src/game.js:238
- Quoi : dans saveCheckpoint, différer la sauvegarde tant que navPending > 0 (exposé via state.aiStats.navPending, ligne 1381), avec une échéance de 1,5 s au-delà de laquelle on force. Ne pas différer snapshot() lui-même. Ajouter l'échéance du report « en l'air » de src/game.js:96 (nécessaire dès que le saut existe). Secours sur pagehide pour ne pas perdre le point de reprise.
- Preuve exigée : `node bench/loop/snapshot.mjs` → coût dans l'image < 4 ms (vs 16–32 ms en base). `MARK=1 node bench/loop/play.mjs 30 q60 9` → aucune image > 33 ms contenant sim.snapshot.
- Qualité : identique (image et son inchangés ; l'instant du point de reprise se décale de façon déterministe).
- Garde-fous : snapshot() a des effets de bord (pumpNav, invalidateBrain) ; garder checkpoint en mémoire avant l'écriture. Échec setItem géré par saveAvailable. Format inchangé.
- Dépend de : T3 (file réduite à quelques centaines de cellules).

### T12 — Tri-état DEFER distinct de l'échec dans route() [IA-03]
- Où : src/simulation.js:1406 ; src/simulation.js:1437-1438 ; src/simulation.js:1529-1531 ; src/simulation.js:1609 ; src/simulation.js:711 ; src/simulation.js:740 ; src/simulation.js:1776 ; src/simulation.js:1791
- Quoi : `const DEFER=false;` ; route() renvoie DEFER quand le budget est épuisé. setGoal : `if(path===DEFER){e.thinkWait=Math.min(e.thinkWait,.1);return true;}` (conserver goalX, goalZ, path). Ligne 711 : `if(approachPath===DEFER){approachPath=null;probes=0;break;}`. Branche de blocage (1530) : sur DEFER, garder l'ancien chemin. cover() et peek() : tester `path===DEFER` avant d'écrire holdTime ou coverWait.
- Preuve exigée : `node $B/variant.mjs $R free,defer tour 3600 v2` → reports 0–5/min (vs 48–201). Test unitaire : budget forcé à 0, setGoal conserve goalX, goalZ, path ; l'ennemi ne passe pas en 'hold'.
- Qualité : meilleure (1 à 4 arrêts injustifiés/min supprimés).
- Garde-fous : chaque appelant doit tester `===false` avant `!path` ([] est vrai, false est faux). thinkWait reste dans [-0,05 ; 0,75]. Hash différent (voulu).
- Dépend de : T4, T8.

### T13 — Cache d'approche et budget de rayons pour le déploiement [IA-07]
- Où : src/simulation.js:659-674 ; src/simulation.js:675-678 ; src/simulation.js:684 ; src/simulation.js:700 ; src/simulation.js:707-711 ; src/simulation.js:736 ; src/simulation.js:513 ; src/simulation.js:2218
- Quoi : précalculer `q.ids` (Int32Array des enemyIds des vagues) dans create() et restore(), compter remaining et active en une passe. safeEntry : réordonner les échantillons (h=1,1 centre d'abord, puis ±0,9) ; budget de 64 rayons par pas avec curseur reporté. Entrées naturelles : rejet O(1) par composante (T4), puis cache `approach[q.id][entryIndex]={rev,path}` invalidé par refreshLocal quand la région touche le chemin.
- Preuve exigée : `node $B/percep.mjs $R 3600 v2` → updateEncounters −50 %, rayons safeEntry ÷2–3, max 64/pas. `node $B/variant.mjs` → hash identique pour la variante neutre (réordonnancement seul).
- Qualité : identique (réordonnancement des échantillons est neutre ; le budget de rayons change l'ordre de déploiement, hash différent).
- Garde-fous : cache d'approche invalidé par révision de navigation locale. q.ids recalculé au restore. Rejouer checks/campaign-simulation.test.mjs et checks/boss-progression.test.mjs.
- Dépend de : T4.

### T14 — Coordination d'escouade : jetons, flanc vers l'angle mort, suppression [IA-10]
- Où : src/simulation.js:1515 ; src/simulation.js:1572 ; src/simulation.js:1589 ; src/simulation.js:1598 ; src/simulation.js:1790 ; src/simulation.js:1794-1796 ; src/simulation.js:1204-1225 ; src/simulation.js:1227-1233 ; src/simulation.js:1296
- Quoi : jetons d'attaque N = 2 + difficulté, attribués par (distance, id) aux ennemis qui voient le joueur ; sans jeton → déplacement latéral ou couvert. Flanc : côté = signe de cross(avant du joueur, vecteur joueur→ennemi), pince par parité du rang. Suppression : si !e.seen et s.time−e.observedAt < 1,2, tir sur lastSeen (dispersion ×1,6, cadence ×0,6). Grenade de débusquage : grenadier, joueur caché 1,5–4 s, lastSeen 6–24 m → ordnanceSolution. Type 0 en windup : déplacement latéral 35–40 % via move(). Retraite : hp < 35 % et aucun allié < 8 m → cover().
- Preuve exigée : `node $B/aiq.mjs $R <flags> 3600` → maxSimultaneousAimers 2–4, enemyShotsPerS, playerDamagePerS. Nouveaux compteurs : tirs de suppression, grenades de débusquage. Test : snapshot, restore, même hash au pas N.
- Qualité : meilleure (combats plus lisibles, pression quand le joueur se cache).
- Garde-fous : équilibrage à revalider avec tools/campaign-balance.mjs. aiVersion 3 inchangé (pas de nouveau champ). Déterminisme : tout dérive de s.time et des ids. AGENTS.md : test de simulation par comportement ajouté. Livrer jetons + flanc d'abord (effort S–M), le reste ensuite.
- Dépend de : T4.

### T15 — Mode CPU par défaut pour le réseau tactique, WebNN en option [IA-12]
- Où : src/brain.js:7 ; src/brain.js:52 ; src/brain.js:87 ; src/brain.js:93-101 ; src/simulation.js:1489-1506 ; src/simulation.js:1472
- Quoi : régler aiAcceleration à 'cpu' par défaut (options.js:6). WebNN en option expérimentale. Si WebNN conservé : appliquer les conseils à échéance fixe en temps de simulation (request.time + 0,25 s = brainWait), rejeter si le résultat n'est pas prêt. CPU et WebNN donnent le même comportement tant que le résultat arrive à temps.
- Preuve exigée : micro-banc FBrain.cpu (13,4 µs/lot de 16). Nouveau test : même graine, mode cpu contre WebNN simulé (promesse résolue à des pas différents) → hash identique avec l'application à délai fixe.
- Qualité : identique (comportement reproductible d'une machine à l'autre).
- Garde-fous : adapter checks/brain.test.mjs et l'étiquette « WebNN accéléré » (brain.js:48). Aucun effet sur les sauvegardes.
- Dépend de : rien.

### T16 — Meilleur point atteignable (proxyGoal) pour les cibles hors composante [IA-08]
- Où : src/simulation.js:1559 ; src/simulation.js:1580 ; src/simulation.js:1601 ; src/simulation.js:1516 ; src/simulation.js:1609 ; src/simulation.js:740 ; src/simulation.js:1776
- Quoi : `proxyGoal(e,tx,tz)` : si la cible n'est pas dans la composante de l'ennemi, parcourir en spirale ≤ 841 cellules (rayon 14), ne garder que celles de la composante de l'ennemi (exclure le substrat, T2). Score = distance + 4 si |Δy|>1,5 − 3 si voit lastSeen. Tester sight sur les 6 meilleures, setGoal sur la meilleure. À défaut : position de tir avec ligne de vue, sinon cover(). Délai de 1,5 s via planWait.
- Preuve exigée : `node $B/variant.mjs $R <flags>+proxy circle 1800 legacy-s2` et `v2-w06` → holdPct et movePct. `node $B/aiq.mjs` → idleHoldPct en baisse.
- Qualité : meilleure (qualitatif : ennemis se placent au bord des plates-formes au lieu d'attendre).
- Garde-fous : spirale en ordre fixe, égalités par indice. Pas de nouvel état persistant (planWait ≤ 2,6, validé au restore). Hash différent. +1 Ko.
- Dépend de : T4, T2.

### T17 — cover() et peek() : tri avant sight, présélection par seaux [IA-13]
- Où : src/simulation.js:1445-1461 ; src/simulation.js:1462-1471
- Quoi : cover() : construire les candidats avec filtres bon marché (distance, >3 m de lastSeen, blocked), trier par score (d + 8 si occupé) stable, tester sight et protects dans cet ordre, setGoal sur les 7 premiers qui passent. Présélectionner les solids par les seaux de collision dans un rayon de 10 m. peek() : tester sight dans l'ordre de génération, setGoal dès le premier succès.
- Preuve exigée : `node $B/coverbench.mjs $R main` → rayons cover 23 → 5–8, peek 36 → 7–12. `node $B/variant.mjs` → hash identique à la base.
- Qualité : identique (sight, protects, blocked purs ; tri stable).
- Garde-fous : test de hash obligatoire (ordre des égalités). Aucun effet sur les sauvegardes.
- Dépend de : T4 (le max de 19,4 ms vient de l'A* échoué, réglé par T4).

### T18 — Clé entière dans rebuildNeighbors, tampon réutilisé dans nearby() [IA-14]
- Où : src/simulation.js:1279-1290 ; src/simulation.js:1742
- Quoi : remplacer la clé chaîne `Math.floor(e.x/8)+','+Math.floor(e.z/8)` par l'entier `(ix+32768)*65536+(iz+32768)` dans la même Map (ordre d'insertion conservé). nearby() : réutiliser un tableau résultat avec une pile de tampons pour les appels imbriqués.
- Preuve exigée : `node $B/percep.mjs` → rebuildNeighbors < 2 µs, separate < 5 µs. `node $B/variant.mjs` → hash identique à la base.
- Qualité : identique (ordre d'itération par seau préservé).
- Garde-fous : tampon partagé risqué si un appelant garde le tableau (vérifier cover→nearby en 1454, le `.some` immédiat est sûr). Test de hash obligatoire.
- Dépend de : rien.

### T19 — Replanification sur événement : visibilité, dash, saut, allié tué [IA-09]
- Où : src/simulation.js:1791 ; src/simulation.js:1765 ; src/simulation.js:1316-1330 ; src/simulation.js:816 ; src/simulation.js:1297 ; src/simulation.js:15-16 ; src/simulation.js:1968 ; src/simulation.js:2120-2149
- Quoi : replanifier (thinkWait = min(thinkWait, 0)) quand e.seen bascule (perceive 1316-1330), quand le joueur dash/saute/jump-pad à < 20 m, quand un allié est tué à < 8 m. Cadence en combat : 0,35–0,45 s + (id%3)×0,05. Anti-rafale : au plus 3 replans événementiels par pas, dans l'ordre des ids. Écarter l'option planRefX/planRefZ (impose aiVersion 4 pour un bénéfice non démontré).
- Preuve exigée : `node $B/aiq.mjs $R <flags> 3600` → plansPerEnemyPerS 1,5–2, reactionP90S < 0,9 s. `node $B/workcount.mjs` → maximum par pas non augmenté.
- Qualité : meilleure (repositionnement plus réactif, qualitatif).
- Garde-fous : à n'activer qu'avec T4 (sinon les pointes se multiplient). thinkWait dans [-0,05 ; 0,75]. Risque d'IA trop nerveuse : régler par difficulté, valider avec tools/campaign-balance.mjs.
- Dépend de : T4.

### T20 — Visée balistique en vol et borne au sol [IA-11]
- Où : src/simulation.js:95 ; src/simulation.js:1322 ; src/simulation.js:1795-1796 ; src/simulation.js:8 ; src/simulation.js:2139
- Quoi : si le joueur est en l'air : y(t) = y0 + vy·t − 6·t², bornée à ground(aimX,aimZ) + 1,45 ; au sol : aimY = lastSeenY. Borne minimale aimY ≥ ground(aimX,aimZ) + 0,3. Ne pas modifier la borne ±6 m/s de observedVX/VZ (1322) ni le format de sauvegarde. Le reste (±9 m/s, lead par difficulté) est à trancher avec l'axe mouvement.
- Preuve exigée : test déterministe : joueur scripté en saut parabolique, erreur verticale du point visé au tir, base vs nouvelle version. `node $B/aiq.mjs` → playerDamagePerS par difficulté.
- Qualité : meilleure (plus de tirs sous le sol à la réception d'un saut).
- Garde-fous : ne touche ni la borne ±6 ni le format de sauvegarde. aiVersion inchangé. À coordonner avec l'axe mouvement si la vitesse maximale change.
- Dépend de : rien.

## Options désactivées par défaut
- [IA-12] Mode WebNN accéléré — le réseau 16-20-8 coûte 13,4 µs/lot sur CPU ; l'accélération matérielle introduit une non-déterminisme entre machines. Mode 'cpu' par défaut, WebNN en option expérimentale derrière un réglage.

## Écartés ou absorbés
- [LOOP-02] — Absorbé par la chaîne T1→T3→T4→T12→T9→T16. Le mémo d'inaccessibilité est abandonné (remplacé par les étiquettes de T4 et la mémoire de T5) ; le tas typé est dans T9 ; le recul après échec (point 2) est dans T16 ; l'invalidation ciblée est dans T3.
- [LOAD-02] — Absorbé par T3 (IA-02). Le Set de clés chaînes et l'hypothèse de monotonie sont écartés (faux dès qu'une boîte est ajoutée). La région changée est obtenue via le cache par groupe de destruction.js:164.
- [LOAD-04] — Réfuté. Le cache négatif ne donne que −1 à −6 % du temps A* (les répétitions sont déjà servies par le cache d'arêtes). Le cache symétrique (−8 à −10 %) est intégré dans T1 (bits symétriques). Le tas typé est dans T9.
- [BOSS-07] — Absorbé par T4 (étiquettes) + T6 (filtre cover). La borne locale et le cache négatif sont abandonnés (la borne peut rejeter des couvertures accessibles par détour ; le cache négatif est redondant avec T5). La vraie cause est le candidat de cover() hors niveau (T6).

## Décisions à confirmer par David
- checks/boss-progression.test.mjs:9 interdit de baisser les PV ; la table de BOSS-10 (lot équilibrage) sera périmée après les modifications de cadence et de dégâts. Acceptes-tu de réécrire ce test avec une nouvelle mesure des dégâts par fenêtre (bench/boss/window.mjs) ? — valeur par défaut : oui, réécriture après la passe d'équilibrage commune.
- IA-10 : livrer d'abord jetons d'attaque + flanc vers l'angle mort (effort S–M), puis suppression + grenades de débusquage + déplacement latéral en windup (effort M–L) ? — valeur par défaut : oui, deux livraisons séparées.
- T8 : plafonner les sous-pas à 4 quand dt est à 0,12 s (game.js:677) ralentit le temps de jeu sur machine lente. À trancher avec l'axe LOOP. — valeur par défaut : oui, mais avec un plancher de 2 sous-pas.

## Gains attendus du lot
Pointes de simulation : de 23–67 ms (5–7 pas > 8 ms par 30 s) à 0–1 pas > 8 ms par minute, soit une suppression de 95 % des saccades imputées à route(). Temps A* cumulé : −56 à −83 % (207 → 90 ms sur c:9, 126–191 → 9,5–14,5 ms sur le Brise-siège). Part de route() dans le temps de pas : 9–35 % → 0,8–1,8 %. Rafales de replanification après destruction : supprimées (50–91 % des refresh évités). Attente injustifiée des ennemis : −60 à −80 % sur les cartes figées. Coût CPU résiduel de la navigation : < 0,2 ms/s (updateEncounters + safeEntry + rebuildNeighbors).

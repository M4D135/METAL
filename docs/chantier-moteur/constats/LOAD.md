# Axe LOAD — LOAD (chargement, destruction, mémoire)

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Mesures faites en node 24.18 dans un contexte vm, sans toucher au dépôt (main 673d6b2 intact, git status vide). Les copies patchées et les copies de test sont dans bench/load. Aucun réseau, aucun serveur. La machine était partagée avec d'autres agents : les temps absolus sont bruités. Les gains reposent sur des A/B alternés dans un même processus, avec vérification que la sortie est identique (FNV du JSON du monde).

Constat critique : les points de reprise sont presque toujours refusés dès qu'un gravat repose dans le jeu. Sur 5 scénarios réels (tir pistolet/SMG, roquettes), 2 points sur 55 seulement sont acceptés. Cause : restore exige qu'aucun gravat au repos ne chevauche un collider (simulation.js:2081), alors que la physique des débris en produit couramment. La reprise retombe alors à l'entrée du secteur avec l'arsenal par défaut (game.js:120, loadout passé à undefined) et la sauvegarde est écrasée. Supprimer cette ligne donne 55/55 points acceptés, dont 54 identiques octet pour octet, et 166/166 tests.

Autres gains mesurés :
- refreshNav(reset) global à chaque révision remet en file toute la grille (37–44 k cellules), vide le cache d'arêtes et efface les chemins. L'invalidation locale, valide parce que la destruction ne fait qu'ouvrir, réduit segmentFree de 55 à 65 %, les pics A* au-delà de 30 ms de 5 à 2 (c:9) et le temps A* de 66 %. Un point de reprise après une brèche passe de 33–35 ms à moins de 1 ms.
- Les gravats coûtent 1,5 à 2,6 ms par pas même au repos ; des morceaux coincés ne s'endorment jamais (8 sur 128).
- FWorld.create gagne 43 à 73 % à sortie identique (46/46 mondes).

Chargement :
- Le travail lourd tient dans une seule tâche de 300–450 ms (génération, simulation, rendu).
- Une reprise construit 2 contrôleurs de destruction et 2 grilles nav : restore prend 88–290 ms, dont 49 % de nav et 43 % de destruction.
- Audio : des lots de synthèse de 110–177 ms.

Mémoire : pas de fuite (tableaux bornés, tas en dents de scie de 27 à 110 Mo sans tendance), mais 0,74–0,97 Mo alloués par pas, soit 40 à 93 GC par minute.

Les points de reprise font 82–274 K caractères, loin des limites. Les points 0.6.1 se restaurent en 0.8.0 (10/10).

Préalable : checks/campaign-world.test.mjs échoue déjà à 8/46 sur main sous Node 24.18 (empreintes historiques), avec ou sans patch.

## Mesures

- **FWorld.create (un monde)** : 222–413 ms selon le monde (c:0 413, c:9 271, c:17 368, l:0 222), 180–240 ms quand la machine est moins chargée ; 13,8–17,4 k maillages, JSON du monde 4,1–5,3 Mo _(méthode : bench/load/gen-time.mjs, node 24.18 vm, une exécution par monde, machine partagée)_
- **FWorld.create, patch worldgen3 contre original** : c:0 −43 %, c:5 −54 %, c:9 −60 %, c:17 −73 %, l:0 −54 % (médianes 824→466, 1101→507, 1142→452, 2735→736, 838→384 ms sous forte charge) ; −60 à −71 % lors d'exécutions moins chargées ; 46/46 mondes identiques _(méthode : gen-ab.mjs (alterné, 4 répétitions), gen-identity.mjs (FNV du JSON : 2 graines × 18 mondes campagne v2, 3 historiques, 4 campagne v1), checks/world.test.mjs PASS sur la copie repo-wg3)_
- **FDestruction.create / FSimulation.create / FRender.setWorld (CPU)** : 35–66 ms / 122–175 ms / 11–16 ms _(méthode : gen-time.mjs, WebGL2 factice (Proxy) qui compte les envois ; envois GPU réels non mesurés)_
- **restore d'un point de reprise** : 88–133 ms sur un point frais ; 290 ms sous profileur sur un point lourd (c:3, 127 K caractères) : refreshNav(false) 142 ms (49 %), FDestruction.create du candidat 124 ms (43 %), GC 36 ms _(méthode : gen-time.mjs ; restore-diff.mjs (profileur node:inspector, échantillonnage 100 µs))_
- **FWorld.validate (inutilisé en jeu)** : 1,9–3,3 s par monde _(méthode : gen-time.mjs)_
- **snapshot et stringify** : snapshot 1,0–1,5 ms à froid ; 33–35 ms juste après une brèche (pumpNav(nav.length)) contre 0,75–0,93 ms avec localnav ; JSON.stringify 0,2–0,5 ms _(méthode : gen-time.mjs, save-after-blast.mjs (original contre copie localnav))_
- **Taille des points de reprise** : 81 766 (c:0, 66 ennemis) à 273 628 caractères (c:17, 221 ennemis) ; ennemis 140 des 218 Ko (≈1,1 Ko chacun) ; ≈207 K avec 128 gravats et 91 états de destruction _(méthode : gen-time.mjs, rubble.mjs (parts), memory.mjs)_
- **Points de reprise acceptés** : original 2/55 (marche + tir : l:0 0/12, c:3 1/12, c:9 1/12 ; une roquette par mur : l:0 0/12, c:9 0/7) ; sans gravats 55/55 ; patch rubblefix 55/55 acceptés, 54/55 exacts (seul écart voulu : balle à moins de 2,4 m retirée par recover) _(méthode : rubble-fix.mjs (vraie sim, restore dans une sim neuve, {recover:true}, comparaison du snapshot restauré) ; restore-diff.mjs)_
- **Tests du projet sur copies patchées** : rubblefix : simulation + checkpoint + destruction 166/166 ; localnav : 170/171 (seul échec : test des lots bornés simulation.test.mjs:1862) ; original 171/171 ; campaign-world.test.mjs : 8/46 échecs déjà présents sur main 673d6b2, identiques avec worldgen3 _(méthode : node --test --test-reporter=tap dans bench/load/repo-fix, repo-localnav, repo-orig, repo-wg3 (copies tar du dépôt sans .git))_
- **Compatibilité 0.6.1 → 0.8.0** : 10/10 points restaurés (historiques 0–2, campagne v1 0 et 3 ; à l'entrée et après 10 s) ; mondes identiques. La campagne v2 n'existait pas en 0.6.1 _(méthode : save-compat.mjs (sources 00217cd extraites par git show dans bench/load/old-00217cd))_
- **Pas de l'explosion d'une roquette dans un mur** : 5–14 ms contre 0,2–1 ms pour le témoin (destruction.blast neutralisé) _(méthode : blast.mjs, blast-profile.mjs)_
- **renderer.updateWorld par révision** : 3,3–5,4 ms (spatialIndex complet) et 200–244 Ko renvoyés _(méthode : blast.mjs avec le GL factice (octets de bufferData))_
- **File nav après une brèche** : 48 pas de pumpNav(768) pour vider 37 k cellules (l:0), contre 0 avec localnav ; −100 à −250 ms cumulés sur 300 pas _(méthode : blast.mjs, original contre patched/localnav)_
- **Pics A*** : 42–69 ms par recherche froide qui échoue (2 300–2 400 nœuds, 4 000–4 400 segmentFree à ≈10 µs) _(méthode : spikes.mjs, routes.mjs sur copie instrumentée (patch instr))_
- **localnav contre original (scénario bench2, 1 800 pas)** : c:9 : segmentFree 24 478 → 10 951, recherches froides 5 → 2, pas > 30 ms 5 → 2, A* 428 → 145 ms ; l:0 : 15 210 → 6 111, pics 3 → 1 ; l:2 : 13 452 → 4 682, pics 3 → 1 _(méthode : routes.mjs et spikes.mjs avec SRC=patched/instr contre patched/localnav-instr)_
- **Taux d'échec A*** : c:9 : 26 recherches, 18 échouées, 5 froides ; c:5 : 8/8 échouées ; l:2 : 8/8 échouées (280 ms) _(méthode : routes.mjs avec SRC=patched/instrBig)_
- **Coût des gravats** : 128 gravats au repos : 1,51–2,56 ms/pas (65–86 % d'un pas inactif) ; 1,4–5 ms/pas pendant la chute _(méthode : rubble.mjs et debris-sleep.mjs (copie instr2, médianes de 3 blocs alternés de 600 pas))_
- **Gravats jamais au repos** : 8/128 (l:0) et 3/128 (l:1) encore éveillés après 70 s ; seuls ils coûtent 1,00 et 0,38 ms/pas (≈0,12 ms par morceau contre 0,008–0,017 ms au repos) ; forcés au repos, réveillés au pas suivant _(méthode : debris-sleep.mjs)_
- **GC sur 5 minutes simulées (18 000 pas)** : 39,6 GC/min (l:0), 74,6 (c:9), 92,8 (l:0, roquette toutes les 10 s) ; 172–436 GC mineurs ; tas échantillonné 27–110 Mo en dents de scie, sans tendance ; tableaux bornés (gravats ≤ 128, particules ≤ 22, balles ≤ 5, états de destruction ≤ 91) _(méthode : node --expose-gc memory.mjs ; PerformanceObserver gc avec setImmediate tous les 300 pas ; heapUsed absolu après gc() forcé jugé non fiable, non retenu)_
- **Allocation par pas** : 744–971 Ko _(méthode : alloc.mjs (HeapProfiler.startSampling, objets collectés par GC mineur et majeur inclus))_
- **Pauses GC** : max 1,7 ms à faible charge ; 20–40 ms sous forte charge (gonflé par l'ordonnancement) _(méthode : memory.mjs (durées PerformanceObserver))_
- **Désoptimisations V8** : 500–800 sorties d'OSR Maglev sur segmentFree par recherche lourde ; « wrong call target » après chaque FSimulation.create _(méthode : node --trace-deopt deopt-steps.mjs, deopt-attr.cjs (deopt-l0.log, deopt-c9.log))_
- **FMusic.warmup** : stage 0 à froid 84–234 ms en 9 tranches, la plus longue 21–68 ms (moduleFor) ; stages 1 et 2 ensuite 10–24 ms en une tranche ; getModule 0,06–0,1 ms _(méthode : music.mjs (setTimeout instrumenté qui mesure chaque tranche synchrone), 3 exécutions)_
- **Banque d'effets audio (FAudio.synthesize)** : 34 noms, 1,85 Mo de PCM Float32, 559–764 ms au total ; lot maximal de 2 noms 110–177 ms (break:metal 96–136 ms, break:glass 93–103 ms) _(méthode : music.mjs, 3 exécutions)_

## Scripts de banc

- bancs/load/lib.mjs
- bancs/load/gen-time.mjs
- bancs/load/gen-profile.mjs
- bancs/load/gen-ab.mjs
- bancs/load/gen-identity.mjs
- bancs/load/fingerprint.mjs
- bancs/load/spikes.mjs
- bancs/load/routes.mjs
- bancs/load/deopt-steps.mjs
- bancs/load/deopt-attr.cjs
- bancs/load/blast.mjs
- bancs/load/blast-profile.mjs
- bancs/load/rubble.mjs
- bancs/load/rubble-overlap.mjs
- bancs/load/rubble-restore-debug.mjs
- bancs/load/restore-scenario.mjs
- bancs/load/rubble-fix.mjs
- bancs/load/restore-diff.mjs
- bancs/load/save-after-blast.mjs
- bancs/load/save-compat.mjs
- bancs/load/memory.mjs
- bancs/load/alloc.mjs
- bancs/load/debris-sleep.mjs
- bancs/load/music.mjs
- bancs/load/mkpatch.mjs
- bancs/load/patches.mjs
- bancs/load/patched/rubblefix/simulation.js
- bancs/load/patched/localnav/simulation.js
- bancs/load/patched/worldgen3/world.js

## Constats

### LOAD-01 — Points de reprise refusés dès qu'un gravat au repos chevauche un collider : reprise à l'entrée du secteur, arsenal par défaut
- sévérité critique · catégorie bug · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:2081; src/simulation.js:1028-1065; src/destruction.js:210; src/game.js:114-121; src/game.js:139; checks/simulation.test.mjs:1927-1946

**Preuve.** simulation.js:2081 « require(!supportBoxes.some(box=>debrisOverlaps(q,h,box))) » rejette tout le point si un seul gravat au repos chevauche une boîte.

Or updateDebris produit ce chevauchement :
- au plus 4 passes de dépénétration par sous-pas (simulation.js:1040-1044) ;
- une rotation bloquée garde le chevauchement (1050-1051) ;
- le passage au repos ne teste pas le chevauchement (1060) ;
- les morceaux naissent à la pose d'origine, donc dans la géométrie (destruction.js:210 fallingDebris).

Pénétrations relevées (rubble-overlap.mjs) : 5,2/0,97/0,23 m contre un décor ; 4,5/0,002/0,65 m contre le reste du même mur.

Mesure rubble-fix.mjs (vraie sim, restore dans une sim neuve avec {recover:true}) : 2 points acceptés sur 55.
- Marche et tir pistolet/SMG, un point toutes les 5 s : l:0 0/12, c:3 1/12, c:9 1/12.
- Une roquette par mur puis 300 pas : l:0 0/12, c:9 0/7.

Conséquence dans le shell : resumeSaved (game.js:114-121) recharge l'entrée avec load(savedIndex(v),v.seed,undefined,…). Donc carry=null (game.js:139) : armes, munitions, équipement et état de campagne d'entrée sont remplacés par l'arsenal par défaut. saveCheckpoint() écrase ensuite la sauvegarde, avec le message « Point de reprise illisible ». Ce chemin d'échec fait aussi deux load() complets dans la même tâche.

**Cause.** Le validateur de restore impose un invariant (aucun chevauchement au repos) plus strict que celui que garantit la simulation. Les gravats ne sont pas des colliders, ils sont purement visuels : ce contrôle ne protège rien en jeu. Les tests ne couvrent que des fixtures où le cas n'arrive pas ; aucun test ne porte sur un monde généré.

**Proposition.** 1) Supprimer la ligne simulation.js:2081 (patch rubblefix de bench/load/patches.mjs). Garder le contrôle d'appui de la ligne 2080 et toutes les bornes.
2) Dans game.js resumeSaved, avant le repli, retenter restore sur une copie sans gravats : supprimer rubbleVersion, state.rubble et timers.rubbleSerial. Ce format ancien est déjà accepté (simulation.test.mjs:1942).
3) Dans le repli ultime, passer copyLoadout(v.entryLoadout||v.entryInventory) au lieu de undefined, et n'écrire la nouvelle sauvegarde qu'une fois la partie relancée.
4) Ajouter un test de non-régression sur mondes générés : l:0 et c:9, une roquette sur 3 murs, 300 pas, puis vérifier que restore renvoie true et que le snapshot est identique (≈2–5 s par monde en node).

**Gain attendu.** Mesuré :
- 2/55 → 55/55 points acceptés avec le patch, dont 54/55 identiques octet pour octet après restore. Le seul écart est voulu : une balle ennemie à moins de 2,4 m est retirée par recover (simulation.js:2214).
- Copie sans gravats : 55/55 acceptés.
- Tests simulation + checkpoint + destruction : 166/166 sur la copie patchée.

Le joueur garde sa progression et son arsenal à la mort ou au rechargement de la page.

**Risques.** - Format de sauvegarde inchangé (rubbleVersion 1).
- La validation reste atomique (candidat puis commit). Le test 'a rejected rubble save mutated the live game' reste valide.
- Une sauvegarde forgée pourrait poser un gravat au repos dans un mur. L'effet reste visuel, borné par MAX_RUBBLE 128 et ±80 m.
- Déterminisme intact : seul le chemin de restore change.
- AGENTS.md : ajouter le test de simulation sur monde généré.
- Taille : environ −60 octets.
- Si LOAD-05 endort les morceaux coincés, le contrôle d'appui de la ligne 2080 devra accepter le même invariant.

**Vérifier par.** node bench/load/rubble-fix.mjs <ferro> bench/load/patched/rubblefix rocket l:0 12, puis walk c:3 12, walk c:9 12 et rocket c:9 8. Attendu : origOk 0–1, fixOk égal au nombre de points, fixExact au moins égal à ce nombre moins 1. restore-diff.mjs pour les écarts. node --test checks/simulation.test.mjs checks/checkpoint.test.mjs checks/destruction.test.mjs.

**Contre-vérification.** Code relu : simulation.js:2081 est bien la seule cause. Preuve indépendante (v01.mjs, domaine principal, autres murs que le premier tour pour les roquettes, 420 pas au lieu de 300) : une variante de diagnostic qui compte le chevauchement sans refuser accepte les 24 points que l'original refuse (aucune autre validation n'échoue). Le refus est fréquent mais pas systématique : l:0 roquette 6/8 acceptés chez moi contre 0/12 au premier tour. Le repli game.js:120 passe bien loadout=undefined : sur c:9 la sim par défaut donne weapons [false,false,false,false,true], ammo [0,0,0,0,1], 0 crédit (v08.mjs), donc perte de tout l'arsenal et des crédits au monde 10, puis saveCheckpoint() écrase la sauvegarde ; la copie '-before-ascension' n'est écrite qu'une seule fois (game.js:118) et aucune interface ne la restitue. Les gravats ne sont pas des colliders : supprimer la ligne ne change ni collision ni combat. Réserve : 2 points sur 31 ne sont pas identiques octet pour octet après restore avec le correctif (l:0 roquette) ; cause non isolée (probablement le retrait des balles à moins de 2,4 m par recover, simulation.js fin de restore) : le test de non-régression doit comparer avec recover:false. Le point 2 de la proposition (retenter sans gravats) dégrade l'image : à garder seulement comme dernier repli. Le point 3 (passer v.entryLoadout au repli) est sûr : restoreRun le fait déjà (game.js:107).

**Preuve corrigée.** v01.mjs : original 7/31 points acceptés (marche+tir l:0 0/8, c:9 1/8 ; roquettes l:0 6/8, c:9 0/7) ; ligne 2081 retirée : 31/31 acceptés, 29/31 identiques octet pour octet ; 1 à 6 gravats au repos en chevauchement par point refusé.

**Gain corrigé.** 7/31 → 31/31 points de reprise acceptés (premier tour : 2/55 → 55/55). Format de sauvegarde inchangé.

### LOAD-02 — refreshNav(reset) global à chaque révision de destruction : toute la grille remise en file, cache d'arêtes vidé, chemins effacés
- sévérité haute · catégorie saccade · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:1383-1391; src/simulation.js:229-235; src/simulation.js:300; src/simulation.js:316; src/simulation.js:912; src/simulation.js:1379; checks/simulation.test.mjs:1862-1871

**Preuve.** simulation.js:1383-1391 : en mode avancé, chaque révision remet toute la grille en file (1387), vide le cache d'arêtes avec « edgeKnown.fill(0);edgeOpen.fill(0) » (1389) et efface path et planWait de chaque ennemi.

updateSystems l'appelle (simulation.js:316) à chaque navDirty :
- syncDestruction (229-235) à chaque révision, même un éclat de SMG ;
- l'ouverture ou la destruction d'une porte (300, 912).

pumpNav(768) (1379) met 48 pas à vider 37 k cellules (l:0).

Une recherche A* froide qui échoue explore 2 300–2 400 nœuds et appelle segmentFree 4 000–4 400 fois (≈10 µs chacun) : pics de 42–69 ms (spikes.mjs, routes.mjs sur copie instrumentée).

La destruction ne fait que retirer du volume : boîte moins boîte donne des sous-ensembles, les portes ne font que s'ouvrir, les gravats ne sont pas des colliders. Les cellules et arêtes loin des boîtes modifiées restent donc valides.

**Cause.** Des structures paresseuses sont invalidées en bloc alors que les changements sont locaux et monotones : on ne fait qu'ouvrir de l'espace.

**Proposition.** Patch localnav (bench/load/patches.mjs) :
a) syncDestruction compare anciens et nouveaux colliders (clé des 6 bornes dans un Set) et pousse les boîtes retirées dans navDirtyBoxes. Une porte ouverte ou détruite pousse son rectangle.
b) refreshNav en mode avancé, pour chaque boîte sale : remettre en file les cellules de range(q, 0,41 m) et effacer edgeKnown/edgeOpen dans range(q, 1,25 m). Une capsule d'arête de rayon 0,4 qui touche la boîte a ses deux extrémités à moins de 0,4 + 0,8 m.
c) Garder les chemins des ennemis : ils restent valides par monotonie.
d) Repli global au-delà de N boîtes. restore garde la reconstruction complète refreshNav(false).

Variante localnavreset : n'effacer que les chemins qui croisent un rectangle sale, pour que les ennemis replanifient par la nouvelle brèche.

**Gain attendu.** Mesuré par A/B sur le même scénario bench2 (1 800 pas) :
- c:9 : segmentFree 24 478 → 10 951 (−55 %), recherches froides 5 → 2, pas au-delà de 30 ms 5 → 2, temps A* 428 → 145 ms (−66 %).
- l:0 : 15 210 → 6 111 (−60 %), pics 3 → 1.
- l:2 : 13 452 → 4 682 (−65 %), pics 3 → 1.

Roquette dans un mur : file nav en attente 48 pas → 0, soit −100 à −250 ms cumulés sur 300 pas. Point de reprise juste après une brèche : 33–35 ms → 0,75–0,93 ms.

**Risques.** - Un seul test casse (170/171 sur repo-localnav) : simulation.test.mjs:1862-1871, 'A breach changes collision immediately while a large navigation grid is refreshed in bounded batches', qui exige pending > 0. À réécrire pour vérifier l'invalidation locale : cellules autour de la brèche, bits d'arêtes effacés, collision immédiate.
- Le test de brèche à la roquette (1489, traversée en moins de 3,7 s) passe.
- Déterminisme : les trajectoires IA diffèrent de la version actuelle mais restent reproductibles.
- Format de sauvegarde inchangé : navDirtyBoxes n'est pas sauvegardé.
- Invariant à documenter : tout futur ajout de volume (porte qui se referme, débris collider) devra pousser sa boîte ou forcer le repli global.

**Vérifier par.** - SRC=bench/load/patched/localnav-instr node bench/load/routes.mjs <ferro> c:9 1800, comparé à SRC=bench/load/patched/instr (segmentFree, cold2000, astar.ms.sum).
- spikes.mjs.
- node bench/load/blast.mjs <ferro> l:0 4 300 bench/load/patched/localnav.
- save-after-blast.mjs.
- node --test checks/simulation.test.mjs sur la copie.

**Contre-vérification.** Code relu (simulation.js:1383-1391, 229-235, 300, 316). Comptages reproduits à l'identique dans le domaine principal (segmentFree 24 478 → 10 951 sur c:9, 26 recherches A* dont 18 échouées). Preuve de justesse que le premier tour n'avait pas faite (v02.mjs) : après vidage de la file, la grille nav de la variante locale est identique à une reconstruction complète (0 cellule différente sur 36 960 en c:9 et sur 37 114 en l:0 après 10 roquettes, 178 cellules réellement changées), et le cache d'arêtes ne contient aucun bit périmé de plus que l'original (0 en l:0 roquettes ; 18 dans les deux variantes en c:9). ground() ne dépend pas des solides (simulation.js:126-136), ce qui valide la monotonie. Corrections : (1) le pire pic ne bouge pas (51,8 → 47,6 ms en c:9) car il vient d'une recherche A* à froid, pas de la remise à zéro : il faut LOAD-V1 en plus. (2) L'état de simulation n'est PAS égal à la version actuelle : les ennemis ne perdent plus path/planWait à chaque révision ; c'est reproductible mais différent, à valider en jeu (variante : planWait=0 seulement pour les ennemis à moins de 12 m de la boîte modifiée). (3) Les 18 bits périmés de c:9 existent déjà dans l'original (cause non isolée, vraisemblablement les boîtes mobiles des pièges lues par blocked() dans segmentFree) ; aujourd'hui chaque révision les efface par accident, la variante locale les garderait : évaluer les arêtes mises en cache sans trapBoxes, critère d'acceptation « 0 bit périmé en fin de scénario ». (4) Le patch compare les colliders par clé texte de 6 bornes à chaque révision (≈ 445 colliders, coût faible) ; mieux : faire renvoyer par FDestruction les bornes des groupes modifiés. Un test casse (simulation.test.mjs:1862, non revérifié).

**Preuve corrigée.** v02.mjs, minimum par pas sur 3 rejeux alternés. c:9 marche 1 800 pas : total 805 → 503 ms (−38 %), A* 207 → 90 ms (−56 %), pas > 8 ms 7 → 4, pas avec file nav en attente 328 → 0, seulement 7 révisions. l:0, 10 roquettes : A* 242 → 152 ms, pas > 8 ms 42 → 31, file en attente 428 → 0 pas.

**Gain corrigé.** −38 % de temps de simulation sur le scénario de combat c:9 et −37 à −56 % de temps A* ; nombre de pas > 8 ms réduit de 25 à 45 % ; le pic maximal reste (voir LOAD-V1).

### LOAD-03 — saveCheckpoint synchrone dans la frame : snapshot() vide toute la file nav (33–35 ms après une brèche), puis stringify et localStorage
- sévérité moyenne · catégorie latence · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/game.js:94-103; src/game.js:193-237; src/simulation.js:1941-1944

**Preuve.** game.js:94-103 fait snapshot(), JSON.stringify et localStorage.setItem dans le traitement des événements de la frame.

Événements concernés (game.js:193-237) : core, mechanism, liftStop avec passager, armorPickup, bossReward, lootPickup boss ou armure, weaponPickup, shieldPickup, trophy, trophyComplete, encounterClear, bossDeath.

simulation.js:1944 « if(navPending)pumpNav(nav.length) » : après une brèche, le snapshot recalcule jusqu'à 37–44 k cellules.
- 33–35 ms (save-after-blast.mjs), contre 1,0–1,5 ms à froid.
- stringify : 0,2–0,5 ms pour 82–274 K caractères.
- setItem de 160–274 Ko : non mesuré (pas de navigateur).

**Cause.** Vider la file nav est nécessaire pour que la sim vivante et une sim restaurée, reconstruite en entier, aient la même grille. Avec l'invalidation globale (LOAD-02), cette file est énorme au moment même des sauvegardes qui suivent un combat.

**Proposition.** 1) Garder le vidage, nécessaire pour que la sim vivante et la sim restaurée restent identiques, mais le rendre petit grâce à LOAD-02.
2) Prendre le snapshot dans la frame. Vérifier qu'il ne partage aucune référence avec l'état vivant.
3) Faire stringify et setItem dans requestIdleCallback ou setTimeout(0), en fusionnant les événements d'une même frame en une seule écriture.
4) Garder une écriture synchrone de secours sur pagehide/visibilitychange.

**Gain attendu.** Mesuré avec LOAD-02 : 33–35 ms → 0,75–0,93 ms par point de reprise après une brèche. Estimé : 1 à 5 ms de moins sur la frame en différant setItem, davantage sur mobile.

**Risques.** - Une fermeture d'onglet pendant une frame peut perdre le dernier point ; pagehide couvre ce cas.
- snapshot() modifie déjà l'état vivant (pumpNav) : différer l'écriture ne doit pas déplacer ce pumpNav.
- Étendre checks/checkpoint.test.mjs à l'écriture différée et à la fusion.

**Vérifier par.** save-after-blast.mjs (original contre localnav). Dans Chrome en file://, panneau Performance : tâche longue à la prise d'un noyau juste après une roquette.

**Contre-vérification.** simulation.js:1944 relu. Mesure refaite dans le domaine principal (v03.mjs, 7 répétitions alternées) : ce chiffre-là n'était pas gonflé par le bac à sable. Le coût disparaît de lui-même avec LOAD-02 (file vide), donc le point 1 n'est pas un travail séparé. Les points de reprise liés à la fin d'un combat (encounterClear, bossDeath, game.js:228-234) tombent justement dans les 0,8 s qui suivent une explosion. Le report de stringify/setItem (points 3 et 4) rapporte peu (stringify 1,0 à 1,2 ms pour 167 K caractères ; setItem non mesuré faute de navigateur) et ajoute un risque de perte du dernier point : P2, seulement après mesure dans Chrome.

**Preuve corrigée.** snapshot() juste après une brèche, 36 192 à 36 346 cellules en attente : minimum 28,3 à 29,6 ms (médiane 69 à 82 ms sous charge) contre 2,0 à 2,5 ms à froid ; avec l'invalidation locale : 2,0 à 2,8 ms.

**Gain corrigé.** ≈ −26 ms sur la frame d'un point de reprise pris dans les 0,8 s après une destruction, obtenu par LOAD-02 sans autre changement.

### LOAD-04 — A* : recherches échouées répétées et cache d'arêtes à sens unique (pics de 42–69 ms)
- sévérité haute · catégorie ia · effort M · gain estimé
- contre-vérification : **réfuté**, priorité P3 · qualité identique · jeu
- lieux : src/simulation.js:1402-1433; src/simulation.js:1348; src/simulation.js:1349-1376; src/simulation.js:740; src/simulation.js:1742

**Preuve.** simulation.js:1402-1433 :
- plafond de 2 400 nœuds explorés (1414) ;
- cache d'arête dans le seul sens i→j (1420) ;
- un tableau neighbors par nœud (1416) et deux tableaux coord() étalés par arête ;
- tas de paires [i,cost] (1410-1411) ;
- les ennemis de rayon supérieur à 0,4 (type 3 : 1,05 ; géants : 1,5 × échelle, radius ligne 1348) refont un segmentFree non mis en cache à chaque arête (1421) ;
- le lissage du chemin appelle jusqu'à 14 segmentFree par point (1430).

routes.mjs (1 800 pas, scénario bench2) :
- c:9 : 26 recherches A*, dont 18 échouées (69 %) et 5 froides (plus de 2 000 segmentFree), 279–428 ms cumulés ;
- c:5 : 8/8 échouées ;
- l:2 : 8/8 échouées, 280 ms.

Une recherche échouée explore tout le plafond.

**Cause.** Un but inaccessible (corniche, autre côté d'une porte) est retenté à chaque planWait (0,4–2,4 s), avec le même résultat. Le cache est vidé globalement (LOAD-02) et ne sert qu'un sens d'arête.

**Proposition.** 1) Cache négatif. Quand une recherche vide le tas avant le plafond, marquer les nœuds fermés comme inaccessibles depuis end pour la révision nav courante. Une recherche suivante vers le même end depuis l'un de ces nœuds échoue alors en O(1), jusqu'au prochain changement de nav ou à la prochaine ouverture de porte. Si le plafond est atteint, mémoriser (cellule de départ, end, révision) pendant 1–2 s.
2) Cache symétrique : poser aussi le bit k^1 sur j. segmentFree est symétrique aux arrondis près : mêmes appels blocked aux deux bouts, même filtre de boîtes, intervalles [lo,hi] ↔ [1−hi,1−lo], mêmes paires d'échantillons de sol.
3) Tas binaire en Int32Array/Float64Array réutilisés et coordonnées de cellules précalculées (voir LOAD-11).

À coordonner avec l'axe IA.

**Gain attendu.** Estimé :
- le cache négatif supprime la plupart des échecs répétés (18 des 26 recherches de c:9), soit −50 à −70 % du temps A* en plus de LOAD-02 ;
- le cache symétrique retire 20 à 40 % des segmentFree froids, seulement d'une recherche à l'autre puisque A* saute déjà les nœuds fermés.

Qualitatif : moins de pics de 40–70 ms en combat.

**Risques.** - Déterminisme : le cache symétrique peut changer un résultat à l'arrondi près. Les chemins diffèrent alors de la version actuelle, tout en restant reproductibles.
- Le cache négatif doit être invalidé à chaque changement de nav (compteur de révision) et à chaque ouverture de porte.
- Tests IA : checks/brain.test.mjs, poursuite et brèche dans simulation.test.mjs.
- Non mesuré : le surcoût des ennemis de rayon supérieur à 0,4. Le compteur instrBig est resté à 0 dans mes scénarios (un seul ennemi de type 3 par monde).

**Vérifier par.** SRC=bench/load/patched/instrBig node bench/load/routes.mjs <ferro> c:9 1800 : comparer astar.failed, cold2000, sfAstar et astarSumMs avant et après. spikes.mjs : nombre de pas au-delà de 30 ms.

**Contre-vérification.** Les faits sont exacts (taux d'échec reproduit : c:9 18/26, c:5 8/8, l:2 8/8, l:0 35/41 ; code 1402-1433 relu) mais la cause et le gain sont faux. v04.mjs : une recherche échouée répétée avec la même clé (départ, arrivée, révision) fait 0 appel à segmentFree, car le cache d'arêtes la sert déjà ; elle coûte 0,6 à 1,5 ms contre 30 à 150 ms pour la recherche à froid. Les répétitions pèsent 1 à 6 % du temps A* (3,4 ms sur 447 en c:9, 8,9 sur 221 en c:5, 3,1 sur 203 en l:2, 15,9 sur 262 en l:0) : le cache négatif ne peut pas donner −50 à −70 %. Le coût est celui de la première exploration (2 300 à 2 400 nœuds, composante entière ou plafond) avec un cache vide. Cache symétrique (v08.mjs) : segmentFree est bien symétrique (0 arête asymétrique sur 62 953 en l:0 et 62 723 en c:9) et l'état final après 1 800 pas est égal, mais le gain n'est que −8 à −10 % d'appels (24 478 → 22 548, 15 210 → 13 760), pas −20 à −40 %. À garder : le cache symétrique (une ligne, état identique, P2) et le tas typé (voir LOAD-11). Le vrai remède aux pics est LOAD-V1. Recoupe l'axe IA (bench/ia/proto.mjs).

**Preuve corrigée.** Échecs au plafond de 2 400 nœuds : c:9 7/18, c:5 8/8, l:2 8/8, l:0 0/35 (les autres vident la composante de ≈ 2 300 cellules). Répétitions à clé identique : 5, 6, 5 et 16, toutes à 0 segmentFree.

**Gain corrigé.** Cache négatif : −1 à −6 % du temps A* (mesuré). Cache symétrique : −8 à −10 % d'appels segmentFree à état égal (mesuré).

### LOAD-05 — Gravats : 128 morceaux au repos coûtent 0,9–2,1 ms par pas, et des morceaux coincés ne s'endorment jamais
- sévérité haute · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/simulation.js:1028-1065; src/simulation.js:992-1003; src/simulation.js:64-68

**Preuve.** simulation.js:1028-1065 updateDebris, pour chaque morceau et à chaque pas, même au repos (1034) :
- debrisBoxes (995-998 : new Set(dynamic), seaux, Array.from, filter) ;
- debrisSupport (1001) ;
- debrisFloor, soit 5 appels à ground (992-993).
Le tableau dynamic est reconstruit à chaque pas (1029).

debris-sleep.mjs (copie instr2, médianes de 3 blocs alternés de 600 pas) :
- l:0, 128 gravats : updateDebris 1,71 ms sur un pas de 2,64 ms (65 %). Sans les 8 morceaux jamais au repos : 0,93 ms. Ces 8 seuls : 1,00 ms, soit ≈0,12 ms par morceau contre ≈0,008 ms par morceau au repos.
- l:1 : 2,56 ms, dont 2,08 ms pour les 125 au repos et 0,38 ms pour 3 morceaux jamais au repos.

rubble.mjs : 1,51 ms/pas au repos (86 % d'un pas inactif), 1,4–5 ms/pas pendant la chute.

Morceaux encore éveillés après 70 s : 8/128 (l:0) et 3/128 (l:1). Vitesses de 0 à 10,9 m/s, settleTime 0. Ils sont coincés : par exemple un cylindre de 14,07 m à l'horizontale, une plaque de 4,47 × 2,25 × 0,02 m.

Les forcer au repos ne tient pas : ils se réveillent au pas suivant, faute d'appui sur une face supérieure (1034, 1001-1003).

**Cause.** Aucun sommeil par groupe : les morceaux au repos sont revalidés à chaque pas, alors que leurs appuis ne changent qu'avec une révision de destruction, une porte, un ascenseur ou un piège. Un morceau calé par les côtés n'a jamais d'appui au sens de debrisSupport et reste simulé indéfiniment.

**Proposition.** 1) Morceaux au repos : les sauter tant que supportRevision n'a pas changé. Ce compteur s'incrémente avec destructionRevision, la progression des portes et l'état des pièges. Un morceau posé sur un ascenseur, une porte ou un piège est marqué dynamicSupport et revérifié à chaque pas. À une révision, ne revérifier que les morceaux dont l'AABB touche une boîte changée (navDirtyBoxes de LOAD-02).
2) Sommeil des morceaux coincés : si |v| < 0,25 m/s (ou déplacement < 2 mm sur 0,5 s) pendant 1 s, ou après plus de 6 s éveillé, passer à resting avec wedged=true. L'appui n'est plus exigé tant qu'aucune révision ne survient.
3) debrisBoxes : tableau de travail réutilisé et marqueur par boîte au lieu de Set et Array.from ; liste dynamic calculée une fois par pas.
4) debrisFloor : un seul parcours de seau au lieu de 5 appels à ground().

**Gain attendu.** Borne mesurée :
- retirer les morceaux jamais au repos fait gagner 0,38–1,0 ms/pas (−22 à −58 % d'updateDebris) ;
- le lot au repos coûte 0,93–2,08 ms/pas, qui tombent à presque rien s'il est sauté.

Estimé : −1,5 à −2,5 ms par pas avec 128 gravats sur ce Mac chargé, et 3 à 5 fois plus sur mobile.

**Risques.** - Changer le passage au repos change l'allure des gravats et le sens de resting dans la sauvegarde.
- Le validateur (simulation.js:2078-2082) doit accepter les morceaux wedged, sinon le contrôle d'appui de la ligne 2080 échoue.
- Un nouveau champ casse le compte de champs (2071) : passer à rubbleVersion 2 en acceptant la v1.
- Déterminisme conservé, aucun aléa. Les tests de gravats (simulation.test.mjs:1927-1946) comparent vivant et restauré avec le même code.
- Visuel : un morceau peut se figer en pleine glissade si le seuil est trop haut.

**Vérifier par.** - SRC=bench/load/patched/instr2 node bench/load/debris-sleep.mjs <ferro> l:0 8 (all, withoutNeverResting, onlyNeverResting).
- rubble.mjs : debrisMsPerStep au repos.
- Nouveau test : un morceau coincé s'endort en moins de 2 s et la sauvegarde se restaure.

**Contre-vérification.** Code relu (simulation.js:992-1003, 1028-1065). Mesure refaite hors bac à sable (v05.mjs) : les chiffres absolus du premier tour étaient gonflés d'environ 1,6 à 2,4 fois, mais la proportion tient (les gravats multiplient le pas inactif par 3 à 9). Morceaux jamais au repos confirmés : 8/128 en l:0, 5/121 en l:1 (autres murs). J'ai prototypé le point 1 et prouvé l'égalité d'état (v05b.mjs, 3 lignes) : sauter un morceau au repos tant que destructionRevision n'a pas changé, sauf s'il touche la zone d'une porte, d'un ascenseur ou d'un piège ; 0 différence sur 65 comparaisons de snapshot en lockstep (l:0, l:1, c:9 ; 16 roquettes puis 1 800 pas de marche et tir). Correction importante de la proposition : un supportRevision GLOBAL incluant « l'état des pièges » ne marche pas, car les pièges à lame et à presse bougent en continu (simulation.js:1856-1862) : mon premier prototype à clé globale donnait −6 % (aucun saut) en l:0. Il faut un drapeau par morceau basé sur des zones fixes en XZ. Le point 2 (sommeil des morceaux coincés) n'est PAS à état égal : il change l'allure des gravats et exige que le validateur de restore (ligne 2080) accepte un morceau sans appui, donc un changement de format (rubbleVersion 2 lisant la v1) : à traiter à part, P2, qualité « visuellement identique » à démontrer. Points 3 et 4 (tableaux réutilisés, un seul parcours de sol) : sûrs, non mesurés.

**Preuve corrigée.** v05.mjs, minima de 6 blocs de 200 pas : updateDebris 1,09 ms/pas sur un pas de 1,67 ms avec 128 gravats (l:0), 1,08 sur 1,48 (l:1) ; pas sans gravats 0,16 à 0,44 ms ; morceaux au repos seuls 0,61 à 0,80 ms ; morceaux jamais au repos seuls 0,11 à 0,29 ms.

**Gain corrigé.** Prototype à état identique : pas inactif avec 128 gravats 1,21 → 0,70 ms (l:0, −43 %), 1,00 → 0,65 ms (c:9, −36 %), 0,47 → 0,22 ms (l:1, −54 %). Reste le coût des 5 à 12 morceaux coincés (0,11 à 0,29 ms/pas) tant que le point 2 n'est pas fait.

### LOAD-06 — FWorld.create : recherches quadratiques (demolitionMetadata, reinforcementBays, openEntries), −43 à −73 % à sortie identique
- sévérité haute · catégorie chargement · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/world.js:1340-1389; src/world.js:1373; src/world.js:1419-1446; src/world.js:1447-1470

**Preuve.** Trois fonctions dominent la génération (gen-profile.mjs) :
- world.js:1340 demolitionMetadata : pour chaque maillage, map(distance) puis sort sur les groupes ; nearest (1373) en filter + map + sort.
- world.js:1419 reinforcementBays : choose (1422) reconstruit des masques de pièce entière (base.map) ; nearest (1430) parcourt toute la pièce.
- world.js:1447 openEntries : covers (1454) en for..of sur tableaux littéraux ; maskFor (1457) filtre tous les colliders à chaque sonde.

gen-ab.mjs (original et patché alternés, 4 répétitions, médianes, forte charge) :
- c:0 824 → 466 ms (−43 %)
- c:5 1 101 → 507 ms (−54 %)
- c:9 1 142 → 452 ms (−60 %)
- c:17 2 735 → 736 ms (−73 %)
- l:0 838 → 384 ms (−54 %)
Lors d'exécutions moins chargées : −60 à −71 %.

gen-identity.mjs : 46/46 mondes identiques octet pour octet (FNV du JSON ; 2 graines × 18 mondes campagne v2, 3 historiques, 4 campagne v1). checks/world.test.mjs PASS sur la copie repo-wg3.

**Cause.** La recherche du plus proche passe par un tri complet, et les masques sont recalculés sur toute la pièce pour chaque candidat. Le coût est en O(n·m) ou O(n·m·log m) là où une grille spatiale suffit.

**Proposition.** Patch worldgen3 (bench/load/patches.mjs) :
- grille 2D de 4 m (clé x*65536+z) des groupes, avec leur ordre ;
- candidats filtrés par distance exacte, avec le même départage (ordre) ;
- nearest en minimum linéaire ;
- choose : grille de base par pièce, tracée boîte par boîte avec nearBox exact dans une fenêtre ; masque = base.slice(), puis effacement dans une fenêtre ;
- nearest(p,mask) limité à ±0,6 m ;
- covers déroulé ;
- maskFor avec les bornes sorties de la boucle et une boucle simple.

**Gain attendu.** Mesuré : −43 à −73 % de FWorld.create selon le monde et la charge, soit −110 à −170 ms sur la référence de 180–240 ms, à sortie identique.

**Risques.** - La géométrie du monde sert d'empreinte aux sauvegardes. L'identité est vérifiée sur 46 mondes, pas sur toutes les graines : ajouter un test de digest sur N graines (par exemple 8 × 18) qui compare ancien et nouveau code pendant la transition, et garder exactement le départage.
- Préalable : checks/campaign-world.test.mjs échoue déjà à 8/46 sur main 673d6b2 sous Node 24.18 (empreintes historiques ; mêmes échecs avec le patch). Ces échecs masqueraient une régression : à corriger d'abord.
- Taille ≈ +1,5 Ko, budget large.

**Vérifier par.** - node bench/load/gen-ab.mjs <ferro> bench/load/patched/worldgen3 c:0 c:5 c:9 c:17 l:0 : identical:true et gain.
- gen-identity.mjs.
- node checks/world.test.mjs.
- node --test checks/campaign-world.test.mjs : les mêmes 8 échecs qu'avant, pas plus.

**Contre-vérification.** Patch worldgen3 réappliqué par moi sur la source d'origine (pas la copie du premier tour) et chargé dans le domaine principal. Identité confirmée sur des graines que le premier tour n'avait pas testées : 22/22 mondes identiques (FNV du JSON complet ; graines 7 et 31337 ; campagne v2 0, 3, 5, 9, 13, 17 ; historiques 0 à 2 ; campagne v1 0 et 3). Le gain est réel mais surestimé : le bac à sable gonflait les fonctions quadratiques. Le monde sert d'empreinte aux sauvegardes : le test de digest sur N graines proposé est indispensable avant fusion. Préalable signalé (8/46 échecs de campaign-world.test.mjs sur main) non revérifié. world.js est propre à METAL ; la technique (grille spatiale au lieu de tri complet) peut servir à BITUME et Point de rupture mais pas le code.

**Preuve corrigée.** v06b.mjs, 7 répétitions alternées, graine 96, minimum d'horloge : c:0 201 → 132 ms, c:9 198 → 108, c:17 248 → 157, l:0 177 → 89 ; temps CPU minimal du processus : −34 à −52 %.

**Gain corrigé.** −34 à −50 % de FWorld.create dans le domaine principal (premier tour : −43 à −73 % sous vm), soit −70 à −100 ms par monde, sortie identique.

### LOAD-07 — Création et reprise : deux contrôleurs de destruction et deux grilles nav complètes par reprise, aucun cache par monde
- sévérité moyenne · catégorie chargement · effort L · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité identique · jeu
- lieux : src/destruction.js:120-137; src/simulation.js:512-516; src/simulation.js:236-237; src/simulation.js:2020; src/simulation.js:2215; src/game.js:31

**Preuve.** FSimulation.create prend 122–175 ms (gen-time.mjs), dont :
- FDestruction.create, 35–66 ms (destruction.js:120). entries (ligne 125) calcule bornes et rotation de chaque maillage, la rotation deux fois. La signature (ligne 135) passe toutes les définitions dans JSON.stringify puis FNV.
- l'initialisation de la nav (simulation.js:512-516) : 37–44 k cellules × blocked(ground), avec un tableau coord() par cellule.
- l'empreinte (simulation.js:236-237) : JSON de l'identité du monde puis FNV, 5–8 ms.

restore (simulation.js:1960) recrée un contrôleur candidat avec FDestruction.create(world) (2020) et reconstruit toute la nav avec refreshNav(false) (2215).
- Point frais : 88–133 ms.
- Point lourd c:3 de 127 K caractères : 290 ms sous profileur, dont refreshNav 142 ms (49 % ; ground 72 ms en propre, blocked 28 ms) et FDestruction.create 124 ms (43 % ; entries 73 ms).

Une reprise coûte donc create (≈150 ms) plus restore (≈100–290 ms). game.js:31 cachedWorld garde déjà 2 mondes.

**Cause.** Des données qui ne dépendent que du monde, immuable une fois généré, sont recalculées à chaque création de sim et à chaque restore.

**Proposition.** Caches par monde dans une WeakMap dont la clé est l'objet monde :
a) entries (bornes et rotation des maillages d'origine) et signature de destruction ;
b) empreinte du monde ;
c) nav statique (Uint8Array) et sol statique (Float32Array, sans pièges ni portes), calculés une fois. La sim les copie (nav.set) puis ne réévalue que les cellules touchées par les portes, les pièges et les boîtes détruites (états de destruction du point).
d) restore : séparer FDestruction en validate(snapshot) pur, sans reconstruire les maillages, et commit, au lieu de créer un second contrôleur.
e) Mort puis reprise sur le même monde : réutiliser la sim existante (voir LOAD-08).

**Gain attendu.** Estimé d'après les profils :
- seconde création sur un monde en cache : −35 à −66 ms (entries) et −5 à −8 ms (empreinte) ;
- restore : −50 à −120 ms (plus de contrôleur candidat) et −40 à −140 ms (nav copiée puis réévaluée localement) ;
- au total, une reprise environ 2 fois plus rapide (−100 à −250 ms dans la même tâche).

**Risques.** - Invalider les caches si un monde est modifié : vérifier que destruction ne touche pas world.meshes (Object.freeze en test).
- Mémoire : nav statique de 37–44 k × 5 octets ≈ 0,2 Mo par monde en cache (2 mondes).
- Atomicité : validate doit tout vérifier avant la moindre mutation (test 'a rejected rubble save mutated the live game', simulation.test.mjs:1940).
- Les tests d'empreinte de checkpoint restent la référence.

**Vérifier par.** - gen-time.mjs : simCreateMs et restoreMs à la seconde création.
- gen-profile.mjs <ferro> c:9 restore.
- restore-diff.mjs : profil d'un point lourd.
- node --test checks/checkpoint.test.mjs checks/simulation.test.mjs.

**Contre-vérification.** Code relu et exact : restore crée un second contrôleur (simulation.js:2020) et reconstruit toute la nav par refreshNav(false) en fin de restore ; FDestruction.create recalcule entries et la signature (destruction.js:125, 135). Structure de coût confirmée par mes temps (v10.mjs) : restore coûte autant ou plus que la création de la sim. Les gains restent des estimations de profil sous vm, non prototypées. Faisabilité : ground() est indépendant des solides (commentaire et code simulation.js:121-136), donc une nav statique par monde est valide ; la réévaluation locale au restore réutilise le mécanisme de LOAD-02 (boîtes détruites et portes ouvertes). Risque réel : les objets entries sont réutilisés comme g.active (destruction.js:128) : un cache partagé entre deux contrôleurs impose de vérifier qu'aucun champ n'y est écrit. À faire après LOAD-02 et LOAD-V1, qui changent déjà la nav.

**Preuve corrigée.** Minima sur 6 répétitions, machine chargée : FDestruction.create 23 à 44 ms, FSimulation.create 59 à 128 ms, restore d'un point de 143 à 145 K caractères 69 à 161 ms.

**Gain corrigé.** Non mesuré. Borne haute plausible : −23 à −44 ms (second contrôleur) et ≈ −28 ms (nav complète, d'après LOAD-03) par reprise.

### LOAD-08 — Chargement en une seule tâche de 300–450 ms (génération, simulation, rendu), retour au menu synchrone
- sévérité moyenne · catégorie latence · effort L · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité identique · jeu
- lieux : src/game.js:166-177; src/game.js:133-151; src/game.js:105-123; src/game.js:760-761; src/game.js:190

**Preuve.** game.js:166-177 preparePlay :
- deux rAF, puis FMusic.warmup, brain.prepare et audio.prepare, qui sont découpés ;
- un rAF ;
- puis action() en synchrone : load() puis saveCheckpoint ou restore.

load() (game.js:133-151) enchaîne :
- cachedWorld → FWorld.create, 222–413 ms si le monde n'est pas en cache ;
- FSimulation.create, 122–175 ms ;
- renderer.setWorld, 11–16 ms de CPU avec le GL factice (envois GPU non mesurés).

Mort puis « Reprendre » : resumeSaved → restoreRun → load() + restore (88–290 ms) dans la même tâche, plus un second load() en cas de refus (LOAD-01).

game.js:760-761 : back-menu et pause-main appellent load(0) en synchrone, sans écran de chargement.

game.js:190 : le monde suivant est pré-généré sur l'écran « cleared » en une seule tâche, ce qui fige l'interface 0,2–0,4 s.

**Cause.** Le découpage en tâches s'arrête juste avant le travail le plus lourd, et rien n'est généré hors du fil principal.

**Proposition.** 1) Découper action() en étapes séparées par await nextFrame() : cachedWorld, FSimulation.create, setWorld, restore. Faire avancer la barre de 76 % à 100 %.
2) Générer le monde dans un Web Worker créé depuis une Blob URL du texte de world.js, déjà présent dans le HTML unique : aucun fichier externe, aucun CDN. FWorld.create est pur (graine, étape, options). Le monde revient par clone structuré ; repli sur le fil principal sans Worker.
3) Mort puis reprise sur le même monde : sauter load(), appeler sim.restore(checkpoint) sur la sim courante, puis renderer.updateWorld.
4) back-menu et pause-main : afficher le menu tout de suite et laisser preparePlay charger au lancement.

**Gain attendu.** Estimé :
- plus longue tâche au lancement : de ≈300–450 ms à ≈120–175 ms avec le découpage, sous 60 ms avec le Worker et les caches de LOAD-07 ;
- mort puis reprise : de ≈250–450 ms à ≈100 ms.

Qualitatif : la barre avance et le menu ne se fige plus.

**Risques.** - Clone structuré : le monde doit être un pur objet de données. Vérifier JSON.stringify(structuredClone(world)) === JSON.stringify(world). Le clone de 4,1–5,3 Mo de JSON coûterait environ 20–50 ms sur le fil principal (estimé).
- Même moteur et même code : déterminisme conservé.
- Mémoire mobile : copie transitoire d'environ 2 × 5 Mo.
- Budget : Blob créé depuis le script inline, ≈ +0,5 Ko, aucun asset importé (AGENTS.md respecté).
- Tests node de progression et de checkpoint inchangés.

**Vérifier par.** Dans Chrome en file://, panneau Performance : tâches longues au lancement, à la reprise et au retour au menu. gen-time.mjs pour les étapes. Un test de clonabilité du monde.

**Contre-vérification.** Code relu et exact : action() part en synchrone après un seul rAF (game.js:166-177), back-menu et pause-main appellent load(0) sans écran (game.js:759-760), le monde suivant est généré d'un bloc sur l'écran « cleared » (game.js:190). Le découpage en étapes (point 1), la reprise sans load() sur le même monde (point 3) et le menu immédiat (point 4) sont sûrs et faciles : c'est la partie à faire, et elle devient prioritaire pour la démo longue demandée par David, qui enchaînera les mondes. En revanche le Worker (point 2) est réfuté tel que chiffré : le clone structuré du monde coûte 99 à 289 ms (v08.mjs, minimum de 5, 4,1 Mo de JSON, ≈ 14 000 maillages), soit autant que la génération corrigée par LOAD-06 (89 à 157 ms) ; la moitié réception retomberait sur le fil principal. L'estimation « 20 à 50 ms » et l'objectif « sous 60 ms » ne tiennent pas sans format compact transférable (tableaux typés), ce qui est un chantier XL. Le monde est bien de la donnée pure (JSON du clone égal).

**Preuve corrigée.** structuredClone(world) : 98,8 ms (c:9) à 289 ms (l:0, sous charge) ; FWorld.create 177 à 248 ms ; FSimulation.create 59 à 128 ms.

**Gain corrigé.** Découpage seul : plus longue tâche ramenée à la plus longue étape, soit ≈ 180 à 250 ms (FWorld.create), ou ≈ 90 à 160 ms avec LOAD-06. Le Worker n'apporte rien de sûr sans format compact.

### LOAD-09 — renderer.updateWorld reconstruit tout l'index spatial et vide les 4 caches statiques à chaque révision
- sévérité moyenne · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité visuellement identique · moteur et jeu
- lieux : src/renderer.js:1373-1382; src/renderer.js:768-797; src/renderer.js:1408-1420; src/renderer.js:961; src/game.js:152-156

**Preuve.** renderer.js:1373-1382 : à chaque révision, spatialIndex (768) est reconstruit pour 13,8–17,4 k maillages, avec des clés texte x+','+z qui servent aussi à la requête de chaque frame (779). Tous les staticCaches et lampCasters sont vidés (1379).

game.js:152-156 l'appelle à chaque révision, éclats de SMG compris.

blast.mjs avec le GL factice : 3,3–5,4 ms par révision et 200–244 Ko renvoyés par bufferData.

**Cause.** updateWorld ne reçoit que la nouvelle liste de maillages, sans savoir quels groupes ont changé.

**Proposition.** - Passer les indices des maillages changés : destruction connaît les groupes reconstruits.
- Mettre à jour l'index en retirant puis réinsérant ces seules entrées, avec des clés numériques (ix*65536+iz) dans une Map ou une grille Int32 plate.
- N'invalider que les caches statiques dont les cellules touchent les maillages changés, et ne renvoyer que ce lot (bufferSubData quand la taille le permet).
- Même logique dans le repli Canvas 2D (961).

**Gain attendu.** Estimé : −3 à −5 ms et −150 à −240 Ko d'envoi par révision. La requête de chaque frame serait aussi moins chère avec des clés numériques (non mesuré).

**Risques.** checks/renderer-destruction.test.mjs et le repli Canvas 2D doivent suivre. Une invalidation trop étroite laisse un lampCaster périmé, donc un éclairage faux.

**Vérifier par.** blast.mjs avec stubCanvas, avant et après : ms d'updateWorld et octets envoyés. node --test checks/renderer-destruction.test.mjs.

**Contre-vérification.** Code relu : updateWorld reconstruit l'index avec des clés texte et vide les quatre caches statiques et lampCasters à chaque révision (renderer.js:1373-1380, 768-775). Nuance omise : les métadonnées et les lignes d'instance des maillages conservés sont déjà réutilisées (retained, renderer.js:773). Le constat sous-estime l'effet : le coût principal n'est pas dans updateWorld mais dans le draw() suivant, qui repeuple les caches vidés ; l'axe RCPU l'a mesuré à 24 à 31 ms par révision (leçon 2 du premier tour), ce que je n'ai pas remesuré. Combiné à LOAD-10, une roquette coûte donc une frame de 35 à 55 ms. Compatibilité FERRO : ajouter un 4e paramètre facultatif (indices ou bornes modifiés) à updateWorld ; sans lui, comportement actuel, donc BITUME et Point de rupture ne cassent pas. Risque d'image : une invalidation trop étroite laisse une ombre de mur détruit ; exiger une différence d'images nulle entre invalidation locale et globale sur 20 révisions. Le chiffre 3,3 à 5,4 ms venait du bac à sable vm.

**Preuve corrigée.** Non remesuré par moi ; référence croisée RCPU : 24 à 31 ms par révision côté rendu.

**Gain corrigé.** Estimé : l'essentiel des 24 à 31 ms par révision mesurés par RCPU, pas seulement −3 à −5 ms.

### LOAD-10 — Explosion : destruction.rebuild parcourt tous les maillages et rebuildCollision refait tout, d'où un pas de 5–14 ms
- sévérité moyenne · catégorie saccade · effort M · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité identique · jeu
- lieux : src/destruction.js:160-179; src/destruction.js:138; src/simulation.js:220-235

**Preuve.** destruction.js:160-179 : rebuild parcourt tous les maillages d'origine et recrée tous les objets colliders. simulation.js:220-227 : rebuildCollision reconstruit tous les seaux, via syncDestruction (229-235).

blast.mjs : le pas de l'explosion prend 5–14 ms, contre 0,2–1 ms pour le témoin. Le témoin tire le même coup avec destruction.blast neutralisé : même explosion, même alerte, mêmes dégâts aux acteurs.

**Cause.** Tout est reconstruit alors qu'une explosion ne touche que quelques groupes.

**Proposition.** - Ne reconstruire que les groupes dont l'état a changé (diff des états).
- Garder l'identité des colliders inchangés.
- Mettre à jour les seaux de collision en retirant puis insérant les seules boîtes des groupes changés.
- compile par groupe (destruction.js:138) existe déjà : ne l'appeler que pour les groupes modifiés.

**Gain attendu.** Estimé : −4 à −12 ms sur le pas d'explosion, soit l'écart mesuré avec le témoin moins le coût des effets.

**Risques.** L'identité des colliders sert aux caches (diff de LOAD-02, rendu) : à conserver. destruction.snapshot et restore ne changent pas. checks/destruction.test.mjs.

**Vérifier par.** blast.mjs et blast-profile.mjs : ms du pas d'explosion comparées au témoin.

**Contre-vérification.** La saccade est confirmée et plus forte qu'annoncé, mais la cause est mal répartie (v10.mjs, v10b.mjs, minima sur 6 rejeux, 7 murs). rebuildCollision est négligeable (≈ 445 colliders seulement) : cette partie de la proposition ne rapporte rien. La compilation par groupe modifié existe déjà (cache destruction.js:164) : le dernier point de la proposition est déjà implémenté. Ce qui reste vrai : rebuild() reparcourt les ≈ 14 000 maillages d'origine et recrée tous les objets colliders (destruction.js:171-177), ce qui casse aussi leur identité (d'où les clés texte du patch LOAD-02). Le reste du pas est dans damage() hors rebuild (soustractions de boîtes, removedGeometry, fallingDebris) et dans le premier updateDebris des 48 morceaux nés dans la géométrie (4 passes de dépénétration chacun) : non profilé plus finement, à profiler avant de coder.

**Preuve corrigée.** Pas de l'explosion : 11 à 25 ms contre 0,2 à 0,6 ms au pas précédent. Dans ce pas : destruction.damage 6,5 à 15,4 ms, dont rebuild 3,7 à 5,6 ms ; updateDebris 1,8 à 3,3 ms ; rebuildCollision 0,12 à 0,21 ms ; unsupportedBodies 0,05 ms ; route 0 ms.

**Gain corrigé.** Borne prouvable de la proposition : −3,7 à −5,6 ms (rebuild incrémental), pas −4 à −12 ms. Le reste (3 à 10 ms dans damage, 2 à 3 ms de gravats) demande un autre correctif.

### LOAD-11 — 0,74–0,97 Mo alloués par pas, soit 40 à 93 GC par minute (pas de fuite)
- sévérité moyenne · catégorie mémoire · effort M · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité identique · jeu
- lieux : src/simulation.js:514; src/simulation.js:1380; src/simulation.js:1388; src/simulation.js:1410-1421; src/simulation.js:995-998; src/simulation.js:1361

**Preuve.** alloc.mjs (HeapProfiler en échantillonnage, objets collectés par GC mineur et majeur inclus) : 744–971 Ko alloués par pas.

Sources principales :
- ground, blocked et ray renvoient des doubles mis en boîte (HeapNumber) ;
- coord(i) (simulation.js:514), utilisé par pumpNav (1380), refreshNav (1388) et route (1420-1421, avec étalement) ;
- paires [i,cost] du tas et tableau neighbors d'A* (1410-1416) ;
- Set, Array.from et filter de debrisBoxes (995-998) ;
- for..of sur tableaux littéraux dans segmentFree (1361).

memory.mjs, 18 000 pas :
- 39,6 GC/min (l:0), 74,6 (c:9), 92,8 (l:0 avec une roquette toutes les 10 s) ;
- 172–436 GC mineurs en 5 min ;
- tas échantillonné en dents de scie de 27 à 110 Mo, sans tendance ;
- tableaux bornés : gravats ≤ 128, particules ≤ 22, balles ≤ 5, états de destruction ≤ 91.

Pause maximale : 1,7 ms à faible charge, 20–40 ms sous forte charge (gonflée par l'ordonnancement).

**Cause.** Les boucles chaudes créent de petits objets temporaires : tableaux de coordonnées, paires du tas, Set, nombres mis en boîte.

**Proposition.** - Remplacer coord() par des Float32Array cellX/cellZ précalculés, ou par un calcul en ligne.
- Tas binaire typé réutilisé : Int32Array pour les nœuds, Float64Array pour les clés, capacité 2 400 × 4.
- Tester les voisins en ligne.
- Tableau de travail et marqueur pour debrisBoxes.
- Dans segmentFree, deux blocs déroulés au lieu de [[ax,dx,…],[az,dz,…]].
- Garder l'ordre exact des opérations.

**Gain attendu.** Estimé : −50 à −80 % d'octets alloués par pas, soit environ 10 à 20 GC par minute. Qualitatif : moins d'à-coups dus au GC sur mobile.

**Risques.** Faible : l'arithmétique reste identique si l'ordre des opérations est gardé, donc le déterminisme est conservé. Tests inchangés.

**Vérifier par.** node --expose-gc bench/load/alloc.mjs (Ko par pas) et memory.mjs (gcPerMinute), avant et après.

**Contre-vérification.** Sites d'allocation relus et exacts : coord() renvoie un tableau (simulation.js:514), tas de paires et tableau neighbors par nœud (1410-1416), Set + Array.from + filter par morceau et par pas dans debrisBoxes (995-998), tableaux littéraux dans segmentFree (1361). Je n'ai pas remesuré l'allocation ; l'axe SIM donne 534 à 864 Ko par pas dans le domaine principal, proche des 744 à 971 Ko annoncés. L'affirmation sur les nombres mis en boîte (HeapNumber) n'est pas démontrée et dépend de l'optimiseur. Aucune fuite : cohérent avec les bornes du code. Une bonne part disparaît avec LOAD-05 (debrisBoxes sauté pour les morceaux au repos) et LOAD-V1 (plus de recherches à froid). Doublon partiel avec l'axe SIM : à fusionner dans le prompt maître.

**Preuve corrigée.** Référence croisée : 534 à 864 Ko alloués par pas (axe SIM, domaine principal).

**Gain corrigé.** Non mesuré ; l'estimation −50 à −80 % reste une hypothèse.

### LOAD-12 — Désoptimisations V8 : segmentFree sort de l'OSR 500–800 fois par recherche lourde, « wrong call target » après chaque FSimulation.create
- sévérité basse · catégorie perf-cpu · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité sans objet · jeu
- lieux : src/simulation.js:1349-1376; src/simulation.js:85

**Preuve.** deopt-steps.mjs avec --trace-deopt (deopt-l0.log, deopt-c9.log, deopt-attr.cjs) :
- 500–800 désoptimisations Maglev « exit from OSR'd inner loop » sur segmentFree pendant la première recherche lourde, qui coïncide avec le premier pic ;
- « wrong call target », parce que FSimulation.create recrée à chaque sim les fermetures ground, blocked, segmentFree, etc. Après une reprise, le code optimisé de la sim précédente est jeté.

**Cause.** Boucles internes sur tableaux littéraux, et fonctions chaudes recréées comme fermetures à chaque sim.

**Proposition.** - Aplatir les boucles de segmentFree : blocs X et Z déroulés.
- Sortir de create les fonctions pures les plus chaudes, avec l'état passé en paramètre, ou réutiliser une seule sim par monde (LOAD-08, point 3).
- Pendant l'écran de chargement, lancer une route factice pour que l'optimisation V8 ne tombe pas sur la première recherche en jeu.

**Gain attendu.** Estimé : −10 à −30 % sur la première recherche lourde. Qualitatif : premier pic atténué.

**Risques.** Remaniement des fermetures, risque moyen. Déterminisme non touché.

**Vérifier par.** node --trace-deopt bench/load/deopt-steps.mjs <ferro> c:9, puis deopt-attr.cjs pour le compte par fonction. spikes.mjs : ms du premier pic.

**Contre-vérification.** Non revérifié. Les traces de désoptimisation ont été prises dans un contexte vm, qui modifie le comportement de l'optimiseur (leçon 1) : le compte de 500 à 800 sorties d'OSR n'est pas transposable tel quel à Chrome. Les fermetures recréées à chaque FSimulation.create sont réelles (toute la sim est une fermeture, simulation.js:85). La « route factice pendant le chargement » est avantageusement remplacée par LOAD-V1, qui supprime la recherche à froid elle-même. À ne pas inscrire au prompt maître sans nouvelle mesure dans Chrome.

**Gain corrigé.** Aucun gain démontré.

### LOAD-13 — Préparation audio : lots de synthèse jusqu'à 110–177 ms, dernier lot de FMusic.warmup à 21–68 ms
- sévérité basse · catégorie audio · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité identique · moteur (dans METAL)
- lieux : src/audio.js:281-303; src/music.js:208-231; src/game.js:172; src/game.js:190

**Preuve.** music.mjs (node, PCM pur, aucun périphérique audio), 3 exécutions :
- FMusic.warmup(0) à froid : 84–234 ms en 9 tranches (music.js:208-222, pause entre instruments). La dernière tranche est moduleFor (music.js:223-231 : 7 frappes et 8 mesures de batterie, compose, serialize, decode), 21–68 ms.
- warmup(1) et warmup(2) ensuite : 10–24 ms en une tranche. getModule : 0,06–0,1 ms.
- Banque d'effets (audio.js:281-303, warmBank) : 34 noms × 1–2 variantes à 22 050 Hz, soit 1,85 Mo de Float32 et 559–764 ms au total. Lots de 2 noms par setTimeout ; lot maximal 110–177 ms (break:metal 96–136 ms à lui seul, break:glass 93–103 ms, explosion 14–45 ms).

Ce travail tourne une fois par session dans preparePlay (game.js:172), plus un warmup sur l'écran « cleared » (game.js:190).

**Cause.** Les lots sont découpés par nombre d'effets et non par durée, alors que les effets break:* coûtent 10 à 50 fois plus que les autres.

**Proposition.** - Lots bornés en temps : while(performance.now()-t0<8) build(suivant).
- Une seule variante par tâche pour les effets lourds.
- Découper moduleFor en tâches : batterie, compose, serialize, decode.
- Ou synthétiser dans un Worker (Float32Array transférables, sans copie) et appeler createBuffer sur le fil principal.

**Gain attendu.** Estimé d'après les mesures par effet :
- avec une variante par tâche, la plus longue tâche passe de 110–177 ms à ≈48–68 ms (la moitié de break:metal) ;
- elle descend à 8–16 ms ou moins seulement avec un Worker ou en découpant synthesize.

Le total (0,56–0,76 s) ne change pas sans Worker.

**Risques.** checks/audio.test.mjs et checks/music.test.mjs vérifient le PCM : l'ordre de construction ne doit pas changer le résultat. Un Worker créé depuis une Blob URL reste compatible avec le fichier unique, sans asset importé.

**Vérifier par.** node bench/load/music.mjs <ferro>, avant et après : maxBatchMs et maxSliceMs. node --test checks/audio.test.mjs checks/music.test.mjs.

**Contre-vérification.** Code relu (audio.js:281-303 : lots de 2 noms sans borne de temps). Mesure refaite hors bac à sable (v13.mjs) : contrairement à d'autres chiffres du premier tour, celui-ci n'était pas gonflé (calcul sur tableaux typés). Deux effets coûtent à eux seuls plus de la moitié de la banque. Cela se passe sur l'écran de chargement, une fois par session : gêne faible, mais la barre se fige et, pour la démo longue, tout réchauffement en cours de route serait audible ou visible. audio.js et music.js sont dans FERRO : la borne en temps (8 ms par tâche) est générique et ne demande aucun réglage aux jeux. Le PCM doit rester identique bit à bit (ordre de construction indifférent si chaque synthèse est pure : à vérifier par les tests audio). Piste non explorée : pourquoi break:metal et break:glass coûtent 140 ms pour un seul son.

**Preuve corrigée.** Banque : 34 noms, 1 849 Ko, 542 ms au total (minimum de 3 passes) ; break:metal 147 ms, break:glass 138 ms, break:stone 57 ms ; plus gros lot de 2 noms : 156 ms. FMusic.warmup(0) : tranches de 20 à 107 ms sous charge.

**Gain corrigé.** Plus longue tâche 156 ms → ≈ 70 à 75 ms avec une variante par tâche (la moitié de break:metal) ; moins seulement en découpant synthesize ou avec un Worker (ici le transfert d'un Float32Array est gratuit, contrairement au monde).

### LOAD-14 — Taille des points de reprise : 82–274 K caractères, dominée par les ennemis (≈1,1 Ko chacun)
- sévérité basse · catégorie mémoire · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P3 · qualité sans objet · jeu
- lieux : src/simulation.js:1941-1959; src/simulation.js:1962; src/game.js:86

**Preuve.** Tailles mesurées :
- gen-time.mjs : 81 766 caractères (c:0, 66 ennemis) à 273 628 (c:17, 221 ennemis) ;
- rubble.mjs : les ennemis pèsent 140 des 218 Ko ;
- memory.mjs : ≈207 K avec 128 gravats et 91 états de destruction.

Limites : 2 000 000 caractères pour restore (simulation.js:1962), 2 200 000 pour readSave (game.js:86). restore refait un aller-retour JSON (1962).

Compatibilité vérifiée : des points de reprise 0.6.1 (00217cd) de mondes historiques et de campagne v1 sont restaurés par 0.8.0 à 10/10 (save-compat.mjs, mondes identiques).

**Cause.** Chaque ennemi est sérialisé en entier, même intact depuis son apparition.

**Proposition.** Faible priorité : ne sauvegarder que les ennemis modifiés (morts, déplacés, blessés ou alertés). Un bitset « intact » permet de reconstituer les autres depuis world.enemies. Sinon, rien à faire : les limites sont loin.

**Gain attendu.** Estimé : −40 à −60 % de taille, et autant sur stringify et setItem, qui sont déjà petits (stringify 0,2–0,5 ms).

**Risques.** Changement de format : nouvelle version qui accepte l'ancien format, validation atomique de la forme compacte, tests de restore exact. Le bénéfice est faible, d'où la sévérité basse.

**Vérifier par.** rubble.mjs (répartition par partie) et gen-time.mjs (snapshotChars). checks/checkpoint.test.mjs.

**Contre-vérification.** Limites relues : 2 000 000 caractères (simulation.js:1962) et 2 200 000 (game.js:87, et non 86). Mes points mesurent 143 à 168 K caractères après une roquette. Rien à faire : la compaction change le format pour un gain de 0,5 ms. La compatibilité 0.6.1 → 0.8.0 (10/10) n'a pas été revérifiée. À laisser hors du prompt maître.

**Preuve corrigée.** Points de 143 315 (l:0) à 168 527 caractères (c:9) ; JSON.stringify 1,0 à 1,2 ms sous charge.

**Gain corrigé.** Négligeable.

## Constats ajoutés par le contre-vérificateur

### LOAD-V1 — Les pics A* viennent du cache d'arêtes froid, pas des recherches répétées : le préchauffer en tâche de fond supprime les pics
- sévérité haute · catégorie saccade · effort M · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · jeu
- lieux : src/simulation.js:1377-1378; src/simulation.js:1379-1382; src/simulation.js:1389; src/simulation.js:1418-1421; src/simulation.js:1349-1376

**Preuve.** vV1.mjs (domaine principal, scénario marche et tir 1 800 pas, minimum par recherche sur 3 rejeux alternés, trois variantes : original, invalidation locale de LOAD-02, invalidation locale + cache d'arêtes préchauffé et symétrique).
c:9 : temps A* cumulé 393 → 133 → 16 ms ; plus longue recherche 99 → 86 → 4,4 ms ; pas le plus long 109 → 97 → 38 ms.
l:0 : temps A* cumulé 180 → 54 → 8,9 ms ; plus longue recherche 78 → 36 → 0,6 ms ; pas le plus long 85 → 61 → 7,7 ms ; pas > 8 ms 4 → 3 → 0.
État final égal (FNV du snapshot) entre la variante locale et la variante préchauffée sur les deux mondes.
v04.mjs : une recherche échouée refaite à chaud fait 0 segmentFree et coûte 0,6 à 1,5 ms, contre 30 à 150 ms à froid sous cette charge.
v08.mjs : segmentFree est symétrique sur toutes les arêtes de la grille (0 écart sur 62 953 et 62 723).
Coût du préchauffage complet : 62 723 à 62 953 arêtes en 431 à 1 202 ms sous charge (7 à 19 µs par arête).

**Cause.** edgeKnown/edgeOpen ne sont remplis qu'à la demande, à l'intérieur de route(), et vidés en entier à chaque révision (ligne 1389). La première recherche qui explore une zone paie donc 2 300 à 2 400 nœuds × environ 2 segmentFree dans un seul pas. Le premier tour (LOAD-04) a attribué ces pics aux recherches répétées, qui sont en réalité déjà servies par le cache.

**Proposition.** 1) Faire LOAD-02 d'abord (le cache n'est plus vidé globalement).
2) Remplir le cache hors de route() : dans pumpNav, une fois la file de cellules vide, évaluer au plus N arêtes par pas (N = 96, soit ≈ 0,3 à 0,6 ms sur ce Mac ; 0 si le pas a déjà dépassé 4 ms) en balayant la grille par anneaux autour du joueur, avec un curseur ; pour chaque cellule franchissable, arêtes +x et +z, et poser les deux sens (bit k sur i, bit k^1 sur j).
3) Pendant l'écran de chargement, préchauffer par tranches de 8 ms entre deux images jusqu'à couvrir un rayon de 40 m autour du départ.
4) L'invalidation locale remet seulement les cellules touchées dans le balayage.
5) Évaluer les arêtes mises en cache sans les boîtes mobiles des pièges (trapBoxes), sinon une arête testée pendant le passage d'une lame reste fermée.
6) snapshot() ne force pas le préchauffage : le cache n'est pas sauvegardé et l'état reste égal avec ou sans lui.

**Gain attendu.** Mesuré sur prototype (préchauffage complet à la création) : temps A* divisé par 8 à 20 après LOAD-02 (133 → 16 ms, 54 → 8,9 ms), plus longue recherche ramenée de 36 à 86 ms à 0,6 à 4,4 ms, plus aucun pas au-delà de 8 ms en l:0. La version amortie (96 arêtes par pas) n'est pas prototypée : gain identique une fois la zone couverte, soit ≈ 11 s de jeu pour toute la grille.

**Risques.** Déterminisme : conservé, le balayage dépend seulement de l'état de la sim ; mais l'ordre d'évaluation change, et les 18 bits périmés observés en c:9 montrent que le résultat d'une arête peut dépendre de l'instant (pièges, portes) : appliquer le point 5 et vérifier l'égalité de snapshot sur 6 mondes. Sauvegardes : rien de neuf à sérialiser. Coût de fond : borner N et le couper quand le pas est déjà long. Chargement : +0,2 à 0,4 s étalés si l'on préchauffe tout, d'où la limite de rayon. Tests : pathSearches/pathDeferred inchangés ; ajouter un test « aucune recherche ne dépasse 500 segmentFree après préchauffage ». Recoupe l'axe IA (prototype de navigation sans pointes) : fusionner les deux dans le prompt maître.

**Vérifier par.** node bancs/load-verif2/vV1.mjs c:9 3 puis l:0 3 : astarMsMax de localPre inférieur à 5 ms, localEqualsLocalPre true. Critère d'acceptation en jeu : aucun pas de simulation au-delà de 8 ms dû à route() sur les scénarios bench2 de c:5, c:9, l:0 et l:2.

### LOAD-V2 — Démo longue : rien dans le chargement ni dans la sauvegarde n'est prévu pour un mode qui enchaîne les mondes sans joueur
- sévérité moyenne · catégorie démo · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · jeu
- lieux : src/game.js:94-103; src/game.js:31; src/game.js:133-151; src/game.js:193-238; src/simulation.js:1028-1065

**Preuve.** Lecture de code, METAL 673d6b2 n'a aucun mode démo (grep demo|attract vide dans src/game.js).
- saveCheckpoint() écrit localStorage[SAVE_KEY] à chaque événement core, mechanism, encounterClear, bossDeath, etc. (game.js:94-103, 193-238) : une démo pilotée par la même boucle écraserait la partie du joueur.
- worldCache ne garde que 2 mondes (game.js:31) : le monde de la démo évince celui du joueur, qui repaiera FWorld.create au retour.
- Chaque changement de monde passe par load() synchrone (game.js:133-151) : mes temps, domaine principal, FWorld.create 177 à 248 ms + FSimulation.create 59 à 128 ms + setWorld, soit un gel de 0,25 à 0,4 s à chaque transition de démo.
- Les gravats restent au plafond de 128 pour toute la durée d'un monde (durée de vie 1e7 s) et coûtent ≈ 1,1 ms par pas, dont 5 à 12 morceaux jamais au repos (v05.mjs).
- Premier tour : 40 à 93 GC par minute, pas de fuite sur 5 minutes simulées ; rien n'a été mesuré au-delà.

**Cause.** Le chargement, le cache de mondes et les points de reprise supposent une seule partie active, celle du joueur, et un écran de chargement entre deux mondes.

**Proposition.** 1) Drapeau demo dans game.js : saveCheckpoint(), clearSave() et refreshContinue() ne font rien en démo ; savedRun et checkpoint du joueur ne sont jamais touchés.
2) Emplacement de cache séparé pour le monde de démo (worldCache à 3 entrées ou variable demoWorld), pour ne pas évincer le monde du joueur.
3) Transition de démo sous fondu au noir de 0,5 s : générer le monde suivant et créer la sim pendant l'image noire, en étapes séparées par une image (découpage de LOAD-08), après LOAD-06.
4) Durée de séquence bornée (par exemple 90 à 150 s par monde) puis nouveau monde : la sim est recréée, donc gravats et états de destruction repartent de zéro.
5) Appliquer LOAD-05 et LOAD-V1 avant, sinon la démo affiche justement les pics.

**Gain attendu.** Qualitatif : la démo ne détruit pas la sauvegarde et n'a pas de gel visible aux transitions. Estimé : plus longue tâche visible hors image noire sous 50 ms.

**Risques.** Aucun changement de simulation ni de format. La démo doit passer par les mêmes entrées que le joueur (pilote automatique) pour rester déterministe et testable. Vérifier que la musique ne décroche pas pendant la tâche de chargement (non vérifié). À coordonner avec l'axe démo, qui travaille en parallèle dans bench/demo.

**Vérifier par.** Banc bench/loop/harness.mjs (vrai game.js, horloge virtuelle) : 30 minutes de démo simulées ; localStorage[SAVE_KEY] identique octet pour octet avant et après ; tas en dents de scie sans tendance ; plus longue tâche hors image noire inférieure à 50 ms ; nombre de gravats revenu à 0 à chaque changement de monde.

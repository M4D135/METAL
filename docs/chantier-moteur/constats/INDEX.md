# Index des constats

| id | axe | sévérité | verdict | priorité | qualité | titre |
|---|---|---|---|---|---|---|
| SIM-01 | SIM | haute | confirmé | P0 | meilleure | Navigation : chaque révision de destruction ou de porte invalide toute la grille et tout le cache d'arêtes |
| SIM-02 | SIM | haute | confirmé | P1 | identique | ground() : 5 formes cachées lues objet par objet ; SoA et sous-grille de 2 m aux résultats exacts |
| SIM-03 | SIM | haute | confirmé | P1 | identique | Débris : chaque pièce au repos est revalidée à chaque pas, avec 5 appels à ground, un Set et 216 points de feuillage |
| SIM-04 | SIM | moyenne | plausible | P2 | identique | blocked() : un tableau alloué par appel, ground recalculé par défaut et un site de lecture mégamorphe |
| SIM-05 | SIM | moyenne | confirmé | P2 | identique | Allocations : 534 à 864 Ko par pas, surtout des HeapNumber créées par des lectures mégamorphes |
| SIM-06 | SIM | moyenne | confirmé | P2 | identique | Boucles sur toutes les identités ennemies à chaque pas, rencontres comptées deux fois |
| SIM-07 | SIM | moyenne | confirmé | P2 | identique | ray() et castProjectile() balaient toutes les boîtes et tous les sols du niveau à chaque rayon |
| SIM-08 | SIM | moyenne | plausible | P2 | identique | Une révision de destruction reconstruit tout : 1,6 à 2,3 ms par impact |
| SIM-09 | SIM | basse | confirmé | P2 | identique | segmentFree : sol calculé deux fois par extrémité, trois tableaux alloués par boîte |
| SIM-10 | SIM | basse | confirmé | P3 | identique | Math.hypot coûte 9 à 13 fois sqrt et alloue, mais ne lui est pas interchangeable |
| SIM-11 | SIM | haute | confirmé | P1 | sans objet | Méthode : le bac à sable node:vm fausse les profils (ground ×8 à ×9, pas ×5) |
| SIM-12 | SIM | haute | confirmé | P0 | meilleure | Pointes restantes : route en début de vague (10 à 16 ms après correctifs), amplifiée par les sous-pas |
| SIM-13 | SIM | basse | confirmé | P3 | sans objet | Croissance des tableaux : aucune fuite, seul s.loot grossit et il reste borné |
| SIM-V1 | SIM | moyenne | ajout |  | meilleure | Le cache d'arêtes de navigation dépend des boîtes de pièges mobiles : arêtes périmées, aggravées par l'invalidation locale de SIM-01 |
| SIM-V2 | SIM | haute | ajout |  | identique | La même recherche A* vouée à l'échec est rejouée à l'identique après chaque révision : aucune mémoire des échecs |
| IA-01 | IA | critique | confirmé | P0 | meilleure | Pointes de 10 à 31 ms (47 à 59 ms sous vm) : A* plafonné à 2400 nœuds vers une composante inaccessible |
| IA-02 | IA | haute | confirmé | P0 | meilleure | refreshNav global à chaque révision de destruction : file complète, caches vidés, tous les plans jetés |
| IA-03 | IA | haute | confirmé | P2 | meilleure | Un report de budget est traité comme une absence de chemin : arrêts, chemins effacés, renforts sautés |
| IA-04 | IA | moyenne | confirmé | P1 | identique | Micro-optimisations neutres de route() : tas typé, nearestNode trié, balayage long par seaux |
| IA-05 | IA | moyenne | confirmé | P1 | meilleure | Prédicat d'arête statique avec cache de hauteur navY : cuisson rapide et arêtes indépendantes de la pose des pièges |
| IA-06 | IA | haute | confirmé | P1 | sans objet | Méthode : node:vm gonfle les coûts CPU de 5 à 28 fois ; les 40–56 ms rapportés valent environ 10–30 ms en navigateur |
| IA-07 | IA | moyenne | plausible | P2 | identique | Déploiement des renforts : recomptages à chaque pas, rafales de rayons dans safeEntry, route() de 36 à 48 m sans cache |
| IA-08 | IA | haute | plausible | P3 | meilleure | Cible inaccessible : l'ennemi se fige faute de meilleur point atteignable |
| IA-09 | IA | moyenne | plausible | P3 | meilleure | Cadence de décision lente et purement temporisée : réaction p90 de 1,3 à 1,9 s |
| IA-10 | IA | moyenne | plausible | P2 | meilleure | Coordination d'escouade : jetons d'attaque, suppression, grenades de débusquage, flanc vers l'angle mort, déplacement latéral pendant la visée |
| IA-11 | IA | moyenne | plausible | P3 | meilleure | Visée inadaptée à un mouvement « Quake » : vitesse plafonnée sous le sprint, saut extrapolé sans gravité ni sol |
| IA-12 | IA | basse | plausible | P2 | identique | Réseau tactique : coût CPU négligeable, mais avec WebNN le pas d'application des conseils dépend du GPU |
| IA-13 | IA | basse | plausible | P3 | identique | cover() et peek() testent la ligne de vue de tous les candidats avant d'en retenir un |
| IA-14 | IA | basse | plausible | P3 | identique | rebuildNeighbors et nearby() fabriquent des clés chaînes et des tableaux à chaque appel |
| IA-V1 | IA | haute | ajout |  | meilleure | Deux tiers de la grille de navigation sont du substrat hors carte, et 100 % des A* échoués en jeu légitime le visent |
| IA-V2 | IA | haute | ajout |  | meilleure | Jump pads à sens unique ignorés par la navigation : ennemi piégé qui relance un A* perdu toutes les 0,47 s, et vague qui ne se déploie jamais |
| IA-V3 | IA | moyenne | ajout |  | sans objet | Le pilote « tour » des bancs téléporte le joueur derrière des portes fermées : critères d'acceptation à refaire sur des états de portes légitimes |
| BOSS-01 | BOSS | critique | confirmé | P0 | meilleure | Le bouclier n'arrête ni l'Onde de choc ni le Balayage, protège à peine de l'Écrasement quand on vise le cœur, et retire le dash |
| BOSS-02 | BOSS | haute | confirmé | P1 | meilleure | La double Onde de phase 2 arrive à 1,20 s d'écart, inesquivable au dash (recharge 1,7 s), et l'Onde n'a aucune parade de placement |
| BOSS-03 | BOSS | haute | confirmé | P2 | meilleure | Cercle d'engagement de 28 m dans une arène carrée de 60 m : les angles sont sûrs et le ravitaillement est hors du cercle |
| BOSS-04 | BOSS | haute | plausible | P2 | meilleure | Télégraphes illisibles en situation : tous au sol, hors champ quand on vise le cœur, avec un seul son d'annonce très faible |
| BOSS-05 | BOSS | moyenne | confirmé | P2 | meilleure | Le Balayage à 2 faisceaux ne touche jamais un joueur immobile au-delà de 9,15 m |
| BOSS-06 | BOSS | moyenne | confirmé | P2 | meilleure | Barrage de roquettes : la zone passe au rouge 0,75 à 0,83 s avant l'impact et reste rouge environ 2 s après |
| BOSS-07 | BOSS | haute | confirmé | P0 | identique | Pointe reproductible de 42 à 52 ms contre le Brise-siège : une route A* de garde échoue après l'effacement du cache d'arêtes |
| BOSS-08 | BOSS | moyenne | confirmé | P1 | visuellement identique | Une casse décorative invalide toute la navigation (37 à 44 k cellules) et efface le cache d'arêtes |
| BOSS-09 | BOSS | moyenne | confirmé | P1 | identique | Les gravats au repos revérifient leur appui à chaque pas : 38 % du CPU de simulation en combat de boss |
| BOSS-10 | BOSS | haute | plausible | P3 | sans objet | Durée des combats irrégulière (75 à 464 s) et pénurie de munitions en fin de campagne |
| BOSS-11 | BOSS | moyenne | plausible | P3 | meilleure | Variété faible : 3 scripts répétés 6 fois, un réseau tactique qui rejoue la même attaque et les mêmes gardes sur les 18 mondes |
| BOSS-12 | BOSS | haute | confirmé | P1 | meilleure | Peu de sensation de puissance : un boss-tourelle qui pivote par à-coups, sans recul ni tremblement, et des tirs au cœur indiscernables des tirs au corps |
| BOSS-13 | BOSS | moyenne | plausible | P3 | dégradée | L'arène impose 100 m de portée de rendu à toutes les qualités, y compris Canvas2D en qualité basse |
| BOSS-V1 | BOSS | haute | ajout |  | identique | cover() propose aux gardes la face extérieure des piliers de portail, hors de l'enclos et 6,65 m plus bas : c'est la vraie cause de la pointe de BOSS-07 |
| BOSS-V2 | BOSS | haute | ajout |  | meilleure | « Démo qui dure » : un pilote automatique équipé par défaut meurt au premier colosse en 38 à 101 s |
| BOSS-V3 | BOSS | moyenne | ajout |  | identique | Après correction de la route, la pointe maximale du combat est le pas de première casse (11,9 à 20,7 ms de CPU), présent dans tous les combats vers t=10,97 s |
| RCPU-01 | RCPU | haute | confirmé | P0 | visuellement identique | Listes statiques recalculées et ré-uploadées à chaque image : cache temporel à marge pour la vue, le soleil et la torche |
| RCPU-02 | RCPU | haute | confirmé | P1 | identique | Destruction : updateWorld reconstruit tout l'index spatial et vide les 4 caches statiques |
| RCPU-03 | RCPU | moyenne | confirmé | P0 | identique | Filtre des casters du soleil : 3 tableaux et 2 closures par entrée |
| RCPU-04 | RCPU | moyenne | confirmé | P1 | identique | Pools de buffers typés et upload par capacité (pack, packIndexed, bufferData DYNAMIC_DRAW) |
| RCPU-05 | RCPU | moyenne | confirmé | P1 | identique | Index spatial : clés chaîne x+','+z et Map.get pour chaque cellule, 3 requêtes par image |
| RCPU-06 | RCPU | moyenne | confirmé | P2 | identique | FEffects.build : débris triés deux fois avec des clés chaîne et des tableaux temporaires |
| RCPU-07 | RCPU | moyenne | confirmé | P1 | identique | Pickups et butin modélisés sans culling de vue : seule la distance compte |
| RCPU-08 | RCPU | moyenne | confirmé | P1 | meilleure | Gouverneur de résolution : seuils absolus en ms, qui oscillent sous vsync 60 Hz, ne réagissent pas à 120 Hz ou en VRR, et réallouent les cibles à chaque palier |
| RCPU-09 | RCPU | moyenne | plausible | P3 | identique | Repli Canvas2D : 7,8 ms de JS par image sur M5 (p99 19 ms), surtout dans shade, collect, maskGround et le tri |
| RCPU-10 | RCPU | basse | plausible | P3 | identique | Appels GL : 4 vertexAttribPointer par groupe (la moitié des appels), et lot dynamique complet redessiné dans chaque passe d'ombre |
| RCPU-11 | RCPU | basse | plausible | P3 | identique | FActors.build : environ 250 ns par primitive, avec matrices et tableaux alloués à chaque appel, sans aucune réutilisation |
| RCPU-V1 | RCPU | haute | ajout |  | identique | Le cache à marge de RCPU-01 change l'image : ajouter la coupure de portée exacte dans le vertex shader |
| RCPU-V2 | RCPU | moyenne | ajout |  | identique | Marges fixes D = 1 m et θ = 8° du cache : calées sur METAL, à rendre adaptatives pour FERRO (BITUME à 80 m/s, FOV de 10°) |
| RCPU-V3 | RCPU | moyenne | ajout |  | sans objet | Aucun critère d'image dans les bancs RCPU : intégrer à FERRO le banc Chrome à variantes en rotation avec différence de pixels |
| RGPU-01 | RGPU | haute | confirmé | P1 | dégradée | Reflet GGX évalué pour les 12 lumières ponctuelles : le limiter aux 4 premières |
| RGPU-02 | RGPU | haute | confirmé | P2 | dégradée | Qualité haute : DPR natif jusqu'à 2 (5,4 MPix) sans budget de pixels ni gouverneur |
| RGPU-03 | RGPU | moyenne | confirmé | P1 | visuellement identique | Projeteurs d'ombre du soleil requêtés, filtrés, réemballés et renvoyés à chaque image |
| RGPU-04 | RGPU | moyenne | réfuté | P3 | dégradée | Ombres : torche quasi invisible, lampe ombrée hors de portée, 4e tuile d'atlas et 2e lampe jamais utilisées |
| RGPU-05 | RGPU | moyenne | confirmé | P1 | meilleure | Facteur d'atténuation .27 attaché au créneau 1 : la lampe proche perd 52 % dès qu'une explosion ou une roquette apparaît |
| RGPU-06 | RGPU | moyenne | plausible | P3 | dégradée | Particules translucides : coût proportionnel à la surface couverte, dont la moitié en bruit sinusoïdal |
| RGPU-07 | RGPU | moyenne | confirmé | P2 | meilleure | Vignette, voile de dégâts et onde d'impulsion appliqués aux seuls fragments de géométrie : ciel et particules y échappent, vignettes incohérentes et doublées en CSS |
| RGPU-08 | RGPU | moyenne | confirmé | P2 | identique | Rendu 3D complet à chaque image derrière la pause et la boutique (image figée), flou backdrop-filter recalculé |
| RGPU-09 | RGPU | moyenne | confirmé | P0 | meilleure | Gouverneur de résolution calé sur 60 Hz, piloté par l'intervalle rAF, lent, et qui réalloue les cibles à chaque pas |
| RGPU-10 | RGPU | moyenne | plausible | P2 | meilleure | Aucun anticrénelage : MSAA 4× mesuré à +20 %, FXAA dans la composition proposé |
| RGPU-11 | RGPU | moyenne | confirmé | P1 | sans objet | Instrumentation : un seul compteur FPS, ni temps par sous-système ni temps GPU |
| RGPU-12 | RGPU | basse | plausible | P3 | dégradée | Bruit de valeur des matériaux : 4 hash ALU par appel, 3 à 8 appels par pixel |
| RGPU-13 | RGPU | basse | plausible | P3 | dégradée | Lumières du monde sans portée : 8 des 12 lumières évaluées n'apportent rien ; éclairage clustered non justifié aujourd'hui |
| RGPU-14 | RGPU | basse | plausible | P2 | meilleure | Qualité de lumière à coût maîtrisé : cascade soleil proche, brouillard diffusant, fumée éclairée par les explosions |
| RGPU-15 | RGPU | basse | plausible | P3 | meilleure | Lisibilité et matière : liseré des ennemis, occlusion ambiante, impacts procéduraux |
| RGPU-V1 | RGPU | haute | ajout |  | identique | Toutes les décisions de l'axe reposent sur un seul GPU Apple à tuiles : aucun chemin ni mesure pour les GPU immédiats (carte NVIDIA) |
| RGPU-V2 | RGPU | moyenne | ajout |  | identique | Démo qui dure : temps des shaders en float32 jamais replié et gouverneur coupé hors partie ou sans focus |
| RGPU-V3 | RGPU | moyenne | ajout |  | meilleure | Fumée et feu disparaissent d'un coup quand la caméra entre dans la particule (faces arrière éliminées), sans fondu de proximité |
| LOOP-01 | LOOP | critique | confirmé | P0 | meilleure | Les points de reprise pris après une destruction sont refusés par restore() : la progression du secteur est perdue |
| LOOP-02 | LOOP | critique | confirmé | P0 | identique | Des recherches A* vouées à l'échec bloquent un pas de simulation 97 à 175 ms |
| LOOP-03 | LOOP | haute | confirmé | P2 | identique | Un point de reprise pendant un recalcul de navigation fige le jeu 42 à 155 ms |
| LOOP-04 | LOOP | haute | confirmé | P1 | identique | Chaque révision de destruction reconstruit tout : 24 à 31 ms côté rendu, toute la navigation côté simulation |
| LOOP-05 | LOOP | haute | confirmé | P1 | identique | ceil(dt*60) fait 2 sous-pas par image à 59,94 Hz ou avec des horodatages arrondis : +37 à 39 % de CPU de simulation |
| LOOP-06 | LOOP | haute | confirmé | P1 | meilleure | Le tir n'est pas verrouillé : un clic court entre deux images, ou pendant le délai de l'arme, est perdu |
| LOOP-07 | LOOP | haute | confirmé | P0 | meilleure | Aucune prise en charge de la manette |
| LOOP-08 | LOOP | moyenne | confirmé | P2 | meilleure | La cadence des armes est arrondie au pas : 6 à 16 % de tirs en moins, et des dégâts par seconde qui dépendent des fps |
| LOOP-09 | LOOP | moyenne | confirmé | P2 | meilleure | Le limiteur d'images se trompe hors multiples exacts : 37,5 fps pour une limite à 60 sur un écran 75 Hz |
| LOOP-10 | LOOP | moyenne | confirmé | P1 | meilleure | Verrouillage du pointeur fragile, glisser pour regarder qui tire aussi, molette sans seuil |
| LOOP-11 | LOOP | moyenne | confirmé | P2 | identique | Rendu complet à chaque image en pause, dans les menus, la boutique et l'écran de fin, sous un flou d'arrière-plan |
| LOOP-12 | LOOP | moyenne | confirmé | P1 | meilleure | Le gouverneur de résolution est trompé par l'intervalle rAF |
| LOOP-13 | LOOP | basse | plausible | P3 | visuellement identique | HUD : 97 % d'écritures DOM inutiles, barres animées par width, surcouches plein écran en double |
| LOOP-14 | LOOP | basse | confirmé | P3 | identique | 34 automations AudioParam par image, dont la moitié en double |
| LOOP-15 | LOOP | basse | plausible | P3 | identique | Environ 1,5 Mo alloués par image, dont 74 % dans sim.step : GC encore discret, mais peu de marge sur mobile |
| LOOP-V1 | LOOP | haute | ajout |  | meilleure | Aucun mode démo dans METAL, et rien dans la boucle ne permet une démo qui dure |
| LOOP-V2 | LOOP | haute | ajout |  | meilleure | Deuxième cause des points de reprise refusés : une lame ou une presse qui traverse un débris posé ; et la sauvegarde refusée est écrasée |
| LOOP-V3 | LOOP | moyenne | ajout |  | sans objet | Les durées de l'axe LOOP sont gonflées 3 à 8 fois par node:vm : les seuils d'acceptation en millisecondes sont à refaire |
| FEEL-01 | FEEL | critique | confirmé | P0 | meilleure | Le bouclier en main gauche supprime l'esquive : Espace devient une frappe et l'invulnérabilité du dash disparaît, alors que c'est l'équipement par défaut de la campagne v2 |
| FEEL-02 | FEEL | haute | confirmé | P0 | meilleure | La garde est un cône 3D évalué au point d'impact de la balle, pas selon la direction d'arrivée : jambes jamais protégées, tête presque jamais, rien quand on regarde vers le bas |
| FEEL-03 | FEEL | haute | confirmé | P0 | meilleure | Économie de garde : 20 % des dégâts passent quand même, 100 d'énergie ne couvrent que 10 balles, et la tenue vide la jauge |
| FEEL-04 | FEEL | haute | confirmé | P1 | meilleure | Un coup bloqué est présenté comme un coup reçu : voile rouge plein, combo remis à zéro, aucune direction |
| FEEL-05 | FEEL | moyenne | confirmé | P2 | meilleure | Les attaques des boss et de l'environnement n'ont pas de source : jamais blocables, et rien ne permet de les esquiver avec le bouclier |
| FEEL-06 | FEEL | haute | confirmé | P0 | meilleure | Les tirs sont trop maigres : 90 % de l'énergie en 20 à 51 ms et presque rien sous 120 Hz, d'où le « léger » |
| FEEL-07 | FEEL | moyenne | plausible | P1 | meilleure | Mixage : compresseur rapide qui écrase l'attaque, ennemis qui tirent avec le son du SMG du joueur, touches et kills peu audibles |
| FEEL-08 | FEEL | haute | confirmé | P0 | meilleure | Déplacement raide : arrêt quasi instantané, élan perdu à chaque atterrissage, contrôle en l'air quasi nul |
| FEEL-09 | FEEL | haute | plausible | P1 | meilleure | Pas de saut : les obstacles de 0,43 à 1,0 m sont infranchissables et le jeu n'a aucune verticalité |
| FEEL-10 | FEEL | haute | confirmé | P0 | meilleure | Aucun support manette : architecture proposée et points d'intégration exacts |
| FEEL-11 | FEEL | moyenne | plausible | P1 | meilleure | Manette dans les menus, invites de touches figées pour le clavier, et branchement à chaud |
| FEEL-12 | FEEL | haute | confirmé | P1 | meilleure | Surchauffe : le SMG se verrouille après 1,73 s de tir et reste bloqué 59 % du temps |
| FEEL-13 | FEEL | moyenne | plausible | P1 | meilleure | Recul et caméra : même ressort pour toutes les armes, aucune réaction de la caméra au tir, shake du renderer jamais utilisé |
| FEEL-14 | FEEL | moyenne | plausible | P2 | meilleure | Les ennemis ne réagissent pas aux impacts : seulement une teinte de 0,2 s |
| FEEL-V1 | FEEL | haute | ajout |  | meilleure | Surchauffe globale : une jauge unique verrouille toutes les armes et les deux mains ; changer d'arme ne sert à rien pendant 2 s |
| FEEL-V2 | FEEL | moyenne | ajout |  | meilleure | L'esquive est coupée net au bord d'un rebord : invulnérabilité annulée, vitesse de 15,2 à 7,6 m/s, puis 0 à l'atterrissage |
| FEEL-V3 | FEEL | moyenne | ajout |  | meilleure | Les solides de 7 à 43 cm sont des murs, et la caméra saute de 0,25 à 0,40 m en une image sur une marche de sol |
| LOAD-01 | LOAD | critique | confirmé | P0 | meilleure | Points de reprise refusés dès qu'un gravat au repos chevauche un collider : reprise à l'entrée du secteur, arsenal par défaut |
| LOAD-02 | LOAD | haute | confirmé | P0 | meilleure | refreshNav(reset) global à chaque révision de destruction : toute la grille remise en file, cache d'arêtes vidé, chemins effacés |
| LOAD-03 | LOAD | moyenne | confirmé | P1 | identique | saveCheckpoint synchrone dans la frame : snapshot() vide toute la file nav (33–35 ms après une brèche), puis stringify et localStorage |
| LOAD-04 | LOAD | haute | réfuté | P3 | identique | A* : recherches échouées répétées et cache d'arêtes à sens unique (pics de 42–69 ms) |
| LOAD-05 | LOAD | haute | confirmé | P1 | identique | Gravats : 128 morceaux au repos coûtent 0,9–2,1 ms par pas, et des morceaux coincés ne s'endorment jamais |
| LOAD-06 | LOAD | haute | confirmé | P1 | identique | FWorld.create : recherches quadratiques (demolitionMetadata, reinforcementBays, openEntries), −43 à −73 % à sortie identique |
| LOAD-07 | LOAD | moyenne | plausible | P2 | identique | Création et reprise : deux contrôleurs de destruction et deux grilles nav complètes par reprise, aucun cache par monde |
| LOAD-08 | LOAD | moyenne | plausible | P1 | identique | Chargement en une seule tâche de 300–450 ms (génération, simulation, rendu), retour au menu synchrone |
| LOAD-09 | LOAD | moyenne | plausible | P1 | visuellement identique | renderer.updateWorld reconstruit tout l'index spatial et vide les 4 caches statiques à chaque révision |
| LOAD-10 | LOAD | moyenne | plausible | P1 | identique | Explosion : destruction.rebuild parcourt tous les maillages et rebuildCollision refait tout, d'où un pas de 5–14 ms |
| LOAD-11 | LOAD | moyenne | plausible | P2 | identique | 0,74–0,97 Mo alloués par pas, soit 40 à 93 GC par minute (pas de fuite) |
| LOAD-12 | LOAD | basse | plausible | P3 | sans objet | Désoptimisations V8 : segmentFree sort de l'OSR 500–800 fois par recherche lourde, « wrong call target » après chaque FSimulation.create |
| LOAD-13 | LOAD | basse | confirmé | P2 | identique | Préparation audio : lots de synthèse jusqu'à 110–177 ms, dernier lot de FMusic.warmup à 21–68 ms |
| LOAD-14 | LOAD | basse | confirmé | P3 | sans objet | Taille des points de reprise : 82–274 K caractères, dominée par les ennemis (≈1,1 Ko chacun) |
| LOAD-V1 | LOAD | haute | ajout |  | identique | Les pics A* viennent du cache d'arêtes froid, pas des recherches répétées : le préchauffer en tâche de fond supprime les pics |
| LOAD-V2 | LOAD | moyenne | ajout |  | sans objet | Démo longue : rien dans le chargement ni dans la sauvegarde n'est prévu pour un mode qui enchaîne les mondes sans joueur |
| STAB-01 | STAB | critique | confirmé | P0 | sans objet | Recensement : 96,7 % des images longues viennent de trois causes, et 82 % des révisions de destruction en produisent une |
| STAB-02 | STAB | haute | réfuté | P3 | identique | Session longue : après 50 s de combat l'image médiane coûte 1,5 à 1,65 fois plus et ne redescend jamais |
| STAB-03 | STAB | haute | confirmé | P2 | identique | Première image de jeu 3,3 à 5,4 fois plus chère : le code de simulation n'a jamais tourné avant ; un échauffement caché la ramène à la normale |
| STAB-04 | STAB | moyenne | confirmé | P2 | identique | Shaders : 44 à 92 ms bloqués à la création du renderer alors que la compilation parallèle est disponible, et aucun dessin d'échauffement |
| STAB-05 | STAB | haute | confirmé | P1 | meilleure | Gouverneur de qualité : chaque palier coûte une image doublée, la politique oscille et ignore les écrans 120 et 144 Hz ; prototype sans réallocation ni inversion |
| STAB-06 | STAB | haute | confirmé | P1 | meilleure | Cadencement : le nombre de sous-pas dépend du bruit flottant des horodatages, la partie n'est pas rejouable ; pas fixe, accumulateur, interpolation et lissage d'horloge prototypés |
| STAB-07 | STAB | moyenne | plausible | P2 | identique | Ordonnanceur de tâches à budget par image : API, règles de déterminisme et prototype mesuré sur la pré-synthèse audio |
| STAB-08 | STAB | haute | confirmé | P1 | sans objet | Enregistreur de temps d'image avec journal des saccades et de leur cause, activable par une touche et commun aux trois jeux |
| STAB-09 | STAB | haute | confirmé | P0 | meilleure | Mode démo qui dure : en faire aussi le banc d'endurance du jeu, rejouable et sans toucher à la sauvegarde |
| STAB-10 | STAB | moyenne | plausible | P3 | visuellement identique | Sources périodiques : aucune ne fait une saccade seule, mais le ramasse-miettes accompagne 26 % des images longues et tout empire à 120 et 144 Hz |
| STAB-V1 | STAB | haute | ajout |  | identique | Correctif provisoire d'une ligne : tolérance sur le nombre de sous-pas, pour ne plus doubler la simulation deux images sur trois à 60 Hz |
| STAB-V2 | STAB | haute | ajout |  | meilleure | Démo qui dure : la perte de focus met en pause, les modes boutique, mort et victoire arrêtent la boucle, l'écran se met en veille et rien ne relance un pilote bloqué |
| STAB-V3 | STAB | moyenne | ajout |  | sans objet | Le banc de stabilité change de régime à 48,6 s : son horloge franchit 2^20 ms et toutes les sessions passent de 1 à 2 sous-pas par image |
| RESTE-01 | RESTE | haute | confirmé | P1 | identique | Après R1, models() est le premier poste (40 % du JS, 60 % des allocations) : écrire les instances directement dans le tampon |
| RESTE-02 | RESTE | haute | confirmé | P0 | identique | FMotion.place, mount et vector : réécriture exacte sans allocation, avec mémo des angles par repère |
| RESTE-03 | RESTE | moyenne | confirmé | P2 | identique | Maillages dynamiques : 5,6 classes cachées par liste, pack() devient mégamorphe ; une forme d'objet unique |
| RESTE-04 | RESTE | moyenne | confirmé | P1 | identique | Passes par pas sur tous les ennemis : sélection des rencontres sans allocation, voisinage réutilisé, sauts exacts |
| RESTE-05 | RESTE | moyenne | confirmé | P2 | identique | updateDebris reste le deuxième poste du pas (18 %) : debrisHalf scalaire exact, puis rotation et closures hors boucle |
| RESTE-06 | RESTE | haute | plausible | P1 | identique | En tir soutenu, tir -> destruction.damage -> rebuild pèse 31 % du pas, avec une double compilation par fracture |
| RESTE-07 | RESTE | moyenne | plausible | P1 | identique | FEffects.build, première fonction en temps propre (7,7 %) : enregistrements retenus pour les gravats au repos et sélection des K meilleurs |
| RESTE-08 | RESTE | moyenne | plausible | P2 | identique | FActors.build : le cache de pose entre images ne rapporte que 16,5 % ; il faut un calcul scalaire sans map ni spread |
| RESTE-09 | RESTE | basse | plausible | P3 | identique | Audio côté fil principal : JS négligeable (0,7 à 3,5 µs par image) ; le travail restant est côté navigateur (30 nœuds/s, 34 automations par image) |
| RESTE-10 | RESTE | haute | réfuté | P2 | sans objet | Démo qui dure : le coût par image dérive avec le butin accumulé (+31 % d'allocations entre 400 et 1800 images) |
| RESTE-11 | RESTE | moyenne | confirmé | P1 | sans objet | Outillage : attribution par minimum de rejeux, A/B d'image avec hash de liste, budgets d'allocation et de désoptimisations |
| RESTE-V1 | RESTE | haute | ajout |  | sans objet | Démo qui dure : dans game.js actuel, une démo s'arrêterait au premier onglet masqué, à la première mort ou fin de secteur, et écraserait la sauvegarde du joueur |
| RESTE-V2 | RESTE | moyenne | ajout |  | meilleure | Temps envoyé aux shaders en flottant 32 bits sans repli : les animations saccadent après quelques heures d'écran titre ou de démo |
| RESTE-V3 | RESTE | moyenne | ajout |  | sans objet | Le régime permanent d'une longue session (débris au plafond) n'est pas celui des fenêtres de mesure : budgets et gains à établir en état saturé |
| DRAW-01 | DRAW | haute | confirmé | P1 | identique | Arme dessinée en dernier après un gl.clear(DEPTH) en pleine passe : la dessiner d'abord avec un masque stencil |
| DRAW-02 | DRAW | haute | plausible | P2 | visuellement identique | Ordre de dessin : 1,8 à 2,2 fragments ombrés par pixel dans l'ordre actuel, 1,4 avec arme, dynamiques puis statiques par bandes de distance ; pré-passe de profondeur écartée |
| DRAW-03 | DRAW | moyenne | plausible | P3 | identique | Monde statique : 87 à 89 % des octets envoyés chaque image sont des lignes qui ne changent jamais ; table d'instances persistante et listes d'indices |
| DRAW-04 | DRAW | basse | confirmé | P3 | identique | Volume d'appels GL : 409 à 454 par image, mais environ 30 µs de fil principal ; VAO, UBO, filtrage d'états et multi_draw ne sont pas des leviers de performance |
| DRAW-05 | DRAW | moyenne | plausible | P3 | visuellement identique | Projeteurs d'ombre du soleil : la moitié environ ne peut atteindre aucun receveur visible ; les limiter par un test capsule contre champ de vision |
| DRAW-06 | DRAW | moyenne | confirmé | P2 | meilleure | Bandes de couleur dans le ciel et le brouillard : cible de scène RGB10_A2 et tramage d'un demi-pas à la composition |
| DRAW-07 | DRAW | moyenne | plausible | P2 | visuellement identique | Shader de matière sur D3D11 : dérivées et lectures d'ombre placées dans les branches (risque d'aplatissement) ; les variantes par matière ne rapportent rien |
| DRAW-08 | DRAW | basse | plausible | P3 | identique | Visibilité : 66 à 70 % des instances statiques dessinées n'ont aucun pixel visible, mais ce gaspillage coûte peu ; test de champ par cellule d'abord, occlusion plus tard |
| DRAW-09 | DRAW | moyenne | plausible | P2 | meilleure | Apparition brusque aux portées de détail : un objet d'un mètre surgit à 13 m avec une soixantaine de pixels de haut ; fondu par mise à l'échelle dans le shader de sommets |
| DRAW-10 | DRAW | basse | confirmé | P3 | visuellement identique | Ombres : la stabilisation au texel existe déjà ; un cache des projeteurs statiques vaut au plus 0,25 ms GPU sur M5 |
| DRAW-11 | DRAW | basse | confirmé | P2 | identique | Géométrie : 3 sommets émis par triangle, 2 328 sommets au lieu de 597 ; les partager |
| DRAW-12 | DRAW | basse | plausible | P2 | identique | Contexte et cibles : tampon de profondeur par défaut inutile, invalidateFramebuffer sans effet sur M5, compilation des 5 programmes bloquante |
| DRAW-13 | DRAW | basse | plausible | P3 | meilleure | Précision de profondeur à distance : 24 bits avec un plan proche à 4,5 cm, des pixels basculent à l'horizon dès que la plage change de 10 % |
| DRAW-V1 | DRAW | moyenne | ajout |  | identique | Ciel dessiné en premier sur tout l'écran alors qu'il n'est visible que sur 28 à 30 % des pixels : le dessiner après les opaques, à la profondeur 1 |
| DRAW-V2 | DRAW | moyenne | ajout |  | identique | Masque stencil de l'arme : le chemin direct vers le canvas (bloom coupé, qualité basse) n'a pas de stencil ; demander stencil:true au contexte |
| DRAW-V3 | DRAW | moyenne | ajout |  | identique | Ombres : l'extrapolation de profondeur du receveur n'est pas bornée, un projeteur influence des receveurs situés en amont de lui ; toute réduction de la liste des projeteurs doit en tenir compte |
| DRAW-V4 | DRAW | moyenne | ajout |  | sans objet | Mode démo qui dure : le gouverneur de résolution est coupé hors du mode « playing » ou sans focus, une démo tournerait à résolution figée |
| PARA-01 | PARA | haute | confirmé | P1 | sans objet | Point de rupture a déjà l'hôte, le worker et le protocole : à récolter dans FERRO, avec six limites à corriger pour un FPS |
| PARA-02 | PARA | haute | confirmé | P2 | sans objet | Couplage page ↔ simulation de METAL : 229 chemins lus, 5 appels synchrones et 2 écritures à transformer en protocole |
| PARA-03 | PARA | haute | confirmé | P2 | identique | Format du paquet d'état : cloner des objets coûte plus cher que la simulation ; un Float64Array transféré coûte 0,11 ms et reste identique bit à bit |
| PARA-04 | PARA | haute | confirmé | P3 | dégradée | FSimulation dans un worker : états identiques, coût sur le fil principal −79 à −84 %, plus aucune image perdue par un pas long |
| PARA-05 | PARA | haute | réfuté | P3 | dégradée | Latence : caméra prédite exactement sur la page, puis dessin à l'arrivée de l'état avec échéance ; aucune horloge dans le worker |
| PARA-06 | PARA | haute | confirmé | P1 | identique | Génération du monde, FSimulation.create et cuisson de la navigation hors du fil principal pendant l'écran de chargement |
| PARA-07 | PARA | moyenne | plausible | P2 | identique | Synthèse des sons et de la musique dans un worker : 303 + 85 ms de CPU ramenés à 1,5 ms sur le fil principal |
| PARA-08 | PARA | moyenne | plausible | P3 | identique | Points de reprise : snapshot et stringify dans le worker, 2,5–9,2 ms ramenés à 0,05–0,07 ms sur le fil principal |
| PARA-09 | PARA | basse | plausible | P3 | sans objet | Rendu dans un worker (OffscreenCanvas) : possible dans Chrome 157, mais à ne pas faire maintenant ; préparer le rendu dans le worker rapporte plus |
| PARA-10 | PARA | moyenne | confirmé | P1 | sans objet | Contraintes vérifiées en file:// : worker classique depuis un Blob oui, SharedArrayBuffer non, module non ; la page unique de METAL doit être découpée par rôles |
| PARA-11 | PARA | haute | plausible | P1 | identique | Module générique de FERRO (hôte, worker, protocole, tâches) et plan en six étapes avec critères d'acceptation |
| PARA-12 | PARA | haute | confirmé | P0 | sans objet | Démo qui dure : un worker par série de mondes, ticks cadencés par les images, mémoire stable et arrêt automatique en arrière-plan |
| PARA-13 | PARA | moyenne | confirmé | P2 | sans objet | Outillage : mesurer en temps CPU par fil, tester le worker sans fil, et faire passer des essais asynchrones dans Chrome sans interface |
| PARA-V1 | PARA | haute | ajout |  | identique | Un dessin WebGL fait hors du rappel rAF n'est remis au compositeur qu'à l'image suivante : la simulation dans un worker coûte une image de latence au FPS |
| PARA-V2 | PARA | haute | ajout |  | identique | input.weapon est un écho de l'état renvoyé à chaque pas : avec un état en retard ou deux sous-pas, il annule un ramassage d'arme ; la boucle de sous-pas dépend aussi de events() |
| PARA-V3 | PARA | moyenne | ajout |  | identique | Un worker neuf repart à froid : premiers pas 2 à 3,5 fois plus lents et pas maximal de 8 à 10 ms ; garder un seul worker par page et le chauffer au menu |
| PARA-V4 | PARA | haute | ajout |  | sans objet | La démo qui dure peut être livrée tout de suite sur le fil principal ; le seul besoin de parallélisme est de préparer le monde suivant |
| DEMO-01 | DEMO | haute | confirmé | P0 | meilleure | FDemo.attract : automate d'écran titre générique (inactivité, option, sortie au premier geste, manette, onglet caché) |
| DEMO-02 | DEMO | moyenne | confirmé | P2 | meilleure | FDemo.director : un ordonnanceur de plans commun aux deux réalisateurs existants |
| DEMO-03 | DEMO | haute | confirmé | P0 | meilleure | FDemo.runner : enchaînement des scènes et endurance (rotation, surveillance de blocage, exceptions, transitions) |
| DEMO-04 | DEMO | haute | confirmé | P0 | meilleure | Pilote automatique de METAL : un joueur artificiel piloté par l'état, qui termine les mondes |
| DEMO-05 | DEMO | haute | confirmé | P1 | identique | Navigation du pilote : l'A* refait hors simulation coûte jusqu'à 55-90 ms sur un pas |
| DEMO-06 | DEMO | moyenne | confirmé | P1 | identique | Disques de propulsion absents du graphe de navigation : le pilote boucle dessus |
| DEMO-07 | DEMO | haute | confirmé | P1 | sans objet | Garde-fous de survie : sans aide le pilote meurt, et les reprises sur point de reprise sont refusées |
| DEMO-08 | DEMO | moyenne | confirmé | P2 | sans objet | FDemo.recorder : format d'enregistrement d'entrées compact et versionné (28,8 Ko/min brut, 9 à 12 Ko/min compressé) |
| DEMO-09 | DEMO | haute | confirmé | P1 | identique | Quatre sources de divergence à fermer dans la boucle de METAL avant tout rejeu |
| DEMO-10 | DEMO | haute | confirmé | P1 | identique | Le rejeu comme banc reproductible : même séquence, même état, temps comparables |
| DEMO-11 | DEMO | haute | confirmé | P0 | meilleure | Mode démo dans game.js sans effet de bord : sauvegarde, atelier, pointeur, son, sortie sans rechargement |
| DEMO-12 | DEMO | moyenne | confirmé | P2 | meilleure | Mise en valeur : une démo qui part du monde 1 tire au pistolet 74 % du temps et ne lance aucune roquette |
| DEMO-13 | DEMO | moyenne | plausible | P2 | sans objet | Critères d'acceptation et tests de la démo (durée, mémoire, sortie, déterminisme) |
| DEMO-V1 | DEMO | haute | ajout |  | meilleure | L'Onde de choc du colosse cause toutes les morts du pilote : sans elle, 0 mort sans aucune aide |
| DEMO-V2 | DEMO | haute | ajout |  | identique | snapshot() modifie l'IA et l'empreinte du prototype ne le voit pas : il faut une empreinte pure fournie par la simulation |
| DEMO-V3 | DEMO | haute | ajout |  | meilleure | Un pas fixe de 60 Hz sans interpolation rend la démo saccadée sur les écrans 120, 144 et 240 Hz |
| DEMO-V4 | DEMO | moyenne | ajout |  | sans objet | Reprendre un point de reprise puis rejouer les entrées ne redonne pas la même partie : pas d'image clé, donc pas de tampon circulaire |
| PDR-01 | PDR | critique | confirmé | P1 | identique | FERRO v0.2 ne peut pas porter l'essai 0.2 : il manque les passes du jeu, le contexte GL et la bibliothèque d'éclairage |
| PDR-02 | PDR | moyenne | plausible | P3 | identique | Décor en un seul lot : 1,09 M de triangles par image dont 16 % utiles en vue par défaut ; fx.lots et setLots à unifier avec découpage par tuiles |
| PDR-03 | PDR | haute | confirmé | P1 | identique | renderStatic compare 27 526 entrées à elles-mêmes deux fois par image : 97 % du CPU de draw() sur le décor fixe |
| PDR-04 | PDR | haute | confirmé | P1 | meilleure | Lampes du jeu inutilisables vues de haut : écartées au-delà de 196 m de l'œil, 3 au plus, et l'éclat d'un feu dépend de son rang |
| PDR-05 | PDR | moyenne | plausible | P2 | visuellement identique | Voile du brouillard de guerre : une bifurcation du shader du monde à transformer en masque au sol générique |
| PDR-06 | PDR | moyenne | plausible | P2 | identique | Réglages d'image à chaud absents de FERRO : MSAA coupé par image, luminosité et vignettage faits en CSS par-dessus le canvas |
| PDR-07 | PDR | haute | confirmé | P0 | meilleure | Mode démo : trois jeux, deux mises en œuvre dupliquées, aucune dans METAL ; un contrôleur FDemo et un réalisateur communs, avec une démo qui s'enchaîne sans fin |
| PDR-08 | PDR | haute | confirmé | P1 | meilleure | Cadence : le limiteur d'images du jeu tombe à 37,5 images/s sur un écran 75 Hz et fait descendre la résolution à 65 % quand on limite à 30 |
| PDR-09 | PDR | moyenne | plausible | P2 | sans objet | Simulation dans un travailleur : l'hôte, le repli sur le fil principal et les rôles de build sont génériques et manquent à FERRO |
| PDR-10 | PDR | moyenne | plausible | P2 | identique | FAudio, FMusic et FOptions ne sont pas réutilisables tels quels : le jeu a réécrit 168 Ko ; séparer le mécanisme des données et récolter cinq apports |
| PDR-11 | PDR | moyenne | confirmé | P1 | sans objet | Entrées : aucune manette dans Point de rupture, une complète dans BITUME, aucune dans METAL ; un module FInput commun, avec la navigation des menus |
| PDR-12 | PDR | basse | plausible | P2 | sans objet | Récolte et budgets : la récolte lit des dossiers qui bougent, ne voit pas l'essai 0.2, et aucun test ne borne le travail GPU par image |
| PDR-V1 | PDR | haute | ajout |  | meilleure | « Démo qui dure » : sur Marseille (ville par défaut), toutes les démos de Point de rupture sont la même bataille, la graine n'a aucun effet |
| PDR-V2 | PDR | haute | ajout |  | meilleure | Démo de METAL : il manque un pilote capable de traverser un niveau ; la navigation de la simulation n'est ni exposée ni neutre pour l'IA, et rien ne garantit que la démo ne reste pas bloquée |
| TACT-01 | TACT | haute | confirmé | P1 | meilleure | Le pouce droit ne peut pas viser en tirant : 0 % du temps de tir avec visée |
| TACT-02 | TACT | haute | confirmé | P1 | meilleure | Manche à centre fixe de 34 px, sans zone morte, sur 8,8 % de la bande gauche, et aucune course au tactile |
| TACT-03 | TACT | haute | confirmé | P1 | meilleure | Visée tactile linéaire : demi-tour en 0,70 à 1,68 s, et un deuxième doigt vole la visée |
| TACT-04 | TACT | moyenne | confirmé | P2 | meilleure | Ordres ponctuels au tactile : 10 à 19 % d'appuis courts perdus à 20–30 images/s, et un tap sur le canvas émet un mousedown qui tirera dès que LOOP-06 sera appliqué |
| TACT-05 | TACT | haute | confirmé | P1 | meilleure | 7 à 9 cibles tactiles sur 12 sous 48 px (minimum 14 px) et 2 à 4 chevauchements par format ; grille en arc avec saut et frappe validée à 0 et 0 |
| TACT-06 | TACT | moyenne | plausible | P2 | meilleure | Zones sûres perdues en paysage et commandes hors de portée : le tir est à 34–41 % de la hauteur de l'écran |
| TACT-07 | TACT | moyenne | confirmé | P1 | meilleure | Lisibilité mobile : la moitié des textes du HUD fait moins de 8 px (minimum 4,5 px), et l'invite de départ dit « clic droit » sur téléphone |
| TACT-08 | TACT | haute | confirmé | P1 | meilleure | Détection tactile figée au démarrage : sur un PC à écran tactile, la souris ne vise plus |
| TACT-09 | TACT | haute | confirmé | P1 | identique | Couche d'entrées commune : même structure sur les trois appareils et hash égal à flux égal, mais assist dépend de l'appareil et le pas variable empêche de rejouer une session |
| TACT-10 | TACT | moyenne | plausible | P3 | visuellement identique | Formats téléphone : même image interne à DPR 2 et 3, et un gouverneur de résolution qui n'agit que sur 24 à 33 % du GPU |
| TACT-11 | TACT | moyenne | plausible | P3 | identique | RCPU-01 en portrait : le cône de sélection gonfle les statiques visibles de 129 % et les instances de 32 % |
| TACT-12 | TACT | moyenne | plausible | P2 | meilleure | Portrait : 41,7° de champ horizontal avec le FOV vertical de 79° ; l'élargir à 60° ne coûte que 3,6 % de triangles |
| TACT-13 | TACT | basse | plausible | P3 | meilleure | Gyroscope en option, désactivée par défaut, pour la visée fine |
| TACT-V1 | TACT | haute | ajout |  | meilleure | « Démo qui dure » sur téléphone : rien n'empêche la mise en veille, ni plein écran ni orientation, et aucune démo dans METAL |
| TACT-V2 | TACT | moyenne | ajout |  | meilleure | 16 à 22 % de l'écran avale les touchers sans rien faire : radar, bandeau du haut et objectif ne laissent pas passer la visée ni le manche |
| SAUT-01 | SAUT | critique | confirmé | P0 | meilleure | Le clip de 2,4 m laisse sortir dans 14 mondes sur 21 ; un mur joueur sans plafond, lié au muret debout, donne 0 sortie, 0 raccourci et 0 cul-de-sac |
| SAUT-02 | SAUT | haute | plausible | P2 | meilleure | Sans confinement, le saut ouvre des raccourcis : 12 objets de progression atteints un stade trop tôt dans v2-00, 6 dans v2-01 |
| SAUT-03 | SAUT | haute | confirmé | P0 | meilleure | La règle de chute mortelle sur le substrat se déclenche sur de simples sauts : la fonder sur la hauteur de chute, pas sur la vitesse d'impact |
| SAUT-04 | SAUT | moyenne | confirmé | P2 | meilleure | La 0.8.0 laisse déjà sortir à pied : chute du quai haut d'un ascenseur sur la crête d'un mur de quai, puis marche sur les murets |
| SAUT-05 | SAUT | haute | confirmé | P1 | meilleure | Points de reprise : faire partir le saut tamponné au pas suivant ; un rebond dans land() retarde la reprise de 10,4 s et un instantané en montée est illisible |
| SAUT-06 | SAUT | moyenne | confirmé | P3 | sans objet | IA contre joueur perché : la ruée est annulée dès 0,72 m, mais les dégâts ne baissent que de 0 à 21 % ; ne pas toucher à la portée verticale |
| SAUT-07 | SAUT | moyenne | confirmé | P3 | sans objet | Précision ennemie : 0 touche contre une cible en cercle dès 5,4 m/s ; élargir la borne de vitesse (IA-11) ne change rien, il faut un calcul d'interception |
| SAUT-08 | SAUT | moyenne | confirmé | P3 | identique | Cache à marge RCPU-01 : sans effet à 10,5 m/s, mais +46 à +60 % de reconstructions à 300°/s ; marge angulaire adaptative |
| SAUT-09 | SAUT | basse | plausible | P3 | sans objet | Physique 2,5D : aucun blocage, aucune traversée ni chute sous le terrain sur 7,76 millions de vols ; pas de marche d'escalier aérienne à ajouter |
| SAUT-10 | SAUT | haute | confirmé | P1 | identique | Tests à ajouter avant de livrer le saut, et preuve que le profil legacy reste identique |
| SAUT-11 | SAUT | moyenne | confirmé | P2 | sans objet | Plafond de vitesse : 10,5 m/s est atteint en 1 s environ, pas en 10 sauts ; le garder, mais le traiter comme la vitesse normale de déplacement |
| SAUT-V1 | SAUT | moyenne | ajout |  | meilleure | La sortie et les raccourcis existent déjà en 0.8.0 : le pistolet à munitions infinies ouvre n'importe quel muret en 2 à 6 s, et le clip de SAUT-01 ne ferme pas cette voie |
| SAUT-V2 | SAUT | moyenne | ajout |  | meilleure | Une coupe de balle laisse une lamelle de collision de 4 cm qui bouche une brèche visiblement ouverte ; avec le clip de SAUT-01 elle devient un mur infini |
| MIX-01 | MIX | haute | confirmé | P0 | meilleure | Les armes sont légères parce qu'elles sont basses et sans corps dans le mixage, pas parce que la chaîne les écrase : les recettes doomish règlent la marge, à passer par une table de recettes |
| MIX-02 | MIX | moyenne | confirmé | P1 | identique | Le compresseur de FEEL-07 ne rend pas de transitoire : il baisse tout le mixage de 0,8 dB, à cause du gain de rattrapage caché du navigateur |
| MIX-03 | MIX | haute | plausible | P3 | dégradée | Le duck fait pomper toute la musique de 7 dB, et celui de FEEL-07 de 9 à 10 dB : un duck en étagère basse tient la cible de 4 dB sans perdre de marge |
| MIX-04 | MIX | moyenne | confirmé | P1 | meilleure | Préréglage « Doom » mesuré : armes +3 dB, limiteur −9/6/8 et duck en étagère tiennent les cinq cibles ; avec le compresseur actuel, +3 dB fait pomper |
| MIX-05 | MIX | haute | confirmé | P1 | meilleure | L'annonce du boss est 26 à 29 dB sous la musique dans le mixage ; avec les valeurs de BOSS-04 elle reste 7 à 11 dB dessous |
| MIX-06 | MIX | basse | confirmé | P3 | sans objet | Polyphonie : aucune voix volée, pic de 14 voix pour un plafond de 32 à 48 ; les recettes longues ajoutent 1 à 2 voix |
| MIX-07 | MIX | moyenne | confirmé | P3 | visuellement identique | 62 % de la charge du fil audio vient du graphe au repos : six boucles d'ambiance tournent en permanence à gain nul |
| MIX-08 | MIX | basse | confirmé | P3 | visuellement identique | LOOP-14 : le dédoublonnage strict retire 85 à 89 % des automatisations pour −124 dB de différence ; les seuils proposés au premier tour échouent au test de nullité |
| MIX-09 | MIX | basse | confirmé | P2 | identique | LOAD-13 : l'ordre et le découpage de la préparation audio ne changent rien, bit à bit |
| MIX-10 | MIX | moyenne | confirmé | P1 | meilleure | Musique : boucles de 45 à 77 s, trop courtes pour une démo qui dure ; une variation par graine de +998 octets donne 271 à 461 s sans répétition de 16 mesures |
| MIX-11 | MIX | moyenne | confirmé | P1 | sans objet | FERRO n'a ni test ni banc audio : reprendre le banc de mixage hors ligne et permettre d'injecter le contexte |
| MIX-V1 | MIX | moyenne | ajout |  | meilleure | L'ondulation de la musique à la cadence du pistolet se corrige par la tenue seule (0,36 s), sans étagère ni perte de marge |
| MIX-V2 | MIX | moyenne | ajout |  | meilleure | Le duck de la musique ignore le volume des effets : à 20 % d'effets, la musique plonge toujours de 6,9 dB pour des tirs presque inaudibles |
| MIX-V3 | MIX | moyenne | ajout |  | meilleure | Démo qui dure : la variation de MIX-10 ne change que la batterie ; permuter les mesures des guitares (+172 octets) donne de vrais riffs variés sans note nouvelle |
| MIX-V4 | MIX | moyenne | ajout |  | identique | Démo qui dure : le mixage tient 8 minutes sans dérive, mais il manque un état audio « démo » et la mise en veille du contexte (menu, pause, onglet caché) |
| MURS-01 | MURS | haute | confirmé | P0 | meilleure | La règle : une classe de dégâts portée par l'appel, un blindage par groupe, et la liste des sources lourdes |
| MURS-02 | MURS | haute | confirmé | P0 | sans objet | Définir le mur par les données existantes : le drapeau structural ne sert à rien, et les murets comptent plus que les murs |
| MURS-03 | MURS | haute | confirmé | P1 | meilleure | Fluidité : la règle retire 46 à 66 % des reconstructions du monde en combat et 69 à 76 % des gravats |
| MURS-04 | MURS | haute | confirmé | P1 | meilleure | Une balle de pistolet fait tomber une colline de 9 m ; relief et sols doivent être indestructibles |
| MURS-05 | MURS | moyenne | confirmé | P2 | meilleure | Portes verrouillées : 9 balles contournent le mécanisme |
| MURS-06 | MURS | critique | confirmé | P0 | identique | Ne rien écrire dans l'objet monde : un champ casse les sauvegardes ou 8 tests à empreintes dorées |
| MURS-07 | MURS | moyenne | plausible | P2 | meilleure | Retour vif quand une balle frappe un mur blindé : étincelles, éclats, marque, viseur et indice |
| MURS-08 | MURS | basse | plausible | P3 | meilleure | Son de ricochet sans toucher à la banque PCM |
| MURS-09 | MURS | moyenne | confirmé | P2 | sans objet | Progression : aucun monde n'exige de percer, mais le calendrier des armes lourdes n'est pas celui de l'énoncé |
| MURS-10 | MURS | moyenne | confirmé | P2 | sans objet | Derrière les murs il n'y a rien : chaque brèche de salle donne sur une chute mortelle, et les murets sont des garde-corps |
| MURS-11 | MURS | basse | confirmé | P3 | identique | Un coup de pompe reconstruit les tableaux de destruction jusqu'à 14 fois dans le même pas |
| MURS-12 | MURS | moyenne | confirmé | P1 | sans objet | Tests : 260 verts sur 261 avec la règle, un test à réécrire, et rien ne couvre le comportement changé |
| MURS-13 | MURS | basse | plausible | P3 | sans objet | Mode démo : une séquence « brèche » qui montre la règle sans tuer le pilote |
| MURS-V1 | MURS | haute | ajout |  | sans objet | Huit tests à empreintes dorées sont déjà rouges sur 673d6b2 intact : la référence de non-régression est fausse |
| MURS-V2 | MURS | moyenne | ajout |  | meilleure | Classer lourd par « grenade ou roquette » : l'écrasement d'un colosse ouvre un garde-corps d'arène dans le prototype |
| MURS-V3 | MURS | moyenne | ajout |  | meilleure | Le ricochet et l'indice « BLINDAGE » se déclenchent sur les collines, les sols et l'herbe rattachée aux murets |
| MURS-V4 | MURS | moyenne | ajout |  | meilleure | Sols en classe « lourd seulement » plutôt que « jamais » : presque tout le gain, sans perdre les traces d'explosion |
| NATIF-01 | NATIF | critique | confirmé | P1 | meilleure | « Auto » ne rend à la résolution native sur aucun écran à partir du 1080p : plafond de DPR à 1,5 et budget de 1,8 MPix |
| NATIF-02 | NATIF | haute | confirmé | P2 | meilleure | Le tampon du canvas ne tombe pas sur les pixels physiques quand la taille CSS ou le DPR est fractionnaire : un pixel d'écart retire 75 % du contraste fin |
| NATIF-03 | NATIF | haute | confirmé | P0 | meilleure | Le gouverneur baisse la résolution jusqu'à 42 % des pixels du mode Auto : le remplacer par une vigie qui ne touche jamais à l'image |
| NATIF-04 | NATIF | haute | confirmé | P2 | meilleure | Les préréglages mêlent résolution et détail : « Économie » vaut 0,8 fois la taille CSS sans bloom ni ombres, « Haute » plafonne à DPR 2 |
| NATIF-05 | NATIF | haute | confirmé | P2 | sans objet | Coût à la résolution native sur M5 : 2,0 à 2,3 ms par mégapixel plus 1 à 3 ms fixes ; la boucle des 12 lumières pèse 34 à 41 % de l'image |
| NATIF-06 | NATIF | moyenne | confirmé | P2 | identique | Paquet exact (ciel après l'opaque, invalidateFramebuffer, ombre en profondeur seule) : image identique bit à bit, gain nul sur GPU Apple, à valider sur GPU à rendu immédiat |
| NATIF-07 | NATIF | moyenne | confirmé | P1 | visuellement identique | Branches exactes dans le shader du monde : −3,9 % à 5,94 MPix et −4,7 % en 4K, écart d'au plus 1 niveau sur moins d'un pixel par million |
| NATIF-08 | NATIF | moyenne | plausible | P3 | dégradée | Lumières à portée finie : sauter une lumière hors de portée est exact, mais la fenêtre de portée modifie l'image de 9 niveaux au plus ; −9 à −11 %, à décider par David |
| NATIF-09 | NATIF | moyenne | confirmé | P1 | dégradée | Le reflet limité à 4 lumières (RGPU-01) n'est pas sans différence visible à la résolution native : jusqu'à 42 niveaux d'écart |
| NATIF-10 | NATIF | moyenne | plausible | P3 | sans objet | Tri avant-arrière et pré-passe de profondeur : plus lents sur GPU Apple et image différente ; des faces coplanaires dépendent de l'ordre de dessin |
| NATIF-11 | NATIF | moyenne | plausible | P2 | sans objet | Passes d'ombre : coût fixe indépendant de la résolution ; borne supérieure mesurée d'un cache d'atlas |
| NATIF-12 | NATIF | moyenne | confirmé | P3 | dégradée | MSAA ×4 (option de FERRO utilisée par Point de rupture et BITUME) à la résolution native : +26 % de temps d'image et 265 Mo en 4K |
| NATIF-13 | NATIF | haute | plausible | P1 | sans objet | Banc intégré et protocole d'acceptation : temps GPU par passe, temps CPU par système, résolution réellement rendue, critères chiffrés par classe de machine |
| NATIF-14 | NATIF | basse | plausible | P3 | sans objet | Le halo du bloom est défini en pixels du tampon : son empreinte à l'écran rétrécit quand la résolution monte |
| NATIF-V1 | NATIF | haute | ajout |  | meilleure | Le natif imposé par défaut fait perdre le 120 Hz que le M5 tient aujourd'hui : choisir l'échelle une fois, par calibrage, sans jamais descendre sous l'Auto actuel |
| NATIF-V2 | NATIF | moyenne | ajout |  | sans objet | Poste oublié du modèle de coût : les matières procédurales pèsent 17,8 % de l'image en natif, et l'optimisation exacte évidente (bruits évalués à la demande) ne rapporte rien |
| PHYS-01 | PHYS | haute | confirmé | P0 | sans objet | État actuel : METAL 0.8 n'a aucun corps rigide — gravats qui s'ignorent, accessoires statiques, machines qui disparaissent |
| PHYS-02 | PHYS | haute | confirmé | P0 | meilleure | Noyau FPhys : un prototype maison de 365 lignes tient les piles et coûte 5 à 9 µs par corps éveillé et par image |
| PHYS-03 | PHYS | haute | confirmé | P0 | meilleure | Cadence et objets rapides : 60 Hz sans sous-pas fait s'écrouler la pile de 10 ; 120 Hz ne laisse rien traverser |
| PHYS-04 | PHYS | haute | confirmé | P0 | identique | Déterminisme : état identique entre processus et niveaux de JIT, à condition de trois règles d'écriture |
| PHYS-05 | PHYS | moyenne | confirmé | P1 | identique | Allocations : un double passé en argument est mis en boîte par V8 — 57 Ko par pas, ramenés à 0 par un tampon typé |
| PHYS-06 | PHYS | haute | confirmé | P1 | identique | Sauvegardes : restauration exacte seulement avec le cache d'impulsions ; format compact et validation par bornes |
| PHYS-07 | PHYS | haute | confirmé | P0 | meilleure | Étape A — accessoires physiques : caisses, barils, palettes, tuyaux et tôles qui réagissent aux tirs, aux explosions et aux corps |
| PHYS-08 | PHYS | haute | confirmé | P1 | meilleure | Étape B — gravats en vrais corps rigides : ils roulent, s'entassent, s'endorment, et les points de reprise passent |
| PHYS-09 | PHYS | moyenne | plausible | P2 | meilleure | Étape C — les machines détruites se disloquent en pièces physiques au lieu de disparaître |
| PHYS-10 | PHYS | haute | plausible | P1 | meilleure | Étape D — contrôleur de personnage en capsule : pousser, monter sur les objets, saisir, lancer, frapper au bouclier |
| PHYS-11 | PHYS | moyenne | plausible | P3 | meilleure | Étape E — articulations et éléments de niveau : charges suspendues, passerelles, bascules, portes battantes |
| PHYS-12 | PHYS | moyenne | plausible | P2 | meilleure | Dégâts cinétiques et sons d'impact par matière, tirés des impulsions de contact |
| PHYS-13 | PHYS | moyenne | plausible | P2 | meilleure | IA et navigation : les objets dynamiques doivent être vus comme obstacles, couverts ou choses à pousser |
| PHYS-14 | PHYS | moyenne | confirmé | P1 | identique | Budget CPU : coût fixe et test de paires à optimiser, et un gouverneur de réveil pour borner le pire cas |
| PHYS-15 | PHYS | basse | plausible | P3 | sans objet | Réutilisation : ce que BITUME et Point de rupture attendent du même noyau |
| PHYS-V1 | PHYS | haute | ajout |  | meilleure | Arêtes internes : une caisse qui glisse ou qu'on pousse sur des boîtes statiques jointives bute, saute de 16 à 45 cm et culbute |
| PHYS-V2 | PHYS | haute | ajout |  | meilleure | Réveil par île entière : une seule balle dans un tas endormi réveille 286 corps pendant 14 s (2,9 ms par image) et le tas se réarrange |
| PHYS-V3 | PHYS | moyenne | ajout |  | meilleure | Rapports de masses réels des gravats (0,035 à 160) non tenus : une dalle lourde avale les éclats, une pile lourd-sur-léger s'écroule |
| PHYS-V4 | PHYS | moyenne | ajout |  | meilleure | Objets minces : la tolérance d'appui de 5 mm enterre 40 % d'une tôle de 2 cm, et un choc la fait passer entièrement sous le sol |
| CIEL-01 | CIEL | haute | confirmé | P0 | meilleure | Remplacer la passe de ciel par un ciel en textures amorties : coût par pixel ×0,37 et qualité en hausse |
| CIEL-02 | CIEL | haute | confirmé | P0 | meilleure | Atmosphère physique (Rayleigh, Mie, ozone) à la place du dégradé à deux couleurs ; soleil autorisé sous l'horizon |
| CIEL-03 | CIEL | haute | confirmé | P0 | meilleure | Nuages en volume éclairés, cuits dans le dôme, à la place du bruit 2D blanc |
| CIEL-04 | CIEL | moyenne | confirmé | P1 | meilleure | Soleil, lune et étoiles : disque sept fois trop grand et uni, nuit sans astres ; étoiles à dessiner en points |
| CIEL-05 | CIEL | moyenne | confirmé | P1 | meilleure | Bandes de couleur : aucune trame nulle part ; un tramage en bruit blanc les supprime |
| CIEL-06 | CIEL | haute | plausible | P1 | meilleure | Lumière du soleil et lumière ambiante réglées à la main, sans lien avec le ciel : les dériver du ciel |
| CIEL-07 | CIEL | moyenne | plausible | P1 | meilleure | Brouillard d'une seule couleur, différente de l'horizon : le tirer de la table du ciel (perspective aérienne) |
| CIEL-08 | CIEL | moyenne | plausible | P2 | meilleure | Reflets : le décor reflète un autre ciel que celui qu'on voit |
| CIEL-09 | CIEL | basse | plausible | P3 | meilleure | Ombres de nuages qui glissent sur le sol |
| CIEL-10 | CIEL | haute | confirmé | P0 | meilleure | METAL : 18 mondes mais 3 ciels ; donner un ciel distinct à chaque monde sans toucher à la génération |
| CIEL-11 | CIEL | haute | confirmé | P0 | identique | API de ciel de FERRO : préréglage dans l'atmosphère, chemin actuel conservé, secours Canvas 2D et paliers mobiles |
| CIEL-12 | CIEL | moyenne | plausible | P1 | identique | Intégration dans l'image : ciel après l'opaque, cuisson suspendue en intérieur, compilation différée |
| CIEL-13 | CIEL | moyenne | plausible | P2 | meilleure | BITUME et Point de rupture : mêmes textures de ciel, besoins différents |
| CIEL-V1 | CIEL | haute | ajout |  | meilleure | Le bloom du moteur va voiler tous les nouveaux ciels : seuil appliqué à l'image déjà tonalisée, ciel compris |
| CIEL-V2 | CIEL | haute | ajout |  | meilleure | Soleil bas ou sous l'horizon : séparer l'astre visible de la direction d'éclairage, sinon les arènes perdent leur soleil et leurs ombres |
| CIEL-V3 | CIEL | haute | ajout |  | identique | Crêtes d'horizon : oubliées par le prototype (27 % du coût actuel) ; et le ciel hérité gagne 35 à 45 % avec deux bornes exactes, image identique au bit près |
| CIEL-V4 | CIEL | moyenne | ajout |  | meilleure | Dôme de nuages : 4 à 8 texels par degré contre 16 à 21 pixels à l'écran, stries à l'horizon, 33,5 Mo en RGBA16F |

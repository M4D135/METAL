# Architecture et décisions — FERRO 0.4

## Une distribution autonome et procédurale

`python3 tools/build.py` rassemble six modules JavaScript, l’interface et les styles dans `dist/index.html`. Ce fichier contient le jeu autonome. Il n’utilise aucune image, texture, police, piste audio ou géométrie téléchargée, aucun CDN et aucune bibliothèque d’exécution externe.

Le code décrit les opérations qui construisent les primitives, leurs assemblages, les matériaux et les sons. Les dimensions des salles, les placements et les variations restent déterministes pour une même graine et un même étage. Cette petite distribution s’appuie sur les API du navigateur ; elle n’inclut donc ni le navigateur, ni les pilotes graphiques, ni le système. `SIZE.json` distingue les tailles brutes et compressées.

| Module | Responsabilité |
| --- | --- |
| [`world.js`](../src/world.js) | Topologie, architecture, collisions, placements, machines et dangers déterministes. |
| [`simulation.js`](../src/simulation.js) | Déplacements, tirs, ennemis, objectifs, score et checkpoints, sans DOM ni stockage. |
| [`motion.js`](../src/motion.js) | Présentation amortie indépendante de la visée et des collisions ; montage cohérent des pièces de l'arme. |
| [`renderer.js`](../src/renderer.js) | Géométries, matériaux, éclairage et rendu WebGL 2 ; secours logiciel Canvas 2D. |
| [`audio.js`](../src/audio.js) | Synthèse Web Audio, musique, ambiances et effets. |
| [`game.js`](../src/game.js) | Écrans, entrées clavier/tactiles, boucle d’animation, modèles animés, HUD et stockage local. |

## Trois territoires et des chemins garantis

Les secteurs possèdent des graphes de circulation distincts, avec des boucles qui permettent de contourner les rencontres. La génération 4 espace les régions et mêle zones extérieures et bâtiments. Le joueur commence dehors dans les trois secteurs.

| Secteur | Régions | Liaisons | Régions extérieures | Liaisons extérieures |
| --- | ---: | ---: | ---: | ---: |
| Lisière rouillée | 9 | 10 | 5 | 7 |
| Carrière des braises | 8 | 9 | 5 | 9 |
| Jardins du veilleur | 9 | 12 | 5 | 12 |

Les murs et équipements solides possèdent des volumes de collision cohérents avec leur géométrie. Les positions du joueur, des relais, des soins, des ennemis et de la sortie sont vérifiées sur le sol accessible. Les ventilateurs, pistons et réacteurs exposent des paramètres d’animation dans `world.machinery` ; l’habillage animé est construit par `game.js`.

Le déplacement reste sur un sol horizontal. Les structures élevées sont décoratives : cette version n’a pas de plateformes traversables à plusieurs hauteurs, de saut ou de multijoueur. Les vents de vapeur sont des dangers temporels, placés à l’écart des axes indispensables. Le troisième étage contient le boss et ses couverts.

Les troncs, grands rochers et limites extérieures appartiennent à la géométrie physique. Chaque collider pointe vers son mesh visible avec `mesh`, et ce dernier porte `solid:true`. Les centres des cours et des chemins extérieurs n'ont ni plafond ni habillage suspendu. Murets, clôtures et fronts rocheux ferment visiblement les limites du parcours ; le flood fill de contrôle vérifie aussi l'absence de sortie vers le vide sans utiliser le masque de sol.

Les passes `detailWorld` et `naturalDetails` s'exécutent après la génération physique avec leurs générateurs déterministes indépendants. L'habillage industriel saute les extérieurs ; la passe naturelle ajoute herbes, fougères, brindilles, champignons, fleurs, lierre et petits éléments de surface. Les silhouettes essentielles, notamment troncs et grandes canopées, restent en `detail:0`. Les ajouts sont répartis entre `detail:1` (habillage) et `detail:2` (microdétails). Les plafonds sont de 16 000 primitives statiques et 500 colliders par monde.

`world.environment` décrit le biome, les couleurs du ciel, du brouillard, de l'ambiance et du soleil, sa direction normalisée, le vent et les rectangles `outdoorZones`. Chaque mesh statique possède un booléen `outdoor`. `world.walkable` décrit l'union des sols horizontaux ; `trees`, `outdoorBoundaries` et `natureStats` rendent les éléments naturels contrôlables dans les tests.

`world.ambience` décrit les balises, écrans et petits effets près des machines. Les écrans donnent leur normale, largeur et hauteur pour garder leur animation sur leur face. Ces effets n'infligent aucun dégât ; les évents dangereux restent dans `world.hazards` avec leurs annonces distinctes.

## Simulation et temps

`FSimulation.create(world)` retourne `state`, `step(dt,input)`, `fire(assist)`, `pulse()`, les méthodes de collision et de visibilité, la grille de navigation, `snapshot()` et `restore(data,options)`.

La boucle du navigateur conserve jusqu’à **0,12 seconde** de temps écoulé par image puis le divise en sous-pas d’au plus **1/60 seconde**. Le déplacement et le tir continu sont appliqués à chaque sous-pas ; le mouvement de souris, l’esquive et l’onde sont consommés au premier. La boucle s’arrête si le joueur meurt ou termine l’étage. Les événements de relais sont traités à chaque sous-pas afin d’enregistrer le checkpoint avant un éventuel dégât létal ultérieur.

Le plafond interne de `step()` à 0,05 seconde demeure une protection pour les appels directs. Il ne limite plus toute une image du jeu à 0,05 seconde. Les images dépassant 0,12 seconde perdent volontairement le temps excédentaire pour éviter une longue rafale de simulation après une suspension ; ce n’est pas une simulation à pas fixe avec rattrapage illimité.

Les déplacements sont eux-mêmes subdivisés en segments courts pour éviter de traverser les cloisons fines. Le joueur utilise un disque horizontal de rayon 0,28 m ; les ennemis ordinaires utilisent 0,38 m et le boss 1,05 m. L’esquive, le recul de l’onde et les charges passent par les mêmes collisions.

Les ennemis calculent des chemins A* vers leurs propres objectifs sur une grille de 0,8 m : patrouille, observation mémorisée, flanc, couvert ou sortie de couvert. Une recherche explore au plus 2 400 entrées, conserve au plus 512 points et simplifie une fois le chemin avec balayage du volume physique. Les passages tiennent compte des obstacles bas et de l'union des sols ; la visibilité seule ne suffit pas à déclarer un passage praticable. Les arêtes déjà contrôlées sont mises en cache. Le champ `nav.dist` demeure disponible pour la compatibilité des contrôles, mais ne guide plus les ennemis vers la position cachée du joueur.

### Mouvement et présentation

L'inertie du joueur est intégrée dans la simulation, avec accélération progressive et freinage plus rapide. La direction de visée est appliquée immédiatement. `state.locomotion` expose la vitesse effectivement obtenue après collision, ses composantes locales, l'accélération, les transitions de marche/course/esquive et une phase de foulée fondée sur la distance parcourue. Ce sont ces valeurs qui animent la marche et déclenchent les pas, jamais la seule présence d'une touche pressée.

`FMotion.create()` fournit `update`, `impulse` et `reset`. Les canaux de présentation utilisent des ressorts à amortissement critique intégrés analytiquement. Les événements de tir, changement d'arme, impact et onde excitent leurs ressorts. `update` retourne une petite translation/inclinaison de caméra, une variation de champ de vision et une pose de l'arme. Cette couche ne change ni le joueur ni la direction des tirs. Une reprise remet ces canaux au repos.

Les pièces de l'arme sont placées dans un même repère avec `mount` et `place`, qui composent correctement lacet, tangage et roulis. La rotation déplace les centres des pièces et leurs orientations ensemble. Les cylindres des canons conservent leur rotation locale ; ils ne se désassemblent pas lorsque le joueur regarde sur le côté ou penche la caméra.

Le réglage de mouvement désactivé remet immédiatement hauteur, roulis et variation de champ de vision à zéro. Il réduit aussi le mouvement décoratif de l'arme. Les tests dédiés comparent le résultat des ressorts à 20, 60 et 120 images/s et vérifient la rigidité du montage, y compris près d'une singularité d'angles d'Euler.

### Armes et onde

Les tirs du joueur utilisent de véritables rayons en trois dimensions, arrêtés par le premier obstacle. Les ennemis sont touchés au moyen de volumes sphériques approximant leur corps ; ce ne sont pas des collisions avec chaque triangle du modèle. L’assistance tactile élargit légèrement les volumes de visée.

| Action | Comportement |
| --- | --- |
| **Impulsion — `weapon:0`** | Un rayon, portée de 75 m, récupération de 0,165 s, +0,12 de chaleur. |
| **Fracture — `weapon:1`** | Sept rayons dispersés, portée de 24 m et dégâts décroissants, récupération de 0,78 s, +0,37 de chaleur. |
| **Onde — `input.pulse`** | Rayon de dégâts de 6,5 m, interruption des attaques, étourdissement et recul avec collisions ; dissipation des projectiles à moins de 7,5 m. |

La chaleur est commune aux deux armes. Une surchauffe bloque les tirs jusqu’au refroidissement ; changer d’arme ne contourne donc pas cette ressource. Fracture récompense les tirs proches et centrés, sans remplacer la précision d’Impulsion à distance.

L’onde prend immédiatement un délai de récupération de **7 secondes**, réduit la chaleur et n’endommage pas les ennemis derrière un mur. `player.pulseCooldown` donne le délai restant et `state.pulseVisual` anime l’effet pendant 0,65 seconde. `state.shots` compte les déclenchements ; `state.hits` compte au maximum un tir réussi par déclenchement, même si plusieurs pellets touchent.

### Ennemis et télégraphes

| Type | PV initiaux | Comportement |
| --- | ---: | --- |
| 0 — éclaireur | 3 | Patrouille, investigation et recherche de flanc ; blessé, couvert puis sortie latérale. Tir précédé d’une visée de 0,65 s. |
| 1 — lourd | 5 | Patrouille puis pression sur la dernière position observée ; charge engagée après 0,9 s de préparation, ou projectile lent si la cible est éloignée. |
| 2 — tourelle | 4 | Position fixe ; préparation de 0,75 s puis rafale de trois projectiles. |
| 3 — boss | 30 | Déplacements limités dans l’arène ; éventails de cinq projectiles, puis sept après le passage à mi-vie. |

Chaque ennemi expose `windup`, `windupMax`, `attackState`, `yaw`, `stun` et `phase`. `attackState` vaut `idle`, `aim`, `burst`, `rush`, `recover` ou `stunned`. L’orientation suit la même convention que celle du joueur : **zéro regarde vers −Z**. Pendant une préparation ou une charge, la cible est verrouillée pour que l’animation annonce une direction que le joueur peut éviter.

La perception est réévaluée toutes les 0,15 s ; les décisions sont espacées de 0,65 à 0,75 s selon l'identifiant. Un ennemi au repos doit voir la cible dans son champ de vision et à portée ; la proximité immédiate ou une alerte élargit sa vigilance. Les murs continuent à couper la vue. Les tirs et l'onde peuvent transmettre une position sonore, avec portée atténuée par un obstacle. Un observateur partage sa dernière observation avec les voisins à moins de 12 m ; recevoir une alerte ne déclenche pas une propagation infinie dans le groupe.

`awareness` vaut `patrol`, `investigate`, `engage` ou `search`. `lastSeenX/Z` conserve l'observation, et `memory` expire sans nouvelle information. Une cible cachée ne met pas à jour le but de navigation. Les machines inspectent les alentours de leur dernière observation puis reprennent leur patrouille. `tactic` vaut `hold`, `advance`, `flank` ou `cover` et décrit le choix de déplacement.

Un éclaireur blessé examine les faces de solides assez hauts, vérifie qu'elles bloquent la vue depuis sa dernière observation et trouve un chemin praticable vers le couvert. Il y attend 1,1 à 1,4 s, puis cherche un point latéral d'où viser. Les machines mobiles se séparent par déplacements soumis aux collisions. `moveSpeed` mesure le déplacement obtenu et anime les jambes des lourds. Les PV, dégâts et télégraphes conservent leurs valeurs précédentes.

Les tirs ennemis sont des projectiles simulés, avec tests de collision sur leur déplacement. Le segment entre le corps et la bouche du canon est également contrôlé : un canon près d'un mur ne peut pas créer son projectile de l'autre côté. Une charge doit avoir une ligne de vue au moment du contact : elle ne peut pas blesser à travers une cloison fine. La seconde phase du boss est annoncée une seule fois. La sortie exige les trois relais **et** la destruction de tout boss encore vivant.

### Dangers, score et événements

Un vent expose `period`, `active` et `phase`. Il est actif lorsque `(time+phase)%period < active`, et annonce son activation pendant les 0,85 dernières secondes du cycle. La simulation expose `state.hazards[].hot` et `.warning`. Les dégâts ont un intervalle de 0,65 seconde, ce qui empêche de les appliquer à chaque image.

Le score récompense les ennemis, les relais, les soins et la sortie. Les éliminations successives dans une fenêtre de quatre secondes augmentent le multiplicateur ; subir des dégâts ou laisser expirer cette fenêtre coupe la série sans retirer les points acquis. Le boss rapporte davantage qu’un adversaire ordinaire.

La simulation ajoute les événements à `state.events` ; le module navigateur les consomme pour l’audio, les messages et les changements d’écran. Les nouveaux événements incluent `fracture`, `pulse`, `enemyShot`, `bossPhase` et `combo`. Les données des projectiles conservent leurs positions et vitesses, avec `kind` pour le type d’ennemi et `owner` pour son identifiant.

## Checkpoints validés et reprise

La simulation ne lit ni n’écrit `localStorage`. `snapshot()` produit un objet sérialisable indépendant du monde graphique :

```js
{
  version: 1, aiVersion: 1,
  format: 'FERRO',
  seed, stage, fingerprint,
  state: { /* joueur, ennemis et mémoire tactique, objectifs, armes, score, projectiles */ },
  timers: { fireWait, navWait, hazardWait }
}
```

`fingerprint` décrit les collisions, les placements, la sortie et les dangers. Le chargement vérifie la version, l’identité du monde, les types, les bornes numériques, les volumes occupés, les compteurs, les relais pris et la cohérence des états vivant/mort/boss. Les objets incomplets ou incompatibles sont refusés. Cette empreinte sert à détecter un monde différent ; ce n’est pas une signature de sécurité ou un mécanisme contre la triche.

`restore(data)` renvoie `true` ou `false`. Un refus ne modifie pas la partie. Une restauration valide conserve les références de `state` et `state.player`, restaure les états de combat puis reconstruit la navigation. Les particules, flashes et anciens événements ne sont pas rejoués. Le mode par défaut restaure exactement le combat enregistré, notamment les projectiles et les préparations d’attaque.

Pour le bouton de reprise, le navigateur utilise **`restore(data,{recover:true})`**. Après validation, une partie active reçoit **1,4 seconde de protection contre les dégâts**, et les projectiles situés à moins de **2,4 m** sont dissipés. Cela évite de recharger directement dans une collision létale. Cette protection est transitoire, n’est pas sérialisée et est supprimée par une restauration sans option. Lire un snapshot ne change pas une protection en cours. Le mode de reprise ne ressuscite pas un checkpoint dont l’état est déjà mort ou terminé.

Le module navigateur enveloppe ce snapshot dans le format suivant :

```js
{ version: 2, generation: 4, seed, stage, runStats, checkpoint: sim.snapshot() }
```

Il l’enregistre sous **`ferro-expedition-v2`** à l’entrée d’un étage et après chaque relais. La version 2 de l’enveloppe et la version 1 du snapshot désignent deux formats distincts. Les statistiques des étages précédents restent dans `runStats`. La reprise revient au dernier point enregistré ; les actions postérieures à ce point ne sont pas conservées. Si le stockage local est indisponible, le checkpoint reste utilisable pendant la session courante.

`aiVersion:1` indique la présence d'une mémoire tactique validée, de chemins et de leurs temporisateurs. Pour un ancien snapshot compatible sans champs IA, la migration importe au plus la visée qui y était déjà enregistrée, sans inventer une observation de la position actuelle du joueur. Une mémoire mal formée provoque le même refus atomique que les autres données.

La génération du terrain est indépendante du format de sauvegarde. Pour une enveloppe antérieure à la génération 4, ou un snapshot devenu incompatible, le shell redémarre à l'entrée du **même secteur**, en conservant graine, arme et statistiques des secteurs terminés. Il sauvegarde ce nouveau point et explique la reprise dans un message. L'ancien point est copié sous `ferro-expedition-v2-before-horizons` si possible, sans écraser une sauvegarde de migration déjà présente. Les tests du shell actionnent le vrai bouton Continuer et vérifient les écritures de stockage.

## Rendu WebGL et secours logiciel

Le chemin principal utilise **WebGL 2** et le dessin instancié de primitives. La géométrie statique est préparée une fois ; les personnages, machines, projectiles et effets sont actualisés à chaque image. Les matériaux calculent joints, grain, motifs métalliques et reflets, avec brouillard et éclairage directionnel/local.

Les modes **Auto** et **Haute** emploient un atlas de profondeur pour **une lampe locale, le soleil directionnel et une torche décalée**. Chaque vue mesure respectivement **512×512** ou **1024×1024**, dans un atlas de deux cases de côté. Le soleil couvre un voisinage de 56 m en Auto et 72 m en Haute, stabilisé sur la grille de texels. Les mondes sans environnement conservent les deux plafonniers et la torche. Les microdétails sont exclus des casters. Le halo lumineux utilise des cibles **RGBA8**. Ce dispositif ne calcule pas des ombres omnidirectionnelles pour toutes les lampes ; les passes restent conditionnées à des framebuffers complets.

La profondeur des ombres est lue par un **sampler explicitement `highp`**. La comparaison GLES a montré que la précision implicite produisait des bandes sur les murs ; changer seulement le bias ne corrigeait pas la cause. Le bias et le déplacement du récepteur utilisent la normale géométrique, indépendamment du microrelief. Chaque lecture PCF compense aussi la différence de profondeur du plan récepteur au centre du texel échantillonné. Les bords du cône et sa limite de portée sont fondus progressivement.

Le soleil utilise neuf lectures PCF pondérées pour adoucir les contours ; lampe et torche en conservent quatre. Les feuilles bougent avec un vent léger, calculé avec les mêmes paramètres et le même temps dans les passes de couleur et d'ombre. Les matériaux naturels séparent terre/herbe, roche, écorce, feuillage et petites surfaces d'eau des motifs industriels. Le ciel est une passe procédurale sans texture, avec nuages, soleil et horizon. Les volumes opaques des bâtiments le masquent normalement.

La torche reste dans le rayon de collision du joueur : décalage de 0,16 m à droite et 0,08 m vers le bas. Cela évite de placer sa source de l'autre côté d'une cloison lorsque le joueur la longe. La normale de relief est bornée et les motifs fins sont atténués avec la taille du pixel pour limiter les artefacts à angle rasant.

Le mode **Économie** désactive l’ombre et le halo et réduit le nombre de lumières retenues. Les compteurs du renderer indiquent le backend et les passes réellement actifs ; le réglage demandé ne constitue pas à lui seul une preuve que chaque effet a été créé.

Si WebGL 2 est indisponible, le secours **Canvas 2D** projette les mêmes géométries 3D avec découpage au plan proche, élimination des faces arrière, tri de profondeur, éclairage simplifié et joints projetés. Les sols sont traités avant les faces et leurs joints partagent une grille mondiale. En Auto/Haute, il projette jusqu'à 18 silhouettes simplifiées sur les sols, puis les découpe au domaine visible des sols ; il ne reproduit ni les cartes d'ombre WebGL ni le halo. Le tri de surfaces peut présenter des imperfections aux intersections.

Les deux chemins emploient un index spatial par cellules de 8 m, des portées distinctes pour l'architecture, l'habillage et les microdétails, et un rejet hors champ. Le Canvas construit les géométries à la demande, rejette les très petits détails en pixels et borne leur nombre visible. Il emploie deux niveaux de facettes, regroupe les chapeaux de cylindres en faces et projette une fois les sommets partagés. Les canopées essentielles conservent leurs silhouettes ; la géométrie GPU n'est pas simplifiée. Le monde généré complet reste inchangé ; ces choix ne concernent que son affichage.

## Audio, stockage et portée des vérifications

Le son démarre sur un geste utilisateur. Oscillateurs, bruit synthétique, filtres, modulation et échos produisent toutes les ambiances et tous les effets. Les étages changent la palette musicale et la menace modifie son intensité. Fracture, l’onde, les tirs ennemis, la seconde phase du boss et les séries possèdent leurs effets. La pause coupe le son ; la reprise respecte le réglage du joueur. Le jeu reste utilisable si Web Audio est absent ou bloqué.

Le shell amortit la transition entre intérieur et extérieur et transmet l'environnement à l'audio. Vent et bruissement augmentent dehors, la réverbération diminue et les pas changent de timbre. Des appels d'oiseaux, sons secs ou insectes sont synthétisés selon le secteur ; leur niveau baisse avec la menace. L'événement `alerted` déclenche un signal de machine spatialisé, limité globalement à une fois toutes les 0,45 s pour éviter la superposition d'un groupe entier.

`ferro-settings` conserve les réglages ; `ferro-expedition-v2` conserve l’expédition. Aucune donnée de jeu n’est envoyée à un service : aucune télémétrie, aucun formulaire ni compte de jeu propre au projet. Une éventuelle authentification de l’hébergement relève de la plateforme de publication.

Les vérifications de [`checks/simulation.test.mjs`](../checks/simulation.test.mjs) couvrent les collisions, la visée 3D, les armes, les télégraphes, les dangers, la condition de victoire et la reprise validée, y compris le cas d’un projectile létal au chargement. Les vérifications de monde contrôlent séparément la connectivité et les placements. Ces tests ne remplacent ni une partie humaine complète ni un essai sur un téléphone réel.

Une exécution du chemin GLES par **Mesa llvmpipe** permet d’inspecter les shaders et leurs images sans GPU physique. Elle ne démontre ni les performances matérielles, ni la compatibilité d’un pilote donné, ni celle de Safari. Les résultats de validation doivent conserver cette distinction.

## Vers une version native

Un défi natif de type `.kkrieger` demanderait un portage des primitives, du rendu, du synthétiseur, des contrôles et du build vers les API du système. Il constituerait un chantier distinct : la taille du HTML autonome ne peut pas être présentée comme celle d’un exécutable natif équivalent.

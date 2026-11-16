# METAL

**Des ennemis de métal. Une bande-son metal.** Un FPS d’horreur et d’action entièrement procédural : 18 mondes, six chapitres, un arsenal à découvrir, des colosses, des territoires destructibles et des musiques MOD originales. Modèles, matériaux, animations, effets, instruments et compositions sont produits par le code. Aucun asset de jeu importé.

**Version 0.8.1 — Furie d’acier.** L’accueil reçoit une composition thrash metal originale à **212 BPM** : guitares saturées, basse, double grosse caisse, breaks et relances sur une boucle de **54 secondes**. Le premier clic, toucher ou geste clavier sur l’accueil déverrouille le son ; sa commande permet aussi de l’écouter ou de le couper sans lancer une expédition. La piste suit les volumes enregistrés, s’arrête au départ de l’assaut ou lorsque la page perd le focus, puis retrouve l’accueil au retour. Les trois musiques des mondes restent inchangées. Les instruments et le morceau sont entièrement synthétisés par le code, sans enregistrement importé ni reprise d’une composition existante. **V0.8.1** est affiché sur le titre depuis `package.json`. Voir les [vérifications de cette mise à jour](docs/qa-title-v081.md).

**Campagne Arsenal.** Départ au pistolet, armes et améliorations laissées par les boss, premier tiers consacré à l’équipement, douze mondes supplémentaires avec l’arsenal complet. Les grands panneaux-obstacles ajoutés devant les renforts sont supprimés de la nouvelle campagne. Les débris conservent leur forme, tombent et restent au sol. Les bruitages et les ambiances sont reconstruits avec des sons procéduraux distincts et des sources locales. Les clés de sauvegarde historiques `ferro-*` sont conservées.

## Déferlantes et machines humanoïdes — 0.12.0, 16 novembre 2026

Demandes de David du 16 novembre 2026. Le contenu des mondes est une révision enregistrée dans la sauvegarde (`hordeVersion` 1) : les nouvelles expéditions et la démo l’ont dès le premier monde ; une expédition en cours la reçoit au monde suivant ; un point de reprise antérieur regénère exactement son ancien monde.

- **Déferlantes à la Serious Sam.** Dans chaque monde, la plus grande salle profonde enchaîne, une fois son combat ordinaire gagné, trois à cinq vagues annoncées « Déferlante · vague n / N » : kamikazes hurlants, lames de métal liquide et tireurs endosquelettes. Ils arrivent par les entrées naturelles et le long des murs de la salle (une colonne de lumière marque l’arrivée), jamais à moins de 8 m du joueur ; jusqu’à 12 à 22 machines en même temps selon le chapitre, hors du plafond ordinaire de combattants.
- **Kamikazes.** Sans tête, deux charges rouges à bout de bras, ils courent à 6,1 m/s (plus vite qu’en marchant, moins qu’en sprint) en hurlant (voix synthétisée, trois au plus en même temps) et explosent au contact. Abattus de loin, ils explosent aussi et emportent leurs voisins : la chaîne est créditée au joueur.
- **Lames de métal liquide.** Corps humain en chrome, bras en lames une fois engagés ; elles approchent à 4,7 m/s et lèvent la lame 0,38 s avant de frapper (13 points).
- **Endosquelettes.** La moitié des tireurs lourds devient un squelette de chrome (crâne, yeux rouges, côtes, vérins) qui tient fusil, lance-grenades ou lance-roquettes au même canon que la simulation.
- **Gardiens variés.** Un monde sur trois garde le colosse robot ; les autres alternent un **endosquelette géant** et un **géant de métal liquide**, voûtés pour que le cœur visé reste exactement au point de la simulation, canons d’épaule à l’endroit d’où partent les tirs. Noms propres : L’Ossature de chrome, d’acier, primordiale ; Le Vif-Argent, Le Mercure hurlant, Le Métal liquide.
- **Livrées de chapitre** pour les robots ordinaires : désert, arctique, rouille, noir et toxique (le lourd jouable garde la sienne).
- **Corps humains d’EMPRISE.** Les surfaces viennent de l’humain paramétrique d’EMPRISE (même auteur), régénéré par le code à l’exécution : aucun modèle ni texture importé. Seize formes rigides (≈ 5 500 triangles en tout), posées articulation par articulation avec la marche à deux os d’EMPRISE ; au loin, des primitives simples. Designs originaux, sans nom ni dessin de film.
- **Beaucoup de munitions avant les déferlantes et les boss.** Deux caches complètes (cellules, cartouches, roquettes, grenades) dans la salle de la déferlante, une troisième à la porte du gardien ; munitions de l’arène doublées ; à chaque phase de boss, quatre caisses pleines (120 cellules, 24 cartouches, 8 roquettes ou 12 grenades) au lieu de deux.
- **Destructions en quelques morceaux.** Un objet détruit se brise en au plus cinq gros morceaux (environ 2,6 m, jamais plus de 4 m) confiés au moteur physique ; les tuiles que le moteur de destruction découpe sont recollées, plus de nuée d’éclats ni de redécoupage en douzaines de fragments. Un arbre passe de 128 pièces à 10, un tuyau de 56 à 16 au plus par explosion. Un impact de balle qui ne casse rien laisse un seul éclat. Une machine abattue laisse cinq pièces physiques au lieu de huit, trois dans une déferlante.
- **Petites configurations.** Au premier lancement, la puce graphique choisit un réglage : sur graphique intégré ancien (Intel HD/UHD, Mali, Adreno, Vega 3-8…) ou logiciel, qualité Économie, reflets, ombres et éclat coupés. En jeu, si la cadence reste sous 83 % de sa cible pendant environ 4,5 s, l’**allègement automatique** coupe un effet à la fois (reflets, ombres, éclat, puis détails) avec un message ; il se désactive dans Options › Image. **La résolution native n’est jamais baissée automatiquement** (décision du 14 novembre).

- **Articulations des boss (0.12.2).** Dans les mondes à déferlantes, plus de gros cœur : chaque gardien offre **quatre petites articulations lumineuses** (épaules et hanches, rayon 0,15 au lieu de 0,36 avant l’échelle), exposées pendant les mêmes fenêtres. Chacune encaisse environ un cinquième de sa vie ; **brisée**, elle ajoute un coup lourd, **le membre se détache et tombe avec la physique** (bras avec son canon d’épaule, ou jambe), reste au sol, et coûte au géant une salve (épaule) ou de la vitesse (hanche). Un géant humanoïde privé de ses jambes s’affaisse au sol, ses cibles avec lui (0.12.3). Les quatre brisées, il ne marche ni n’attaque plus et son cœur reste à nu pour l’achever. Les anciennes sauvegardes gardent le cœur unique.
- **Rendu, particules et physique (0.12.1).** Le métal liquide et l’endosquelette passent au métal poli du moteur (matériau 19, peu rugueux) qui renvoie les reflets de la scène ; articulations et kamikazes restent en acier brossé. Une casse soulève un nuage de poussière couleur de sa matière (pierre, bois, métal, verre, terre) qui couvre ce qui est parti en poussière ; une balle sur du métal fait jaillir des étincelles. Les machines humanoïdes abattues tombent en **corps articulés** (torse, tête, bras, jambes tenus par des rotules limitées, arme lâchée à part) ; le kamikaze est dispersé par ses propres charges. Troncs et tuyaux brisés roulent comme des capsules, le feuillage comme des boules.
Vérifications : `npm test` (dont `checks/horde.test.mjs`, `checks/humanoids.test.mjs`, `checks/wreckage.test.mjs`, `checks/perf.test.mjs`, `checks/ragdoll.test.mjs`), simulation de déferlantes complètes, captures WebGL 2 dans Chrome sur le Mac. Le ressenti sur un vrai portable à graphique intégré reste à confirmer sur la machine.

## Le lourd et son drone — 0.11.0, 16 novembre 2026

Décisions de David du 16 novembre 2026, appliquées aux nouvelles expéditions :

- **On commence avec le lourd, en vue à la première personne.** Chaque nouveau monde repart sur le lourd ; son drone léger attend un mètre au-dessus de sa tête, jamais dans son corps (moins sous un plafond bas).
- **Le léger est un drone piloté comme le lourd.** Les sticks le déplacent à plat, quelle que soit l’inclinaison de la visée ; **A/Croix monte, B/Rond descend** (Espace et R au clavier). Le boost (LB ou Maj) vaut 1,8 fois la vitesse et consomme le réservoir ; le vol de base reste illimité.
- **Deux canons jumeaux.** Le drone porte la même arme sur deux supports : chaque tir part des deux canons à 60 % des dégâts chacun (1,2 fois un tir simple), pour une seule munition et une seule montée de chaleur. Les deux gâchettes tirent ; le drone n’a pas de main gauche. La pompe et la mitraillette gagnées restent ses armes.
- **Vue 1re / 3e personne pour les deux personnages** : C au clavier, R3 à la manette, bouton 1P / 3P en haut de l’écran ou réglage dans les commandes ; le choix est enregistré. En troisième personne, la caméra suit le lourd par-dessus l’épaule droite et le drone par l’arrière ; elle se rapproche devant un mur et repasse à la première personne si elle n’a plus la place. Le viseur reste sur le point réellement atteint par le tir.
- **Le personnage laissé en attente reste visible en entier** (lourd ou drone), à l’endroit exact où on l’a quitté. Son repère ne s’affiche plus que s’il est hors de l’écran, trop loin ou derrière un mur.
- **Aide des commandes discrète** à gauche de l’écran, selon l’appareil (clavier ou manette, avec les glyphes Xbox ou PlayStation) et le personnage en main ; elle se masque dans les commandes. Elle est cachée sur écran tactile et sur les écrans bas ou étroits.
- **Mouvements.** Les boss pivotent à 60°/s (90°/s en phase 2) au lieu de sauter d’un coup ; leur cœur suit ce cap réel, contourner devient une esquive. Entre deux attaques, ils marchent lourdement à 1,2 m/s : ils avancent quand le joueur est à plus de 8 m de leur carcasse et reculent s’il se colle à leurs pieds ; chaque pas secoue la caméra et la manette. Les machines ne pivotent plus d’un coup à l’écran et un demi-tour sur place fait marcher leurs jambes (rendu seulement). En troisième personne, les jambes du lourd suivent le déplacement (pas chassés, recul) pendant que le torse et l’arme restent sur la visée.
- **Barre du Balayage.** La barre jaune qui flottait devant le boss pour annoncer le Balayage était un défaut : elle est remplacée par l’armement du boss (torse qui pivote, épaulières orange). La bande orange au sol reste l’alerte de la zone touchée.
- **Écran titre sans informations musicales (0.11.1).** Le bouton « Écouter le thrash » et l’état du morceau ne sont plus affichés ; la musique d’accueil et ses réglages dans les options ne changent pas.
- **Musique moins forte par défaut (0.11.2).** Volume musique par défaut 25 % au lieu de 45 %, effets à 100 % : les sons du jeu passent devant. Un réglage resté à l’ancien défaut (45 %) passe une fois au nouveau ; un niveau choisi est conservé.
- **Démo plus spectaculaire (0.11.3).** Elle ouvre sur un combat de boss et alterne combats de boss et assauts qui commencent dans une salle gardée (lourd armé). Neuf plans : yeux, poursuite par-dessus l’épaule, orbite, action de côté qui cadre le joueur et la machine visée, drone de face, contre-plongée sur le géant, orbite du gardien, vue d’ensemble et arrivée ; un plan bloqué par un mur se rapproche de l’épaule avant de revenir aux yeux. Pas de viseur ni d’aide des commandes pendant la démo.
- **Manette, disposition 2** : RT tir, LT main gauche (ou tir des deux canons), A saut / montée, B esquive / descente, **LB course / boost**, **L3 onde**, X interagir, **RB arme suivante**, **Y changer de personnage**, **R3 vue**, croix pour les armes, Vue pour la carte, Menu pour la pause. Les boutons laissés à l’ancienne place par défaut migrent ; les choix personnels sont conservés. Le coup de crosse n’a plus de bouton par défaut à la manette mais reste réassignable.

Les anciennes sauvegardes gardent leur personnage actif et leurs positions. Vérifications : `npm test` (dont `checks/camera.test.mjs`, `checks/flight.test.mjs`) et captures dans Chrome sur le Mac ; aucune manette réelle n’a été branchée pour cette version (bancs avec manette simulée).

## Finition du 15 novembre 2026

Complément physique : collisions continues de capsule, raccords du décor sans accroche, objets tournés et appuis physiques ; les reprises précédentes conservent leur géométrie. [Contrôles et API](docs/chantier-moteur/rapports/physique-geometrie-20261115.md).

Les nouvelles expéditions proposent deux personnages à positions distinctes : **lourd** (pistolet automatique, grenades et roquettes), avec lequel on commence, et **léger**, son drone (pistolet, pompe et mitraillette en canons jumeaux, vol et boost). Chaque personnage garde sa progression. **T au clavier, Y à la manette ou le bouton « Passer au lourd / léger »** change de personnage (RB avant la 0.11.0). Le personnage laissé en attente reste visible où on l’a quitté ; son repère indique sa direction, sa distance et son étage quand il est hors de vue. Les brèches, relais aériens et exigences des boss rendent leur coopération obligatoire.

Sur téléphone, les actions occupent les coins, l’ATH est compact et le bouton ARMES ouvre l’équipement en suspendant le combat. Le bouton de tir permet aussi de viser en glissant ; le manche virtuel peut se déplacer sous le doigt et déclencher la course. Les commandes et menus à la manette restent reconfigurables.

Le mode démo présente six mondes après l’attente réglée dans les options, sans modifier l’expédition sauvegardée. Un geste au clavier, à la souris, au tactile ou à la manette rend la main. Le rejeu d’entrées est disponible avec `?record=1` et un export depuis les options.

Les limites matérielles et les mesures exactes de cette livraison figurent dans [le rapport de finition](docs/chantier-moteur/rapports/finition-finale-20261115.md). Les options expérimentales du lot 18 restent hors de la version qualifiée.

## Jouer

- **Dépôt :** https://github.com/M4D135/METAL
- **Distribution autonome :** [dist/index.html](dist/index.html), à télécharger puis ouvrir dans un navigateur récent, même hors ligne.

WebGL 2 est recommandé ; le rendu Canvas 2D sert de secours. Aucun CDN, paquet JavaScript, modèle, texture, police ou fichier audio externe n’est téléchargé. Le son commence après une interaction.

## Dix-huit mondes : six pour s’équiper, douze pour l’assaut

Une nouvelle expédition démarre avec le **pistolet à droite et la main gauche libre**. Le pistolet a des munitions illimitées. Les autres armes sont récupérées dans les caisses des boss, pas dans les anciennes salles-trophées. Les trois environnements procéduraux alternent à travers les dix-huit mondes.

| Étape | Arme / amélioration principale |
| --- | --- |
| Départ | Pistolet |
| Boss 1 | Double pompe |
| Boss 2 | Mitraillette |
| Boss 3 | Lance-grenades |
| Boss 4 | Second lance-grenades : calibrage du lance-grenades possédé, avec réserves |
| Boss 5 | Calibrage de la mitraillette et amélioration personnelle |
| Boss 6 | Lance-roquettes : arsenal complet, premier tiers terminé |
| Boss 7–18 | Calibrages d’armes et améliorations personnelles supplémentaires |

La répétition du lance-grenades au quatrième boss suit la demande : elle améliore l’arme existante au lieu de créer un deuxième inventaire de la même arme. Le lance-roquettes clôt l’équipement au sixième boss. Chaque boss donne aussi **un calibrage d’arme et une amélioration personnelle**, avec munitions, crédits, noyau et plaques d’armure selon les réserves disponibles.

Le butin apparaît physiquement au pied du colosse. Il faut s’en approcher pour le prendre ; tuer à distance ne crédite pas automatiquement l’équipement. Une arme apparaît sur la caisse et les deux modules représentent les améliorations. Le HUD indique les récompenses, le rang de l’arme en main et les PV numériques du boss. La sortie attend la prise de la récompense principale : l’ordre d’équipement ne peut pas être perdu en passant trop vite au monde suivant.

Les boss ont **600 PV au premier monde**, puis une courbe croissante jusqu’à **12 000 PV au dernier**. Ils ne se soignent pas quand une arme est ramassée. Les garnisons et la pression augmentent ; le plafond de machines ordinaires engagées monte de **6 à 16**, hors colosse. Les modes Standard, Brutal et Cauchemar restent disponibles. Les annonces d’attaques, les fenêtres d’esquive et le cœur vulnérable sont conservés.

### Des parcours ouverts

Les grands panneaux `reinforcement_baffle`, leurs cadres et leurs marques ne sont plus générés dans la nouvelle campagne. Leurs collisions sont également absentes. Les réservistes utilisent les coins, les pièces adjacentes et les virages des couloirs du décor existant, puis suivent un vrai chemin vers la rencontre. Une entrée doit toujours être éloignée, libre, accessible et entièrement masquée par un véritable obstacle avant qu’un ennemi puisse s’y matérialiser. Tourner le dos ne suffit pas. Si aucune entrée n’est sûre, la vague attend.

Les structures architecturales, terrasses, ponts, rampes, ascenseurs et tremplins gardent leurs fonctions. Les commandes, les trois relais, le boss et la récupération de son équipement ouvrent la sortie ; aucune vague optionnelle n’est imposée pour terminer le monde.

### Reprises et anciennes expéditions

**Nouvelle expédition** utilise cette progression dès le départ. Une sauvegarde de la campagne 0.7 conserve ses anciens lieux et sa progression par trophées ; les sauvegardes classiques gardent leurs trois secteurs. Elles restent reprenables sans perdre leurs ressources. Les nouvelles expéditions sont identifiées par `campaignVersion:2` dans le monde et `campaignRevision:2` dans l’enveloppe locale. `FWorld.create(seed,index,{campaign:true,campaignVersion:2})` crée ce parcours ; l’option historique `{campaign:true}` reste reproductible pour les anciens points de reprise.

## Horreur et difficulté progressive

Un directeur de tension orchestre des chocs de métal, coupures locales d’éclairage, alarmes et mouvements d’escouades. Ses événements partent de conduites, boîtiers ou pièges réellement présents dans le décor. Les adversaires attirés par une alarme se dirigent vers ce bruit ; ils ne reçoivent pas automatiquement la position d’un joueur caché.

La pression monte avec les secteurs et les objectifs activés. Les premières secondes du premier secteur donnent le temps de comprendre les commandes ; ensuite, les événements alternent préparation, impact et courte accalmie. Les rencontres proches, le son spatialisé, les fuites, les pièges et les spécialistes maintiennent la menace. Les sons d’horreur et la musique sont synthétisés, comme le reste du jeu.

**Options → Partie → Difficulté** propose **Standard**, **Brutal** et **Cauchemar**. Les niveaux renforcent l’agressivité, la cadence et les dégâts ; ils se composent avec l’adaptation de campagne sans modifier les PV d’un boss déjà engagé. Le réglage s’applique immédiatement et reste enregistré sur l’appareil. Le changer ne recharge ni la santé ni les munitions et ne recrée pas les vagues. L’équilibrage complet nécessite encore des parties humaines : les tests de comportement ne mesurent pas la peur ressentie.

## Destruction et dangers

**Rupture**, le lance-roquettes, ouvre des brèches dans les murs et fait tomber des morceaux. Fracture et les tirs répétés endommagent aussi le décor. Les morceaux restants ont des collisions correspondant à leur géométrie ; une ouverture visible peut être traversée. Les tirs vérifient le trajet jusqu’à la bouche du canon et les projectiles balaient leur volume pour éviter de passer à travers une paroi fine.

Les structures peuvent perdre leurs panneaux, leurs équipements, leurs lampes et leurs supports. Les éléments privés de support s’effondrent. Les morceaux structurels reprennent la géométrie réellement retirée, son matériau et sa pose ; ils tombent, rebondissent, basculent puis se stabilisent. Une collision ne les efface plus. Les portes détruites produisent aussi des plaques métalliques. Jusqu’à 128 morceaux structurels persistent et sont inclus dans les points de reprise ; 64 petits éclats temporaires ont leur propre budget. Les morceaux proches et récents sont prioritaires lorsque le budget est atteint. Le rendu applique des plafonds supplémentaires selon le matériel et la qualité. Dans les nouvelles expéditions, les gravats, accessoires et épaves possèdent des corps physiques : poussée, appuis, rebonds, grenades et dégâts cinétiques. Les grandes plaques cassées sont fragmentées pour laisser les passages praticables. Les anciennes sauvegardes conservent leur simulation d’origine. Les arbres et accessoires appartiennent à des ensembles destructibles. La suppression d’un obstacle met à jour les collisions, la navigation, le rendu et les ombres.

Les **sols, rampes et plateformes de circulation restent portants**. Il existe un substrat visible sous les territoires, à −0,25 m, pour qu’une brèche extérieure ne donne pas sur un vide sans sol. Cette version réalise une destruction locale par morceaux ; elle n’est pas une simulation structurelle universelle de chaque matériau. Détruire une console libère son circuit, et casser une porte ouvre son passage, afin de conserver une mission terminable.

Une projection hors d'une terrasse ne laisse plus le joueur bloqué vivant sur ce sol inférieur : une chute importante sur le substrat est fatale. Les positions véritablement sous le terrain ou hors du monde déclenchent aussi la mort. L'écran **Chute fatale** permet de reprendre au dernier point enregistré ; une découverte en vol attend un atterrissage sûr avant de remplacer ce point. Les brèches au niveau du sol, rampes, tremplins et ascenseurs restent praticables.

Les conduites percées émettent de la vapeur brûlante depuis une **buse matérielle**, visible à l’extrémité de la conduite. Des cycles de pression animent aussi le décor ; les avertissements précèdent les décharges dangereuses. Détruire la buse ou son assemblage coupe le jet, ses dégâts et son souffle sonore : aucun point de vapeur ne reste suspendu dans le vide.

Lames latérales, presses verticales et dalles à piques ont de vrais volumes mobiles et des annonces. Ils coupent les passages obligatoires ; le joueur doit les franchir, les désarmer ou les détruire selon leur rôle. Les grenades possèdent une trajectoire, des rebonds et une fusée ; les roquettes parcourent physiquement leur trajectoire. Le couvert arrête le souffle avant que l’explosion ne le détruise : casser un mur n’inflige pas rétroactivement les dégâts de cette même explosion derrière lui. Les explosions développent feu, souffle, fumée et fragments ; les effets restent bornés et suivent l’explosion simulée, sans ajouter de dégâts visuels fictifs.

## Armes et commandes

| Arme / action | Usage |
| --- | --- |
| **Pistolet — 5** | Arme initiale. Tir précis, cadence 0,32 s, réserve illimitée ; utile pour conserver les munitions lourdes. |
| **Mitraillette — 1** | Récompense du boss 2. Tir automatique plus rapide que le pistolet ; une balle par tir. |
| **Double pompe — 2** | Récompense du boss 1. Deux cartouches et quatorze rayons par tir ; une cartouche restante utilise un seul canon. |
| **Lance-roquettes — 3** | Récompense du boss 6. Roquette et souffle contre groupes, murs et supports ; reculez avant le tir. |
| **Lance-grenades — 4** | Récompense du boss 3. Trajectoire en cloche, rebonds et fusée de 1,8 s. |
| **Onde — E** | Repousse, étourdit, dissipe les projectiles et refroidit l’arme ; recharge de sept secondes. |
| **Coup de crosse — V** | Attaque courte, sans munition ni chaleur. Un tir à vide utilise aussi ce secours. |

Les munitions des quatre armes trouvées sont **finies** : une balle, une ou deux cartouches, une roquette ou une grenade selon le tir. Les plafonds de base sont **180 / 36 / 12 / 16**. Seul le pistolet est illimité ; ses sauvegardes contiennent une sentinelle entière finie, jamais Infinity. Les surplus de réserves restent au sol. Les récupérations exigent proximité, bon palier et passage dégagé.

Vous pouvez équiper **deux armes différentes**, une dans chaque main, ou laisser la main gauche libre. Chaque arme conserve sa cadence, et les armes partagent la chaleur : changer d’emplacement ne contourne pas une surchauffe ou un délai de tir. Les réserves appartiennent au type de munition, sans duplication au changement de main. Les deux montages possèdent leur propre recul amorti, leurs pièces, prises, viseurs et canons.

Le bouclier est sorti du jeu : plus d’énergie, plus de garde qui bloque les tirs, plus de coup de bouclier, plus de ramassage, plus de jauge ni de son. Un dégât qui était bloqué fait maintenant mal normalement. Ce qui reste défensif : **R esquive** et donne une courte invulnérabilité, **V frappe à la crosse**, **E déclenche l’onde** sans rien équiper. Le ramassage qui ouvrait chaque monde est devenu un rack de munitions de mitraillette au même endroit.

L’onde reste défensive : ses dégâts sont faibles contre les machines ordinaires et n’entament pas le colosse en mode Survie. Le coup de crosse permet de récupérer des ressources sur une machine proche même à zéro munition. Les projectiles et le souffle respectent les couverts, y compris le trajet entre le regard et la bouche de chaque arme.

| Action | Ordinateur | Téléphone |
| --- | --- | --- |
| Déplacement | ZQSD / WASD | Joystick gauche |
| Visée | Souris ; glisser si capture indisponible ; flèches pour tourner | Glisser à droite |
| Tir main droite | Clic gauche / Entrée | Grand cercle |
| Tir main gauche | Clic droit / G | Bouton TIR G |
| Équipement main gauche | X, ou choix explicite dans le HUD | Bouton main gauche / choix du HUD |
| Course du lourd / boost du drone | Maj | Joystick en butée |
| Saut du lourd / montée du drone | Espace | Saut / Monter |
| Esquive du lourd / descente du drone | R | Bouton esquive / Descendre |
| Vue 1re / 3e personne | C | Bouton 1P / 3P |
| Changer de personnage | T | Bouton de profil |
| Onde de choc | E | Bouton anneaux |
| Coup de crosse | V | Bouton Crosse |
| Commande / ascenseur / atelier | F | Bouton contextuel |
| Arme trouvée en main droite | 1 / 2 / 3 / 4 / 5 ou molette | Emplacements d’arme ou nom de l’arme |
| Carte | M | Bouton carte |
| Pause | Échap / P | Bouton pause |

À la manette : stick gauche pour se déplacer, stick droit pour viser, RT pour tirer, LT pour la main gauche, A/Croix pour sauter ou monter, B/Rond pour esquiver avec le lourd ou descendre avec le drone, LB/L1 pour courir ou booster, L3 pour l’onde, Y/Triangle pour changer de personnage, RB/R1 pour l’arme suivante et R3 pour la vue. Les commandes restent personnalisables. La marche, la course, l’esquive et le contrôle aérien sont plus rapides qu’en 0.5, avec accélération et freinage amortis ; le lourd saute avec Espace. Le drone léger se pilote comme le lourd : il se déplace à plat, se maintient en altitude sans gravité, monte avec Espace et descend avec R. Seul son boost consomme du carburant. La caméra du drone n’a ni démarche ni bruit de pas. **Les FPS restent visibles par défaut**, en haut à droite. Le HUD adapte ses emplacements aux seules armes trouvées en campagne, avec ∞ pour le pistolet ; il montre l’équipement gauche, les réserves et plafonds, la vague locale, la chaleur, la santé maximale, le blindage, les crédits et les noyaux, en plus des objectifs, de l’altitude et du boss.

## Armure à ramasser

Le HUD sépare les **PV** et les **points d’armure**. La réserve d’armure commence à zéro, avec une capacité de **100**. Le changement de main ne remplit rien.

Chaque monde de campagne possède trois réserves de plaques : **25 au départ, 25 près de l’atelier intermédiaire et 50 dans l’arène**. Leur collecte est physique, sur le bon palier et sans traverser un mur. Le surplus reste au sol. Les plaques absorbent un tiers des dégâts résiduels après le blindage passif, dans la limite des points disponibles. Les chutes fatales restent fatales. L’armure ne se régénère pas avec le temps.

Les mains restent lisibles : l’arme droite garde sa monture, ses pièces, sa prise et son canon quel que soit le contenu de la main gauche, et le mouvement des deux mains est pris en compte pour éviter leurs intersections ; les trajectoires de tir conservent leurs positions.

## Butin, ateliers et améliorations

Chaque boss laisse une **récompense déterministe**, collectable une seule fois. Le journal des boss récompensés accompagne le profil entre les mondes. Les ressources restant dans une caisse sont sauvegardées séparément ; quitter puis reprendre ne redonne ni arme, ni rang, ni crédit déjà reçu. Une sauvegarde incohérente entre inventaire, rangs et journal est refusée atomiquement.

Les **calibrages propres à chaque arme** ajoutent 40 % de dégâts de base par rang et réduisent sa production de chaleur. Les armes ne partagent pas ces rangs. La mitraillette, le pompe, les deux lanceurs et le pistolet continuent d’obtenir leurs calibrages au cours des dix-huit mondes. Les impacts directs et les explosions utilisent les dégâts correspondants.

Les améliorations personnelles alternent entre **Vitalité, Blindage, Réserves, Puissance et Refroidissement**. Les plafonds de la nouvelle campagne sont de 8 rangs par arme et 12 rangs par amélioration personnelle ; les anciennes économies à trois rangs restent compatibles. Le blindage passif reste plafonné et ne remplace pas les plaques d’armure consommables. Augmenter la vitalité maximale ne répare pas gratuitement les dégâts reçus ; augmenter les réserves ne remplit pas les munitions.

Les ateliers utilisent les crédits et les noyaux pour réparer, recharger les armes déjà connues et améliorer le personnage. Une transaction recalcule son prix et ses quantités depuis l’état actuel. Ils ne permettent pas d’acheter une arme de boss encore inconnue. Les quantités au-delà de la capacité restent au sol.

## Machines et déplacements

Les escouades combinent assaut, contournement et suppression. Elles voient, entendent, mémorisent le dernier contact, partagent localement les observations et cherchent des couverts. La visée prédictive utilise le mouvement observé. Un tir vérifie les obstacles et les alliés ; les spécialistes évitent de viser leur propre groupe avec une grenade ou une roquette.

Les sentinelles à trois pieds se déplacent et cherchent une distance de tir. Les bots alternent poursuite, mouvements latéraux et repositionnement, et certains utilisent les tremplins. Une esquive réagit après un délai à un tir observé ; elle n’annule pas un impact déjà reçu. Les machines éloignées peuvent dormir sans perdre leur identité ou leurs PV.

Les modèles proches possèdent plaques chanfreinées, optiques, pistons, membres articulés et armes distinctes. La passe 0.7 ajoute **14 pièces par machine proche et 18 par colosse** : plastrons en couches, prises d’air, conduites, fixations et fourreaux de vérins. Ces ajouts sont réservés au niveau proche WebGL Auto/Haute ; les niveaux éloignés et le secours Canvas gardent leurs budgets. Les pieds suivent la marche et les articulations suivent les mouvements réels.

Un petit réseau tactique procédural complète les règles de combat avec des scores d’approche, de flanc, de retraite et d’attaques de boss. Ses coefficients sont définis dans le code ; aucun modèle entraîné ou importé n’est chargé. Le mode Auto tente WebNN et n’annonce une accélération que si l’API la confirme. Le navigateur n’expose pas ici le type exact de matériel GPU ou NPU. Le même calcul dispose d’un repli CPU ; l’absence d’accélérateur ne bloque pas la partie et le réseau ne reçoit que les observations autorisées de l’ennemi.

Les [sources officielles de Quake III Arena](https://github.com/id-Software/Quake-III-Arena) ont servi à étudier des principes de déplacement et de combat. Aucun code de ce moteur n’est incorporé. Les personnages, lieux, scripts et compositions de METAL sont originaux.

## Options et musique MOD

Le menu comporte quatre rubriques :

- **Partie :** difficulté, reprise, redémarrage du secteur, retour à l’accueil et aide.
- **Image :** Auto / Économie / Haute, plafond 30 / 60 / 120 FPS ou sans limite, FOV 60–110°, luminosité, ombres, éclat lumineux, FPS, filtre rétro, visière et mouvements de caméra.
- **Audio :** volumes général, musique, armes et impacts, ambiances ; essai sonore de deux secondes, rétablissement explicite du mix recommandé, coupure et export MOD.
- **Commandes :** sensibilité, inversion verticale, viseur et attribution des touches avec détection des conflits.

Les réglages s’appliquent immédiatement. Les menus défilent sur petit écran ; le retour reste accessible. Le mode Économie et le secours Canvas offrent une présentation simplifiée. Un plafond de FPS n’est pas une promesse de cadence.

Le jeu génère de **vrais modules ProTracker à quatre canaux**, signature `M.K.`, avec instruments PCM synthétisés mathématiquement, notes, ordres et patterns. Aucun échantillon enregistré, fichier MOD ou morceau commercial n’est importé.

| Composition | Tempo · durée de boucle | Écriture |
| --- | --- | --- |
| Fer noir | 100 BPM · 76,8 s | Power chords graves en Ré, palm-mutes et arrêts ; rupture de quatre mesures puis reprise pesante. |
| Fracture | 170 BPM · 45,2 s | Riffs chromatiques syncopés, picking serré et doubles grosses caisses ; rupture puis montée. |
| Veille des cendres | 145 BPM · 53,0 s | Galop en Mi grave, thème en mode phrygien et tierces diatoniques ; alternance de réponses et de passages mélodiques. |

Chaque morceau possède **32 mesures**, six patterns distincts et huit phrases ordonnées. Les guitares sont synthétisées à partir de cordes à harmoniques, de bruits d’attaque et de distorsion ; la batterie combine ses frappes dans des instruments de mesure pour conserver le format à quatre canaux. Le lecteur Web Audio utilise les mêmes patterns et données PCM que l’export. La menace influe sur le mix, la pause arrête les notes programmées et une reprise se recale sur une mesure. **Options → Audio → Exporter le MOD** enregistre `METAL-01.mod`, `METAL-02.mod` ou `METAL-03.mod`.

Les nouveaux bruitages utilisent des **buffers PCM calculés par le code**, avec des attaques et des résonances propres au pistolet, à la mitraillette, au pompe et aux lanceurs. Les impacts et les morceaux qui retombent distinguent métal, pierre, bois, verre et terre. Leur énergie règle l’intensité ; les variantes sont déterministes. La banque est préparée par petits lots sur l’écran de chargement et réutilisée pendant le combat.

Le drone tonal permanent et les pépiements synthétiques ont été supprimés. L’intérieur est silencieux en l’absence d’une source locale. À l’extérieur, le vent comporte des accalmies. Ventilateurs, pistons, réacteurs, ascenseurs en mouvement et fuites chaudes ont une portée locale, une position stéréo et un filtrage lorsque des murs ou des portes les masquent. Une machine détruite cesse de sonner. Les moteurs et la vapeur continue passent par **Ambiances** ; les tirs, impacts et alertes passent par **Armes et impacts**. Les compositions MOD et les préférences de volume sont conservées.

Les voix restent bornées et priorisées pour que les débris éloignés ne coupent pas les tirs du joueur. Le mixage inclut un plafond de sortie, et la pause coupe les sources de jeu. **Tester tirs et ambiances** permet un essai depuis les options. Les mesures PCM et les contrôles Web Audio sont documentés ; ils ne constituent pas une appréciation d’écoute sur des enceintes ou un casque réels.

## Moteur, sauvegardes et taille

Le moteur conserve la vraie 3D : il n’a pas été remplacé par un raycaster. Les descriptions du monde sont générées au chargement ; la construction des modèles et la préparation des géométries se concentrent sur ce qui peut contribuer à la vue ou aux ombres. Une exclusion incertaine conserve l’objet. Les instances inchangées réutilisent leurs buffers. Les géants et les volumes essentiels de leurs arènes bénéficient d’une portée adaptée, sans étendre tous les petits détails.

Les quatre essences d’arbres conservent troncs articulés, fourches et couronnes irrégulières. Le métal combine rugosité, Fresnel et reflet procédural du ciel/soleil, filtré à la taille du pixel. L’usure suit les arêtes locales des objets ; les armes et machines ne reçoivent pas la grille des bâtiments. Les étincelles ont une pointe chaude et une traînée balistique ; la fumée possède une opacité structurée. Les quantités de particules restent bornées. Les explosions éclairent leur emplacement réel et les trois cartes d’ombres sont conservées. Les réglages « Scène locale » et « Scène locale + écran » ajoutent une sonde des objets réellement présents et des reflets dans l’espace de l’écran. Les flaques et métaux utilisent leur rugosité ; les limites de champ et les délais de rafraîchissement restent visibles. Le mode éteint conserve le rendu analytique, sans capture de scène.

Auto choisit une cadence stable de 60 ou 30 images par seconde à résolution native après calibration. La résolution ne baisse jamais automatiquement ; l’échelle reste un choix explicite du joueur. Les retours arrière après destruction invalident les caches concernés ; ils restaurent aussi les collisions et la navigation. Le champ de distance global inutilisé par l’IA avancée n’est plus recalculé à chaque porte ou brèche.

Les instruments MOD sont préparés par étapes au menu ou sur l’écran de chargement. Après le geste qui déverrouille le son, les AudioBuffers du secteur sont chargés avant l’entrée en combat. Les banques préparées sont réutilisées ; la préparation d’un secteur futur ne change pas la musique active. Un cache borné garde aussi les descriptions de deux mondes, et l’écran de fin de secteur peut anticiper le suivant. Cette préparation réduit les travaux de première utilisation ; elle ne garantit pas une cadence matérielle.

Les nouveaux points de reprise physiques sont en version 2 ; les points historiques version 1 restent lisibles. Ils comprennent les deux positions, les deux progressions, le carburant, les corps et articulations, ainsi que gravats persistants, récompenses de boss déjà acquises, terrain détruit, systèmes, physique aérienne, projectiles, boss, directeur de tension, vagues, réservistes, inventaire, équipement des mains, butin restant et profil d’améliorations. Les relais, commandes, arrivées d’ascenseur avec le joueur, armes découvertes, zones sécurisées, boss abattus, butins de boss ramassés et achats enregistrent la progression.

Les enveloppes de campagne sont en **version 3**, avec index 0–17 ; les anciennes enveloppes version 2 continuent explicitement leurs trois secteurs. Les points compatibles conservent les ressources, les découvertes et la phase de chaque épreuve. Une métadonnée d’inventaire d’entrée à 3, 4 ou 5 emplacements incompatible avec le monde ne bloque pas la reprise d’un checkpoint sain. Un checkpoint incompatible est refusé ou reprend proprement à l’entrée selon le cas, sans conversion silencieuse ; une copie précédente est conservée lorsque le stockage le permet. Les clés internes restent `ferro-settings` et `ferro-expedition-v2`.

`SIZE.json` contient la taille brute, la taille gzip et le SHA-256 de la distribution courante. Le budget reste **1 400 000 octets non compressés**. Documentation, tests, navigateur et pilotes sont exclus de cette taille ; ce n’est pas la mesure d’un exécutable natif.

## Développement et validation

Aucune installation npm n’est nécessaire : Python 3 assemble la distribution, Node.js exécute les tests.

```sh
python3 tools/build.py
npm test
node tools/boss-profiles.mjs
node tools/boss-ttk.cjs
# Le rapport historique reste disponible pour la campagne v1.
node tools/campaign-profiles.mjs docs/campaign-world-profiles.json
```

| Source | Responsabilité |
| --- | --- |
| `fmath.js` | `sin`, `cos`, `atan`, `atan2` (fdlibm de V8 sans FMA) et `hypot` (algorithme de V8) identiques sur toutes les plateformes, chargé avant `world.js` |
| `world.js` | Terrain, architecture, population, arènes, systèmes et dangers |
| `destruction.js` | Découpes, supports, collisions et état persistant de démolition |
| `economy.js` | Profils, stats, plafonds, catalogue et transactions atomiques |
| `brain.js` | Réseau tactique procédural, WebNN vérifié et repli CPU |
| `simulation.js` | Physique, IA, vagues, inventaire, butin, combat, progression et snapshots |
| `actors.js`, `motion.js` | Modèles articulés, LOD, caméra et montage des armes |
| `effects.js` | Projectiles, vapeur, fragments et annonces de danger |
| `renderer.js` | WebGL 2, ombres, matériaux et secours Canvas |
| `music.js`, `audio.js` | MOD, banque PCM procédurale, mixage et lecture sonore |
| `soundscape.js` | Sources locales, distance3D, panoramique et occlusion |
| `options.js`, `game.js` | Préférences, contrôles, HUD, menus et sauvegardes |
| `index.html`, `style.css` | Interface responsive et tactile |

Les résultats et leurs limites figurent dans **[VALIDATION.md](VALIDATION.md)** et **[docs/validation-v08.json](docs/validation-v08.json)** ; les contrats sont dans **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Les [captures de contrôle](docs/qa-v08/README.md) sont des preuves de rendu et restent hors du jeu. Les mesures logicielles, les fixtures de simulation et les cadres mobiles ne démontrent pas des FPS sur un GPU physique ni une campagne équilibrée par des joueurs. Aucun débit stable n’est promis pour un Mac, Safari ou un téléphone réel.

METAL reste un prototype compact de science-fiction procédurale. Il ne contient pas de multijoueur, de saut libre sur une touche ni de terrain entièrement excavable. La démarche de distribution s’inspire de `.kkrieger`, sans reprendre son code ou ses assets : [présentation de Fabian Giesen](https://www.flipcode.com/archives/04-20-2004.shtml), [documentation originale](https://www.pouet.net/prod_nfo.php?which=12036).

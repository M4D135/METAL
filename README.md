# METAL

**Des ennemis de métal. Une bande-son metal.** Un FPS d’horreur et d’action entièrement procédural : 430 machines, trois colosses, des territoires destructibles et des musiques MOD originales. Modèles, matériaux, animation, effets, instruments et compositions sont produits par le code. Aucun asset de jeu importé.

**Version 0.5.0 — Colosses.** Le projet auparavant nommé FERRO conserve son dépôt et son adresse pour préserver les liens et les sauvegardes.

## Jouer

- **Jeu :** https://ferro-procedural-fps.garden-lake-2660.chatgpt.site/
- **Dépôt :** https://github.com/M4D135/FERRO
- **Distribution autonome :** `dist/index.html`, utilisable hors ligne dans un navigateur récent.

L’hébergement garde son accès privé réservé au propriétaire. WebGL 2 est recommandé ; le rendu Canvas 2D sert de secours. Aucun CDN, paquet JavaScript, modèle, texture, police ou fichier audio externe n’est téléchargé. Le son commence après une interaction.

## Trois territoires, trois colosses

| Secteur | Machines | Colosse | Hauteur visuelle approximative |
| --- | ---: | --- | ---: |
| La lisière rouillée | 120 | Le Colosse de Fer | 18 m |
| La carrière des braises | 140 | Le Brise-siège | 24 m |
| Les jardins du veilleur | 170 | Le Veilleur primordial | 30 m |

Les populations sont dix fois celles de la version initiale : 120 / 140 / 170 au lieu de 12 / 14 / 17. Ce sont des acteurs distincts, présents dans la simulation. Chaque secteur comprend huit grenadiers et six spécialistes des roquettes, trois commandes, deux ascenseurs, trois tremplins et trois relais.

Les régions agrandies mêlent bâtiments, cours, arbres, falaises, installations industrielles et ruines. Les terrasses se trouvent à 0, 3,2 et 6,4 m. Les rampes ont une pente physique ; les ascenseurs transportent réellement le joueur. Les tremplins suivent une trajectoire balistique, avec contrôle aérien et collisions contre les plafonds, murs et plateformes.

Chaque géant possède une arène à ciel ouvert de **60 × 60 m**, reliée au territoire par une passerelle. Les portes monumentales, piliers et frontons restent en périphérie ; le centre permet au boss de se mouvoir sans entrer dans les bâtiments. Les petites machines donnent un repère d’échelle. Les silhouettes des trois colosses diffèrent : cornes métalliques, cheminées de siège, couronne et halo mécanique.

### Combats scriptés

Le colosse s’éveille à l’entrée de son arène. Chaque combat comporte trois phases, des renforts préplacés et des attaques préparées :

- **Colosse de Fer :** écrasements et ondes de choc.
- **Brise-siège :** barrages de roquettes physiques et balayages de zone.
- **Veilleur primordial :** combinaison d’anneaux, barrages et balayages.

Les disques, anneaux creux et bandes au sol décrivent les véritables zones de dégâts. Sortez du disque, restez dans l’ouverture d’un anneau ou quittez la bande avant l’impact. Après ses attaques, le boss expose son cœur pendant une courte fenêtre. **Visez le cœur lumineux** : les impacts y sont beaucoup plus efficaces. L’armure résiste davantage hors de cette fenêtre, sans rendre le boss entièrement invulnérable.

Le HUD affiche le nom, la vie, la phase, l’attaque et le temps d’exposition du cœur. La marche et le niveau de détail tiennent compte de la taille : un colosse ne se réduit pas à quelques cubes de soldat au fond de son arène.

## Horreur et difficulté progressive

Un directeur de tension orchestre des chocs de métal, coupures locales d’éclairage, alarmes et mouvements d’escouades. Ses événements partent de conduites, boîtiers ou pièges réellement présents dans le décor. Les adversaires attirés par une alarme se dirigent vers ce bruit ; ils ne reçoivent pas automatiquement la position d’un joueur caché.

La pression monte avec les secteurs et les objectifs activés. Les premières secondes du premier secteur donnent le temps de comprendre les commandes ; ensuite, les événements alternent préparation, impact et courte accalmie. Les rencontres proches, le son spatialisé, les fuites, les pièges et les spécialistes maintiennent la menace. Les sons d’horreur et la musique sont synthétisés, comme le reste du jeu.

**Options → Partie → Difficulté** propose **Standard**, **Brutal** et **Cauchemar**. Les niveaux renforcent l’agressivité, la cadence et les dégâts ; ils n’ajoutent pas artificiellement des PV aux 430 machines. Le réglage s’applique immédiatement et reste enregistré sur l’appareil. L’équilibrage complet nécessite encore des parties humaines : les tests de comportement ne mesurent pas la peur ressentie.

## Destruction et dangers

**Rupture**, le lance-roquettes, ouvre des brèches dans les murs et fait tomber des morceaux. Fracture et les tirs répétés endommagent aussi le décor. Les morceaux restants ont des collisions correspondant à leur géométrie ; une ouverture visible peut être traversée. Les tirs vérifient le trajet jusqu’à la bouche du canon et les projectiles balaient leur volume pour éviter de passer à travers une paroi fine.

Les structures peuvent perdre leurs panneaux, leurs équipements, leurs lampes et leurs supports. Les éléments privés de support s’effondrent ; les débris sont animés avec un nombre et une durée bornés. Les arbres et accessoires appartiennent à des ensembles destructibles. La suppression d’un obstacle met à jour les collisions, la navigation, le rendu et les ombres.

Les **sols, rampes et plateformes de circulation restent portants**. Il existe un substrat visible sous les territoires, à −0,25 m, pour qu’une brèche extérieure ne donne pas sur un vide sans sol. Cette version réalise une destruction locale par morceaux ; elle n’est pas une simulation structurelle universelle de chaque matériau. Détruire une console libère son circuit, et casser une porte ouvre son passage, afin de conserver une mission terminable.

Les conduites percées émettent de la vapeur brûlante. Des cycles de pression animent aussi le décor ; les avertissements précèdent les décharges dangereuses. Lames latérales, presses verticales et dalles à piques ont de vrais volumes mobiles, des annonces et un passage alternatif. Les grenades possèdent une trajectoire, des rebonds et une fusée ; les roquettes parcourent physiquement leur trajectoire. Le couvert arrête le souffle avant que l’explosion ne le détruise : casser un mur n’inflige pas rétroactivement les dégâts de cette même explosion derrière lui.

## Armes et commandes

| Arme / action | Usage |
| --- | --- |
| **Impulse — 1** | Tir rapide et précis ; viser les points faibles. |
| **Fracture — 2** | Sept rayons dispersés ; efficace de près, chaleur plus élevée. |
| **Rupture — 3** | Roquette et souffle ; murs, supports, groupes d’ennemis. Reculez avant de tirer : une roquette trop proche de son point de départ reste non armée. |
| **Onde — E** | Repousse et étourdit à proximité, dissipe les projectiles et refroidit l’arme ; recharge de sept secondes. |

Les trois armes partagent la chaleur. Changer d’arme ne contourne pas une surchauffe. Les projectiles et le souffle respectent les couverts. Les modèles de première personne sont assemblés dans un même repère, avec prise gantée, viseurs, capots, canon et recul amorti.

| Action | Ordinateur | Téléphone |
| --- | --- | --- |
| Déplacement | ZQSD / WASD | Joystick gauche |
| Visée | Souris ; glisser si capture indisponible ; flèches pour tourner | Glisser à droite |
| Tir | Clic gauche / Entrée | Grand cercle |
| Course | Maj | — |
| Esquive | Espace | Bouton flèche |
| Onde de choc | E | Bouton anneaux |
| Commande / ascenseur | F | Bouton contextuel |
| Arme | 1 / 2 / 3 ou molette | Nom de l’arme |
| Carte | M | Bouton carte |
| Pause | Échap / P | Bouton pause |

Les touches sont personnalisables. **Les FPS restent visibles par défaut**, en haut à droite. Le HUD indique aussi altitude, objectifs, machines neutralisées, chaleur et état du boss.

## Machines et déplacements

Les escouades combinent assaut, contournement et suppression. Elles voient, entendent, mémorisent le dernier contact, partagent localement les observations et cherchent des couverts. La visée prédictive utilise le mouvement observé. Un tir vérifie les obstacles et les alliés ; les spécialistes évitent de viser leur propre groupe avec une grenade ou une roquette.

Les sentinelles à trois pieds se déplacent et cherchent une distance de tir. Les bots alternent poursuite, mouvements latéraux et repositionnement, et certains utilisent les tremplins. Une esquive réagit après un délai à un tir observé ; elle n’annule pas un impact déjà reçu. Les machines éloignées peuvent dormir sans perdre leur identité ou leurs PV.

Les modèles proches possèdent plaques chanfreinées, optiques, pistons, membres articulés et armes distinctes. Les pieds suivent la marche réelle ; les membres se replient en vol. La séparation entre matériaux d’architecture et d’objets retire le motif de grille parasite des armes et des ennemis, tout en gardant l’éclairage et les vraies ombres.

Les [sources officielles de Quake III Arena](https://github.com/id-Software/Quake-III-Arena) ont servi à étudier des principes de déplacement et de combat. Aucun code de ce moteur n’est incorporé. Les personnages, lieux, scripts et compositions de METAL sont originaux.

## Options et musique MOD

Le menu comporte quatre rubriques :

- **Partie :** difficulté, reprise, redémarrage du secteur, retour à l’accueil et aide.
- **Image :** Auto / Économie / Haute, plafond 30 / 60 / 120 FPS ou sans limite, FOV 60–110°, luminosité, ombres, éclat lumineux, FPS, filtre rétro, visière et mouvements de caméra.
- **Audio :** volumes général, musique, armes/machines et ambiances ; coupure et export MOD.
- **Commandes :** sensibilité, inversion verticale, viseur et attribution des touches avec détection des conflits.

Les réglages s’appliquent immédiatement. Les menus défilent sur petit écran ; le retour reste accessible. Le mode Économie et le secours Canvas offrent une présentation simplifiée. Un plafond de FPS n’est pas une promesse de cadence.

Le jeu génère de **vrais modules ProTracker à quatre canaux**, signature `M.K.`, avec instruments PCM synthétisés mathématiquement, notes, ordres et patterns. Aucun échantillon enregistré, fichier MOD ou morceau commercial n’est importé.

| Composition | Tempo | Direction musicale |
| --- | ---: | --- |
| Fer noir | 100 BPM | Heavy / doom, riffs pesants |
| Fracture | 170 BPM | Thrash, doubles grosses caisses |
| Braise | 145 BPM | Metal mélodique, galops et harmonies |

Chaque morceau possède 32 mesures avec variations. Le lecteur Web Audio utilise les mêmes patterns et données PCM que l’export. La menace influe sur le mix, la pause arrête les notes programmées et une reprise se recale sur une mesure. **Options → Audio → Exporter le MOD** enregistre `METAL-01.mod`, `METAL-02.mod` ou `METAL-03.mod`.

Les budgets des voix de musique et des effets sont indépendants. Le mix final dispose d’une protection de crête, et les souffles de vapeur sont produits par une source continue dont le niveau suit les conduites proches.

## Moteur, sauvegardes et taille

Le moteur conserve la vraie 3D : il n’a pas été remplacé par un raycaster. Les descriptions du monde sont générées au chargement ; la construction des modèles et la préparation des géométries se concentrent sur ce qui peut contribuer à la vue ou aux ombres. Une exclusion incertaine conserve l’objet. Les instances inchangées réutilisent leurs buffers. Les géants et les volumes essentiels de leurs arènes bénéficient d’une portée adaptée, sans étendre tous les petits détails.

Auto adapte progressivement la résolution WebGL à la cadence. Les retours arrière après destruction invalident les caches concernés ; ils restaurent aussi les collisions et la navigation. Le champ de distance global inutilisé par l’IA avancée n’est plus recalculé à chaque porte ou brèche.

Les points de reprise comprennent terrain détruit, systèmes, physique aérienne, projectiles, boss et directeur de tension. Les relais, commandes, arrivées d’ascenseur avec le joueur et boss abattus enregistrent la progression. Une ancienne génération incompatible reprend à l’entrée du même secteur, en gardant graine, arme et statistiques des secteurs précédents ; une copie du point précédent est conservée si le stockage le permet. Le changement de titre garde les clés internes `ferro-settings` et `ferro-expedition-v2`.

`SIZE.json` contient les tailles brutes et gzip et le SHA-256 du fichier courant. Le budget est **1 400 000 octets non compressés**. Documentation, tests, navigateur et pilotes sont exclus de cette taille ; ce n’est pas la mesure d’un exécutable natif.

## Développement et validation

Aucune installation npm n’est nécessaire : Python 3 assemble la distribution, Node.js exécute les tests.

```sh
python3 tools/build.py
npm test
```

| Source | Responsabilité |
| --- | --- |
| `world.js` | Terrain, architecture, population, arènes, systèmes et dangers |
| `destruction.js` | Découpes, supports, collisions et état persistant de démolition |
| `simulation.js` | Physique, IA, combat, scripts, progression et snapshots |
| `actors.js`, `motion.js` | Modèles articulés, LOD, caméra et montage des armes |
| `effects.js` | Projectiles, vapeur, fragments et annonces de danger |
| `renderer.js` | WebGL 2, ombres, matériaux et secours Canvas |
| `music.js`, `audio.js` | MOD, synthèse, mixage, ambiances et horreur |
| `options.js`, `game.js` | Préférences, contrôles, HUD, menus et sauvegardes |
| `index.html`, `style.css` | Interface responsive et tactile |

Les résultats vérifiés figurent dans **`VALIDATION.md`**, et les contrats dans **`docs/ARCHITECTURE.md`**. Les images GLES des essais proviennent d’un vrai contexte logiciel Mesa ; elles ne démontrent pas une performance sur un GPU physique. Le navigateur de test utilise Canvas, avec une cadence RAF parfois limitée par son environnement. Aucun débit stable n’est promis pour le Mac de l’utilisateur, Safari ou un téléphone réel. Le test humain d’une campagne entière et l’évaluation de la peur ressentie restent à faire.

METAL reste un prototype compact de science-fiction procédurale. Il ne contient pas de multijoueur, de saut libre sur une touche ni de terrain entièrement excavable. La démarche de distribution s’inspire de `.kkrieger`, sans reprendre son code ou ses assets : [présentation de Fabian Giesen](https://www.flipcode.com/archives/04-20-2004.shtml), [documentation originale](https://www.pouet.net/prod_nfo.php?which=12036).

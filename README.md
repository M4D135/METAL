# FERRO — Le complexe silencieux

**Version 0.4.0 — Horizons.** Un FPS 3D compact dont la géométrie, les matériaux, les machines et le son sont fabriqués par le code. Deux armes, trois territoires mêlant nature et installations industrielles, neuf relais et un gardien final.

L'idée technique s'inspire de la démarche de .kkrieger : conserver la recette du contenu dans un petit programme. **Tout le code et tout le contenu de FERRO sont originaux ; aucun asset du jeu historique n'est repris.**

## Jouer

**Dépôt :** https://github.com/M4D135/FERRO

**Jouer en ligne :** https://ferro-procedural-fps.garden-lake-2660.chatgpt.site

La démonstration est publiée avec un accès privé réservé au propriétaire. Une authentification peut être demandée.

Téléchargez **`dist/index.html`** et ouvrez-le dans un navigateur de bureau récent. Le fichier est autonome : aucun CDN, paquet JavaScript, modèle, police, texture ou enregistrement audio à télécharger. Il fonctionne hors ligne après chargement.

Le jeu possède également des commandes tactiles et peut être servi par un hébergement statique. WebGL 2 est recommandé ; un rendu 3D logiciel prend le relais quand il est indisponible. Le son commence après une interaction.

## Ce qui change en 0.4

- **De vrais extérieurs.** Chaque secteur possède cinq espaces à ciel ouvert, des chemins praticables et des bâtiments à explorer. Les barrières, murets et fronts rocheux délimitent visiblement le terrain. Le premier départ se fait dans une lisière boisée.
- **Trois paysages.** Pins et bouleaux autour des postes de maintenance ; falaises, minerais et installations dans la carrière ; feuillus, fleurs, lierre et ruines dans les jardins du veilleur. Les reliefs de fond donnent de la profondeur sans transformer le sol en plateformes.
- **Une nature construite en 3D.** Troncs et branches, plusieurs formes de canopée, racines, fougères, buissons, herbes, champignons, brindilles et petits cailloux. Les gros troncs et les rochers ont des collisions et servent de couverts.
- **Ciel et éclairage.** Ciel dégradé, nuages, soleil, brume et palette propre à chaque paysage. Le soleil entre dans l'atlas d'ombres ; le feuillage bouge légèrement avec le vent. Terre, pierre, écorce et feuilles ont leurs propres matériaux procéduraux.
- **Des machines qui observent.** Patrouille, champ de vision, écoute des tirs et alertes entre voisins. Après avoir perdu la vue, elles cherchent autour de la dernière position connue, puis abandonnent la recherche. Elles ne connaissent pas en permanence la position du joueur.
- **Des décisions tactiques.** Les éclaireurs cherchent un chemin de flanc ; blessés, ils peuvent rejoindre un couvert qui bloque réellement la vue, attendre puis ressortir pour viser. Les lourds avancent et chargent, les tourelles tiennent leur position. La séparation limite les attroupements. Les PV et dégâts ne sont pas gonflés pour simuler une meilleure IA.
- **Ambiance extérieure.** Vent, oiseaux synthétiques dans la lisière, sons secs dans la carrière et insectes dans les jardins ; pas et réverbération changent en passant une porte. Les yeux des ennemis et leurs signaux sonores rendent l'alerte lisible.
- **Reprise adaptée aux nouveaux plans.** Une sauvegarde antérieure repart à l'entrée du même secteur avec les résultats des secteurs déjà terminés. Son ancien point est conservé séparément. Les sauvegardes de la nouvelle génération reprennent normalement au dernier relais.

Le déplacement amorti, les armes animées, les réglages de confort, les détails industriels et les corrections d'ombres de la 0.3 sont conservés. Les résultats observés figurent dans `VALIDATION.md`.

## La campagne

- **Trois plans distincts.** Deux boucles de maintenance dans la lisière, doubles galeries autour de la carrière, puis jardins et observatoire central avant l'arène. Les ventilateurs, presses et réacteurs s'animent ; les évents annoncent leurs décharges.
- **Deux armes complémentaires.** Impulse tire rapidement et précisément. Fracture disperse sept projectiles instantanés, efficace de près, avec une cadence plus lente et davantage de chaleur.
- **Onde de choc.** Repousse et étourdit les machines proches, dissipe les projectiles et réduit la chaleur. Son délai de récupération impose de choisir son moment.
- **Combat plus lisible.** Scouts mobiles, marcheurs qui préparent leur charge, tourelles à rafales et gardien à deux phases. Les yeux et les repères au sol annoncent l'attaque ; les tirs verrouillent leur direction avant de partir.
- **Points de reprise.** L'entrée d'un secteur et chaque relais sauvegardent l'état de la partie. On peut continuer après avoir fermé la page. Une brève protection évite de réapparaître directement dans un projectile.
- **Score et séries.** Les éliminations rapprochées augmentent le score ; le bilan d'expédition rassemble les trois secteurs.
- **Rendu procédural.** Relief des panneaux, métal brossé, reflets et éclairage industriel. Le mode Économie réduit les passes graphiques coûteuses.
- **Ambiance par secteur.** La synthèse musicale varie avec le paysage et la menace ; les armes, l'onde et le gardien ont leurs propres sons.

## Mission et commandes

Dans chaque secteur, approchez-vous des trois relais lumineux, puis rejoignez le portique. Les relais restaurent une partie de votre intégrité et deviennent des points de reprise. Les soins se ramassent automatiquement lorsqu'ils sont utiles. Dans le troisième secteur, le gardien doit également être neutralisé avant de sortir.

Les armes utilisent la même jauge de chaleur, sans munitions limitées. Relâchez le tir pour refroidir. L'onde possède un rayon de 6,5 m et une recharge de 7 secondes. Une esquive accorde brièvement l'invulnérabilité. Les évents orange annoncent une décharge ; leur phase chaude reste évitable.

| Action | Ordinateur | Téléphone |
| --- | --- | --- |
| Déplacement | ZQSD / WASD | Joystick gauche |
| Visée | Souris ; glisser si capture indisponible | Glisser sur la droite |
| Tir | Clic gauche / Entrée | Grand cercle |
| Changer d'arme | 1 / 2, molette, ou nom de l'arme | Nom de l'arme en bas à droite |
| Onde de choc | E | Bouton à anneaux |
| Esquive | Espace | Bouton flèche |
| Course | Maj | — |
| Pause | Échap / P | Bouton pause |
| Carte | M | Bouton carte |
| Secours clavier | Flèches haut/bas pour avancer/reculer, gauche/droite pour tourner | — |

Les réglages de son, qualité graphique et mouvements de caméra sont dans la pause. Le changement d'arme ne remet pas à zéro la surchauffe.

### Sauvegarde locale

L'écran d'accueil propose **Continuer l'expédition** quand un point de reprise existe. **Nouvelle expédition** remplace ce point ; **Recommencer ce secteur** repart de son entrée. Pour un point compatible, la reprise conserve les relais, machines éliminées, score, arme et délais de récupération enregistrés.

La sauvegarde reste dans ce navigateur, sur cette origine, sans synchronisation ni compte de jeu. Effacer les données du navigateur l'efface aussi. Si le stockage local est indisponible, le point de reprise fonctionne pendant la session.

**Passage à Horizons :** les nouveaux plans utilisent la génération 4. Une ancienne sauvegarde reprend à l'entrée du même secteur et conserve la graine, l'arme ainsi que les statistiques cumulées des secteurs terminés. Les relais et ennemis du secteur en cours repartent de zéro. L'ancien point est copié dans `ferro-expedition-v2-before-horizons` lorsque le stockage le permet, sans écraser une copie déjà présente.

## Ce qui est procédural

| Élément | Construction |
| --- | --- |
| Architecture | Trois graphes conçus pour rester traversables ; dimensions, placement et détails déterministes selon une graine |
| Géométrie | Boîtes, cylindres, sphères, octaèdres et anneaux générés mathématiquement |
| Matériaux | Panneaux, joints, métal, terre, roche, écorce, feuillage, normales et rugosité calculés dans les shaders |
| Nature et ciel | Assemblages d'arbres et plantes ; vent, nuages, soleil et brume paramétrés par secteur |
| Machines et personnages | Assemblages de primitives animés par leurs paramètres et états de combat |
| Son | Oscillateurs, bruit synthétique et filtres Web Audio |
| Effets | Particules, projectiles, onde, ombre et bloom calculés à l'exécution |

| Secteur | Plan | Zones / liaisons | Zones à ciel ouvert | Chemins extérieurs |
| --- | --- | ---: | ---: | ---: |
| La lisière rouillée | Deux boucles de maintenance | 9 / 10 | 5 | 7 |
| La carrière des braises | Deux longues galeries | 8 / 9 | 5 | 9 |
| Les jardins du veilleur | Observatoire central et arène | 9 / 12 | 5 | 12 |

La graine change les dimensions et détails, tout en conservant le graphe propre à chaque secteur. Il ne s'agit pas d'un labyrinthe dont la topologie entière est aléatoire à chaque lancement. Le sol reste horizontal ; les collines, falaises et volumes en hauteur sont décoratifs, sans plateformes traversables.

## Taille

`SIZE.json` est produit par le build : taille brute du HTML, taille gzip reproductible et SHA-256.

Pour la 0.4.0 : **248 290 octets bruts** (248,29 ko ; 242,47 Kio) et **76 041 octets gzip**. `SIZE.json` contient aussi le SHA-256 du fichier distribué.

Le budget reste **1 400 000 octets non compressés** pour le fichier jouable. Le dépôt, ses tests et la documentation sont séparés de cette mesure. Gzip mesure une compression de transport ; ce n'est pas la taille brute.

**FERRO est un jeu web.** Le navigateur, WebGL et Web Audio sont exclus du fichier. Ce résultat ne correspond donc pas au même défi qu'un exécutable natif de 96 ko.

## Développement

Aucune installation npm n'est nécessaire. Python 3 assemble le fichier ; Node.js exécute les contrôles.

```sh
python3 tools/build.py
node checks/world.test.mjs
node --test checks/simulation.test.mjs checks/motion.test.mjs checks/checkpoint.test.mjs
node checks/build.test.mjs
```

Ou `npm run build` puis `npm test` si npm est disponible.

| Fichier | Rôle |
| --- | --- |
| `src/renderer.js` | Primitives, matrices, matériaux, ombres et passes de rendu |
| `src/world.js` | Génération déterministe, architectures et placements |
| `src/simulation.js` | Collisions, navigation, armes, IA, score et snapshots validés |
| `src/motion.js` | Ressorts de présentation, caméra et montage articulé de l'arme |
| `src/audio.js` | Synthèse sonore et ambiance adaptative |
| `src/game.js` | Commandes, personnages, interface et sauvegardes locales |
| `src/style.css` | Présentation responsive et icônes sans assets |
| `src/index.html` | Structure du jeu |
| `tools/build.py` | Assemblage autonome et mesure de taille |
| `checks/` | Vérifications de génération, combat, reprise et distribution |

Le build est suivi dans Git pour être immédiatement téléchargeable. Relancer `tools/build.py` après toute modification de `src/`.

## Validation et limites

Voir `VALIDATION.md` pour les résultats et `docs/ARCHITECTURE.md` pour les décisions techniques.

Le rendu avancé est contrôlé avec les vrais shaders dans un contexte EGL / OpenGL ES logiciel. Les essais navigateur utilisent le secours Canvas 2D dans l'environnement disponible. Les performances sur GPU physique, Safari macOS/iOS, le multitouch réel et l'équilibrage complet de la campagne restent à confirmer. L'ombre solaire couvre le voisinage de la caméra ; la lampe retenue et la torche couvrent leurs cônes. Les autres lumières ne calculent pas d'occlusion complète.

Le prototype n'inclut pas de saut, d'étages superposés traversables, de multijoueur ou de longue campagne narrative. Un portage natif C/C++ serait un projet distinct pour explorer la contrainte de distribution historique.

### Référence historique

Présentation de .kkrieger par Fabian Giesen : https://www.flipcode.com/archives/04-20-2004.shtml

Documentation originale : https://www.pouet.net/prod_nfo.php?which=12036


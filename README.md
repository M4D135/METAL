# METAL

**Des ennemis de métal. Une bande-son metal.** Un FPS d’horreur et d’action entièrement procédural : 430 machines réparties en garnisons et en vagues, trois colosses, des territoires destructibles et des musiques MOD originales. Modèles, matériaux, animation, effets, instruments et compositions sont produits par le code. Aucun asset de jeu importé.

**Version 0.6.1 — Survie.** Correctif des chutes sous les terrasses après une projection : mort et reprise au dernier point enregistré. Explorez pour trouver vos armes et leurs munitions, récupérez le butin des machines et choisissez vos améliorations dans les ateliers. Le projet auparavant nommé FERRO conserve son dépôt pour préserver les liens et les sauvegardes.

## Jouer

- **Dépôt :** https://github.com/M4D135/FERRO
- **Distribution autonome :** [dist/index.html](dist/index.html), à télécharger puis ouvrir dans un navigateur récent, même hors ligne.

WebGL 2 est recommandé ; le rendu Canvas 2D sert de secours. Aucun CDN, paquet JavaScript, modèle, texture, police ou fichier audio externe n’est téléchargé. Le son commence après une interaction.

## Trois territoires, trois colosses

| Secteur | Machines | Colosse | Hauteur visuelle approximative |
| --- | ---: | --- | ---: |
| La lisière rouillée | 120 | Le Colosse de Fer | 18 m |
| La carrière des braises | 140 | Le Brise-siège | 24 m |
| Les jardins du veilleur | 170 | Le Veilleur primordial | 30 m |

Les populations sont dix fois celles de la version initiale : 120 / 140 / 170 au lieu de 12 / 14 / 17. Ces totaux incluent le colosse et ses six renforts ; ils décrivent la garnison finie du secteur, avec des identifiants stables dans la sauvegarde. Chaque secteur comprend huit grenadiers et six spécialistes des roquettes, trois commandes, deux ascenseurs, trois tremplins et trois relais.

Les régions agrandies mêlent bâtiments, cours, arbres, falaises, installations industrielles et ruines. Les terrasses se trouvent à 0, 3,2 et 6,4 m. Les rampes ont une pente physique ; les ascenseurs transportent réellement le joueur. Les tremplins suivent une trajectoire balistique, avec contrôle aérien et collisions contre les plafonds, murs et plateformes.

Chaque géant possède une arène à ciel ouvert de **60 × 60 m**, reliée au territoire par une passerelle. Les portes monumentales, piliers et frontons restent en périphérie ; le centre permet au boss de se mouvoir sans entrer dans les bâtiments. Les petites machines donnent un repère d’échelle. Les silhouettes des trois colosses diffèrent : cornes métalliques, cheminées de siège, couronne et halo mécanique.

### Vagues et exploration

Les rencontres se déclenchent par zone. Les premières patrouilles sont préplacées ; le reste de la garnison attend en réserve, **sans modèle visible, collision, tir ni dégâts** avant son déploiement. Une annonce précède les renforts. Les petites vagues successives remplacent le grand paquet d’ennemis concentré au départ.

Le budget de combat ordinaire est de **8 / 10 / 12 adversaires engagés simultanément** selon le secteur, hors colosse. Les rencontres voisines partagent ce plafond. Les machines déjà déployées restent physiques ; lorsqu’elles se désengagent, elles regagnent leur poste à pied.

Un renfort arrive seulement par une entrée libre, assez éloignée et réellement masquée par le décor. Tourner la caméra ne suffit pas à autoriser son apparition. Si les couverts ont été détruits ou l’accès bloqué, la vague attend. **La sortie dépend des commandes, des trois relais et du colosse**, sans exiger d’éliminer toute la garnison : une vague optionnelle en attente ne bloque pas la mission.

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

**Options → Partie → Difficulté** propose **Standard**, **Brutal** et **Cauchemar**. Les niveaux renforcent l’agressivité, la cadence et les dégâts ; ils n’ajoutent pas artificiellement des PV aux 430 machines. Le réglage s’applique immédiatement et reste enregistré sur l’appareil. Le changer ne recharge ni la santé ni les munitions et ne recrée pas les vagues. L’équilibrage complet nécessite encore des parties humaines : les tests de comportement ne mesurent pas la peur ressentie.

## Destruction et dangers

**Rupture**, le lance-roquettes, ouvre des brèches dans les murs et fait tomber des morceaux. Fracture et les tirs répétés endommagent aussi le décor. Les morceaux restants ont des collisions correspondant à leur géométrie ; une ouverture visible peut être traversée. Les tirs vérifient le trajet jusqu’à la bouche du canon et les projectiles balaient leur volume pour éviter de passer à travers une paroi fine.

Les structures peuvent perdre leurs panneaux, leurs équipements, leurs lampes et leurs supports. Les éléments privés de support s’effondrent ; les débris sont animés avec un nombre et une durée bornés. Les arbres et accessoires appartiennent à des ensembles destructibles. La suppression d’un obstacle met à jour les collisions, la navigation, le rendu et les ombres.

Les **sols, rampes et plateformes de circulation restent portants**. Il existe un substrat visible sous les territoires, à −0,25 m, pour qu’une brèche extérieure ne donne pas sur un vide sans sol. Cette version réalise une destruction locale par morceaux ; elle n’est pas une simulation structurelle universelle de chaque matériau. Détruire une console libère son circuit, et casser une porte ouvre son passage, afin de conserver une mission terminable.

Une projection hors d'une terrasse ne laisse plus le joueur bloqué vivant sur ce sol inférieur : une chute importante sur le substrat est fatale. Les positions véritablement sous le terrain ou hors du monde déclenchent aussi la mort. L'écran **Chute fatale** permet de reprendre au dernier point enregistré ; une découverte en vol attend un atterrissage sûr avant de remplacer ce point. Les brèches au niveau du sol, rampes, tremplins et ascenseurs restent praticables.

Les conduites percées émettent de la vapeur brûlante depuis une **buse matérielle**, visible à l’extrémité de la conduite. Des cycles de pression animent aussi le décor ; les avertissements précèdent les décharges dangereuses. Détruire la buse ou son assemblage coupe le jet, ses dégâts et son souffle sonore : aucun point de vapeur ne reste suspendu dans le vide.

Lames latérales, presses verticales et dalles à piques ont de vrais volumes mobiles, des annonces et un passage alternatif. Les grenades possèdent une trajectoire, des rebonds et une fusée ; les roquettes parcourent physiquement leur trajectoire. Le couvert arrête le souffle avant que l’explosion ne le détruise : casser un mur n’inflige pas rétroactivement les dégâts de cette même explosion derrière lui. Les explosions développent feu, souffle, fumée et fragments ; les effets restent bornés et suivent l’explosion simulée, sans ajouter de dégâts visuels fictifs.

## Armes et commandes

| Arme / action | Usage |
| --- | --- |
| **Mitraillette — 1** | Impulse, l’arme de départ, avec 48 balles. Tir automatique précis ; viser les points faibles. |
| **Double pompe — 2** | Fracture, à récupérer dans les premières zones ou à acheter. Deux cartouches et quatorze rayons dispersés par tir ; avec une seule cartouche restante, un canon tire ses sept rayons. |
| **Lance-roquettes — 3** | Rupture, à découvrir plus loin ou à acheter. Roquette et souffle ; murs, supports, groupes d’ennemis. Reculez avant de tirer : une roquette trop proche de son point de départ reste non armée. |
| **Lance-grenades — 4** | À trouver dans la zone de l’atelier intermédiaire ou à acheter. Grenades en cloche, rebonds et fusée de 1,8 s ; attention aux retours près du joueur. |
| **Bouclier — main gauche** | À récupérer dès les premières zones ou à acheter. Maintenir la garde face aux attaques ; surveiller l’énergie, puis relâcher pour la recharger. |
| **Onde — E** | Repousse et étourdit à proximité, dissipe les projectiles et refroidit l’arme ; recharge de sept secondes. |
| **Coup de crosse — V** | Attaque courte et faible, sans munition ni chaleur. Un tir à vide utilise aussi ce secours. |

Les munitions sont **finies** : une balle de mitraillette, une ou deux cartouches de double pompe, une roquette ou une grenade selon le tir. Les plafonds de base sont **180 balles / 36 cartouches / 12 roquettes / 16 grenades**. Les racks débloquent les armes ; un rack déjà connu ne fournit que sa réserve restante. Si vous êtes plein, le surplus reste au sol. Les récupérations exigent proximité, bon palier et passage dégagé.

Vous pouvez équiper **deux armes différentes**, une dans chaque main, ou garder le bouclier à gauche. Chaque arme conserve sa cadence, et les quatre armes partagent la chaleur : changer d’emplacement ne contourne pas une surchauffe ou un délai de tir. Les réserves appartiennent au type de munition, sans duplication au changement de main. Les deux montages possèdent leur propre recul amorti, leurs pièces, prises, viseurs et canons.

La première acquisition du bouclier, au sol ou à l’atelier, l’équipe automatiquement à gauche. Il réduit les impacts venant de face, dans la limite de son énergie ; il ne protège pas des attaques arrière ni des dangers sans direction bloquable. Avec assez d’énergie, la garde absorbe 80 % d’un impact direct ou 55 % d’un souffle frontal. **Espace remplace l’esquive par un coup de bouclier lorsque celui-ci est équipé** : coût de 24 énergie, recharge de frappe de 1,1 s, repoussement et bref étourdissement des machines ordinaires proches. La garde consomme aussi lentement de l’énergie ; relâchée, elle se recharge après le délai éventuel d’un impact ou d’une frappe. Changer d’équipement ne recharge pas son énergie.

L’onde reste défensive : ses dégâts sont faibles contre les machines ordinaires et n’entament pas le colosse en mode Survie. Le coup de crosse permet de récupérer des ressources sur une machine proche même à zéro munition. Les projectiles et le souffle respectent les couverts, y compris le trajet entre le regard et la bouche de chaque arme.

| Action | Ordinateur | Téléphone |
| --- | --- | --- |
| Déplacement | ZQSD / WASD | Joystick gauche |
| Visée | Souris ; glisser si capture indisponible ; flèches pour tourner | Glisser à droite |
| Tir main droite | Clic gauche / Entrée | Grand cercle |
| Tir main gauche / garde | Clic droit / C, maintenir pour la garde | Bouton TIR G / GARDE |
| Équipement main gauche | X, ou choix explicite dans le HUD | Bouton main gauche / choix du HUD |
| Course | Maj | — |
| Esquive / coup de bouclier équipé | Espace | Bouton contextuel d’esquive / bouclier |
| Onde de choc | E | Bouton anneaux |
| Coup de crosse | V | Bouton Crosse |
| Commande / ascenseur / atelier | F | Bouton contextuel |
| Arme trouvée en main droite | 1 / 2 / 3 / 4 ou molette | Emplacements d’arme ou nom de l’arme |
| Carte | M | Bouton carte |
| Pause | Échap / P | Bouton pause |

Les touches sont personnalisables. La marche, la course, l’esquive et le contrôle aérien sont plus rapides qu’en 0.5, avec accélération et freinage amortis ; il n’existe toujours pas de saut libre sur une touche. **Les FPS restent visibles par défaut**, en haut à droite. Le HUD montre les quatre armes, l’équipement gauche, l’énergie du bouclier, les réserves et plafonds, la vague locale, la chaleur, la santé maximale, le blindage, les crédits et les noyaux, en plus des objectifs, de l’altitude et du boss.

## Butin, ateliers et améliorations

Les machines ordinaires laissent **6 à 12 crédits**, avec des munitions selon leur type. Chaque colosse laisse un butin physique accessible au sol : **160 crédits, un noyau, 24 balles, 6 cartouches, 2 roquettes et 3 grenades**. Le contenu déjà ramassé n’est pas recréé à la reprise ; les munitions qui dépassent vos plafonds restent dans le butin.

Chaque secteur possède trois ateliers : au départ, plus loin dans le territoire et près de l’arène. Approchez-vous et utilisez **F**. Le monde se met en pause dans l’atelier ; les achats réussis sont enregistrés dans le point de reprise. Les **14 offres** couvrent la réparation, quatre packs de munitions, trois armes de secours, le bouclier et cinq améliorations.

| Achat | Contenu | Prix de base |
| --- | --- | ---: |
| Réparation | Jusqu’à 25 points d’intégrité | 24 crédits |
| Balles | Jusqu’à 24 | 18 crédits |
| Cartouches | Jusqu’à 6 | 24 crédits |
| Roquettes | Jusqu’à 2 | 36 crédits |
| Grenades | Jusqu’à 4 | 36 crédits |
| Double pompe | Arme et jusqu’à 6 cartouches, une seule fois | 150 crédits |
| Lance-roquettes | Arme et jusqu’à 2 roquettes, une seule fois | 260 crédits |
| Lance-grenades | Arme et jusqu’à 4 grenades, une seule fois | 220 crédits |
| Bouclier | Déblocage unique, sans recharge offerte | 180 crédits |

Pour la réparation et les packs, le prix suit la quantité réellement reçue, arrondie au crédit supérieur. Une réserve pleine, une arme déjà possédée ou un rang maximal désactive l’achat. Un refus ne prélève rien.

| Amélioration | Effet par rang, jusqu’au rang 3 | Prix du premier rang |
| --- | --- | ---: |
| Vitalité | +20 points de santé maximale, jusqu’à 160 | 90 crédits |
| Blindage | 8 points de pourcentage de réduction des dégâts, jusqu’à 24 % | 120 crédits |
| Réserves | +25 % de la capacité de base, jusqu’à 315 / 63 / 21 / 28 munitions | 100 crédits |
| Puissance | +10 % de dégâts, jusqu’à +30 % | 140 crédits |
| Refroidissement | +20 % de vitesse de refroidissement, jusqu’à +60 % | 110 crédits |

Les rangs 2 et 3 coûtent davantage de crédits et **un noyau chacun**. Les trois colosses fournissent donc des choix d’amélioration limités. Augmenter la vitalité ne soigne pas ; augmenter les réserves ne les remplit pas. Armes trouvées, quantités de munitions, crédits, noyaux, rangs, équipement des mains et énergie du bouclier sont transmis exactement au secteur suivant. Un redémarrage volontaire du secteur restaure l’équipement de son entrée.

## Machines et déplacements

Les escouades combinent assaut, contournement et suppression. Elles voient, entendent, mémorisent le dernier contact, partagent localement les observations et cherchent des couverts. La visée prédictive utilise le mouvement observé. Un tir vérifie les obstacles et les alliés ; les spécialistes évitent de viser leur propre groupe avec une grenade ou une roquette.

Les sentinelles à trois pieds se déplacent et cherchent une distance de tir. Les bots alternent poursuite, mouvements latéraux et repositionnement, et certains utilisent les tremplins. Une esquive réagit après un délai à un tir observé ; elle n’annule pas un impact déjà reçu. Les machines éloignées peuvent dormir sans perdre leur identité ou leurs PV.

Les modèles proches possèdent plaques chanfreinées, optiques, pistons, membres articulés et armes distinctes. Les pieds suivent la marche réelle ; les membres se replient en vol. La séparation entre matériaux d’architecture et d’objets retire le motif de grille parasite des armes et des ennemis, tout en gardant l’éclairage et les vraies ombres.

Un petit réseau tactique procédural complète les règles de combat avec des scores d’approche, de flanc, de retraite et d’attaques de boss. Ses coefficients sont définis dans le code ; aucun modèle entraîné ou importé n’est chargé. Le mode Auto tente WebNN et n’annonce une accélération que si l’API la confirme. Le navigateur n’expose pas ici le type exact de matériel GPU ou NPU. Le même calcul dispose d’un repli CPU ; l’absence d’accélérateur ne bloque pas la partie et le réseau ne reçoit que les observations autorisées de l’ennemi.

Les [sources officielles de Quake III Arena](https://github.com/id-Software/Quake-III-Arena) ont servi à étudier des principes de déplacement et de combat. Aucun code de ce moteur n’est incorporé. Les personnages, lieux, scripts et compositions de METAL sont originaux.

## Options et musique MOD

Le menu comporte quatre rubriques :

- **Partie :** difficulté, reprise, redémarrage du secteur, retour à l’accueil et aide.
- **Image :** Auto / Économie / Haute, plafond 30 / 60 / 120 FPS ou sans limite, FOV 60–110°, luminosité, ombres, éclat lumineux, FPS, filtre rétro, visière et mouvements de caméra.
- **Audio :** volumes général, musique, armes/machines et ambiances ; essai sonore de deux secondes, rétablissement explicite du mix recommandé, coupure et export MOD.
- **Commandes :** sensibilité, inversion verticale, viseur et attribution des touches avec détection des conflits.

Les réglages s’appliquent immédiatement. Les menus défilent sur petit écran ; le retour reste accessible. Le mode Économie et le secours Canvas offrent une présentation simplifiée. Un plafond de FPS n’est pas une promesse de cadence.

Le jeu génère de **vrais modules ProTracker à quatre canaux**, signature `M.K.`, avec instruments PCM synthétisés mathématiquement, notes, ordres et patterns. Aucun échantillon enregistré, fichier MOD ou morceau commercial n’est importé.

| Composition | Tempo · durée de boucle | Écriture |
| --- | --- | --- |
| Fer noir | 100 BPM · 76,8 s | Power chords graves en Ré, palm-mutes et arrêts ; rupture de quatre mesures puis reprise pesante. |
| Fracture | 170 BPM · 45,2 s | Riffs chromatiques syncopés, picking serré et doubles grosses caisses ; rupture puis montée. |
| Veille des cendres | 145 BPM · 53,0 s | Galop en Mi grave, thème en mode phrygien et tierces diatoniques ; alternance de réponses et de passages mélodiques. |

Chaque morceau possède **32 mesures**, six patterns distincts et huit phrases ordonnées. Les guitares sont synthétisées à partir de cordes à harmoniques, de bruits d’attaque et de distorsion ; la batterie combine ses frappes dans des instruments de mesure pour conserver le format à quatre canaux. Le lecteur Web Audio utilise les mêmes patterns et données PCM que l’export. La menace influe sur le mix, la pause arrête les notes programmées et une reprise se recale sur une mesure. **Options → Audio → Exporter le MOD** enregistre `METAL-01.mod`, `METAL-02.mod` ou `METAL-03.mod`.

Les budgets des voix de musique et des effets sont indépendants. Les sons distants ne peuvent pas prendre les places réservées aux tirs du joueur et aux alertes proches. La musique baisse brièvement pendant les impacts importants, et les ambiances disposent de leur propre bus. Les explosions combinent attaque sèche, corps grave, souffle et retombées métalliques ; rayon, puissance, type et distance modulent ce son. Le mix final conserve une protection de crête. Les souffles de vapeur sont produits par une source continue dont le niveau suit les buses actives proches.

Les tirs simultanés des deux mains restent audibles, avec un léger placement stéréo. Le lance-grenades possède son départ sourd ; le bouclier distingue levée, blocage, rupture et frappe réussie. Les effets respectent les volumes, la pause et les limites de voix.

Les préférences existantes sont conservées, y compris un volume d’effets ou d’ambiance à zéro. Le bouton d’essai fait entendre les véritables bus pendant deux secondes ; **Rétablir le mix** est une action volontaire. Aucun son ne force un curseur coupé à remonter.

## Moteur, sauvegardes et taille

Le moteur conserve la vraie 3D : il n’a pas été remplacé par un raycaster. Les descriptions du monde sont générées au chargement ; la construction des modèles et la préparation des géométries se concentrent sur ce qui peut contribuer à la vue ou aux ombres. Une exclusion incertaine conserve l’objet. Les instances inchangées réutilisent leurs buffers. Les géants et les volumes essentiels de leurs arènes bénéficient d’une portée adaptée, sans étendre tous les petits détails.

Les quatre essences d’arbres emploient des troncs articulés, des fourches raccordées et des couronnes irrégulières, sans ajouter d’objets par arbre. Leurs triangles de feuillage sont partagés avec les intersections de tirs. Sur WebGL 2, le métal combine rugosité, reflet de Fresnel et réflexion procédurale de l’environnement ; ce n’est pas un miroir de toute la scène. Les explosions éclairent leur emplacement réel dans un budget borné, leurs flammes sont animées dans le shader, et le bouclier reste translucide devant le décor. Les ombres mobiles de la lampe, du soleil et de la torche conservent leurs cartes de profondeur.

Auto adapte progressivement la résolution WebGL à la cadence. Les retours arrière après destruction invalident les caches concernés ; ils restaurent aussi les collisions et la navigation. Le champ de distance global inutilisé par l’IA avancée n’est plus recalculé à chaque porte ou brèche.

Les instruments MOD sont préparés par étapes au menu ou sur l’écran de chargement. Après le geste qui déverrouille le son, les AudioBuffers du secteur sont chargés avant l’entrée en combat. Les banques préparées sont réutilisées ; la préparation d’un secteur futur ne change pas la musique active. Un cache borné garde aussi les descriptions de deux mondes, et l’écran de fin de secteur peut anticiper le suivant. Cette préparation réduit les travaux de première utilisation ; elle ne garantit pas une cadence matérielle.

Les points de reprise comprennent terrain détruit, systèmes, physique aérienne, projectiles, boss, directeur de tension, vagues, réservistes, inventaire, équipement des mains, bouclier, butin restant et profil d’améliorations. Les relais, commandes, arrivées d’ascenseur avec le joueur, armes et bouclier découverts, zones sécurisées, boss abattus, butins de boss ramassés et achats enregistrent la progression.

Les points de reprise compatibles de la génération 6 restaurent ces quantités sans remplissage gratuit. Une sauvegarde incompatible reprend à l’entrée du même secteur avec l’équipement de départ prévu pour cette entrée, en gardant la graine et les statistiques des secteurs précédents ; elle ne promet pas de convertir un ancien inventaire. Une copie du point précédent est conservée si le stockage le permet. Le changement de titre garde les clés internes `ferro-settings` et `ferro-expedition-v2`.

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
| `economy.js` | Profils, stats, plafonds, catalogue et transactions atomiques |
| `brain.js` | Réseau tactique procédural, WebNN vérifié et repli CPU |
| `simulation.js` | Physique, IA, vagues, inventaire, butin, combat, progression et snapshots |
| `actors.js`, `motion.js` | Modèles articulés, LOD, caméra et montage des armes |
| `effects.js` | Projectiles, vapeur, fragments et annonces de danger |
| `renderer.js` | WebGL 2, ombres, matériaux et secours Canvas |
| `music.js`, `audio.js` | MOD, synthèse, mixage, ambiances et horreur |
| `options.js`, `game.js` | Préférences, contrôles, HUD, menus et sauvegardes |
| `index.html`, `style.css` | Interface responsive et tactile |

Les résultats vérifiés figurent dans **`VALIDATION.md`**, et les contrats dans **`docs/ARCHITECTURE.md`**. Les images GLES des essais proviennent d’un vrai contexte logiciel Mesa ; elles ne démontrent pas une performance sur un GPU physique. Le navigateur de test utilise Canvas, avec une cadence RAF parfois limitée par son environnement. Aucun débit stable n’est promis pour le Mac de l’utilisateur, Safari ou un téléphone réel. Le test humain d’une campagne entière et l’évaluation de la peur ressentie restent à faire.

METAL reste un prototype compact de science-fiction procédurale. Il ne contient pas de multijoueur, de saut libre sur une touche ni de terrain entièrement excavable. La démarche de distribution s’inspire de `.kkrieger`, sans reprendre son code ou ses assets : [présentation de Fabian Giesen](https://www.flipcode.com/archives/04-20-2004.shtml), [documentation originale](https://www.pouet.net/prod_nfo.php?which=12036).

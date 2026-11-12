# METAL

**Des ennemis de métal. Une bande-son metal.** Un FPS d’horreur et d’action entièrement procédural : 18 mondes, six chapitres, un arsenal à découvrir, des colosses, des territoires destructibles et des musiques MOD originales. Modèles, matériaux, animations, effets, instruments et compositions sont produits par le code. Aucun asset de jeu importé.

**Version 0.7.0 — Campagne.** Les découvertes et les combats sont séquencés, la difficulté suit l’arsenal réellement trouvé, et le rendu gagne des détails proches, des reflets filtrés et des particules travaillées. Le bouclier est repositionné, l’armure se recharge par objets et les ambiances continues sont allégées. Le correctif de chute sous les terrasses est intégré. Le nom historique FERRO reste celui du dépôt et des clés de sauvegarde. Le titre affiche aussi **V0.7.0**, à partir de la version du package, en conservant l’ajout de version effectué en parallèle.

## Jouer

- **Dépôt :** https://github.com/M4D135/FERRO
- **Distribution autonome :** [dist/index.html](dist/index.html), à télécharger puis ouvrir dans un navigateur récent, même hors ligne.

WebGL 2 est recommandé ; le rendu Canvas 2D sert de secours. Aucun CDN, paquet JavaScript, modèle, texture, police ou fichier audio externe n’est téléchargé. Le son commence après une interaction.

## Dix-huit mondes, six chapitres

Une nouvelle expédition traverse six chapitres de trois mondes. **Les trois décors existants reviennent avec des graines propres et une garnison progressive**. Les chapitres sont L’Éveil des forges, La Garde de fer, La Chasse mécanique, Les Forges brisées, La Fournaise et Le Dernier signal. La campagne se termine au monde 18.

Le tableau décrit une progression où tous les trophées précédents ont été trouvés. Une flèche indique le changement **entrée → après la découverte locale**. Les dégâts sont le facteur d’adaptation seul, avant difficulté choisie, décor et blindage. Les PV du boss sont les valeurs réellement instanciées à l’entrée : ils ne remontent pas après une découverte.

| Monde | Décor | Découverte | Garnison | Engagés max. | Dégâts × | Boss · PV |
| ---: | --- | --- | ---: | ---: | ---: | --- |
| 01 | Lisière rouillée | Pistolet (départ) | 42 | 4 | 0,58 | Colosse de Fer · 33 |
| 02 | Carrière des braises | — | 49 | 4 | 0,58 | Brise-siège · 45 |
| 03 | Jardins du veilleur | — | 60 | 4 | 0,58 | Veilleur primordial · 60 |
| 04 | Lisière rouillée | Bouclier | 54 | 4 → 5 | 0,58 → 0,66 | Colosse de Fer · 38 |
| 05 | Carrière des braises | — | 63 | 5 | 0,66 | Brise-siège · 58 |
| 06 | Jardins du veilleur | — | 77 | 5 | 0,66 | Veilleur primordial · 77 |
| 07 | Lisière rouillée | Mitraillette | 66 | 5 → 6 | 0,66 → 0,75 | Colosse de Fer · 54 |
| 08 | Carrière des braises | — | 77 | 6 | 0,75 | Brise-siège · 81 |
| 09 | Jardins du veilleur | — | 94 | 6 | 0,75 | Veilleur primordial · 108 |
| 10 | Lisière rouillée | Double pompe | 84 | 6 → 8 | 0,75 → 0,84 | Colosse de Fer · 74 |
| 11 | Carrière des braises | — | 98 | 8 | 0,84 | Brise-siège · 112 |
| 12 | Jardins du veilleur | — | 119 | 8 | 0,84 | Veilleur primordial · 149 |
| 13 | Lisière rouillée | Lance-grenades | 102 | 8 → 10 | 0,84 → 0,92 | Colosse de Fer · 95 |
| 14 | Carrière des braises | — | 119 | 10 | 0,92 | Brise-siège · 144 |
| 15 | Jardins du veilleur | — | 145 | 10 | 0,92 | Veilleur primordial · 192 |
| 16 | Lisière rouillée | Lance-roquettes | 120 | 10 → 12 | 0,92 → 1 | Colosse de Fer · 118 |
| 17 | Carrière des braises | — | 140 | 12 | 1 | Brise-siège · 180 |
| 18 | Jardins du veilleur | — | 170 | 12 | 1 | Veilleur primordial · 240 |

Les **1 679 identités finies** comprennent les dix-huit boss, leurs renforts et quinze gardes d’épreuves conditionnelles. Ce total ne désigne pas des ennemis simultanés. L’effectif revient légèrement en arrière au début d’un nouveau chapitre, lorsque le décor change ; la progression renforce ensuite le chapitre. On peut terminer un monde sans éliminer toute sa garnison.

Le parcours s’adapte à l’arsenal réellement possédé, selon sa quantité et sa qualité. Manquer une découverte limite les engagés, les dégâts et la cadence ennemie. Les grenadiers ordinaires attendent le bouclier pour leurs explosifs ; les lance-roquettes ordinaires attendent aussi une arme lourde. Les barrages des boss suivent leurs propres scripts annoncés. Changer simplement l’arme équipée ne change pas la difficulté. Les PV du boss sont fixés une fois à l’entrée ; les nouvelles acquisitions ne le soignent pas.

### Découvrir les trophées

Le **pistolet est équipé au monde 1**, avec une réserve illimitée affichée **∞**. Les premières acquisitions suivantes se trouvent dans une alcôve dédiée : **bouclier au 4, mitraillette au 7, double pompe au 10, lance-grenades au 13, lance-roquettes au 16**. Les salles sont optionnelles, signalées sur la carte, et physiquement accessibles.

Un piédestal et son éclairage soutenu par un portique présentent l’équipement. La prise déclenche un bandeau d’usage, un accent musical synthétisé, un changement de lumière et **trois secondes de grâce**, puis une épreuve de trois gardes avec une réserve adaptée. Leur arrivée respecte les couverts et le budget global : un garde peut attendre qu’une place se libère. La reprise conserve la découverte et l’épreuve sans rejouer la récompense.

Les ennemis et les ateliers ne donnent pas accès à une arme encore inconnue. Les caches et offres de munitions correspondantes restent masquées. Le pistolet n’a aucune munition à acheter ou à ramasser.

### Compatibilité classique

Les anciennes sauvegardes à trois secteurs continuent dans leur mode historique : 120 / 140 / 170 machines, quatre armes et les anciens ateliers. L’API `FWorld.create(seed,stage)` conserve ce comportement ; `FWorld.create(seed,index,{campaign:true})` active les 18 mondes. Une nouvelle expédition utilise la campagne.

Les régions agrandies mêlent bâtiments, cours, arbres, falaises, installations industrielles et ruines. Les terrasses se trouvent à 0, 3,2 et 6,4 m. Les rampes ont une pente physique ; les ascenseurs transportent réellement le joueur. Les tremplins suivent une trajectoire balistique, avec contrôle aérien et collisions contre les plafonds, murs et plateformes.

Chaque géant possède une arène à ciel ouvert de **60 × 60 m**, reliée au territoire par une passerelle. Les portes monumentales, piliers et frontons restent en périphérie ; le centre permet au boss de se mouvoir sans entrer dans les bâtiments. Les petites machines donnent un repère d’échelle. Les silhouettes des trois colosses diffèrent : cornes métalliques, cheminées de siège, couronne et halo mécanique.

### Vagues et exploration

Les rencontres se déclenchent par zone. Les premières patrouilles sont préplacées ; le reste de la garnison attend en réserve, **sans modèle visible, collision, tir ni dégâts** avant son déploiement. Une annonce précède les renforts. Les petites vagues successives remplacent le grand paquet d’ennemis concentré au départ.

Le budget de combat ordinaire progresse de **4 à 12 adversaires engagés simultanément** selon l’arsenal possédé, hors colosse. Les rencontres voisines partagent ce plafond. Les machines déjà déployées restent physiques ; lorsqu’elles se désengagent, elles regagnent leur poste à pied. Une vague plus grande que le plafond se déploie en plusieurs fois.

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

**Options → Partie → Difficulté** propose **Standard**, **Brutal** et **Cauchemar**. Les niveaux renforcent l’agressivité, la cadence et les dégâts ; ils se composent avec l’adaptation de campagne sans modifier les PV d’un boss déjà engagé. Le réglage s’applique immédiatement et reste enregistré sur l’appareil. Le changer ne recharge ni la santé ni les munitions et ne recrée pas les vagues. L’équilibrage complet nécessite encore des parties humaines : les tests de comportement ne mesurent pas la peur ressentie.

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
| **Pistolet — 5** | Arme initiale. Tir précis, cadence 0,32 s, réserve illimitée ; utile pour conserver les munitions lourdes. |
| **Mitraillette — 1** | Trophée du monde 7. Tir automatique plus rapide que le pistolet ; une balle par tir. |
| **Double pompe — 2** | Trophée du monde 10. Deux cartouches et quatorze rayons par tir ; une cartouche restante utilise un seul canon. |
| **Lance-roquettes — 3** | Trophée du monde 16. Roquette et souffle contre groupes, murs et supports ; reculez avant le tir. |
| **Lance-grenades — 4** | Trophée du monde 13. Trajectoire en cloche, rebonds et fusée de 1,8 s. |
| **Bouclier — main gauche** | Trophée du monde 4. Garde translucide directionnelle et énergie à gérer. |
| **Onde — E** | Repousse, étourdit, dissipe les projectiles et refroidit l’arme ; recharge de sept secondes. |
| **Coup de crosse — V** | Attaque courte, sans munition ni chaleur. Un tir à vide utilise aussi ce secours. |

Les munitions des quatre armes trouvées sont **finies** : une balle, une ou deux cartouches, une roquette ou une grenade selon le tir. Les plafonds de base sont **180 / 36 / 12 / 16**. Seul le pistolet est illimité ; ses sauvegardes contiennent une sentinelle entière finie, jamais Infinity. Les surplus de réserves restent au sol. Les récupérations exigent proximité, bon palier et passage dégagé.

Vous pouvez équiper **deux armes différentes**, une dans chaque main, ou garder le bouclier à gauche. Chaque arme conserve sa cadence, et les armes partagent la chaleur : changer d’emplacement ne contourne pas une surchauffe ou un délai de tir. Les réserves appartiennent au type de munition, sans duplication au changement de main. Les deux montages possèdent leur propre recul amorti, leurs pièces, prises, viseurs et canons.

La première acquisition du bouclier dans son alcôve (ou à l’atelier en mode classique), l’équipe automatiquement à gauche. Il réduit les impacts venant de face, dans la limite de son énergie ; il ne protège pas des attaques arrière ni des dangers sans direction bloquable. Avec assez d’énergie, la garde absorbe 80 % d’un impact direct ou 55 % d’un souffle frontal. **Espace remplace l’esquive par un coup de bouclier lorsque celui-ci est équipé** : coût de 24 énergie, recharge de frappe de 1,1 s, repoussement et bref étourdissement des machines ordinaires proches. La garde consomme aussi lentement de l’énergie ; relâchée, elle se recharge après le délai éventuel d’un impact ou d’une frappe. Changer d’équipement ne recharge pas son énergie.

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
| Arme trouvée en main droite | 1 / 2 / 3 / 4 / 5 ou molette | Emplacements d’arme ou nom de l’arme |
| Carte | M | Bouton carte |
| Pause | Échap / P | Bouton pause |

Les touches sont personnalisables. La marche, la course, l’esquive et le contrôle aérien sont plus rapides qu’en 0.5, avec accélération et freinage amortis ; il n’existe toujours pas de saut libre sur une touche. **Les FPS restent visibles par défaut**, en haut à droite. Le HUD adapte ses emplacements aux seules armes trouvées en campagne, avec ∞ pour le pistolet ; il montre l’équipement gauche, l’énergie du bouclier, les réserves et plafonds, la vague locale, la chaleur, la santé maximale, le blindage, les crédits et les noyaux, en plus des objectifs, de l’altitude et du boss.

## Armure à ramasser et bouclier

Le HUD sépare les **PV**, les **points d’armure** et l’**énergie de garde**. La réserve d’armure commence à zéro, avec une capacité de **100** ; équiper le bouclier possédé à gauche porte ce plafond à **200**. Le changement de main ne remplit rien. Retirer le bouclier ramène la réserve à 100 au maximum, et le rééquiper ne restitue pas le surplus perdu.

Chaque monde de campagne possède trois réserves de plaques : **25 au départ, 25 près de l’atelier intermédiaire et 50 dans l’arène**. Leur collecte est physique, sur le bon palier et sans traverser un mur. Le surplus reste au sol. Les plaques absorbent un tiers des dégâts résiduels après le blindage passif et la garde, dans la limite des points disponibles. Les chutes fatales restent fatales. L’armure ne se régénère pas avec le temps ; seule l’énergie de garde retrouve sa charge quand le bouclier est abaissé.

La pose du bouclier libère le centre et l’arme droite : panneau plus compact, cadre affiné, montage sur la gauche, abaissement au repos et avancée pendant la frappe. Le mouvement des mains est pris en compte pour éviter leurs intersections ; les canons et les trajectoires de tir conservent leurs positions.

## Butin, ateliers et améliorations

Les machines ordinaires laissent **6 à 12 crédits**, avec des munitions uniquement pour les armes possédées ; celles dont l’identité est multiple de quatre ajoutent **10 points d’armure**. Chaque colosse laisse un butin physique accessible : **160 crédits, un noyau, 50 points d’armure**, et des réserves parmi **24 balles, 6 cartouches, 2 roquettes, 3 grenades**, filtrées selon l’arsenal réellement connu. Le contenu ramassé n’est pas recréé à la reprise ; le surplus reste disponible au sol.

Chaque monde possède trois ateliers : départ, zone intermédiaire et arène. Approchez-vous et utilisez **F**. Le monde se met en pause ; les achats réussis sont enregistrés. En campagne, les offres couvrent réparation, réserves déjà utilisables et cinq améliorations ; les premières armes et le bouclier viennent exclusivement des trophées. Les quatorze offres historiques, dont l’achat d’armes, restent propres au mode classique.

| Achat | Contenu | Prix de base |
| --- | --- | ---: |
| Réparation | Jusqu’à 25 points d’intégrité | 24 crédits |
| Balles | Jusqu’à 24 | 18 crédits |
| Cartouches | Jusqu’à 6 | 24 crédits |
| Roquettes | Jusqu’à 2 | 36 crédits |
| Grenades | Jusqu’à 4 | 36 crédits |

Pour la réparation et les packs, le prix suit la quantité réellement reçue, arrondie au crédit supérieur. Une réserve pleine, une arme déjà possédée ou un rang maximal désactive l’achat. Un refus ne prélève rien.

| Amélioration | Effet par rang, jusqu’au rang 3 | Prix du premier rang |
| --- | --- | ---: |
| Vitalité | +20 points de santé maximale, jusqu’à 160 | 90 crédits |
| Blindage | 8 points de pourcentage de réduction des dégâts, jusqu’à 24 % | 120 crédits |
| Réserves | +25 % de la capacité de base, jusqu’à 315 / 63 / 21 / 28 munitions | 100 crédits |
| Puissance | +10 % de dégâts, jusqu’à +30 % | 140 crédits |
| Refroidissement | +20 % de vitesse de refroidissement, jusqu’à +60 % | 110 crédits |

Les rangs 2 et 3 coûtent davantage de crédits et **un noyau chacun**. Les noyaux gagnés sur les colosses imposent des choix d’amélioration. Augmenter la vitalité ne soigne pas ; augmenter les réserves ne les remplit pas. Armes trouvées, quantités de munitions, crédits, noyaux, rangs, équipement des mains, points d’armure et énergie du bouclier sont transmis exactement au secteur suivant. Un redémarrage volontaire du secteur restaure l’équipement de son entrée.

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

Les budgets des voix de musique et des effets sont indépendants. Les sons distants ne prennent pas les places réservées aux tirs du joueur et aux alertes proches. La musique baisse brièvement pendant les impacts importants. Le grondement, les moteurs et le vent continus sont atténués ; le vent utilise un filtre moins chargé en graves. La vapeur décroît plus vite avec la distance et devient inaudible au-delà de 12 m. Les tirs, impacts, alertes et explosions conservent leurs niveaux. Le mix final conserve sa protection de crête et les réglages de volume existants.

Les tirs simultanés des deux mains restent audibles, avec un léger placement stéréo. Le lance-grenades possède son départ sourd ; le bouclier distingue levée, blocage, rupture et frappe réussie. Les effets respectent les volumes, la pause et les limites de voix.

Les préférences existantes sont conservées, y compris un volume d’effets ou d’ambiance à zéro. Le bouton d’essai fait entendre les véritables bus pendant deux secondes ; les quatre curseurs restent réglables pendant cette écoute. **Rétablir le mix** est une action volontaire. Aucun son ne force un curseur coupé à remonter.

## Moteur, sauvegardes et taille

Le moteur conserve la vraie 3D : il n’a pas été remplacé par un raycaster. Les descriptions du monde sont générées au chargement ; la construction des modèles et la préparation des géométries se concentrent sur ce qui peut contribuer à la vue ou aux ombres. Une exclusion incertaine conserve l’objet. Les instances inchangées réutilisent leurs buffers. Les géants et les volumes essentiels de leurs arènes bénéficient d’une portée adaptée, sans étendre tous les petits détails.

Les quatre essences d’arbres conservent troncs articulés, fourches et couronnes irrégulières. Le métal combine rugosité, Fresnel et reflet procédural du ciel/soleil, filtré à la taille du pixel. L’usure suit les arêtes locales des objets ; les armes et machines ne reçoivent pas la grille des bâtiments. Les étincelles ont une pointe chaude et une traînée balistique ; la fumée possède une opacité structurée. Les quantités de particules restent bornées. Les explosions éclairent leur emplacement réel ; le bouclier reste translucide et les trois cartes d’ombres sont conservées. Il ne s’agit pas de miroirs exacts de la scène.

Auto adapte progressivement la résolution WebGL à la cadence. Les retours arrière après destruction invalident les caches concernés ; ils restaurent aussi les collisions et la navigation. Le champ de distance global inutilisé par l’IA avancée n’est plus recalculé à chaque porte ou brèche.

Les instruments MOD sont préparés par étapes au menu ou sur l’écran de chargement. Après le geste qui déverrouille le son, les AudioBuffers du secteur sont chargés avant l’entrée en combat. Les banques préparées sont réutilisées ; la préparation d’un secteur futur ne change pas la musique active. Un cache borné garde aussi les descriptions de deux mondes, et l’écran de fin de secteur peut anticiper le suivant. Cette préparation réduit les travaux de première utilisation ; elle ne garantit pas une cadence matérielle.

Les points de reprise comprennent terrain détruit, systèmes, physique aérienne, projectiles, boss, directeur de tension, vagues, réservistes, inventaire, équipement des mains, bouclier, butin restant et profil d’améliorations. Les relais, commandes, arrivées d’ascenseur avec le joueur, armes et bouclier découverts, zones sécurisées, boss abattus, butins de boss ramassés et achats enregistrent la progression.

Les enveloppes de campagne sont en **version 3**, avec index 0–17 ; les anciennes enveloppes version 2 continuent explicitement leurs trois secteurs. Les points compatibles conservent les ressources, les découvertes et la phase de chaque épreuve. Une métadonnée d’inventaire d’entrée à 3, 4 ou 5 emplacements incompatible avec le monde ne bloque pas la reprise d’un checkpoint sain. Un checkpoint incompatible est refusé ou reprend proprement à l’entrée selon le cas, sans conversion silencieuse ; une copie précédente est conservée lorsque le stockage le permet. Les clés internes restent `ferro-settings` et `ferro-expedition-v2`.

La distribution 0.7.0 vérifiée mesure **739 903 octets bruts**, **223 144 octets gzip** ; SHA-256 : `7ef8815703ce09fe7140c412c87b6aa57a6262f58fcda7566bbb4a788a5c8bb6`. `SIZE.json` contient ces mesures et l’empreinte du fichier courant. Le budget est **1 400 000 octets non compressés**. Documentation, tests, navigateur et pilotes sont exclus de cette taille ; ce n’est pas la mesure d’un exécutable natif.

## Développement et validation

Aucune installation npm n’est nécessaire : Python 3 assemble la distribution, Node.js exécute les tests.

```sh
python3 tools/build.py
npm test
node tools/campaign-profiles.mjs docs/campaign-world-profiles.json
node tools/campaign-balance.mjs docs/campaign-balance.json
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

La suite finale passe **351 tests, sans échec**. Un [contrôle dans Chrome](docs/qa-v07/browser-smoke.json) vérifie le titre, le démarrage de campagne, le HUD, la première commande physique, les menus et la reprise du point enregistré après rechargement complet à **1363 × 936**. Le navigateur utilisait le secours Canvas 2D et l’IA CPU ; le contrôle ne valide ni WebGL2 ni l’interface mobile.

Les résultats et leurs limites figurent dans **[VALIDATION.md](VALIDATION.md)** et **[docs/validation-v07.json](docs/validation-v07.json)** ; les contrats sont dans **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Les [captures de contrôle](docs/qa-v07/README.md) sont des preuves de rendu et restent hors du jeu. Les mesures logicielles, les fixtures de simulation et les cadres mobiles ne démontrent pas des FPS sur un GPU physique ni une campagne équilibrée par des joueurs. Aucun débit stable n’est promis pour un Mac, Safari ou un téléphone réel.

METAL reste un prototype compact de science-fiction procédurale. Il ne contient pas de multijoueur, de saut libre sur une touche ni de terrain entièrement excavable. La démarche de distribution s’inspire de `.kkrieger`, sans reprendre son code ou ses assets : [présentation de Fabian Giesen](https://www.flipcode.com/archives/04-20-2004.shtml), [documentation originale](https://www.pouet.net/prod_nfo.php?which=12036).

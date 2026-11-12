# Correctif de chute 0.6.1 — 12 novembre 2026

Référence précédant les travaux de campagne. `npm test` : **269 tests réussis, 0 échec, 0 annulé, 0 ignoré**, suite `node:test` en **29 207,292 ms** ; génération historique **18 configurations et 4 800 cibles** vérifiées séparément. Distribution : **692 464 octets bruts**, **208 799 octets gzip**, **0 asset externe**. SHA-256 : `c7d78c7939dddb25b47fb22d93136f0f7cb024f6053d9aa0cc97b261ee98f9f2`.

Une roquette réelle faisait tomber le joueur depuis 3,2 m sur le substrat −0,25 m, avec environ 91 PV restants. Le compteur de chute était réinitialisé à l'atterrissage. La régression vérifie désormais cette explosion à 20/60/120 Hz, puis la mort unique. Le scénario physique est également reproduit dans les trois arènes de la graine 96 après destruction de leur rambarde. Il démontre une chute hors du bord, pas une traversée du plancher porteur.

La QA indépendante valide **42 cas ciblés** : 3 chutes, 3 brèches basses aller-retour, 9 tremplins, 6 ascenseurs, 12 rampes, 3 plafonds et 6 joints de palier. La géométrie et les collisions sont réelles ; les ennemis sont retirés et les systèmes nécessaires préactivés pour isoler les parcours. Les tests du shell utilisent la vraie simulation, avec DOM/audio/rendu substitués : écran de mort, reprise jouable, sauvegarde intacte et acquisition en vol ne remplaçant pas le dernier point sûr. Aucun nouvel essai matériel, navigateur ou FPS n'est revendiqué pour ce correctif.

L'audit préalable de la campagne et de la passe visuelle figure dans [docs/CAMPAIGN_AUDIT.md](docs/CAMPAIGN_AUDIT.md).

---

# Validation de METAL v0.6.0 — 12 novembre 2026 (historique)

Cette section décrit **0.6.0 Survie**, génération **6**, avec quatre armes, deux mains, bouclier, vagues, économie et inférence tactique optionnelle. Les validations 0.5 et antérieures conservées plus bas sont historiques. Les résultats structurés et les empreintes des sources sont dans [docs/validation-v06.json](docs/validation-v06.json).

## Distribution et régressions

| Contrôle | Résultat |
| --- | --- |
| Génération et accès physiques | **18 configurations, 4 800 cibles, PASS** |
| Suite complète `node:test` | **262 réussis, 0 échec, 0 annulé, 0 ignoré**, 25 786,547 ms |
| Shell et options après les derniers ajustements visuels | **25/25**, 1 064,842 ms |
| HTML autonome final | **690,042 octets bruts**, **208,105 octets gzip** |
| Ressources externes à l’exécution | **0** |
| Modules embarqués | **13**, dont économie et réseau tactique |

SHA-256 final : `f8194770ab4f12cddad79d63728eb5986ab9898499b0556f100b3c57bb094293`. La taille est vérifiée par `checks/build.test.mjs` et reste sous **1 400 000 octets non compressés** ; navigateur, pilotes et documentation sont exclus. Les 18 mondes et les 25 régressions ciblées sont des contrôles distincts ; ils ne s’ajoutent pas artificiellement au total des 262 tests. La suite complète a précédé les derniers ajustements de libellés tactiles, de disposition CSS et de jonction des montants du bouclier ; les 25 tests du shell/options et le contrôle de distribution ont été réexécutés ensuite.

Les régressions exercent les tirs réellement simultanés des deux mains, les relâchements de souris indépendants, les échanges sans duplication ni réinitialisation de cadence, les deux cartouches du double pompe et sa dernière cartouche utilisable seule, les bouches obstruées à un coin, les grenades balayées contre murs/plafonds et restaurées en vol. Elles contrôlent la garde frontale, les dégâts arrière/sol, l’énergie, la frappe collisionnée, ainsi que les stocks et mains exactement transmis entre secteurs. Un inventaire d’entrée malformé ne peut plus empêcher de reprendre un checkpoint valide.

Les tests couvrent également les réservistes absents du rendu et de la physique, les entrées de vagues réellement occultées, les stocks partiels, le butin unique et les achats atomiques. Toutes les anciennes régressions de relief, ascenseurs, tremplins, destruction, couverts, géants et directeur de tension restent actives.

## Parcours du monde

Le parcours final utilise `FSimulation.move/step` dans les trois secteurs de la graine 96 : **4 539,8 m avec les aller-retours du banc, 18 370 pas**, neuf découvertes d’armes, trois boucliers, six caches de grenades, neuf ateliers, neuf commandes, neuf relais et trois sorties. Les ennemis sont retirés avant `create` pour isoler la traversabilité ; portes, ascenseurs, pièges et fuites restent réels. Aucune position, aucun événement ni PV n’est injecté durant le parcours. Ce test prouve les routes et les ramassages, pas l’équilibrage d’une campagne humaine.

Les **588 arbres de 18 mondes** ont des branches raccordées, sans nouveau segment à hauteur de marche. Le post-traitement conserve les emplacements et collisions de jeu. Le maximum reste **17 506 meshes statiques**. Graine96 : 14 077 / 12 555 / 17 377 meshes et 448 / 421 / 504 colliders. Les 72 triangles canoniques du feuillage servent aux tirs, aux ombres et au rendu ; les tests visent toutes les faces sous plusieurs transformations et vérifient destruction puis restauration.

## Interface et rendu

Dans le navigateur, une fixture locale à un véritable atelier fournit uniquement un financement et une blessure initiaux. Les achats utilisent le vrai catalogue : **1 200 → 390 crédits** pour double pompe, roquettes, grenades et bouclier ; les armes deviennent disponibles dans le HUD. Le tir gauche fait passer les cartouches **6 → 4** et Espace la charge du bouclier **100 → 76**. La reprise conserve l’arsenal acheté. Ces fichiers de contrôle et leurs clés de stockage isolées sont exclus de la distribution.

Le HUD est inspecté à **1363×936**, puis dans des cadres **390×844**, **320×568** et **844×390**, avec commandes tactiles forcées. Les libellés, stocks, choix gauche, garde, interface d’atelier et options restent utilisables. Les chevauchements constatés entre commandes, carte et santé ont été corrigés ; le petit indicateur de direction est masqué en portrait compact au profit de la carte et de l’objectif. Cela ne constitue pas un essai sur téléphone multitouch réel.

Les shaders ont été exécutés dans **Mesa llvmpipe / GLES**, avec **zéro erreur GL** dans les scènes métal, arbres, feu et bouclier. Les captures finales du vrai modèle `game.models()` confirment le panneau transparent, sa monture opaque jointe, le décor visible à travers la garde et l’arme droite sans grille architecturale parasite. Trois cartes d’ombre demeurent actives. La lumière de détonation chauffe les surfaces à sa source puis disparaît ; les flammes ont une animation de température et de bruit procédural.

Les reflets sont procéduraux : ils ne reflètent pas chaque objet de la scène comme un miroir ou du ray tracing. Les ombres dynamiques conservent leur budget local. Le secours Canvas reste plus simple ; l’amélioration des pins augmente d’environ17% les commandes Canvas dans une vue de départ mesurée, sans augmenter le nombre de meshes du monde. Aucun gain général de rendu n’est déduit de la seule simplification des anciennes sphères.

## Audio et accélération

Les trois MOD générés sont décodés indépendamment avec FFmpeg/libopenmpt : **76,8 /45,18 /52,97 s**, crêtes **0,640 /0,662 /0,677**, **aucun échantillon saturé**. Les morceaux utilisent riffs graves, palm-mutes, galops, ruptures et batteries originales. Les tirs de chaque main ont des délais audio indépendants ; explosions, garde, rupture et frappe possèdent leurs sons synthétisés.

Un diagnostic DSP reconstruit le mix programmé avant compresseur : rapport tir/musique **−13,7 → +1,1 dB**, ambiance/musique au calme **−18,4 → −8,0 dB**. Ce calcul utilise des filtres/oscillateurs approchés et n’est pas une capture de sortie matérielle. Les tests vérifient volumes nuls, pause, plafonds de voix et protection finale. Aucune écoute humaine n’est revendiquée.

Le réseau tactique **16→20→8** est construit dans le code, sans modèle importé. Les tests vérifient les sorties numériques avec un graphe indépendant, les déplacements de flanc et choix d’attaque réels, ainsi que pertes de contexte, délais, changement de backend et résultats périmés. Le navigateur de QA affiche honnêtement **« CPU · WebNN indisponible »**. L’accélération n’est annoncée qu’après contexte accéléré et inférence de contrôle réussie ; l’API ne révèle pas le type exact GPU/NPU. Aucun NPU physique n’a été mesuré.

## Performances : ce qui est mesuré

Le profilage intermédiaire a identifié des rafales d’activation et de recherche de chemins dans la0.5. Les populations actives ont ensuite été séquencées. Les vues d’entrée fixes de ce profil n’éveillaient aucun ennemi0.6 : leur temps plus faible ne constitue donc pas un comparatif équitable de débit IA.

Un second banc utilise de vraies vagues et les renforts des boss : six scénarios de900pas, cinq à sept acteurs éveillés, tirs et munitions finis. Avant les derniers ajouts WebNN/arsenal, les médianes de simulation vont de **0,149 à0,202 ms**, les99e percentiles de **1,61 à2,87 ms**, mais les maxima atteignent encore **4,88 à57,25 ms** selon le scénario. Génération, rendu et sélection de cible du banc sont exclus. Ces mesures intermédiaires, avec leurs empreintes et limites, sont conservées dans le rapport JSON ; ce ne sont pas les FPS de la livraison finale.

La version finale prépare instruments et buffers audio avant combat, garde au plus deux descriptions de monde, répartit les entrées de vagues, limite travail de navigation, inférences, effets et voix, et évite de construire les modèles des réservistes. Elle conserve un rendu3D, des collisions réelles et les contrôles conservateurs de visibilité. Le rendu WebGL utilise le GPU disponible ; le mode CPU reste le secours.

Le navigateur distant limite ici le RAF à environ **1Hz** et utilise Canvas. Les relevés GLES sont ceux d’un rasteriseur logiciel. Aucun débit minimal, gain FPS sur le Mac de l’utilisateur, essai Safari, GPU/NPU physique ou campagne complète jouée par une personne n’est revendiqué. Les sols et plateformes restent portants, la destruction est locale par morceaux, et la simulation conserve son budget temporel maximal par image. La qualité et la difficulté ressenties restent des questions de jeu réel.

---

# Validation de METAL v0.5.0 — 12 novembre 2026

Cette section décrit la version **0.5.0**, génération **5**. Les sections FERRO 0.4.1 et 0.4.0 conservées intégralement plus bas constituent l’historique ; leurs tailles et mesures ne décrivent pas la version courante.

## Résultats finaux et distribution

Le dernier **`npm test` se termine avec le code 0** sur le fichier autonome final.

| Contrôle | Résultat exact |
| --- | --- |
| Génération et accessibilité indépendantes | **18 configurations réussies, 3 804 cibles vérifiées** |
| Suite `node:test` | **182 tests réussis, 0 échec, 0 annulé, 0 ignoré, 0 à faire** |
| Durée rapportée par `node:test` | **29 308,11542 ms** |
| Contrôle de distribution | **PASS**, modules, taille, hash et absence de ressources externes |
| HTML autonome | **522 832 octets bruts**, **159 773 octets gzip** |
| Assets externes à l’exécution | **0** |

SHA-256 du HTML, identique dans le journal final et `SIZE.json` : `e6e928d91a126ddccc557532a479b942c7058aa10f5a606f23c3ed2d3ea05afc`. Le fichier reste sous le budget de **1 400 000 octets non compressés** ; navigateur, pilotes, documentation et tests sont exclus de cette taille. Les 18 configurations de génération sont un contrôle distinct des 182 tests, sans les additionner artificiellement.

Les régressions couvrent notamment les **120 / 140 / 170 ennemis réels**, leurs observations et lignes de tir, les reliefs, ascenseurs et tremplins, les collisions aériennes, les brèches et leur restauration, les explosifs et couverts, les pièges, les trois géants et leurs phases, ainsi que difficulté, directeur de tension et migration des sauvegardes. Les fenêtres d’attaque, noyaux ciblables et renforts préplacés sont contrôlés par la simulation ; ce résultat ne remplace pas une campagne jouée par une personne.

## Parcours, navigateur et rendu

Un parcours indépendant sur les trois secteurs de la graine **96** utilise les véritables `move`, `step` et tirs, sans affectation de position ni injection d’événement : **3 brèches ouvertes par roquette**, sortie sur le sol extérieur à **−0,25 m** puis retour par chaque brèche, **9 commandes activées manuellement**, **9 relais** et **3 sorties atteintes**. Les traces totalisent **2 173,6 m**, **8 875 pas** et **442,9 secondes simulées**. Les ennemis ont été retirés avant création pour isoler l’accessibilité ; plafonds, dangers et portes générés sont conservés. Ce parcours valide les routes et la progression, pas la difficulté des combats.

Dans le navigateur, les contrôles réels ont confirmé le titre **METAL**, la sélection du lance-roquettes par **Digit3**, un tir ouvrant une brèche, sa traversée avec altitude extérieure **−0,25 m**, l’éveil d’un géant en **phase 1/3** et la difficulté **Cauchemar** sélectionnée dans les options.

Le rendu a été contrôlé dans un vrai contexte logiciel **OpenGL ES 3.2 / Mesa llvmpipe** : **16 scènes**, puis **2 vues finales avec l’éclairage assombri**, avec **zéro erreur GL**. Les scènes comprennent terrain intact, brèche, explosion, poussière, effondrement, restauration, géants à plusieurs distances et coupure d’éclairage. Les comparaisons intact/restauré et avant/après rétablissement de la lumière sont **identiques pixel par pixel**, en GLES et, pour la lumière, en Canvas. Les captures intermédiaires des géants précèdent l’ajout des monuments périphériques ; les deux vues finales contrôlent la présentation assombrie du départ et du géant.

L’audio est vérifié par les tests de génération et de programmation du graphe Web Audio : **48 voix d’effets maximum**, **28 voix musicales maximum**, une source de bruit persistante pour la vapeur. La protection finale est vérifiée mathématiquement et par le graphe. Aucune écoute humaine ni mesure du mix complet sur un périphérique audio n’est revendiquée.

## Coût de simulation et limite des mesures FPS

Banc **Node v24.22.1**, `FDestruction` chargé, graine 96 : **900 pas à 1/60 s par secteur**, soit 2 700 pas au total. Le joueur reste au départ après activation de la première commande ; sa santé est rétablie à chaque pas pour maintenir le scénario. Le rendu est exclu.

| Secteur | Acteurs / éveillés en fin de mesure | Médiane par pas | Moyenne | 95e percentile | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 120 / 42 | 0,589 ms | 1,396 ms | 4,620 ms | 81,137 ms |
| 2 | 140 / 45 | 0,763 ms | 1,141 ms | 2,106 ms | 59,929 ms |
| 3 | 170 / 47 | 0,710 ms | 1,121 ms | 1,962 ms | 64,064 ms |

Les médianes sont inférieures à 1 ms dans ce scénario, mais les pointes mesurées atteignent **60 à 81 ms**. Le rafraîchissement de navigation après destruction est réparti en lots bornés ; les collisions changent dès la brèche. Ces chiffres ne décrivent ni un combat avec tous les acteurs éveillés, ni les FPS du jeu complet.

Dans le navigateur de contrôle, le rappel `requestAnimationFrame` était limité à environ **1 par seconde**, alors que les appels de rendu mesurés prenaient **14–19 ms près de la brèche** et **31–38 ms face au géant**. Cette cadence de l’environnement ne permet pas de conclure à un débit stable. Aucun résultat sur GPU physique, Mac de l’utilisateur, Safari ou téléphone réel n’est revendiqué.

## Limites conservées et provenance

La destruction est locale, par morceaux : **sols, rampes et plateformes d’ascenseur restent portants**. Le terrain n’est pas entièrement excavable et le moteur ne simule pas universellement la résistance de chaque matériau. Les gros restes solides conservent leurs collisions ; les débris cosmétiques animés ne bloquent pas le joueur. Une console détruite libère son circuit pour préserver la progression. Le secours Canvas et le mode Économie simplifient la présentation. Il n’y a ni multijoueur ni saut libre sur une touche. L’équilibrage d’une campagne entière et l’effet de peur ressenti restent à évaluer par une personne.

Sources de contrôle : `SIZE.json`, `qa-ferro-v05/final-release-tests.txt`, `qa-ferro-v05/metal-final-benchmark.json`, `qa-ferro-destruction/FINAL-QA.json`, les captures `final-night-spawn` / `final-night-giant`, et `ferro-world-v05/integrated-demolition.json`. Cette section rassemble les résultats existants ; sa rédaction n’a relancé aucun test ni build.

---

# Validation de FERRO 0.4.1 — FPS, matériaux et performances

Vérifications finales réalisées le **12 novembre 2026**, sur la source restaurée depuis le dépôt officiel puis le fichier autonome assemblé. Les résultats historiques de la 0.4.0 sont conservés plus bas et identifiés comme tels.

## Version contrôlée

- Dépôt : https://github.com/M4D135/FERRO
- Site privé conservé : https://ferro-procedural-fps.garden-lake-2660.chatgpt.site/
- Version **0.4.1**, génération de terrain **4** inchangée, sauvegardes de la 0.4.0 compatibles.
- Fichier jouable : **255 973 octets bruts**, **78 478 octets gzip**.
- SHA-256 du HTML : `243cb40959d83cb99926066edbd19ee1d8432fdc0459c7a65e947d70dea2bab5`.
- SHA-256 du renderer contrôlé en GLES : `920a7331f300dff34503669125658b44715fb6f98e3133b070a3b5c52cf9afe2`.
- Aucun asset, CDN ou paquet externe à l’exécution. Le navigateur n’entre pas dans la taille du fichier.

## Grille sur l’arme et les machines

Le défaut a été reproduit avec les vrais modèles de `game.js` : arme, lourd et drone, dans une scène de contrôle sans plafond. En Économie, alors qu’aucune shadowmap n’est créée, une translation commune du décor, des lumières et de la caméra produit une ligne sombre sur le torse à 0,6 m et sur le capot bronze de l’arme à 1,55 m. Changer uniquement le terme `panel=grid(...)` dans une copie de diagnostic du shader supprime la ligne. La cause est donc le matériau architectural en coordonnées mondiales, indépendamment des vraies ombres.

Le correctif réserve les panneaux au décor et utilise des coordonnées locales pour les surfaces d’objets. Les détails du métal suivent maintenant les acteurs. Sur les comparaisons de translation, l’écart moyen du torse passe de 7,111/255 à **0**, et celui du capot de 8,416 à **0,061** (résidu au bord de la géométrie).

**Huit images finales en OpenGL ES 3.2 / Mesa llvmpipe** ont passé avec compilation réelle des shaders, framebuffers complets et **zéro erreur GL** : intérieur Économie, intérieur Auto, extérieur Auto, ombres isolées, cache chaud et acteurs déplacés. L’ombre du lourd sur le sol et les jambes reste présente ; seule la variante de diagnostic sans réception des ombres la fait disparaître. Le sampler `highp`, le PCF et le vent commun aux passes sont conservés.

## Régressions et exactitude des optimisations

Le build puis **`npm test`** passent sur les sources finales :

| Groupe | Résultat final |
| --- | --- |
| Génération et accessibilité | 18 configurations, 750 cibles |
| Simulation | 43 tests, dont les 42 régressions antérieures |
| Mouvement et présentation | 7 tests |
| Sauvegarde et reprise du shell | 4 tests |
| Total simulation / mouvement / shell | **54 réussis, aucun échec** |
| Distribution | Taille, hash, modules et absence de chargement externe validés |

La nouvelle régression compare **21 240 collisions** à un parcours exhaustif indépendant, aux bords de cellules, coins et contacts, avec les rayons du joueur, des ennemis, du gardien et un rayon plus grand utilisant le chemin de secours. Une seconde comparaison couvre **3 240 pas** sur les trois biomes, en patrouille, marche et combat : snapshots complets, événements et locomotion restent strictement identiques avant/après. La cadence et les décisions de l’IA ne sont pas réduites.

Les instances réellement liées aux appels de dessin sont identiques dans **27 scénarios** de rendu, en couleur et dans toutes les passes d’ombre : marche, rotation, FOV, téléportation, lampe déplacée, qualités, redimensionnement, changement de monde et restauration du contexte. Aucun objet manquant ou ajouté.

Les contrôles GLES des caches montrent aussi :

- Première image et image avec cache chaud : identiques pixel par pixel.
- Acteurs déplacés de 0,32 m, rendu frais contre cache chaud : identiques pixel par pixel.
- Pose déplacée contre pose précédente : 69 443 pixels changent ; acteurs et ombres ne restent pas figés.
- Cycle Auto / Économie / Haute / Économie / Auto puis destruction : **50 ressources créées, 50 libérées**, zéro restante. Les trois buffers supplémentaires sont libérés. Le repli sur framebuffer incomplet et la restauration du contexte sont également vérifiés.

## Mesures de coût

Ces mesures sont des bancs séparés et ne s’additionnent pas en un gain FPS global.

| Mesure, mêmes entrées avant/après | 0.4.0 | 0.4.1 |
| --- | ---: | ---: |
| Transfert d’instances, vue fixe avec 25 meshes dynamiques | 315 328 octets/image | 1 600 octets/image |
| Nombre de transferts dans cette vue | 8 | 2 |
| Appels de dessin / instances couleur | 31 / 1 666 | 31 / 1 666 |
| Triangles, ombres comprises | 149 860 | 149 860 |
| Préparation CPU avec WebGL simulé, médiane de trois séries | 7,35 ms | 5,24 ms |
| Simulation Node native, médiane pour 5 400 pas | 268,09 ms | 147,65 ms |

Les transferts baissent de 99,49 % dans cette vue stationnaire ; le bénéfice diminue quand le déplacement change les sélections. Les sept vues mobiles du banc renderer économisent environ 28,3 Kio par image. La mesure CPU utilise un WebGL simulé et exclut donc le coût d’un vrai pilote.

Le banc de simulation utilise Node v24.22.1 directement, sans VM ni profileur : cinq essais alternés, graine 96, trois biomes × trois scénarios × 600 pas à 1/60 s, après 180 pas de chauffe par scénario. La génération et l’initialisation sont exclues. La médiane indique environ 44,9 % de coût de simulation en moins dans cet environnement partagé ; elle ne mesure pas les FPS du jeu complet. Les chiffres d’un environnement perdu pendant la session ont été écartés du comparatif final.

## FPS et essais navigateur

Le navigateur disponible utilise **Canvas 2D**, pas WebGL. Les comparaisons sont au premier plan, en Auto, fenêtre **1363 × 936**, canvas **1024 × 703**, lisière graine 96. La version précédente utilise son compteur DOM existant ; la nouvelle affiche la mesure correspondante dans le HUD.

| Court parcours de référence | Avant | Après |
| --- | ---: | ---: |
| Au départ, vue vers les arbres et l’entrée | 26 FPS | 31 FPS |
| Avancer pendant deux secondes | 24 FPS | 28 FPS |
| Avancer pendant quatre secondes au total | 25 FPS | 30 FPS |

Il s’agit de relevés ponctuels, pas d’un benchmark de toute la campagne. Les fenêtres de moyenne du compteur diffèrent légèrement (environ 1 s avant et 0,75 s après), et le processeur est partagé. Une vue plus avancée dans le sentier a également affiché **23 FPS** dans la nouvelle version : aucun débit minimal de 30 ou 60 FPS n’est promis. Le gouverneur de résolution WebGL n’intervient pas dans ce comparatif Canvas ; les dimensions de rendu restent identiques.

Vérifications manuelles sur le fichier final :

- Compteur visible en haut à droite ; nombre identique à la mesure FPS du DOM et rafraîchissement pendant le déplacement.
- Continue sur le checkpoint 0.4.0 sans migration de terrain, déplacement, pause et reprise.
- HUD sans chevauchement ni débordement aux formats **390 × 844**, **320 × 568** et **844 × 390**.
- Compteur affiché aussi en tactile ; commandes d’onde, esquive et passage à Fracture actionnées dans le format paysage.
- Journaux inspectés : erreurs d’extension du navigateur distinctes de la page du jeu, aucune erreur du jeu relevée dans ces observations.

Les interfaces mobiles sont testées dans un cadre redimensionné avec commandes tactiles forcées ; cela ne remplace pas un téléphone multitouch réel. La capture du compteur provient du jeu dans l’aperçu. La publication est validée séparément par le service d’hébergement.

## Résolution Auto et limites

Le contrôleur de résolution WebGL est testé avec pic isolé, lenteur durable à 40 et 200 ms/image, pause, reprise de débit, Retina, Haute et Économie. Il baisse uniquement après une lenteur prolongée et remonte plus lentement ; les modes fixes restent fixes. Le plafond initial est d’environ 1,8 million de pixels. À 3840 × 2160, Auto commence à **1789 × 1006**, puis peut descendre à **1163 × 654**, sans recréer son atlas de profondeur.

Le compteur utilise le temps RAF réel non tronqué par le pas de physique ; les périodes masquées et les transitions d’écran réinitialisent la fenêtre. L’adaptation est limitée à une partie visible ayant le focus. La génération de terrain, les silhouettes, les sauvegardes et l’IA restent celles de Horizons.

Les essais ne remplacent pas un GPU physique, Safari sur le Mac de l’utilisateur, un téléphone réel ou une partie humaine complète. Le secours Canvas conserve son tri de polygones et ses ombres simplifiées. Les ombres WebGL restent locales aux sources retenues. La simulation conserve au plus 0,12 seconde par image ; un appareil durablement sous environ huit FPS peut encore ralentir le jeu.

---

## Historique — validation de FERRO 0.4.0 — Horizons

Vérifications réalisées le **12 novembre 2026** sur le fichier autonome assemblé et les sources correspondantes.

### Version contrôlée

- Dépôt : https://github.com/M4D135/FERRO
- Site privé : https://ferro-procedural-fps.garden-lake-2660.chatgpt.site/
- Version : **0.4.0**, génération de terrain **4**.
- Taille du fichier jouable : **248 290 octets bruts**, **76 041 octets gzip**.
- SHA-256 du HTML : `7fd67226b0f445b99e51b64c7737de49e775d73fd2776870253ef92d3c3f32f2`.
- Aucun asset ou code externe chargé à l’exécution. Le navigateur reste exclu de la mesure.

Les trois territoires mêlent des cours et chemins à ciel ouvert avec des bâtiments industriels. Le joueur commence dehors. Les deux armes, neuf relais, évents et gardien final restent présents. La simulation ajoute perception, mémoire, alerte locale, navigation tactique et couverture sans augmenter les PV ou dégâts des machines.

### Résultat des contrôles automatisés

| Groupe | Résultat |
| --- | --- |
| Génération et accessibilité | **18 configurations réussies**, 750 cibles contrôlées |
| Simulation | **42 tests réussis**, dont les 30 régressions précédentes |
| Mouvement et présentation | **7 tests réussis** |
| Bouton Continuer et migration du stockage | **4 tests réussis** |
| Distribution | Taille, SHA-256, modules embarqués et absence de chargement externe vérifiés |

La suite du projet a passé. Après le dernier durcissement du couvert au rayon 3D, les 53 tests simulation/mouvement/shell ont été réexécutés sur les sources finales ; le build et son contrôle ont également passé. La génération n’avait pas changé depuis ses 18 vérifications.

Commandes reproductibles :

```sh
python3 tools/build.py
node checks/world.test.mjs
node --test checks/simulation.test.mjs checks/motion.test.mjs checks/checkpoint.test.mjs
node checks/build.test.mjs
```

### Mondes et extérieurs

Six graines sont vérifiées dans chacun des trois secteurs : `1`, `7`, `42`, `96`, `2026`, `65535`. Un flood fill indépendant utilise un disque joueur de rayon **0,28 m**, une grille de **0,25 m** et les obstacles réels, sans diagonale traversant les coins.

Les contrôles couvrent le déterminisme, les valeurs finies, le dégagement du départ, les centres des régions, les relais, la sortie, les soins et les positions initiales des ennemis. Les objectifs restent accessibles lorsque tous les évents sont considérés dangereux. Chaque axe de connexion reste ouvert, et l’arène conserve son dégagement pour le gardien.

Les tests extérieurs vérifient également :

- Cinq régions extérieures dans chacun des secteurs, et des atmosphères distinctes.
- Présence d’un arbre proche dans le champ avant au départ.
- Rayons verticaux libres vers le ciel au centre des régions et chemins extérieurs.
- Correspondance exacte des colliders avec leurs meshes solides visibles.
- Troncs collidables jusqu’à 2,9 m, utilisables comme obstacle à hauteur de tir.
- Conservation des troncs, canopées et silhouettes essentielles au niveau de détail minimal.
- Un second flood fill qui **ignore entièrement le masque de sol** : aucune cellule accessible ne sort du terrain. Les frontières bloquent donc physiquement le joueur et ne reposent pas sur une restriction invisible du sol.

| Secteur, graine 96 | Meshes statiques | Arbres | Arbres dans les zones jouables | Cours extérieures | Chemins extérieurs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lisière rouillée | 10 696 | 48 | 20 | 5 | 7 |
| Carrière des braises | 8 378 | 10 | 10 | 5 | 9 |
| Jardins du veilleur | 12 275 | 44 | 20 | 5 | 12 |

Sur les 18 configurations, les budgets observés vont de **8 324 à 12 356 meshes** et de **177 à 213 colliders**, sous les plafonds de 16 000 et 500. Ces nombres décrivent le monde généré complet ; le renderer n’affiche que sa partie pertinente.

Le sol de circulation reste horizontal. Collines et falaises de fond donnent du relief au décor ; elles ne constituent pas des pentes ou plateformes traversables.

### Preuves comportementales de l’IA

Les nouveaux contrôles observent les trajectoires et les conséquences des décisions, pas seulement le nom d’un état.

1. **Perte de trace.** Deux parties identiques placent le joueur dans deux positions cachées différentes après une observation. Les décisions, souvenirs et trajectoires des ennemis restent strictement identiques. La mémoire expire ensuite sans observation nouvelle.
2. **Patrouille.** Une machine non alertée parcourt réellement un trajet local, en restant sur le terrain autorisé.
3. **Bruit.** Les tirs d’Impulse, Fracture et l’onde produisent des enquêtes sur le lieu de leur émission. Un mur réduit la portée d’écoute ; déplacer ensuite le joueur caché ne déplace pas ce souvenir.
4. **Coordination locale.** Un observateur prévient un voisin proche avec sa position connue. Un allié qui ne voit pas le joueur ne retransmet pas cette alerte à toute la carte.
5. **Contournement.** Un éclaireur atteint un flanc en passant physiquement autour de l’extrémité d’un mur solide, sans le traverser.
6. **Couvert puis sortie.** Un éclaireur blessé rejoint une position réellement masquée par une caisse haute, attend, ressort sur un côté puis reprend une attaque annoncée. Un vrai tir vers le scout caché laisse son dernier PV intact. Sauvegarder puis restaurer au milieu de ce comportement conserve la suite exacte.
7. **Séparation.** Les membres d’un groupe se dégagent sans traverser les collisions ; leur vitesse de présentation correspond au déplacement mesuré.
8. **Canon contre un mur.** Une rafale déjà engagée ne peut pas créer un projectile de l’autre côté d’une paroi lorsque le canon la touche.
9. **Cadence.** Une investigation suit le même trajet physique à 20, 60 et 120 pas de simulation par seconde.
10. **Reprise tactique.** Les données mal formées sont refusées sans modifier la partie. Une ancienne reprise compatible importe seulement sa visée enregistrée, sans obtenir la position actuelle d’un joueur caché.
11. **Gardien.** La recherche après perte de contact reste dans son arène, sans l’expédier dans une liaison trop étroite.
12. **Mondes réels.** Des mises à jour tactiques dans les nouveaux extérieurs conservent des positions physiques valides et des checkpoints restaurables.

La revue indépendante a trouvé un arrondi flottant : une attente calculée à `1.4000000000000001` était refusée par une limite de snapshot à `1.4`. Les durées sont maintenant les littéraux `[1.1, 1.25, 1.4]`. Le scénario de couverture et reprise contrôle ce cas avec un ennemi d’identifiant 2.

Les anciens contrôles de collision, de rayon 3D, des deux armes, de surchauffe, d’onde, de charge et rafale verrouillées, d’évents, de score, de boss et de victoire sont conservés. Le parcours de niveau généré avec déplacement ordinaire continue de réussir.

### Mouvement et sauvegardes

Les sept tests de présentation conservent les contrôles des ressorts à différentes cadences, du repos après déplacement, des mouvements réduits, du recul borné et du montage cohérent de l’arme avec lacet, tangage et roulis. Les contrôles de locomotion restent dans la simulation, notamment les collisions, diagonales, accélération, freinage et esquive.

Les quatre tests du shell exécutent le vrai module navigateur avec DOM, son et rendu simulés, et la vraie validation de simulation. Ils actionnent le bouton **Continuer** et examinent l’état ainsi que les écritures de stockage :

- Un point de génération 4 reprend à son relais.
- Un point de génération 3 reprend à l’entrée du même secteur, avec graine, arme et totaux des secteurs terminés.
- Une ancienne enveloppe sans champ `generation` suit la même migration.
- Un snapshot incompatible reprend son secteur sans écraser une copie de migration existante.

L’ancien point est conservé séparément si le stockage le permet. Les relais et ennemis du secteur en cours sont réinitialisés lors d’une migration de terrain. Les points compatibles gardent le mode de récupération avec protection transitoire, sans inflation des statistiques.

### Navigateur et commandes

Le navigateur de contrôle utilise le secours **Canvas 2D** ; ces observations ne constituent donc pas une validation WebGL dans Chromium ou Safari.

Contrôles effectués dans l’aperçu géré du projet :

- Menu Horizons et arbres/ciel visibles dès le départ.
- Reprise d’une vraie sauvegarde de la version précédente : message de migration et entrée dans le même secteur observés.
- Déplacement au clavier depuis la lisière jusqu’au sentier des fougères ; collisions, poursuite et dégâts ennemis actifs.
- Tir continu, surchauffe, onde, pause et reprise.
- Élimination puis retour au point de reprise, avec intégrité restaurée.
- Passage entre Auto, Économie et Haute, puis retour en Auto.
- Menu, HUD, pause et boutons aux formats **390 × 844** et **844 × 390**, avec commandes tactiles forcées. Aucun débordement de la page dans les dimensions contrôlées.
- Actions des boutons d’onde, d’esquive et de changement d’arme dans le format paysage. L’interface affiche bien Fracture ensuite.
- Aucune erreur JavaScript attribuée à la page du jeu dans les journaux inspectés. Des erreurs d’extension du navigateur sont distinctes du jeu.

Sur le build final, des relevés ponctuels au premier plan à **1363 × 936** ont donné environ **21 images/s en Auto** pendant le déplacement et **39 images/s en Économie** dans le sentier. Ces relevés ne comparent pas un trajet strictement identique et ne sont pas un benchmark matériel ni une garantie sur toute la campagne. Les deux iframes mobiles servent à contrôler l’interface, pas à mesurer les performances.

Le site de production garde une porte de connexion privée. Le contrôle visuel porte sur l’aperçu ; le résultat de publication est confirmé séparément par le service d’hébergement.

### Rendu GLES réel et ressources

Les shaders réels sont exécutés dans un contexte **EGL / OpenGL ES logiciel Mesa**. Ce contrôle est indépendant du navigateur de test et n’active aucune option graphique spéciale dans celui-ci.

Les images contrôlées comprennent les trois extérieurs, un intérieur, cet intérieur avec flash de tir, la proximité d’un mur, ainsi que les modes Auto, Haute et Économie. **Zéro erreur GL** dans ces vues ; les shaders compilent et les framebuffers de rendu sont complets.

Le ciel, les nuages, le soleil, les matériaux naturels et les ombres directionnelles sont visibles. Les volumes des bâtiments masquent le ciel, et l’éclairage intérieur conserve son caractère industriel. Les bandes du défaut d’ombre précédent ne réapparaissent pas dans les vues contrôlées.

L’atlas contient une lampe locale, le soleil et la torche. Le soleil utilise neuf lectures PCF pondérées, sur 56 m de couverture en Auto ; la lampe et la torche conservent quatre lectures. Le sampler de profondeur reste explicitement **highp**, la correction de pente est appliquée à chaque échantillon et le décalage de torche reste dans le rayon de collision du joueur.

Une assertion confirme que la passe couleur et les trois passes de profondeur reçoivent exactement le même vent et le même temps. Les silhouettes et ombres de feuillage ne sont donc pas animées avec des horloges différentes.

Un cycle Auto → Économie → Haute → Économie → Auto puis destruction du renderer compte **47 ressources créées et 47 libérées, zéro restante**. Le même contrôle avec framebuffers forcés incomplets n’observe aucune fuite. Ce contrôle des appels et allocations complète le rendu GLES réel ; il ne mesure pas la mémoire d’un pilote physique.

Le secours Canvas a reçu deux niveaux de facettes, des chapeaux de cylindres regroupés et une projection unique des sommets partagés. Le contrôle Canvas natif séparé passe d’environ 100 ms par vue extérieure avant ces changements à 44–48 ms en Auto, et environ 22 ms en Économie. Ce comparatif natif ne doit pas être présenté comme des FPS navigateur.

### Limites pratiques

Les essais ne remplacent pas une partie humaine complète ni une validation sur GPU physique, Safari macOS/iOS ou téléphone réel. Le multitouch simultané et l’équilibrage de la campagne restent à éprouver sur ces appareils.

Le secours Canvas utilise un tri de polygones et des ombres projetées simplifiées ; certaines intersections peuvent rester imparfaites. Les ombres WebGL ne couvrent qu’un voisinage et les sources retenues, pas toutes les lumières du niveau. Le déplacement reste horizontal et la boucle conserve au plus 0,12 s par image : une machine durablement sous environ huit images/s peut encore ralentir la simulation.

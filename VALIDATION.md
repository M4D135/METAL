# Validation de FERRO 0.2.0 — Réactivation

Date : 11 novembre 2026.

## Distribution

Sources, vérifications et fichier autonome livrés dans le dépôt privé **M4D135/FERRO**, branche **main**. Les identités et permissions existantes sont conservées.

La publication de la 0.2 a réussi le 11 novembre 2026. Le service confirme l'état **succeeded** pour le déploiement `appgdep_6af4e2725c408191a14dc7cd3af26574`.

**Jeu en ligne :** https://ferro-procedural-fps.garden-lake-2660.chatgpt.site

L'accès reste privé, réservé au propriétaire. L'archive publiée provient du commit source `12cd36dabb80c5f042b108fdbad430c2bf766f49` ; la mise à jour documentaire qui enregistre ce succès ne change aucun octet du jeu. Le fichier autonome permet également de jouer sans cet hébergement.

## Mesure du build

- HTML autonome : **149 698 octets**, soit **149,698 ko décimaux** ou **146,19 Kio**.
- Gzip reproductible : **46 312 octets**.
- Budget : **1 400 000 octets non compressés** ; environ **10,69 %** utilisés.
- Aucun fichier de texture, modèle, police ou enregistrement audio importé ; aucune dépendance d'exécution.
- SHA-256 : `b2bd7ef9830dcc6ca032850c58a48d3222dd7869efa794d7305503b1d9ddc138`.
- Le navigateur et ses API sont exclus. Cette mesure n'est pas celle d'un exécutable natif.

`SIZE.json` est généré avec le build et vérifié contre les octets de `dist/index.html`.

## Génération : 18 mondes, PASS

Six graines sur chacun des trois étages. Un flood fill indépendant emploie un disque joueur de rayon **0,28 m**, une grille de **0,25 m**, les sols et tous les obstacles, sans diagonale à travers les coins.

**750 positions contrôlées**, de 29 010 à 41 366 cellules accessibles selon la carte. Les trois relais, la sortie, les soins et les positions initiales des ennemis restent accessibles. Chaque couloir est physiquement connecté, les trois graphes et leurs dimensions diffèrent, et les boucles restent présentes.

Les objectifs sont aussi vérifiés en traitant tous les évents comme dangereux en permanence : un chemin sûr reste disponible. Les fenêtres d'avertissement et le dégagement initial du boss sont contrôlés.

Pour la graine 96 :

| Étage | Primitives statiques | Colliders | Salles / liaisons |
| --- | ---: | ---: | ---: |
| Ateliers | 1 044 | 224 | 9 / 10 |
| Fonderie | 1 654 | 184 | 8 / 9 |
| Cœur | 1 340 | 218 | 9 / 12 |

Budgets : 2 600 primitives statiques et 350 colliders.

## Simulation : 23 tests, PASS

Les dix régressions de la version précédente restent inchangées. Les contrôles couvrent :

- Arrêt contre un mur mince, glissement et grands déplacements ; plafond d'un pas.
- Occlusion des tirs, sélection de la cible exposée, élimination comptée une seule fois et tir au-dessus d'une couverture basse.
- Surchauffe, refroidissement, esquive et délais de récupération.
- Arrêt des collectes après un dommage fatal.
- Collecte des trois relais, déverrouillage et parcours d'un niveau généré par des déplacements ordinaires.
- Fracture : portée, dispersion, récupération et précision comptée par tir, sans compter chaque pellet comme un tir distinct.
- Onde : recharge immédiate, dissipation des projectiles, ligne de vue et recul respectant les murs.
- Télégraphes, visée verrouillée, rafales esquivables, déplacement latéral des scouts et charge des marcheurs.
- Boss de 30 PV, changement de phase unique à mi-vie et verrouillage de la sortie jusqu'à son élimination.
- Score, séries, expiration du multiplicateur et dommages temporisés des évents.
- Aller-retour des snapshots, conservation des références, signature des cartes et rejet atomique des états invalides.
- Reprise avec projectile létal proche, protection temporaire et absence de persistance de cette protection dans le snapshot.
- Charge qui ne peut plus toucher à travers une cloison fine.

Le test de parcours désactive les ennemis pour isoler la navigation. Les autres tests exercent le combat séparément. Ces contrôles ne remplacent pas une campagne humaine complète avec tous les ennemis actifs.

## Vérifications navigateur

Chromium, avec rendu de secours Canvas 2D dans l'environnement disponible :

- Accueil, démarrage, mouvement clavier, changement d'arme, onde et pause utilisés.
- Tir de Fracture en situation de combat ; score d'élimination observé.
- Fermeture logique par rechargement de page, bouton Continuer et restauration du point d'entrée vérifiés.
- Premier relais récupéré par déplacement normal : **1 / 3**, intégrité restaurée, score **250** et message de point de reprise observés.
- Défaite observée ensuite ; le bouton de reprise restaure le relais **1 / 3**, les **70 points d'intégrité** et le **score 250** enregistrés. La pause confirme le relais utilisé.
- Accueil, HUD et pause examinés en cadres **390 × 844** et **844 × 390** ; boutons tactiles de changement d'arme, onde et pause utilisés.
- Icônes dessinées en CSS ; menu pause en paysage sans débordement constaté.
- Les scènes testées au premier étage affichaient environ 50 images/s au premier plan sur le renderer logiciel ; ce relevé ponctuel ne constitue pas un benchmark de la campagne.

WebGL 2 n'est pas disponible dans ce Chromium. Ces observations ne valident ni Safari iOS, ni un téléphone physique, ni le multitouch réel.

## Rendu avancé

Les appels du vrai renderer ont été capturés puis rejoués, avec ses shaders, matrices, buffers et paramètres, dans **EGL / OpenGL ES 3.2 Mesa llvmpipe**.

- Les trois programmes GLSL compilent et se lient ; les framebuffers couleur et profondeur sont complets.
- Dessin sans erreur GLES, y compris objets dynamiques, arme en overlay, flash et onde.
- Ombre portée confirmée par comparaison avec/sans shadowmap sur une scène d'occlusion.
- Matériaux, relief, lumière et halo inspectés sur les images du sas et d'une chambre.
- Pour la scène statique contrôlée : **9 appels de dessin en Auto**, **3 en Économie**.
- Cinq changements de qualité puis destruction : **44 ressources créées et 44 détruites** dans le contrôle de cycle de vie.
- Ombre et bloom désactivés en Économie ; le secours Canvas annonce correctement ces effets comme inactifs.

Mesa llvmpipe est un rasteriseur logiciel. Ce contrôle est distinct d'un test WebGL dans un navigateur et d'un essai sur GPU physique. L'ombre couvre le cône sous une lumière proche ; les autres sources restent non ombrées.

## Build et intégration

- Syntaxe des cinq modules JavaScript vérifiée avec Node.
- Taille brute, gzip, SHA-256, absence de chargement réseau et remplacement des marqueurs d'assemblage vérifiés.
- Les événements de simulation sont traités après chaque sous-pas : un relais pris avant un coup fatal ultérieur dans la même image devient bien un point de reprise.
- Les touches 1 / 2 répétées ne rejouent plus le son lorsque l'arme choisie est déjà active.
- Les captures et pages de test temporaires ne font pas partie du jeu distribué.

## Limites

Le sol reste horizontal et les structures hautes sont principalement décoratives. Pas de saut, de multijoueur ni de longue campagne narrative. Les plans de base sont conçus ; la graine modifie les dimensions, placements et détails à l'intérieur de ces plans.

Le rendu Canvas utilise un tri de polygones et peut montrer des imperfections aux intersections. Le temps réel est subdivisé en pas d'au plus 1/60 s, avec un rattrapage plafonné à 0,12 s par image : une machine durablement sous environ 8 images/s ralentit encore la simulation.

L'équilibrage de la campagne entière, les performances prolongées, le comportement sur Safari iOS et les commandes multitouch sur appareil réel restent à qualifier. La sauvegarde est locale au navigateur et à l'origine, sans synchronisation entre appareils.


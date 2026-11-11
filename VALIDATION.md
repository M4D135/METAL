# Validation de FERRO 0.1.0

Date : 11 novembre 2026.

## Distribution mesurée

- HTML autonome : **99 011 octets** (99,011 ko décimaux ; 96,69 Kio).
- Compression gzip reproductible : **31 966 octets**.
- Budget initial : 1 400 000 octets pour le fichier jouable non compressé.
- Aucun asset externe ou paquet JavaScript d'exécution.
- SHA-256 : `f58ac5d51246f3416cc0dd6df937472b7a03ae90bf615338e9c8680bf788ef31`.
- Le navigateur et ses API ne sont pas inclus : cette mesure ne constitue pas un défi natif de 96 ko.

Le fichier `SIZE.json` est généré à chaque build et doit rester cohérent avec `dist/index.html`.

## Vérifications automatiques : PASS

`npm test` exécute les trois vérifications disponibles sans installation de dépendances.

### Génération du monde

18 générations indépendantes : six graines, sur chacun des trois étages. Vérification des valeurs finies, du déterminisme et d'un parcours par flood fill indépendant, avec disque joueur de rayon 0,28 m et grille de 0,25 m. Les sols et les obstacles sont tous pris en compte, sans passage diagonal entre les coins.

**396 positions d'objectifs, de sortie, d'ennemis et de soins contrôlées : toutes accessibles.**

### Simulation

Dix tests passent : collision contre un mur mince lors d'un grand déplacement ; glissement ; limites de carte ; plafond du temps d'une image ; occlusion des tirs ; cible devant un mur ; élimination unique ; tir au-dessus d'une couverture basse ; surchauffe et refroidissement ; invulnérabilité et recharge de l'esquive ; arrêt immédiat des collectes après un coup fatal ; collecte des trois relais et ouverture de la sortie ; parcours d'un niveau généré par des déplacements ordinaires.

Le parcours de niveau désactive les ennemis uniquement pour isoler la navigation. Les comportements de tir, dégâts et mort sont testés séparément. Cela ne remplace pas une partie humaine complète sur les trois étages avec tous les ennemis actifs.

### Build

Vérification de la taille brute, du SHA-256, de l'absence de ressources réseau et de marqueurs de construction non remplacés. Syntaxe des cinq modules JavaScript vérifiée avec Node.

## Vérifications visuelles et interactions

- Accueil et HUD observés dans Chromium.
- Déplacement clavier observé dans la scène ; distance à l'objectif et position de carte actualisées.
- Dégâts et écran de défaite observés.
- Boutons démarrer, pause et reprendre utilisés.
- Interface examinée dans des cadres de **390 × 844** et **844 × 390**, avec commandes tactiles activées : accueil, HUD, arme, joystick, boutons de tir/esquive et menus.
- Suppression des glyphes non rendus dans les boutons et adaptation du menu pause en paysage pour éviter son défilement.

L'environnement Chromium de contrôle ne fournit pas de contexte WebGL 2. Ces essais utilisent donc le renderer logiciel Canvas 2D. Ils ne constituent pas un test sur iPhone physique, Safari iOS ou GPU matériel.

## Validation du vrai chemin graphique

Les vrais appels du renderer WebGL ont été capturés, puis rejoués avec les mêmes shaders, matrices, buffers et paramètres dans un contexte **EGL / OpenGL ES 3.2 Mesa llvmpipe**. Compilation et liaison des shaders réussies ; aucune erreur GLES pendant le dessin.

Les rendus du sas et de la chambre centrale ont été inspectés. Pour la scène statique : **974 instances, 18 188 triangles et quatre appels de dessin**. Ce contrôle valide la géométrie, les matériaux et le résultat du pipeline ; Mesa llvmpipe est un rasteriseur logiciel, pas un GPU physique ni le contexte WebGL d'un navigateur.

## Limites conservées explicitement

- Première version jouable : aucune campagne narrative longue, aucun multijoueur.
- Les trois étages partagent une topologie de base, avec variation de dimensions, détails, lumière et ennemis.
- Sol horizontal ; tuyaux et structures hautes principalement décoratifs.
- Éclairage sans shadow mapping.
- Le rendu de secours est moins détaillé et utilise un tri de polygones qui peut montrer des imperfections aux intersections.
- Le gameplay et le chronomètre peuvent ralentir si la machine reste sous vingt images par seconde.
- Équilibrage, endurance de jeu, Safari iOS et contrôles multitouch sur appareil physique restent à qualifier.

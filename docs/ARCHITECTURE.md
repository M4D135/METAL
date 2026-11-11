# Architecture et décisions

## Une recette compacte

Le build rassemble cinq modules JavaScript et les styles dans un HTML unique. Les données décrivent des opérations et des paramètres ; les textures ne sont pas stockées sous forme d'images. Aucun téléchargement n'est nécessaire pour construire le niveau.

Le générateur crée trois variantes de neuf chambres industrielles organisées sur une grille connectée. Chaque chambre dispose de dimensions, de murs et d'équipements déterministes. Les connexions restent garanties ; aucune règle de placement aléatoire ne peut supprimer l'unique accès à un objectif.

Les collisions utilisent les mêmes volumes architecturaux que les murs visibles. La navigation des ennemis emploie une grille reconstruite autour de la position du joueur. Les tirs sont des rayons en trois dimensions ; les attaques des ennemis sont des projectiles simulés et esquivables.

## Rendu et limites

Le chemin principal utilise WebGL 2 et des instances de primitives. La géométrie statique est préparée une fois ; les personnages, projectiles et effets sont actualisés chaque image. Les douze sources lumineuses les plus proches sont retenues. Les matériaux calculent des motifs, du grain, des joints et des reflets ; il n'y a pas d'ombres portées de type shadow mapping dans cette version.

Si WebGL 2 n'est pas disponible, un renderer logiciel Canvas 2D projette les mêmes géométries 3D. Il effectue le clipping, l'élimination des faces arrière, le tri de profondeur, un éclairage simplifié et des joints projetés. Ce mode de secours réduit la finesse des matériaux et la résolution ; il ne remplace pas la caméra par un raycaster 2D. Le tri de profondeur peut montrer des imperfections à l'intersection de grandes surfaces ; WebGL reste le chemin recommandé.

Le temps de simulation est plafonné pour éviter de traverser les murs après une pause ou une longue image. Les déplacements sont subdivisés ; l'esquive respecte les collisions. Les géométries hautes ne bloquent pas arbitrairement la marche.

En dessous de vingt images par seconde, le temps simulé peut avancer plus lentement que le temps réel. Un accumulateur à pas fixe est une amélioration possible pour une version suivante ; le réglage Économie réduit déjà la charge du rendu.

Le monde repose sur un sol horizontal, avec des tuyaux et structures surélevés décoratifs. Le prototype n'a pas encore de plateformes traversables sur plusieurs hauteurs, de saut, de multijoueur ou de sauvegarde de campagne.

## Audio

Le son emploie Web Audio et démarre sur un geste utilisateur. Des oscillateurs, du bruit synthétique et des filtres produisent tous les sons. Une compression et des gains modérés limitent les pointes. Le jeu reste utilisable si l'API audio n'est pas disponible. La pause coupe le son et la reprise restaure le choix du joueur.

## Stockage et réseau

Seuls les réglages de son, de qualité et de mouvement sont enregistrés dans `localStorage`. Aucune donnée de jeu n'est envoyée à un service. Aucune télémétrie, aucun formulaire, aucun compte de jeu. L'éventuelle authentification de l'hébergement relève de la plateforme de publication.

## Vers un défi natif

Une version C/C++ utilisant les API du système permettrait de travailler sur le même type de contrainte de distribution que `.kkrieger`. Cela demande un portage du rendu, du synthétiseur, des contrôles et des outils de compilation. Ce travail est distinct de la petite taille atteinte ici grâce aux API du navigateur.

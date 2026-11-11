# FERRO — Le complexe silencieux

Un FPS 3D compact, inspiré par l'idée technique de `.kkrieger` : conserver les instructions qui fabriquent le contenu, plutôt qu'une collection de textures, de modèles et d'enregistrements audio.

**Tout le contenu du jeu est original.** Aucun code ni asset de `.kkrieger` n'est repris.

## Jouer

**Démo hébergée :** https://ferro-procedural-fps.garden-lake-2660.chatgpt.site

**Dépôt :** https://github.com/M4D135/FERRO

La version autonome est **`dist/index.html`**. Téléchargez ce fichier et ouvrez-le dans un navigateur de bureau récent. Le jeu est également adapté aux commandes tactiles. L'hébergement de démonstration permet de le lancer directement sur téléphone.

Le fichier fonctionne sans CDN, sans téléchargement de modèle, sans police externe et sans connexion réseau après chargement. Le son ne démarre qu'après une interaction.

### Mission

Explorez trois étages d'un complexe industriel. À chaque étage, récupérez les trois relais lumineux en vous approchant, puis rejoignez le portique de sortie. Les relais restaurent une partie de votre intégrité. Les soins se récupèrent automatiquement quand ils sont utiles.

Les machines tirent des projectiles visibles que vous pouvez esquiver. L'arme n'a pas de munitions limitées, mais surchauffe si vous tirez sans relâche. Une carte et une indication de direction facilitent l'orientation.

| Commande | Ordinateur | Téléphone |
| --- | --- | --- |
| Déplacement | ZQSD / WASD | Joystick gauche |
| Visée | Souris ; glisser si capture indisponible | Glisser sur la droite |
| Tir | Clic gauche / Entrée | Grand bouton rond |
| Course | Maj | — |
| Esquive | Espace | Bouton éclair |
| Pause | Échap / P | Bouton pause |
| Carte | M | Bouton carte |
| Contrôle de secours | Flèches haut/bas avancer/reculer, gauche/droite tourner | — |

La pause contient les options de son, qualité graphique et mouvements de caméra. Les préférences sont enregistrées localement.

## Ce qui est réellement procédural

- **Architecture :** neuf salles et douze connexions par étage, dimensions et détails déterministes selon une graine.
- **Géométrie :** boîtes, cylindres, sphères, octaèdres et anneaux générés mathématiquement ; personnages et arme assemblés à partir de ces primitives.
- **Matériaux :** panneaux, joints, grain, béton, métal et zones émissives calculés dans les shaders WebGL.
- **Son :** oscillateurs, bruit et filtres Web Audio pour l'ambiance, les tirs, les impacts, les pas et les relais.
- **Effets :** particules, projectiles, animations et mouvements produits par le code.

Le plan utilise une topologie conçue pour rester traversable. Procédural ne veut donc pas dire que chaque partie est un labyrinthe entièrement aléatoire. Les trois étages varient leur éclairage et la composition des ennemis ; la nouvelle expédition change la graine.

## Taille et comparaison honnête

`SIZE.json` contient les mesures exactes du dernier build : taille du HTML autonome, taille gzip reproductible et SHA-256.

Le budget initial est **1 400 000 octets pour le fichier jouable**. Le prototype est nettement plus petit. Le ZIP d'un dépôt, les commentaires et les fichiers de test ne sont pas la mesure utilisée pour le jeu distribué.

**Il s'agit d'un jeu web, pas d'un exécutable natif de 96 ko.** Le navigateur et ses implémentations WebGL/Web Audio ne sont pas inclus dans cette taille. La comparaison avec le défi historique de `.kkrieger` doit conserver cette distinction. La compression gzip n'est pas la taille non compressée du jeu.

## Développement

Pas d'installation npm et aucune dépendance d'exécution. Python 3 assemble les fichiers ; Node.js exécute les vérifications.

```sh
python3 tools/build.py
node checks/world.test.mjs
node --test checks/simulation.test.mjs
node checks/build.test.mjs
```

Ou : `npm run build` puis `npm test` si npm est disponible.

| Fichier | Rôle |
| --- | --- |
| `src/renderer.js` | Géométrie, matrices, matériaux et rendu |
| `src/world.js` | Génération déterministe et validation de la topologie |
| `src/simulation.js` | Collisions, navigation, tirs, ennemis et progression |
| `src/audio.js` | Synthèse sonore sans échantillons importés |
| `src/game.js` | Commandes, personnages, interface et transitions |
| `src/style.css` | Présentation responsive sans police externe |
| `src/index.html` | Structure du jeu |
| `tools/build.py` | Assemblage autonome et mesure de taille |
| `checks/` | Vérifications de jouabilité et de distribution |

Le build est suivi dans Git pour permettre un téléchargement immédiat. Il faut relancer `tools/build.py` après toute modification de `src/`.

## État du projet

Version **0.1.0** : première tranche jouable, conçue pour vérifier le principe et servir de base à un projet plus ambitieux. Voir `VALIDATION.md` pour les contrôles effectués et leurs limites, et `docs/ARCHITECTURE.md` pour les décisions techniques.

L'étape suivante peut enrichir les interactions de niveau, les silhouettes et les animations, diversifier réellement les étages, puis explorer un moteur natif compact. Aucun objectif de taille native n'est annoncé comme déjà atteint.

### Référence historique

Présentation de `.kkrieger` par Fabian Giesen : https://www.flipcode.com/archives/04-20-2004.shtml

Documentation originale du projet historique : https://www.pouet.net/prod_nfo.php?which=12036

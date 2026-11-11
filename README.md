# FERRO — Le complexe silencieux

**Version 0.2.0 — Réactivation.** Un FPS 3D compact dont la géométrie, les matériaux, les machines et le son sont fabriqués par le code. Deux armes, trois étages industriels, neuf relais et un gardien final.

L'idée technique s'inspire de la démarche de .kkrieger : conserver la recette du contenu dans un petit programme. **Tout le code et tout le contenu de FERRO sont originaux ; aucun asset du jeu historique n'est repris.**

## Jouer

**Dépôt :** https://github.com/M4D135/FERRO

**Jouer en ligne :** https://ferro-procedural-fps.garden-lake-2660.chatgpt.site

La démonstration est publiée avec un accès privé réservé au propriétaire. Une authentification peut être demandée.

Téléchargez **`dist/index.html`** et ouvrez-le dans un navigateur de bureau récent. Le fichier est autonome : aucun CDN, paquet JavaScript, modèle, police, texture ou enregistrement audio à télécharger. Il fonctionne hors ligne après chargement.

Le jeu possède également des commandes tactiles et peut être servi par un hébergement statique. WebGL 2 est recommandé ; un rendu 3D logiciel prend le relais quand il est indisponible. Le son commence après une interaction.

## Ce qui change en 0.2

- **Trois plans distincts.** Ateliers à deux boucles, double galerie de fonderie, puis cœur central et arène finale. Les ventilateurs, presses et réacteurs s'animent ; les évents de la fonderie et du cœur annoncent leurs décharges.
- **Deux armes complémentaires.** Impulse tire rapidement et précisément. Fracture disperse sept projectiles instantanés, efficace de près, avec une cadence plus lente et davantage de chaleur.
- **Onde de choc.** Repousse et étourdit les machines proches, dissipe les projectiles et réduit la chaleur. Son délai de récupération impose de choisir son moment.
- **Combat plus lisible.** Scouts mobiles, marcheurs qui préparent leur charge, tourelles à rafales et gardien à deux phases. Les yeux et les repères au sol annoncent l'attaque ; les tirs verrouillent leur direction avant de partir.
- **Points de reprise.** L'entrée d'un étage et chaque relais sauvegardent l'état de la partie. On peut continuer après avoir fermé la page. Une brève protection évite de réapparaître directement dans un projectile.
- **Score et séries.** Les éliminations rapprochées augmentent le score ; le bilan d'expédition rassemble les trois étages.
- **Rendu enrichi.** Relief procédural des panneaux, métal brossé, reflets, halo lumineux et ombre dynamique depuis une lumière proche en Auto/Haute. Le mode Économie désactive les passes coûteuses.
- **Ambiance par étage.** La synthèse musicale varie avec la profondeur et la menace ; les nouvelles armes, l'onde et le gardien ont leurs propres sons.

## Mission et commandes

À chaque étage, approchez-vous des trois relais lumineux, puis rejoignez le portique. Les relais restaurent une partie de votre intégrité et deviennent des points de reprise. Les soins se ramassent automatiquement lorsqu'ils sont utiles. Au troisième étage, le gardien doit également être neutralisé avant de sortir.

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

L'écran d'accueil propose **Continuer l'expédition** quand un point de reprise existe. **Nouvelle expédition** remplace ce point ; **Recommencer cet étage** repart de son entrée. La reprise conserve les relais, machines éliminées, score, arme et délais de récupération enregistrés.

La sauvegarde reste dans ce navigateur, sur cette origine, sans synchronisation ni compte de jeu. Effacer les données du navigateur l'efface aussi. Si le stockage local est indisponible, le point de reprise fonctionne pendant la session. Un changement incompatible de génération invalide proprement une ancienne sauvegarde.

## Ce qui est procédural

| Élément | Construction |
| --- | --- |
| Architecture | Trois graphes conçus pour rester traversables ; dimensions, placement et détails déterministes selon une graine |
| Géométrie | Boîtes, cylindres, sphères, octaèdres et anneaux générés mathématiquement |
| Matériaux | Panneaux, joints, grain, béton, métal, normales et rugosité calculés dans les shaders |
| Machines et personnages | Assemblages de primitives animés par leurs paramètres et états de combat |
| Son | Oscillateurs, bruit synthétique et filtres Web Audio |
| Effets | Particules, projectiles, onde, ombre et bloom calculés à l'exécution |

| Étage | Plan | Salles / liaisons | Machines animées | Évents |
| --- | --- | ---: | ---: | ---: |
| Les ateliers silencieux | Deux boucles de maintenance | 9 / 10 | 13 | 0 |
| La fonderie profonde | Deux longues galeries | 8 / 9 | 18 | 4 |
| Le cœur du veilleur | Cœur central et arène | 9 / 12 | 5 | 5 |

La graine change les dimensions et détails, tout en conservant le graphe propre à chaque étage. Il ne s'agit pas d'un labyrinthe dont la topologie entière est aléatoire à chaque lancement. Le sol reste horizontal ; les volumes en hauteur ne constituent pas des plateformes traversables.

## Taille

`SIZE.json` est produit par le build : taille brute du HTML, taille gzip reproductible et SHA-256.

Pour la 0.2.0 : **149 698 octets bruts** (149,698 ko ; 146,19 Kio) et **46 312 octets gzip**.

Le budget reste **1 400 000 octets non compressés** pour le fichier jouable. Le dépôt, ses tests et la documentation sont séparés de cette mesure. Gzip mesure une compression de transport ; ce n'est pas la taille brute.

**FERRO est un jeu web.** Le navigateur, WebGL et Web Audio sont exclus du fichier. Ce résultat ne correspond donc pas au même défi qu'un exécutable natif de 96 ko.

## Développement

Aucune installation npm n'est nécessaire. Python 3 assemble le fichier ; Node.js exécute les contrôles.

```sh
python3 tools/build.py
node checks/world.test.mjs
node --test checks/simulation.test.mjs
node checks/build.test.mjs
```

Ou `npm run build` puis `npm test` si npm est disponible.

| Fichier | Rôle |
| --- | --- |
| `src/renderer.js` | Primitives, matrices, matériaux, ombres et passes de rendu |
| `src/world.js` | Génération déterministe, architectures et placements |
| `src/simulation.js` | Collisions, navigation, armes, IA, score et snapshots validés |
| `src/audio.js` | Synthèse sonore et ambiance adaptative |
| `src/game.js` | Commandes, personnages, interface et sauvegardes locales |
| `src/style.css` | Présentation responsive et icônes sans assets |
| `src/index.html` | Structure du jeu |
| `tools/build.py` | Assemblage autonome et mesure de taille |
| `checks/` | Vérifications de génération, combat, reprise et distribution |

Le build est suivi dans Git pour être immédiatement téléchargeable. Relancer `tools/build.py` après toute modification de `src/`.

## Validation et limites

Voir `VALIDATION.md` pour les résultats et `docs/ARCHITECTURE.md` pour les décisions techniques.

Le rendu avancé a été vérifié avec les vrais shaders dans un contexte EGL / OpenGL ES logiciel. Les essais navigateur utilisent le secours Canvas 2D dans l'environnement disponible. Les performances sur GPU physique, Safari iOS, le multitouch réel et l'équilibrage complet de la campagne restent à confirmer. L'ombre couvre le cône sous une source proche, pas toutes les lumières du monde.

Le prototype n'inclut pas de saut, d'étages superposés traversables, de multijoueur ou de longue campagne narrative. Un portage natif C/C++ serait un projet distinct pour explorer la contrainte de distribution historique.

### Référence historique

Présentation de .kkrieger par Fabian Giesen : https://www.flipcode.com/archives/04-20-2004.shtml

Documentation originale : https://www.pouet.net/prod_nfo.php?which=12036


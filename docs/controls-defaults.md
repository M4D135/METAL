# Configuration de commandes par défaut

## Référence conservée le 17 novembre 2026

La configuration publiée de METAL 0.12.8, commit `b82379bb65763186fdbeb9b5cb85212f7dc34335`, est conservée comme référence complète dans `config/default-controls.json`.

Elle était déjà appliquée par `FOptions.defaults()` aux nouveaux profils et aux boutons de réinitialisation. Ce lot ne change donc aucune affectation du jeu : il fige cette configuration avec une référence versionnée et des tests exhaustifs. Il ne prétend pas avoir lu les préférences privées du navigateur du joueur.

Le fichier contient les 25 actions clavier et leurs affectations manette, avec `bindingsVersion: 3` et `padVersion: 2`. Il est chargé par les tests, pas téléchargé au lancement : le jeu reste entièrement autonome et les défauts exécutables restent dans `src/options.js` et le HTML distribué. Toute modification future de ces défauts devra mettre à jour explicitement la référence.

## Clavier

| Action | Touches par défaut |
|---|---|
| Avancer | W / Z / flèche haut |
| Reculer | S / flèche bas |
| Gauche | A / Q |
| Droite | D |
| Tourner | Flèches gauche / droite |
| Tir main droite | Entrée, en complément du clic gauche inchangé |
| Tir main gauche | G, en complément du clic droit inchangé |
| Changer la main gauche | X |
| Courir / boost | Maj gauche ou droite |
| Sauter / monter | Espace |
| Esquiver / descendre | **C** |
| Onde défensive | E |
| Coup de crosse | V |
| Interagir | F |
| Mitraillette | 1 |
| Double pompe | 2 |
| Lance-roquettes | 3 |
| Lance-grenades | 4 |
| Pistolet | 5 |
| Carte | M |
| Vue première / troisième personne | **R** |
| Pause | P |
| Arme suivante | N |
| Changer de personnage | T |

Les identifiants physiques `KeyboardEvent.code` sont conservés tels quels, avec les alias AZERTY/QWERTY existants. Les gestes souris, Échap et les commandes tactiles ne sont pas modifiés.

## Manette

Le profil existant reste inchangé : RT/LT pour les tirs, LB pour courir/booster, A pour sauter/monter, B pour esquiver/descendre, L3 pour l'onde, X pour interagir, RB pour l'arme suivante, Y pour changer de personnage, R3 pour la vue, Back pour la carte et Start pour la pause. La croix garde les quatre sélections d'armes existantes. Les actions sans bouton affecté restent libres.

## Préférences et réinitialisation

Les affectations personnelles sauvegardées restent prioritaires. La nouvelle référence ne remplace pas silencieusement une configuration personnelle. « Réinitialiser les touches clavier » retrouve exactement la table clavier ci-dessus sans changer la manette, le son ou la sensibilité. « Réinitialiser les commandes » utilise toujours les défauts complets du jeu. La migration historique de l'ancien couple vue=C / esquive=R est conservée ; une inversion volontaire enregistrée au format actuel reste personnelle.

## Vérifications de ce lot

- **154 tests réussis**, zéro échec : options, contrôles, entrées clavier/manette, hôte tactile et nouvelle référence.
- Parmi eux, **12 nouveaux tests** comparent la référence complète aux sources et au module embarqué dans le HTML : nouveaux profils PC/tactiles, absence de conflits, association de chaque touche à une seule action, JSON, configuration corrompue, indépendance des profils et réinitialisation clavier sans effacer les choix personnels.
- `python3 tools/build.py` : reconstruction réussie, **34/34 modules FERRO conformes**.
- `node checks/build.test.mjs` : distribution autonome valide.
- Le HTML et `SIZE.json` reconstruits sont identiques octet pour octet à la version publiée. SHA-256 du HTML : `0a08aabba483e79d1717d67c45084e984af68ae3e3997d0cdede8e2be967c8ca`.

Aucun nouveau test navigateur ni nouvelle exécution de la suite complète n'est revendiqué pour ce lot de référence et de tests. Le code exécuté par le jeu, sa version 0.12.8, les mondes, sauvegardes, démos et l'hébergement externe sont inchangés.

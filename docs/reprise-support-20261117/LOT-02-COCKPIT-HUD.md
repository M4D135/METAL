# Lot 02 : cockpit, HUD et commandes

Lire AGENTS.md et README.md de ce dossier. Les tests géométriques existants ne remplacent pas un essai navigateur.

## Fichiers réservés

`src/game.js`, `src/index.html`, `src/style.css`, `src/controls.js`, `checks/controls.test.mjs`. Dans `src/support.js`, le cockpit, les faisceaux et les marqueurs sont concernés, mais toute modification de ce fichier partagé doit être annoncée au lot 01 et intégrée sans écraser ses règles. Préférer un module visuel séparé si les lots travaillent réellement en parallèle ; son enregistrement sera fait par le lot 04.

## Travail

Valider le cockpit léger du drone en première personne, les deux émetteurs latéraux symétriques et l'absence de mains/pistolets humains. Garder le centre dégagé, sans obstruer les ennemis ni ajouter d'asset. Vérifier aussi le champ de vision, 16:9, fenêtres étroites, téléphone, troisième personne et changement de personnage. Ne pas modifier le contrôleur de vol pour simuler une réussite visuelle.

HUD compact : vie, armure, stamina du lourd ou énergie boost, chauffe du laser/de l'arme réellement active. Aide plus petite, rangée, option persistante pour la masquer. Les libellés doivent suivre les réaffectations clavier/manette, y compris le maintien pour pirater. Les tags léger/lourd doivent indiquer une action et un chemin possibles, pas être de simples décorations.

Conserver les touches approuvées, notamment R/C, les aliases AZERTY/QWERTY et le mapping manette. LB sert déjà à courir/booster. Toutes les touches physiques du profil standard sont déjà affectées, mais certaines actions n'ont pas de bouton dédié : traiter les actions manquantes explicitement, sans conflit silencieux. Vérifier press/hold/release au clavier, à la manette simulée et au tactile, puis tester les appareils réels quand disponibles.

## Sortie attendue

Captures réellement rendues avec le nouveau code, tests d'entrées/options et de HUD, absence d'exception. Distinguer Chrome logiciel d'un GPU matériel. Ne pas produire d'image générée présentée comme une capture du jeu. Le lancement local précédent a échoué : retester un navigateur autorisé ou utiliser la CI, et documenter ce qui reste non vérifié.

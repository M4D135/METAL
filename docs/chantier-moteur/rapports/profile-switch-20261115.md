# Changement de personnage visible — 15 novembre 2026

Le changement léger/lourd était présenté comme un texte isolé à gauche sur ordinateur. Il devient un bouton de l'ATH, dans la barre supérieure : personnage actif, capacité (carburant du léger ou explosifs du lourd), action « Passer au lourd/léger » et raccourci courant. Le raccourci suit le périphérique et les réglages : T par défaut au clavier, RB à la manette.

Sur téléphone, le même bouton reste au-dessus du joystick, dans le coin inférieur gauche. Sa cible mesure 124 × 52 px. Le bouton d'onde est décalé pour préserver l'espacement ; le bouton d'interaction reste dans l'écran, y compris à 320 px de large. L'ancien texte flottant est supprimé.

Le bouton accepte le pointeur, l'activation assistée et Entrée/Espace lorsqu'il a le focus. Un maintien ne répète pas le changement et cette activation clavier ne déclenche pas le saut ni le tir. Les contrôles T et RB restent disponibles pendant le jeu.

Validation sur l'artefact identifié par `SIZE.json` et le manifeste joint :

- 81/81 tests des sauvegardes et commandes réussis.
- Chrome/SwiftShader : bouton visible et cliquable, vrai clic souris injecté via CDP, activation Entrée/Espace, maintien sans répétition, touche T, RB et changement du libellé vers RB ; absence d'erreur JavaScript.
- Chrome tactile : changement dans les deux sens, saut/vol maintenu, arsenal avec suspension de l'horloge ; positions et cibles sans superposition en 390 × 844, 844 × 390 et 320 × 568, avec la main gauche sur le petit format.
- Captures ordinateur, portrait et paysage inspectées visuellement.

La manette est simulée dans le navigateur ; aucun essai de manette physique n'est revendiqué. Ce changement porte sur les commandes et leur présentation, sans nouvelle mesure de performances moteur. Il ne clôt pas le programme complet et n'est pas déployé sur l'hébergement.

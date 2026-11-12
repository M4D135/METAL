# Bouclier : vérification native Mesa

Images de la vraie géométrie de game.models(), rendue avec les shaders du jeu en OpenGL ES 3.2 Mesa / llvmpipe (rasterisation logicielle). Ce ne sont pas des captures d’un navigateur ni une mesure de FPS sur un GPU matériel.

- bouclier-avant-mesa.png : gros cadre d’origine, reproduction du problème de chevauchement.
- bouclier-garde-mesa.png : même caméra et monde, nouveau panneau plus compact et séparé de la SMG.
- bouclier-roquette-mesa.png : garde avec le lance-roquettes.
- bouclier-portrait-mesa.png : vrai pistolet et bouclier, viewport 390 × 844 ; une partie du bouclier tenu à gauche reste hors champ.
- bouclier-bash-mesa.png : assemblage complet au pic de la poussée.
- bouclier-repos-mesa.png : pose baissée.

Le banc équipe les armes et le bouclier dans l’état de simulation pour comparer les montages dans le même monde initial (seed 96). Ces captures ne montrent pas une progression normale d’acquisition. Les modèles ne sont pas recréés manuellement. Le HUD DOM n’est pas rendu ici. Aucun asset de ce dossier n’est chargé par le jeu.

bouclier-provenance.json donne les hash des sources et des images, la caméra, les dimensions, les compteurs du renderer et les métadonnées GLES. Toutes les captures indiquent zéro erreur GL.

# Profils, repère du partenaire et commandes mobiles — 15 novembre 2026

Ce palier raccorde les deux personnages complémentaires à la partie, à la manette et au tactile. Il ajoute leurs positions distinctes, le repère du personnage en attente et l'ATH mobile compact demandé par David pendant l'intégration. Il ne clôt pas les 33 lots du programme moteur.

## Demande retrouvée et décisions appliquées

La demande originale du 14 novembre, 07:57:31 UTC, décrit le léger avec jetpack, pistolet, pompe et mitraillette, le lourd avec pistolet automatique, grenades et roquettes, deux progressions parallèles et l'alternance obligatoire : le lourd ouvre un passage, le léger atteint un mécanisme aérien qui libère le lourd. Elle prévoit aussi des boss réservés à l'une des classes.

Source : événement `opencode:ses_e29f6346affeFlPhOCs5Zab0Gb:msg_1d90fc38d001QxhonnbOd3RrSb`, SHA256 `4cc0a32423bf8a8651d9c7659b198b5de57869948b922c8749e2720c222c94b8`. La note KBZA `metal-decisions-david-20261114-profils-manette-musique-v1` a été relue avec vérification du SHA de `learnings/2026-11-14-spark.md` (`b310e3cfd2877de4d3f7bfabf0f72691f705c37d4efea3bee19c152a12669062`). Les précisions du 15 novembre demandent un repère de l'autre personnage et, sur mobile, des commandes dans les coins avec un ATH réduit.

## Comportement livré

- Nouvelles expéditions à deux profils. Léger : vol au maintien du saut, carburant et recharge, trois armes légères. Lourd : pistolet automatique et explosifs. Les sélections d'arme et de main gauche restent propres à chaque classe.
- Chaque personnage conserve sa position, son orientation et son état aérien quand il passe en attente. Le monde, les ennemis, les munitions et l'horloge continuent dans la même simulation. L'intégrité est commune en pourcentage : changer de capacité maximale ne soigne pas par répétition du switch. Les personnages reviennent à l'entrée lors du passage au monde suivant.
- Expérience, niveaux, crédits et améliorations sont séparés. Les récompenses d'arme vont à la classe concernée ; celles du pistolet et les améliorations personnelles vont à la classe active. Un projectile conserve sa classe de lancement après le switch et après restauration.
- Chacun des 18 accès d'arène comporte une brèche réservée au lourd, un relais aérien réservé au léger et une porte protégée commandée par ce relais. Le lance-grenades nécessaire au premier accès se récupère près du départ avec le lourd. Les grenades armées explosent au contact des cloisons de brèche signalées. Les parois de ces accès et la protection des portes empêchent le contournement des verrous ; le décor ordinaire conserve la destruction par les colosses.
- Les gardiens alternent leur classe requise. Le tir d'une mauvaise classe ne les blesse pas et donne une indication à l'écran.
- Un repère discret montre le personnage en attente, sa distance et l'écart d'altitude ; une flèche le situe hors champ et un symbole le place sur le radar. Son libellé reste dans l'écran, y compris sur petit mobile.
- Manette : RB change de personnage, A maintenu utilise le jetpack, vibrations du changement et menus déjà raccordés. Le maintien de RB ne multiplie pas les switches.
- Mobile : joystick en bas à gauche, tir en bas à droite et actions regroupées autour des deux coins ; zones sûres et cibles d'au moins 48 px. Intégrité, munitions et profil restent compacts en haut. Carte et arsenal sont masqués par défaut. Le bouton ARMES ouvre l'arsenal et suspend la simulation pendant la consultation ; la main gauche reste accessible. Texte utile d'au moins 10 px.

## Sauvegardes et compatibilité

Les checkpoints du nouveau mode incluent les deux progressions, positions et équipements, le carburant et la classe des projectiles. Validation avant mutation : un point incohérent est refusé atomiquement. Les anciens mondes et leurs anciennes sauvegardes restent sur leur mode historique ; leurs géométries ne reçoivent pas les nouveaux verrous. Le format du nouveau mode n'est pas publié : il devra être consolidé avec le lot 12, conformément à la révision de sauvegarde unique demandée.

## Vérifications

- Treize tests spécifiques couvrent les classes, la conservation des deux positions, la restauration atomique, la montée au jetpack, la cadence du pistolet automatique, les capacités de munitions séparées, l'origine des projectiles, les 18 récompenses de boss et le repère.
- Les **18 corridors générés** ont chacun été traversés dans le banc physique sans ennemis : échec du léger devant la brèche, grenade réelle du lourd, passage du léger dans la brèche, échec du saut du lourd, vol et activation par le léger, ouverture de la porte. Les tests de progression utilisent aussi des repositionnements explicites pour isoler la capacité de saut du lourd ; ce n'est pas une partie humaine complète de chaque monde.
- Suite générale : contrôle `world.test.mjs`, puis **906/907** tests réussis. Le seul échec concernait `FWorld.create(..., null)` : accès aux options corrigé en accès optionnel, puis le test en échec relancé avec succès. Les 71 tests de navigateur simulé des sauvegardes ont également passé après raccord des modules.
- Build hors ligne contrôlé, aucun asset extérieur. Source, artefact et reçus sont identifiés dans le manifeste de preuves.
- Chrome/SwiftShader : nouvelle partie, RB maintenu, jetpack A maintenu, vibrations simulées, sauvegarde des deux classes, repère de l'autre personnage, boutons tactiles réels par CDP, ouverture/fermeture de l'arsenal avec arrêt de l'horloge, contrôles et captures portrait/paysage. Trois dimensions : 390×844, 844×390 et 320×568 ; la plus petite inclut le tir de la main gauche. Aucune superposition des contrôles testés.

Les essais manette emploient une manette simulée : aucune validation physique n'est annoncée. SwiftShader ne mesure pas les performances GPU d'un PC ou d'un téléphone. Les autres tâches des lots 08b, 09, 09b, 12 et 14, ainsi que le reste du programme, restent suivies séparément. Aucun déploiement n'est effectué par ce palier.

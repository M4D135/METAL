# FERRO — règles du projet

- Préserver le principe central : contenu graphique et audio généré par le code, sans images, textures, modèles, polices ou sons importés. Aucun CDN ni dépendance d'exécution cachée.
- Le jeu doit rester une vraie scène 3D avec géométrie et caméra perspective. Le rendu de secours doit suivre la même scène.
- Conserver la version autonome `dist/index.html`, reconstruite avec `python3 tools/build.py`.
- Ne jamais annoncer la taille compressée comme taille brute ; `SIZE.json` est l'autorité de mesure. Le navigateur est exclu de la taille, à rappeler dans les comparaisons avec un exécutable natif.
- Préserver la lisibilité sur téléphone, les commandes tactiles, l'absence de défilement pendant le jeu, le clavier AZERTY/QWERTY et les réglages de son.
- Toute modification de génération doit maintenir l'accessibilité des relais, de la sortie et des objets. Toute modification de collision/combat doit passer les vérifications de simulation concernées.
- Les actifs, shaders, personnages et sources sont originaux ; ne pas recopier le contenu de `.kkrieger`.
- Conserver les identités et permissions des hébergements existants. Ne pas remplacer ou modifier un autre projet de l'utilisateur.
- Documenter honnêtement ce qui a été testé dans le navigateur, en simulation, et ce qui nécessite encore un appareil réel.


## Décision de David — 16 novembre 2026

Aucun plafond de taille du code, du moteur ou des builds. Cette décision remplace les anciens budgets en octets ci-dessus. Le contenu graphique et sonore reste entièrement procédural. Mesurer les tailles et les performances, sans réduire les fonctionnalités pour respecter une limite de fichier.

Les modules listés dans `FERRO.lock.json` sont désormais des copies exactes de la référence `M4D135/FERRO:src/ferro`. Cette décision remplace les anciennes consignes de retouche locale du moteur : corriger la référence et propager une version qualifiée ; conserver les adaptations du jeu hors de ces modules.

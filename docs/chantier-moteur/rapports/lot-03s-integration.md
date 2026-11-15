# Intégration du palier 03s T1/T4 — 15 novembre 2026

Le palier `fa9cf768` est assemblé avec FImuse T1 (`4435b58`). Les dix nouveaux tests de delta/navigation et les dix-huit tests FImuse sont présents dans la commande complète. La brique musicale reste non raccordée au jeu.

Validation de l’assemblage : **838/838 tests**, aucun échec, build et contrôle de diff réussis. Les sources, tests et artefact sont restés identiques entre cette exécution et la promotion ; le manifeste est conservé dans `preuves/lot-03s-integration/validated-files.json`.

Chrome/SwiftShader reprend `classic-rubble` et `campaign2-rubble` en mode playing : empreintes attendues, sauvegardes inchangées, débris structurels présents et aucune erreur JavaScript. FImuse reste chargé. Ce contrôle ne mesure pas les performances GPU ni une partie jouée sur matériel physique.

Page autonome : 898777 octets bruts, 277343 gzip, aucun asset externe, version 0.9.2. SHA256 : `57dbd86b0bcc7d55ca254726bc29763a2943cd1d36213c2d1c0e009e57fe8508`.

La destruction et la navigation ciblée sont intégrées. **Le lot 03s complet reste ouvert** : le seuil T5 de première casse <8 ms n’est pas satisfait pour les espèces 0 et 1 sur les mesures finales du palier. Les essais toits/comptage et copie directe des boîtes ont été retirés faute de gain établi. Les profils et limites sont conservés dans le rapport source et la revue indépendante ; aucun gain de FPS global n’est annoncé.

Voir `lot-03-destruction-sim.md` pour le contrat, la compatibilité, les mesures appariées et les essais rejetés. Journaux complets sur Spark : `/home/m4d135/work/codex-metal-pilotage-20261115/03s-integration`. Promotion uniquement dans le dépôt nu local du chantier ; aucun envoi GitHub ni déploiement.

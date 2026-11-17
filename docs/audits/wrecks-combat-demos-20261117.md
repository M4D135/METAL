# METAL 0.12.8 : composants originaux et démos de combat

Base : `ba2784517b99b092c404df38a8408f2733cc2221`.
Commit du produit qualifié : `d76a0386c8f60ce813a66c12b5c8dd6d5fe4a25b`.

## Corrections livrées

Les ennemis tués se séparent en groupes de composants de leur modèle original. Formes, dimensions, couleurs et matériaux sont conservés ; les boîtes de collision restent invisibles. La pluie de cubes ajoutés à la mort est supprimée. Les impacts sont représentés par des traînées lumineuses, pas par des blocs solides. Les pièces sont simulées physiquement et leur sauvegarde est validée. Le nombre de corps physiques reste borné ; sous charge, les composants d'un même acteur sont regroupés plutôt que remplacés par un cube.

Les six démos sont des combats ordinaires exécutés par la simulation actuelle, avec le lourd et le drone. Elles ne comportent pas de scène de présentation de boss. La vue du joueur alterne avec la caméra suiveuse du jeu, qui tient compte des collisions. Le directeur passe à une autre scène après le combat ; il ne restaure pas un checkpoint, ne téléporte pas et ne soigne pas artificiellement le personnage pendant la scène.

Le pilote de démonstration utilise un cheminement borné tenant compte du gabarit, des obstacles physiques, des pièges et des bords. Anticipation, freinage, contournement et replanification remplacent les coups et dashs de déblocage. Le repère de déplacement est corrigé lorsque la visée tourne avant le mouvement. Ce lot améliore le pilote des démos, pas l'ensemble de l'IA des ennemis.

## Qualification et provenance

La suite complète du même produit a réussi : **1 350 réussites, zéro échec, un TODO historique, 1 351 tests comptés**, exécution `44045094131`. Le test de distribution réussit également. Les preuves récupérées sont vérifiées par SHA-256, et le HTML reconstruit lors de la reprise est strictement identique. Le build vérifie les **34/34 modules FERRO** verrouillés.

La reprise a exécuté en plus **94 tests locaux réussis** : géométrie des fragments, navigation, ragdoll, commandes, préférences et caméra. La reconstruction locale retrouve la même empreinte HTML. Une relance locale supplémentaire du test d'endurance a atteint la limite de 120 secondes sans bilan final ; elle n'est pas comptée comme réussie. Les résultats complets des six scènes ci-dessous proviennent de la qualification CI conservée, et non de cette relance incomplète.

Le contrôle clavier précédent expirait pendant le chargement à 1280 × 800 sur GPU logiciel. Le banc utilise désormais une fenêtre 480 × 320, un délai borné plus large et des diagnostics de chargement. Aucune assertion clavier, horloge, position ou règle du jeu n'est modifiée. Le banc de combat effectue ses captures en 960 × 640.

La nouvelle exécution Chrome `44050130384` est **réussie**, avec **10 contrôles de combat et 14 contrôles clavier**, rendu WebGL2 logiciel. Elle a commité les sources et la distribution uniquement après les contrôles, avec vérification du SHA attendu de la branche, puis push sans force.

## Endurance des six scènes

32 secondes simulées par scène, sans guérison, fausse élimination ni écriture de position du joueur. Au total : **192 secondes simulées, 81 tirs et 16 ennemis abattus**.

| Monde | Profil | Secondes | Tirs | Ennemis abattus | Pénétrations statiques | Images bloquées consécutives, maximum | Images avec boss visible | Coups forcés sur obstacle |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 8 | Lourd | 32 | 22 | 3 | 0 | 0 | 0 | 0 |
| 14 | Drone | 32 | 6 | 3 | 0 | 0 | 0 | 0 |
| 4 | Lourd | 32 | 10 | 2 | 0 | 0 | 0 | 0 |
| 11 | Lourd | 32 | 13 | 3 | 0 | 0 | 0 | 0 |
| 17 | Lourd | 32 | 22 | 3 | 0 | 0 | 0 | 0 |
| 6 | Lourd | 32 | 8 | 2 | 0 | 0 | 0 | 0 |

Les tests de régression vérifient aussi un détour autour d'un mur large, pour les deux profils, sans mêlée de déblocage, dash, saut forcé ni téléportation.

## Contrôles Chrome

Combat : tirs réels de la démo, six scènes ordinaires, génération actuelle, élimination normale d'un ennemi, composants originaux nommés plutôt que boîtes de collision visibles, caméra suiveuse du jeu, absence de boss tué ou d'attaque d'obstacle, absence de pénétration statique observée, retour au titre par Échap, absence d'exception non interceptée.

Clavier : défauts R pour la vue et C pour l'esquive/descente, version des préférences, démarrage en lourd, basculement R sans répétition, esquive C sans changement de vue, maintien puis relâchement de la descente du drone, réaffectation persistante, préservation de C, détection d'un conflit sans perte de l'affectation antérieure, réinitialisation R/C, libellés actualisés, absence d'exception non interceptée.

## Distribution et traçabilité

- HTML autonome : **13 660 361 octets bruts**.
- Gzip : **3 209 779 octets**.
- SHA-256 : `0a08aabba483e79d1717d67c45084e984af68ae3e3997d0cdede8e2be967c8ca`.
- Aucun actif externe ajouté.
- Suite complète : https://github.com/M4D135/METAL/actions/runs/44045094131
- Première validation complète du combat dans Chrome : https://github.com/M4D135/METAL/actions/runs/44047773479
- Validation finale, combat et clavier : https://github.com/M4D135/METAL/actions/runs/44050130384

Les trois workflows ponctuels et les trois fragments de patch de transport sont retirés une fois leur travail terminé. Ils restent dans l'historique Git. Leurs suppressions et la mise en forme de ce rapport ne modifient ni les sources du produit, ni les tests, ni le HTML qualifié. Aucune branche divergente ou documentation historique n'est supprimée.

## Limites

Qualification sur les six scènes fixes et les cas de régression, pas une garantie universelle d'absence de bug. Aucun gain de FPS matériel revendiqué à partir des tests CPU ou du GPU logiciel. Pas de téléphone ou de manette physique testés. Le budget d'épaves est borné. Les mouvements Quake III et le vol quaternion 6DOF ne font pas partie de ce lot. Aucun hébergement externe n'est modifié.

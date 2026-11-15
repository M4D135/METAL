# Géométrie physique et requêtes continues — 15 novembre 2026

Suite de la livraison `42b83de`. Les nouvelles expéditions activent le complément `FPhysicsGeometry` ; les sauvegardes précédentes gardent le solveur et la géométrie qu'elles ont enregistrés.

## Changements

- Les boîtes alignées de même matière dont l'union est exactement rectangulaire sont fusionnées, sans combler les trous ni effacer une marche. Les raccords partiels coplanaires sont masqués aux endroits couverts par la boîte voisine. Les vrais bords sont rétablis après retrait de la voisine. Après une modification, les raccords inchangés sont remappés et les voisins retirés sont effacés ; seuls les nouveaux volumes sont comparés. Le réveil des corps reste limité à la zone changée.
- `sweepCapsule` utilise la distance entre capsule et boîte orientée, sphère ou capsule, puis une avancée conservative. Il ne saute pas les obstacles en échantillonnant quelques positions. La requête accepte un résultat réutilisable, les couches, un corps ignoré et le choix d'inclure les statiques.
- `character().move()` fournit glissement, dépénétration bornée, montée de marche, appui et vitesse de la plateforme. Dans METAL, les balayages contre les objets et leurs appuis remplacent les seules enveloppes alignées. Le locomoteur existant conserve ses règles de saut, chute, jetpack, pièges et progression.
- Les contacts lents ne réveillent plus automatiquement les objets voisins. Un réveil par contact exige une vitesse d'approche ou une impulsion suffisante. Les actions explicites gardent leur effet immédiat.
- Le gouverneur endort les îles lentes réellement soutenues par un contact pour réduire le nombre de corps actifs. Il ne fige jamais un objet en vol. Si aucun groupe posé ne peut être endormi, `stats.overBudget` signale l'excédent : ce n'est donc pas un plafond absolu de tous les réveils sous une explosion massive.
- Le personnage peut sortir d’un recouvrement initial causé par des gravats sans avancer davantage dans l’obstacle. Le pilote conserve son évitement pendant les combats, détecte aussi les petits allers-retours sans progrès vers l’objectif et sort d’un blocage même si le colosse est visible. Il rejoint l’arène avant de commencer à tourner autour de lui.
- La révision `/G1` fait partie de l'empreinte physique. La restauration choisit la révision du point enregistré puis valide ses statiques, corps et articulations avant toute mutation. La reprise d'un ancien point conserve exactement ses pas futurs ; aucun changement du monde généré ni de ses marqueurs n'est nécessaire.
- Le lecteur de rejeu en ligne de commande partage maintenant la liste des modules hachés avec le constructeur de la page. L'ancien calcul dupliquait des modules. L'appel à une méthode `dispose` inexistante, après un rejeu pourtant réussi, est également retiré : le lecteur ferme déjà sa scène à la fin.

API : [options, capsules, contrôleur et statistiques](../modules/physique-geometrie.md).

## Contrôles

Les reçus finaux se trouvent dans `../preuves/physique-geometrie-20261115/`. Les mesures CPU utilisent Node 24.18 et le domaine principal sur Apple M5. Le banc de requête fait cinq séries après une série d'échauffement ; le T5 utilise des processus neufs sans échauffement artificiel et distingue temps CPU du thread et temps mural.

Les tests couvrent les 24 dalles jointives aux trois vitesses, un raccord partiel, une marche et un trou conservés, un mur de 12 cm à grande vitesse, les coins arrondis et objets tournés, les couches et identités de corps, la montée de marche et le plafond bas, l'appui cinématique, les réveils, le gouverneur au sol et en vol, le hachage après reprise, ainsi que le lecteur CLI sur un enregistrement utilisant l'empreinte de la page construite.

La suite finale complète compte **1 229 réussites, zéro échec et un TODO historique**. Les contrôles indépendants des mondes et de la page construite passent également.

| Contrôle final | Résultat |
|---|---|
| T5, 18 mondes, 34 processus neufs | Première casse maximale **7.809 ms CPU** ; maximum tous pas **8.803 ms CPU** : un dépassement au pas initial, sans destruction |
| Démo ordinaire, 30 minutes simulées | 108 000 pas, 12 scènes, zéro mort, stagnation ou exception |
| Pas de démo, temps mural | p99 0.619 ms ; maximum 6.323 ms |
| Pensée du pilote, temps mural | p99 0.222 ms ; maximum 2.117 ms |
| Chrome natif Apple M5 / ANGLE Metal | 13 contrôles, switch clavier/bouton/pad, jetpack maintenu, repère partenaire, reprise, trois formats tactiles |
| Page autonome | **1 390 765 octets bruts**, zéro ressource externe ; navigateur exclu |

Les maxima de première casse, parmi les cinq processus de chacun des quatre mondes répétés, sont :

| Monde (index) | Maximum CPU |
|---|---|
| 0 | 7.360 ms |
| 1 | 7.809 ms |
| 2 | 7.316 ms |
| 17 | 7.039 ms |

La fusion passe de 468 à 340 statiques dans le monde 0 et de 524 à 398 dans le monde 17. Les requêtes de capsule près du départ prennent une médiane de 1.078 à 1.409 µs : c’est principalement de l’espace libre, pas un pire cas de contacts denses. Le cœur physique pèse 79407 octets et son complément 14294, soit 93701 octets ensemble.

Les séries intermédiaires rejetées sont conservées : premiers dépassements T5 à 8,126 puis 8,509 ms et stagnations de démo. Elles ne sont pas mélangées à la série finale. Dans le diagnostic du monde 1, le raccordement local abaisse la première casse de 8,468 à 5,813 ms avec le même snapshot final ; les sources de ces diagnostics instrumentés sont identifiées dans leurs reçus.

Le critère du lot 03 T5 porte sur le pas de première casse : il est satisfait. Le pic initial de 8,803 ms CPU dans le monde 1 reste visible dans les 34 mesures complètes ; aucun pas de destruction ne dépasse 8 ms. Le plafond de 2 ms pour toute pensée du pilote n’est pas garanti non plus.

Le contrôle Chrome utilise un pad simulé et des événements tactiles injectés ; aucun appareil physique n’est revendiqué. Le SHA-256 du HTML contrôlé est `c8d8f1b14456bf3eec1241f2454a39a623669056f76ff57d5dfd126b04b8ee6a`.

## Limites

Le TODO de glissement sur pente reste historique et visible. Son critère cumule un déplacement du centre inférieur à 10 cm alors que le seul basculement géométrique le déplace d'environ 19,5 cm ; il n'est pas transformé artificiellement en succès. La fusion et l’index spatial des statiques restent globaux ; seuls les raccords sont mis à jour localement. Les anciens budgets absolus de toute la physique, l'absence d'allocation dans l'ensemble du jeu et la validation matérielle NVIDIA/mobile restent des qualifications distinctes. Le lot photo/WebGPU conditionnel n'est pas ajouté par cette livraison.

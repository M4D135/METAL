# Lot 03s — validation T5 sur la production 930c199

**T5 satisfait le seuil strict de 8 ms sur les 15 premières casses mesurées en processus neufs.** Le périmètre 03s T1/T4/T5 est validé sur `930c1998f6c22ade094473e63ad6d6ed9e660956`. Aucun changement supplémentaire du moteur n’a été retenu et aucun nouveau gain de code n’est annoncé.

La preuve complète est dans [summary.json](../preuves/lot-03s-t5/summary.json). Les reçus bruts, leurs SHA, les scripts exactement exécutés et la topologie CPU y sont référencés. Les anciennes mesures et les essais rejetés restent historiques et intacts.

## Première casse à froid

Node 24.18.0 préexistant, domaine principal, CPU du thread (`user + system`). Chaque cas démarre dans un processus neuf et exécute **60 secondes simulées**, seed 96, campagne v2, pilote historique `skilled`, GOD actif et bouclier absent. Aucune transformation des modules de production, affinité imposée, préparation artificielle ou exclusion d’échantillon. Les SHA des modules lus et exécutés sont égaux.

| Espèce | Pas de première casse | Les cinq CPU mesurés, en ms | Maximum |
|---|---:|---|---:|
| 0 | 658 | 3,945 ; 4,673 ; 4,000 ; 4,682 ; 4,008 | **4,682 ms** |
| 1 | 658 | 5,590 ; 4,871 ; 3,985 ; 4,347 ; 3,779 | **5,590 ms** |
| 2 | 654 | 3,001 ; 3,001 ; 2,999 ; 3,498 ; 3,194 | **3,498 ms** |

Les quinze cas sont conservés. Les snapshots finaux sont identiques entre répétitions et à ceux du contrôle apparié, pour chaque espèce. Les processeurs observés avant/après la casse sont 5, 7, 8, 9, 16 et 19, tous du groupe à fréquence maximale de 3,9 GHz ; aucune migration n’est observée pendant le pas. Le groupe à 2,808 GHz n’est pas couvert par ces quinze cas.

## Contrôles appariés et pilote

Le contrôle A/A utilise deux instances indépendantes du code de production dans **le même processus**, alterne AB/BA à chaque pas et inverse le premier ordre à chaque passe. Il comprend, par espèce, un scénario complet d’échauffement et cinq passes mesurées, tous de 60 secondes. Cet échauffement de banc est distinct de la preuve à froid ci-dessus ; ses valeurs sont également conservées. Aucun échauffement n’est ajouté au moteur.

Les 18 passes A/A ont les mêmes hashes à chaque pas et le même snapshot SHA256 final. Les maxima des premières casses dans les passes mesurées sont 2,217 / 1,998 / 1,148 ms. Le maximum des premiers scénarios conservés est 4,688 ms.

Un deuxième contrôle compare la production exacte au seul ancien compteur `edgeWipes`, avec la même alternance et cinq passes mesurées pour les espèces 0/1, après un scénario complet d’échauffement. Ses 12 passes restent identiques en état. Il ne démontre **pas de surcoût uniforme du compteur** : les anciennes pointes ne lui sont donc pas attribuées. Au total, les deux contrôles comparent 108 000 pas appariés, soit 216 000 appels de simulation.

La revue indépendante confirme l’extraction fidèle du pilote : setup, loadout, position, `dangerVector`, `pickWeapon`, construction d’input et `selectWeapon` avant le pas, puis remise de HP et effacement des événements. La seule spécialisation est GOD toujours actif, conformément au scénario annoncé. Le SHA du pilote exécuté est `93b2a41445bbff8dadaba0b9b4e302e672351dd8b5e8c4a00637fcd37d410b47`.

## Attribution et limites

Les profils sur la source de production ont distingué le coût géométrique, les nouveaux débris et les déoptimisations JIT. Deux prototypes isolés sur le gel de la boîte du delta n’ont pas confirmé la cause suspectée ; ils ne sont pas intégrés. Les essais antérieurs `roofs` et `copyBox` restent également retirés. Le contrat du delta, les collisions, l’ordre géométrique, les sauvegardes et la qualité sont inchangés.

Les anciennes pointes au-dessus de 8 ms restent dans les reçus historiques. Ces processus ne consignaient pas le cœur du pas et certaines séries coïncidaient avec d’autres tests. Les nouveaux contrôles ne permettent pas de reconstruire exactement leur cause : ni gain moteur fictif, ni causalité précise ne sont déduits du changement de conditions. Les mesures présentes documentent la référence et les cœurs effectivement observés ; elles ne garantissent pas les autres cœurs, les FPS navigateur, le GPU ou une latence maximale dans toute charge possible.

Aucune nouvelle suite fonctionnelle n’est nécessaire pour ce complément documentaire : les sources moteur sont celles de l’intégration déjà validée à **838/838 tests**, avec build et Chrome contrôlés. Les preuves de déterminisme et de durée ci-dessus sont nouvelles. Les tâches rendu T2/T3 restent hors du périmètre 03s.

## Reproduction et conservation

Les scripts exacts sont conservés sous `preuves/lot-03s-t5/scripts/`, avec leurs imports Spark d’origine pour audit. Le dossier d’exécution est `/home/m4d135/metal-chantier/voies/sim2/.relais/t5-production-930c199/`. `paired-boss.mjs` reçoit racine, sortie, mode `aa` ou `counter`, répétitions, échauffements et espèces ; `run_cold60.py` exécute les quinze processus neufs. Les gros reçus JSON sont compressés sans changer leurs octets bruts ; le manifeste fournit les deux SHA.

Les preuves antérieures sont archivées dans `.relais/archives/codex03s-evidence-a502235.tar.gz`, avec SHA séparé, et leurs originaux restent présents. Aucun push, changement de gouverneur, service ou port n’a été créé.

# METAL : reprise courte et répartition des lots

## Statut à lire avant toute modification

**Chantier 0.12.9 non qualifié. Pas une version stable livrée.**

Branche de sauvegarde : `wip/support-drone-cockpit-20261117`.
Base publiée : `351f2ccda91f0ba3c0f962316e714e9d7c20e8ac` (METAL 0.12.8).
`main` doit rester inchangé tant que les régressions ne sont pas corrigées et l'ensemble qualifié.

Le code en cours a été retrouvé localement puis transmis sous contrôle des empreintes de chaque fichier. Le transport sert uniquement à publier les vrais fichiers du chantier et à reconstruire `dist/index.html` et `SIZE.json`. Après matérialisation, lire `CI-RESULT.json`, `source-manifest.json` et `tests-checkpoint.tap`. Le workflow est volontairement rouge si les tests échouent même lorsque le push du checkpoint a réussi. Ce n'est ni une fusion automatique, ni une tâche récurrente.

## Demandes actives du joueur

Le lourd est le combattant principal. Le drone est principalement une clé mobile : petit gabarit, accès aux passages étroits, activation de socles en se positionnant dessus et piratage de terminaux en maintenant Interagir. Ses lasers sont faibles, sans munitions, indépendants des réserves du lourd. Ne pas transformer le drone en deuxième personnage d'assaut.

Corriger les murs ou presses qui semblent se reformer après destruction, sans collision fantôme. Petits morceaux crédibles, au plus cinq corps physiques par événement concerné, pas de cubes inventés à la mort d'un ennemi. Rendre les accès alternatifs lisibles avec des symboles léger/lourd discrets.

Cockpit procédural léger inspiré de la lisibilité de Descent, centre de visée dégagé, émetteurs laser symétriques aux bords. Aide clavier plus petite et organisée, désactivable dans Options. Jauges de vie, armure, stamina/boost et chauffe. Préserver R=vue, C=esquive/descente, AZERTY/QWERTY et préférences personnelles. LB court/booste déjà dans le profil manette publié ; ne pas le remplacer sans nécessité.

Budgets de simulation/rendu, déferlantes bornées, corps et joints endormis ou figés après stabilisation, particules et audio bornés, diagnostic développeur. Ne jamais inventer une mesure GPU ou un gain FPS. Ne pas réduire automatiquement la résolution native. WebGPU reste ultérieur, après stabilisation.

## État réellement vérifié lors de la sauvegarde

- Reconstruction et test de distribution : réussis.
- Verrou FERRO : 34/34 modules conformes. Aucun module verrouillé modifié.
- Sources JavaScript modifiées : syntaxe vérifiée.
- Tests ciblés relancés : **39 tests, 38 réussites, 1 échec**.
- Échec reproductible : `checks/support-physics.test.mjs`, premier test, divergence du digest après restauration et 60 pas identiques. La photographie initiale est égale ; la continuation ne l'est pas. Valeurs locales observées : 3677046859 contre 3881855396. Ne pas supprimer l'assertion pour obtenir du vert.
- Les tests ciblés vérifient notamment lasers, socles/terminaux, gabarit, commandes maintenues, fragments et persistance de portes/presses. Ils ne prouvent pas que les captures du joueur sont entièrement corrigées.
- Attention : le test nommé « all 18 support expedition loadouts » parcourt actuellement seulement les indices 0, 1, 5, 10 et 17. Ne pas annoncer 18 mondes qualifiés. Étendre ou renommer le test lors du lot 01.
- Dernier essai local du lanceur Chrome : échec avant test visuel exploitable (`ECONNRESET`; un autre sous-test signale le démarrage root sans sandbox). Aucune validation visuelle du cockpit revendiquée.
- Suite npm complète, rejouabilité complète, tests de performance avant/après, manette physique et téléphone : **non qualifiés pour ce chantier**.

HTML local reconstruit : 13 683 662 octets bruts ; gzip 3 216 845 octets ; SHA-256 `ece7dd3762912ca7211904194ccc8b981f50710e13ee79c1ce2aa00eec55dd3a`. Le numéro 0.12.9 dans package.json est celui du chantier, pas une annonce de livraison.

## Reprise Spark du 17/11/2026

- Les quatre lots ont été repris dans cette branche : digest/restore, annulation du piratage, rejeu CLI, cockpit/HUD validé en navigateur headless, overlay développeur, budget de déferlante et banc A/B CPU.
- Suite npm complète sur Spark : 1396 tests annoncés, 1395 réussites, 0 échec, 0 annulé, 0 ignoré.
- Build courant : `dist/index.html` 13 685 006 octets, gzip 3 217 314 octets, SHA-256 `74e8f5ba04818b493a0d491ff46d8e3160596cf5247120278a0ed33788110f22`.
- Cette reprise qualifie la branche de travail pour publication et intégration, pas les appareils non testés : GPU matériel, manette physique, téléphone réel, Safari/Firefox restent à valider.

## Lots pour des discussions séparées

| Lot | Mission | Point d'entrée |
|---|---|---|
| 01 | Drone utilitaire, destruction, sauvegardes et collisions | `LOT-01-SIMULATION.md` |
| 02 | Cockpit, HUD, aide discrète et commandes | `LOT-02-COCKPIT-HUD.md` |
| 03 | Budgets et mesures de performance | `LOT-03-PERFORMANCE.md` |
| 04 | Intégration, validation, build et publication | `LOT-04-INTEGRATION.md` |

Ces fichiers sont des consignes de reprise, pas des agents prétendument lancés. Chaque discussion doit relire la branche et son SHA avant de travailler, choisir un seul lot, publier son bilan dans ce dossier et ne pas réécrire l'historique. Les fichiers partagés sont intégrés par le lot 04. Ne pas lancer deux modifications concurrentes du même fichier.

## Prompt de reprise

> Reprends METAL sur la branche wip/support-drone-cockpit-20261117. Lis AGENTS.md, docs/reprise-support-20261117/README.md puis le fichier du lot 01, 02, 03 ou 04 choisi. Vérifie l'état publié et le SHA, préserve les travaux concurrents, corrige du code et ajoute des tests. N'annonce pas un travail comme terminé sans preuve. N'intègre pas le checkpoint non qualifié dans main. Termine par un commit poussé, le résultat exact des tests et un court état de reprise.

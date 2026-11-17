# Lot 01 : drone utilitaire, monde et persistance

Lire AGENTS.md et README.md de ce dossier. Partir de la dernière tête réelle du checkpoint, pas des anciens comptes rendus 0.12.8.

## Fichiers réservés

`src/simulation.js`, `src/metal-physics.js`, `src/profiles.js`, `src/world.js`, `checks/support-drone.test.mjs`, `checks/support-physics.test.mjs`. Ne pas modifier `src/game.js`, le HUD, les modules FERRO verrouillés ou les artefacts distribués pendant le travail d'un autre lot. Les changements de règles dans `src/support.js` se coordonnent avec le lot 02 et l'intégrateur.

## Première priorité

Reproduire l'échec du premier test support-physics : sauvegarde rigide égale immédiatement après restore, digest divergent après 60 pas identiques. Comparer les états au premier pas divergent (corps du lourd parqué, proxy drone, vitesses, sommeil, ordre des forces/contacts, compteurs), puis corriger hors moteur verrouillé. Ne pas rendre le test tolérant à une vraie divergence et ne pas retirer les contrôles de déterminisme.

## Contrat gameplay

Le drone tire des lasers faibles sans munitions et sans toucher aux réserves du lourd. Il ne doit pas détruire à distance les accès prévus pour son rôle de clé. Le lourd garde l'arsenal et le rôle principal. Socle : présence réelle avec tolérance de volume et temps court d'activation. Terminal : maintien d'Interagir, avec interruption correcte en s'éloignant, changement de personnage, pause, relâchement ou décès. Ouverture persistante, indications claires, pas de blocage en changeant de personnage dans un conduit.

Distinguer presse mobile et porte destructible. Après destruction : pas de réapparition visuelle ni de collision recréée en approchant, après un cycle de piège, sauvegarde/restauration ou transition de rendu. Vérifier les petites pièces et le plafond de cinq corps sans réinventer le modèle de l'ennemi.

Préserver les sauvegardes anciennes : le changement de géométrie est versionné par `supportDroneVersion`, pas appliqué aveuglément à un ancien point de reprise. Vérifier aussi les rejeux et l'accès aux 18 mondes. Le test qui annonce 18 mondes n'en parcourt actuellement que cinq : corriger cette couverture ou ce titre.

## Sortie attendue

Tests support et régressions simulation/destruction/profils/checkpoints/rejeux. Bilan avec défaut exact, preuve avant/après, SHA publié et limites. Aucun merge dans main avant lot 04.

## Résultats du 17/11/2026 (relais Spark)

- Défaut digest reproduit : `3677046859` contre `3881855396` après restauration. Cause : `digestMix` observait `destructionRevision` et `aiStats`, incrémentés ou recalculés par `restore()` sans être persistés.
- Correction dans `src/simulation.js` : `digestMix` ignore ces deux compteurs d'observation à la racine de l'état. Le test compare désormais le digest immédiatement après `restore`, puis après continuation, et vérifie que l'observation ne modifie pas l'état.
- Annulation du piratage : `cancelSupportAction()` est exposée par la simulation et appelée sur changement de profil, mort par dégâts, mort par chute et sortie du mode `playing`. Les tests ciblés échouent quand la correction est retirée.
- Rejeu CLI : `tools/replay-metal.mjs` charge bien `support` avant `world`. Nouveau `checks/support-replay.test.mjs` vérifie la piste en mémoire et le CLI séparé avec le `simHash` du build courant.
- Destruction : les fragments déjà courts restent des pièces entières ; les grandes pièces sont bornées à cinq corps et à environ `0,75 m` par axe. Le test de porte coulissante a été aligné sur ce contrat : pièces réelles, bornées, restaurables, sans exiger que les cinq corps reconstituent le volume complet de la porte.
- Couverture : le test des mondes support parcourt maintenant les dix-huit indices, en lourd et léger.
- Suite ciblée : `support-drone`, `support-physics`, `support-budgets`, `support-replay` : 31 réussites, 0 échec.

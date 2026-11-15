# Intégration contrôlée METAL — 15 novembre 2026

Base locale promue précédente : `731ace7016b0a787afd3b390c5882bf0527f6a29`.
Assemblage : pièges/sauvegardes `6e37040`, simulation/DDA `c7b2d37`, correctif de chargeur DDA `1c5c3d2`, décisions du 13–15 novembre `2786ed2`.

## Correction avant promotion

Le raccourci `e366203` n'avait pas établi le gain apparié minimal requis. La revue gratuite a en outre reproduit un défaut : au premier pas de repos une lame traversait un ennemi encore présent (boîte -1,87 → -4,35 au lieu de rester au contact). Son test échoue avant correction.

L'intégrateur retire les DEUX raccourcis : requête d'acteurs différée et boîte de repos réutilisée. La pose est recalculée à chaque pas avec les acteurs présents. Le patch gratuit ne retirait que le premier ; le retrait du second est un complément contrôlé ici pour ne garder aucune partie du gain non homologué. La garantie de `99596c3` est conservée par recalcul systématique : une lame retenue rejoint son repos dès le départ du corps. Ses tests joueur et le nouveau test ennemi passent. Le drapeau dérivé boxAtRest disparaît ; il n'était pas dans la sauvegarde. Aucune révision de format, aucun changement DDA ni génération.

## Validation réellement exécutée

- `python3 tools/build.py`, `git diff --check` : réussis.
- Tests ciblés pièges/DDA : **174/174**.
- Nouvelle suite complète `npm test` : **753/753**, zéro échec, plus contrôles autonomes monde/build réussis. Ce résultat remplace la preuve précédente fragmentée 746 + 6 DDA.
- Chrome/SwiftShader, page assemblée actuelle : `classic-rubble` et `campaign2-rubble` reprennent en `playing`, 40 débris structurels chacune, empreinte attendue et stockage source inchangés, aucune erreur JS. Couverture : anciennes sauvegardes génération6 avant pièges massifs, pas toutes les versions historiques.
- Page **884721 octets bruts**, 273003 gzip, zéro asset externe, version0.9.2 inchangée. SHA256 `3333f15217c74107497e1925aeb5cfde087cb21e842afca7900ab4a8c99aa57c`. Le navigateur est exclu de la taille.

Preuves sur Spark : `/home/m4d135/work/codex-metal-pilotage-20261115/` (`full-tests.log`, `traps-dda-tests.log`, `chrome/metal-chrome-compat.json`, `build.log`). Revue isolée gratuite : `/home/m4d135/work/codex-metal-reprise-20261115/revue-free/repo/evidence/` ; ses artefacts ne modifient pas le clone live.

## Mesures et limites

La contre-mesure DDA indépendante sur la branche sim2-verif compare sa base à c7b2d37, domaine principal, 5 répétitions alternées, 4 scénarios : état identique partout ; ratios médians appariés B/A 0,8511 / 0,9739 / 0,8289 / 0,9767. Elle ne mesure pas le gain combiné du présent assemblage. L'objectif global -40/-60% CPU n'est donc pas déclaré atteint. Rapport final de la contre-revue encore attendu ; son JSON de mesures est conservé. Aucun gain de performance revendiqué pour le retrait e366203.

GPU réel, téléphone, manette physique et écoute humaine ne sont pas validés par cette intégration. Aucun déploiement ou publication GitHub.

## Suite

Propriétaire unique02/03s : sim2. Le lot03s attend la promotion réelle de02 ;03r attend03s+05 ;07 attend02+03s+03r+04+05. Le contrôle manuel Codex reste actif, aucun ancien chef ou surveillant réactivé. Les relais existants terminent leur tâche ; leurs anciens états ne valent pas validation de leur dernière tête.

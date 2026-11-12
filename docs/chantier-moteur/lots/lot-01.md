# Lot 01 — Bugs bloquants : points de reprise, tir, pointeur, limiteur
## But
Supprimer la cause unique des points de reprise refusés (ligne 2081), verrouiller le tir ponctuel, corriger le verrouillage du pointeur et le limiteur d'images hors multiples exacts. Le joueur garde son arsenal à la mort ; l'arme répond à chaque clic ; la visée est 1:1 ; la cadence demandée est obtenue.

## Tâches, dans l'ordre

### T1 — Supprimer le refus des points de reprise et sauvegarder le repli [LOAD-01, LOOP-01, LOOP-V2]
- Où : src/simulation.js:2081 ; src/game.js:114-121 ; src/game.js:139 ; src/game.js:118
- Quoi : (1) Supprimer la ligne `require(!supportBoxes.some(box=>debrisOverlaps(q,h,box)))` (2081). Garder le contrôle d'appui (2080) et toutes les bornes. (2) Dans `resumeSaved`, avant le repli, retenter `restore` sur une copie sans gravats (supprimer `rubbleVersion`, `state.rubble`, `timers.rubbleSerial`). (3) Dans le repli ultime, passer `copyLoadout(v.entryLoadout||v.entryInventory)` au lieu de `undefined`, et n'écrire la nouvelle sauvegarde qu'une fois la partie relancée. (4) Avant `saveCheckpoint()` (game.js:118), toujours écrire la sauvegarde refusée dans `SAVE_KEY+'-refuse'` (emplacement écrasable). (5) Ajouter un test de non-régression sur mondes générés : l:0 et c:9, une roquette sur 3 murs, 300 pas, vérifier `restore` renvoie `true` et snapshot identique (≈2–5 s/monde, node).
- Preuve exigée : `node bancs/load/rubble-fix.mjs <ferro> bancs/load/patched/rubblefix rocket l:0 12` puis `walk c:3 12`, `walk c:9 12`, `rocket c:9 8`. Attendu : 31/31 points acceptés, 29/31 identiques octet pour octet (recover:false). `node bancs/loop-verif2/restore.mjs 30 classic-0,campaign-0,campaign-9,campaign-10 b` : refus = 0. `npm test` : 166/166 verts.
- Qualité : meilleure (le joueur garde progression et arsenal).
- Garde-fous : format inchangé (rubbleVersion 1) ; validation atomique conservée ; déterminisme intact (seul le chemin restore change) ; gravats non-colliders → aucun effet collision/combat ; taille ≈ −60 octets ; si LOAD-05 endort les morceaux coincés, la ligne 2080 devra accepter le même invariant.
- Dépend de : rien.

### T2 — Verrouiller le tir ponctuel et tamponner l'intention [LOOP-06]
- Où : src/game.js:686 ; src/game.js:805 ; src/game.js:816 ; src/game.js:830-831 ; src/game.js:834-837
- Quoi : (1) Ajouter `firePressed` (et `fireLeftPressed`), mis à `true` par mousedown, touchstart, keydown (hors répétition), consommé dans `frame()` : `input.fire = held || firePressed` pour le premier sous-pas seulement. (2) Tampon de 150 ms côté jeu : garder l'appui tant que `sim.state.shots` n'a pas augmenté et `now − pressT < 150 ms` ; effacer quand `shots` augmente ou quand l'arme change. (3) Ne pas armer le verrou sur le clic qui reprend le pointeur (voir T3).
- Preuve exigée : `node bancs/loop/clicks.mjs <ferro>` : 0 clic perdu arme prête (au lieu de 20–27 % à 20–30 fps). Test harnais : mousedown + mouseup entre deux rAF → `shots + 1`.
- Qualité : meilleure (l'arme répond toujours, surtout pavé tactile et tap bref).
- Garde-fous : simulation inchangée (booléen par pas) → déterminisme et sauvegarde intacts ; consommer l'appui après le premier sous-pas pour éviter un double tir ; appliquer aussi au tactile et AZERTY/QWERTY ; constante 150 ms réglable.
- Dépend de : rien.

### T3 — Verrouillage du pointeur, drag-look sans tir, molette seuillée [LOOP-10]
- Où : src/game.js:157-162 ; src/game.js:811 ; src/game.js:813 ; src/game.js:816-821
- Quoi : (1) Appeler `canvas.requestPointerLock({unadjustedMovement:true})`, repli sans option sur `NotSupportedError`. (2) Sur pointerdown souris sans verrou en mode jeu : redemander le verrouillage, ne pas armer `mouseFire` tant que `pointerLockElement ≠ canvas` (sauf mode glisser explicitement choisi). (3) Molette : cumuler `deltaY` (×33 si deltaMode=1, ×innerHeight si deltaMode=2), changer d'arme une fois au-delà de 100 px, attendre 150 ms ; remettre l'accumulateur à zéro à chaque changement de sens.
- Preuve exigée : harnais : 30 événements wheel deltaY=4 → 1 seul changement d'arme ; pointerdown sans verrou → `requestPointerLock` appelé, `shots` inchangé. Essai réel Safari + Chrome.
- Qualité : meilleure (visée 1:1, pas de tir involontaire en regardant, un cran = un changement).
- Garde-fous : `unadjustedMovement` absent de Safari/Firefox → repli obligatoire ; le clic qui verrouille ne tire pas → prévenir par un toast ; comportement tactile inchangé ; aucun impact simulation/sauvegarde.
- Dépend de : rien.

### T4 — Limiteur d'images : cadence exacte hors multiples [LOOP-09]
- Où : src/game.js:676-677 ; src/game.js:722 ; src/options.js
- Quoi : Mesurer la période d'affichage (médiane glissante des 30 derniers intervalles rAF). Si la limite ≥ 95 % de la fréquence, ne rien limiter. Sinon calculer `N = max(1, round(fréquence/limite))` et n'afficher qu'une vsync sur N via un compteur. À défaut, échéance cumulée (`due += 1000/limit`, tolérance demi-période). Afficher dans l'option la cadence réellement obtenue.
- Preuve exigée : `node bancs/loop/fpslimit.mjs` avec le nouvel algorithme : limite 60 sur 75 Hz → 60 fps (au lieu de 37,5) ; sur 144 Hz → 48 fps (au lieu de 48, acceptable) ; sur 165 Hz → 55 fps. Test unitaire sur horodatages synthétiques.
- Qualité : meilleure (latence d'entrée réduite ≈ 10 ms/image sur 75 Hz).
- Garde-fous : aucun impact simulation/sauvegarde ; recalculer la fréquence périodiquement si mal estimée au démarrage ; fonction pure dans FERRO (options.js), branchée dans game.js.
- Dépend de : rien.

## Options désactivées par défaut
- Aucune. Aucun constat du lot n'est de qualité « dégradée ».

## Écartés ou absorbés
- [LOOP-01] — Absorbé par LOAD-01 (arbitrage : retenir LOAD-01 points 1 à 4). Le point 1 (modifier `snapshot()` pour écrire `resting:false`) crée un écart partie continuée / restaurée et n'est pas retenu. Le point 3 (repli sans gravats) est identique au point 2 de LOAD-01. Le point 2 (correction physique de la pose des débris) est reporté après SIM-03 comme amélioration visuelle facultative avec nouvelle référence.
- [LOOP-V2] — Absorbé par LOAD-01 : la suppression de la ligne 2081 rend caduque la modification du prédicat pour exclure `savedTrapBoxes` (point 1) et le chargement en `resting:false` (point 2). Le point 4 (écrire la sauvegarde refusée dans `SAVE_KEY+'-refuse'`) est intégré à T1. Le point 3 (correction physique) suit le report de LOOP-01.

## Décisions à confirmer par David
- `unadjustedMovement` (T3) change la sensibilité ressentie de la visée (supprime l'accélération Windows). Valeur par défaut proposée : activé, avec une option « Accélération du système » dans les réglages.
- Tampon d'intention de tir (T2) : 150 ms est un choix de ressenti. Valeur par défaut proposée : 150 ms, constante réglable dans options.js.

## Gains attendus du lot
Le joueur ne perd plus jamais son arsenal ni sa progression à la mort ou au rechargement (31/31 points de reprise acceptés, 29/31 identiques octet pour octet ; sauvegarde refusée conservée dans `'-refuse'`). L'arme répond à chaque clic, y compris tap tactile et appui < 1 image (0 % de perte contre 20–27 %). La visée est 1:1 sans accélération parasite ; le drag-look ne tire plus ; la molette change une arme par cran. La cadence limitée est exacte (60 fps sur 75 Hz au lieu de 37,5). Temps d'image stable : aucune tâche n'ajoute de saccade (aucun travail par image ajouté hors chemin d'entrée).

## Mise à jour après contre-vérification

Cette fiche a été rédigée avant la contre-vérification des axes STAB, DRAW, RESTE et PARA. Les verdicts ci-dessous priment sur le texte des tâches.

- **STAB-V1 — nouveau constat, ajouté par le contre-vérificateur (haute).** Correctif provisoire d'une ligne : tolérance sur le nombre de sous-pas, pour ne plus doubler la simulation deux images sur trois à 60 Hz Où : src/game.js:690. Quoi : En attendant FLoop (STAB-06), remplacer par steps=Math.max(1,Math.ceil(dt*60-0.06)) : un seul pas tant que l'intervalle ne dépasse pas 17,67 ms (pas au plus 6 % plus long que 1/60 ; couvre 59,94 Hz, les horodatages à 0,1 ms et l'arrondi à 1 ms qui donne 17 ms), 2 pas à 30 Hz au lieu de 3 pour un tiers des images. Ajouter un test dans checks/ qui extrait la formule et vérifie 1 pas pour 16,6 / 16,7 / 16,683 / 17 ms, 2 pas pour 33,4 ms, et un pas jamais supérieur à 17,7 ms. Critère : dans le banc, 0 image à 2 pas à 60 Hz pour les motifs q60, ms60 et 59,94. Gain attendu : −18 à −48 % de CPU de simulation sur les écrans de la classe 60 Hz (30,5 / 46,2 / 29,0 vers environ 23,8 ms par seconde simulée) et fin de l'alternance 1 pas / 2 pas d'une image à l'autre. Détail dans `constats/STAB.md`.


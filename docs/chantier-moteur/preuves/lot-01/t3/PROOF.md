# Lot 01 / T3 — LOOP-10 : pointeur et molette

Base : fichiers T2 figés dans `/workspace/scratch/5ba980389006/lot01-t2-snapshot/`. T3 est un patch **incrémental**, à appliquer après T2. Aucun commit/push/build/version ni modification de simulation, rendu ou format de sauvegarde.

## Reproduction avant correction

Les tests utilisent le vrai `src/game.js` et la vraie simulation, avec un DOM et des périphériques factices. Avant correction T3 :

- **30 événements `wheel`, `deltaY=4` pixels : 30 changements d’arme**, contre un seul attendu.
- Un `pointerdown` souris hors verrou n’ajoute aucune demande de verrouillage : **0 demande dans le geste**, contre une attendue.
- Aucune demande de mouvement brut, aucun repli spécifique `NotSupportedError`, aucune préférence d’accélération du système.
- Sur les 21 tests du shell (les mêmes exécutés avant/après), **13 passent et les 8 scénarios T3 échouent**. Sortie : `lot01-t3-shell-before.log`.

La reproduction utilise la copie source T2 : `/workspace/scratch/5ba980389006/lot01-t3-reference-checks/`. Il ne s’agit pas de mesures de temps CPU ; les checks fonctionnels restent en `node:vm`.

## Correctif

- Par défaut, `requestPointerLock({unadjustedMovement:true})` ; le bouton **« Accélération du système »**, désactivé par défaut, permet la demande sans option. Préférence booléenne persistée et restaurée ; le bouton de remise à zéro des commandes rétablit le défaut.
- Le `pointerdown` souris sur le canvas redemande le verrou **dans le geste utilisateur**. La reprise depuis le bouton de pause reste également dans son geste. Le démarrage après préparation asynchrone garde son essai actuel et peut être repris d’un clic sur le canvas si le navigateur l’a refusé.
- Le clic d’acquisition ne tire pas, même quand l’acquisition réussit synchroniquement avant l’événement de compatibilité `mousedown`. La suppression est levée au relâchement ou à l’annulation.
- Si la capture échoue ou que l’API est absente, le glisser pour viser reste fonctionnel sans tir souris involontaire ; le message indique le tir clavier. Le tactile garde ses gestes et ses boutons, sans demande de verrouillage.
- Les API renvoyant une promesse ou `void` sont prises en charge. `NotSupportedError` synchrone ou asynchrone provoque une seule nouvelle tentative sans option. Les autres erreurs gardent le mode glisser ; l’événement legacy `pointerlockerror` fournit également ce retour.
- Une réponse tardive après pause ne déclenche pas une nouvelle capture : les échecs sont invalidés par numéro de demande, et une capture tardive en menu est libérée.
- Molette : somme en pixels (`deltaMode=1` ×33 ; `deltaMode=2` ×hauteur de fenêtre), seuil **100 px**, **150 ms** entre changements, changement de sens réinitialisant le trajet partiel. Les valeurs non finies sont ignorées. Les accumulateurs sont remis à zéro lors d’un changement de mode.

## Vérifications exécutées

Commande :

```sh
node --test --test-reporter=tap checks/input.test.mjs checks/checkpoint.test.mjs checks/options.test.mjs
```

Résultat final : **67 tests passent, aucun échec**, dont **21 tests du shell**. Sortie : `/workspace/scratch/5ba980389006/lot01-t3-shell-after.log`.

Le scénario molette du test existant de checkpoint a été mis à jour pour le changement de comportement voulu : **1 px ne change rien, puis 99 px supplémentaires changent une arme**. La vérification de l’arsenal qui suit est conservée. Aucune assertion n’a été retirée pour masquer une régression.

`git diff --check` passe. Les scénarios couvrent les unités de molette, l’inversion du sens, la temporisation, la pause, les promesses rejetées/réussies, les API legacy, le clic d’acquisition, les réponses tardives, la préférence persistée/remise à zéro et la préservation du tactile.

Pas de test sur une vraie souris Windows, Safari, Firefox ou téléphone physique. L’absence d’accélération effective du matériel ne peut pas être déduite du DOM factice. Le root doit faire le build, la suite complète et le contrôle navigateur disponible.

## Sources API consultées

- MDN, [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), notamment les différences entre retours `void` et promesse et le repli `NotSupportedError`.
- MDN, [Element.requestPointerLock](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock), notamment l’activation utilisateur et `unadjustedMovement`.

Ces documents ne justifient pas d’annoncer un essai réel sur tous les navigateurs.

## Livraison pour intégration

- Patch **T3 seul, après T2** : `/workspace/scratch/5ba980389006/lot01-t3.patch`.
- Copie figée T3 : `/workspace/scratch/5ba980389006/lot01-t3-snapshot/`.
- Fichiers concernés : `src/game.js`, `src/options.js`, `src/index.html`, `checks/input.test.mjs`, `checks/options.test.mjs`, le scénario molette de `checks/checkpoint.test.mjs`.
- T4/STAB-V1 sont exclus de ce patch et restent à la charge du root.

## Complément de revue intégré dans le même commit T3

`pointercancel` invalide maintenant une capture encore en attente : un rejet tardif ne relance plus la demande sans option et un succès tardif est libéré. Un nouveau geste réautorise la capture ; un relâchement normal avant la réponse reste valide. Les variantes promesse et `void` sont couvertes.

Les trois régressions ciblées donnaient 1 réussite / 2 échecs avant puis 3/3 après ; le fichier input passe ensuite 24/24. L’ancien test legacy représente désormais un nouveau geste après annulation, suivi du relâchement et du tir : il ne simule plus une capture spontanée devenue interdite. Le manifeste et les logs joints gardent cette preuve distincte de celle de T3 initial.

Après réunion de T1, STAB-V1, T2, T3 et ce complément : 85/85 tests ciblés, build et contrôle de distribution PASS ; 809 176 octets bruts, version 0.8.1. La validation globale du lot et le navigateur sont consignés à sa clôture dans RAPPORT.md.

# Lot 01 / T2 — LOOP-06 : intention de tir conservée

Base : METAL 0.8.1, `main` 63668aca7045e62cd524973b226f21e9ec5703e8. Travail dans `METAL-lot01-entrees`. Aucune modification de simulation, format de sauvegarde, audio, version ou distribution. Aucun commit/push/build effectué par cet agent.

## Reproduction avant correction

Le banc fourni `bancs/loop/clicks.mjs` ne charge pas `game.js` : il compare trois algorithmes modèles directement sur la simulation. Sa partie chargement a été adaptée en dehors du dépôt, avec une fonction enveloppe `vm.runInThisContext` par module, pour exécuter dans le domaine principal. Aucun changement des scénarios ou du modèle de clics.

Commande :

```sh
node /workspace/scratch/5ba980389006/lot01-t2-clicks-mainrealm.mjs /workspace/scratch/5ba980389006/METAL-lot01-entrees
```

Sortie complète conservée dans `lot01-t2-clicks-before.txt`.

| Scénario | Modèle actuel : clics arrivés prêts mais perdus | Modèle verrouillé | Modèle tamponné |
|---|---:|---:|---:|
| 30 fps, appui 25 ms, écart moyen 250 ms | 23,7 % | 0 % | 0 % |
| 30 fps, appui 25 ms, écart moyen 330 ms | 26,7 % | 0 % | 0 % |
| 20 fps, appui 40 ms, écart moyen 250 ms | 20,3 % | 0 % | 0 % |
| 20 fps, appui 40 ms, écart moyen 330 ms | 20,5 % | 0 % | 0 % |

Ces chiffres reproduisent le modèle d’audit ; ils ne sont pas une mesure des performances de la machine ni la preuve du code livré. La preuve de ce dernier utilise le vrai shell et la vraie simulation.

## Correctif livré

- Appuis droite/gauche mémorisés séparément sur souris, clavier personnalisé (hors répétition) et boutons tactiles.
- Tampon réglable par la constante publique `FOptions.fireBufferMs`, défaut 150 ms. Aucun horodatage ne passe dans la simulation.
- Une intention est proposée au premier sous-pas de chaque image jusqu’au tir ou à l’expiration. Un appui tenu continue à atteindre tous les sous-pas.
- Consommation par événement de tir et par main. Le compteur global `shots` serait insuffisant : un tir droit ne doit pas consommer une intention gauche encore en attente.
- Annulation lors d’un changement d’arme, pause/perte de focus/onglet caché/perte de contexte et annulation du pointeur. Une fin normale de capture après un relâchement tactile conserve le tap bref.
- Le bouclier reste une garde tenue, sans tampon de tir.
- Les clics souris sans verrou acquis ne créent pas d’intention. La nouvelle acquisition du verrou dans le geste utilisateur et la préférence d’accélération relèvent de T3, qui suivra séparément.

## Tests réellement exécutés

`checks/input.test.mjs` est nouveau. Il exécute `src/game.js` et la vraie simulation dans un DOM factice ; ce n’est pas un profil CPU, donc les checks conservent `node:vm`.

- Les mêmes 13 tests avec les sources initiales du commit de base : **5 passent, 8 échouent**. Sortie `lot01-t2-shell-before.log`.
- Sources corrigées + checks/checkpoint.test.mjs + checks/options.test.mjs : **58 passent, 0 échec**. Sortie `lot01-t2-shell-after.log`.
- Les appuis complets entre deux rAF sont vérifiés à 20, 30, 60 et 144 Hz pour souris, clavier et tactile : **12/12 produisent exactement un tir** après correction.
- Cas couverts : cooldown dans la fenêtre, expiration à durée configurable, répétition clavier, sous-pas, deux mains, touches reconfigurées, changements aller-retour d’arme, cycle de pause/focus/visibilité, clic sans verrou, annulation de capture et bouclier tenu.
- Deux lignes du harnais existant de `checks/checkpoint.test.mjs` modélisent maintenant un verrou acquis et libéré au lieu d’un appel sans effet. Aucun attendu de ses tests n’a été affaibli ou changé.
- `git diff --check` passe.

Commande ciblée :

```sh
node --test --test-reporter=tap checks/input.test.mjs checks/checkpoint.test.mjs checks/options.test.mjs
```

Le root doit ajouter `checks/input.test.mjs` à la liste de `npm test`, puis reconstruire et exécuter la suite complète pour le commit T2. Aucun test navigateur physique, Safari, Firefox ou téléphone n’est revendiqué.

## Livraison pour intégration

- Patch complet (incluant le nouveau fichier) : `/workspace/scratch/5ba980389006/lot01-t2.patch`.
- Copie figée des fichiers avant T3 : `/workspace/scratch/5ba980389006/lot01-t2-snapshot/`.
- Fichiers modifiés : `src/game.js`, `src/options.js`, deux lignes de harnais dans `checks/checkpoint.test.mjs`, nouveau `checks/input.test.mjs`.

## Écarts de spécification relevés pour la suite

- La contre-vérification LOOP-09 décrit `round(fréquence/limite)` : 72 fps sur 144 Hz pour limite 60 ; la fiche annonce 48 et 60 sur 75 Hz, incompatibles avec cette formule. T4 appartient au root.
- Le MASTER-PROMPT contenu dans l’archive précise que la replanification sélective se fait une seule fois au lot 03/T4 ; le lot 04/T3 est ensuite considéré fait.

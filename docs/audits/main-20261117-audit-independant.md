# METAL — audit indépendant de la publication du 17 novembre 2026

**Nature de ce passage :** audit documentaire indépendant, sans modification de simulation, de rendu, de contrôles, de données, des 34 modules verrouillés FERRO ni du paquet HTML. Aucun gain de FPS ni de temps CPU n'est attribué à ce passage. Les analyses ci-dessous décrivent la base **avant cet ajout documentaire**.

## Référence réellement lue

- Dépôt privé : `M4D135/METAL` ; branche `main`, tête lue et relue : [`bd1d932b64bb896f5d6148d06fb91d7c289b8d8c`](https://github.com/M4D135/METAL/commit/bd1d932b64bb896f5d6148d06fb91d7c289b8d8c), version `0.12.6`, dernier message « Add reset keyboard keys to defaults button », horodaté 2026-11-16 22:57:13 UTC.
- `AGENTS.md`, `FERRO.lock.json`, `SIZE.json`, `VALIDATION.md`, rapports historiques de consolidation (`finition-finale-20261115.md`, `integration-20261115.md`, `point-publication-20261115.md`, `lot-03s-t5.md`), sources de vol, déplacement, commandes, rejeu et tests associés ont été consultés dans `main`.
- **`docs/mission-20261117/README.md` est absent** de l'arbre de cette révision (404 vérifié et recherche de l'arbre). Il n'est donc pas légitime de conclure que les contributions de la première mission nocturne sont publiées, ni de s'appuyer sur des rapports T5 nocturnes non accessibles.

## Contrôles indépendants sans exécution

1. **Verrou FERRO : 34 modules sur 34 identiques**, en comparant les SHA des blobs Git de chaque entrée de `FERRO.lock.json` à `M4D135/FERRO:main/src/ferro/<module>`. Aucun écart Git dans les 34 chemins verrouillés ; aucune retouche locale autorisée.
2. **Artefact déjà publié :** `dist/index.html` contient 13 653 063 octets UTF-8, valeur vérifiée contre la taille du blob Git et `SIZE.json`. `SIZE.json` indique 3 206 816 octets gzip, version 0.12.6 et zéro ressource extérieure. Le gzip n'a pas été recalculé lors de ce passage. Le document HTML contient 47 modules `data-module`. Les sources `simulation.js`, `controls.js`, `motion.js`, `renderer.js`, `replay-metal.js`, `perf.js` et `options.js` y sont incluses à l'identique. `game.js` est enveloppé par l'initialisation asynchrone de PhysX conformément à `tools/build.py`.
3. **Vol 6DOF non visible sur ce main :** `src/simulation.js:fly()` projette le vecteur de déplacement uniquement avec `cos(yaw)` / `sin(yaw)`, et utilise `jumpHeld` pour monter / `descendHeld` pour descendre. Le test publié `checks/flight.test.mjs` impose explicitement une translation horizontale indépendante de l'inclinaison de la vue. Il ne qualifie donc **pas** un vol quaternion/6DOF à la Descent. Les mouvements décrits dans la mission peuvent être en cours ailleurs ; ils ne sont pas constatés sur la tête vérifiée.
4. **Strafe-jump Quake III non confirmé sur ce main :** les régressions présentes décrivent accélération, friction, saut, esquive et jetpack, mais ne fournissent pas la qualification revendiquée pour un nouveau strafe-jump directionnel. Il faut attendre les sources et tests effectivement intégrés avant de l'annoncer livré.
5. **Allocations de vol à investiguer :** dans `fly()`, le sous-pas de 1/120 s instancie des tableaux `velocity`, `wish`, `delta`, `old`, `next`, `actual`, des vecteurs de balayage et un nouveau tableau de boîtes via `[...localSolids(...), ...doorBoxes, ...trapBoxes]`. Le nombre de sous-pas et la géométrie conditionnent l'impact. Il s'agit d'une **source statiquement démontrée d'allocations répétées**, pas d'une mesure de pression GC, ni d'un correctif déjà réalisé. Toute réutilisation de tableaux ou de listes doit être qualifiée avec les contacts, l'ordre de collision, les sauvegardes et les traces de rejeu inchangés.

## Contributions et branches à préserver

- Aucun PR ouvert constaté à l'inspection.
- La branche `opencode/titre-zip-signature-20261116` **diverge de `main` : 2 commits d'avance, 6 de retard**, avec des changements uniques signalés dans `src/index.html`, `src/style.css`, `dist/index.html`, `SIZE.json`. Elle **ne doit pas être supprimée** ni fusionnée aveuglément.
- Les branches `chantier/integration`, `chantier-moteur`, `codex/finition-complete-20261115`, `codex/physics-complete-20261115` et `campagne-18-mondes` étaient en retrait de `main` dans les comparaisons faites ; aucune branche n'a été modifiée ou effacée pendant cet audit.
- L'existence de travaux nocturnes locaux ou concurrents non publiés **n'est pas observable depuis GitHub**. Ne pas interpréter l'absence d'un nouveau commit comme leur abandon.

## Validation réelle et limites

| Contrôle de ce passage | Résultat |
| --- | --- |
| Lecture du main, des règles et des rapports accessibles | Effectuée |
| Comparaison de 34 blobs FERRO avec la référence | 34/34 identiques |
| Contrôle statique HTML vs SIZE | 13 653 063 octets, exact |
| Contrôle du code source de sept modules vs HTML | 7/7 identiques |
| `npm test` / tests de campagne, checkpoints, rejeu | **Non exécutés** |
| `python3 tools/build.py` / nouveau `SIZE.json` | **Non exécutés** : aucune source du produit changée |
| Tests navigateur du jeu / mesures FPS, GPU, GC | **Non exécutés** : copie privée complète indisponible dans le conteneur d'exécution ; Chromium local ne termine pas même une ouverture `about:blank` en mode headless dans la fenêtre d'essai |
| Manette et téléphone physiques | Non testés |
| Gains de temps CPU, FPS ou d'allocations avant/après | **Aucun mesuré, aucun revendiqué** |

Les nombres historiques des rapports du 15 et du 16 novembre concernent leurs propres commits : notamment 1 213 tests réussis / un TODO pour la finition du 15, et 1 293 / 1 294 avec un TODO dans `VALIDATION.md` pour la version 0.12.4. **Ils ne constituent pas des tests de la tête 0.12.6 ni de nouvelles preuves de cette nuit.**

## Suite conditionnelle et ordre de qualification

1. Reprendre l'intégration **seulement après publication** du README de mission, des changements de vol/strafe-jump, du rapport T5 et du SHA de consolidation. Comparer à la tête exacte de `main` ; ne jamais écraser une contribution parallèle.
2. Pour le lourd : régression de strafe-jump selon vitesse, orientation, dt 20/60/120 Hz, obstacles et plafonds ; préserver AZERTY/QWERTY, manette analogique et tactile. Mécanique originale, sans copie de code tiers.
3. Pour le drone : quaternion normalisé, yaw/pitch/roll, translation dans les trois axes, dérive/amortissement, collisions continues, limites de contrôles. Rejeux et checkpoints doivent reproduire les quaternions/vitesses à l'octet ou à la précision spécifiée, sur les 18 mondes.
4. Pour les performances : profilage CPU/GC/GPU du même scénario en AB/BA, plusieurs passages, même graine et même empreinte de simulation ; traiter d'abord les allocations dans `fly()` et les passages de rendu au coût mesuré. Ne pas inférer les FPS de la durée des tests CPU.
5. Rejouer la suite complète, les régressions de navigation/physique/reprise/rejeu, reconstruire `dist/index.html` et `SIZE.json`, puis essayer WebGL et commandes sur navigateur/hardware réellement disponible. Si le moteur commun doit changer, corriger et qualifier d'abord la référence FERRO, puis propager les 34 modules selon le verrou.

**Conclusion :** des pistes démontrables sont identifiées, mais ce passage n'a **pas** disposé de la source publiée de la première mission ni d'un environnement permettant de reconstruire et de qualifier une modification du jeu. Aucune modification du moteur ou du gameplay n'est proposée comme terminée. Ce document conserve la photographie vérifiée pour éviter une fusion destructrice ou un faux bilan de performance.
